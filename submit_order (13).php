<?php
// submit_order.php — Сомбреро
// POST от checkout.php -> запис в CSV -> (cash: email+Viber) -> redirect към thank-you или BORICA
declare(strict_types=1);

mb_internal_encoding('UTF-8');
date_default_timezone_set('Europe/Sofia');
session_start();

// Конфиг (UPLOAD_PIN + Viber)
$configPath = __DIR__ . '/config_upload.php';
if (is_file($configPath)) {
    require_once $configPath;
}

// Settings
require_once __DIR__ . '/settings.php';
$SETTINGS = load_settings();
$GLOBALS['SETTINGS'] = $SETTINGS; // 🟢 ТОЗИ РЕД Е НЕОБХОДИМ

// ===================== НАСТРОЙКИ =====================
$deliveryPrice = isset($SETTINGS['delivery_price_default']) && $SETTINGS['delivery_price_default'] !== ''
    ? (float)$SETTINGS['delivery_price_default']
    : 7.0;

$shopName   = $SETTINGS['shop_name']   ?? 'Магазин';
$shopEmail  = $SETTINGS['shop_email']  ?? '';
$orderInbox = !empty($SETTINGS['order_email']) ? $SETTINGS['order_email'] : $shopEmail;

// ===================== ПОМОЩНИ ФУНКЦИИ =====================
function h($s): string {
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function fmt_lv($n): string {
    $amount_bgn = (float)$n;
    
    // ✅ ПРАВИЛНО: Същата логика като в orders_admin.php и Python
    // 1. Закръгляне на левове
    $levAmount = round($amount_bgn, 2);
    $formatted_lv = number_format($levAmount, 2, ',', ' ') . ' лв.';
    
   // 2. ПРАВИЛНО конвертиране BGN -> EUR (1:1 навсякъде)
// round((BGN / exchange_rate), 3) -> round(2)
$rate = (float)($GLOBALS['SETTINGS']['exchange_rate'] ?? 1.95583);
if ($rate <= 0) $rate = 1.95583;

$euroAmount  = round($amount_bgn / $rate, 3); // 3 десетични знака
$euroRounded = round($euroAmount, 2);          // после 2
$formatted_euro = number_format($euroRounded, 2, ',', ' ') . ' €';


    // Проверка за показване само в евро
$mode = $GLOBALS['SETTINGS']['currency_mode'] ?? '';
if (($GLOBALS['SETTINGS']['show_euro_only'] ?? '') === '1' || $mode === 'eur_only') {
    return $formatted_euro;
}
if ($mode === 'bgn_only') {
    return $formatted_lv;
}

 
    
    return $formatted_lv . ' (' . $formatted_euro . ')';
}

function makeOrderId(): string {
    $ts = new DateTime('now', new DateTimeZone('Europe/Sofia'));
    $rand = random_int(100, 999);
    return 'SO-' . $ts->format('dmHis') . '-' . $rand;
}

// BORICA иска ORDER = 6 цифри
function makeOrder6(string $orderId): string {
    return substr(
        str_pad((string)(abs(crc32($orderId)) % 1000000), 6, '0', STR_PAD_LEFT),
        -6
    );
}

// ===== EUR (display) helper-и =====
function fx_rate(): float {
    $rate = (float)($GLOBALS['SETTINGS']['exchange_rate'] ?? 1.95583);
    if ($rate <= 0) $rate = 1.95583;
    return $rate;
}

function round2f($n): float {
    return round((float)$n, 2);
}

// като в JS: round((bgn/rate), 3) после round(2)
function eur_from_bgn_display(float $bgn): float {
    $rate = fx_rate();
    $e3 = round($bgn / $rate, 3);
    return round($e3, 2);
}


// ✅ EUR totals "като checkout/BORICA": unitEUR(2) * qty -> lineEUR(2) -> sum lines (2)
// + deliveryEUR(2) - discountEUR(2)
function calc_eur_total_like_checkout(array $items, float $discountBGN, float $shippingBGN): float {
    $subtotalEUR = 0.0;

    foreach ($items as $it) {
        $qty = (int)($it['qty'] ?? 0);
        if ($qty <= 0) continue;

        $unitFinalBGN = (float)($it['finalPrice'] ?? $it['price'] ?? 0);

        // 1) единична EUR (display rounding)
        $unitEUR = eur_from_bgn_display($unitFinalBGN);

        // 2) ред EUR = unitEUR * qty, закръглен до 2
        $lineEUR = round2f($unitEUR * $qty);

        // 3) сума от редовете (закръглена)
        $subtotalEUR = round2f($subtotalEUR + $lineEUR);
    }

    $discountEUR = eur_from_bgn_display($discountBGN);
    $deliveryEUR = eur_from_bgn_display($shippingBGN);

    $totalEUR = round2f($subtotalEUR - $discountEUR + $deliveryEUR);
    if ($totalEUR < 0) $totalEUR = 0.0;

    return $totalEUR;
}

function fmt_eur_amount(float $eur): string {
    $eur = round2f($eur);
    return number_format($eur, 2, ',', ' ') . ' €';
}

// ===================== SAME-DAY → courier dispatcher =====================
function sendSameDayCourierOrder($orderId, $address, $phone, $price, $rec_date, $rec_time) {
    // Ако няма адрес, не правим нищо
    if (trim((string)$address) === '') return;
    
    // 🔴 ПРОВЕРКА за валиден формат на датата (същия като в валидацията)
    if (!preg_match('/^\d{2}\.\d{2}\.\d{4}$/', $rec_date)) {
        error_log("SameDayCourier: Invalid date format: " . $rec_date);
        return;
    }

    global $SETTINGS;

    // Ако няма зададен API URL, не правим нищо
    $apiUrl = $SETTINGS['delivery_api_url'] ?? '';
    if (empty($apiUrl)) {
        error_log("SameDayCourier: Няма зададен API URL, пропускам...");
        return;
    }

    $restaurantId = isset($SETTINGS['delivery_restaurant_id']) && $SETTINGS['delivery_restaurant_id'] !== ''
        ? (int)$SETTINGS['delivery_restaurant_id']
        : 26;

    $restaurantZone = $SETTINGS['delivery_restaurant_zone'] ?? '1';
    $restaurantName = $SETTINGS['shop_name'] ?? 'Сомбреро';

    $when = trim((string)$rec_date . ' ' . (string)$rec_time);
    if ($when !== '') {
        $address .= ' | За: ' . $when;
    }

    $payload = [
        'restaurant_id'   => $restaurantId,
        'restaurant_zone' => $restaurantZone,
        'restaurant_name' => $restaurantName,
        'address'         => (string)$address,
        'phone'           => (string)$phone,
        'price'           => 7.00,
        'client_id'       => (string)$orderId,
        'submitted_at'    => time(),
    ];

    // Валидиране на URL - ако не изглежда валиден, пропускаме
    if (!filter_var($apiUrl, FILTER_VALIDATE_URL)) {
        error_log("SameDayCourier: Невалиден API URL: " . $apiUrl);
        return;
    }

    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT        => 5, // Намалено от 10 на 5 секунди
        CURLOPT_CONNECTTIMEOUT => 3, // Максимум 3 секунди за свързване
        CURLOPT_FAILONERROR    => false, // Не спира при HTTP error
    ]);
    
    $resp = curl_exec($ch);
    $errno = curl_errno($ch);
    $error = curl_error($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    // Логваме само ако има проблем, но не спираме обработката
    if ($errno || $code >= 400) {
        $logMessage = "SameDayCourier API call failed: ";
        if ($errno) {
            $logMessage .= "cURL error ($errno): $error";
        } else {
            $logMessage .= "HTTP $code";
            if ($resp) {
                $logMessage .= " - " . substr((string)$resp, 0, 200);
            }
        }
        error_log($logMessage);
        
        // Допълнителен лог само за 404 грешки
        if ($code === 404) {
            error_log("SameDayCourier 404: Грешен API URL или ресурс не съществува: " . $apiUrl);
        }
    } else {
        // Успешно изпращане - опционален лог
        error_log("SameDayCourier: Поръчката е изпратена успешно (HTTP $code)");
    }
}

