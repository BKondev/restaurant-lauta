<?php
declare(strict_types=1);

// Зареждане на настройките от settings.json
$settingsFile = __DIR__ . '/settings.json';
$defaultCurrency = 'BGN'; // по подразбиране

if (file_exists($settingsFile)) {
    $json = file_get_contents($settingsFile);
    if ($json !== false) {
        $settings = json_decode($json, true);
        
        // Вземаме валутата от настройките
        if (isset($settings['default_currency'])) {
            $defaultCurrency = strtoupper(trim($settings['default_currency']));
            // Валидация
            if (!in_array($defaultCurrency, ['BGN', 'EUR'])) {
                $defaultCurrency = 'BGN';
            }
        }
    }
}

return [
  // Основни идентификатори
  'TERMINAL' => 'V2400557',
  'MERCHANT' => '2000000452',
  'MERCH_NAME' => 'delivery.sombrero.bg',
  'MERCH_URL'  => 'https://delivery.sombrero.bg',

  // Ключове
  'PRIVATE_KEY_PATH' => __DIR__ . '/keys/merchant_private.pem',
  'PRIVATE_KEY_PASS' => '',

  'BORICA_PUBLIC_KEY_PATH' => __DIR__ . '/keys/borica_public.pem',

  // Мрежи (prod/test)
  'MODE' => 'prod',
  'GATEWAY_TEST' => 'https://3dsgate-dev.borica.bg/cgi-bin/cgi_link',
  'GATEWAY_PROD' => 'https://3dsgate.borica.bg/cgi-bin/cgi_link',

  // Обратна връзка
  'BACKREF_URL' => 'https://delivery.sombrero.bg/borica_callback.php',
  
  // Допълнителни полета
  'EMAIL' => 'sombrerobulgaria@gmail.com',
  'COUNTRY' => 'BG',
  'LANG' => 'BG',
  
  // 🔴 СЕГА ЧЕТЕ ОТ SETTINGS.JSON!
  'DEFAULT_CURRENCY' => $defaultCurrency,
];