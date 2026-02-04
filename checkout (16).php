<?php
declare(strict_types=1);
session_start();

// ================== ПРОВЕРКА ЗА РАБОТНО ВРЕМЕ ==================
date_default_timezone_set('Europe/Sofia');
$currentDay = date('N'); // 1=Понеделник, 7=Неделя
$currentTime = date('H:i');
$currentDate = date('Y-m-d');

require_once __DIR__ . '/settings.php';
$SETTINGS = load_settings();
$cfg = require __DIR__ . '/borica_config.php';
$EURO_ONLY = (($cfg['DEFAULT_CURRENCY'] ?? 'BGN') === 'EUR');


// ✅ КОРИГИРАНЕ НА order_cutoff_time ако е след delivery_hours_end
if (!empty($SETTINGS['order_cutoff_time']) && !empty($SETTINGS['delivery_hours_end'])) {
    if (strtotime($SETTINGS['order_cutoff_time']) > strtotime($SETTINGS['delivery_hours_end'])) {
        // Автоматично коригиране
        $SETTINGS['order_cutoff_time'] = $SETTINGS['delivery_hours_end'];
    }
}
// ФЛАГОВЕ
$promoDiscountCartEnabled  = (($SETTINGS['promo_discount_cart_enabled'] ?? '0') === '1');
$promoDiscountItemsEnabled = (($SETTINGS['promo_discount_items_enabled'] ?? '0') === '1');
$promoFreeDeliveryEnabled  = (($SETTINGS['promo_free_delivery_enabled'] ?? '0') === '1');

// СТОЙНОСТИ
$promoDiscountCartPercent   = (float)($SETTINGS['promo_discount_cart_percent'] ?? 0);
$promoDiscountItemsPercent  = (float)($SETTINGS['promo_discount_items_percent'] ?? 0);
$promoDiscountItemsCodesRaw = (string)($SETTINGS['promo_discount_items_codes'] ?? '');
$promoDiscountItemsCodes    = array_filter(array_map('trim', explode(',', $promoDiscountItemsCodesRaw)));
$promoFreeDeliveryMinTotal  = (float)($SETTINGS['promo_free_delivery_min_total'] ?? 0);

$promoPaymentRewardEnabled  = (($SETTINGS['promo_payment_reward_enabled'] ?? '0') === '1');
$promoPaymentRewardMethod   = trim((string)($SETTINGS['promo_payment_reward_method'] ?? 'bank'));
$promoPaymentRewardPercent  = (float)($SETTINGS['promo_payment_reward_percent'] ?? 0);


$blockAccess = false;
$blockReason = '';
$blockMessage = '';

// 1. Проверка за затворени дати
if (!empty($SETTINGS['closed_dates'])) {
    $closedDates = array_map('trim', explode(',', $SETTINGS['closed_dates']));
    if (in_array($currentDate, $closedDates)) {
        $blockAccess = true;
        $blockReason = 'closed_date';
        $blockMessage = 'Днес е почивен ден. Моля, поръчайте в друг ден.';
    }
}

// 2. Проверка по работен график
if (!$blockAccess && isset($SETTINGS['work_schedule'])) {
    $daysMap = [1 => 'monday', 2 => 'tuesday', 3 => 'wednesday', 
                4 => 'thursday', 5 => 'friday', 6 => 'saturday', 7 => 'sunday'];
    
    $todayKey = $daysMap[$currentDay];
    $todaySchedule = $SETTINGS['work_schedule'][$todayKey] ?? null;
    
    if ($todaySchedule) {
        // Проверка дали денят е включен
        if (empty($todaySchedule['enabled']) || $todaySchedule['enabled'] == '0') {
            $blockAccess = true;
            $blockReason = 'day_disabled';
            $blockMessage = $SETTINGS['closed_message'] ?? 'Магазинът не работи днес.';
        }
        // Проверка за работно време
        else if ($currentTime < $todaySchedule['start'] || $currentTime > $todaySchedule['end']) {
            $blockAccess = true;
            $blockReason = 'outside_hours';
            $blockMessage = "Работно време днес: {$todaySchedule['start']} - {$todaySchedule['end']}";
        }
        // Проверка за последен час за поръчки
        else if (!empty($SETTINGS['order_cutoff_time']) && $currentTime > $SETTINGS['order_cutoff_time']) {
            $blockAccess = true;
            $blockReason = 'cutoff_time';
            $blockMessage = "Поръчки за същия ден се приемат до {$SETTINGS['order_cutoff_time']}.";
        }
    }
}

// 3. Стара логика за съвместимост
if (!$blockAccess && !empty($SETTINGS['disabled_days'])) {
    $disabledDays = array_map('trim', explode(',', $SETTINGS['disabled_days']));
    if (in_array((string)$currentDay, $disabledDays)) {
        $blockAccess = true;
        $blockReason = 'legacy_disabled_days';
        $blockMessage = $SETTINGS['sunday_closed_message'] ?? 'Днес не приемаме поръчки.';
    }
}

if (!$blockAccess && isset($SETTINGS['disable_sunday_orders']) && 
    $SETTINGS['disable_sunday_orders'] === '1' && $currentDay == 7) {
    $blockAccess = true;
    $blockReason = 'sunday';
    $blockMessage = $SETTINGS['sunday_closed_message'] ?? 'В неделя не приемаме поръчки.';
}

// Пренасочване към затворената страница
if ($blockAccess) {
    $query = http_build_query([
        'reason' => $blockReason,
        'message' => $blockMessage
    ]);
    // ✅ FIX: абсолютен път към реалния файл
    header('Location: /closed_sunday.php?' . $query);
    exit;
}
// ================== КРАЙ НА ПРОВЕРКАТА ==================

// Продължение с останалия код
require_once __DIR__ . '/visit_log.php';
// НЕ зареждаме settings.php отново, вече е заредено

// CSRF токен за сесията
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

// 🕒 Работно време за доставка (HH:MM)
$deliveryStart = isset($SETTINGS['delivery_hours_start']) && $SETTINGS['delivery_hours_start'] !== ''
    ? (int)substr($SETTINGS['delivery_hours_start'], 0, 2)
    : 11;

$deliveryEnd = isset($SETTINGS['delivery_hours_end']) && $SETTINGS['delivery_hours_end'] !== ''
    ? (int)substr($SETTINGS['delivery_hours_end'], 0, 2)
    : 20;

// безопасност
$deliveryStart = max(0, min(23, $deliveryStart));
$deliveryEnd   = max(0, min(23, $deliveryEnd));
if ($deliveryEnd <= $deliveryStart) {
    $deliveryStart = 11;
    $deliveryEnd   = 20;
}

$deliveryRangeText = ($SETTINGS['delivery_hours_start'] ?? '11:00') . ' и ' . ($SETTINGS['delivery_hours_end'] ?? '20:00');


// 🆕 Базова цена за доставка
$baseDeliveryFee = isset($SETTINGS['delivery_price_default']) && $SETTINGS['delivery_price_default'] !== ''
    ? (float)$SETTINGS['delivery_price_default'] : 7.00;

?>
<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no" />
  <title>Завършване на поръчка — <?php echo htmlspecialchars($SETTINGS['shop_name'] ?? 'Магазин', ENT_QUOTES, 'UTF-8'); ?></title>

  <!-- ИКОНА НА САЙТА -->
 <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Ctext x='10' y='48' font-size='48'%3E%F0%9F%91%92%3C/text%3E%3C/svg%3E" />

  <style>
  :root{
    --bg:#ffffff; --text:#0f172a; --muted:#64748b; --border:#e5e7eb;
    --primary:#2563eb; --radius:14px; --shadow:0 18px 36px rgba(2,6,23,.08);
  }
  *{box-sizing:border-box}
  body{margin:0;background:#fff;color:var(--text);font:16px/1.5 Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
  .container{width:92%;max-width:1100px;margin:0 auto}
  .topbar{position:sticky;top:0;z-index:10;background:#fff;border-bottom:1px solid var(--border)}
  .topbar__row{display:flex;gap:12px;align-items:center;justify-content:space-between;min-height:64px}
  .brand{
    font-weight:900;
    background:linear-gradient(135deg,#3b82f6,#06b6d4,#ec4899);
    -webkit-background-clip:text;
    -webkit-text-fill-color:black;
    text-decoration:none;
    color:inherit;
  }
  .icon-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border:1px solid var(--border);border-radius:10px;color:var(--text);text-decoration:none}
  .section{padding:20px 0 40px}
  .checkout-wrap{display:grid;grid-template-columns:1fr 360px;gap:18px}
  @media (max-width:980px){ .checkout-wrap{grid-template-columns:1fr} }

  .form-card,.summary{border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);background:#fff}
  .form-card{padding:18px}
  .form-card h2{margin:0 0 10px 0;font-size:20px}
  .fieldset{border:1px dashed var(--border);padding:12px;border-radius:12px;margin-top:12px}
  .legend{font-weight:800;font-size:14px;margin-bottom:10px;color:#0f172a}

  .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .form-grid .full{grid-column:1/-1}
  @media (max-width:640px){ .form-grid{grid-template-columns:1fr} }

  label{display:flex;flex-direction:column;gap:6px;font-size:14px}
  input,select,textarea{border:1px solid var(--border);border-radius:10px;padding:10px 12px;font:inherit}
  input:invalid, select:invalid, textarea:invalid{border-color:#dc2626}
  .hint{font-size:12px;color:var(--muted)}
  .hr{border:0;border-top:1px dashed var(--border);margin:12px 0}

  .btn{background:#1a8200;color:#fff;border:0;border-radius:12px;padding:12px 16px;font-weight:900;cursor:pointer;min-height:46px;transition:opacity 0.2s}
  .btn:disabled{opacity:0.6;cursor:not-allowed}
  .btn.secondary{background:#fff;color:#0f172a;border:1px solid var(--border);box-shadow:none}
  .row-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:10px}

  .summary{padding:4px}
  .summary h2{margin:0 0 10px 0;font-size:18px}
  .summary-table{width:100%;border-collapse:collapse}
  .summary-table th,.summary-table td{border-bottom:1px dashed #000000;padding:8px 6px;text-align:left;vertical-align:top}
  .summary-table th:nth-child(2),.summary-table td:nth-child(2){text-align:center;width:70px}
  .summary-table th:nth-child(3),.summary-table td:nth-child(3),
  .summary-table th:nth-child(4),.summary-table td:nth-child(4){text-align:right;width:120px}
  .cart-summary .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 6px 0;
    min-height: 24px;
  }
  /* ✅ Перфектно вертикално подравняване */
.cart-summary .row{
  display: flex;
  align-items: baseline; /* 🔴 ключовото */
  justify-content: space-between;
  gap: 12px;
}

/* текст вляво */
.cart-summary .row span{
  line-height: 1.2;
}

/* сума вдясно */
.cart-summary .row strong{
  margin-left: auto;
  line-height: 1.2;
  text-align: right;
  white-space: nowrap;
}

  
  .cart-summary .total{font-size:18px;font-weight:900}
  .muted{color:var(--muted)}
  .empty{padding:10px 0;color:var(--muted);text-align:center}

  /* Мини снимка в обобщението */
  .summary-item{
    display:flex;
    align-items:flex-start;
    gap:8px;
  }
/* ✅ Без :has() – работи навсякъде */
.product-main-row td{
  border-bottom: none !important;
}
.product-note-row td{
  border-bottom: 1px dashed #000000;
}

  .summary-thumb{
    width:100%;
    height:100%;
    object-fit:cover;
    display:block;
  }
  .summary-text{
    display:block;
  }

  @media (max-width:380px){
    .summary-table thead{display:none}
    .summary-table tr{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:10px 0;border-bottom:1px dashed var(--border)}
    .summary-table td{border:none;padding:0}
    .summary-table td::before{content:attr(data-label);display:block;font:600 12px/1 Inter,system-ui,sans-serif;color:var(--muted);margin-bottom:3px}
    .summary-table td:nth-child(1){grid-column:1/-1}
  }

  .footer{
    border-top:1px solid var(--border);
    color:var(--muted);
    text-align:center;
    padding:16px 0 18px;
    margin-top:16px;
    font-size:14px;
  }

  .footer-inner{
    display:flex;
    flex-direction:column;
    gap:6px;
    align-items:center;
    justify-content:center;
  }

  .footer-row{
    display:flex;
    flex-wrap:wrap;
    gap:8px;
    align-items:center;
    justify-content:center;
  }

  .footer a{
    color:#0f172a;
    text-decoration:underline;
  }

  .footer-credits{
    margin-top:2px;
    font-size:13px;
    color:var(--muted);
  }

  .footer-credits a{
    color:#0f172a;
  }

  .footer-social-icon {
    width: 20px;
    height: 20px;
    display:inline-block;
    vertical-align:middle;
    margin-right:6px;
  }

  .footer-social-link {
    display:inline-flex;
    align-items:center;
    gap:6px;
    text-decoration:underline;
    color:#0f172a;
    font-weight:600;
  }

  /* Групи за дата/час */
  .field-group{
    display:flex;
    gap:8px;
  }
  .field-group select{
    flex:1;
    min-width:0;
  }
  .field-group.field-date select:nth-child(1){max-width:80px;}
  .field-group.field-date select:nth-child(2){max-width:120px;}
  .field-group.field-date select:nth-child(3){max-width:100px;}
  .field-group.field-time select:nth-child(1){max-width:90px;}
  .field-group.field-time select:nth-child(2){max-width:90px;}

  .promo-code-block {
    margin-bottom: 10px;
  }
  .promo-code-actions{
    display:flex;
    gap:6px;
    margin-top:6px;
  }
  .promo-btn{
    padding:6px 10px;
    border-radius:999px;
    border:1px solid #cbd5e1;
    background:#f8fafc;
    font-size:12px;
    cursor:pointer;
    transition:background 0.2s;
  }
  .promo-btn:hover{background:#e2e8f0}
  .promo-btn.secondary{
    background:#fff;
  }
  .promo-btn:disabled{
    opacity:0.5;
    cursor:not-allowed;
  }
  
#sum-discount{
  color:#dc2626 !important;
}


  #sum-discount-details{
    display: block;
    width: 100%;
    color: #dc2626 !important;
    font-size: 13px;
  }

  #sum-discount-details div{
    margin: 0;
  }

  .old-price{
    text-decoration: line-through;
    color:#94a3b8;
    font-weight:400;
    display:block;
    font-size:13px;
  }

  .new-price{
    color:#dc2626;
    font-weight:900;
    display:block;
  }

  #free-delivery-hint {
    color: #16a34a !important;
    font-size: 13px;
    margin-top: 2px;
    font-weight: 500;
    text-align: right;
    display: block;
    width: 100%;
    line-height: 1.3;
  }
  .delivery-message-row {
    min-height: 20px;
    margin-top: 2px;
  }

  .free-delivery-available {
    color: #16a34a !important;
  }
  
  .free-delivery-not-available {
    color: #dc2626 !important;
  }
  
  .error-message {
    color: #dc2626;
    font-size: 12px;
    margin-top: 4px;
    display: none;
  }
  
  .visible {
    display: block;
  }
  
  .loading {
    opacity: 0.6;
    cursor: wait;
  }
  
  .auto-save-notice {
    font-size: 12px;
    color: #64748b;
    margin-top: 4px;
    display: none;
  }
  
  .auto-save-notice.visible {
    display: block;
  }
  
  /* Стилове за бележки към продукти */
  .product-note-modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 1000;
    justify-content: center;
    align-items: center;
  }

  .product-note-content {
    background: white;
    padding: 20px;
    border-radius: var(--radius);
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
  }

  .product-note-content h3 {
    margin-top: 0;
    margin-bottom: 15px;
  }

  .product-note-textarea {
    width: 100%;
    min-height: 100px;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px;
    font-family: inherit;
    font-size: 14px;
    resize: vertical;
    margin-bottom: 15px;
  }

  .product-note-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }

  .note-indicator {
    display: inline-block;
    width: 8px;
    height: 8px;
    background-color: #3b82f6;
    border-radius: 50%;
    margin-left: 6px;
    vertical-align: middle;
  }

  .summary-text {
    display: block;
    max-width: calc(100% - 60px);
  }

  .summary-text .product-name {
    display: block;
    margin-bottom: 4px;
  }

  .summary-text .product-note-preview {
    display: block;
    font-size: 12px;
    color: #64748b;
    font-style: italic;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  /* 🆕 Блок за бележка към продукт – визуално като promo-code-block */
  .product-note-block {
    margin-top: 6px;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
  }
  .product-note-block label {
    display: block;
    font-size: 13px;
    margin: 0 0 4px 0;
  }
  .product-note-block input.product-note-input {
    margin-top: 4px;
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    font-size: 13px;
    background: #ffffff;
  }
  .product-note-row td {
    border-top: none;
    padding-top: 0;
  }

  .product-note-row .product-note-block {
    margin-top: 4px;
  }
  
  /* Стилове за съобщение за минимална сума */
  .min-amount-message {
    color: #dc2626;
    font-size: 13px;
    margin-top: 8px;
    padding: 8px;
    border-radius: 8px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    display: none;
  }
  
@media (max-width: 980px) {

  .checkout-wrap{
    display:flex;
    flex-direction:column;
  }

  #checkout-form.form-card{
    display: contents;
  }

  /* 1) Начин на получаване */
  .ship-section{ order: 1; }

  /* 2) Вашите данни */
  .customer-section{ order: 2; }

  /* 3) Обобщение */
  .summary{ order: 3; }

  /* ✅ 4) Бележка (точно преди плащането) */
  #order_note_fieldset{ order: 4; }

  /* 5) Начин на плащане */
  .payment-section{ order: 5; }

  /* 6) Бутоните най-накрая */
  .row-actions{ order: 6; }
}