// ===================== ПРОМО КОДОВЕ =====================
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

    $found = false;
    $consumed = false;

    foreach ($list as &$row) {
        if (!isset($row['code'])) continue;
        if (strcasecmp((string)$row['code'], $code) !== 0) continue;

        $codeType   = $row['code_type'] ?? 'single';
        $usageCount = (int)($row['usage_count'] ?? 0);
        $maxUsage   = (int)($row['max_usage'] ?? ($codeType === 'multi' ? 0 : 1));

        // Проверка дали кодът е изчерпан
        if ($codeType === 'single' && $usageCount >= 1) { 
            $found = true; 
            break; 
        }
        if ($codeType === 'multi' && $maxUsage > 0 && $usageCount >= $maxUsage) { 
            $found = true; 
            break; 
        }
        if (!empty($row['used'])) { 
            $found = true; 
            break; 
        }

        // Увеличаваме брояча
        $row['usage_count'] = $usageCount + 1;
        $consumed = true;

        // Маркираме като използван ако е нужно
        if ($codeType === 'single' && $row['usage_count'] >= 1) {
            $row['used'] = true;
        } elseif ($codeType === 'multi' && $maxUsage > 0 && $row['usage_count'] >= $maxUsage) {
            $row['used'] = true;
        }

        // ✅ ДОБАВЯМЕ last_used ВИНАГИ (дори ако няма такова поле)
        $row['last_used'] = date('Y-m-d H:i:s');
        $found = true;
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

// ===================== VIBER NOTIFY =====================
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
    $order_note = ''          // ✅ НОВО
) {

    if (!defined('VIBER_ENABLED') || !VIBER_ENABLED) return;
    if (!defined('VIBER_BOT_TOKEN')) return;

    $h = (int)date('G');
    if ($h < 8 || $h >= 22) return;

    $receivers = [];
    if (defined('VIBER_ADMIN_IDS') && is_array(VIBER_ADMIN_IDS)) {
        $receivers = VIBER_ADMIN_IDS;
    } elseif (defined('VIBER_ADMIN_ID')) {
        $receivers = [VIBER_ADMIN_ID];
    }

    global $SETTINGS;
    $pickupAddress = $SETTINGS['address_full'] ?? '';

    // ===================== DELIVERY / PICKUP =====================
    $delivery = '';
    $whenLine = '';

    // ✅ НАЙ-ОТГОРЕ: тип (pickup/delivery)
    $typeLine = ($ship_method === 'pickup')
        ? "📍 ВЗИМАНЕ ОТ МЯСТО\n"
        : "🚚 ДОСТАВКА ДО АДРЕС\n";

    if ($ship_method === 'plovdiv_address') {
        // ⏰ дата + час (най-отгоре под типа)
        $when = trim($rec_date . ' ' . $rec_time);
        if ($when !== '') {
            $whenLine = "⏰ {$when}\n";
        }

        // 🚚 адрес
        $delivery = 'Доставка: ' . $rec_address;
    } else {
        // 📍 pickup
        $delivery = 'Взимане от място (' . $pickupAddress . ')';
    }

    // ===================== PAYMENT =====================
    $paymentHuman = ($pay_method === 'cash')
        ? 'Плащане в брой при получаване'
        : 'Плащане онлайн с карта';

    // ===================== DISCOUNT =====================
    $discountText = '';
    // ===================== ORDER NOTE (обща бележка) =====================
$orderNoteText = '';
$order_note = trim((string)$order_note);
if ($order_note !== '') {
    $orderNoteText = "\n📝 Бележка към поръчката: " . $order_note;
}

    if ($discount_details !== '') {
        $discountText = "\nОтстъпки: " . $discount_details;
    }

    // ===================== ITEMS =====================
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

    // ===================== FINAL TEXT =====================
    $text =
        $typeLine .                         // ✅ най-отгоре винаги
        $whenLine .                         // ✅ само при доставка
        "{$delivery}{$discountText}\n" .    // ✅ без фиксирано 🚚
        "Нова поръчка {$orderId}\n" .
        "Клиент: {$custName}\n" .
        "Тел: {$custPhone}\n" .
        "Плащане: {$paymentHuman}\n" .
"Сума: " . ($GLOBALS['MSG_TOTAL_TEXT'] ?? fmt_lv($total_gross)) . "\n" .

$orderNoteText . "\n\n" .

$itemsText;


    // ===================== SEND =====================
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

} // ✅ ТАЗИ СКОБА ЛИПСВАШЕ (затваря функцията sendViberOrderNotification)



