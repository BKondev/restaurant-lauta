// API Configuration
const BASE_PATH = window.location.pathname.includes('/resturant-website') ? '/resturant-website' : '';
const API_URL = `${BASE_PATH}/api`;

// State
let cart = [];
let appliedPromo = null;
let currentLanguage = localStorage.getItem('language') || 'en';
let deliveryMethod = ''; // '' empty by default, 'delivery' or 'pickup'
let orderTime = ''; // '' empty by default, 'now' or 'later'
let scheduledTime = '';
let selectedTimeSlot = '';
let paymentMethod = 'cash'; // 'cash' or 'card'
let currentStep = 1; // Track current checkout step
let customerInfo = {
    name: '',
    phone: '',
    email: '',
    city: '', // Empty by default - user must select
    address: '',
    notes: ''
};
let deliverySettings = {
    freeDeliveryEnabled: false,
    freeDeliveryAmount: 50,
    deliveryFee: 5,
    cityPrices: {} // Object with city names as keys and delivery fees as values
};
let currencySettings = {
    eurToBgnRate: 1.9558,
    showBgnPrices: true
};
let orderSettings = {
    minimumOrderAmount: 0
};
let workingHours = {
    openingTime: '09:00',
    closingTime: '22:00'
};

// List of available cities for delivery
const availableCities = [
    'Пловдив',
    'Асеновград',
    'Стамболийски',
    'Раковски',
    'Куклен',
    'Марица',
    'Съединение',
    'Карлово',
    'Хисаря',
    'Брезово',
    'Първомай',
    'Садово',
    'Други'
];

// Format price with BGN and EUR
function formatPrice(priceEUR) {
    const priceBGN = (priceEUR * currencySettings.eurToBgnRate).toFixed(2);
    
    if (currencySettings.showBgnPrices) {
        return `${priceBGN} лв / €${priceEUR.toFixed(2)}`;
    } else {
        return `€${priceEUR.toFixed(2)}`;
    }
}

// Translations
const translations = {
    en: {
        back: 'Back to Menu',
        checkout: 'Checkout',
        cartTitle: 'Cart',
        cartItems: 'Cart Items',
        applyPromo: 'Apply Promo Code',
        promoPlaceholder: 'Enter promo code',
        promoSuccess: 'Promo code applied successfully!',
        promoError: 'Invalid or expired promo code',
        removePromo: 'Remove promo code',
        subtotal: 'Amount',
        discount: 'Discount',
        total: 'Total',
        placeOrder: 'Place Order',
        emptyCart: 'Your cart is empty',
        emptyCartMsg: 'Add some delicious items to get started!',
        continueShopping: 'Continue Shopping',
        orderSuccess: 'Order placed successfully! We will contact you shortly.',
        orderError: 'Failed to place order. Please try again.',
        remove: 'Remove',
        deliveryMethod: 'Delivery Method',
        delivery: 'Delivery',
        pickup: 'Pickup',
        deliveryDesc: 'Deliver to your address',
        pickupDesc: 'Pick up from restaurant',
        customerInfo: 'Customer Information',
        fullName: 'Name and Surname',
        phone: 'Phone Number',
        email: 'Email Address',
        address: 'Delivery Address',
        notes: 'Order Notes',
        notesPlaceholder: 'Any special requests or instructions...',
        required: 'Required',
        fillAllFields: 'Please fill in all required fields',
        deliveryFee: 'Delivery Fee',
        freeDelivery: 'Free Delivery!',
        orderTime: 'Order Time',
        orderNow: 'Order Now',
        orderLater: 'Order Later',
        orderNowDesc: 'Receive as soon as possible',
        orderLaterDesc: 'Choose a specific time',
        selectTime: 'Select Time',
        timeRequired: 'Please select a time at least 1 hour from now',
        paymentMethod: 'Payment Method',
        cash: 'Cash',
        card: 'Card',
        cashDesc: 'Pay with cash',
        cardDesc: 'Pay with card',
        orderDelivery: 'Order with Delivery',
        orderPickup: 'Order and Pickup',
        deliveryTime: 'Delivery Time'
    },
    bg: {
        back: 'Назад към Менюто',
        checkout: 'Поръчка',
        cartTitle: 'Количка',
        cartItems: 'Артикули в Количката',
        applyPromo: 'Приложи Промо Код',
        promoPlaceholder: 'Въведете промо код',
        promoSuccess: 'Промо кодът е приложен успешно!',
        promoError: 'Невалиден или изтекъл промо код',
        removePromo: 'Премахни промо код',
        subtotal: 'Сума',
        discount: 'Отстъпка',
        total: 'Общо',
        placeOrder: 'Направи Поръчка',
        emptyCart: 'Вашата количка е празна',
        emptyCartMsg: 'Добавете вкусни артикули, за да започнете!',
        continueShopping: 'Продължи Пазаруването',
        orderSuccess: 'Поръчката е направена успешно! Ще се свържем с вас скоро.',
        orderError: 'Неуспешно поставяне на поръчка. Моля, опитайте отново.',
        remove: 'Премахни',
        deliveryMethod: 'Метод на Доставка',
        delivery: 'Доставка',
        pickup: 'Взимане',
        deliveryDesc: 'Доставка до вашия адрес',
        pickupDesc: 'Взимане от ресторанта',
        customerInfo: 'Информация за Клиента',
        fullName: 'Име и Фамилия',
        phone: 'Телефонен Номер',
        email: 'Имейл Адрес',
        address: 'Адрес за Доставка',
        notes: 'Бележки към Поръчката',
        notesPlaceholder: 'Специални искания или инструкции...',
        required: 'Задължително',
        fillAllFields: 'Моля, попълнете всички задължителни полета',
        deliveryFee: 'Такса Доставка',
        freeDelivery: 'Безплатна Доставка!',
        orderTime: 'Време на Поръчката',
        orderNow: 'Поръчай Сега',
        orderLater: 'Насрочи Поръчка',
        orderNowDesc: 'Получи възможно най-скоро',
        orderLaterDesc: 'Избери конкретен час',
        selectTime: 'Избери Час',
        timeRequired: 'Моля, изберете час поне 1 час от сега',
        paymentMethod: 'Метод на Плащане',
        cash: 'В Брой',
        card: 'С Карта',
        cashDesc: 'Плащане в брой',
        cardDesc: 'Плащане с карта',
        orderDelivery: 'Поръчай с Доставка',
        orderPickup: 'Поръчай и Вземи',
        deliveryTime: 'Време на доставка'
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Fix navigation links
    document.querySelectorAll('a[href="../"]').forEach(link => {
        link.href = BASE_PATH + '/';
    });
    await loadRestaurantInfo();
    await loadDeliverySettings();
    await loadOrderSettings();
    await loadWorkingHours();
    loadCart();
    await syncCartFromServerIfNeeded();
    setupLanguageSwitcher();
    updateLanguage();
    renderCheckout();
});