.summary-thumb-wrap{
  width:48px;
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:6px;          /* разстояние между Х и снимката */
  flex-shrink:0;
}

.remove-item-btn{
  width:26px;
  height:26px;
  border-radius:50%;
  background:#bc1221;
  color:#fff;
  font-weight:900;
  border:1px solid var(--border);
  display:flex;
  align-items:center;
  justify-content:center;
  line-height:1;
  margin-bottom: 10px;
}

.summary-thumb{
  width:48px;
  height:48px;
  border-radius:10px;
  object-fit:cover;
  display:block;
}


.remove-item-btn:hover {
    background: #a00000;
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.remove-item-btn:active {
    transform: scale(0.95);
}
.qtyc{
  display:flex;
  flex-direction:column;      /* 🔴 вертикално */
  align-items:center;
  justify-content:center;
  gap:4px;
}

.qtyc-btn {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: #bf0a16;
    font-weight: 900;
    cursor: pointer;
    line-height: 1;
    color: white;
}

.qtyc-val{
  min-width:22px;
  text-align:center;
  font-weight:900;
  font-size:14px;
}

/* Центриране и недопускане на чупене на суми */
.product-main-row td[data-label="Ед. цена"],
.product-main-row td[data-label="Общо"] {
  vertical-align: middle;     /* вертикално центриране */
  text-align: center;         /* хоризонтално центриране */
  white-space: nowrap;        /* НЕ чупи ред */
  font-weight: 600;
}

/* Ако вътре има span/div – за всеки случай */
.product-main-row td[data-label="Ед. цена"] *,
.product-main-row td[data-label="Общо"] * {
  white-space: nowrap;
}
/* Центриране на колоната К-во */
.product-main-row td[data-label="К-во"] {
  vertical-align: middle;
  text-align: center;
}

/* Самия контрол + 1 - */
.qtyc {
  display: flex;
  flex-direction: column;     /* + горе, − долу */
  align-items: center;        /* хоризонтално центриране */
  justify-content: center;    /* ВЕРТИКАЛНО центриране */
  height: 100%;
  gap: 6px;
}
.summary-thumb-wrap {
  position: relative !important;
  display: inline-block;
}
/* ============================
   FOOTER (Sombrero)
   ============================ */
.footer {
  background: #0f172a;
  color: #e2e8f0;
  border-top: 1px solid #334155;
  padding: 40px 0 24px;
  margin-top: 40px;
}

.footer-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 40px;
  max-width: 1100px;
  margin: 0 auto 36px;
  padding: 0 16px;
}

.footer-col {
  display: flex;
  flex-direction: column;
}

.footer-col-title {
  font-size: 18px;
  font-weight: 950;
  margin-bottom: 16px;
  color: #ffffff;
  letter-spacing: 0.5px;
}

.footer-col-text {
  font-size: 14px;
  line-height: 1.6;
  color: #cbd5e1;
  max-width: 300px;
}

.footer-links {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.footer-links a {
  color: #cbd5e1;
  text-decoration: none;
  font-size: 15px;
  transition: color 0.2s ease, transform 0.2s ease;
  display: inline-block;
}

.footer-links a:hover {
  color: #ffffff;
  transform: translateX(4px);
}

.footer-links a[target="_blank"] {
  font-weight: 700;
  border-bottom: 1px dashed #4f8cff;
  padding-bottom: 2px;
}

.footer-links a[target="_blank"]:hover {
  border-bottom-style: solid;
  color: #60a5fa;
}

.footer-contact {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.footer-contact a {
  color: #cbd5e1;
  text-decoration: none;
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: color 0.2s ease;
}

.footer-contact a:hover {
  color: #ffffff;
}

.footer-social {
  display: flex;
  gap: 15px;
  margin-top: 10px;
}

.footer-social a {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #334155;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  font-weight: 900;
  font-size: 14px;
  transition: all 0.25s ease;
}

.footer-social a:hover {
  background: #1e40af;
  transform: translateY(-3px) scale(1.08);
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3);
}

.footer-credits {
  text-align: center;
  padding-top: 24px;
  border-top: 1px solid #334155;
  color: #94a3b8;
  font-size: 13px;
}

.footer-credits a {
  color: #60a5fa;
  text-decoration: none;
  font-weight: 700;
}

.footer-credits a:hover {
  text-decoration: underline;
}

/* LOGO */
.footer-logo-link {
  display: inline-block;
  margin-bottom: 14px;
}

.footer-logo-img {
  display: block;
  max-width: 180px;
  height: auto;
  margin: 0 auto;
  transition: transform .25s ease, opacity .25s ease;
}

.footer-logo-link:hover .footer-logo-img {
  transform: scale(1.05);
  opacity: .95;
}

/* Instagram SVG icon */
.footer-social .ig-icon svg {
  width: 18px;
  height: 18px;
  fill: #ffffff;
}

.footer-social .ig-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.footer-social .ig-icon:hover svg {
  fill: #f472b6;
}

/* Център на 1-вата колона (лого + текст) */
.footer-col:first-child {
  align-items: center;
  text-align: center;
}

/* Desktop: центриране на 3-та колона */
@media (min-width: 769px) {
  .footer-grid > .footer-col:nth-child(3) {
    align-items: center;
    text-align: center;
  }

  .footer-grid > .footer-col:nth-child(3) .footer-col-title {
    width: 100%;
    text-align: center;
    margin-bottom: 18px;
  }

  .footer-grid > .footer-col:nth-child(3) .footer-contact {
    align-items: center;
  }

  .footer-grid > .footer-col:nth-child(3) .footer-contact a {
    justify-content: center;
  }

  .footer-grid > .footer-col:nth-child(3) .footer-social {
    justify-content: center;
  }
}

/* Mobile: footer на 1 колона */
@media (max-width: 768px) {
  .footer {
    padding: 32px 0 20px;
    margin-top: 40px;
  }

  .footer-grid {
    grid-template-columns: 1fr;
    gap: 32px;
    padding: 0 20px;
    margin-bottom: 32px;
  }

  .footer-col {
    text-align: center;
    align-items: center;
  }

  .footer-col-text {
    text-align: center;
    max-width: 100%;
  }

  .footer-links {
    align-items: center;
  }

  .footer-links a:hover {
    transform: translateY(-2px);
  }

  .footer-contact a {
    justify-content: center;
  }

  .footer-social {
    justify-content: center;
  }
}


  </style>
</head>
<body>
  <header class="topbar">
    <div class="container topbar__row">
<a class="brand" href="https://delivery.sombrero.bg/" aria-label="Към началната страница">
  <img src="logo.png" alt="Сомбреро" style="height: 40px; vertical-align: middle;">
</a>
<a class="icon-btn" href="https://delivery.sombrero.bg/">← Към менюто</a>
    </div>
  </header>

  <main class="section">
    <div class="container checkout-wrap">
      <!-- Форма за поръчка -->
      <form class="form-card" method="post" action="submit_order.php" id="checkout-form" novalidate>
        <!-- CSRF защита -->
        <input type="hidden" name="csrf_token" value="<?php echo $_SESSION['csrf_token']; ?>">
        
        <!-- Начин на получаване (ПЪРВИ) -->
        <div class="fieldset ship-section">

          <div class="legend">НАЧИН НА ПОЛУЧАВАНЕ</div>
          <div class="form-grid">
            <label class="full">Изберете
              <select name="ship_method" id="ship_method" required>
                <option value="">— Изберете опция —</option>
                <option value="pickup">
                  Вземи сам от — <?php echo htmlspecialchars($SETTINGS['address_line'] ?? '', ENT_QUOTES, 'UTF-8'); ?>
                </option>
                <option value="plovdiv_address">
                  Доставка до адрес (гр. <?php echo htmlspecialchars($SETTINGS['city'] ?? '', ENT_QUOTES, 'UTF-8'); ?>)
                </option>
              </select>
            </label>

<div class="full" id="pickup_info" style="display:none">
    <div class="hint">
         Вашата поръчка ще бъде готова за взимане до 60 минути считано от времето на поръчката.<br>
        <strong>Адрес за взимане:</strong>
        <?php echo htmlspecialchars($SETTINGS['address_full'] ?? '', ENT_QUOTES, 'UTF-8'); ?>
    </div>
</div>

            <!-- Блок за доставка до адрес -->
            <div class="full" id="plovdiv_block" style="display:none">
              <div class="form-grid">
                <label>Име на получател *
                  <input type="text" name="rec_name" id="rec_name" placeholder="Въведете пълното име на получателя">
                  <small class="hint">Моля, въведете пълното име на получателя</small>
                  <div class="error-message" id="rec_name_error"></div>
                  <div class="auto-save-notice" id="rec_name_saved">Запазено</div>
                </label>
                <label>Телефон на получател *
                  <input type="tel" name="rec_phone" id="rec_phone">



                  <div class="error-message" id="rec_phone_error"></div>
                  <div class="auto-save-notice" id="rec_phone_saved">Запазено</div>
                </label>
<div class="full" id="delivery_email_slot"></div>


                <label class="full">Адрес на получателя *
                  <input type="text" name="rec_address" id="rec_address" placeholder="улица, №, вход, етаж, ап." minlength="5" maxlength="200">
                  <div class="error-message" id="rec_address_error"></div>
                  <div class="auto-save-notice" id="rec_address_saved">Запазено</div>
                </label>

                <label class="full">Доставка за днес *
                  <div class="field-group field-date">
                    <select id="rec_date_day">
                      <option value="">Ден</option>
                    </select>
                    <select id="rec_date_month">
                      <option value="">Месец</option>
                    </select>
                    <select id="rec_date_year">
                      <option value="">Година</option>
                    </select>
                  </div>
                  <div class="error-message" id="rec_date_error"></div>
                  <div class="hint" id="today_date_hint" style="display:none;"></div>
                </label>

                <label class="full">Час на доставка - възможно най-скоро до 60 минути *
                  <div class="field-group field-time">
                    <select id="rec_time_hour">
                      <option value="">Час</option>
                    </select>
                    <select id="rec_time_minute">
                      <option value="">Минути</option>
                    </select>
                  </div>
                  <div class="error-message" id="rec_time_error"></div>
                </label>
              </div>
              <div class="hint" id="delivery_hint">
  Вашата поръчка ще бъде доставена в рамките на 60 минути, считано от часа на поръчката.
</div>

            </div>
          </div>
        </div>

<!-- Вашите данни (ВТОРИ - може да се скрие) -->
<div class="fieldset customer-section" id="customer_data_section">

  <div class="legend">ВАШИТЕ ДАННИ</div>
  <div class="form-grid">
    <label>Име *
      <input type="text" name="cust_first_name" id="cust_first_name" required minlength="2" maxlength="50">
      <div class="error-message" id="first_name_error"></div>
      <div class="auto-save-notice" id="first_name_saved">Запазено</div>
    </label>

    <label>Фамилия *
      <input type="text" name="cust_last_name" id="cust_last_name" required minlength="2" maxlength="50">
      <div class="error-message" id="last_name_error"></div>
      <div class="auto-save-notice" id="last_name_saved">Запазено</div>
    </label>

    <label>Телефон *
      <input type="tel" name="cust_phone" id="cust_phone" required placeholder="0888123456">
      <div class="error-message" id="phone_error"></div>
      <div class="auto-save-notice" id="phone_saved">Запазено</div>
      <small class="hint">Формат: 0888123456</small>
    </label>

    <label id="cust_email_label">Email *
      <input type="email" name="cust_email" id="cust_email" required>
      <div class="error-message" id="email_error"></div>
      <div class="auto-save-notice" id="email_saved">Запазено</div>
    </label>
  </div>
</div>

<!-- БЕЛЕЖКА КЪМ ПОРЪЧКАТА – ВИДИМА И ПРИ ДОСТАВКА, И ПРИ ВЗИМАНЕ -->
<div class="fieldset" id="order_note_fieldset">
  <div class="legend">Инструкции</div>
  <div class="form-grid">
    <label class="full" id="order_note_block">
  Допълнителни инструкции към поръчката
  <textarea
    name="order_note"
    id="order_note"
    rows="3"
    placeholder="Напр.: точен час за доставка или взимане, инструкции към куриера, етаж, вход, код, без сол, без люто и др."
    maxlength="500"></textarea>

  <div class="auto-save-notice" id="order_note_saved">Запазено</div>
  <small class="hint">Максимум 500 символа</small>
</label>

  </div>
</div>


<!-- Плащане -->
<div class="fieldset payment-section">

  <div class="legend">НАЧИН НА ПЛАЩАНЕ</div>

  <!-- 1) КАРТА (важно: НЕ пипаме id/value) -->
  <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
    <input type="radio" name="pay_method" value="bank" id="pay_method_bank">
    Плащане с карта (онлайн)
  </label>
  <div class="hint" id="bank_hint" style="display:none">
    Ще бъдете пренасочени към сигурна страница за плащане с карта.
  </div>

  <div class="hr"></div>

  <!-- 2) В БРОЙ -->
  <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
    <input type="radio" name="pay_method" value="cash" id="pay_method_cash" checked>
    Плащане в брой при получаване
  </label>
  <div class="hint" id="cash_hint">
    Плащане в брой при получаване на поръчката.
  </div>