// ===================== ЧЕТЕНЕ НА POST =====================
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    exit("Методът не е позволен.");
}

// ✅ CSRF проверка
$postToken = (string)($_POST['csrf_token'] ?? '');
$sessToken = (string)($_SESSION['csrf_token'] ?? '');
if ($sessToken === '' || $postToken === '' || !hash_equals($sessToken, $postToken)) {
    http_response_code(403);
    exit("Невалиден CSRF токен.");
}


// ===================== CUT-OFF (СЪРВЪРНА ЗАЩИТА) =====================
// Поръчки се приемат до 22:00 (по време Europe/Sofia)
$now = new DateTime('now', new DateTimeZone('Europe/Sofia'));
$cutoff = DateTime::createFromFormat('Y-m-d H:i', $now->format('Y-m-d') . ' 22:00', new DateTimeZone('Europe/Sofia'));

if ($cutoff && $now >= $cutoff) {
    // 1) Ако искаш да върнеш човешко съобщение в checkout:
    $_SESSION['form_error'] = 'Поръчки се приемат до 22:00 ч. Моля, опитайте отново утре.';
    header('Location: /checkout.php');
    exit;

    // 2) (Алтернатива) ако предпочиташ чисто API-стил:
    // http_response_code(403);
    // exit('Поръчки се приемат до 22:00 ч.');
}


$cart_payload_raw = (string)($_POST['cart_payload'] ?? '');


// 🔴🔴🔴 ЦЕНОВА ПРОВЕРКА - ЗАЩИТА СРЕЩУ СМЯНА НА ЦЕНИ 🔴🔴🔴
// ===================== ПРОВЕРКА НА ЦЕНИТЕ - НАЙ-ВАЖНОТО =====================
$products_csv = __DIR__ . '/products.csv';
$server_prices = [];

if (($handle = fopen($products_csv, 'r')) !== false) {
    $header = fgetcsv($handle);
    while (($row = fgetcsv($handle)) !== false) {
        if (empty($row[1])) continue;
        $code = trim($row[1]);
        
        // нормална цена (колона 6 - индекс 5)
        $price = 0;
        if (!empty($row[5])) {
            $price = floatval(str_replace(',', '.', trim($row[5])));
        }
        
        // промо цена (колона 7 - индекс 6) - ако има
        $promo_price = 0;
        if (!empty($row[6])) {
            $promo_price = floatval(str_replace(',', '.', trim($row[6])));
        }
        
        $server_prices[$code] = [
            'price' => $price,
            'promo_price' => $promo_price
        ];
    }
    fclose($handle);
}

// Подобрена функция за проверка
function validate_cart_prices($cart_json, $server_prices) {
    $errors = [];
    $cart = json_decode($cart_json, true);
    
    if (!$cart || !is_array($cart)) {
        return ["Грешка при декодиране на количката"];
    }
    
    foreach ($cart as $item) {
        $product = $item['product'] ?? [];
        $code = $product['code'] ?? '';
        $qty = (int)($item['qty'] ?? 0);
        $note = trim((string)($item['note'] ?? ''));
        
        if (empty($code)) {
            $errors[] = "Продукт без код в количката";
            continue;
        }
        
        // Проверка за количество
        if ($qty <= 0 || $qty > 100) {
            $errors[] = "Продукт {$code}: невалидно количество ({$qty})";
            continue;
        }
        
        // Проверка дали продукта съществува
        if (!isset($server_prices[$code])) {
            $errors[] = "Продукт {$code} не съществува";
            continue;
        }
        
        $server_item = $server_prices[$code];
        $client_price = (float)($product['finalPrice'] ?? $product['price'] ?? 0);
        
        // Проверка на цената
        $server_price = $server_item['price'];
        $server_promo = $server_item['promo_price'];
        
        $is_valid_price = false;
        $tolerance = 0.01;
        
        // 1. Проверка с нормална цена
        if (abs($client_price - $server_price) <= $tolerance) {
            $is_valid_price = true;
        }
        
        // 2. Проверка с промо цена (ако има)
        if ($server_promo > 0 && abs($client_price - $server_promo) <= $tolerance) {
            $is_valid_price = true;
        }
        
        if (!$is_valid_price) {
            $expected = ($server_promo > 0) ? 
                "{$server_price} или промо {$server_promo}" : 
                "{$server_price}";
            $errors[] = "Продукт {$code}: невалидна цена ({$client_price} вместо {$expected})";
        }
        
        // Допълнителна проверка за бележки (по желание)
        if (strlen($note) > 500) {
            $errors[] = "Продукт {$code}: бележката е твърде дълга";
        }
    }
    
    return $errors;
}