function isLikelyMojibake(text) {
    if (!text || typeof text !== 'string') return false;

    // Common mojibake markers we have seen in this project.
    const badTokens = ['╨', '╤', 'Ð', 'Ñ', 'тХ', 'ТХ', '\uFFFD'];
    return badTokens.some(t => text.includes(t));
}

function cartHasMojibake() {
    return cart.some(item =>
        isLikelyMojibake(item?.name) ||
        isLikelyMojibake(item?.category) ||
        isLikelyMojibake(item?.translations?.bg?.name) ||
        isLikelyMojibake(item?.translations?.bg?.category)
    );
}

async function syncCartFromServerIfNeeded() {
    // Cart is stored in localStorage; if it was saved while the DB/UI was mojibake,
    // the checkout will still show broken names even after DB is fixed.
    if (!cart || cart.length === 0) return;
    if (!cartHasMojibake()) return;

    try {
        const productsResponse = await fetch(`${API_URL}/products`);
        if (!productsResponse.ok) return;
        const products = await productsResponse.json();

        const byId = new Map();
        (products || []).forEach(p => {
            if (p && (p.id !== undefined && p.id !== null)) {
                byId.set(String(p.id), p);
            }
        });

        let changed = false;
        cart = cart.map(item => {
            const product = byId.get(String(item?.id));
            if (!product) return item;

            // Preserve checkout-specific state
            const quantity = item.quantity;
            const note = item.note;

            changed = true;
            return {
                ...product,
                quantity,
                note
            };
        });

        if (changed) {
            saveCart();
        }
    } catch (error) {
        console.error('Error syncing cart from server:', error);
    }
}

// Load restaurant info
async function loadRestaurantInfo() {
    try {
        // Load settings (name and logo)
        const settingsResponse = await fetch(`${API_URL}/settings`);
        const settings = await settingsResponse.json();
        
        document.getElementById('restaurant-name').textContent = settings.name;
        
        if (settings.logo) {
            const logo = document.getElementById('header-logo');
            logo.src = `${BASE_PATH}${settings.logo}`;
            logo.classList.add('visible');
        }

        // Load customization
        const customResponse = await fetch(`${API_URL}/settings/customization`);
        const customization = await customResponse.json();
        
        if (customization) {
            document.documentElement.style.setProperty('--top-bar-color', customization.topBarColor);
            document.documentElement.style.setProperty('--background-color', customization.backgroundColor);
            document.documentElement.style.setProperty('--highlight-color', customization.highlightColor);
            document.documentElement.style.setProperty('--price-color', customization.priceColor);
        }
    } catch (error) {
        console.error('Error loading restaurant info:', error);
    }
}

// Load delivery settings
async function loadDeliverySettings() {
    try {
        const response = await fetch(`${API_URL}/settings/delivery`);
        if (response.ok) {
            deliverySettings = await response.json();
        }
    } catch (error) {
        console.error('Error loading delivery settings:', error);
    }
}

// Load order settings
async function loadOrderSettings() {
    try {
        const response = await fetch(`${API_URL}/settings/order`);
        if (response.ok) {
            orderSettings = await response.json();
        }
    } catch (error) {
        console.error('Error loading order settings:', error);
    }
}

// Load working hours
async function loadWorkingHours() {
    try {
        const response = await fetch(`${API_URL}/settings/working-hours`);
        if (response.ok) {
            workingHours = await response.json();
        }
    } catch (error) {
        console.error('Error loading working hours:', error);
    }
}

// Load cart from localStorage
function loadCart() {
    const savedCart = localStorage.getItem('cart');
    cart = savedCart ? JSON.parse(savedCart) : [];
}