</div>

        <!-- Скрити полета -->
        <input type="hidden" name="rec_date" id="rec_date">
        <input type="hidden" name="rec_time" id="rec_time">
        <input type="hidden" name="cart_payload" id="cart_payload">
        <input type="hidden" name="products_total" id="products_total">
        <input type="hidden" name="products_after_discount" id="products_after_discount" value="0.00">
        <input type="hidden" name="total_gross" id="total_gross">
        <input type="hidden" name="promo_code" id="promo_code">
        <input type="hidden" name="discount_total" id="discount_total">
        <input type="hidden" name="discount_details" id="discount_details">

        <!-- Модален прозорец за бележки към продукт -->
        <div class="product-note-modal" id="productNoteModal">
          <div class="product-note-content">
            <h3>Бележка към продукт</h3>
            <div id="productNoteInfo" style="margin-bottom: 10px; font-size: 14px; color: var(--muted);"></div>
            <textarea class="product-note-textarea" id="productNoteTextarea" placeholder="Въведете бележка към този продукт..." maxlength="500"></textarea>
            <small class="hint" style="display: block; margin-bottom: 15px;">Максимум 500 символа</small>
            <div class="product-note-actions">
              <button type="button" class="btn secondary" id="cancelNoteBtn">Отказ</button>
              <button type="button" class="btn" id="saveNoteBtn">Запази</button>
            </div>
          </div>
        </div>

        <div class="row-actions">
          <button type="button" class="btn secondary" onclick="window.location.href='https://delivery.sombrero.bg/'">← Към менюто</button>
          <button type="submit" class="btn" id="submit-btn">Поръчай</button>
        </div>
      </form>

      <aside class="summary">
        <h2>Обобщение на поръчката</h2>
        <div class="promo-code-block">
          <label style="display:block;font-size:14px;margin:6px 0 4px 0;">
            Промо код
            <input type="text" id="promo-code-input" placeholder="Въведете промо код" style="margin-top:4px;width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #cbd5e1;font-size:14px;">
          </label>
          <div class="promo-code-actions">
            <button type="button" id="promo-apply-btn" class="promo-btn">Приложи</button>
            <button type="button" id="promo-edit-btn" class="promo-btn secondary" style="display:none;">Редакция</button>
          </div>
          <small id="promo-code-message" class="muted"></small>
        </div>

        <!-- Съобщение за минимална сума за доставка -->
        <div id="min-amount-message" class="min-amount-message" style="display: none;"></div>

        <div id="summary-table-wrap"></div>
        <hr class="hr">
<div class="cart-summary">

  <!-- 1) Междинна сума (сбор на артикули) -->
  <div class="row">
    <span>Междинна сума</span>
    <strong id="sum-products">0,00 лв.</strong>
  </div>

  <!-- 2) Промоция / Отстъпка -->
  <div class="row">
    <span>Промоция</span>
    <strong id="sum-discount">0,00 лв.</strong>
  </div>

  <!-- детайли за промоцията (ако искаш да се виждат) -->
  <div class="row">
    <span></span>
    <small id="sum-discount-details" class="muted"></small>
  </div>

  <!-- 3) Доставка -->
  <div class="row">
    <span>Доставка</span>
    <strong id="sum-delivery">0,00 лв.</strong>
  </div>

  <div class="row delivery-message-row" id="free-delivery-row" style="display:none;">
    <span></span>
    <small id="free-delivery-hint" style="font-weight:500; line-height:1.3;"></small>
  </div>

  <!-- 4) Общо -->
  <div class="row total">
    <span>Общо (с ДДС)</span>
    <strong id="sum-gross">0,00 лв.</strong>
  </div>

</div>

      </aside>
    </div>
  </main>

<footer class="footer">
  <div class="container">
    <div class="footer-grid">

      <!-- Колона 1: За нас (С ЛОГО) -->
      <div class="footer-col">
        <a href="https://delivery.sombrero.bg/" class="footer-logo-link" aria-label="Sombrero Home">
          <img
            src="https://delivery.sombrero.bg/logo.png"
            alt="Sombrero"
            class="footer-logo-img"
            loading="lazy"
          >
        </a>

        <p class="footer-col-text">
          Автентична мексиканска храна с бърза доставка за гр. Пловдив.
          Поръчай вкус и усмивка до твоята врата!
        </p>
      </div>

      <!-- Колона 2: Информация -->
      <div class="footer-col">
        <h3 class="footer-col-title">Информация</h3>
        <ul class="footer-links">
          <li><a href="https://sombrero.bg/privacy-policy/" target="_blank" rel="noopener">Политика за поверителност</a></li>
          <li><a href="https://sombrero.bg/general-terms/" target="_blank" rel="noopener">Общи условия</a></li>
          <li><a href="https://sombrero.bg/cookie-policy/" target="_blank" rel="noopener">Бисквитки</a></li>
        </ul>
      </div>

      <!-- Колона 3: Връзка с нас -->
      <div class="footer-col">
        <h3 class="footer-col-title">Връзка с нас</h3>
        <div class="footer-contact">
          <a href="tel:35932336179">📞 +359 32 336 179</a>
          <a href="mailto:sales@sombrero.bg">✉️ sales@sombrero.bg</a>

          <div class="footer-social">
            <!-- Facebook -->
            <a href="https://www.facebook.com/sombrerodunav5/"
               target="_blank" rel="noopener"
               aria-label="Facebook">
              f
            </a>

            <!-- Instagram (ИСТИНСКА ИКОНА) -->
            <a href="https://www.instagram.com/sombreroplovdiv"
               target="_blank" rel="noopener"
               aria-label="Instagram"
               class="ig-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.2c3.2 0 3.6.01 4.9.07
                  1.17.05 1.97.24 2.43.4a4.9 4.9 0 011.75 1.15
                  4.9 4.9 0 011.15 1.75c.16.46.35 1.26.4 2.43
                  .06 1.3.07 1.7.07 4.9s-.01 3.6-.07 4.9
                  c-.05 1.17-.24 1.97-.4 2.43a4.9 4.9 0 01-1.15 1.75
                  4.9 4.9 0 01-1.75 1.15c-.46.16-1.26.35-2.43.4
                  -1.3.06-1.7.07-4.9.07s-3.6-.01-4.9-.07
                  c-1.17-.05-1.97-.24-2.43-.4a4.9 4.9 0 01-1.75-1.15
                  4.9 4.9 0 01-1.15-1.75c-.16-.46-.35-1.26-.4-2.43
                  -.06-1.3-.07-1.7-.07-4.9s.01-3.6.07-4.9
                  c.05-1.17.24-1.97.4-2.43A4.9 4.9 0 014.3 3.8
                  4.9 4.9 0 016.05 2.65c.46-.16 1.26-.35 2.43-.4
                  1.3-.06 1.7-.07 4.9-.07zm0 1.8
                  c-3.17 0-3.55.01-4.79.07
                  -1.02.05-1.57.22-1.94.36
                  -.49.19-.84.42-1.21.79
                  -.37.37-.6.72-.79 1.21
                  -.14.37-.31.92-.36 1.94
                  -.06 1.24-.07 1.62-.07 4.79
                  0 3.17.01 3.55.07 4.79
                  .05 1.02.22 1.57.36 1.94
                  .19.49.42.84.79 1.21
                  .37.37.72.6 1.21.79
                  .37.14.92.31 1.94.36
                  1.24.06 1.62.07 4.79.07
                  3.17 0 3.55-.01 4.79-.07
                  1.02-.05 1.57-.22 1.94-.36
                  .49-.19.84-.42 1.21-.79
                  .37-.37.6-.72.79-1.21
                  .14-.37.31-.92.36-1.94
                  .06-1.24.07-1.62.07-4.79
                  0-3.17-.01-3.55-.07-4.79
                  -.05-1.02-.22-1.57-.36-1.94
                  -.19-.49-.42-.84-.79-1.21
                  -.37-.37-.72-.6-1.21-.79
                  -.37-.14-.92-.31-1.94-.36
                  -1.24-.06-1.62-.07-4.79-.07zm0 3.95
                  a5.9 5.9 0 110 11.8
                  a5.9 5.9 0 010-11.8zm0 9.7
                  a3.8 3.8 0 100-7.6
                  a3.8 3.8 0 000 7.6zm6.4-11
                  a1.38 1.38 0 110-2.76
                  a1.38 1.38 0 010 2.76z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>

    </div>

    <div class="footer-credits">
      © <?php echo date('Y'); ?> Сомбреро България ООД • 
      Power by <a href="https://karakashkov.com" target="_blank" rel="noopener">karakashkov.com</a>
    </div>
  </div>
</footer>

<script>


// Константи от PHP
const DELIVERY_START_HOUR = <?php echo (int)$deliveryStart; ?>;
const EURO_ONLY = <?php echo $EURO_ONLY ? 'true' : 'false'; ?>;

const DELIVERY_END_HOUR   = <?php echo (int)$deliveryEnd; ?>;
const DELIVERY_RANGE_TEXT = '<?php echo htmlspecialchars($deliveryRangeText, ENT_QUOTES, "UTF-8"); ?>';
const DELIVERY_FEE_BASE = <?php echo json_encode($baseDeliveryFee); ?>;
const BGN_TO_EUR = 1.95583;

const PROMO_DISCOUNT_CART_ENABLED   = <?php echo $promoDiscountCartEnabled ? 'true' : 'false'; ?>;
const PROMO_DISCOUNT_CART_PERCENT   = <?php echo json_encode($promoDiscountCartPercent); ?>;
const PROMO_FREE_DELIVERY_ENABLED   = <?php echo $promoFreeDeliveryEnabled ? 'true' : 'false'; ?>;
const PROMO_FREE_DELIVERY_MIN_TOTAL = <?php echo json_encode($promoFreeDeliveryMinTotal); ?>;
const PROMO_PAYMENT_REWARD_ENABLED  = <?php echo $promoPaymentRewardEnabled ? 'true' : 'false'; ?>;
const PROMO_PAYMENT_REWARD_METHOD   = <?php echo json_encode($promoPaymentRewardMethod); ?>;
const PROMO_PAYMENT_REWARD_PERCENT  = <?php echo json_encode($promoPaymentRewardPercent); ?>;

