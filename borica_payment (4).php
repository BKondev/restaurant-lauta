<?php
/**
 * borica_payment.php
 */
declare(strict_types=1);

session_start();
date_default_timezone_set('Europe/Sofia');

$cfg = require __DIR__ . '/borica_config.php';

if (empty($_SESSION['borica_pay']) || !is_array($_SESSION['borica_pay'])) {
  http_response_code(400);
  exit('Missing BORICA session (borica_pay).');
}

$pay = $_SESSION['borica_pay'];

$orderId  = (string)($pay['order_id'] ?? '');
$order6   = (string)($pay['order6'] ?? '');
$amountF = round((float)($pay['amount'] ?? 0), 2);
$amount  = number_format($amountF, 2, '.', '');
$currency = strtoupper(trim((string)($pay['currency'] ?? ($cfg['DEFAULT_CURRENCY'] ?? 'BGN'))));


if ($currency !== 'BGN' && $currency !== 'EUR') $currency = 'BGN';

if ($orderId === '' || !preg_match('/^\d{6}$/', $order6) || $amountF <= 0) {
  http_response_code(400);
  exit('Invalid borica_pay session data.');
}

function part($value): string {
  if ($value === null || $value === '') return '-';
  return strlen((string)$value) . (string)$value;
}

// BORICA параметри
$TRTYPE = '1';
$TIMESTAMP = gmdate('YmdHis');
$NONCE = strtoupper(bin2hex(random_bytes(16)));
$MERCH_NAME = (string)($cfg['MERCH_NAME'] ?? 'delivery.sombrero.bg');

// Проверка на задължителни полета
if (empty($cfg['MERCH_URL']) || !filter_var($cfg['MERCH_URL'], FILTER_VALIDATE_URL)) {
  http_response_code(500);
  exit('Invalid MERCH_URL in config.');
}

if (empty($cfg['TERMINAL']) || empty($cfg['MERCHANT'])) {
  http_response_code(500);
  exit('Missing TERMINAL or MERCHANT in config.');
}

// Допълнителни полета с fallback
$EMAIL = (string)($pay['email'] ?? ($cfg['EMAIL'] ?? 'sombrerobulgaria@gmail.com'));

$COUNTRY = 'BG';  // Фиксирано за България
$LANG    = 'BG';  // Фиксирано за български

// MERCH_GMT
$dt = new DateTime('now', new DateTimeZone('Europe/Sofia'));
$offset = $dt->getOffset();
$sign = $offset >= 0 ? '+' : '-';
$hours = str_pad((string)abs((int)($offset / 3600)), 2, '0', STR_PAD_LEFT);
$mins  = str_pad((string)abs((int)(($offset % 3600) / 60)), 2, '0', STR_PAD_LEFT);
$MERCH_GMT = $sign . $hours . ':' . $mins;

// AD.CUST_BOR_ORDER_ID (опростен)
$AD_CUST_BOR_ORDER_ID = $order6; // започва с 6 цифри ✅


// DESC
$DESC = substr($MERCH_NAME . ':' . $orderId, 0, 50);

// BACKREF
$backrefBase = rtrim((string)($cfg['BACKREF_URL'] ?? ''), '/');
if ($backrefBase === '') {
  http_response_code(500);
  exit('Missing BACKREF_URL in config.');
}

$backref = $backrefBase . '?order_id=' . urlencode($orderId) . '&order6=' . urlencode($order6);

// SIGNATURE
$symbol = 
  part((string)$cfg['TERMINAL']) .
  part($TRTYPE) .
  part($amount) .
  part($currency) .
  part($order6) .
  part($TIMESTAMP) .
  part($NONCE) .
  '-';

// Зареждане на частния ключ
$privKeyPath = $cfg['PRIVATE_KEY_PATH'] ?? '';

// 🔴 ДОБАВЕТЕ ТОВА (ПРОВЕРКИ ЗА PEM ФАЙЛ):
// 1. Проверка дали пътят не е празен
if (empty($privKeyPath)) {
    error_log("BORICA: PRIVATE_KEY_PATH is empty in config");
    http_response_code(500);
    exit('Missing private key path in configuration.');
}

// 2. Проверка дали файлът съществува
if (!file_exists($privKeyPath)) {
    error_log("BORICA: Private key file does not exist: " . $privKeyPath);
    http_response_code(500);
    exit('Private key file not found.');
}

// 3. Проверка дали може да се чете
if (!is_readable($privKeyPath)) {
    error_log("BORICA: Private key file is not readable: " . $privKeyPath);
    http_response_code(500);
    exit('Cannot read private key file (permission denied).');
}

