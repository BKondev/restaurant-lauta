# 🚨 КРИТИЧНИ ПРАВИЛА ЗА AI АСИСТЕНТА - ВИНАГИ ЧЕТИ ПРЕДИ ПРОМЕНИ

## ⚠️ ПРОБЛЕМИ, КОИТО СЕ ПОВТАРЯТ ПОСТОЯННО

### 1. 🔴 КОДИРАНЕ НА ТЕКСТ (UTF-8) - МНОГО ВАЖНО!

**ПРОБЛЕМ:** Всички текстове на български (или други неанглийски езици) се показват като йероглифи/mojibake (например: `╨С╨░╤А╨▒╨╡╨║╤О` вместо `Барбекю`)

**ПРИЧИНА:** При записване на файлове (особено database.json) не се указва UTF-8 encoding

**РЕШЕНИЕ - ВИНАГИ:**
```javascript
// ✅ ПРАВИЛНО
fs.writeFileSync(filePath, content, 'utf8');
fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');

// ❌ ГРЕШНО
fs.writeFileSync(filePath, content);  // БЕЗ 'utf8'!
fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));  // БЕЗ 'utf8'!
```

**ВАЖНО:** 
- Всички HTML файлове ТРЯБВА да имат `<meta charset="UTF-8">` в head
- Всички JavaScript файлове трябва да се записват с UTF-8 encoding
- При четене също използвай: `fs.readFileSync(filePath, 'utf8')`

**ФАЙЛОВЕ, КЪДЕТО СЕ СРЕЩА ПРОБЛЕМЪТ:**
- ✅ `server.js` - функцията `writeDatabase()` - ДОБАВЕН 'utf8' параметър на ред 167
- ⚠️ Всякакви скриптове които записват в `database.json`
- ⚠️ Всякакви скриптове които генерират HTML/JS файлове с български текст

---

### 2. 📝 ВАЖНИ ФАЙЛОВЕ И ТЯХНОТО ПРЕДНАЗНАЧЕНИЕ

#### База данни:
- `database.json` - главна база данни (ресторанти, продукти, поръчки)
- ВИНАГИ записвай с UTF-8 encoding
- Използвай `writeDatabase()` функцията от server.js

#### Frontend файлове:
- `public/index.html` - главна страница
- `public/app.js` - логика за главната страница
- `public/checkout.html` - страница за поръчка
- `public/checkout.js` - логика за checkout
- `public/admin.html` - админ панел
- `public/admin.js` - логика за админ панела
- `public/styles.css` - стилове

#### Backend:
- `server.js` - Node.js сървър (Express)
- `delivery-integration.js` - интеграция с доставка
- `printer-service.js` - принтиране на поръчки

---

### 3. 🌐 MULTI-TENANT СИСТЕМА

Проектът поддържа множество ресторанти в една база данни:

```javascript
{
  "restaurants": [
    {
      "id": "rest_bojole_001",
      "name": "BOJOLE",
      "username": "lauta_admin",
      "password": "lauta123",
      "apiKey": "bojole_api_key_12345",
      // ...
    }
  ]
}
```

**НЕ ТРИЙ** съществуващите ресторанти!
**НЕ ПРОМЕНЯЙ** структурата на базата без нужда!

---

### 4. 🔄 ПРЕВОДИ (TRANSLATIONS)

Всеки продукт има `translations` обект:

```javascript
{
  "name": "Grilled Chicken Salad",  // ВИНАГИ на английски
  "translations": {
    "bg": {
      "name": "Салата с Пилешко на Скара",  // Превод на български
      "description": "...",
      "category": "Салати"
    }
  }
}
```

**ПРАВИЛА:**
- Основното име ВИНАГИ е на английски (`name`, `category`, `description`)
- Преводите са в `translations.bg.*`
- При показване използвай функцията `getTranslatedText()` от app.js

---

### 5. 💰 ЦЕНИ И ВАЛУТИ

Системата поддържа EUR и BGN:

```javascript
{
  "currencySettings": {
    "eurToBgnRate": 1.9558,  // Фиксиран курс EUR към BGN
    "showBgnPrices": true    // Показвай ли BGN цени
  }
}
```

**Цените в базата са ВИНАГИ в EUR**
**BGN цените се изчисляват динамично при показване**

---

### 6. 🖼️ ПРОМОЦИИ И ОТСТЪПКИ

```javascript
{
  "promo": {
    "enabled": true,
    "price": 5.99,      // Промо цена в EUR
    "type": "permanent" // или "temporary"
  }
}
```

---

### 7. 🚀 DEPLOYMENT - МНОГО ВАЖНО!

**⚠️ ВАЖНО: IP АДРЕСЪТ НА СЪРВЪРА Е 46.62.174.218 (ЗАПОЧВА С 4, НЕ СЪС 178!)**