const PROMO_CODE_ENDPOINT = 'apply_promocode.php';
const CART_KEY = 'bb_cart_from_csv_v3';
const CART_BACKUP_KEY = 'bb_cart_from_csv_v3_backup';

const STORAGE_PROMO_KEY = 'checkout_applied_promo';
const FORM_DATA_KEY = 'checkout_form_data';

// 🔴 МИНИМАЛНА СУМА ЗА ДОСТАВКА
const MIN_ORDER_AMOUNT_DELIVERY = <?php 
  echo json_encode((float)($SETTINGS['min_order_amount_delivery'] ?? 35.00));
?>;


const lv = n => {
    const num = Number(n) || 0;
    
    if (EURO_ONLY) {
        // ✅ ПРАВИЛНО КОНВЕРТИРАНЕ BGN → EUR (СЪЩАТА ЛОГИКА КАТО В PYTHON/PHP)
        // Python/PHP: round($amount_bgn / 1.95583, 3) и след това round($euroAmount, 2)
        const euroPrecise = Math.round((num / BGN_TO_EUR) * 1000) / 1000; // 3 знака
        const euroRounded = Math.round(euroPrecise * 100) / 100; // след това до 2 знака
        return `${euroRounded.toFixed(2).replace('.', ',')} €`;
    } else {
        // Левове (правилно закръглени до 2 знака)
        const lev = Math.round(num * 100) / 100;
        const levStr = lev.toFixed(2).replace('.', ',');
        
        // Показваме евро само като референция
        const euroPrecise = Math.round((num / BGN_TO_EUR) * 1000) / 1000;
        const euroRounded = Math.round(euroPrecise * 100) / 100;
        const euroStr = euroRounded.toFixed(2).replace('.', ',');
        
        return `${levStr} лв. (${euroStr} €)`;
    }
};

function eurFromBgn(bgn){
  const num = Number(bgn) || 0;
  const euroPrecise = Math.round((num / BGN_TO_EUR) * 1000) / 1000; // 3 знака
  const euroRounded = Math.round(euroPrecise * 100) / 100;         // после 2 знака
  return euroRounded;
}

function fmtEur(eur){
  const v = Math.round((Number(eur) || 0) * 100) / 100;
  return `${v.toFixed(2).replace('.', ',')} €`;
}

// ✅ само число (за редовете), без € символ
function fmtEurNum(eur){
  const v = Math.round((Number(eur) || 0) * 100) / 100;
  return v.toFixed(2).replace('.', ',');
}


let appliedPromoCode = '';
let appliedPromoData = null;
let currentNoteProductId = null;
let PROMO_APPLYING = false;
let CART_SUBTOTAL = 0;
let DISPLAY_SUBTOTAL_EUR = 0; // ✅ само за визуална междинна сума в EUR-only





// Помощни функции
function escapeHTML(s){
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function pad2(n){ return String(n).padStart(2,'0'); }

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.classList.add('visible');
  }
}

function hideError(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = '';
    el.classList.remove('visible');
  }
}

function scrollToFirstError(){
  const firstErr = document.querySelector('.error-message.visible');
  if (!firstErr) return;

  const label = firstErr.closest('label') || firstErr.parentElement;
  const input = label ? label.querySelector('input,select,textarea') : null;

  (input || label || firstErr).scrollIntoView({ behavior:'smooth', block:'center' });
  if (input) input.focus({ preventScroll:true });
}


function showSavedNotice(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.classList.add('visible');
    setTimeout(() => {
      el.classList.remove('visible');
    }, 2000);
  }
}

// Проверка за минимална сума за доставка
function checkMinOrderAmount(productsTotal, deliveryMethod) {
  const submitBtn = document.getElementById('submit-btn');
  const minAmountMsg = document.getElementById('min-amount-message');
  
  // 🔴 ПРОВЕРКА: Ако е избрана доставка до адрес
  if (deliveryMethod === 'plovdiv_address' && productsTotal < MIN_ORDER_AMOUNT_DELIVERY) {
    if (submitBtn) submitBtn.disabled = true;
    if (minAmountMsg) {
      minAmountMsg.textContent = `Минималната сума за доставка е ${lv(MIN_ORDER_AMOUNT_DELIVERY)}. Добавете още ${lv(MIN_ORDER_AMOUNT_DELIVERY - productsTotal)} стойност от продукти към поръчката.`;
      minAmountMsg.style.display = 'block';
    }
    return false;
  } else {
    if (submitBtn) submitBtn.disabled = false;
    if (minAmountMsg) minAmountMsg.style.display = 'none';
    return true;
  }
}

// Запазване на формата в localStorage
function saveFormData() {
  const formData = {
    cust_first_name: document.getElementById('cust_first_name')?.value || '',
    cust_last_name: document.getElementById('cust_last_name')?.value || '',
    cust_phone: document.getElementById('cust_phone')?.value || '',
    cust_email: document.getElementById('cust_email')?.value || '',
    order_note: document.getElementById('order_note')?.value || '',
    rec_name: document.getElementById('rec_name')?.value || '',
    rec_phone: document.getElementById('rec_phone')?.value || '',
    rec_address: document.getElementById('rec_address')?.value || '',
    pay_method: (document.querySelector('input[name="pay_method"]:checked')?.value || 'cash')

  };
  
  localStorage.setItem(FORM_DATA_KEY, JSON.stringify(formData));
}

// Зареждане на запазените данни от localStorage
function loadFormData() {
  const saved = localStorage.getItem(FORM_DATA_KEY);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      
      // Попълване на основните полета
      if (data.cust_first_name) document.getElementById('cust_first_name').value = data.cust_first_name;
      if (data.cust_last_name) document.getElementById('cust_last_name').value = data.cust_last_name;
      if (data.cust_phone) document.getElementById('cust_phone').value = data.cust_phone;
      if (data.cust_email) document.getElementById('cust_email').value = data.cust_email;
      if (data.order_note) document.getElementById('order_note').value = data.order_note;
      
      // Попълване на данни за получател
      if (data.rec_name) document.getElementById('rec_name').value = data.rec_name;
      if (data.rec_phone) document.getElementById('rec_phone').value = data.rec_phone;
      if (data.rec_address) document.getElementById('rec_address').value = data.rec_address;
      
      // Попълване на начин на плащане
      if (data.pay_method) {
        if (data.pay_method === 'bank') {
          document.getElementById('pay_method_bank').checked = true;
        } else if (data.pay_method === 'cash') {
          document.getElementById('pay_method_cash').checked = true;
        }
        togglePaymentHints();
      }
      
    } catch(e) {
      console.error('Грешка при зареждане на запазените данни:', e);
    }
  }
}

// Запазване на промените при всяка промяна
function setupAutoSave() {
  // Основни полета
  const fields = [
    'cust_first_name', 'cust_last_name', 'cust_phone', 'cust_email', 'order_note',
    'rec_name', 'rec_phone', 'rec_address'
  ];
  
  fields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('input', function() {
        saveFormData();
        showSavedNotice(fieldId + '_saved');
      });
      
      if (field.tagName === 'SELECT') {
        field.addEventListener('change', function() {
          saveFormData();
          showSavedNotice(fieldId + '_saved');
        });
      }
    }
  });
  
  // Радио бутони за плащане
  document.querySelectorAll('input[name="pay_method"]').forEach(radio => {
    radio.addEventListener('change', function() {
      saveFormData();
      togglePaymentHints();
    });
  });
  
  // Полета за дата и час
  const dateTimeFields = ['rec_date_day', 'rec_date_month', 'rec_date_year', 'rec_time_hour', 'rec_time_minute'];
  dateTimeFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('change', function() {
        saveFormData();
        syncDeliveryDateTime();
      });
    }
  });
}

// Зареждане на запазен промо код
function loadSavedPromoCode() {
  const saved = localStorage.getItem(STORAGE_PROMO_KEY);
  if (!saved) return;

  try {
    const data = JSON.parse(saved);
    if (!data || !data.code) return;

    const method = document.getElementById('ship_method')?.value || '';

    // ✅ ако е код "10" и НЕ е pickup -> не го възстановяваме
    if (String(data.code).trim() === '10' && method !== 'pickup') {
      localStorage.removeItem(STORAGE_PROMO_KEY);

      // чистим и UI/hidden, ако нещо е останало
      const promoInput = document.getElementById('promo-code-input');
      const hiddenInput = document.getElementById('promo_code');
      const msgEl = document.getElementById('promo-code-message');
      const applyBtn = document.getElementById('promo-apply-btn');
      const editBtn = document.getElementById('promo-edit-btn');

      appliedPromoCode = '';
      appliedPromoData = null;

      if (promoInput) {
        promoInput.value = '';
        promoInput.disabled = false;
      }
      if (hiddenInput) hiddenInput.value = '';
      if (msgEl) msgEl.textContent = '';

      if (applyBtn) {
        applyBtn.style.display = '';
        applyBtn.disabled = false;
      }
      if (editBtn) editBtn.style.display = 'none';

      return;
    }

    // ✅ нормално зареждане
    appliedPromoCode = String(data.code).trim();
    appliedPromoData = data;

    const promoInput = document.getElementById('promo-code-input');
    const hiddenInput = document.getElementById('promo_code');
    const msgEl = document.getElementById('promo-code-message');
    const applyBtn = document.getElementById('promo-apply-btn');
    const editBtn = document.getElementById('promo-edit-btn');

    if (promoInput && hiddenInput) {
      promoInput.value = appliedPromoCode;
      hiddenInput.value = appliedPromoCode;
      promoInput.disabled = true;

      // Показване на информация за типа на кода
      let typeText = '';
      if (data.code_type === 'single') {
        typeText = ' (еднократен)';
      } else if (data.code_type === 'multi') {
        const usage = data.usage_info || {};
        typeText = ` (многократен ${usage.current || 0}/${usage.max || '∞'})`;
      }

      if (msgEl) {
        msgEl.textContent =
          (data.message || 'Промо кодът е приложен от предишна сесия.') + typeText;
        msgEl.style.color = '#16a34a';
      }

      if (applyBtn) applyBtn.style.display = 'none';
      if (editBtn) editBtn.style.display = '';
    }

    // ✅ важно: да преизчисли тоталите с този код
    recalcTotals();

  } catch (e) {
    console.error('Грешка при зареждане на промокод:', e);
    localStorage.removeItem(STORAGE_PROMO_KEY);
  }
}


// Отваряне на модален прозорец за бележка
function openProductNoteModal(productId, productName, currentNote = '') {
  currentNoteProductId = productId;
  
  const modal = document.getElementById('productNoteModal');
  const infoEl = document.getElementById('productNoteInfo');
  const textarea = document.getElementById('productNoteTextarea');
  
  infoEl.textContent = `Продукт: ${productName}`;
  textarea.value = currentNote || '';
  
  modal.style.display = 'flex';
  textarea.focus();
}

// Затваряне на модален прозорец
function closeProductNoteModal() {
  const modal = document.getElementById('productNoteModal');
  modal.style.display = 'none';
  currentNoteProductId = null;
}

// Запазване на бележката (от модал)
function saveProductNote() {
  if (!currentNoteProductId) return;
  
  const textarea = document.getElementById('productNoteTextarea');
  const note = textarea.value.trim();
  
  // Запазване в количката
  const raw = localStorage.getItem(CART_KEY);
  if (raw) {
    try {
      const cart = JSON.parse(raw);
      if (cart[currentNoteProductId]) {
        cart[currentNoteProductId].note = note;
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
      }
    } catch(e) {
      console.error('Грешка при запазване на бележка:', e);
    }
  }
  
  // 🔹 Обновяваме и скритото поле за cart_payload
  updateCartPayloadHiddenFromStorage();
  
  closeProductNoteModal();
  renderSummary(); // Прерисуване на обобщението
}

// Функция за премахване на бележка
function removeProductNote(productId) {
  const raw = localStorage.getItem(CART_KEY);
  if (raw) {
    try {
      const cart = JSON.parse(raw);
      if (cart[productId]) {
        delete cart[productId].note;
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
        updateCartPayloadHiddenFromStorage(); // 🔹 Обнови скритото поле
        renderSummary();
      }
    } catch(e) {
      console.error('Грешка при премахване на бележка:', e);
    }
  }
}

// 🆕 Запис на бележка директно от полето под продукта
function attachProductNoteInputs() {
  const inputs = document.querySelectorAll('.product-note-input');
  if (!inputs.length) return;

  inputs.forEach(input => {
    const productId = input.getAttribute('data-product-id');
    const block = input.closest('.product-note-block');
    const removeBtn = block ? block.querySelector('.product-note-remove-btn') : null;

    // при писане в полето - със забавяне
    let timeoutId;
    input.addEventListener('input', () => {
      clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        const note = input.value.trim();
        const raw = localStorage.getItem(CART_KEY);
        if (!raw || !productId) return;

        try {
          const cart = JSON.parse(raw);
          if (!cart[productId]) return;

          cart[productId].note = note;
          
          localStorage.setItem(CART_KEY, JSON.stringify(cart));

          updateCartPayloadHiddenFromStorage();

          if (removeBtn) {
            removeBtn.style.display = note ? 'inline-block' : 'none';
          }
        } catch (e) {
          console.error('Грешка при запис на бележка от input:', e);
        }
      }, 300);
    });

    // клик на Премахни
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        const raw = localStorage.getItem(CART_KEY);
        if (raw && productId) {
          try {
            const cart = JSON.parse(raw);
            if (cart[productId]) {
              delete cart[productId].note;
              localStorage.setItem(CART_KEY, JSON.stringify(cart));
              
              input.value = '';
              removeBtn.style.display = 'none';
              updateCartPayloadHiddenFromStorage();
              renderSummary();
            }
          } catch(e) {
            console.error('Грешка при премахване на бележка:', e);
          }
        }
      });

      const initialNote = input.value.trim();
      removeBtn.style.display = initialNote ? 'inline-block' : 'none';
    }
  });
}