// 4. Четене на съдържанието
$privKeyContent = file_get_contents($privKeyPath);
if (!$privKeyContent) {
    error_log("BORICA: Failed to read private key content: " . $privKeyPath);
    http_response_code(500);
    exit('Cannot read private key content (file may be empty).');
}

// 5. Проверка дали е валиден PEM формат
if (strpos($privKeyContent, '-----BEGIN') === false) {
    error_log("BORICA: Private key content does not look like valid PEM format");
    http_response_code(500);
    exit('Invalid private key format (not PEM).');
}

// 🔴 КРАЙ НА ДОБАВЕНИТЕ ПРОВЕРКИ

// Продължаване със стария код:
$pkey = openssl_pkey_get_private($privKeyContent, $cfg['PRIVATE_KEY_PASS'] ?? '');
if (!$pkey) {
    http_response_code(500);
    exit('Invalid private key or password.');
}

$signature = '';
if (!openssl_sign($symbol, $signature, $pkey, OPENSSL_ALGO_SHA256)) {
  http_response_code(500);
  exit('Signing failed.');
}

$P_SIGN = strtoupper(bin2hex($signature));
openssl_free_key($pkey);

// Gateway
$mode = $cfg['MODE'] ?? 'prod';
$gateway = ($mode === 'prod') 
  ? ($cfg['GATEWAY_PROD'] ?? '')
  : ($cfg['GATEWAY_TEST'] ?? '');

if ($gateway === '') {
  http_response_code(500);
  exit('Missing gateway URL.');
}

// ADDENDUM
$ADDENDUM = 'AD,TD';
?>
<!doctype html>
<html lang="bg">
<head>
  <meta charset="utf-8">
  <title>Пренасочване към BORICA...</title>
</head>
<body>
  <form method="POST" action="<?= htmlspecialchars($gateway) ?>" id="boricaForm">
    <!-- Основни полета -->
    <input type="hidden" name="TRTYPE" value="<?= htmlspecialchars($TRTYPE) ?>">
    <input type="hidden" name="AMOUNT" value="<?= htmlspecialchars($amount) ?>">
    <input type="hidden" name="CURRENCY" value="<?= htmlspecialchars($currency) ?>">
    <input type="hidden" name="ORDER" value="<?= htmlspecialchars($order6) ?>">
    
    <!-- Идентификационни полета -->
    <input type="hidden" name="MERCHANT" value="<?= htmlspecialchars($cfg['MERCHANT']) ?>">
    <input type="hidden" name="TERMINAL" value="<?= htmlspecialchars($cfg['TERMINAL']) ?>">
    <input type="hidden" name="MERCH_NAME" value="<?= htmlspecialchars($MERCH_NAME) ?>">
    <input type="hidden" name="MERCH_URL" value="<?= htmlspecialchars($cfg['MERCH_URL']) ?>">
    
    <!-- Допълнителни полета -->
    <input type="hidden" name="DESC" value="<?= htmlspecialchars($DESC) ?>">
    <input type="hidden" name="EMAIL" value="<?= htmlspecialchars($EMAIL) ?>">
    <input type="hidden" name="COUNTRY" value="<?= htmlspecialchars($COUNTRY) ?>">
    <input type="hidden" name="LANG" value="<?= htmlspecialchars($LANG) ?>">
    <input type="hidden" name="MERCH_GMT" value="<?= htmlspecialchars($MERCH_GMT) ?>">
    
    <!-- Технически полета -->
    <input type="hidden" name="TIMESTAMP" value="<?= htmlspecialchars($TIMESTAMP) ?>">
    <input type="hidden" name="NONCE" value="<?= htmlspecialchars($NONCE) ?>">
    <input type="hidden" name="ADDENDUM" value="<?= htmlspecialchars($ADDENDUM) ?>">
    
    <!-- Допълнителна информация -->
    <input type="hidden" name="AD.CUST_BOR_ORDER_ID" value="<?= htmlspecialchars($AD_CUST_BOR_ORDER_ID) ?>">
    
    <!-- Подпис -->
    <input type="hidden" name="P_SIGN" value="<?= htmlspecialchars($P_SIGN) ?>">
    
    <!-- URL за обратна връзка -->
    <input type="hidden" name="BACKREF" value="<?= htmlspecialchars($backref) ?>">
    
    <noscript>
      <button type="submit">Плати</button>
    </noscript>
  </form>
  
  <script>document.getElementById('boricaForm').submit();</script>
</body>
</html>