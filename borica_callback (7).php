<?php
/**
 * borica_callback.php — READY (FIXED)
 * - VERIFY signature (SHA256)
 * - orderId resolution: GET order_id -> session -> CSV match by ORDER6
 * - amount/currency check against CSV on RC=00
 *   ✅ EUR expected = "като checkout" (unitEUR->lineEUR->sum) + delivery - discount
 * - update orders.csv payment fields
 * - promo consume ONLY when transitions to PAID
 * - notifications (email+viber) ONCE with lock + retry-safe (notify_lock / notify_sent)
 */
declare(strict_types=1);

session_start();
date_default_timezone_set('Europe/Sofia');

// Viber config + Settings
$configPath = __DIR__ . '/config_upload.php';
if (is_file($configPath)) require_once $configPath;

require_once __DIR__ . '/settings.php';
$SETTINGS = load_settings();
$GLOBALS['SETTINGS'] = $SETTINGS; // ✅ важно

$cfg = require __DIR__ . '/borica_config.php';
$logFile = __DIR__ . '/borica_callback.log';

function log_line(string $s): void {
  global $logFile;
  @file_put_contents($logFile, '[' . date('Y-m-d H:i:s') . '] ' . $s . "\n", FILE_APPEND);
}

function h($s): string {
  return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/**
 * ✅ FIXED: fmt_lv() вече ползва exchange_rate от settings (fallback 1.95583)
 * Идентична логика round(3)->round(2) за EUR display.
 */
function fmt_lv($n): string {
  $amount_bgn = (float)$n;

  $levAmount = round($amount_bgn, 2);
  $formatted_lv = number_format($levAmount, 2, ',', ' ') . ' лв.';

  $rate = (float)($GLOBALS['SETTINGS']['exchange_rate'] ?? 1.95583);
  if ($rate <= 0) $rate = 1.95583;

  $euroAmount = round($amount_bgn / $rate, 3);
  $euroRounded = round($euroAmount, 2);
  $formatted_euro = number_format($euroRounded, 2, ',', ' ') . ' €';

  // ✅ режим от settings (съвместим и със старото show_euro_only)
  $mode = $GLOBALS['SETTINGS']['currency_mode'] ?? '';

  if (($GLOBALS['SETTINGS']['show_euro_only'] ?? '') === '1' || $mode === 'eur_only') {
    return $formatted_euro;
  }
  if ($mode === 'bgn_only') {
    return $formatted_lv;
  }

  // both (по подразбиране)
  return $formatted_lv . ' (' . $formatted_euro . ')';
}

function round2f($n): float { return round((float)$n, 2); }

/**
 * ✅ EUR “display rounding” = round(bgn/rate, 3) -> round(2)
 */
function eur_from_bgn_display(float $bgn): float {
  $rate = (float)($GLOBALS['SETTINGS']['exchange_rate'] ?? 1.95583);
  if ($rate <= 0) $rate = 1.95583;
  $e3 = round($bgn / $rate, 3);
  return round($e3, 2);
}

/**
 * ✅ EUR total “като checkout/BORICA”:
 * unitEUR(2) * qty -> lineEUR(2) -> sum lines (2)
 * then -discountEUR(2) + deliveryEUR(2)
 */
function calc_eur_total_like_checkout_from_csv(array $ord): float {
  $shippingBGN = (float)str_replace(',', '.', (string)($ord['shipping_fee'] ?? '0'));
  $discountBGN = (float)str_replace(',', '.', (string)($ord['discount_total'] ?? '0'));

  $rawCart = (string)($ord['cart_payload_json'] ?? '');
  $parsed = json_decode($rawCart, true);
  if (!is_array($parsed)) $parsed = [];

  $subtotalEUR = 0.0;

  foreach ($parsed as $it) {
    $p = $it['product'] ?? [];
    $qty = (int)($it['qty'] ?? 0);
    if ($qty <= 0) continue;

    $unitFinalBGN = (float)($p['finalPrice'] ?? $p['price'] ?? 0);

    $unitEUR = eur_from_bgn_display($unitFinalBGN);
    $lineEUR = round2f($unitEUR * $qty);
    $subtotalEUR = round2f($subtotalEUR + $lineEUR);
  }

  $deliveryEUR = eur_from_bgn_display($shippingBGN);
  $discountEUR = eur_from_bgn_display($discountBGN);

  $finalEUR = round2f($subtotalEUR - $discountEUR + $deliveryEUR);
  if ($finalEUR < 0) $finalEUR = 0.0;

  return $finalEUR;
}

function part($value): string {
  if ($value === null) return '-';
  $s = (string)$value;
  if ($s === '') return '-';
  return strlen($s) . $s;
}

/** PROMO consume (used + usage_count) */
function update_promocode_usage(string $code): bool {
  $code = trim($code);
  if ($code === '') return false;

  $file = __DIR__ . '/promocodes.json';
  $fh = @fopen($file, 'c+');
  if (!$fh) return false;

  if (!flock($fh, LOCK_EX)) { fclose($fh); return false; }

  $raw = stream_get_contents($fh);
  $list = json_decode($raw ?: '[]', true);
  if (!is_array($list)) $list = [];

  $consumed = false;

  foreach ($list as &$row) {
    if (!isset($row['code'])) continue;
    if (strcasecmp((string)$row['code'], $code) !== 0) continue;

    $codeType   = $row['code_type'] ?? 'single';
    $usageCount = (int)($row['usage_count'] ?? 0);
    $maxUsage   = (int)($row['max_usage'] ?? ($codeType === 'multi' ? 0 : 1));

    if ($codeType === 'single' && $usageCount >= 1) break;
    if ($codeType === 'multi' && $maxUsage > 0 && $usageCount >= $maxUsage) break;
    if (!empty($row['used'])) break;

    $row['usage_count'] = $usageCount + 1;
    $consumed = true;

    if ($codeType === 'single' && $row['usage_count'] >= 1) $row['used'] = true;
    elseif ($codeType === 'multi' && $maxUsage > 0 && $row['usage_count'] >= $maxUsage) $row['used'] = true;

    $row['last_used'] = date('Y-m-d H:i:s');
    break;
  }

  ftruncate($fh, 0);
  rewind($fh);
  fwrite($fh, json_encode($list, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
  fflush($fh);

  flock($fh, LOCK_UN);
  fclose($fh);

  return $consumed;
}

function csv_read_all_locked(string $path): array {
  if (!is_file($path)) return [[], []];
  $fh = fopen($path, 'r');
  if (!$fh) return [[], []];
  if (!flock($fh, LOCK_SH)) { fclose($fh); return [[], []]; }

  $header = fgetcsv($fh);
  if (!is_array($header)) { flock($fh, LOCK_UN); fclose($fh); return [[], []]; }

  $rows = [];
  while (($row = fgetcsv($fh)) !== false) if (is_array($row)) $rows[] = $row;

  flock($fh, LOCK_UN);
  fclose($fh);
  return [$header, $rows];
}

function csv_ensure_columns(array $header, array $rows, array $neededCols): array {
  $index = [];
  foreach ($header as $i => $name) $index[(string)$name] = $i;

  $added = false;
  foreach ($neededCols as $col) {
    if (!array_key_exists($col, $index)) {
      $header[] = $col;
      $index[$col] = count($header) - 1;
      $added = true;
    }
  }

  if ($added) {
    $newLen = count($header);
    foreach ($rows as $ri => $row) {
      $row = is_array($row) ? $row : [];
      if (count($row) < $newLen) $row = array_pad($row, $newLen, '');
      $rows[$ri] = $row;
    }
  }

  return [$header, $rows, $index];
}

function csv_find_order_assoc(array $header, array $rows, string $orderId): ?array {
  if (!$header || !$rows) return null;

  $idx = [];
  foreach ($header as $i => $name) $idx[(string)$name] = $i;

  $idIdx = $idx['id'] ?? array_search('id', $header, true);
  if ($idIdx === false) return null;

  foreach ($rows as $row) {
    if (!isset($row[$idIdx])) continue;
    if ((string)$row[$idIdx] === (string)$orderId) {
      $assoc = [];
      foreach ($header as $i => $col) {
        $assoc[(string)$col] = $row[$i] ?? '';
      }
      return $assoc;
    }
  }
  return null;
}

function csv_find_order_id_by_order6(array $header, array $rows, string $order6): ?string {
  if (!$header || !$rows || $order6 === '') return null;

  $idx = [];
  foreach ($header as $i => $name) $idx[(string)$name] = $i;

  $idx6  = $idx['borica_order6'] ?? array_search('borica_order6', $header, true);
  $idxId = $idx['id'] ?? array_search('id', $header, true);

  if ($idx6 === false || $idxId === false) return null;

  foreach ($rows as $row) {
    if (!isset($row[$idx6], $row[$idxId])) continue;
    if ((string)$row[$idx6] === (string)$order6) return (string)$row[$idxId];
  }
  return null;
}

/**
 * Update payment fields in orders.csv + promo consume on transition to PAID
 */
function update_order_payment_in_csv(string $orderId, string $status, array $meta): void {
  $csvPath = __DIR__ . '/orders.csv';

  $fh = fopen($csvPath, 'c+');
  if (!$fh) { log_line("CSV UPDATE: cannot open orders.csv. order_id={$orderId}"); return; }
  if (!flock($fh, LOCK_EX)) { fclose($fh); log_line("CSV UPDATE: cannot lock. order_id={$orderId}"); return; }

  rewind($fh);
  $header = fgetcsv($fh);
  if (!is_array($header)) { flock($fh, LOCK_UN); fclose($fh); log_line("CSV UPDATE: missing header. order_id={$orderId}"); return; }

  $rows = [];
  while (($row = fgetcsv($fh)) !== false) if (is_array($row)) $rows[] = $row;

  $needed = [
    'payment_channel',
    'payment_status',
    'payment_doc_text',
    'paid_at',
    'borica_rc',
    'borica_action',
    'borica_amount',
    'borica_currency',
    'borica_order6',
    'borica_rrn',
    'borica_approval',
    'borica_int_ref',
    'borica_trtype',
    'borica_terminal',
    // notify fields:
    'notify_sent',
    'notify_sent_at',
    'notify_lock',
    'notify_lock_at',
  ];

  [$header, $rows, $idx] = csv_ensure_columns($header, $rows, $needed);

  $idIdx = $idx['id'] ?? array_search('id', $header, true);
  if ($idIdx === false) { flock($fh, LOCK_UN); fclose($fh); log_line("CSV UPDATE: no id col. order_id={$orderId}"); return; }

  $found = false;
  $shouldConsumePromo = false;
  $promoCode = '';

  foreach ($rows as $ri => $row) {
    if (!isset($row[$idIdx])) continue;
    if ((string)$row[$idIdx] !== (string)$orderId) continue;

    $found = true;
    if (count($row) < count($header)) $row = array_pad($row, count($header), '');

    $promoIdx = array_key_exists('promo_code', $idx) ? $idx['promo_code'] : array_search('promo_code', $header, true);
    $prevStatus = (string)($row[$idx['payment_status']] ?? '');

    if ($promoIdx !== false) $promoCode = trim((string)($row[$promoIdx] ?? ''));

    $rc = (string)($meta['RC'] ?? '');
    $shouldConsumePromo = (
      $status === 'PAID' &&
      $prevStatus !== 'PAID' &&
      $promoCode !== '' &&
      $rc === '00'
    );

    $row[$idx['payment_channel']]   = 'card_online';
    $row[$idx['payment_doc_text']]  = 'КАРТА (онлайн) — Борика';
    $row[$idx['payment_status']]    = $status;
    if ($status === 'PAID') $row[$idx['paid_at']] = date('Y-m-d H:i:s');

    $row[$idx['borica_rc']]       = (string)($meta['RC'] ?? '');
    $row[$idx['borica_action']]   = (string)($meta['ACTION'] ?? '');
    $row[$idx['borica_amount']]   = (string)($meta['AMOUNT'] ?? '');
    $row[$idx['borica_currency']] = (string)($meta['CURRENCY'] ?? '');
    $row[$idx['borica_order6']]   = (string)($meta['ORDER'] ?? '');
    $row[$idx['borica_rrn']]      = (string)($meta['RRN'] ?? '');
    $row[$idx['borica_approval']] = (string)($meta['APPROVAL'] ?? '');
    $row[$idx['borica_int_ref']]  = (string)($meta['INT_REF'] ?? '');
    $row[$idx['borica_trtype']]   = (string)($meta['TRTYPE'] ?? '');
    $row[$idx['borica_terminal']] = (string)($meta['TERMINAL'] ?? '');

    $rows[$ri] = $row;
    break;
  }

  if (!$found) { flock($fh, LOCK_UN); fclose($fh); log_line("CSV UPDATE: order not found. order_id={$orderId}"); return; }

  ftruncate($fh, 0);
  rewind($fh);
  fputcsv($fh, $header);
  foreach ($rows as $row) fputcsv($fh, $row);
  fflush($fh);

  flock($fh, LOCK_UN);
  fclose($fh);

  log_line("CSV UPDATE: OK order_id={$orderId} status={$status}");

  if ($shouldConsumePromo) {
    $okPromo = update_promocode_usage($promoCode);
    log_line("PROMO CONSUME: code={$promoCode} result=" . ($okPromo ? "OK" : "FAIL") . " order_id={$orderId}");
  }
}

/**
 * Acquire notify lock: prevents duplicates; allows retry if something fails.
 * Returns lock token or '' if already sent or locked by another process.
 */
function acquire_notify_lock(string $orderId, int $ttlSeconds = 180): string {
  $csvPath = __DIR__ . '/orders.csv';
  $fh = fopen($csvPath, 'c+');
  if (!$fh) return '';
  if (!flock($fh, LOCK_EX)) { fclose($fh); return ''; }

  rewind($fh);
  $header = fgetcsv($fh);
  if (!is_array($header)) { flock($fh, LOCK_UN); fclose($fh); return ''; }

  $rows = [];
  while (($row = fgetcsv($fh)) !== false) if (is_array($row)) $rows[] = $row;

  [$header, $rows, $idx] = csv_ensure_columns($header, $rows, ['notify_sent','notify_sent_at','notify_lock','notify_lock_at']);

  $idIdx = $idx['id'] ?? array_search('id', $header, true);
  if ($idIdx === false) { flock($fh, LOCK_UN); fclose($fh); return ''; }

  $token = '';
  foreach ($rows as $ri => $row) {
    if (!isset($row[$idIdx])) continue;
    if ((string)$row[$idIdx] !== (string)$orderId) continue;

    if (count($row) < count($header)) $row = array_pad($row, count($header), '');

    $sent = trim((string)($row[$idx['notify_sent']] ?? ''));
    if ($sent === '1') { $token = ''; break; } // вече изпратено

    $lock = trim((string)($row[$idx['notify_lock']] ?? ''));
    $lockAt = trim((string)($row[$idx['notify_lock_at']] ?? ''));
    $lockTs = $lockAt !== '' ? (int)strtotime($lockAt) : 0;

    $isExpired = ($lock !== '' && $lockTs > 0 && (time() - $lockTs) > $ttlSeconds);

    if ($lock !== '' && !$isExpired) { $token = ''; break; } // заключено от друг процес

    $token = bin2hex(random_bytes(12));
    $row[$idx['notify_lock']] = $token;
    $row[$idx['notify_lock_at']] = date('Y-m-d H:i:s');
    $rows[$ri] = $row;
    break;
  }

  if ($token !== '') {
    ftruncate($fh, 0);
    rewind($fh);
    fputcsv($fh, $header);
    foreach ($rows as $r) fputcsv($fh, $r);
    fflush($fh);
  }

  flock($fh, LOCK_UN);
  fclose($fh);

  return $token;
}

function release_notify_lock(string $orderId, string $token, bool $markSent): void {
  $csvPath = __DIR__ . '/orders.csv';
  $fh = fopen($csvPath, 'c+');
  if (!$fh) return;
  if (!flock($fh, LOCK_EX)) { fclose($fh); return; }

  rewind($fh);
  $header = fgetcsv($fh);
  if (!is_array($header)) { flock($fh, LOCK_UN); fclose($fh); return; }

  $rows = [];
  while (($row = fgetcsv($fh)) !== false) if (is_array($row)) $rows[] = $row;

  [$header, $rows, $idx] = csv_ensure_columns($header, $rows, ['notify_sent','notify_sent_at','notify_lock','notify_lock_at']);

  $idIdx = $idx['id'] ?? array_search('id', $header, true);
  if ($idIdx === false) { flock($fh, LOCK_UN); fclose($fh); return; }

  $changed = false;

  foreach ($rows as $ri => $row) {
    if (!isset($row[$idIdx])) continue;
    if ((string)$row[$idIdx] !== (string)$orderId) continue;

    if (count($row) < count($header)) $row = array_pad($row, count($header), '');

    $curToken = trim((string)($row[$idx['notify_lock']] ?? ''));
    if ($curToken !== $token) break;

    $row[$idx['notify_lock']] = '';
    $row[$idx['notify_lock_at']] = '';

    if ($markSent) {
      $row[$idx['notify_sent']] = '1';
      $row[$idx['notify_sent_at']] = date('Y-m-d H:i:s');
    }

    $rows[$ri] = $row;
    $changed = true;
    break;
  }

  if ($changed) {
    ftruncate($fh, 0);
    rewind($fh);
    fputcsv($fh, $header);
    foreach ($rows as $r) fputcsv($fh, $r);
    fflush($fh);
  }

  flock($fh, LOCK_UN);
  fclose($fh);
}

// ===================== VIBER =====================
function sendViberOrderNotification(
  $orderId,
  $total_gross,
  $custName,
  $custPhone,
  $ship_method,
  $pay_method,
  $rec_address,
  $rec_date,
  $rec_time,
  $items,
  $discount_details = '',
  $order_note = ''
) {

  if (!defined('VIBER_ENABLED') || !VIBER_ENABLED) return;
  if (!defined('VIBER_BOT_TOKEN')) return;

  $h = (int)date('G');
  if ($h < 8 || $h >= 22) return;

  $receivers = [];
  if (defined('VIBER_ADMIN_IDS') && is_array(VIBER_ADMIN_IDS)) $receivers = VIBER_ADMIN_IDS;
  elseif (defined('VIBER_ADMIN_ID')) $receivers = [VIBER_ADMIN_ID];

  global $SETTINGS;

  $pickupAddress = $SETTINGS['address_full'] ?? '';
  if ($ship_method === 'pickup') {
    $delivery = 'Взимане от място (' . $pickupAddress . ')';
  } else {
    $delivery = 'Доставка: ' . $rec_address;
    if ($rec_date || $rec_time) $delivery .= ' | ' . $rec_date . ' ' . $rec_time;
  }

  $paymentHuman = ($pay_method === 'cash')
    ? 'Плащане в брой при получаване'
    : 'Плащане онлайн с карта';

  $discountText = '';
  if ($discount_details !== '') $discountText = "\nОтстъпки: " . $discount_details;

  $itemsText = "Артикули:\n";
  foreach ($items as $it) {
    $code = $it['code'] ?? '';
    $qty  = $it['qty'] ?? 1;
    $name = $it['name'] ?? '';
    $note = trim((string)($it['note'] ?? ''));

    $itemsText .= ($code ? "[$code] " : "") . "{$qty}x {$name}\n";
    if ($note !== '') $itemsText .= "Бележка: {$note}\n";
    $itemsText .= "\n";
  }

  $prefix = ($pay_method === 'bank') ? "✅ ПЛАТЕНА (BORICA)\n" : "🆕 НОВА ПОРЪЧКА\n";

  $order_note = trim((string)$order_note);
  $orderNoteText = ($order_note !== '') ? ("\n📝 Бележка към поръчката: " . $order_note) : '';

  $text =
    $prefix .
    "Поръчка: {$orderId}\n" .
    "Клиент: {$custName}\n" .
    "Тел: {$custPhone}\n" .
    "Плащане: {$paymentHuman}\n" .
    "Сума: " . fmt_lv($total_gross) . $orderNoteText . "\n" .
    "{$delivery}{$discountText}\n\n" .
    $itemsText;

  foreach ($receivers as $id) {
    $payload = [
      'receiver' => $id,
      'type'     => 'text',
      'text'     => $text,
      'sender'   => ['name' => 'Сомбреро']
    ];

    $ch = curl_init('https://chatapi.viber.com/pa/send_message');
    curl_setopt_array($ch, [
      CURLOPT_POST           => true,
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'X-Viber-Auth-Token: ' . VIBER_BOT_TOKEN,
      ],
      CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
      CURLOPT_TIMEOUT        => 10
    ]);
    curl_exec($ch);
    curl_close($ch);
  }
}

// ===================== BEGIN CALLBACK =====================
$post = $_POST;

log_line("=== CALLBACK ===");
log_line("GET: " . json_encode($_GET, JSON_UNESCAPED_UNICODE));
log_line("POST: " . json_encode($_POST, JSON_UNESCAPED_UNICODE));

// Resolve orderId
$orderId = '';
if (!empty($_GET['order_id'])) $orderId = (string)$_GET['order_id'];
elseif (!empty($_SESSION['borica_pay']['order_id'])) $orderId = (string)$_SESSION['borica_pay']['order_id'];

// ✅ EARLY RESOLVE: ако нямаме orderId, опитваме да го намерим по ORDER(=order6) от POST
if ($orderId === '' && !empty($_POST['ORDER'])) {
  $order6 = (string)$_POST['ORDER'];
  [$hdrTmp, $rowsTmp] = csv_read_all_locked(__DIR__ . '/orders.csv');
  $foundId = csv_find_order_id_by_order6($hdrTmp, $rowsTmp, $order6);
  if ($foundId) {
    $orderId = $foundId;
    log_line("EARLY ORDER6 MATCH: ORDER={$order6} -> order_id={$orderId}");
  }
}

// Required P_SIGN
$P_SIGN = (string)($post['P_SIGN'] ?? '');
if ($P_SIGN === '') {
  log_line("ERROR: missing P_SIGN");
  if ($orderId !== '') update_order_payment_in_csv($orderId, 'FAILED', ['RC'=>'missing_psign', 'ACTION'=>'']);
  header('Location: /thank-you.php?order_id=' . urlencode($orderId) . '&pay=bank&payment_status=fail&error=missing_psign');
  exit;
}

// Read fields (response)
$ACTION       = (string)($post['ACTION'] ?? '');
$RC           = (string)($post['RC'] ?? '');
$APPROVAL     = (string)($post['APPROVAL'] ?? '');
$TERMINAL     = (string)($post['TERMINAL'] ?? '');
$TRTYPE       = (string)($post['TRTYPE'] ?? '');
$AMOUNT       = (string)($post['AMOUNT'] ?? '');
$CURRENCY     = (string)($post['CURRENCY'] ?? '');
$ORDER        = (string)($post['ORDER'] ?? '');
$RRN          = (string)($post['RRN'] ?? '');
$INT_REF      = (string)($post['INT_REF'] ?? '');
$PARES_STATUS = (string)($post['PARES_STATUS'] ?? '');
$ECI          = (string)($post['ECI'] ?? '');
$TIMESTAMP    = (string)($post['TIMESTAMP'] ?? '');
$NONCE        = (string)($post['NONCE'] ?? '');

// Ако няма orderId, търсим по ORDER6 в CSV
if ($orderId === '' && $ORDER !== '') {
  [$hdrTmp, $rowsTmp] = csv_read_all_locked(__DIR__ . '/orders.csv');
  $foundId = csv_find_order_id_by_order6($hdrTmp, $rowsTmp, $ORDER);
  if ($foundId) { $orderId = $foundId; log_line("ORDER6 MATCH: ORDER={$ORDER} -> order_id={$orderId}"); }
  else log_line("ORDER6 NO MATCH: ORDER={$ORDER}");
}

// защита mismatch (ако BACKREF носи order6)
$order6_from_get = (string)($_GET['order6'] ?? '');
if ($order6_from_get !== '' && $ORDER !== '' && $order6_from_get !== $ORDER) {
  log_line("ERROR: ORDER mismatch. GET order6={$order6_from_get} POST ORDER={$ORDER} order_id={$orderId}");
  unset($_SESSION['borica_pay']);
  if ($orderId !== '') update_order_payment_in_csv($orderId, 'FAILED', [
    'RC'=>'order_mismatch','ACTION'=>$ACTION,'ORDER'=>$ORDER,'AMOUNT'=>$AMOUNT,'CURRENCY'=>$CURRENCY,
    'RRN'=>$RRN,'APPROVAL'=>$APPROVAL,'INT_REF'=>$INT_REF,'TRTYPE'=>$TRTYPE,'TERMINAL'=>$TERMINAL
  ]);
  header('Location: /thank-you.php?order_id=' . urlencode($orderId) . '&pay=bank&payment_status=fail&error=order_mismatch');
  exit;
}

// Signature symbol (response)
$symbol =
  part($ACTION) .
  part($RC) .
  part($APPROVAL) .
  part($TERMINAL) .
  part($TRTYPE) .
  part($AMOUNT) .
  part($CURRENCY) .
  part($ORDER) .
  part($RRN) .
  part($INT_REF) .
  part($PARES_STATUS) .
  part($ECI) .
  part($TIMESTAMP) .
  part($NONCE) .
  '-';

// Public key
$pubPem = '';
if (!empty($cfg['BORICA_PUBLIC_KEY_PEM'])) $pubPem = (string)$cfg['BORICA_PUBLIC_KEY_PEM'];
else $pubPem = @file_get_contents((string)($cfg['BORICA_PUBLIC_KEY_PATH'] ?? '')) ?: '';

if (trim($pubPem) === '') {
  log_line("ERROR: missing public key");
  if ($orderId !== '') update_order_payment_in_csv($orderId, 'FAILED', ['RC'=>'missing_public_key','ACTION'=>$ACTION,'ORDER'=>$ORDER]);
  header('Location: /thank-you.php?order_id=' . urlencode($orderId) . '&pay=bank&payment_status=fail&error=missing_public_key');
  exit;
}

$pubKey = @openssl_get_publickey($pubPem);
if (!$pubKey) {
  log_line("ERROR: bad public key");
  if ($orderId !== '') update_order_payment_in_csv($orderId, 'FAILED', ['RC'=>'bad_public_key','ACTION'=>$ACTION,'ORDER'=>$ORDER]);
  header('Location: /thank-you.php?order_id=' . urlencode($orderId) . '&pay=bank&payment_status=fail&error=bad_public_key');
  exit;
}

$sigBin = @hex2bin($P_SIGN);
if ($sigBin === false) {
  log_line("ERROR: bad P_SIGN hex");
  openssl_free_key($pubKey);
  if ($orderId !== '') update_order_payment_in_csv($orderId, 'FAILED', ['RC'=>'bad_psign','ACTION'=>$ACTION,'ORDER'=>$ORDER]);
  header('Location: /thank-you.php?order_id=' . urlencode($orderId) . '&pay=bank&payment_status=fail&error=bad_psign');
  exit;
}

$verified = openssl_verify($symbol, $sigBin, $pubKey, OPENSSL_ALGO_SHA256);
openssl_free_key($pubKey);

if ($verified !== 1) {
  log_line("ERROR: signature invalid");
  if ($orderId !== '') update_order_payment_in_csv($orderId, 'FAILED', ['RC'=>'signature_invalid','ACTION'=>$ACTION,'ORDER'=>$ORDER,'AMOUNT'=>$AMOUNT,'CURRENCY'=>$CURRENCY]);
  header('Location: /thank-you.php?order_id=' . urlencode($orderId) . '&pay=bank&payment_status=fail&error=signature_invalid');
  exit;
}

// ✅ TRTYPE check on success (SALE must be 1)
if ($RC === '00' && $TRTYPE !== '1') {
  log_line("ERROR: unexpected TRTYPE={$TRTYPE} on RC=00");
  if ($orderId !== '') update_order_payment_in_csv($orderId, 'FAILED', ['RC'=>'bad_trtype','TRTYPE'=>$TRTYPE,'ACTION'=>$ACTION,'ORDER'=>$ORDER,'AMOUNT'=>$AMOUNT,'CURRENCY'=>$CURRENCY]);
  header('Location: /thank-you.php?order_id=' . urlencode($orderId) . '&pay=bank&payment_status=fail&error=bad_trtype');
  exit;
}

// ✅ Amount/currency check against CSV on RC=00
if ($RC === '00' && $orderId !== '') {
  [$hdrChk, $rowsChk] = csv_read_all_locked(__DIR__ . '/orders.csv');
  $ord = csv_find_order_assoc($hdrChk, $rowsChk, $orderId);

  if (!is_array($ord)) {
    log_line("ERROR: order not found in CSV during amount check. order_id={$orderId} ORDER={$ORDER}");
    update_order_payment_in_csv($orderId, 'FAILED', [
      'RC'=>'order_not_found','ACTION'=>$ACTION,'ORDER'=>$ORDER,'AMOUNT'=>$AMOUNT,'CURRENCY'=>$CURRENCY,
    ]);
    header('Location: /thank-you.php?order_id=' . urlencode($orderId) . '&pay=bank&payment_status=fail&error=order_not_found');
    exit;
  }

  $expectedBGN = (float)str_replace(',', '.', (string)($ord['grand_total'] ?? '0'));
  $paid        = (float)str_replace(',', '.', (string)$AMOUNT);

  $curr = strtoupper(trim((string)$CURRENCY));

  if ($curr === 'BGN') {
    $expected = $expectedBGN;
  } elseif ($curr === 'EUR') {
    // ✅ FIX: expected EUR = "като checkout/BORICA" (по редове)
    $expected = calc_eur_total_like_checkout_from_csv($ord);
  } else {
    log_line("ERROR: unsupported currency curr={$curr} order_id={$orderId}");
    update_order_payment_in_csv($orderId, 'FAILED', [
      'RC'=>'unsupported_currency',
      'ACTION'=>$ACTION,'ORDER'=>$ORDER,'AMOUNT'=>$AMOUNT,'CURRENCY'=>$CURRENCY,
    ]);
    header('Location: /thank-you.php?order_id=' . urlencode($orderId) . '&pay=bank&payment_status=fail&error=unsupported_currency');
    exit;
  }

  // ✅ След фикса разликите трябва да са нула или до 0.01 (заради формат/float).
  if (abs($expected - $paid) > 0.02) {
    log_line("ERROR: AMOUNT mismatch expected={$expected} paid={$paid} curr={$curr} order_id={$orderId}");
    update_order_payment_in_csv($orderId, 'FAILED', [
      'RC'=>'amount_mismatch',
      'ACTION'=>$ACTION,'ORDER'=>$ORDER,'AMOUNT'=>$AMOUNT,'CURRENCY'=>$CURRENCY,
    ]);
    header('Location: /thank-you.php?order_id=' . urlencode($orderId) . '&pay=bank&payment_status=fail&error=amount_mismatch');
    exit;
  }
}

// Status map
$payment_status = 'fail';
$csv_status = 'FAILED';
if ($RC === '00') { $payment_status = 'success'; $csv_status = 'PAID'; }
elseif ($RC === '17' || strtolower($ACTION) === 'cancel' || strtolower($ACTION) === 'canceled') { $payment_status = 'cancel'; $csv_status = 'CANCELLED'; }

$meta = [
  'ACTION'   => $ACTION,
  'RC'       => $RC,
  'APPROVAL' => $APPROVAL,
  'TERMINAL' => $TERMINAL,
  'TRTYPE'   => $TRTYPE,
  'AMOUNT'   => $AMOUNT,
  'CURRENCY' => $CURRENCY,
  'ORDER'    => $ORDER,
  'RRN'      => $RRN,
  'INT_REF'  => $INT_REF,
];

if ($orderId !== '') update_order_payment_in_csv($orderId, $csv_status, $meta);
else log_line("WARN: cannot update CSV because orderId is empty. ORDER={$ORDER}");

unset($_SESSION['borica_pay']);

// ===================== Notifications on PAID (retry-safe) =====================
$notifyOk = false;

if ($csv_status === 'PAID' && $orderId !== '') {
  $lockToken = acquire_notify_lock($orderId);
  if ($lockToken !== '') {

    try {
      [$hdr, $rows] = csv_read_all_locked(__DIR__ . '/orders.csv');
      $orderAssoc = csv_find_order_assoc($hdr, $rows, $orderId);

      if (!is_array($orderAssoc)) {
        log_line("NOTIFY FAIL: cannot load order from CSV order_id={$orderId}");
        $notifyOk = false;
      } else {
        $shopName   = $SETTINGS['shop_name']   ?? 'Магазин';
        $shopEmail  = $SETTINGS['shop_email']  ?? '';
        $orderInbox = !empty($SETTINGS['order_email']) ? $SETTINGS['order_email'] : $shopEmail;

        $cust_email = (string)($orderAssoc['cust_email'] ?? '');
        $cust_name  = (string)($orderAssoc['cust_name'] ?? '');
        $cust_phone = (string)($orderAssoc['cust_phone'] ?? '');

        $ship_method = (string)($orderAssoc['ship_method'] ?? '');
        $rec_address = (string)($orderAssoc['rec_address'] ?? '');
        $rec_date    = (string)($orderAssoc['rec_date'] ?? '');
        $rec_time    = (string)($orderAssoc['rec_time'] ?? '');

        $promo_code = (string)($orderAssoc['promo_code'] ?? '');
        $discount_details = (string)($orderAssoc['discount_info'] ?? '');
        $grandTotal = (float)str_replace(',', '.', (string)($orderAssoc['grand_total'] ?? '0'));
        $order_note = (string)($orderAssoc['order_note'] ?? '');

        // Items from cart_payload_json
        $items = [];
        $rawCart = (string)($orderAssoc['cart_payload_json'] ?? '');
        if ($rawCart !== '') {
          $parsed = json_decode($rawCart, true);
          if (is_array($parsed)) {
            foreach ($parsed as $row) {
              $p = $row['product'] ?? [];
              $qty = (int)($row['qty'] ?? 0);
              if ($qty <= 0) continue;
              $items[] = [
                'code' => (string)($p['code'] ?? ($p['id'] ?? '')),
                'name' => (string)($p['name'] ?? ''),
                'qty'  => $qty,
                'note' => (string)($row['note'] ?? ''),
              ];
            }
          }
        }

        // Email (кратък, надежден)
        $subjectText = "Поръчка {$orderId} — ПЛАТЕНА (BORICA)";
        $subject = '=?UTF-8?B?' . base64_encode($subjectText) . '?=';

        $html = '<!doctype html><html><head><meta charset="UTF-8"></head><body style="font-family:Arial,sans-serif;line-height:1.5;">
          <h2>Плащането е успешно ✅</h2>
          <p><strong>Поръчка:</strong> ' . h($orderId) . '</p>
          <p><strong>Сума:</strong> ' . h(fmt_lv($grandTotal)) . '</p>
          <p><strong>Клиент:</strong> ' . h($cust_name) . ' / ' . h($cust_phone) . '</p>
          <p><strong>Доставка:</strong> ' . h($ship_method === 'pickup' ? 'Взимане от място' : $rec_address) . '</p>
          ' . ($rec_date || $rec_time ? '<p><strong>Кога:</strong> ' . h(trim($rec_date . ' ' . $rec_time)) . '</p>' : '') . '
          ' . ($promo_code !== '' ? '<p><strong>Промо код:</strong> ' . h($promo_code) . '</p>' : '') . '
          ' . ($discount_details !== '' ? '<p><strong>Отстъпки:</strong> ' . h($discount_details) . '</p>' : '') . '
          <h3>Артикули</h3><ul>';

        foreach ($items as $it) {
          $line = ($it['code'] ? '[' . $it['code'] . '] ' : '') . $it['qty'] . 'x ' . $it['name'];
          if (trim((string)$it['note']) !== '') $line .= ' — бележка: ' . $it['note'];
          $html .= '<li>' . h($line) . '</li>';
        }
        $html .= '</ul></body></html>';

        $fromEmail = $shopEmail !== '' ? $shopEmail : ($orderInbox ?: ('no-reply@' . ($_SERVER['HTTP_HOST'] ?? 'localhost')));

        $headersArr = [];
        $headersArr[] = "MIME-Version: 1.0";
        $headersArr[] = "Content-Type: text/html; charset=UTF-8";
        $headersArr[] = "Content-Transfer-Encoding: 8bit";
        $headersArr[] = "From: " . mb_encode_mimeheader($shopName, 'UTF-8', 'B') . " <{$fromEmail}>";
        $headersArr[] = "Reply-To: {$fromEmail}";
        $headers = implode("\r\n", $headersArr) . "\r\n";
        $extraParams = (strpos($fromEmail, '@') !== false) ? "-f {$fromEmail}" : "";

        @mail($orderInbox, $subject, $html, $headers, $extraParams);
        if ($cust_email !== '') @mail($cust_email, $subject, $html, $headers, $extraParams);

        // Viber
        sendViberOrderNotification(
          $orderId,
          $grandTotal,
          $cust_name,
          $cust_phone,
          $ship_method,
          'bank',
          $rec_address,
          $rec_date,
          $rec_time,
          $items,
          $discount_details,
          $order_note
        );

        $notifyOk = true;
        log_line("NOTIFY OK: order_id={$orderId}");
      }
    } catch (Throwable $e) {
      $notifyOk = false;
      log_line("NOTIFY EXCEPTION: order_id={$orderId} err=" . $e->getMessage());
    }

    // mark sent ONLY if notifyOk
    release_notify_lock($orderId, $lockToken, $notifyOk);

  } else {
    log_line("NOTIFY SKIP: already sent or locked. order_id={$orderId}");
  }
}

// ===================== Redirect към thank-you =====================
[$hdr2, $rows2] = csv_read_all_locked(__DIR__ . '/orders.csv');
$orderAssoc2 = ($orderId !== '') ? csv_find_order_assoc($hdr2, $rows2, $orderId) : null;

$query = [
  'order_id'       => $orderId,
  'pay'            => 'bank',
  'payment_status' => $payment_status,
];

if (is_array($orderAssoc2)) {
  if (!empty($orderAssoc2['ship_method'])) $query['ship'] = (string)$orderAssoc2['ship_method'];
  if (!empty($orderAssoc2['promo_code'])) $query['promo'] = (string)$orderAssoc2['promo_code'];
  if (!empty($orderAssoc2['discount_info'])) $query['discount_info'] = (string)$orderAssoc2['discount_info'];
  if (isset($orderAssoc2['discount_total']) && $orderAssoc2['discount_total'] !== '') $query['discount_total'] = (string)$orderAssoc2['discount_total'];
  if (isset($orderAssoc2['grand_total']) && $orderAssoc2['grand_total'] !== '') $query['total'] = (string)$orderAssoc2['grand_total'];
}

if ($payment_status !== 'success') {
  $query['error'] = ($RC !== '') ? $RC : ($ACTION !== '' ? $ACTION : 'unknown');
}

header('Location: /thank-you.php?' . http_build_query($query));
exit;