// 🆕 Централизирана функция за обновяване на скритото поле cart_payload
function updateCartPayloadHiddenFromStorage() {
  const hidden = document.getElementById('cart_payload');
  if (!hidden) return;

  const raw = localStorage.getItem(CART_KEY);
  let cartData = [];

  if (raw) {
    try {
      const parsedCart = JSON.parse(raw);
cartData = Object.entries(parsedCart || {}).map(([productId, item]) => ({
  product_id: String(productId),
  product: item.product || {},
  qty: item.qty || 1,
  note: (item.note || '').trim()
}));

    } catch (e) {
      console.error('Грешка при парсване на количката за cart_payload:', e);
    }
  }

  hidden.value = JSON.stringify(cartData);
}

function removeCartItem(productId){
  if (!productId) return;

  const raw = localStorage.getItem(CART_KEY);
  if (!raw) return;

  try {
    const cart = JSON.parse(raw) || {};
    if (!cart[productId]) return;

    // махаме продукта
    delete cart[productId];

    // записваме новата количка
    if (Object.keys(cart).length === 0) {
      localStorage.removeItem(CART_KEY);
    } else {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    }

    // ✅ FIX: синхронизираме backup-а, за да НЕ връща старите продукти след refresh
    try {
      const current = localStorage.getItem(CART_KEY);
      if (current && current !== '{}' && current !== '[]') {
        localStorage.setItem(CART_BACKUP_KEY, current);
      } else {
        localStorage.removeItem(CART_BACKUP_KEY);
      }
    } catch (e) {}

    // обновяваме hidden payload и UI
    updateCartPayloadHiddenFromStorage();
    renderSummary(); // прерисува + вика recalcTotals()

  } catch (e) {
    console.error('Грешка при премахване на продукт:', e);
  }
}

function changeCartQty(productId, delta){
  if (!productId) return;

  const raw = localStorage.getItem(CART_KEY);
  if (!raw) return;

  try{
    const cart = JSON.parse(raw) || {};
    if (!cart[productId]) return;

    const cur = Number(cart[productId].qty) || 1;
    let next = cur + Number(delta);

    // минимално 1 (имаш Х за махане)
    if (next < 1) next = 1;
    if (next > 999) next = 999;

    cart[productId].qty = next;
    localStorage.setItem(CART_KEY, JSON.stringify(cart));

    // ако ползваш backup за BORICA – синхронизирай и него
    try { localStorage.setItem(CART_BACKUP_KEY, JSON.stringify(cart)); } catch(e){}

    updateCartPayloadHiddenFromStorage();
    renderSummary();
  }catch(e){
    console.error('changeCartQty error', e);
  }
}