// Save cart to localStorage
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Language switcher
function setupLanguageSwitcher() {
    const langBtns = document.querySelectorAll('.lang-btn');
    langBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            langBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentLanguage = btn.dataset.lang;
            localStorage.setItem('language', currentLanguage);
            updateLanguage();
            renderCheckout();
        });

        if (btn.dataset.lang === currentLanguage) {
            btn.classList.add('active');
        }
    });
}

// Update language
function updateLanguage() {
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        if (translations[currentLanguage][key]) {
            if (element.tagName === 'INPUT') {
                element.placeholder = translations[currentLanguage][key];
            } else {
                element.textContent = translations[currentLanguage][key];
            }
        }
    });
}

// Render checkout page
function renderCheckout() {
    const cartContent = document.getElementById('cart-content');
    const emptyCart = document.getElementById('empty-cart');

    if (cart.length === 0) {
        cartContent.innerHTML = '';
        emptyCart.style.display = 'block';
        return;
    }

    emptyCart.style.display = 'none';

    const cartSection = document.createElement('div');
    cartSection.className = 'cart-section';
    
    const cartTotals = calculateTotals();
    
    cartSection.innerHTML = `
        <h2 class="section-title" data-translate="cartItems">${translations[currentLanguage].cartItems}</h2>
        <div class="cart-items" id="cart-items"></div>
        <div class="cart-subtotal">
            <span data-translate="subtotal">${translations[currentLanguage].subtotal}</span>
            <span class="subtotal-amount">${formatPrice(cartTotals.subtotal)}</span>
        </div>
    `;

    const deliverySection = document.createElement('div');
    deliverySection.className = 'delivery-options';
    deliverySection.innerHTML = `
        <h2 class="section-title"><span class="step-number-badge">1</span> ${currentLanguage === 'bg' ? 'Метод за доставка' : 'Delivery Method'}</h2>
        <div class="delivery-method">
            <label class="delivery-option ${deliveryMethod === 'delivery' ? 'active' : ''}" onclick="selectDeliveryMethod('delivery')">
                <input type="radio" name="delivery" value="delivery" ${deliveryMethod === 'delivery' ? 'checked' : ''}>
                <div class="delivery-option-icon"><i class="fas fa-truck"></i></div>
                <div class="delivery-option-title">${currentLanguage === 'bg' ? 'Доставка' : 'Delivery'}</div>
                <div class="delivery-option-desc">${currentLanguage === 'bg' ? 'Директно до вас' : 'Directly to you'}</div>
            </label>
            <label class="delivery-option ${deliveryMethod === 'pickup' ? 'active' : ''}" onclick="selectDeliveryMethod('pickup')">
                <input type="radio" name="delivery" value="pickup" ${deliveryMethod === 'pickup' ? 'checked' : ''}>
                <div class="delivery-option-icon"><i class="fas fa-shopping-bag"></i></div>
                <div class="delivery-option-title">${currentLanguage === 'bg' ? 'Вземи' : 'Pickup'}</div>
                <div class="delivery-option-desc">${currentLanguage === 'bg' ? 'От ресторанта' : 'From restaurant'}</div>
            </label>
        </div>
        <div id="order-time-section" class="checkout-step" style="display: none;">
        <h2 class="section-title" style="margin-top: 30px;"><span class="step-number-badge">2</span> ${currentLanguage === 'bg' ? 'Време за поръчката' : 'Order Time'}</h2>
        <div class="delivery-method">
            <label class="delivery-option ${orderTime === 'now' ? 'active' : ''}" onclick="selectOrderTime('now')">
                <input type="radio" name="orderTime" value="now" ${orderTime === 'now' ? 'checked' : ''}>
                <div class="delivery-option-icon"><i class="fas fa-bolt"></i></div>
                <div class="delivery-option-title">${currentLanguage === 'bg' ? 'Сега' : 'Now'}</div>
                <div class="delivery-option-desc">${currentLanguage === 'bg' ? 'Възможно най-скоро' : 'As soon as possible'}</div>
            </label>
            <label class="delivery-option ${orderTime === 'later' ? 'active' : ''}" onclick="selectOrderTime('later')">
                <input type="radio" name="orderTime" value="later" ${orderTime === 'later' ? 'checked' : ''}>
                <div class="delivery-option-icon"><i class="fas fa-clock"></i></div>
                <div class="delivery-option-title">${currentLanguage === 'bg' ? 'По-късно' : 'Later'}</div>
                <div class="delivery-option-desc">${currentLanguage === 'bg' ? 'Изберете час' : 'Choose time'}</div>
            </label>
        </div>
        <div id="time-picker-section" style="display: ${orderTime === 'later' ? 'block' : 'none'}; margin-top: 20px;">
            <div class="form-group">
                <label>
                    <span>${currentLanguage === 'bg' ? 'Изберете час' : 'Select time'}</span>
                    <span class="required">*</span>
                </label>
                <div class="time-picker-controls">
                    <button type="button" class="time-adjust-btn" onclick="adjustTime(-15)">
                        <i class="fas fa-minus"></i>
                    </button>
                    <div class="time-display" id="selected-time-display">
                        ${selectedTimeSlot || '11:00'}
                    </div>
                    <button type="button" class="time-adjust-btn" onclick="adjustTime(15)">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                <div class="time-info" style="text-align: center; margin-top: 10px; font-size: 14px; color: #666;">
                    ${currentLanguage === 'bg' ? 'Интервали от 15 минути' : '15-minute intervals'}
                </div>
            </div>
        </div>
        </div>
        <div id="payment-customer-section" class="checkout-step" style="display: none;">
        ${deliveryMethod === 'pickup' ? `
        <h2 class="section-title" data-translate="paymentMethod" style="margin-top: 30px;"><span class="step-number-badge">3</span> ${translations[currentLanguage].paymentMethod}</h2>
        <div class="delivery-method">
            <label class="delivery-option ${paymentMethod === 'cash' ? 'active' : ''}" onclick="selectPaymentMethod('cash')">
                <input type="radio" name="payment" value="cash" ${paymentMethod === 'cash' ? 'checked' : ''}>
                <div class="delivery-option-icon"><i class="fas fa-money-bill-wave"></i></div>
                <div class="delivery-option-title" data-translate="cash">${translations[currentLanguage].cash}</div>
                <div class="delivery-option-desc" data-translate="cashDesc">${translations[currentLanguage].cashDesc}</div>
            </label>
            <label class="delivery-option ${paymentMethod === 'card' ? 'active' : ''}" onclick="selectPaymentMethod('card')">
                <input type="radio" name="payment" value="card" ${paymentMethod === 'card' ? 'checked' : ''}>
                <div class="delivery-option-icon"><i class="fas fa-credit-card"></i></div>
                <div class="delivery-option-title" data-translate="card">${translations[currentLanguage].card}</div>
                <div class="delivery-option-desc" data-translate="cardDesc">${translations[currentLanguage].cardDesc}</div>
            </label>
        </div>
        ` : ''}
        <h3 class="section-title" data-translate="customerInfo" style="margin-top: 30px;">${translations[currentLanguage].customerInfo}</h3>
        <form class="customer-form" id="customer-form">
            <div class="form-row">
                <div class="form-group">
                    <label for="customer-name">
                        <span data-translate="fullName">${translations[currentLanguage].fullName}</span>
                        <span class="required">*</span>
                    </label>
                    <input type="text" id="customer-name" value="${customerInfo.name}" required>
                </div>
                <div class="form-group">
                    <label for="customer-phone">
                        <span data-translate="phone">${translations[currentLanguage].phone}</span>
                        <span class="required">*</span>
                    </label>
                    <input type="tel" id="customer-phone" value="${customerInfo.phone}" required>
                </div>
            </div>
            <div class="form-group">
                <label for="customer-email">
                    <span data-translate="email">${translations[currentLanguage].email}</span>
                    <span class="required">*</span>
                </label>
                <input type="email" id="customer-email" value="${customerInfo.email}" required>
            </div>
            <div class="form-group ${deliveryMethod === 'delivery' ? 'show' : ''}" id="address-field">
                <label for="customer-city">
                    <span>${currentLanguage === 'bg' ? 'Град / Село' : 'City / Village'}</span>
                    <span class="required">*</span>
                </label>
                <select id="customer-city" ${deliveryMethod === 'delivery' ? 'required' : ''} onchange="onCityChange()">
                    <option value="">${currentLanguage === 'bg' ? 'Изберете град...' : 'Select city...'}</option>
                    ${availableCities.map(city => `<option value="${city}" ${customerInfo.city === city ? 'selected' : ''}>${city}</option>`).join('')}
                </select>
            </div>
            <div class="form-group ${deliveryMethod === 'delivery' ? 'show' : ''}" id="address-street-field">
                <label for="customer-address">
                    <span>${currentLanguage === 'bg' ? 'Адрес за доставка' : 'Delivery Address'}</span>
                    <span class="required">*</span>
                </label>
                <input type="text" id="customer-address" value="${customerInfo.address}" ${deliveryMethod === 'delivery' ? 'required' : ''} placeholder="${currentLanguage === 'bg' ? 'напр. ул. Иван Вазов 15' : 'e.g. Ivan Vazov str. 15'}">
            </div>
            <div class="form-group">
                <label for="customer-notes">
                    <span data-translate="notes">${translations[currentLanguage].notes}</span>
                </label>
                <textarea id="customer-notes" placeholder="${translations[currentLanguage].notesPlaceholder}" data-translate="notesPlaceholder">${customerInfo.notes}</textarea>
            </div>
        </form>
        </div>
    `;

    const promoSection = document.createElement('div');
    promoSection.className = 'cart-section promo-section';
    promoSection.innerHTML = `
        <h3 class="section-title">${currentLanguage === 'bg' ? 'Промо код' : 'Promo code'}</h3>
        <div class="promo-input-group">
            <input type="text" class="promo-input" id="promo-code-input" placeholder="${currentLanguage === 'bg' ? 'Въведи промо код' : 'Enter promo code'}" ${appliedPromo ? 'disabled' : ''}>
            <button class="apply-promo-btn" onclick="applyPromoCode()" ${appliedPromo ? 'disabled' : ''}>${currentLanguage === 'bg' ? 'Приложи' : 'Apply'}</button>
        </div>
        <div class="promo-message" id="promo-message"></div>
        ${appliedPromo ? `<button class="remove-promo-btn" onclick="removePromoCode()">${currentLanguage === 'bg' ? 'Премахни' : 'Remove'}</button>` : ''}
    `;

    const summarySection = document.createElement('div');
    summarySection.className = 'summary-section';
    
    const { subtotal, discount, deliveryFee, freeDeliveryApplied, total } = calculateTotals();

    summarySection.innerHTML = `
        <h2 class="section-title">Order Summary</h2>
        <div class="summary-row subtotal">
            <span data-translate="subtotal">${translations[currentLanguage].subtotal}</span>
            <span>${formatPrice(subtotal)}</span>
        </div>
        ${discount > 0 ? `
        <div class="summary-row promo">
            <span data-translate="discount">${translations[currentLanguage].discount} (${appliedPromo.code})</span>
            <span>-${formatPrice(discount)}</span>
        </div>
        ` : ''}
        ${deliveryMethod === 'delivery' ? `
        <div class="summary-row ${freeDeliveryApplied ? 'promo' : ''}">
            <span data-translate="deliveryFee">${freeDeliveryApplied ? translations[currentLanguage].freeDelivery : translations[currentLanguage].deliveryFee}</span>
            <span>${freeDeliveryApplied ? formatPrice(0) : formatPrice(deliveryFee)}</span>
        </div>
        ` : ''}
        <div class="summary-row total">
            <span data-translate="total">${translations[currentLanguage].total}</span>
            <span>${formatPrice(total)}</span>
        </div>
        ${orderSettings.minimumOrderAmount > 0 && total < orderSettings.minimumOrderAmount ? `
        <div class="order-warning">
            <i class="fas fa-exclamation-triangle"></i>
            ${currentLanguage === 'bg' ? 'Минимална сума за поръчка' : 'Minimum order amount'}: ${formatPrice(orderSettings.minimumOrderAmount)}
            <br>
            ${currentLanguage === 'bg' ? 'Текуща сума' : 'Current amount'}: ${formatPrice(total)}
        </div>
        ` : ''}
        <button class="checkout-btn" onclick="placeOrder()" ${orderSettings.minimumOrderAmount > 0 && total < orderSettings.minimumOrderAmount ? 'disabled' : ''}>
            ${deliveryMethod === 'delivery' 
                ? (currentLanguage === 'bg' ? 'Поръчай с Доставка' : 'Order with Delivery')
                : (currentLanguage === 'bg' ? 'Поръчай и Вземи' : 'Order and Pickup')}
        </button>
    `;

    cartContent.innerHTML = '';
    cartContent.appendChild(cartSection);
    cartContent.appendChild(deliverySection);
    cartContent.appendChild(promoSection);
    cartContent.appendChild(summarySection);

    renderCartItems();
    setupFormListeners();
    initializeTimePicker();
}