// Извърши проверката
$cart_payload_raw = (string)($_POST['cart_payload'] ?? '');
$price_errors = validate_cart_prices($cart_payload_raw, $server_prices);


if (!empty($price_errors)) {
    http_response_code(400);
    $error_msg = implode("; ", $price_errors);
    exit("🚨 Грешка: " . $error_msg . ". Моля, рестартирайте поръчката.");
}
// ===================== КРАЙ НА ЦЕНОВАТА ПРОВЕРКА =====================

// ===================== АНТИ-ДУБЛИРАЩА ЗАЩИТА =====================
$phoneForHash = (string)($_POST['cust_phone'] ?? '');
if ($phoneForHash === '') $phoneForHash = (string)($_POST['rec_phone'] ?? '');

$requestHash = md5(
    (string)($_POST['cart_payload'] ?? '') .
    (string)($_POST['total_gross'] ?? '') .
    $phoneForHash .
    (string)($_POST['ship_method'] ?? '') .
    (string)($_POST['pay_method'] ?? '')
);

if (isset($_SESSION['last_order_hash']) && $_SESSION['last_order_hash'] === $requestHash) {
    if (!empty($_SESSION['last_order_id'])) {
        header("Location: /thank-you.php?order_id=" . urlencode((string)$_SESSION['last_order_id']));
        exit;
    }
}
$_SESSION['last_order_hash'] = $requestHash;

// DEBUG
$debug_log = __DIR__ . '/submit_order_debug.log';
file_put_contents($debug_log, date('Y-m-d H:i:s') . " ======= START =======\n", FILE_APPEND);
file_put_contents($debug_log, "POST data:\n" . print_r($_POST, true) . "\n", FILE_APPEND);

// ===================== REQUIRED =====================
$ship_method = trim((string)($_POST['ship_method'] ?? ''));
$pay_method  = trim((string)($_POST['pay_method'] ?? ''));

$requiredCommon = [
  'cart_payload', 'total_gross', 'ship_method', 'pay_method',
  'cust_email'
];

$requiredPickup  = ['cust_first_name','cust_last_name','cust_phone'];
$requiredDelivery = ['rec_name','rec_phone','rec_address','rec_date','rec_time'];


$required = $requiredCommon;

if ($ship_method === 'pickup') {
  $required = array_merge($required, $requiredPickup);
} elseif ($ship_method === 'plovdiv_address') {
  $required = array_merge($required, $requiredDelivery);
} else {
  $_SESSION['form_error'] = 'Моля, изберете начин на получаване (Вземане или Доставка).';
  header('Location: /checkout.php');
  exit;
}



foreach ($required as $r) {
  if (!isset($_POST[$r]) || trim((string)$_POST[$r]) === '') {

    // ✅ човешко съобщение според полето
    $map = [
      'ship_method'      => 'Моля, изберете начин на получаване (вземане или доставка).',
      'cust_first_name'  => 'Моля, попълнете име.',
      'cust_last_name'   => 'Моля, попълнете фамилия.',
      'cust_phone'       => 'Моля, попълнете телефон.',
      'cust_email'       => 'Моля, попълнете email.',
      'rec_name'         => 'Моля, попълнете име на получател.',
      'rec_phone'        => 'Моля, попълнете телефон на получател.',
      'rec_address'      => 'Моля, попълнете адрес за доставка.',
      'rec_date'         => 'Моля, изберете дата за доставка.',
      'rec_time'         => 'Моля, изберете час за доставка.',
      'cart_payload'     => 'Количката е празна.',
      'total_gross'      => 'Грешка със сумата. Моля, опитайте отново.'
    ];

    $_SESSION['form_error'] = $map[$r] ?? ('Липсва поле: ' . $r);

    // ✅ връщаме към checkout (сложи правилния файл, ако не е checkout.php)
    header('Location: /checkout.php');
    exit;
  }
}


// ===================== INPUT =====================
$cust_first_name = trim((string)($_POST['cust_first_name'] ?? ''));
$cust_last_name  = trim((string)($_POST['cust_last_name'] ?? ''));
$cust_phone      = trim((string)($_POST['cust_phone'] ?? ''));
$cust_email      = trim((string)($_POST['cust_email'] ?? ''));
$order_note      = trim((string)($_POST['order_note'] ?? ''));

$rec_name        = trim((string)($_POST['rec_name'] ?? ''));
$rec_phone       = trim((string)($_POST['rec_phone'] ?? ''));
$rec_address     = trim((string)($_POST['rec_address'] ?? ''));
$rec_date        = trim((string)($_POST['rec_date'] ?? ''));
$rec_time        = trim((string)($_POST['rec_time'] ?? ''));

// ✅ Ако е доставка – ползваме данните на получателя като "клиентски" (за CSV/телефон/вайбър)
if ($ship_method === 'plovdiv_address') {
    if ($cust_phone === '' && $rec_phone !== '') {
        $cust_phone = $rec_phone;
    }

    if (($cust_first_name === '' || $cust_last_name === '') && $rec_name !== '') {
        $parts = preg_split('/\s+/', trim($rec_name));
        $cust_first_name = $cust_first_name !== '' ? $cust_first_name : ($parts[0] ?? '');
        $cust_last_name  = $cust_last_name  !== '' ? $cust_last_name  : (count($parts) > 1 ? implode(' ', array_slice($parts, 1)) : '');
    }
}

