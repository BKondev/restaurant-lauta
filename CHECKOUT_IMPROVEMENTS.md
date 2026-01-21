# Checkout Improvements Plan

## Промени които трябва да направя:

### 1. ✅ Премахни промо код от менюто
- Вече няма промо код в index.html

### 2. Номерирани стъпки с прогресивно показване
- Стъпка 1: Метод за доставка (Доставка / Вземи)
- Стъпка 2: Време за поръчка (Сега / По-късно с +/- бутони)
- Стъпка 3: Контактни данни (Име, Телефон, Email)
- Стъпка 4: Адрес (само ако е доставка) с Град/Село + Адрес
- Стъпка 5: Промо код (опционално)
- Стъпка 6: Преглед и поръчка

### 3. Отделни полета за град/село и адрес
```html
<select id="customer-city">
  <option>Пловдив</option>
  <option>Асеновград</option>
  <option>Стамболийски</option>
  <!-- etc -->
</select>
<input id="customer-address" placeholder="ул. Иванка Ботева 5">
```

### 4. Plus/Minus бутони за време
```html
<div class="time-picker">
  <button onclick="adjustTime(-15)">-</button>
  <span id="selected-time">11:00</span>
  <button onclick="adjustTime(15)">+</button>
</div>
```

### 5. Autocomplete за адреси
- Използвай Nominatim autocomplete API
- Показвай dropdown с предложения докато човек пише

###6. Geocoding с град + адрес
- `${city}, ${address}, Bulgaria`

## Файлове за промяна:
- `checkout.js` - Основна логика
- `checkout.html` - Може би допълнителни стилове
