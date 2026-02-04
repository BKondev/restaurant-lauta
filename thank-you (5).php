<?php
// thank-you.php — страница след успешна поръчка / резултат от онлайн плащане
// ✅ FIX: EUR на THANK YOU = 100% като CHECKOUT:
//   - смятаме EUR от cart_payload_json -> product.finalEuro (unitEUR * qty -> lineEUR -> sum)
//   - discount EUR взимаме от discount_info ако има "€" (пример: "-18,75 €")
//   - ако pay=bank и в CSV има borica_currency=EUR + borica_amount -> показваме ТОЧНО borica_amount (идеален синхрон)

require_once __DIR__ . '/settings.php';
$SETTINGS = load_settings();
$GLOBALS['SETTINGS'] = $SETTINGS;

function h($s){
  return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function fx_rate(): float {
  $rate = (float)($GLOBALS['SETTINGS']['exchange_rate'] ?? 1.95583);
  if ($rate <= 0) $rate = 1.95583;
  return $rate;
}

// fallback EUR display (BGN -> EUR round(3)->round(2))
function eur_from_bgn_display(float $bgn): float {
  $rate = fx_rate();
  $e3 = round($bgn / $rate, 3);
  return round($e3, 2);
}

// ===== CSV helpers =====
function read_order_row_from_csv(string $orderId): ?array {
  $ordersCsv = __DIR__ . '/orders.csv';
  if ($orderId === '' || !is_file($ordersCsv)) return null;

  $fh = @fopen($ordersCsv, 'r');
  if (!$fh) return null;

  $header = fgetcsv($fh);
  if (!is_array($header)) { fclose($fh); return null; }

  $idx = [];
  foreach ($header as $i => $col) {
    $col = trim((string)$col);
    $idx[$col] = $i;
  }

  while (($row = fgetcsv($fh)) !== false) {
    $idIdx = $idx['id'] ?? null;
    if ($idIdx === null || !isset($row[$idIdx])) continue;
    if (trim((string)$row[$idIdx]) !== $orderId) continue;

    fclose($fh);
    return ['header' => $idx, 'row' => $row];
  }

  fclose($fh);
  return null;
}

function csv_get(array $idx, array $row, string $col): string {
  $i = $idx[$col] ?? null;
  if ($i === null || !isset($row[$i])) return '';
  return trim((string)$row[$i]);
}

function parse_amount(string $s): float {
  $s = trim($s);
  if ($s === '') return 0.0;
  $s = str_replace(["\xC2\xA0", ' '], '', $s); // nbsp + spaces
  $s = str_replace(',', '.', $s);
  return is_numeric($s) ? (float)$s : 0.0;
}

// Вади ПЪРВАТА EUR сума от discount_info (пример: "-18,75 € (...)")
function parse_first_eur_from_text(string $txt): float {
  $txt = (string)$txt;
  if ($txt === '') return 0.0;

  // търсим число преди €
  if (preg_match('/(-?\s*\d+(?:[.,]\d{1,2})?)\s*€/', $txt, $m)) {
    $v = parse_amount($m[1]);
    return abs($v);
  }
  return 0.0;
}

// ===== EUR total like checkout, using stored finalEuro =====
function calc_total_eur_like_checkout_from_order_row(array $idx, array $row): ?float {
  $cartJson = csv_get($idx, $row, 'cart_payload_json');
  if ($cartJson === '') return null;

  $shippingFeeBGN = parse_amount(csv_get($idx, $row, 'shipping_fee'));
  $discountInfo   = csv_get($idx, $row, 'discount_info');
  $discountBGN    = parse_amount(csv_get($idx, $row, 'discount_total'));

  $parsed = json_decode($cartJson, true);
  if (!is_array($parsed)) $parsed = [];

  $subtotalCents = 0;

  foreach ($parsed as $it) {
    $p = $it['product'] ?? [];
    $qty = (int)($it['qty'] ?? 0);
    if ($qty <= 0) continue;

    // ✅ взимаме директно finalEuro (това е "показаната" единична EUR цена в checkout)
    $unitEUR = null;

    if (isset($p['finalEuro']) && $p['finalEuro'] !== '') {
      $unitEUR = (float)$p['finalEuro'];
    } else {
      // fallback ако няма finalEuro (не е идеално, но по-добре от нищо)
      $unitFinalBGN = (float)($p['finalPrice'] ?? $p['price'] ?? 0);
      $unitEUR = eur_from_bgn_display($unitFinalBGN);
    }

    // unitEUR -> cents (2 decimals)
    $unitCents = (int) round($unitEUR * 100, 0, PHP_ROUND_HALF_UP);

    // line = unit * qty (в центове)
    $subtotalCents += ($unitCents * $qty);
  }

  // ✅ discount EUR: ако discount_info има "€" – взимаме него (100% като checkout)
  $discountEUR = parse_first_eur_from_text($discountInfo);
  if ($discountEUR <= 0 && $discountBGN > 0) {
    // fallback: convert BGN discount (може да даде 0.01 разлика ако checkout е по finalEuro логика)
    $discountEUR = eur_from_bgn_display($discountBGN);
  }
  $discountCents = (int) round($discountEUR * 100, 0, PHP_ROUND_HALF_UP);

  // delivery EUR: в checkout при теб е 0,00 или конвертирано – взимаме от BGN->EUR display
  $deliveryEUR = eur_from_bgn_display($shippingFeeBGN);
  $deliveryCents = (int) round($deliveryEUR * 100, 0, PHP_ROUND_HALF_UP);

  $finalCents = $subtotalCents - $discountCents + $deliveryCents;
  if ($finalCents < 0) $finalCents = 0;

  return $finalCents / 100.0;
}

// ===== Money formatting =====
function fmt_money($amountBGN){
  $amountBGN = (float)$amountBGN;

  $formatted_bgn = number_format($amountBGN, 2, ',', ' ') . ' лв.';
  $amountEUR = eur_from_bgn_display($amountBGN);
  $formatted_eur = number_format($amountEUR, 2, ',', ' ') . ' €';

  $mode = $GLOBALS['SETTINGS']['currency_mode'] ?? 'both';

  // ✅ IMPORTANT: в both режим EUR частта да е като checkout, ако има order_id
  if ($mode === 'both') {
    $orderId = isset($_GET['order_id']) ? trim((string)$_GET['order_id']) : '';
    if ($orderId !== '') {
      $found = read_order_row_from_csv($orderId);
      if ($found) {
        $eur = calc_total_eur_like_checkout_from_order_row($found['header'], $found['row']);
        if ($eur !== null) {
          $formatted_eur = number_format($eur, 2, ',', ' ') . ' €';
        }
      }
    }
    return $formatted_bgn . ' (' . $formatted_eur . ')';
  }

  if ($mode === 'eur_only') return $formatted_eur;
  if ($mode === 'bgn_only') return $formatted_bgn;

  return $formatted_bgn . ' (' . $formatted_eur . ')';
}

// ===================== Данни от settings.php =====================
$shopName  = $SETTINGS['shop_name'] ?? 'Ресторант Сомбреро';
$shopPhone = $SETTINGS['phone_display'] ?? '';
$shopEmail = $SETTINGS['shop_email'] ?? '';

// ===================== ВЗИМАНЕ ОТ МЯСТО =====================
$pickupAddress      = $SETTINGS['address_full'] ?? '';
$pickupWorkHours    = $SETTINGS['work_hours'] ?? 'Понеделник - Петък: 09:00 - 18:00, Събота: 09:00 - 16:00';
$pickupInstructions = $SETTINGS['pickup_instructions'] ?? 'Моля, предявете номера на поръчката при взимане.';

// ===================== ДОСТАВКА =====================
$deliveryArea         = $SETTINGS['delivery_area'] ?? 'гр. Пловдив';
$deliveryHours        = $SETTINGS['delivery_hours'] ?? 'Вторник - Събота: 11:00 - 22:00';
$deliveryInstructions = $SETTINGS['delivery_instructions'] ?? 'Куриерът ще се обади предварително. Моля, бъдете на посочения адрес.';

// ===================== Данни от redirect =====================
$orderId       = isset($_GET['order_id']) ? trim((string)$_GET['order_id']) : '';
$ship          = isset($_GET['ship']) ? trim((string)$_GET['ship']) : '';
$pay           = isset($_GET['pay']) ? trim((string)$_GET['pay']) : '';
$promoCode     = isset($_GET['promo']) ? trim((string)$_GET['promo']) : '';
$discountInfo  = isset($_GET['discount_info']) ? trim((string)$_GET['discount_info']) : '';
$discountTotal = isset($_GET['discount_total']) ? (float)$_GET['discount_total'] : 0.0;
$totalAmount   = isset($_GET['total']) ? (float)$_GET['total'] : 0.0;

// BORICA status
$paymentStatus = isset($_GET['payment_status']) ? strtolower(trim((string)$_GET['payment_status'])) : '';
if ($paymentStatus === '' && isset($_GET['status'])) {
  $st = strtolower(trim((string)$_GET['status']));
  if ($st === 'paid') $paymentStatus = 'success';
}

$isOnlinePay = ($pay === 'bank');
$isPaid      = ($isOnlinePay && $paymentStatus === 'success');

// ===================== Заглавие/съобщение =====================
$title = 'Благодарим за поръчката!';
$icon = '✓';
$message = 'Поръчката е приета успешно и е записана в нашата система.';
$messageClass = '';

if ($pay === 'bank') {
  if ($paymentStatus === 'fail') {
    $title = 'Плащането не бе успешно';
    $icon = '❌';
    $message = 'Възникна грешка при обработката на плащането. Моля, опитайте отново или се свържете с нас.';
    $messageClass = 'error';
  } elseif ($paymentStatus === 'cancel') {
    $title = 'Плащането бе отказано';
    $icon = '⚠️';
    $message = 'Плащането бе отказано от ваша страна или платежната система.';
    $messageClass = 'warning';
  } elseif (!$isPaid) {
    $title = 'Очаква потвърждение';
    $icon = '⏳';
    $message = 'Плащането все още не е потвърдено. Моля, изчакайте или се свържете с нас за съдействие.';
    $messageClass = 'info';
  }
}

// Отстъпки (за списък)
$discountDetails = [];
if ($discountInfo) {
  $parts = explode(' | ', $discountInfo);
  foreach ($parts as $part) {
    $part = trim($part);
    if ($part !== '') $discountDetails[] = $part;
  }
}

$payTitle = ($pay === 'bank') ? 'Плащане с карта (онлайн)' : 'Плащане в брой';

$payBadgeText = '';
$payBadgeClass = 'badge-unpaid';

if ($pay === 'cash') {
  $payBadgeText  = 'ПЛАЩАНЕ ПРИ ПОЛУЧАВАНЕ';
  $payBadgeClass = 'badge-unpaid';
} elseif ($pay === 'bank') {
  if ($paymentStatus === 'success') {
    $payBadgeText  = 'ПЛАЩАНЕ УСПЕШНО';
    $payBadgeClass = 'badge-paid';
  } elseif ($paymentStatus === 'fail') {
    $payBadgeText  = 'ПЛАЩАНЕ НЕУСПЕШНО';
    $payBadgeClass = 'badge-unpaid';
  } elseif ($paymentStatus === 'cancel') {
    $payBadgeText  = 'ПЛАЩАНЕ ОТКАЗАНО';
    $payBadgeClass = 'badge-unpaid';
  } else {
    $payBadgeText  = 'ОЧАКВА ПЛАЩАНЕ';
    $payBadgeClass = 'badge-unpaid';
  }
} else {
  $payBadgeText = 'НЕИЗВЕСТНО';
  $payBadgeClass = 'badge-unpaid';
}

// ===================== ✅ DISPLAY TOTAL (100% sync) =====================
$mode = ($GLOBALS['SETTINGS']['currency_mode'] ?? 'both');

// default: ако не сме eur_only -> ползваме BGN тотала (query)
$displayTotalEUR = null;

// ако сме EUR-only -> най-важно е EUR, взимаме от CSV
if ($mode === 'eur_only' && $orderId !== '') {
  $found = read_order_row_from_csv($orderId);
  if ($found) {
    $idx = $found['header'];
    $row = $found['row'];

    // 1) ако имаме BORICA EUR amount -> това е абсолютния синхрон
    $borCurr = strtoupper(csv_get($idx, $row, 'borica_currency'));
    $borAmt  = parse_amount(csv_get($idx, $row, 'borica_amount'));

    if ($pay === 'bank' && $borCurr === 'EUR' && $borAmt > 0) {
      $displayTotalEUR = round($borAmt, 2);
    } else {
      // 2) иначе смятаме като checkout от finalEuro
      $calc = calc_total_eur_like_checkout_from_order_row($idx, $row);
      if ($calc !== null) $displayTotalEUR = round($calc, 2);
    }
  }
}

// fallback EUR-only ако не успее
if ($mode === 'eur_only' && $displayTotalEUR === null) {
  $displayTotalEUR = eur_from_bgn_display((float)$totalAmount);
}

?>
<!doctype html>
<html lang="bg">
<head>
  <meta charset="utf-8">
  <title><?php echo h($title); ?> — <?php echo h($shopName); ?></title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    :root{
      --bg:#ffffff; --text:#0f172a; --muted:#64748b; --border:#e5e7eb;
      --primary:#2563eb; --radius:16px; --shadow:0 18px 36px rgba(15,23,42,.10);
      --success:#16a34a; --danger:#dc2626; --warning:#f59e0b;
      --pickup:#3b82f6; --delivery:#10b981;
    }
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      background:#f8fafc;
      color:var(--text);
      font:16px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
      padding:20px;
    }
    .wrap{max-width:640px;margin:0 auto;}
    .card{
      background:#fff;border-radius:var(--radius);border:1px solid var(--border);
      box-shadow:var(--shadow);padding:24px 20px 20px;
    }
    h1{font-size:22px;margin-bottom:6px;display:flex;align-items:center;gap:10px;}
    .ok{font-size:14px;margin-bottom:16px;}
    .ok.error { color: #dc2626; }
    .ok.warning { color: #f59e0b; }
    .ok.info { color: #64748b; }
    .order-number{
      display:inline-block;margin:8px 0 16px;padding:6px 10px;border-radius:999px;
      background:#eff6ff;color:#1d4ed8;font-size:14px;font-weight:700;
    }
    h2{font-size:17px;margin:18px 0 6px;display:flex;align-items:center;gap:8px;}
    p{margin:4px 0 0;}

    .section-box{
      border-radius:12px;padding:14px 16px;margin-top:8px;font-size:14px;
      position:relative;overflow:hidden;
    }
    .pickup-box{background:#f0f9ff;border:1px solid #bfdbfe;border-left:4px solid var(--pickup);}
    .delivery-box{background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid var(--delivery);}
    .payment-box{background:#fefce8;border:1px solid #fef08a;border-left:4px solid #eab308;}

    .section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
    .section-title{font-weight:700;font-size:15px;display:flex;align-items:center;gap:8px;}
    .section-title .icon{font-size:18px;}
    .details-grid{display:grid;gap:8px;margin-top:10px;}
    .detail-row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed rgba(0,0,0,0.08);}
    .detail-row:last-child{border-bottom:none;}
    .detail-label{color:#475569;font-weight:500;}
    .detail-value{font-weight:600;text-align:right;max-width:100%;}
    .address-highlight{
      background:#fff;padding:10px 12px;border-radius:8px;border:1px solid #e2e8f0;
      margin:8px 0;font-weight:600;color:#1e293b;
    }
    .instructions{
      background:#f8fafc;padding:10px 12px;border-radius:8px;margin-top:10px;
      font-size:13px;color:#475569;border-left:3px solid #94a3b8;
    }

    .actions{margin-top:20px;display:flex;flex-wrap:wrap;gap:10px;}
    .btn{
      display:inline-flex;align-items:center;justify-content:center;padding:10px 16px;
      border-radius:999px;border:0;cursor:pointer;font-weight:700;font-size:14px;text-decoration:none;
    }
    .btn-primary{background:linear-gradient(135deg,#3b82f6,#06b6d4,#ec4899);color:#fff;}
    .btn-ghost{background:transparent;border:1px solid var(--border);color:var(--text);}
    .hint{margin-top:10px;font-size:13px;color:var(--muted);}

    .promo-box{
      margin-top:14px;border-radius:12px;border:1px dashed var(--border);
      padding:12px 14px;background:#ecfdf5;font-size:14px;
    }
    .promo-box h3{font-size:16px;margin:0 0 8px 0;color:var(--success);}
    .discount-item{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #cbd5e1;}
    .discount-item:last-child{border-bottom:none;}
    .discount-label{color:#475569;}
    .discount-value{font-weight:700;color:#dc2626;}
    .discount-details{
      margin-top:8px;padding:8px;background:#f1f5f9;border-radius:8px;border-left:3px solid var(--primary);
    }
    .discount-details ul{margin:4px 0;padding-left:20px;}
    .discount-details li{margin:2px 0;color:#475569;}

    .total-box{
      margin-top:16px;padding:12px 14px;border-radius:12px;background:#f0f9ff;border:2px solid #3b82f6;
    }
    .total-box .total-row{display:flex;justify-content:space-between;align-items:center;font-size:16px;font-weight:700;}
    .total-amount{font-size:20px;color:#1d4ed8;}

    .contact-info{display:flex;gap:15px;margin-top:10px;flex-wrap:wrap;}
    .contact-item{display:flex;align-items:center;gap:6px;font-size:14px;color:#475569;}
    .contact-item a{color:#3b82f6;text-decoration:none;font-weight:500;}
    .contact-item a:hover{text-decoration:underline;}

    .badge{
      display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;
    }
    .badge-delivery{background:#dcfce7;color:#16a34a;}
    .badge-paid{background:#f0fdf4;color:#16a34a;}
    .badge-unpaid{background:#fef2f2;color:#dc2626;}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>
        <span class="icon"><?php echo h($icon); ?></span>
        <?php echo h($title); ?>
      </h1>

      <div class="ok <?php echo h($messageClass); ?>">
        <?php echo h($message); ?>
        <?php if ($orderId): ?>
          <br>Номер на поръчка: <strong><?php echo h($orderId); ?></strong>
        <?php endif; ?>
      </div>

      <?php if ($orderId): ?>
        <div class="order-number">Номер на поръчка: <?php echo h($orderId); ?></div>
      <?php endif; ?>

      <?php if ($orderId !== ''): ?>
      <div class="total-box">
        <div class="total-row">
          <span>Общо за плащане:</span>
          <span class="total-amount">
            <?php
              if (($GLOBALS['SETTINGS']['currency_mode'] ?? '') === 'eur_only') {
                echo number_format((float)$displayTotalEUR, 2, ',', ' ') . ' €';
              } else {
                echo fmt_money($totalAmount);
              }
            ?>
          </span>
        </div>
      </div>
      <?php endif; ?>

      <!-- ============ ДОСТАВКА / ВЗИМАНЕ ============ -->
      <?php if ($ship === 'pickup'): ?>

      <h2><span class="icon">🏪</span> Взимане от място</h2>
      <div class="section-box pickup-box">
        <div class="section-header">
          <div class="section-title"><span class="icon">📍</span> Адрес за взимане</div>
        </div>

        <div class="address-highlight"><?php echo h($pickupAddress); ?></div>

        <div class="details-grid">
          <div class="detail-row">
            <span class="detail-label">Работно време:</span>
            <span class="detail-value"><?php echo h($pickupWorkHours); ?></span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Телефон за контакт:</span>
            <span class="detail-value"><a href="tel:<?php echo h($shopPhone); ?>"><?php echo h($shopPhone); ?></a></span>
          </div>
        </div>

        <div class="instructions">
          <strong>Важно:</strong> <?php echo h($pickupInstructions); ?>
        </div>

        <?php if ($orderId): ?>
        <div class="hint">
          При взимане моля предявете номера на поръчката: <strong><?php echo h($orderId); ?></strong>
        </div>
        <?php endif; ?>
      </div>

      <?php elseif ($ship === 'plovdiv_address'): ?>

      <h2>
        <span class="icon">🚚</span> Доставка до адрес
        <span class="badge badge-delivery">КУРИЕР</span>
      </h2>

      <div class="section-box delivery-box">
        <div class="section-header">
          <div class="section-title"><span class="icon">📦</span> Информация за доставка</div>
        </div>

        <div class="details-grid">
          <div class="detail-row">
            <span class="detail-label">Зона на доставка:</span>
            <span class="detail-value"><?php echo h($deliveryArea); ?></span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Време за доставки:</span>
            <span class="detail-value"><?php echo h($deliveryHours); ?></span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Контакт за въпроси:</span>
            <span class="detail-value">
              Ресторант: <a href="tel:<?php echo h($shopPhone); ?>"><?php echo h($shopPhone); ?></a>
            </span>
          </div>
        </div>

        <div class="instructions">
          <strong>Важно:</strong> <?php echo h($deliveryInstructions); ?>
        </div>

        <div class="hint">Куриерът ще се обади 5-10 минути преди доставка на посочения телефон.</div>
      </div>

      <?php else: ?>

      <h2><span class="icon">❓</span> Начин на получаване</h2>
      <div class="section-box">
        <p>Ще се свържем с вас по телефона за уточняване на начина на получаване.</p>
      </div>

      <?php endif; ?>

      <!-- Отстъпки -->
      <?php if ($promoCode || !empty($discountDetails) || $discountTotal > 0): ?>
      <div class="promo-box">
        <h3>🎁 Приложени отстъпки</h3>

        <?php if ($promoCode): ?>
        <div class="discount-item">
          <span class="discount-label">Промо код:</span>
          <span class="discount-value"><?php echo h($promoCode); ?></span>
        </div>
        <?php endif; ?>

        <?php if ($discountTotal > 0): ?>
        <div class="discount-item">
          <span class="discount-label">Обща отстъпка:</span>
          <span class="discount-value">
            -<?php
              // ✅ ако discount_info съдържа EUR, го оставяме визуално както е дошло (най-точно)
              $eurFromInfo = parse_first_eur_from_text($discountInfo);
              if (($GLOBALS['SETTINGS']['currency_mode'] ?? '') === 'eur_only') {
                if ($eurFromInfo > 0) {
                  echo number_format($eurFromInfo, 2, ',', ' ') . ' €';
                } else {
                  echo number_format(eur_from_bgn_display((float)$discountTotal), 2, ',', ' ') . ' €';
                }
              } else {
                echo fmt_money($discountTotal);
              }
            ?>
          </span>
        </div>
        <?php endif; ?>

        <?php if (!empty($discountDetails)): ?>
        <div class="discount-details">
          <strong>Детайли на отстъпките:</strong>
          <ul>
            <?php foreach ($discountDetails as $detail): ?>
              <li><?php echo h($detail); ?></li>
            <?php endforeach; ?>
          </ul>
        </div>
        <?php endif; ?>
      </div>
      <?php endif; ?>

      <!-- ============ ПЛАЩАНЕ ============ -->
      <h2>
        <span class="icon">💳</span>
        <?php echo h($payTitle); ?>
        <span class="badge <?php echo h($payBadgeClass); ?>">
          <?php echo h($payBadgeText); ?>
        </span>
      </h2>

      <div class="section-box payment-box">
        <?php if ($pay === 'bank'): ?>
          <?php if ($isPaid): ?>
            <p><strong style="color:#16a34a;">Плащането е потвърдено успешно.</strong> Поръчката ще бъде обработена.</p>
          <?php else: ?>
            <p><strong style="color:#dc2626;">Онлайн плащането не е потвърдено.</strong> Ако сте прекъснали процеса, можете да опитате отново.</p>
            <?php if ($orderId): ?>
              <div class="instructions">
                <strong>Важно:</strong> Запишете номера на поръчката: <strong><?php echo h($orderId); ?></strong>.
                Ако плащането е било прекъснато, свържете се с нас за съдействие.
              </div>
            <?php endif; ?>
          <?php endif; ?>

        <?php elseif ($pay === 'cash'): ?>
          <p>
            <?php if ($ship === 'pickup'): ?>
              Заплащането ще се извърши в брой при взимане на поръчката от адреса на Ресторанта.
            <?php elseif ($ship === 'plovdiv_address'): ?>
              Заплащането ще се извърши в брой при доставката на посочения от вас адрес.
            <?php else: ?>
              Заплащането ще се извърши в брой при получаване.
            <?php endif; ?>
          </p>

          <div class="instructions">
            <strong>Важно:</strong> Моля, пригответе точната сума в брой за по-бързо обслужване.
          </div>
        <?php else: ?>
          <p>Методът на плащане ще бъде уточнен допълнително.</p>
        <?php endif; ?>
      </div>

      <!-- Контакти -->
      <div class="contact-info">
        <div class="contact-item">
          <span class="icon">📞</span>
          <a href="tel:<?php echo h($shopPhone); ?>"><?php echo h($shopPhone); ?></a>
        </div>
        <div class="contact-item">
          <span class="icon">✉️</span>
          <a href="mailto:<?php echo h($shopEmail); ?>"><?php echo h($shopEmail); ?></a>
        </div>
        <?php if ($ship === 'pickup' && !empty($pickupWorkHours)): ?>
        <div class="contact-item">
          <span class="icon">⏰</span>
          <span><?php echo h($pickupWorkHours); ?></span>
        </div>
        <?php endif; ?>
      </div>

      <!-- Действия -->
      <div class="actions">
        <a class="btn btn-primary" href="https://delivery.sombrero.bg/">← Към Ресторанта</a>
        <button class="btn btn-ghost" onclick="window.print()">🖨️ Принтирай тази страница</button>
      </div>

      <div class="hint">
        Ако сте допуснали грешка в данните, моля свържете се с нас възможно най-скоро по телефон или имейл.
      </div>
    </div>
  </div>

  <!-- JS: чисти/връща количката + toast -->
  <script>
  (function () {
    const CART_KEY = 'bb_cart_from_csv_v3';
    const CART_BACKUP_KEY = 'bb_cart_from_csv_v3_backup';
    const FORM_DATA_KEY = 'checkout_form_data';
    const STORAGE_PROMO_KEY = 'checkout_applied_promo';

    const url = new URL(window.location.href);
    const pay = (url.searchParams.get('pay') || '').toLowerCase();
    const status = (url.searchParams.get('payment_status') || '').toLowerCase();
    const error = (url.searchParams.get('error') || '').toLowerCase();
    const hasError = !!error;

    let toastText = '';
    let toastOk = false;

    try {
      if (pay === 'cash') {
        localStorage.removeItem(CART_KEY);
        localStorage.removeItem(CART_BACKUP_KEY);
        localStorage.removeItem(FORM_DATA_KEY);
        localStorage.removeItem(STORAGE_PROMO_KEY);
        toastText = '✅ Количката е изчистена (плащане в брой)';
        toastOk = true;
      }
      else if (pay === 'bank' && status === 'success') {
        localStorage.removeItem(CART_KEY);
        localStorage.removeItem(CART_BACKUP_KEY);
        localStorage.removeItem(FORM_DATA_KEY);
        localStorage.removeItem(STORAGE_PROMO_KEY);
        toastText = '✅ Плащането е успешно — количката е изчистена';
        toastOk = true;
      }
      else if (pay === 'bank') {
        const shouldRestore = (status === 'fail' || status === 'cancel' || hasError);
        if (shouldRestore) {
          const backup = localStorage.getItem(CART_BACKUP_KEY);
          if (backup) {
            localStorage.setItem(CART_KEY, backup);
            toastText = (status === 'cancel')
              ? 'ℹ️ Количката е възстановена (плащането е отказано)'
              : 'ℹ️ Количката е възстановена (плащането не е потвърдено)';
          } else {
            toastText = 'ℹ️ Плащането не е потвърдено (няма backup за възстановяване)';
          }
          toastOk = false;
        } else {
          toastText = 'ℹ️ Количката е запазена (очаква плащане)';
          toastOk = false;
        }
      }
      else {
        toastText = 'ℹ️ Количката не е променена';
        toastOk = false;
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
      toastText = '⚠️ Грешка при обработка на количката';
      toastOk = false;
    }

    document.addEventListener('DOMContentLoaded', function () {
      const t = document.createElement('div');
      t.style.cssText =
        'position:fixed;bottom:20px;right:20px;max-width:320px;background:#0f172a;color:white;' +
        'padding:10px 16px;border-radius:10px;font-size:14px;z-index:1000;' +
        'box-shadow:0 8px 20px rgba(0,0,0,0.18);line-height:1.35;';
      t.textContent = toastText;

      if (toastOk) t.style.background = '#10b981';
      else if (status === 'fail' || status === 'cancel' || hasError) t.style.background = '#dc2626';
      else t.style.background = '#0ea5e9';

      document.body.appendChild(t);

      setTimeout(() => {
        t.style.opacity = '0';
        t.style.transition = 'opacity 0.5s ease';
        setTimeout(() => t.remove(), 500);
      }, 3200);
    });
  })();
  </script>
</body>
</html>