// ===================== INPUT VALIDATION =====================
$allowedShip = ['pickup','plovdiv_address'];
if (!in_array($ship_method, $allowedShip, true)) {
    http_response_code(400);
    exit("Невалиден ship_method.");
}

$allowedPay = ['cash','bank'];
if (!in_array($pay_method, $allowedPay, true)) {
    http_response_code(400);
    exit("Невалиден pay_method.");
}

if ($cust_email === '' || !filter_var($cust_email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    exit("Невалиден email.");
}

if ($cust_phone === '' || !preg_match('/^[\d\s()+-]{10,20}$/', $cust_phone)) {
    http_response_code(400);
    exit("Невалиден телефон.");
}

if ($ship_method === 'plovdiv_address') {
    if ($rec_phone === '' || !preg_match('/^[\d\s()+-]{10,20}$/', $rec_phone)) {
        http_response_code(400);
        exit("Невалиден телефон.");
    }
    
    if ($rec_date === '' || !preg_match('/^\d{2}\.\d{2}\.\d{4}$/', $rec_date)) {
        http_response_code(400);
        exit("Невалидна дата.");
    }
    
    if ($rec_time === '' || !preg_match('/^\d{2}:\d{2}$/', $rec_time)) {
        http_response_code(400);
        exit("Невалиден час.");
    }
}

$total_gross_posted = (float)str_replace(',', '.', (string)$_POST['total_gross']);


$promo_code       = trim((string)($_POST['promo_code'] ?? ''));
$discount_total   = (float)str_replace(',', '.', (string)($_POST['discount_total'] ?? 0));
$discount_details = trim((string)($_POST['discount_details'] ?? ''));

// 🔴 ЗАБРАНА за промокод "10" при доставка (същата като в checkout.php)
if ($promo_code === '10' && $ship_method === 'plovdiv_address') {
    http_response_code(400);
    exit("Промокод '10' е валиден само за взимане от място!");
}

if ($promo_code !== '' && $discount_total > 0) {
    // САМО при плащане в брой консумираме веднага
    if ($pay_method === 'cash') {
        update_promocode_usage($promo_code);
        error_log("Promo {$promo_code} consumed for CASH order (id not yet created)");

    } else {
        // При плащане с карта - НИЩО, ще се консумира в callback
        error_log("Promo {$promo_code} NOT consumed (BANK payment)");
    }
}

file_put_contents($debug_log, "Discount total: {$discount_total}\n", FILE_APPEND);
file_put_contents($debug_log, "Discount details: {$discount_details}\n", FILE_APPEND);
file_put_contents($debug_log, "Total gross posted: {$total_gross_posted}\n", FILE_APPEND);
file_put_contents($debug_log, "Promo code: {$promo_code}\n", FILE_APPEND);

// auto-fill за pickup
if ($ship_method === 'pickup') {
    if ($rec_name === '') $rec_name = trim($cust_first_name . ' ' . $cust_last_name);
    if ($rec_phone === '') $rec_phone = $cust_phone;
    if ($rec_address === '') $rec_address = $SETTINGS['address_full'] ?? '';
} else {
    if ($rec_name === '') $rec_name = trim($cust_first_name . ' ' . $cust_last_name);
}

// ===================== PARSE ITEMS =====================
$items = [];
$totalProductsOriginal = 0.0;

try {
    $parsed = json_decode($cart_payload_raw, true, 512, JSON_THROW_ON_ERROR);

    if (is_array($parsed)) {
        foreach ($parsed as $row) {
            $p = $row['product'] ?? [];
            $qty = (int)($row['qty'] ?? 0);
            $note = trim((string)($row['note'] ?? ''));

            $code = trim((string)($p['code'] ?? ($p['id'] ?? '')));
            $name = trim((string)($p['name'] ?? ''));

            $originalPrice = (float)($p['originalPrice'] ?? ($p['price'] ?? 0));
            $finalPrice    = (float)($p['finalPrice'] ?? ($p['price'] ?? 0));

            if ($qty > 0 && $name !== '') {
                $lineOriginal = $originalPrice * $qty;
                $lineFinal    = $finalPrice * $qty;

                $totalProductsOriginal += $lineOriginal;

                $items[] = [
                    'code'       => $code,
                    'name'       => $name,
                    'note'       => $note,
                    'qty'        => $qty,
                    'price'      => $originalPrice,
                    'finalPrice' => $finalPrice,
                    'line'       => $lineFinal,
                ];
            }
        }
    }
} catch (Throwable $e) {
    error_log("JSON parse error: " . $e->getMessage());
    file_put_contents($debug_log, "JSON parse error: " . $e->getMessage() . "\n", FILE_APPEND);
}

if (!$items) {
    http_response_code(400);
    exit("Количката е празна.");
}

// ===================== SERVER PRODUCTS TOTAL =====================
$serverProductsTotal = 0.0;
foreach ($items as $it) $serverProductsTotal += (float)$it['line'];

// discount clamp
$discount_total = max(0.0, (float)$discount_total);
if ($discount_total > $serverProductsTotal) $discount_total = $serverProductsTotal;

// ===================== CALC TOTALS =====================
$orderId = makeOrderId();
$_SESSION['last_order_id'] = $orderId;

// ✅ order6 още тук
$order6 = ($pay_method === 'bank') ? makeOrder6($orderId) : '';

$productsAfterIndividualPromo = max(0.0, $serverProductsTotal);
$productsAfterDiscount = max(0.0, $productsAfterIndividualPromo - $discount_total);

// 🔒 Минимална сума за доставка (сървърна защита)
$minDeliveryAmount = (float)($SETTINGS['min_order_amount_delivery'] ?? 35.00);
if ($ship_method === 'plovdiv_address' && $productsAfterDiscount < $minDeliveryAmount) {
    http_response_code(400);
    exit("Минималната сума за доставка е " . fmt_lv($minDeliveryAmount) . ".");
}

$shipping_fee = 0.0;

if ($ship_method === 'plovdiv_address') {
    $shipping_fee = (float)$deliveryPrice;

    if (($SETTINGS['promo_free_delivery_enabled'] ?? '0') === '1') {
        $freeDeliveryMin = (float)($SETTINGS['promo_free_delivery_min_total'] ?? 0);

        if ($freeDeliveryMin > 0 && $productsAfterDiscount >= $freeDeliveryMin) {
            $shipping_fee = 0.0;
            $order_note = ($order_note ? $order_note . " | " : "") . "Безплатна доставка по промоция";
        }
    }
}


$grandTotal = $productsAfterDiscount + $shipping_fee;
// ✅ EUR сума за Email/Viber 1:1 като checkout/BORICA
$EUR_TOTAL_FOR_MESSAGES = calc_eur_total_like_checkout($items, (float)$discount_total, (float)$shipping_fee);
$MSG_TOTAL_TEXT = fmt_eur_amount($EUR_TOTAL_FOR_MESSAGES);

// ✅ достъпно и вътре във Viber функцията
$GLOBALS['MSG_TOTAL_TEXT'] = $MSG_TOTAL_TEXT;
$EUR_SUBTOTAL_FOR_MESSAGES = 0.0;
foreach ($items as $it) {
    $q = (int)($it['qty'] ?? 0);
    if ($q <= 0) continue;
    $u = eur_from_bgn_display((float)($it['finalPrice'] ?? $it['price'] ?? 0));
    $EUR_SUBTOTAL_FOR_MESSAGES = round2f($EUR_SUBTOTAL_FOR_MESSAGES + round2f($u * $q));
}
$MSG_SUBTOTAL_TEXT = fmt_eur_amount($EUR_SUBTOTAL_FOR_MESSAGES);

if (abs($total_gross_posted - $grandTotal) > 0.01) {
    http_response_code(400);
    exit("🚨 Манипулация на сумата. Моля, рестартирайте поръчката.");
}


// ===================== PAYMENT FLAGS =====================
$payment_method_human = ($pay_method === 'bank') ? 'card_online' : 'cash_on_delivery';
$payment_status = ($pay_method === 'bank') ? 'PENDING' : 'DUE_ON_DELIVERY';
$nap_doc_type = ($pay_method === 'bank') ? 'КАРТА (онлайн) — Борика' : 'НП — Наложен платеж';

// ===================== SAVE CSV =====================
$ordersCsv  = __DIR__ . '/orders.csv';
$needHeader = !file_exists($ordersCsv);

$createdAt    = date('Y-m-d H:i:s');
$custFullName = trim($cust_first_name . ' ' . $cust_last_name);

$deliveryText = ($ship_method === 'pickup') ? 'Взимане от място' : 'Доставка до адрес';
$paymentText  = ($pay_method === 'cash') ? 'Наложен платеж' : 'Плащане онлайн с карта';

$fh = fopen($ordersCsv, 'a');
if ($fh) {
    flock($fh, LOCK_EX);

    if ($needHeader) {
        fputcsv($fh, [
            'id', 'created_at', 'cust_name', 'cust_phone', 'cust_email',
            'ship_method', 'delivery_text', 'rec_name', 'rec_phone', 'rec_address',
            'rec_date', 'rec_time',
            'pay_method', 'payment_text',
            'payment_method_human',
            'payment_status',
            'nap_doc_type',
            'total_products', 'shipping_fee', 'grand_total', 'order_note',
            'promo_code', 'discount_info', 'discount_total',
            'products_original', 'products_after_individual_promo',
            'borica_order6',
            'notify_sent', 'notify_sent_at',
            'cart_payload_json', 'shop_name'
        ]);
    }

    fputcsv($fh, [
        $orderId,
        $createdAt,
        $custFullName,
        $cust_phone,
        $cust_email,
        $ship_method,
        $deliveryText,
        $rec_name,
        $rec_phone,
        $rec_address,
        $rec_date,
        $rec_time,
        $pay_method,
        $paymentText,
        $payment_method_human,
        $payment_status,
        $nap_doc_type,
        number_format($productsAfterDiscount, 2, '.', ''),
        number_format($shipping_fee, 2, '.', ''),
        number_format($grandTotal, 2, '.', ''),
        $order_note,
        $promo_code,
        $discount_details,
        number_format($discount_total, 2, '.', ''),
        number_format($totalProductsOriginal, 2, '.', ''),
        number_format($productsAfterIndividualPromo, 2, '.', ''),
        $order6,
        '', '', // notify_sent, notify_sent_at
        $cart_payload_raw,
        $shopName
    ]);

    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
}



// ===================== SAME-DAY DISPATCHER =====================
if ($ship_method === 'plovdiv_address' && $rec_date !== '') {
    try {
        $tz = new DateTimeZone('Europe/Sofia');
        $today = new DateTime('today', $tz);
        $delDate = DateTime::createFromFormat('d.m.Y', $rec_date, $tz);

        if ($delDate && $delDate->format('Y-m-d') === $today->format('Y-m-d')) {
            // Изпращане към SameDayCourier с try-catch за да не спира целия процес
            sendSameDayCourierOrder($orderId, $rec_address, $rec_phone ?: $cust_phone, $deliveryPrice, $rec_date, $rec_time);
        }
    } catch (Throwable $e) {
        // Логваме грешката, но продължаваме с обработката на поръчката
        error_log("SameDayCourier dispatch exception (продължавам): " . $e->getMessage());
        // НЕ спираме процеса - поръчката трябва да се запише в CSV и да се изпрати имейл
    }
}
// ===================== EMAIL + VIBER (✅ само при CASH) =====================
if ($pay_method !== 'bank') {

    $subjectText = "Поръчка {$orderId} — {$shopName}";
    $subject = '=?UTF-8?B?' . base64_encode($subjectText) . '?=';

    // ⏰ ДАТА + ЧАС НАЙ-ОТГОРЕ В ИМЕЙЛА (само при доставка)
    $whenEmailHtml = '';
    if ($ship_method === 'plovdiv_address') {
        $when = trim($rec_date . ' ' . $rec_time);
        if ($when !== '') {
            $whenEmailHtml = '
            <div style="
                background:#fef3c7;
                border-left:4px solid #f59e0b;
                padding:12px 15px;
                margin-bottom:20px;
                font-size:15px;
                font-weight:bold;
            ">
                ⏰ Доставка за: ' . h($when) . '
            </div>';
        }
    }

    if ($ship_method === 'pickup') {
        $pickupAddress = $SETTINGS['address_full'] ?? '';
        $deliveryBlockHtml = '<p><strong>Получаване:</strong> Взимане от място — ' . h($pickupAddress) . '</p>';
    } else {
        $deliveryBlockHtml =
            '<p><strong>Доставка до адрес:</strong><br>' .
            'Получател: ' . h($rec_name) . '<br>' .
            'Телефон: ' . h($rec_phone) . '<br>' .
            'Адрес: ' . h($rec_address) . '<br>' .
            'Дата: ' . h($rec_date) . '<br>' .
            'Час: ' . h($rec_time) . '</p>';
    }

    $paymentHuman = ($pay_method === 'cash') ? "Плащане в брой при получаване" : "Плащане онлайн с карта";

    $paymentExtraHtml = '';
    $discountBlockHtml = '';

    if ($discount_total > 0 || $discount_details !== '' || $promo_code !== '') {
        $discountBlockHtml .= '<h3 style="margin:22px 0 10px 0;">Приложени отстъпки</h3>';
        if ($discount_details !== '') {
            $discountDetailsArray = explode(' | ', $discount_details);
            $discountBlockHtml .= '<ul style="color:#dc2626; margin:0 0 10px 18px;">';
            foreach ($discountDetailsArray as $detail) $discountBlockHtml .= '<li>' . h($detail) . '</li>';
            $discountBlockHtml .= '</ul>';
        }
        if ($promo_code !== '') {
            $discountBlockHtml .= '<p style="margin:0;"><strong>Промо код:</strong> ' . h($promo_code) . '</p>';
        }
    }

    $itemsHtml = '';
foreach ($items as $it) {

    // ✅ добави това:
    $qtyEmail = (int)($it['qty'] ?? 0);
    $unitFinalBgnEmail = (float)($it['finalPrice'] ?? $it['price'] ?? 0);

    $unitFinalEurEmail = eur_from_bgn_display($unitFinalBgnEmail);
    $lineFinalEurEmail = round2f($unitFinalEurEmail * $qtyEmail);

    // после си продължаваш както беше:
    $hasPromo = ((float)$it['finalPrice'] < (float)$it['price']);
    $hasNote  = trim((string)($it['note'] ?? '')) !== '';


        $itemsHtml .= '
        <div style="padding:15px; border-bottom:1px solid #e5e7eb; background:#ffffff;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                <div style="flex:1;">
                    <div style="font-weight:bold; font-size:15px; color:#0f172a;">' . h($it['name']) . '</div>
                    <div style="color:#64748b; font-size:13px; margin-top:3px;">Код: ' . h($it['code']) . ' | Количество: ' . (int)$it['qty'] . '</div>
                </div>
                <div style="text-align:right; min-width:90px;">
                    <div style="font-weight:bold; font-size:15px; color:#0f172a;">' . fmt_eur_amount($lineFinalEurEmail) . '</div>';

        if ($hasPromo) {
            $itemsHtml .= '
                    <div style="color:#64748b; font-size:13px; margin-top:2px;">
                        <span style="text-decoration:line-through;">' . fmt_eur_amount(round2f(eur_from_bgn_display((float)$it['price']) * (int)$it['qty'])) . '</span>

                    </div>
                    <div style="color:#dc2626; font-size:13px; font-weight:bold;">
                        ' . (int)$it['qty'] . ' × ' . fmt_eur_amount($unitFinalEurEmail) . '

                    </div>';
        } else {
    $itemsHtml .= '
            <div style="color:#64748b; font-size:13px; margin-top:2px;">
                ' . (int)$it['qty'] . ' × ' . fmt_eur_amount($unitFinalEurEmail) . '
            </div>';
}


        $itemsHtml .= '
                </div>
            </div>';

        if ($hasNote) {
            $itemsHtml .= '
            <div style="margin-top:10px; padding:10px; background:#f8fafc; border-left:3px solid #3b82f6; border-radius:4px;">
                <div style="font-size:13px; color:#475569; font-style:italic; line-height:1.4;">' . nl2br(h($it['note'])) . '</div>
            </div>';
        }

        $itemsHtml .= '
        </div>';
    }

    $html = '<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' . h($subjectText) . '</title></head>
    <body style="margin:0; padding:0; font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif; line-height:1.5; color:#0f172a; background:#f9fafb;">
    <div style="max-width:600px; margin:0 auto; background:white;">
      <div style="background:linear-gradient(135deg,#3b82f6,#06b6d4,#ec4899); color:white; padding:25px 20px;">
        <h1 style="margin:0 0 10px 0; font-size:24px;">' . h($shopName) . '</h1>
        <h2 style="margin:0 0 15px 0; font-size:18px;">Потвърждение на поръчка</h2>
        <p style="margin:5px 0; font-size:14px;">Номер: <strong>' . h($orderId) . '</strong></p>
        <p style="margin:5px 0; font-size:14px;">Дата: ' . h($createdAt) . '</p>
      </div>

      <div style="padding:20px;">
        ' . $whenEmailHtml . '

        <h3 style="margin:30px 0 15px 0; font-size:16px; padding-bottom:8px; border-bottom:2px solid #e5e7eb;">Данни за клиента</h3>
        <div style="background:#f8fafc; padding:15px; border-radius:8px; margin-bottom:25px;">
          <p style="margin:8px 0;"><strong>Име:</strong> ' . h($custFullName) . '</p>
          <p style="margin:8px 0;"><strong>Телефон:</strong> ' . h($cust_phone) . '</p>
          <p style="margin:8px 0;"><strong>Имейл:</strong> ' . h($cust_email) . '</p>
          ' . ($order_note !== '' ? '<p style="margin:8px 0;"><strong>Бележка:</strong> ' . nl2br(h($order_note)) . '</p>' : '') . '
        </div>

        <h3 style="margin:30px 0 15px 0; font-size:16px; padding-bottom:8px; border-bottom:2px solid #e5e7eb;">Доставка и плащане</h3>
        <div style="background:#f8fafc; padding:15px; border-radius:8px; margin-bottom:25px;">
          ' . $deliveryBlockHtml . '
          <p style="margin:8px 0;"><strong>Плащане:</strong> ' . h($paymentHuman) . '</p>
        </div>

        ' . $paymentExtraHtml . '
        ' . $discountBlockHtml . '

        <h3 style="margin:30px 0 15px 0; font-size:16px; padding-bottom:8px; border-bottom:2px solid #e5e7eb;">Артикули</h3>
        <div style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">' . $itemsHtml . '</div>

        <h3 style="margin:30px 0 15px 0; font-size:16px; padding-bottom:8px; border-bottom:2px solid #e5e7eb;">Сума</h3>
        <div style="background:#f8fafc; padding:20px; border-radius:8px;">
          <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #e5e7eb;">
    <span>Продукти:</span><span style="font-weight:bold;">' . $MSG_SUBTOTAL_TEXT . '</span>

</div>' .
($discount_total > 0 ? '
<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #e5e7eb;">
    <span style="color:#dc2626;">Отстъпка:</span><span style="font-weight:bold; color:#dc2626;">-' . fmt_eur_amount(eur_from_bgn_display((float)$discount_total)) . '</span>
</div>' : '') .
'<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #e5e7eb;">
    <span>Доставка:</span><span style="font-weight:bold;">' . ($ship_method === 'plovdiv_address'
    ? fmt_eur_amount(eur_from_bgn_display((float)$shipping_fee))
    : fmt_eur_amount(0)
) . '</span>

</div>
<div style="display:flex; justify-content:space-between; padding:15px 0; border-top:2px solid #0f172a; margin-top:10px;">
    <span style="font-size:17px; font-weight:bold;">Общо:</span><span style="font-size:17px; font-weight:bold;">' . $MSG_TOTAL_TEXT . '</span>

</div>
        </div>
      </div>

      <div style="background:#f1f5f9; padding:20px; text-align:center; border-top:1px solid #e5e7eb;">
        <p style="margin:0; font-size:13px; color:#64748b;">' . h($shopName) . ' &copy; ' . date('Y') . '</p>
      </div>
    </div></body></html>';

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
    $custFull = trim($cust_first_name . ' ' . $cust_last_name);
sendViberOrderNotification(
    $orderId,
    $grandTotal,
    $custFull,
    $cust_phone,
    $ship_method,
    $pay_method,
    $rec_address,
    $rec_date,
    $rec_time,
    $items,
    $discount_details,
    $order_note // ✅ НОВО
);
}


// ===================== FINAL REDIRECT =====================
$query = http_build_query([
    'order_id'       => $orderId,
    'ship'           => $ship_method,
    'pay'            => $pay_method,
    'promo'          => $promo_code,
    'discount_info'  => $discount_details,
    'discount_total' => $discount_total,
    'total'          => $grandTotal
]);

if ($pay_method === 'bank') {
    $cfg = require __DIR__ . '/borica_config.php';

    $currency = strtoupper(trim((string)($cfg['DEFAULT_CURRENCY'] ?? 'BGN')));
    if ($currency !== 'BGN' && $currency !== 'EUR') $currency = 'BGN';

$amountBGN = round((float)$grandTotal, 2);
$amount = $amountBGN;

if ($currency === 'EUR') {
    $amount = calc_eur_total_like_checkout($items, (float)$discount_total, (float)$shipping_fee);
}

$amount = round((float)$amount, 2); // ✅ ДОБАВИ ТОЗИ РЕД


    $_SESSION['borica_pay'] = [
        'order_id' => $orderId,
        'order6'   => $order6,
        'amount'   => $amount,
        'currency' => $currency,
        'email'    => $cust_email,
    ];

    $_SESSION['borica_redirect'] = [
        'order_id' => $orderId,
        'ts'       => time(),
    ];

    header('Location: /borica_payment.php?' . $query);
    exit;
}


header('Location: /thank-you.php?' . $query);
exit;