// Initialize time picker with default time
function initializeTimePicker() {
    if (orderTime === 'later' && !selectedTimeSlot) {
        // Set default time to 1 hour from now, rounded to next 15 min
        const now = new Date();
        const minTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
        
        // Round to nearest 15 min
        minTime.setMinutes(Math.ceil(minTime.getMinutes() / 15) * 15);
        minTime.setSeconds(0);
        
        // Ensure delivery starts from 11:00
        if (deliveryMethod === 'delivery' && minTime.getHours() < 11) {
            minTime.setHours(11, 0, 0, 0);
        }
        
        const hours = String(minTime.getHours()).padStart(2, '0');
        const minutes = String(minTime.getMinutes()).padStart(2, '0');
        selectedTimeSlot = `${hours}:${minutes}`;
        
        updateTimeDisplay();
    }
}

// Adjust time by minutes (В±15)
function adjustTime(minutes) {
    if (!selectedTimeSlot) {
        initializeTimePicker();
        return;
    }
    
    const [hours, mins] = selectedTimeSlot.split(':').map(Number);
    let currentTime = new Date();
    currentTime.setHours(hours, mins, 0, 0);
    
    // Add/subtract 15 minutes
    currentTime.setMinutes(currentTime.getMinutes() + minutes);
    
    // Get constraints
    const minHour = deliveryMethod === 'delivery' ? 11 : parseInt(workingHours.openingTime.split(':')[0]);
    const maxHour = deliveryMethod === 'delivery' ? 22 : parseInt(workingHours.closingTime.split(':')[0]);
    const maxMinute = deliveryMethod === 'delivery' ? 0 : parseInt(workingHours.closingTime.split(':')[1]);
    
    // Check if within bounds
    const newHours = currentTime.getHours();
    const newMins = currentTime.getMinutes();
    
    if (newHours < minHour) {
        currentTime.setHours(minHour, 0, 0, 0);
    } else if (newHours > maxHour || (newHours === maxHour && newMins > maxMinute)) {
        currentTime.setHours(maxHour, maxMinute, 0, 0);
    }
    
    // Also check minimum time (1 hour from now)
    const now = new Date();
    const minTime = new Date(now.getTime() + 60 * 60 * 1000);
    minTime.setMinutes(Math.ceil(minTime.getMinutes() / 15) * 15);
    
    if (currentTime < minTime) {
        currentTime = minTime;
    }
    
    const finalHours = String(currentTime.getHours()).padStart(2, '0');
    const finalMins = String(currentTime.getMinutes()).padStart(2, '0');
    selectedTimeSlot = `${finalHours}:${finalMins}`;
    
    updateTimeDisplay();
}