**ВАЖНО: PM2 процесът се казва `restaurant-backend`, НЕ `resturant-website`!**

✅ **Единствен препоръчителен workflow:** GitHub → Server pull (без SCP)

- За единична инстанция: използвай `deploy-git.ps1`
- За всички инстанции под `/opt/resturant-website*`: използвай `deploy-git-all.ps1`

## ✅ DEPLOY (официално): GitHub → Server pull

**НЕ използвай директно SCP за deploy/update.** SCP води до проблеми с quoting/encoding и лесно оставя production в половин-обновено състояние.

Локално (Windows / PowerShell):

```powershell
cd C:\Users\User\Desktop\resturant-template
.\deploy-git.ps1 -RepoUrl "git@github.com:BKondev/restaurant-platform.git" -CommitMessage "deploy"
```

Ако имаш много инстанции на сървъра (multi-tenant directories като `/opt/resturant-website2`, `/opt/resturant-website3`), използвай:

```powershell
cd C:\Users\User\Desktop\resturant-template
.\deploy-git-all.ps1 -RepoUrl "git@github.com:BKondev/restaurant-platform.git" -CommitMessage "deploy all"
```

Какво прави:
- Commit + push към GitHub
- Сървърът прави `git fetch/reset --hard origin/main`
- Инсталира production dependencies
- Рестартира PM2 процеса `restaurant-backend`

**ЗА ЛОГИН НА СЪРВЪРА:**

```bash
ssh root@46.62.174.218
```

**В СЪРВЪРА - Провери PM2 процеси:**

```bash
pm2 list
pm2 restart restaurant-backend
pm2 logs restaurant-backend --lines 20
```

**ВАЖНО:**
- След всяка промяна в код, дай тези команди на потребителя
- Потребителят ще ги изпълни сам - гарантира правилно UTF-8 кодиране
- НЕ използвай SCP/FTP за deploy/update - само Git!
- Винаги рестартирай PM2 след промени

**Локално тестване преди deploy:**
```bash
npm install
npm start
# Тествай на http://localhost:3003/resturant-website/
```

#### ✅ Препоръчителен workflow (GitHub → Server pull)

За да избегнем SCP/PowerShell quoting проблеми: **deploy = commit+push → server git pull**.

Локално:
```powershell
cd C:\Users\User\Desktop\resturant-template
.\deploy-git.ps1 -RepoUrl "<YOUR_GITHUB_REPO_URL>" -CommitMessage "deploy"
```

На сървъра (еднократно, ако repo е private):
- Създай deploy key: `ssh-keygen -t ed25519 -C "deploy@crystalautomation"`
- Добави public ключа като **Deploy Key** в GitHub repo (read-only)
- Използвай SSH URL: `git@github.com:OWNER/REPO.git`

Важно:
- `database.json` е в `.gitignore` (production data НЕ се комитва). Server си пази собствената база.

---

### 7.1 🧨 PowerShell капани (команди, които ЧЕСТО се чупят)

Това са реални проблеми, които се появяват при изпълнение през PowerShell / VS Code терминал.
**AI трябва да избягва тези форми** и да използва безопасните алтернативи.

#### ❌ НЕ използвай: `$(date ...)` вътре в двойни кавички в PowerShell

PowerShell интерпретира `$(...)` като subexpression (НЕ Linux `date`), което чупи команди като:

```powershell
# ❌ ЧУПИ СЕ (PowerShell се опитва да изпълни date като Get-Date параметър)
ssh root@46.62.174.218 "cp /opt/resturant-website/database.json /opt/resturant-website/database.json.bak.$(date +%Y%m%d-%H%M%S)"
```

✅ Използвай едно от следните:

```powershell
# ✅ Вариант A: генерирай timestamp ЛОКАЛНО в PowerShell
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
ssh root@46.62.174.218 "cp /opt/resturant-website/database.json /opt/resturant-website/database.json.bak.$ts"

# ✅ Вариант B: накарай remote Bash да изчисли date
ssh root@46.62.174.218 "bash -lc 'cp /opt/resturant-website/database.json /opt/resturant-website/database.json.bak.$(date +%Y%m%d-%H%M%S)'"
```

#### ❌ НЕ използвай JavaScript regex literal `/.../` вътре в сложни quoting команди

Когато се комбинират `ssh "node -e \".../regex/...\""` PowerShell лесно чупи quoting-а и започва да парсва `/` като оператор.

✅ Използвай `.includes()` вместо regex:

```powershell
ssh root@46.62.174.218 "node -e \"const fs=require('fs'); const s=fs.readFileSync('/opt/resturant-website/database.json','utf8'); const bad=['╨','╤','Ð','Ñ','в‚¬','Р»РІ']; console.log('mojibake:', bad.some(t=>s.includes(t)));\""
```

