# BOJOLE Restaurant - Delivery & Printing Integration

## 📋 Обща информация

Системата автоматично изпраща потвърдени поръчки с доставка към delivery service и принтира поръчките на мрежов принтер.

---

## 🚚 Delivery Integration

### API Endpoint
```
https://karakashkov.com/delivery/api.php?path=/orders
```

### Как работи?

При потвърждаване на поръчка (`status: confirmed`) със статус доставка (`deliveryMethod: delivery`):

1. **Автоматично изпращане** - Поръчката се изпраща към delivery API
2. **Данни** - Адрес, телефон, цена, име на ресторант
3. **Tracking ID** - Получаваме `deliveryServiceId` и `clientId` които се записват в поръчката

### Структура на данните

```json
{
  "client_id": "RMJCQPVS0",      // 10 символа уникален ID
  "restaurant_id": "10",          // ID на ресторанта (BOJOLE)
  "restaurant_name": "BOJOLE",
  "restaurant_zone": "1",         // Зона
  "address": "улица Радост 6",
  "phone": "0899123456",
  "notes": "Бележки от клиента",
  "price": "7.0",                 // Цена на доставката
  "submitted_at": 1766140946,     // Unix timestamp
  "status": "queued"              // Начален статус
}
```

### Настройки

Можете да промените в `delivery-integration.js`:

```javascript
const RESTAURANT_ID = '10';     // ID на вашия ресторант
const RESTAURANT_ZONE = '1';    // Зона на ресторанта
```

### API Endpoints

#### Проверка на статус
```
GET /resturant-website/api/delivery/status/:deliveryId
Authorization: Bearer <admin-token>
```

---

## 🖨️ Printer Integration

### Как работи?

1. **Автоматично намиране** - Системата сканира локалната мрежа (192.168.x.x) за принтери
2. **Порт 9100** - Търси ESC/POS принтери на стандартния порт
3. **Автоматично принтиране** - При потвърждаване на поръчка (`confirmed`)

### Поддържани принтери

- ✅ ESC/POS мрежови принтери
- ✅ Thermal printers (80mm)
- ✅ Epson TM серия
- ✅ Star Micronics
- ✅ Други ESC/POS съвместими

### Какво се принтира?

```
================================
         BOJOLE
================================
Поръчка #123
Дата: 19.12.2025 12:30
--------------------------------
КЛИЕНТ:
Име: Иван Иванов
Тел: 0899123456
ДОСТАВКА:
Адрес: ул. Радост 6
Град: Пловдив
================================
ПРОДУКТИ:
--------------------------------
2x Pizza Margherita
   12.50 лв x 2 = 25.00 лв
1x Coca-Cola
   2.50 лв x 1 = 2.50 лв
================================
         ОБЩО: 27.50 лв
================================

БЕЛЕЖКИ:
Без лук моля

      Благодарим Ви!
       www.bojole.bg
```

### Admin Endpoints

#### Намиране на принтери
```
GET /resturant-website/api/printer/find
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "printers": [
    {
      "ip": "192.168.0.100",
      "port": 9100,
      "name": "Network Printer at 192.168.0.100"
    }
  ],
  "count": 1
}
```

#### Тестване на принтер
```
GET /resturant-website/api/printer/test
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "printers": [...],
  "tested": "192.168.0.100"
}
```

#### Принтиране на конкретна поръчка
```
POST /resturant-website/api/printer/print/:orderId
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "printerIp": "192.168.0.100"  // Optional - ако не е подаден, автоматично намира
}

Response:
{
  "success": true,
  "printer": "192.168.0.100"
}
```

---

## 🔧 Инсталация на принтер

### Windows

1. Свържете принтера в същата мрежа
2. Уверете се че принтерът има статичен IP (напр. 192.168.0.100)
3. Отворете порт 9100 във firewall-а на принтера

### Linux/Ubuntu Server

```bash
# Проверка на мрежата
nmap -p 9100 192.168.0.0/24

# Тестване на връзка
telnet 192.168.0.100 9100
```

### Настройка на принтера

1. **IP Address** - Задайте статичен IP от роутера или принтера
2. **Port** - Трябва да е 9100 (Raw TCP/IP)
3. **Protocol** - ESC/POS или RAW

---

## 📱 Мобилно приложение

Мобилното приложение автоматично:
- ✅ Изпраща push notification при нова поръчка
- ✅ Показва име, телефон, адрес на клиента
- ✅ Бутон "Обади се" - отваря телефона
- ✅ Бутон "Потвърди" - потвърждава поръчката
- ✅ При потвърждаване → Изпраща към delivery service + Принтира

---

## 🛠️ Troubleshooting

### Delivery Service

**Problem:** Не изпраща към delivery API

**Решение:**
```bash
# Провери логовете на сървъра
ssh root@46.62.174.218
journalctl -u restaurant.service -f

# Търси грешки като:
# "Error sending to delivery service"
```

**Problem:** Получавам грешка 401/403

**Решение:**
- Уверете се че имате правилни credentials за delivery API
- Проверете дали API endpoint-ът е достъпен

### Принтер

**Problem:** Не намира принтер

**Решение:**
```bash
# От сървъра, тествай връзка:
telnet 192.168.0.100 9100

# Ако не работи:
# 1. Провери IP адреса на принтера
# 2. Провери firewall настройките
# 3. Уверете се че принтерът е в същата мрежа
```

**Problem:** Принтерът принтира празни страници

**Решение:**
- Уверете се че принтерът поддържа ESC/POS
- Опитайте с друг принтер

**Problem:** Текстът е разбъркан

**Решение:**
- Проверете encoding настройките на принтера
- Опитайте да смените Character Set на принтера на UTF-8

---

## 📦 Файлове

- `delivery-integration.js` - Интеграция с delivery service
- `printer-service.js` - Принтиране на поръчки
- `server.js` - Основен сървър с endpoints

---

## 🔐 Сигурност

- ✅ Всички admin endpoints изискват authentication
- ✅ Delivery API използва HTTPS
- ✅ Принтерите са достъпни само в локалната мрежа

---

## 📞 Поддръжка

При проблеми:
1. Проверете логовете: `journalctl -u restaurant.service -f`
2. Рестартирайте сървъра: `systemctl restart restaurant`
3. Тествайте принтера: `GET /api/printer/test`
4. Проверете delivery статус: `GET /api/delivery/status/:id`

---

**Дата на създаване:** 19.12.2025  
**Версия:** 1.0  
**Автор:** GitHub Copilot