// Update time display
function updateTimeDisplay() {
    const display = document.getElementById('selected-time-display');
    if (display) {
        display.textContent = selectedTimeSlot || '11:00';
    }
}

// Select order time (now or later)
function selectOrderTime(time) {
    orderTime = time;
    const timePickerSection = document.getElementById('time-picker-section');
    
    if (time === 'later') {
        timePickerSection.style.display = 'block';
        initializeTimePicker();
    } else {
        timePickerSection.style.display = 'none';
        scheduledTime = '';
        selectedTimeSlot = '';
    }
    
    renderCheckout();
}

// Navigate to next step
function nextStep() {
    // Validation for each step
    if (currentStep === 3) {
        const name = document.getElementById('customer-name')?.value;
        const phone = document.getElementById('customer-phone')?.value;
        const email = document.getElementById('customer-email')?.value;
        
        if (!name || !phone || !email) {
            alert(currentLanguage === 'bg' ? 'Моля, попълнете всички полета' : 'Please fill all fields');
            return;
        }
    }
    
    if (currentStep === 4 && deliveryMethod === 'delivery') {
        const city = document.getElementById('customer-city')?.value;
        const address = document.getElementById('customer-address')?.value;
        
        if (!city || !address) {
            alert(currentLanguage === 'bg' ? 'Моля, попълнете адреса' : 'Please fill the address');
            return;
        }
    }
    
    currentStep++;
    renderCheckout();
    scrollToTop();
}