function renderSummary(){
  const wrap = document.getElementById('summary-table-wrap');
  const raw = localStorage.getItem(CART_KEY);

  const sumProductsEl = document.getElementById('sum-products');
  const sumDeliveryEl = document.getElementById('sum-delivery');
  const sumGrossEl = document.getElementById('sum-gross');
  const sumDiscountEl = document.getElementById('sum-discount');

  const productsTotalInput = document.getElementById('products_total');
  const totalGrossInput = document.getElementById('total_gross');
  const discountTotalInput = document.getElementById('discount_total');
  const discountDetailsInput = document.getElementById('discount_details');

  if(!raw){
    wrap.innerHTML = '<div class="empty">Количката е празна.</div>';
    sumProductsEl.textContent = lv(0);
    sumDeliveryEl.textContent = lv(0);
    sumGrossEl.textContent = lv(0);
    if (sumDiscountEl) sumDiscountEl.textContent = lv(0);

    productsTotalInput.value = '0.00';
    totalGrossInput.value = '0.00';
    discountTotalInput.value = '0.00';
    discountDetailsInput.value = '';
    document.getElementById('cart_payload').value = '[]';
    return;
  }

  let parsedCart = {};
  try { parsedCart = JSON.parse(raw) || {}; } catch (_) { parsedCart = {}; }

  const entries = Object.entries(parsedCart);
  if (!entries.length) {
    wrap.innerHTML = '<div class="empty">Количката е празна.</div>';
    sumProductsEl.textContent = lv(0);
    sumDeliveryEl.textContent = lv(0);
    sumGrossEl.textContent = lv(0);
    if (sumDiscountEl) sumDiscountEl.textContent = lv(0);

    productsTotalInput.value = '0.00';
    totalGrossInput.value = '0.00';
    discountTotalInput.value = '0.00';
    discountDetailsInput.value = '';
    document.getElementById('cart_payload').value = '[]';
    return;
  }

  let totalWithPromo = 0;     // ✅ BGN totals (за бекенда)
  CART_SUBTOTAL = 0;          // ✅ BGN “междинна” (оригинални)
  DISPLAY_SUBTOTAL_EUR = 0;   // ✅ EUR “междинна” (по показаните евро цени)

  const rows = entries.map(([productId, it]) => {
    const p   = it.product || {};
    const qty = Math.max(1, Number(it.qty) || 1);


    const name = p.name || '';
    const img  = p.img_url || '';
    const note = it.note || '';

    // ⚠️ тези стойности са BGN (както са в системата)
    const unitOriginalBGN = Number(p.originalPrice || p.price) || 0;
    const unitFinalBGN    = Number(p.finalPrice  || p.price) || 0;

const lineOriginalBGN = Math.round((unitOriginalBGN * qty) * 100) / 100;
const lineFinalBGN    = Math.round((unitFinalBGN    * qty) * 100) / 100;


    // ✅ бекенд totals (BGN)
    totalWithPromo += lineFinalBGN;
    CART_SUBTOTAL  += lineOriginalBGN;

    // ✅ EUR-only визуални стойности (по “показаните” евро цени)
const unitOriginalEUR = EURO_ONLY
  ? (Number(p.originalEuro) || eurFromBgn(unitOriginalBGN))
  : null;

const unitFinalEUR = EURO_ONLY
  ? (Number(p.finalEuro) || eurFromBgn(unitFinalBGN))
  : null;


    const lineOriginalEUR = EURO_ONLY ? (Math.round((unitOriginalEUR * qty) * 100) / 100) : null;
    const lineFinalEUR    = EURO_ONLY ? (Math.round((unitFinalEUR    * qty) * 100) / 100) : null;

    if (EURO_ONLY) {
      DISPLAY_SUBTOTAL_EUR += lineFinalEUR; // ✅ междинна = сбор на показаните редове
    }

let unitCellHTML;
if (unitFinalBGN !== unitOriginalBGN) {
  unitCellHTML =
    `<span class="old-price">${EURO_ONLY ? fmtEurNum(unitOriginalEUR) : lv(unitOriginalBGN)}</span>` +
    `<span class="new-price">${EURO_ONLY ? fmtEurNum(unitFinalEUR) : lv(unitFinalBGN)}</span>`;
} else {
  unitCellHTML = EURO_ONLY ? fmtEurNum(unitFinalEUR) : lv(unitFinalBGN);
}

let lineCellHTML;
if (lineFinalBGN !== lineOriginalBGN) {
  lineCellHTML =
    `<span class="old-price">${EURO_ONLY ? fmtEurNum(lineOriginalEUR) : lv(lineOriginalBGN)}</span>` +
    `<span class="new-price">${EURO_ONLY ? fmtEurNum(lineFinalEUR) : lv(lineFinalBGN)}</span>`;
} else {
  lineCellHTML = EURO_ONLY ? fmtEurNum(lineFinalEUR) : lv(lineFinalBGN);
}


const imgHTML = img
  ? `<div class="summary-thumb-wrap">
       <button type="button" class="remove-item-btn"
               title="Премахни продукт"
               data-remove-id="${escapeHTML(productId)}">✕</button>

       <img class="summary-thumb"
            src="${escapeHTML(img)}"
            alt="${escapeHTML(name)}">
     </div>`
  : `<div class="summary-thumb-wrap">
       <button type="button" class="remove-item-btn"
               title="Премахни продукт"
               data-remove-id="${escapeHTML(productId)}">✕</button>
     </div>`;


    const noteIndicator = note ? '<span class="note-indicator" title="Има бележка"></span>' : '';

    const mainRow = `
      <tr class="product-main-row">
        <td data-label="Продукт">
          <div class="summary-item">
            ${imgHTML}
            <div class="summary-text">
              <span class="product-name">
                ${escapeHTML(name)}
                ${noteIndicator}
              </span>
            </div>
          </div>
        </td>
        <td data-label="К-во">
<div class="qtyc">
  <button type="button" class="qtyc-btn" data-qty="inc" data-id="${escapeHTML(productId)}">+</button>
  <span class="qtyc-val">${qty}</span>
  <button type="button" class="qtyc-btn" data-qty="dec" data-id="${escapeHTML(productId)}">−</button>
</div>

</td>

        <td data-label="Ед. цена">${unitCellHTML}</td>
        <td data-label="Общо">${lineCellHTML}</td>
      </tr>`;

    const noteRow = `
      <tr class="product-note-row">
        <td colspan="4">
          <div class="product-note-block">
            <label>
              <input
                type="text"
                class="product-note-input"
                data-product-id="${escapeHTML(productId)}"
                value="${escapeHTML(note || '')}"
                placeholder="Бележка: пример - без сол, без люто и др."
              >
            </label>
            <div class="promo-code-actions">
              <button
                type="button"
                class="promo-btn secondary product-note-remove-btn"
                data-product-id="${escapeHTML(productId)}"
                style="${(note || '') ? '' : 'display:none;'}"
              >
                Премахни
              </button>
            </div>
          </div>
        </td>
      </tr>`;

    return mainRow + noteRow;
  }).join('');

  wrap.innerHTML = `
    <table class="summary-table">
      <thead>
        <tr>
          <th>Продукт</th>
          <th>К-во</th>
          <th>Ед. цена</th>
          <th>Общо</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  wrap.querySelectorAll('.remove-item-btn[data-remove-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-remove-id');
      removeCartItem(id);
    });
  });

  attachProductNoteInputs();
  // ✅ ТУК ГО СЛАГАШ (точно след attachProductNoteInputs)
wrap.querySelectorAll('button[data-qty][data-id]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const id = btn.getAttribute('data-id');
    const t  = btn.getAttribute('data-qty');
    if (t === 'inc') changeCartQty(id, +1);
    if (t === 'dec') changeCartQty(id, -1);
  });
});

  // ✅ Бекенд totals (в BGN)
  productsTotalInput.value = totalWithPromo.toFixed(2);

  updateCartPayloadHiddenFromStorage();
  recalcTotals();
}

// Прилагане на промоции
function applyPromotions(productsTotal, cartItems, payMethod){
  let discount = 0;
  let lines = [];

  let sumAfter = productsTotal;

  if (PROMO_DISCOUNT_CART_ENABLED && PROMO_DISCOUNT_CART_PERCENT > 0 && sumAfter > 0) {
    const d = sumAfter * (PROMO_DISCOUNT_CART_PERCENT / 100);
    discount += d;
    sumAfter -= d;
    lines.push(`-${lv(d)} (% отстъпка ${PROMO_DISCOUNT_CART_PERCENT}% върху количката)`);
  }

  if (PROMO_PAYMENT_REWARD_ENABLED && PROMO_PAYMENT_REWARD_PERCENT > 0 &&
      payMethod === PROMO_PAYMENT_REWARD_METHOD && sumAfter > 0) {
    const d = sumAfter * (PROMO_PAYMENT_REWARD_PERCENT / 100);
    discount += d;
    sumAfter -= d;
    lines.push(`-${lv(d)} (% отстъпка ${PROMO_PAYMENT_REWARD_PERCENT}% по начин на плащане)`);
  }

  if (sumAfter < 0) sumAfter = 0;

  return {
    productsAfter: sumAfter,
    discountTotal: discount,
    discountDetails: lines.join(' | ')
  };
}

// Прилагане на промо код
async function applyPromoCode(code){

  // нормализиране
  code = String(code || '').trim();

  const method = document.getElementById('ship_method')?.value || '';
  const msgEl = document.getElementById('promo-code-message');
  const hiddenInput = document.getElementById('promo_code');
  const promoInput = document.getElementById('promo-code-input');
  const applyBtn = document.getElementById('promo-apply-btn');
  const editBtn = document.getElementById('promo-edit-btn');

  // ✅ 1) Блокиране на код 10 при доставка
  if (code === '10' && method !== 'pickup') {
    appliedPromoCode = '';
    appliedPromoData = null;

    if (hiddenInput) hiddenInput.value = '';
    if (promoInput) {
      promoInput.value = '';
      promoInput.disabled = false;
    }

    if (msgEl) {
      msgEl.textContent = 'Промокод "10" е валиден само за взимане от място!';
      msgEl.style.color = '#dc2626';
    }

    if (applyBtn) {
      applyBtn.style.display = '';
      applyBtn.disabled = false;
    }
    if (editBtn) editBtn.style.display = 'none';

    localStorage.removeItem(STORAGE_PROMO_KEY);
    recalcTotals();
    return;
  }

  // ✅ 2) UI: проверка...
  if (msgEl) {
    msgEl.textContent = 'Проверка на кода...';
    msgEl.style.color = '#64748b';
  }
  if (applyBtn) applyBtn.disabled = true;

  try{
    const resp = await fetch(PROMO_CODE_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},
      body: 'code=' + encodeURIComponent(code)
    });

    const data = await resp.json();

    // ❌ неуспех
    if (!resp.ok || !data.ok) {
      appliedPromoCode = '';
      appliedPromoData = null;

      if (hiddenInput) hiddenInput.value = '';
      if (promoInput) {
        promoInput.value = '';
        promoInput.disabled = false;
      }

      if (msgEl) {
        msgEl.textContent = data.message || 'Невалиден промо код.';
        msgEl.style.color = '#dc2626';
      }

      if (applyBtn) {
        applyBtn.style.display = '';
        applyBtn.disabled = false;
      }
      if (editBtn) editBtn.style.display = 'none';

      localStorage.removeItem(STORAGE_PROMO_KEY);
      recalcTotals();
      return;
    }

    // ✅ успех
    appliedPromoCode = (data.code || code).trim();
    appliedPromoData = data;

    let typeText = '';
    if (data.code_type === 'single') {
      typeText = ' (еднократен)';
    } else if (data.code_type === 'multi') {
      const usage = data.usage_info || {};
      typeText = ` (многократен ${usage.current || 0}/${usage.max || '∞'})`;
    }

    if (hiddenInput) hiddenInput.value = appliedPromoCode;
    if (promoInput) {
      promoInput.value = appliedPromoCode;
      promoInput.disabled = true; // ✅ заключваме винаги (вкл. за 10)
    }

    if (msgEl) {
      msgEl.textContent = (data.message || 'Промо кодът е приложен успешно!') + typeText;
      msgEl.style.color = '#16a34a';
    }

    if (applyBtn) {
      applyBtn.style.display = 'none';
      applyBtn.disabled = false;
    }
    if (editBtn) editBtn.style.display = '';

    localStorage.setItem(STORAGE_PROMO_KEY, JSON.stringify({
      code: appliedPromoCode,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      code_type: data.code_type || 'single',
      usage_info: data.usage_info || {},
      message: data.message || 'Промо кодът е приложен.',
      timestamp: Date.now()
    }));

  } catch(e){
    console.error('Грешка при проверка на кода:', e);

    appliedPromoCode = '';
    appliedPromoData = null;

    if (hiddenInput) hiddenInput.value = '';
    if (promoInput) {
      promoInput.value = '';
      promoInput.disabled = false;
    }

    if (msgEl) {
      msgEl.textContent = 'Грешка при проверка на кода. Опитайте отново.';
      msgEl.style.color = '#dc2626';
    }

    if (applyBtn) {
      applyBtn.style.display = '';
      applyBtn.disabled = false;
    }
    if (editBtn) editBtn.style.display = 'none';

    localStorage.removeItem(STORAGE_PROMO_KEY);
  }

  recalcTotals();
}

function clearPromoCodeUI(){
  const promoInput = document.getElementById('promo-code-input');
  const applyBtn = document.getElementById('promo-apply-btn');
  const editBtn = document.getElementById('promo-edit-btn');
  const hiddenInput = document.getElementById('promo_code');
  const msgEl = document.getElementById('promo-code-message');

  appliedPromoCode = '';
  appliedPromoData = null;

  if (promoInput) {
    promoInput.value = '';
    promoInput.disabled = false;
  }
  if (hiddenInput) hiddenInput.value = '';
  if (msgEl) msgEl.textContent = '';

  if (applyBtn) {
    applyBtn.style.display = '';
    applyBtn.disabled = false;
  }
  if (editBtn) editBtn.style.display = 'none';

  localStorage.removeItem(STORAGE_PROMO_KEY);
  recalcTotals();
}


// Преизчисляване на суми
function recalcTotals(){
  const productsTotalInput = document.getElementById('products_total');
  const totalGrossInput = document.getElementById('total_gross');
  const sumProductsEl = document.getElementById('sum-products');
  const sumDeliveryEl = document.getElementById('sum-delivery');
  const sumGrossEl = document.getElementById('sum-gross');
  const sumDiscountEl = document.getElementById('sum-discount');
  const discountTotalInput = document.getElementById('discount_total');
  const discountDetailsInput = document.getElementById('discount_details');

  const method = document.getElementById('ship_method').value;
  const payMethod = document.querySelector('input[name="pay_method"]:checked')?.value || 'cash';


  const productsTotal = Number(productsTotalInput.value) || 0;

  let cartItems = [];
  const raw = localStorage.getItem(CART_KEY);
  try { cartItems = Object.values(JSON.parse(raw) || {}); } catch(_){ cartItems = []; }

  const promo = applyPromotions(productsTotal, cartItems, payMethod);

  let productsAfterPromoCode = promo.productsAfter;
  let promoCodeDiscount = 0;
  let promoCodeDetails = '';

  if (appliedPromoData && appliedPromoData.discount_value > 0) {
    const t = appliedPromoData.discount_type === 'fixed' ? 'fixed' : 'percent';
    const v = Number(appliedPromoData.discount_value) || 0;

    if (t === 'percent') {
      promoCodeDiscount = productsAfterPromoCode * (v / 100);
    } else {
      promoCodeDiscount = v;
    }

    if (promoCodeDiscount > 0) {
      productsAfterPromoCode -= promoCodeDiscount;
      if (productsAfterPromoCode < 0) productsAfterPromoCode = 0;
      promoCodeDetails = `-${lv(promoCodeDiscount)} (промо код ${appliedPromoCode})`;
    }
  }

  let delivery = 0;
  if (method === 'plovdiv_address' && productsAfterPromoCode > 0) {
    delivery = DELIVERY_FEE_BASE;

    if (PROMO_FREE_DELIVERY_ENABLED &&
        PROMO_FREE_DELIVERY_MIN_TOTAL > 0 &&
        productsAfterPromoCode >= PROMO_FREE_DELIVERY_MIN_TOTAL) {
      delivery = 0;
      const extra = 'Безплатна доставка по промоция';
      if (promo.discountDetails) {
        promo.discountDetails += ' | ' + extra;
      } else {
        promo.discountDetails = extra;
      }
    }
  }
  
  // Съобщение за безплатна доставка
  const freeDeliveryHintEl = document.getElementById('free-delivery-hint');
  const freeDeliveryRowEl = document.getElementById('free-delivery-row');

  if (PROMO_FREE_DELIVERY_ENABLED && PROMO_FREE_DELIVERY_MIN_TOTAL > 0 && method === 'plovdiv_address') {
    const min = Number(PROMO_FREE_DELIVERY_MIN_TOTAL);
    const current = productsAfterPromoCode;

    if (current >= min) {
      if (freeDeliveryHintEl && freeDeliveryRowEl) {
        freeDeliveryHintEl.textContent = `Ура! Вие получавате безплатна доставка по промоция за поръчки над ${lv(min)}!`;
        freeDeliveryHintEl.className = 'free-delivery-available';
        freeDeliveryRowEl.style.display = "flex";
      }
    } else {
      const diff = min - current;
      if (freeDeliveryHintEl && freeDeliveryRowEl) {
        freeDeliveryHintEl.textContent = `Добавете още ${lv(diff)} СТОЙНОСТ ОТ ПРОДУКТИ към поръчката, за да получите безплатна доставка за поръчки над ${lv(min)}!`;
        freeDeliveryHintEl.className = 'free-delivery-not-available';
        freeDeliveryRowEl.style.display = "flex";
      }
    }
  } else {
    if (freeDeliveryHintEl && freeDeliveryRowEl) {
      freeDeliveryHintEl.textContent = "";
      freeDeliveryRowEl.style.display = "none";
    }
  }

  const grand = productsAfterPromoCode + delivery;
// ✅ сума след всички отстъпки, БЕЗ доставка
const productsAfterDiscount = productsAfterPromoCode;

// записваме я за валидации (safe)
const pad = document.getElementById('products_after_discount');
if (pad) pad.value = productsAfterDiscount.toFixed(2);


  sumProductsEl.textContent = EURO_ONLY ? fmtEur(DISPLAY_SUBTOTAL_EUR) : lv(CART_SUBTOTAL);



const totalDiscount = promo.discountTotal + promoCodeDiscount;

if (EURO_ONLY) {
  // ✅ показваме всичко в EUR синхронизирано с редовете
  const deliveryEUR  = eurFromBgn(delivery);
  const discountEUR  = eurFromBgn(totalDiscount);

  sumDeliveryEl.textContent = fmtEur(deliveryEUR);
  if (sumDiscountEl) sumDiscountEl.textContent = fmtEur(discountEUR);

  // ✅ крайното EUR = евро междинна - евро отстъпки + евро доставка
  const grandEUR = Math.round((DISPLAY_SUBTOTAL_EUR - discountEUR + deliveryEUR) * 100) / 100;
  sumGrossEl.textContent = fmtEur(grandEUR);

} else {
  // BGN режим – както си беше
  sumDeliveryEl.textContent = lv(delivery);
  sumGrossEl.textContent = lv(grand);
  if (sumDiscountEl) sumDiscountEl.textContent = lv(totalDiscount);
}

  totalGrossInput.value = grand.toFixed(2);
  discountTotalInput.value = totalDiscount.toFixed(2);

  let details = promo.discountDetails || '';
  if (promoCodeDetails) {
    details = details ? details + ' | ' + promoCodeDetails : promoCodeDetails;
  }
  discountDetailsInput.value = details;

  const detailsEl = document.getElementById('sum-discount-details');
  if (detailsEl) {
    if (details.trim() !== '') {
detailsEl.innerHTML = details
  .split(' | ')
  .map((l, i) => `<div>${i + 1}. ${escapeHTML(l)}</div>`)
  .join('');
    } else {
      detailsEl.innerHTML = '<div>—</div>';
    }
  }
  
// 🔴 ПРОВЕРКА ЗА МИНИМАЛНА СУМА ЗА ДОСТАВКА
if (method === 'plovdiv_address') {
  checkMinOrderAmount(productsAfterDiscount, method);
} else {
  // при pickup винаги да е активен бутонът и да няма съобщение
  const submitBtn = document.getElementById('submit-btn');
  const minAmountMsg = document.getElementById('min-amount-message');
  if (submitBtn) submitBtn.disabled = false;
  if (minAmountMsg) minAmountMsg.style.display = 'none';
}
}
// Запомняме откъде е дошъл Email label, за да го върнем обратно
let EMAIL_ORIGINAL_PARENT = null;
let EMAIL_ORIGINAL_NEXT = null;

function moveEmailToDeliverySlot() {
  const emailLabel = document.getElementById('cust_email_label');
  const slot = document.getElementById('delivery_email_slot');
  if (!emailLabel || !slot) return;

  // запомняме оригиналната позиция само веднъж
  if (!EMAIL_ORIGINAL_PARENT) {
    EMAIL_ORIGINAL_PARENT = emailLabel.parentNode;
    EMAIL_ORIGINAL_NEXT = emailLabel.nextSibling; // може да е null
  }

  // местим го в delivery блока
  slot.innerHTML = '';
  slot.appendChild(emailLabel);

  // показваме го + гарантираме required
  emailLabel.style.display = '';
  const emailInput = document.getElementById('cust_email');
  if (emailInput) emailInput.required = true;
}


function returnEmailToOriginalPlace() {
  const emailLabel = document.getElementById('cust_email_label');
  if (!emailLabel || !EMAIL_ORIGINAL_PARENT) return;

  if (EMAIL_ORIGINAL_NEXT && EMAIL_ORIGINAL_NEXT.parentNode === EMAIL_ORIGINAL_PARENT) {
    EMAIL_ORIGINAL_PARENT.insertBefore(emailLabel, EMAIL_ORIGINAL_NEXT);
  } else {
    EMAIL_ORIGINAL_PARENT.appendChild(emailLabel);
  }
  emailLabel.style.display = '';
}

function toggleDelivery(){
  const method = document.getElementById('ship_method')?.value || '';

  // ✅ Бележката да е видима винаги (и при доставка, и при взимане)
  const noteFieldset = document.getElementById('order_note_fieldset');
  if (noteFieldset) noteFieldset.style.display = '';

  // ✅ ако pickup -> auto apply "10"
  if (method === 'pickup') {
    setTimeout(() => {
      const currentMethod = document.getElementById('ship_method')?.value || '';
      if (currentMethod === 'pickup' && appliedPromoCode !== '10') {
        applyPromoCode('10');
      }
    }, 100);
  }

  // ✅ ако delivery -> махаме "10"
  if (method === 'plovdiv_address') {
    if (appliedPromoCode === '10') {
      setTimeout(() => clearPromoCodeUI(), 100);
    }
  }

  const pickupInfo = document.getElementById('pickup_info');
  const plovdivBlock = document.getElementById('plovdiv_block');
  const customerDataSection = document.getElementById('customer_data_section');

  const recName = document.getElementById('rec_name');
  const recPhone = document.getElementById('rec_phone');
  const recAddress = document.getElementById('rec_address');

  const daySel = document.getElementById('rec_date_day');
  const monthSel = document.getElementById('rec_date_month');
  const yearSel = document.getElementById('rec_date_year');
  const hourSel = document.getElementById('rec_time_hour');
  const minuteSel = document.getElementById('rec_time_minute');

  const recDateHidden = document.getElementById('rec_date');
  const recTimeHidden = document.getElementById('rec_time');

  // Скриване на грешки при промяна
  ['rec_name_error','rec_phone_error','rec_address_error','rec_date_error','rec_time_error'].forEach(hideError);

  const emailEl = document.getElementById('cust_email');

  // 0) Няма избрано
  if(!method){
    if(pickupInfo) pickupInfo.style.display = 'none';
    if(plovdivBlock) plovdivBlock.style.display = 'none';

    returnEmailToOriginalPlace();

    if(customerDataSection) customerDataSection.style.display = '';

    ['cust_first_name','cust_last_name','cust_phone','cust_email'].forEach(id=>{
      const el = document.getElementById(id);
      if (el) el.required = true;
    });

    [recName, recPhone, recAddress].forEach(i=>{ if(i){ i.required = false; i.value=''; }});
    unlockDeliveryDate();
    [daySel, monthSel, yearSel, hourSel, minuteSel].forEach(s=>{ if(s){ s.required = false; s.value=''; }});

    if(recDateHidden) recDateHidden.value = '';
    if(recTimeHidden) recTimeHidden.value = '';

    syncDeliveryDateTime(); // ✅ важно: чисти hidden безопасно

    recalcTotals();
    return;
  }

  // 1) Вземане от място
  if(method === 'pickup'){
    if(pickupInfo) pickupInfo.style.display = '';
    if(plovdivBlock) plovdivBlock.style.display = 'none';

    returnEmailToOriginalPlace();

    if(customerDataSection) customerDataSection.style.display = '';

    ['cust_first_name','cust_last_name','cust_phone','cust_email'].forEach(id=>{
      const el = document.getElementById(id);
      if (el) el.required = true;
    });

    [recName, recPhone, recAddress].forEach(i=>{ if(i){ i.required = false; i.value=''; }});
    unlockDeliveryDate();
    [daySel, monthSel, yearSel, hourSel, minuteSel].forEach(s=>{ if(s){ s.required = false; s.value=''; }});

    if(recDateHidden) recDateHidden.value = '';
    if(recTimeHidden) recTimeHidden.value = '';

    syncDeliveryDateTime(); // ✅ важно: да не остане стара дата/час

    const freeDeliveryHintEl = document.getElementById('free-delivery-hint');
    const freeDeliveryRowEl  = document.getElementById('free-delivery-row');
    if (freeDeliveryHintEl) freeDeliveryHintEl.textContent = "";
    if (freeDeliveryRowEl) freeDeliveryRowEl.style.display = "none";

    const minAmountMsg = document.getElementById('min-amount-message');
    if (minAmountMsg) minAmountMsg.style.display = 'none';
  }

  // 2) Доставка до адрес
  if(method === 'plovdiv_address'){
    if(pickupInfo) pickupInfo.style.display = 'none';
    if(plovdivBlock) plovdivBlock.style.display = '';

    if(customerDataSection) customerDataSection.style.display = 'none';

    moveEmailToDeliverySlot();
    if (emailEl) emailEl.required = true;

    ['cust_first_name','cust_last_name','cust_phone'].forEach(id=>{
      const el = document.getElementById(id);
      if (el) el.required = false;
    });

    [recName, recPhone, recAddress].forEach(i=>{ if(i){ i.required = true; }});
    [daySel, monthSel, yearSel, hourSel, minuteSel].forEach(s=>{ if(s){ s.required = true; }});

   setTodayDeliveryDateAndLock();
   setEarliestTimeAndLock();
   autoUpdateLockedDeliveryTimeIfNeeded(false);

  }

  recalcTotals();
}



function togglePaymentHints(){
  const method = document.querySelector('input[name="pay_method"]:checked')?.value || 'cash';

  document.getElementById('bank_hint').style.display = (method === 'bank') ? '' : 'none';
  document.getElementById('cash_hint').style.display = (method === 'cash') ? '' : 'none';
  recalcTotals();
}

function ensureCartNotEmpty(e){
  const raw = localStorage.getItem(CART_KEY);
  let items = [];
  try{ items = Object.values(JSON.parse(raw) || {}); }catch(_){ items = []; }
  if(!items.length){
    e.preventDefault();
    alert('Количката е празна.');
    return false;
  }
  return true;
}

// Управление на дата и час
function getSelectedDateParts(){
  const daySel   = document.getElementById('rec_date_day');
  const monthSel = document.getElementById('rec_date_month');
  const yearSel  = document.getElementById('rec_date_year');
  if(!daySel || !monthSel || !yearSel) return null;

  const d = parseInt(daySel.value || '0', 10);
  const m = parseInt(monthSel.value || '0', 10);
  const y = parseInt(yearSel.value || '0', 10);
  if(!d || !m || !y) return null;

  return { d, m, y };
}

function isSameYMD(a, b){
  return a.y === b.y && a.m === b.m && a.d === b.d;
}

function rebuildDateOptions(preserveSelected){
  const daySel   = document.getElementById('rec_date_day');
  const monthSel = document.getElementById('rec_date_month');
  const yearSel  = document.getElementById('rec_date_year');
  if(!daySel || !monthSel || !yearSel) return;

  const now    = new Date();
  const thisY  = now.getFullYear();
  const thisM  = now.getMonth() + 1;
  const thisD  = now.getDate();

  let selY = parseInt(yearSel.value || thisY, 10);
  if (isNaN(selY)) selY = thisY;

  Array.from(monthSel.options).forEach(opt => {
    if (!opt.value) return;
    const m = parseInt(opt.value, 10);
    if (selY === thisY && m < thisM) {
      opt.disabled = true;
    } else {
      opt.disabled = false;
    }
  });

  let selM = parseInt(monthSel.value || thisM, 10);
  if (isNaN(selM)) selM = thisM;

  if (selY === thisY && selM < thisM) {
    selM = thisM;
    monthSel.value = pad2(selM);
  }

  const previousDay = preserveSelected ? daySel.value : '';

  daySel.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Ден';
  daySel.appendChild(placeholder);

  const maxDay = new Date(selY, selM, 0).getDate();
  let startDay = 1;
  if (selY === thisY && selM === thisM) {
    startDay = thisD;
  }

  for (let d = startDay; d <= maxDay; d++){
    const opt = document.createElement('option');
    opt.value = pad2(d);
    opt.textContent = pad2(d);
    daySel.appendChild(opt);
  }

  if (preserveSelected && previousDay) {
    const exists = Array.from(daySel.options).some(opt => opt.value === previousDay);
    if (exists) {
      daySel.value = previousDay;
    }
  }
}

function getEarliestTodaySlot() {
  const now = new Date();

  let hour   = now.getHours();
  let minute = now.getMinutes();

  minute += 60;
  hour   += Math.floor(minute / 60);
  minute  = minute % 60;

  const quarters = [0, 15, 30, 45];
  let rounded = quarters.find(q => q >= minute);
  if (rounded === undefined) {
    hour += 1;
    rounded = 0;
  }
  minute = rounded;

  if (hour < DELIVERY_START_HOUR) {
    hour = DELIVERY_START_HOUR;
    minute = 0;
  }
  if (hour > DELIVERY_END_HOUR) {
    return null;
  }

  return { h: hour, m: minute };
}

function rebuildTimeOptions(){
  const hourSel   = document.getElementById('rec_time_hour');
  const minuteSel = document.getElementById('rec_time_minute');
  if(!hourSel || !minuteSel) return;

  const parts = getSelectedDateParts();
  const now   = new Date();
  const todayParts = { d: now.getDate(), m: now.getMonth()+1, y: now.getFullYear() };
  const isToday = parts && isSameYMD(parts, todayParts);

  hourSel.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Час';
  hourSel.appendChild(placeholder);

  let earliest = null;
  if (isToday) {
    earliest = getEarliestTodaySlot();
    if (!earliest) {
      minuteSel.innerHTML = '<option value="">Минути</option>';
      return;
    }
  }

  for(let h = DELIVERY_START_HOUR; h <= DELIVERY_END_HOUR; h++){
    if (isToday && earliest && h < earliest.h) continue;

    const opt = document.createElement('option');
    opt.value = pad2(h);
    opt.textContent = pad2(h);
    hourSel.appendChild(opt);
  }

  rebuildMinuteOptions();
}

function autoUpdateLockedDeliveryTimeIfNeeded(showToast=false){
  const method = document.getElementById('ship_method')?.value || '';
  if (method !== 'plovdiv_address') return;

  const hourSel   = document.getElementById('rec_time_hour');
  const minuteSel = document.getElementById('rec_time_minute');
  if (!hourSel || !minuteSel) return;

  const earliest = getEarliestTodaySlot();
  if (!earliest) {
  showError('rec_time_error', 'За днес няма свободни часове за доставка.');
  return;
}


  const curH = parseInt(hourSel.value || '0', 10);
  const curM = parseInt(minuteSel.value || '0', 10);

  const earMinutes = earliest.h * 60 + earliest.m;
  const curMinutes = (curH && !isNaN(curM)) ? (curH * 60 + curM) : 0;

  // ✅ Ако няма избрано ИЛИ е по-рано от allowed -> сетваме earliest
  if (!curMinutes || curMinutes < earMinutes) {
    // гарантираме опциите да са актуални спрямо "сега"
    rebuildTimeOptions();

    hourSel.value = pad2(earliest.h);
    rebuildMinuteOptions();
    minuteSel.value = pad2(earliest.m);

    // държим заключено (щом си в lock режим)
    hourSel.disabled = true;
    minuteSel.disabled = true;

    syncDeliveryDateTime();
    hideError('rec_time_error');

    if (showToast) {
      // тук можеш да покажеш текст някъде, но НЕ alert
      // console.log('Delivery time auto-updated');
    }
  }
}



function rebuildMinuteOptions(){
  const hourSel   = document.getElementById('rec_time_hour');
  const minuteSel = document.getElementById('rec_time_minute');
  if(!hourSel || !minuteSel) return;

  const parts = getSelectedDateParts();
  const now   = new Date();
  const todayParts = { d: now.getDate(), m: now.getMonth()+1, y: now.getFullYear() };
  const isToday = parts && isSameYMD(parts, todayParts);

  minuteSel.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Минути';
  minuteSel.appendChild(placeholder);

  const selectedHour = parseInt(hourSel.value || '0', 10);
  const quarters = [0, 15, 30, 45];

  if (!selectedHour) {
    return;
  }

  let earliest = null;
  if (isToday) {
    earliest = getEarliestTodaySlot();
  }

  quarters.forEach(q => {
    if (isToday && earliest && selectedHour === earliest.h && q < earliest.m) {
      return;
    }
    const opt = document.createElement('option');
    opt.value = pad2(q);
    opt.textContent = pad2(q);
    minuteSel.appendChild(opt);
  });
}

function setTodayDeliveryDateAndLock() {
  const daySel   = document.getElementById('rec_date_day');
  const monthSel = document.getElementById('rec_date_month');
  const yearSel  = document.getElementById('rec_date_year');

  if (!daySel || !monthSel || !yearSel) return;

  const now = new Date();
  const d = pad2(now.getDate());
  const m = pad2(now.getMonth() + 1);
  const y = String(now.getFullYear());

  daySel.disabled   = false;
  monthSel.disabled = false;
  yearSel.disabled  = false;

  yearSel.value  = y;
  monthSel.value = m;

  rebuildDateOptions(false);
  daySel.value = d;

  daySel.disabled   = true;
  monthSel.disabled = true;
  yearSel.disabled  = true;

  const todayHint = document.getElementById('today_date_hint');
  if (todayHint) {
    todayHint.style.display = '';
    todayHint.textContent = `Доставките са възможни само за днешна дата: ${d}.${m}.${y}`;
  }

  rebuildTimeOptions();
}

function setEarliestTimeAndLock(){
  const hourSel   = document.getElementById('rec_time_hour');
  const minuteSel = document.getElementById('rec_time_minute');
  if (!hourSel || !minuteSel) return;

  const earliest = getEarliestTodaySlot();
  if (!earliest) {
    // няма слотове за днес (след края на работното време)
    hourSel.value = '';
    minuteSel.value = '';
    hourSel.disabled = true;
    minuteSel.disabled = true;
    syncDeliveryDateTime();
    return;
  }

  // гарантираме, че опциите са построени според earliest
  rebuildTimeOptions();

  hourSel.value = pad2(earliest.h);
  rebuildMinuteOptions();
  minuteSel.value = pad2(earliest.m);

  // заключваме
  hourSel.disabled = true;
  minuteSel.disabled = true;

  // sync към hidden полетата
  syncDeliveryDateTime();
}


function unlockDeliveryDate() {
  const daySel    = document.getElementById('rec_date_day');
  const monthSel  = document.getElementById('rec_date_month');
  const yearSel   = document.getElementById('rec_date_year');
  const hourSel   = document.getElementById('rec_time_hour');
  const minuteSel = document.getElementById('rec_time_minute');

  if (!daySel || !monthSel || !yearSel) return;

  daySel.disabled   = false;
  monthSel.disabled = false;
  yearSel.disabled  = false;

  if (hourSel)   hourSel.disabled   = false;   // ✅
  if (minuteSel) minuteSel.disabled = false;   // ✅

  const todayHint = document.getElementById('today_date_hint');
  if (todayHint) {
    todayHint.style.display = 'none';
    todayHint.textContent = '';
  }
}



function syncDeliveryDateTime(){
  const method = document.getElementById('ship_method').value;
  const recDateHidden = document.getElementById('rec_date');
  const recTimeHidden = document.getElementById('rec_time');
  
  const recNameInput = document.getElementById('rec_name');
  const custFirstName = document.getElementById('cust_first_name').value.trim();
  const custLastName = document.getElementById('cust_last_name').value.trim();
  
  if (recNameInput && method === 'plovdiv_address') {
    if (recNameInput.value === '' || recNameInput.value.split(' ').length < 2) {
      if (custFirstName && custLastName) {
        recNameInput.value = custFirstName + ' ' + custLastName;
        saveFormData();
        showSavedNotice('rec_name_saved');
      }
    }
  }

  if(method !== 'plovdiv_address'){
    if(recDateHidden) recDateHidden.value = '';
    if(recTimeHidden) recTimeHidden.value = '';
    return;
  }

  const daySel = document.getElementById('rec_date_day');
  const monthSel = document.getElementById('rec_date_month');
  const yearSel = document.getElementById('rec_date_year');
  const hourSel = document.getElementById('rec_time_hour');
  const minuteSel = document.getElementById('rec_time_minute');

  const d = daySel.value;
  const m = monthSel.value;
  const y = yearSel.value;
  const h = hourSel.value;
  const min = minuteSel.value;

  const hasDate = d && m && y;
  const hasTime = h && min;

  if(recDateHidden) recDateHidden.value = hasDate ? `${d}.${m}.${y}` : '';
  if(recTimeHidden) recTimeHidden.value = hasTime ? `${h}:${min}` : '';
}

function validateDeliveryDateTime(){
  const method = document.getElementById('ship_method').value;
  if (method !== 'plovdiv_address') return true;

  // 🔴 ДОБАВЕТЕ ТОВА: Проверка за формата на датата
  const recDateHidden = document.getElementById('rec_date');
  if (recDateHidden && recDateHidden.value) {
    // Проверка за формат дд.мм.гггг
    const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
    if (!dateRegex.test(recDateHidden.value)) {
      showError('rec_date_error', 'Невалиден формат на датата. Използвайте формат: дд.мм.гггг');
      return false;
    }
  }

  const daySel = document.getElementById('rec_date_day');
  const monthSel = document.getElementById('rec_date_month');
  const yearSel = document.getElementById('rec_date_year');
  const hourSel = document.getElementById('rec_time_hour');
  const minuteSel = document.getElementById('rec_time_minute');

  const d = parseInt(daySel.value || '0', 10);
  const m = parseInt(monthSel.value || '0', 10);
  const y = parseInt(yearSel.value || '0', 10);
  const h = parseInt(hourSel.value || '0', 10);
  const min = parseInt(minuteSel.value || '0', 10);

  if (!d || !m || !y || !h || isNaN(min)) {
    showError('rec_date_error', 'Моля, изберете валидна дата и час за доставка.');
    return false;
  }

  hideError('rec_date_error');

  if (h < DELIVERY_START_HOUR || h > DELIVERY_END_HOUR) {
    showError('rec_time_error', `Моля, изберете час за доставка между ${DELIVERY_RANGE_TEXT}.`);
    return false;
  }

  const now = new Date();
  const todayParts = { d: now.getDate(), m: now.getMonth()+1, y: now.getFullYear() };
  const selectedParts = { d, m, y };

if (isSameYMD(selectedParts, todayParts)) {
  const earliest = getEarliestTodaySlot();
  if (earliest) {
    if (h < earliest.h || (h === earliest.h && min < earliest.m)) {
      // ✅ вместо грешка – местим автоматично на най-ранния слот
      autoUpdateLockedDeliveryTimeIfNeeded(false);
      hideError('rec_time_error');
      return true;
    }
  }
}


  hideError('rec_time_error');
  return true;
}

// Валидация на формата
function validateForm() {
  // чистим всички грешки
  document.querySelectorAll('.error-message').forEach(el => {
    el.textContent = '';
    el.classList.remove('visible');
  });

  let isValid = true;

  // Helper за email
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(String(email || '').trim());
  }

  // Проверка за начин на доставка
  const shipMethod = document.getElementById('ship_method');
  if (!shipMethod || !shipMethod.value) {
    alert('Моля, изберете начин на получаване.');
    return false;
  }

  // Ако е избрана доставка до адрес
  if (shipMethod.value === 'plovdiv_address') {
    const recRequiredFields = [
      { id: 'rec_name',    error: 'rec_name_error',    message: 'Моля, попълнете името на получателя.' },
      { id: 'rec_phone',   error: 'rec_phone_error',   message: 'Моля, попълнете телефона на получателя.' },
      { id: 'cust_email',  error: 'email_error',       message: 'Моля, попълнете email.' }, // ✅ email и при доставка
      { id: 'rec_address', error: 'rec_address_error', message: 'Моля, попълнете адреса на получателя.' }
    ];

    recRequiredFields.forEach(field => {
      const input = document.getElementById(field.id);
      if (input && !input.value.trim()) {
        showError(field.error, field.message);
        isValid = false;
      }
    });

    // Валиден email (и при доставка)
    const email = document.getElementById('cust_email');
    if (email && email.value.trim() && !isValidEmail(email.value)) {
      showError('email_error', 'Моля, въведете валиден email адрес.');
      isValid = false;
    }

    // Проверка на дата и час за доставка
    if (!validateDeliveryDateTime()) {
      isValid = false;
    }

const productsAfterDiscount =
  Number(document.getElementById('products_after_discount')?.value) || 0;

// ако е 0, най-вероятно количката е празна (или още не е пресметнато)
// ensureCartNotEmpty вече го хваща, затова тук просто пропускаме
if (productsAfterDiscount > 0 && productsAfterDiscount < MIN_ORDER_AMOUNT_DELIVERY) {
  const diff = MIN_ORDER_AMOUNT_DELIVERY - productsAfterDiscount;

  alert(
    `Минималната сума за доставка е ${lv(MIN_ORDER_AMOUNT_DELIVERY)}. ` +
    `Добавете още ${lv(diff)} стойност от продукти след отстъпки.`
  );

  isValid = false;
}


  }
  // Ако е избрано взимане от място
  else if (shipMethod.value === 'pickup') {
    const requiredClientFields = [
      { id: 'cust_first_name', error: 'first_name_error', message: 'Моля, попълнете вашето име.' },
      { id: 'cust_last_name',  error: 'last_name_error',  message: 'Моля, попълнете вашата фамилия.' },
      { id: 'cust_phone',      error: 'phone_error',      message: 'Моля, попълнете вашия телефон.' },
      { id: 'cust_email',      error: 'email_error',      message: 'Моля, попълнете вашия email.' }
    ];

    requiredClientFields.forEach(field => {
      const input = document.getElementById(field.id);
      if (input && !input.value.trim()) {
        showError(field.error, field.message);
        isValid = false;
      }
    });

    // Валиден email (pickup)
    const email = document.getElementById('cust_email');
    if (email && email.value.trim() && !isValidEmail(email.value)) {
      showError('email_error', 'Моля, въведете валиден email адрес.');
      isValid = false;
    }
  }

  // Проверка за начин на плащане
  const payMethod = document.querySelector('input[name="pay_method"]:checked');
  if (!payMethod) {
    alert('Моля, изберете начин на плащане.');
    isValid = false;
  }

  if (!isValid) {
  scrollToFirstError();
}
return isValid;

}

// Инициализация
function initDateTimeSelectors(){
  const daySel = document.getElementById('rec_date_day');
  const monthSel = document.getElementById('rec_date_month');
  const yearSel = document.getElementById('rec_date_year');
  const hourSel = document.getElementById('rec_time_hour');
  const minuteSel = document.getElementById('rec_time_minute');

  if(!daySel || !monthSel || !yearSel || !hourSel || !minuteSel) return;

  const months = [
    '01 — януари','02 — февруари','03 — март','04 — април',
    '05 — май','06 — юни','07 — юли','08 — август',
    '09 — септември','10 — октомври','11 — ноември','12 — декември'
  ];
  months.forEach((label,idx)=>{
    const m = idx+1;
    const opt = document.createElement('option');
    opt.value = pad2(m);
    opt.textContent = label;
    monthSel.appendChild(opt);
  });

  const now = new Date();
  const thisYear = now.getFullYear();
  for(let y=thisYear; y<=thisYear+1; y++){
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = y;
    yearSel.appendChild(opt);
  }

  yearSel.value = String(thisYear);
  const thisMonth = now.getMonth() + 1;
  monthSel.value = pad2(thisMonth);

  rebuildDateOptions(false);

  daySel.value = '';
  hourSel.innerHTML = '<option value="">Час</option>';
  minuteSel.innerHTML = '<option value="">Минути</option>';
  minuteSel.value = '';

  yearSel.addEventListener('change', ()=>{
    rebuildDateOptions(true);
    rebuildTimeOptions();
  });
  monthSel.addEventListener('change', ()=>{
    rebuildDateOptions(true);
    rebuildTimeOptions();
  });
  daySel.addEventListener('change', ()=>{
    rebuildTimeOptions();
  });
  hourSel.addEventListener('change', ()=>{
    rebuildMinuteOptions();
  });

  rebuildTimeOptions();
}

document.addEventListener('DOMContentLoaded', ()=>{

  // ✅ Restore cart ако е било изчистено за BORICA, но потребителят се е върнал
  try {
    const cart = localStorage.getItem(CART_KEY);
    const backup = localStorage.getItem(CART_BACKUP_KEY);

const cartEmpty = !cart || cart === '{}' || cart === '[]';
const shouldRestore = sessionStorage.getItem('restore_cart_from_backup') === '1';

if (cartEmpty && backup && shouldRestore) {
  localStorage.setItem(CART_KEY, backup);
  sessionStorage.removeItem('restore_cart_from_backup'); // ✅ restore само веднъж
}

  } catch (e) {}

renderSummary();
initDateTimeSelectors();
loadFormData();
toggleDelivery();       // ✅ вече знае pickup / delivery
loadSavedPromoCode();
setupAutoSave();
togglePaymentHints();

setInterval(() => {
  autoUpdateLockedDeliveryTimeIfNeeded(false);
}, 30000);


  document.getElementById('saveNoteBtn').addEventListener('click', saveProductNote);
  document.getElementById('cancelNoteBtn').addEventListener('click', closeProductNoteModal);

  document.getElementById('productNoteModal').addEventListener('click', function(e) {
    if (e.target === this) {
      closeProductNoteModal();
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeProductNoteModal();
    }
  });

  document.getElementById('ship_method').addEventListener('change', function() {
    toggleDelivery();
    saveFormData();
  });
  
  document.querySelectorAll('input[name="pay_method"]').forEach(r=>{
    r.addEventListener('change', function() {
      togglePaymentHints();
      saveFormData();
    });
  });
  const promoInput = document.getElementById('promo-code-input');
  const applyBtn   = document.getElementById('promo-apply-btn');
  const editBtn    = document.getElementById('promo-edit-btn');

  if (applyBtn && promoInput && editBtn) {
    applyBtn.addEventListener('click', async () => {
      const code = promoInput.value.trim();
      if (!code) {
        clearPromoCodeUI();
        recalcTotals();
        return;
      }

      await applyPromoCode(code);
    });

    editBtn.addEventListener('click', () => {
      clearPromoCodeUI();
      promoInput.focus();
      promoInput.select();
    });
    
    promoInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyBtn.click();
      }
    });
  }
  
  const recNameField = document.getElementById('rec_name');
  const custFirstNameField = document.getElementById('cust_first_name');
  const custLastNameField = document.getElementById('cust_last_name');
  
  function autoFillRecName() {
    if (recNameField && !recNameField.value) {
      const firstName = custFirstNameField.value.trim();
      const lastName = custLastNameField.value.trim();
      if (firstName && lastName) {
        recNameField.value = firstName + ' ' + lastName;
        saveFormData();
        showSavedNotice('rec_name_saved');
      }
    }
  }
  
  if (custFirstNameField && custLastNameField) {
    custFirstNameField.addEventListener('blur', autoFillRecName);
    custLastNameField.addEventListener('blur', autoFillRecName);
  }

document.getElementById('checkout-form').addEventListener('submit', async (e) => {

  // 🔴 0) БЛОКИРАНЕ НА ПОРЪЧКИ СЛЕД 22:00
  const now = new Date();
  if (now.getHours() >= 22) {
    e.preventDefault();
    alert('Поръчки се приемат до 22:00 ч.');
    return;
  }

  // 🔴 1) Празна количка
  if (!ensureCartNotEmpty(e)) return;

  // 🔴 2) Синхронизация преди валидация
  updateCartPayloadHiddenFromStorage();
  syncDeliveryDateTime();
  recalcTotals();

  // 🔴 3) Валидация на формата
  if (!validateForm()) {
    e.preventDefault();
    return;
  }

  // 🔴 4) Взимаме метода на плащане САМО веднъж
  const payMethod =
    document.querySelector('input[name="pay_method"]:checked')?.value || 'cash';

  // 🔴 5) Ако е карта → backup на количката
  try {
    if (payMethod === 'bank') {
      const cart = localStorage.getItem(CART_KEY);
      if (cart) localStorage.setItem(CART_BACKUP_KEY, cart);
      sessionStorage.setItem('restore_cart_from_backup', '1');
      localStorage.removeItem(CART_KEY);
    }
  } catch (err) {
    console.warn('Soft clear cart failed:', err);
  }

  // 🔴 6) Disable бутон – САМО ВЕДНЪЖ
  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Изпращане...';
    submitBtn.classList.add('loading');
  }

  // 🔴 7) Чистим localStorage САМО ако не е карта
  try {
    if (payMethod !== 'bank') {
      localStorage.removeItem(FORM_DATA_KEY);
      localStorage.removeItem(STORAGE_PROMO_KEY);
    }
  } catch (e) {}
});





  
  const emailField = document.getElementById('cust_email');
  const phoneField = document.getElementById('cust_phone');
  
  if (emailField) {
    emailField.addEventListener('blur', () => {
      const email = emailField.value.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (email && !emailRegex.test(email)) {
        showError('email_error', 'Моля, въведете валиден email адрес.');
      } else {
        hideError('email_error');
      }
    });
  }
  
if (phoneField) {
  phoneField.addEventListener('blur', () => {
    const phone = phoneField.value.trim();
    const phoneRegex = /^[\d\s()+-]{10,}$/;
    if (phone && !phoneRegex.test(phone)) {
      showError('phone_error', 'Моля, въведете валиден телефонен номер.');
    } else {
      hideError('phone_error');
    }
  });
}

  
  window.addEventListener('beforeunload', function() {
    saveFormData();
  });
});
</script>

</body>
</html>