#### ℹ️ Забележка за UTF-8 BOM

При PowerShell `Out-File -Encoding utf8` често добавя UTF-8 BOM. Това вече е ОК, защото `fix-checkout.py` е обновен да чете JSON с `utf-8-sig`.

---

### 8. 🎨 CUSTOMIZATION

Всеки ресторант има customization settings:

```javascript
{
  "customization": {
    "topBarColor": "#2c3e50",
    "backgroundColor": "#f5f5f5",
    "backgroundImage": "",
    "highlightColor": "#e74c3c",
    "priceColor": "#e74c3c"
  }
}
```

---

## 📋 CHECKLIST ПРЕДИ ВСЯКА ПРОМЯНА

- [ ] Чети този файл преди да правиш промени
- [ ] При промяна в server.js - провери UTF-8 encoding
- [ ] При промяна в database.json - използвай writeDatabase() с 'utf8'
- [ ] При създаване на нови HTML файлове - добави `<meta charset="UTF-8">`
- [ ] При работа с база данни - не променяй структурата без консултация
- [ ] При промяна в API - провери multi-tenant authentication
- [ ] При deploy - провери BASE_PATH настройките
- [ ] След промяна - рестартирай сървъра и тествай

---

## 🔍 ЧЕСТО СРЕЩАНИ ГРЕШКИ

### Грешка: "Йероглифи вместо български текст"
**Решение:** Добави 'utf8' при `fs.writeFileSync()`

### Грешка: "Cannot find module"
**Решение:** `npm install` в проектната директория

### Грешка: "Port already in use"
**Решение:** `pm2 stop resturant-website` или промени PORT в server.js

### Грешка: "Unauthorized" в API
**Решение:** Провери token/API key в headers

---

## 🎯 ОСНОВНИ ПРИНЦИПИ

1. **НЕ СЧУПВАЙ РАБОТЕЩИЯ КОД** - Ако нещо работи, не го променяй без причина
2. **UTF-8 ВИНАГИ** - Всички файлове трябва да са UTF-8
3. **ТЕСТВАЙ ПРЕДИ DEPLOY** - Винаги тествай локално преди да качиш на production
4. **ЗАПАЗВАЙ BACKUP** - Преди големи промени направи backup на database.json
5. **ЧЕТЙ ТОЗИ ФАЙЛ** - Винаги прочитай този файл преди да започнеш работа

---

**ПОСЛЕДНА АКТУАЛИЗАЦИЯ:** 20 Януари 2026

**ПРОБЛЕМ:** Йероглифи в целия сайт (български текст се показва като mojibake)  
**РЕШЕНИЕ:** 
1. Добавен 'utf8' параметър в `writeDatabase()` функцията в server.js на ред 167
2. Заменени счупените app.js и checkout.js с чисти UTF-8 версии

**ПРИЧИНА:** 
- ❌ Опит за автоматичен рестарт на сървъра (НЕ ТРЯБВА ДА СЕ ПРАВИ!)
- ❌ Използван грешен PM2 процес име `resturant-website` вместо `restaurant-backend`
- Функцията `fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2))` **НЕ ИЗПОЛЗВАШЕ** 'utf8' encoding при записване на database.json файла
- На сървъра app.js и checkout.js бяха с грешно кодиране в `translations` обектите

**ПРОМЕНЕНИ ФАЙЛОВЕ:**
- ✅ `server.js` - ред 167 - добавен 'utf8' параметър във `writeDatabase()`
- ✅ `public/app.js` - заменен с app_utf8.js (чиста версия)
- ✅ `public/checkout.js` - заменен с checkout_utf8.js (чиста версия)

**ГРЕШКИ НАПРАВЕНИ ОТ AI:**
- ❌ Използван грешен IP адрес 178.128.199.94 вместо 46.62.174.218
- ❌ Използван SCP/частичен deploy (води до half-updated production и encoding проблеми)
- ❌ Гледани локални файлове вместо да се провери какво е на сървъра
- ❌ Добавяне на `&& pm2 logs` след рестарт команда (НЕ ТРЯБВА!)
- ❌ Използван грешен PM2 процес име `resturant-website` вместо `restaurant-backend`

---

## 📞 ВАЖНИ ЗАБЕЛЕЖКИ

- Този файл е създаден след **122-ри път поправяне на същия проблем**
- **ВИНАГИ** чети този файл преди да започнеш работа
- **НИКОГА** не пренебрегвай UTF-8 encoding
- **ВИНАГИ** тествай с български текст преди deploy

---

*Този файл е създаден да предотврати повторение на често срещани грешки. Моля, актуализирай го при откриване на нови проблеми.*