// Skip promo step
function skipPromo() {
    currentStep = 999; // Mark as completed
    renderCheckout();
    scrollToTop();
}

// Toggle step visibility
function toggleStep(step) {
    if (step < currentStep) {
        currentStep = step;
        renderCheckout();
        scrollToTop();
    }
}

// Scroll to top
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Render cart items
function renderCartItems() {
    const cartItemsContainer = document.getElementById('cart-items');
    cartItemsContainer.innerHTML = '';

    cart.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'cart-item';
        
        const displayName = currentLanguage === 'bg' && item.translations?.bg?.name 
            ? item.translations.bg.name 
            : item.name;
        
        const displayCategory = currentLanguage === 'bg' && item.translations?.bg?.category 
            ? item.translations.bg.category 
            : item.category;

        const itemTotal = item.price * item.quantity;

        itemElement.innerHTML = `
            <div class="cart-item-row">
                <div class="cart-item-image-wrap">
                    <img src="${item.image.startsWith('http') ? item.image : BASE_PATH + item.image}" alt="${displayName}" class="cart-item-image" onerror="this.style.display='none'">
                    ${item.weight ? `<span class="cart-item-weight cart-item-weight-overlay">${item.weight}</span>` : ''}
                </div>
                <div class="cart-item-name">${displayName}</div>
                <div class="cart-item-price">
                    <span>${formatPrice(itemTotal)}</span>
                </div>
                <div class="cart-item-controls">
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="updateQuantity(${item.id}, -1)" ${item.quantity <= 1 ? 'disabled' : ''}>-</button>
                        <span class="quantity-display">${item.quantity}</span>
                        <button class="quantity-btn" onclick="updateQuantity(${item.id}, 1)">+</button>
                    </div>
                </div>
                <button class="remove-btn" onclick="removeItem(${item.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <textarea 
                class="item-notes-input" 
                placeholder="${currentLanguage === 'bg' ? 'Бележка (без сол, без люто и т.н.)' : 'Note (no salt, no spicy, etc.)'}"
                oninput="updateItemNote(${item.id}, this.value)"
                rows="1"
            >${item.note || ''}</textarea>
        `;

        cartItemsContainer.appendChild(itemElement);
    });
}

// Update quantity
function updateQuantity(productId, change) {
    const item = cart.find(i => i.id === productId);
    if (item) {
        item.quantity = Math.max(1, item.quantity + change);
        saveCart();
        renderCheckout();
    }
}

// Update item note
function updateItemNote(productId, note) {
    const item = cart.find(i => i.id === productId);
    if (item) {
        item.note = note;
        saveCart();
    }
}

// Remove item
function removeItem(productId) {
    cart = cart.filter(i => i.id !== productId);
    saveCart();
    renderCheckout();
}

// Calculate totals
function calculateTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let discount = 0;
    
    if (appliedPromo) {
        discount = subtotal * (appliedPromo.discount / 100);
    }
    
    // Calculate delivery fee
    let deliveryFee = 0;
    let freeDeliveryApplied = false;
    
    if (deliveryMethod === 'delivery') {
        if (deliverySettings.freeDeliveryEnabled && subtotal >= deliverySettings.freeDeliveryAmount) {
            deliveryFee = 0;
            freeDeliveryApplied = true;
        } else {
            deliveryFee = deliverySettings.deliveryFee || 5;
        }
    }
    
    const total = subtotal - discount + deliveryFee;
    
    return { subtotal, discount, deliveryFee, freeDeliveryApplied, total };
}

// Apply promo code
async function applyPromoCode() {
    const input = document.getElementById('promo-code-input');
    const code = input.value.trim().toUpperCase();
    const message = document.getElementById('promo-message');

    if (!code) {
        message.textContent = 'Please enter a promo code';
        message.className = 'promo-message error';
        return;
    }

    // Get all unique categories in cart
    const categories = [...new Set(cart.map(item => item.category))];

    try {
        // Validate promo code for each category in cart
        let validPromo = null;
        
        for (const category of categories) {
            const response = await fetch(`${API_URL}/promo-codes/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code, category })
            });

            const data = await response.json();

            if (data.valid) {
                validPromo = data;
                break;
            }
        }

        if (validPromo) {
            appliedPromo = {
                code: code,
                discount: validPromo.discount,
                category: validPromo.category
            };
            message.textContent = translations[currentLanguage].promoSuccess;
            message.className = 'promo-message success';
            input.disabled = true;
            renderCheckout();
        } else {
            message.textContent = translations[currentLanguage].promoError;
            message.className = 'promo-message error';
        }
    } catch (error) {
        console.error('Error applying promo code:', error);
        message.textContent = translations[currentLanguage].promoError;
        message.className = 'promo-message error';
    }
}

// Remove promo code
function removePromoCode() {
    appliedPromo = null;
    const input = document.getElementById('promo-code-input');
    if (input) {
        input.value = '';
        input.disabled = false;
    }
    const message = document.getElementById('promo-message');
    if (message) {
        message.className = 'promo-message';
        message.textContent = '';
    }
    renderCheckout();
}

// Place order
async function placeOrder() {
    // Validate customer info
    const name = document.getElementById('customer-name').value.trim();
    const phone = document.getElementById('customer-phone').value.trim();
    const email = document.getElementById('customer-email').value.trim();
    const address = deliveryMethod === 'delivery' ? document.getElementById('customer-address').value.trim() : '';
    const notes = document.getElementById('customer-notes').value.trim();

    if (!name || !phone || !email || (deliveryMethod === 'delivery' && !address)) {
        alert(translations[currentLanguage].fillAllFields);
        return;
    }

    // Save customer info
    customerInfo = { name, phone, email, address, notes };

    const { total, deliveryFee } = calculateTotals();
    
    // Prepare order data
    const orderData = {
        items: cart,
        promoCode: appliedPromo ? appliedPromo.code : null,
        discount: appliedPromo ? appliedPromo.discount : 0,
        deliveryFee: deliveryMethod === 'delivery' ? deliveryFee : 0,
        total: total,
        deliveryMethod: deliveryMethod,
        customerInfo: customerInfo,
        timestamp: new Date().toISOString(),
        status: 'pending'
    };

    try {
        // Send order to backend
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            throw new Error('Failed to place order');
        }

        const result = await response.json();
        console.log('Order placed:', result);

        // Clear cart and show success message
        cart = [];
        appliedPromo = null;
        customerInfo = { name: '', phone: '', email: '', address: '', notes: '' };
        saveCart();

        // Show success notification
        alert(translations[currentLanguage].orderSuccess);

        // Redirect to menu
        window.location.href = BASE_PATH + '/';
    } catch (error) {
        console.error('Error placing order:', error);
        alert(translations[currentLanguage].orderError);
    }
}

// Select delivery method
function selectDeliveryMethod(method) {
    deliveryMethod = method;
    
    // Handle address fields visibility
    const addressField = document.getElementById('address-field');
    const addressStreetField = document.getElementById('address-street-field');
    const addressInput = document.getElementById('customer-address');
    
    if (method === 'delivery') {
        if (addressField) addressField.classList.add('show');
        if (addressStreetField) addressStreetField.classList.add('show');
        if (addressInput) addressInput.required = true;
        paymentMethod = 'cash'; // Delivery only supports cash
    } else {
        if (addressField) addressField.classList.remove('show');
        if (addressStreetField) addressStreetField.classList.remove('show');
        if (addressInput) addressInput.required = false;
    }
    
    // Update active state on buttons (first set of delivery options)
    const deliveryOptions = document.querySelectorAll('.delivery-method .delivery-option');
    deliveryOptions.forEach((opt, index) => {
        if (index < 2) { // Only first 2 are delivery method options
            opt.classList.remove('active');
            const input = opt.querySelector('input');
            if (input && input.value === method) {
                opt.classList.add('active');
            }
        }
    });
    
    // Show order time section with animation
    const orderTimeSection = document.getElementById('order-time-section');
    if (orderTimeSection) {
        orderTimeSection.style.display = 'block';
        // Remove any previous animation class
        orderTimeSection.classList.remove('slide-in');
        // Trigger reflow
        void orderTimeSection.offsetWidth;
        // Add animation class
        setTimeout(() => {
            orderTimeSection.classList.add('slide-in');
            // Scroll to the section smoothly
            orderTimeSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
    }
}

// Select order time
function selectOrderTime(time) {
    orderTime = time;
    
    // Update active state on order time buttons
    const orderTimeOptions = document.querySelectorAll('#order-time-section .delivery-option');
    orderTimeOptions.forEach(opt => {
        opt.classList.remove('active');
        const input = opt.querySelector('input');
        if (input && input.value === time) {
            opt.classList.add('active');
        }
    });
    
    const timePickerSection = document.getElementById('time-picker-section');
    if (timePickerSection) {
        if (time === 'later') {
            timePickerSection.style.display = 'block';
            timePickerSection.classList.remove('slide-in');
            void timePickerSection.offsetWidth;
            setTimeout(() => {
                timePickerSection.classList.add('slide-in');
            }, 50);
            // Initialize time picker
            if (!selectedTimeSlot) {
                initializeTimePicker();
            }
        } else {
            timePickerSection.style.display = 'none';
            timePickerSection.classList.remove('slide-in');
        }
    }
    
    // Show payment/customer section with animation
    const paymentCustomerSection = document.getElementById('payment-customer-section');
    if (paymentCustomerSection) {
        paymentCustomerSection.style.display = 'block';
        paymentCustomerSection.classList.remove('slide-in');
        void paymentCustomerSection.offsetWidth;
        setTimeout(() => {
            paymentCustomerSection.classList.add('slide-in');
            // Scroll to the section smoothly
            paymentCustomerSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
    }
}

// Select payment method
function selectPaymentMethod(method) {
    paymentMethod = method;
    renderCheckout();
}

// Update delivery fee when city is selected
function onCityChange() {
    const cityInput = document.getElementById('customer-city');
    if (cityInput) {
        customerInfo.city = cityInput.value;
        calculateDeliveryFee();
    }
}

// Setup form listeners
function setupFormListeners() {
    const nameInput = document.getElementById('customer-name');
    const phoneInput = document.getElementById('customer-phone');
    const emailInput = document.getElementById('customer-email');
    const addressInput = document.getElementById('customer-address');
    const cityInput = document.getElementById('customer-city');
    const notesInput = document.getElementById('customer-notes');

    if (nameInput) nameInput.addEventListener('input', (e) => customerInfo.name = e.target.value);
    if (phoneInput) phoneInput.addEventListener('input', (e) => customerInfo.phone = e.target.value);
    if (emailInput) emailInput.addEventListener('input', (e) => customerInfo.email = e.target.value);
    if (cityInput) cityInput.addEventListener('change', (e) => customerInfo.city = e.target.value);
    if (addressInput) addressInput.addEventListener('input', (e) => customerInfo.address = e.target.value);
    if (notesInput) notesInput.addEventListener('input', (e) => customerInfo.notes = e.target.value);
}

// Calculate delivery fee based on selected city
function calculateDeliveryFee() {
    const city = customerInfo.city;
    
    if (!city || deliveryMethod !== 'delivery') {
        deliverySettings.deliveryFee = 0;
        return;
    }
    
    // Check if city has a specific price
    if (deliverySettings.cityPrices && deliverySettings.cityPrices[city] !== undefined) {
        deliverySettings.deliveryFee = parseFloat(deliverySettings.cityPrices[city]);
    } else {
        // Use default delivery fee if city not found
        deliverySettings.deliveryFee = parseFloat(deliverySettings.deliveryFee) || 5;
    }
    
    console.log(`Delivery fee for ${city}: ${deliverySettings.deliveryFee} EUR`);
    
    // Update order summary
    updateOrderSummary();
}

// Update only the order summary section
function updateOrderSummary() {
    const summarySection = document.querySelector('.summary-section');
    if (!summarySection) return;
    
    const { subtotal, discount, deliveryFee, freeDeliveryApplied, total } = calculateTotals();
    
    summarySection.innerHTML = `
        <h2 class="section-title">Order Summary</h2>
        <div class="summary-row subtotal">
            <span data-translate="subtotal">${translations[currentLanguage].subtotal}</span>
            <span>${formatPrice(subtotal)}</span>
        </div>
        ${discount > 0 ? `
        <div class="summary-row promo">
            <span data-translate="discount">${translations[currentLanguage].discount} (${appliedPromo.code})</span>
            <span>-${formatPrice(discount)}</span>
        </div>
        ` : ''}
        ${deliveryMethod === 'delivery' ? `
        <div class="summary-row delivery">
            <span data-translate="deliveryFee">${translations[currentLanguage].deliveryFee}</span>
            <span>${freeDeliveryApplied ? `<s>${formatPrice(deliveryFee)}</s> <span style="color: #27ae60; font-weight: 700;">FREE</span>` : formatPrice(deliveryFee)}</span>
        </div>
        ` : ''}
        <div class="summary-row total">
            <span data-translate="total">${translations[currentLanguage].total}</span>
            <span>${formatPrice(total)}</span>
        </div>
        ${orderTime === 'later' && selectedTimeSlot ? `
        <div class="summary-row time">
            <span>${currentLanguage === 'bg' ? translations[currentLanguage].deliveryTime : translations[currentLanguage].deliveryTime}</span>
            <span style="color: #e67e22; font-weight: 700;">${selectedTimeSlot}</span>
        </div>
        ` : ''}
        ${orderSettings.minimumOrderAmount > 0 && total < orderSettings.minimumOrderAmount ? `
        <div class="order-warning">
            <i class="fas fa-exclamation-triangle"></i>
            <span>${currentLanguage === 'bg' ? `Минимална сума за поръчка: ${formatPrice(orderSettings.minimumOrderAmount)}` : `Minimum order amount: ${formatPrice(orderSettings.minimumOrderAmount)}`}</span>
        </div>
        ` : ''}
        <button class="checkout-btn" onclick="placeOrder()" ${orderSettings.minimumOrderAmount > 0 && total < orderSettings.minimumOrderAmount ? 'disabled' : ''}>
            <i class="fas fa-${deliveryMethod === 'delivery' ? 'truck' : 'shopping-bag'}"></i>
            <span data-translate="placeOrder">${deliveryMethod === 'delivery' ? translations[currentLanguage].orderDelivery : translations[currentLanguage].orderPickup}</span>
        </button>
    `;
}

// Place order


