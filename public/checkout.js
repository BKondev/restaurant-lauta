// API Configuration
const BASE_PATH = window.location.pathname.includes('/resturant-website') ? '/resturant-website' : '';
const API_URL = `${BASE_PATH}/api`;

// State
let cart = [];
let appliedPromo = null;
const APPLIED_PROMO_STORAGE_KEY = 'checkoutAppliedPromo_v1';
const LANGUAGE_STORAGE_KEY = 'language';
const LANGUAGE_USER_SELECTED_KEY = 'language_user_selected_v1';

function saveAppliedPromoState() {
    try {
        if (!appliedPromo) {
            localStorage.removeItem(APPLIED_PROMO_STORAGE_KEY);
            return;
        }

        const code = (appliedPromo.code || '').toString().trim();
        const discount = Number(appliedPromo.discount);
        const allowedMethod = (appliedPromo.allowedMethod || 'all').toString().trim().toLowerCase();
        if (!code) {
            localStorage.removeItem(APPLIED_PROMO_STORAGE_KEY);
            return;
        }

        const payload = {
            code,
            discount: Number.isFinite(discount) ? discount : 0,
            scope: (appliedPromo.scope || '').toString(),
            category: (appliedPromo.category || '').toString(),
            categories: Array.isArray(appliedPromo.categories) ? appliedPromo.categories : [],
            productIds: Array.isArray(appliedPromo.productIds) ? appliedPromo.productIds : [],
            startDate: appliedPromo.startDate || null,
            endDate: appliedPromo.endDate || null,
            allowedMethod: (allowedMethod === 'delivery' || allowedMethod === 'pickup' || allowedMethod === 'all') ? allowedMethod : 'all'
        };
        localStorage.setItem(APPLIED_PROMO_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
        // ignore
    }
}

function clearAppliedPromoState() {
    appliedPromo = null;
    try {
        localStorage.removeItem(APPLIED_PROMO_STORAGE_KEY);
    } catch (e) {
        // ignore
    }
}

function loadAppliedPromoState() {
    try {
        const raw = localStorage.getItem(APPLIED_PROMO_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;

        const code = (parsed.code || '').toString().trim();
        const discount = Number(parsed.discount);
        const allowedMethod = (parsed.allowedMethod || 'all').toString().trim().toLowerCase();
        if (!code) return;

        const restored = {
            code,
            discount: Number.isFinite(discount) ? discount : 0,
            scope: (parsed.scope || '').toString().trim().toLowerCase(),
            category: (parsed.category || '').toString(),
            categories: Array.isArray(parsed.categories) ? parsed.categories : [],
            productIds: Array.isArray(parsed.productIds) ? parsed.productIds : [],
            startDate: parsed.startDate || null,
            endDate: parsed.endDate || null,
            allowedMethod: (allowedMethod === 'delivery' || allowedMethod === 'pickup' || allowedMethod === 'all') ? allowedMethod : 'all'
        };

        // Backward compatibility for older stored promos.
        if (!(restored.scope === 'all' || restored.scope === 'category' || restored.scope === 'products')) {
            restored.scope = (restored.category && restored.category !== 'all') ? 'category' : 'all';
        }

        if ((!Array.isArray(restored.categories) || restored.categories.length === 0) && restored.scope === 'category') {
            const cat = (restored.category || '').toString();
            if (cat) restored.categories = [cat];
        }

        // If checkout state already has a selected delivery method, ensure the promo is compatible.
        const dm = (deliveryMethod || '').toString().trim().toLowerCase();
        if (dm && (restored.allowedMethod === 'delivery' || restored.allowedMethod === 'pickup') && restored.allowedMethod !== dm) {
            localStorage.removeItem(APPLIED_PROMO_STORAGE_KEY);
            return;
        }

        appliedPromo = restored;
    } catch (e) {
        // ignore
    }
}

function getInitialLanguage() {
    const stored = (localStorage.getItem(LANGUAGE_STORAGE_KEY) || '').toString().trim().toLowerCase();
    const storedValid = (stored === 'en' || stored === 'bg') ? stored : '';
    const userSelected = localStorage.getItem(LANGUAGE_USER_SELECTED_KEY) === '1';
    if (!userSelected) return 'bg';
    return storedValid || 'bg';
}

let currentLanguage = getInitialLanguage();
let deliveryMethod = ''; // '' empty by default, 'delivery' or 'pickup'
let orderTime = ''; // '' empty by default, 'now' or 'later'
let scheduledTime = '';
let selectedTimeSlot = '';
let paymentMethod = ''; // '' = not selected yet; 'cash' or 'card'
let cardPaymentsEnabled = false;
let currentStep = 1; // Track current checkout step
let siteSettings = null;
let restaurantLogoUrl = '';
let customerInfo = {
    name: '',
    phone: '',
    email: '',
    city: '', // Empty by default - user must select
    address: '',
    notes: ''
};
let deliverySettings = {
    deliveryEnabled: true,
    deliveryHours: {
        openingTime: '11:00',
        closingTime: '21:30'
    },
    cityPrices: {} // Object with city names as keys and delivery fees as values
};
let currencySettings = {
    showBgnPrices: false
};
let orderSettings = {
    allowOrderLater: true,
    temporarilyClosed: false,
    pickupEnabled: true
};

function getEffectiveMinimumOrderAmountForMethod(method) {
    const normalized = (method === 'delivery' || method === 'pickup') ? method : null;
    if (!normalized) return 0;

    if (normalized === 'delivery') {
        const city = (customerInfo?.city || '').toString().trim();
        if (!city) return 0;
        const cityEntry = getCityDeliveryEntry(city);
        const cityMin = cityEntry && Number.isFinite(cityEntry.minimumOrderAmount) ? cityEntry.minimumOrderAmount : NaN;
        if (Number.isFinite(cityMin)) {
            return Math.max(0, cityMin);
        }
        return 0;
    }

    // Pickup: no minimum order.
    return 0;
}
let workingHours = {
    openingTime: '09:00',
    closingTime: '22:00'
};

let isPlacingOrder = false;

function setCheckoutPageLoading(isLoading) {
    try {
        const loader = document.getElementById('checkout-loader');
        const content = document.getElementById('checkout-page-content');
        if (loader) loader.style.display = isLoading ? 'flex' : 'none';
        if (content) content.style.display = isLoading ? 'none' : '';
    } catch (e) {
        // ignore
    }
}

function setPlaceOrderLoading(isLoading) {
    isPlacingOrder = !!isLoading;
    const buttons = document.querySelectorAll('.checkout-btn');
    const text = currentLanguage === 'bg' ? 'Изпращане…' : 'Sending…';

    buttons.forEach((btn) => {
        if (!btn) return;
        // Only lock while the request is in-flight.
        btn.disabled = isPlacingOrder;
        btn.setAttribute('data-loading', isPlacingOrder ? '1' : '0');
        if (isPlacingOrder) {
            btn.setAttribute('data-orig-html', btn.innerHTML);
            btn.innerHTML = text;
        } else {
            const orig = btn.getAttribute('data-orig-html');
            if (orig) btn.innerHTML = orig;
            btn.removeAttribute('data-orig-html');
        }
    });
}

const CHECKOUT_STATE_KEY = 'checkoutState_v1';

function captureCustomerInfoFromDom() {
    // Needed because we sometimes re-render the checkout when switching steps.
    // Preserve whatever the user has already typed.
    const nameInput = document.getElementById('customer-name');
    const phoneInput = document.getElementById('customer-phone');
    const emailInput = document.getElementById('customer-email');
    const cityInput = document.getElementById('customer-city');
    const addressInput = document.getElementById('customer-address');
    const notesInput = document.getElementById('customer-notes');

    if (nameInput) customerInfo.name = nameInput.value;
    if (phoneInput) customerInfo.phone = phoneInput.value;
    if (emailInput) customerInfo.email = emailInput.value;
    if (cityInput) customerInfo.city = cityInput.value;
    if (addressInput) customerInfo.address = addressInput.value;
    if (notesInput) customerInfo.notes = notesInput.value;
}

function resetCheckoutFlowBelowDeliveryMethod() {
    // Keep customerInfo, but require re-selecting time/payment.
    orderTime = '';
    scheduledTime = '';
    selectedTimeSlot = '';
    paymentMethod = cardPaymentsEnabled ? '' : 'cash';
    currentStep = 1;
}

function enforceOrderSettingsConstraints() {
    // If scheduling is disabled, force "now" (and clear any scheduled selection).
    if (orderSettings?.allowOrderLater === false) {
        if (orderTime === 'later') {
            orderTime = 'now';
        }
        scheduledTime = '';
        selectedTimeSlot = '';
    }
}

function ensureValidPaymentMethod() {
    // Auto-select if only one payment method is available.
    // Today cash is always available; card is conditional.
    const available = ['cash'];
    if (cardPaymentsEnabled) available.push('card');

    if (available.length === 1) {
        paymentMethod = available[0];
        return;
    }

    if (!available.includes(paymentMethod)) {
        paymentMethod = '';
    }
}

function normalizeCityPriceEntry(value) {
    if (value === undefined || value === null) return null;

    // Backward compatibility: numeric fee
    if (typeof value === 'number' || typeof value === 'string') {
        const fee = parseFloat(value);
        return Number.isFinite(fee) ? { fee } : null;
    }

    if (typeof value !== 'object') return null;

    const feeRaw = value.fee ?? value.price ?? value.deliveryFee ?? value.deliveryPrice;
    const minRaw = value.minimumOrderAmount ?? value.minOrderAmount ?? value.minimumOrder ?? value.min;
    const freeRaw = value.freeDeliveryAmount ?? value.freeDeliveryOverAmount ?? value.freeOverAmount;

    const fee = parseFloat(feeRaw);
    const minimumOrderAmount = parseFloat(minRaw);
    const freeDeliveryAmount = parseFloat(freeRaw);

    const out = {};
    if (Number.isFinite(fee)) out.fee = fee;
    if (Number.isFinite(minimumOrderAmount)) out.minimumOrderAmount = minimumOrderAmount;
    if (Number.isFinite(freeDeliveryAmount)) out.freeDeliveryAmount = freeDeliveryAmount;
    return Object.keys(out).length ? out : null;
}

function getCityDeliveryEntry(cityRaw) {
    const city = String(cityRaw || '').trim();
    const prices = deliverySettings?.cityPrices || {};

    if (!city) return null;

    if (prices && prices[city] !== undefined) {
        return normalizeCityPriceEntry(prices[city]);
    }

    // Case-insensitive lookup
    const cityNorm = city.toLowerCase();
    for (const [key, value] of Object.entries(prices)) {
        if (String(key).trim().toLowerCase() === cityNorm) {
            return normalizeCityPriceEntry(value);
        }
    }

    // Fallback keys commonly used for "other regions"
    const fallbackKeys = ['Други', 'Other', 'other', '*', 'default'];
    for (const k of fallbackKeys) {
        if (prices && prices[k] !== undefined) {
            return normalizeCityPriceEntry(prices[k]);
        }
    }

    return null;
}

function getDeliveryFeeForCity(cityRaw) {
    const city = String(cityRaw || '').trim();
    if (!city) return 0;

    const entry = getCityDeliveryEntry(city);
    const fee = entry && Number.isFinite(entry.fee) ? entry.fee : NaN;
    return Number.isFinite(fee) ? Math.max(0, fee) : 0;
}

function applyCheckoutStepVisibility() {
    const orderTimeSection = document.getElementById('order-time-section');
    const paymentCustomerSection = document.getElementById('payment-customer-section');
    const timePickerSection = document.getElementById('time-picker-section');

    if (orderTimeSection) {
        orderTimeSection.style.display = deliveryMethod ? 'block' : 'none';
    }

    if (paymentCustomerSection) {
        paymentCustomerSection.style.display = orderTime ? 'block' : 'none';
    }

    if (timePickerSection) {
        timePickerSection.style.display = orderTime === 'later' ? 'block' : 'none';
    }
}

function scrollElementToViewportCenter(el) {
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (!rect || !Number.isFinite(rect.top)) return;

    // If element is hidden, scrolling won't work.
    if (rect.width === 0 && rect.height === 0) return;

    const scrollY = (window.pageYOffset || document.documentElement.scrollTop || 0);
    const absoluteTop = rect.top + scrollY;
    const elCenterOffset = rect.height / 2;
    const target = Math.max(0, absoluteTop - (window.innerHeight / 2) + elCenterOffset);

    window.scrollTo({ top: target, behavior: 'smooth' });
}

function saveCheckoutState() {
    try {
        const state = {
            deliveryMethod,
            orderTime,
            scheduledTime,
            selectedTimeSlot,
            paymentMethod,
            currentStep,
            customerInfo
        };
        localStorage.setItem(CHECKOUT_STATE_KEY, JSON.stringify(state));
    } catch (e) {
        // ignore
    }
}

function loadCheckoutState() {
    try {
        const raw = localStorage.getItem(CHECKOUT_STATE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;

        const nextDeliveryMethod = ['delivery', 'pickup', ''].includes(parsed.deliveryMethod) ? parsed.deliveryMethod : '';
        const nextOrderTime = ['now', 'later', ''].includes(parsed.orderTime) ? parsed.orderTime : '';
        const nextPaymentMethod = ['cash', 'card', ''].includes(parsed.paymentMethod) ? parsed.paymentMethod : '';

        deliveryMethod = nextDeliveryMethod;
        orderTime = nextOrderTime;
        scheduledTime = typeof parsed.scheduledTime === 'string' ? parsed.scheduledTime : '';
        selectedTimeSlot = typeof parsed.selectedTimeSlot === 'string' ? parsed.selectedTimeSlot : '';

        paymentMethod = nextPaymentMethod;
        // If card is disabled (or payment invalid), normalize.
        ensureValidPaymentMethod();

        const stepNum = Number(parsed.currentStep);
        currentStep = Number.isFinite(stepNum) && stepNum >= 1 ? stepNum : 1;

        if (parsed.customerInfo && typeof parsed.customerInfo === 'object') {
            customerInfo = {
                ...customerInfo,
                ...parsed.customerInfo
            };
        }
    } catch (e) {
        // ignore
    }
}

function escapeHtmlAttribute(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function truncateMobileName(name, maxChars = 25) {
    const text = String(name ?? '');
    if (!window.matchMedia || !window.matchMedia('(max-width: 768px)').matches) return text;
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars).trimEnd() + '…';
}

function getAvailableDeliveryCities() {
    const raw = deliverySettings?.cityPrices;

    let cities = [];
    if (Array.isArray(raw)) {
        cities = raw
            .map(e => (e && (e.name ?? e.city)) ? String(e.name ?? e.city).trim() : '')
            .filter(Boolean);
    } else if (raw && typeof raw === 'object') {
        cities = Object.keys(raw)
            .map(c => String(c || '').trim())
            .filter(Boolean);
    }

    const seen = new Set();
    const out = [];
    for (const c of cities) {
        const k = c.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(c);
    }
    return out;
}

// Format price
function round2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round((x + Number.EPSILON) * 100) / 100;
}

function formatPriceText(priceEUR) {
    return `${round2(priceEUR || 0).toFixed(2)} €`;
}

function formatPrice(priceEUR, { showBgn = true } = {}) {
    const eur = round2(priceEUR || 0);
    const eurHtml = `<span class="price-eur">${eur.toFixed(2)} €</span>`;

    if (!showBgn) return eurHtml;

    const rateRaw = currencySettings?.eurToBgnRate;
    const rate = Number(rateRaw);
    if (!Number.isFinite(rate) || rate <= 0) return eurHtml;

    const bgn = round2(eur * rate);
    const bgnHtml = `<span class="price-bgn">${bgn.toFixed(2)} лв</span>`;
    return `<span class="price-container">${eurHtml}${bgnHtml}</span>`;
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
        deliveryTime: 'Delivery Time',
        pickupTime: 'Pickup Time'
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
        deliveryTime: 'Време на доставка',
        pickupTime: 'Час за взимане'
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    setCheckoutPageLoading(true);
    // Fix navigation links
    try {
        document.querySelectorAll('a[href="../"]').forEach(link => {
            link.href = BASE_PATH + '/';
        });
    } catch (e) {
        // ignore
    }

    try {
        await loadRestaurantInfo();
        await loadCurrencySettings();
        await loadDeliverySettings();
        await loadOrderSettings();
        await loadWorkingHours();
        await loadPaymentsConfig();
        await loadSiteSettings();
        loadCheckoutState();
        enforceOrderSettingsConstraints();
        loadAppliedPromoState();
        loadCart();
        // If checkout state restored a delivery order, compute the correct delivery fee right away.
        if (deliveryMethod === 'delivery') {
            calculateDeliveryFee();
        }
        await syncCartFromServerIfNeeded();
        await hydrateCartDisplayFieldsFromServer();
        setupLanguageSwitcher();
        setupResponsiveCheckoutHandlers();
        setupBackArrowMobile();
        updateLanguage();
        renderCheckout();
        renderRestaurantStatusBanner();
    } catch (error) {
        console.error('Checkout init failed:', error);
        // Best-effort minimal render so the page doesn't go blank.
        try {
            loadCheckoutState();
            loadAppliedPromoState();
            loadCart();
            setupLanguageSwitcher();
            updateLanguage();
            renderCheckout();
        } catch (e) {
            // ignore
        }
    } finally {
        try { renderSiteMap(); } catch (e) {}
        try { renderSiteFooter(); } catch (e) {}
        try { window.addEventListener('beforeunload', saveCheckoutState); } catch (e) {}
        setCheckoutPageLoading(false);
    }
});

async function hydrateCartDisplayFieldsFromServer() {
    // For older carts (e.g. items added in BG), store the base (EN/default) name
    // so language switching can show the correct product name.
    if (!Array.isArray(cart) || cart.length === 0) return;
    const needsHydration = cart.some(it => !it || !it.baseName || typeof it.baseName !== 'string' || !it.baseName.trim());
    if (!needsHydration) return;

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
            if (!item) return item;
            const product = byId.get(String(item.id));
            if (!product) return item;

            const next = { ...item };
            if (!next.baseName || !String(next.baseName).trim()) {
                next.baseName = (product.name || '').toString();
                changed = true;
            }
            if (!next.translations && product.translations) {
                next.translations = product.translations;
                changed = true;
            }
            return next;
        });

        if (changed) {
            saveCart();
        }
    } catch (error) {
        console.error('Error hydrating cart from server:', error);
    }
}

async function loadSiteSettings() {
    try {
        const res = await fetch(`${API_URL}/settings/site`);
        if (!res.ok) return;
        siteSettings = await res.json();
    } catch (e) {
        // ignore
    }
}

function renderSiteFooter() {
    const footerEl = document.getElementById('site-footer');
    if (!footerEl) return;

    const contacts = siteSettings?.footer?.contacts || {};
    const mapCfg = siteSettings?.map || {};
    const aboutText = (siteSettings?.footer?.aboutText || '').toString().trim();
    const socials = Array.isArray(siteSettings?.footer?.socials) ? siteSettings.footer.socials : [];

    const labels = currentLanguage === 'bg'
        ? { contacts: 'Контакти', info: 'Информация', about: 'За нас', address: 'Адрес', hours: 'Работно време', phone: 'Телефон', email: 'Имейл', terms: 'Условия', privacy: 'Политика за поверителност', poweredBy: 'Powered by:' }
        : { contacts: 'Contacts', info: 'Information', about: 'About us', address: 'Address', hours: 'Working hours', phone: 'Phone', email: 'Email', terms: 'Terms', privacy: 'Privacy policy', poweredBy: 'Powered by:' };

    function getWeekdayKeyInTimeZoneClient(timeZone, date = new Date()) {
        const tz = (timeZone || 'Europe/Sofia').toString();
        try {
            const weekdayShort = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(date);
            const map = { Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun' };
            return map[weekdayShort] || null;
        } catch (e) {
            return null;
        }
    }

    function normalizeWorkingHoursConfigClient(raw) {
        const timeZone = (raw?.timezone || raw?.timeZone || 'Europe/Sofia').toString().trim() || 'Europe/Sofia';
        const legacyOpening = (raw?.openingTime || '09:00').toString().trim() || '09:00';
        const legacyClosing = (raw?.closingTime || '22:00').toString().trim() || '22:00';
        const legacyDay = { closed: false, openingTime: legacyOpening, closingTime: legacyClosing };
        const weeklyIn = (raw && typeof raw.weekly === 'object' && raw.weekly) ? raw.weekly : null;
        const keys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
        const weekly = {};
        keys.forEach(k => {
            const d = weeklyIn ? weeklyIn[k] : null;
            weekly[k] = {
                closed: d?.closed === true,
                openingTime: (d?.openingTime || legacyDay.openingTime).toString().trim() || legacyDay.openingTime,
                closingTime: (d?.closingTime || legacyDay.closingTime).toString().trim() || legacyDay.closingTime
            };
        });
        return { timezone: timeZone, weekly };
    }

    const wh = normalizeWorkingHoursConfigClient(workingHours || null);
    const closedText = currentLanguage === 'bg' ? 'Затворено' : 'Closed';
    const dayNames = currentLanguage === 'bg'
        ? { mon: 'Понеделник', tue: 'Вторник', wed: 'Сряда', thu: 'Четъртък', fri: 'Петък', sat: 'Събота', sun: 'Неделя' }
        : { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
    const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const weeklyHoursHtml = dayOrder
        .map(k => {
            const d = (wh.weekly && wh.weekly[k]) ? wh.weekly[k] : { closed: false, openingTime: '09:00', closingTime: '22:00' };
            const open = (d.openingTime || '').toString().trim();
            const close = (d.closingTime || '').toString().trim();
            const rangeText = d.closed === true ? closedText : `${open} - ${close}`;
            return `<div>${escapeHtml(dayNames[k] || k)}: ${escapeHtml(rangeText)}</div>`;
        })
        .join('');

    const rawAddress = (contacts.address || '').toString().trim();
    const explicitMapsUrlRaw = (contacts.addressMapsUrl || '').toString().trim();
    const explicitMapsUrl = explicitMapsUrlRaw && !/^https?:\/\//i.test(explicitMapsUrlRaw) && /^www\./i.test(explicitMapsUrlRaw)
        ? `https://${explicitMapsUrlRaw}`
        : explicitMapsUrlRaw;
    const lat = typeof mapCfg.lat === 'number' ? mapCfg.lat : parseFloat(mapCfg.lat);
    const lng = typeof mapCfg.lng === 'number' ? mapCfg.lng : parseFloat(mapCfg.lng);
    const derivedMapsUrl = Number.isFinite(lat) && Number.isFinite(lng)
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`
        : (rawAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawAddress)}` : '');
    const addressMapsUrl = explicitMapsUrl || derivedMapsUrl;
    const addressHtml = rawAddress
        ? (addressMapsUrl
            ? `<a href="${escapeHtml(addressMapsUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(rawAddress)}</a>`
            : escapeHtml(rawAddress))
        : '';

    const contactLines = [
        rawAddress ? `<li><strong>${escapeHtml(labels.address)}:</strong> ${addressHtml}</li>` : '',
        contacts.phone ? `<li><strong>${escapeHtml(labels.phone)}:</strong> <a class="footer-contact-link" href="tel:${encodeURIComponent(String(contacts.phone))}">${escapeHtml(contacts.phone)}</a></li>` : '',
        contacts.email ? `<li><strong>${escapeHtml(labels.email)}:</strong> <a href="mailto:${encodeURIComponent(contacts.email)}">${escapeHtml(contacts.email)}</a></li>` : ''
    ].filter(Boolean).join('');

    function detectSocialKey(s) {
        const url = (s?.url || '').toString().toLowerCase();
        const label = (s?.label || '').toString().toLowerCase();
        if (url.includes('facebook') || label.includes('facebook')) return 'facebook';
        if (url.includes('instagram') || label.includes('instagram')) return 'instagram';
        if (url.includes('google') || url.includes('maps') || label.includes('google')) return 'google';
        return '';
    }

    function iconClassForKey(key, fallback) {
        if (key === 'facebook') return 'fab fa-facebook-f';
        if (key === 'instagram') return 'fab fa-instagram';
        if (key === 'google') return 'fab fa-google';
        return fallback || 'fas fa-link';
    }

    const socialsByKey = new Map();
    socials.forEach(s => {
        if (!s || !s.url) return;
        const key = detectSocialKey(s);
        if (!key) return;
        if (!socialsByKey.has(key)) socialsByKey.set(key, s);
    });

    const socialOrder = ['facebook', 'instagram', 'google'];
    const socialLinks = socialOrder
        .map(key => {
            const s = socialsByKey.get(key);
            if (!s || !s.url) return '';
            const icon = iconClassForKey(key, (s.iconClass || '').toString().trim());
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            return `<a class="footer-social-icon" href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(label)}"><i class="${escapeHtml(icon)}"></i></a>`;
        })
        .filter(Boolean)
        .join('');

    footerEl.innerHTML = `
        <div class="footer-inner">
            <div class="footer-grid">
                <div class="footer-col">
                    <h3>${escapeHtml(labels.contacts)}</h3>
                    <ul>${contactLines || '<li>—</li>'}</ul>
                </div>
                <div class="footer-col">
                    <h3>${escapeHtml(labels.hours)}</h3>
                    <div>${weeklyHoursHtml || '—'}</div>
                </div>
                <div class="footer-col">
                    <h3>${escapeHtml(labels.info)}</h3>
                    <ul>
                        <li><a href="terms">${escapeHtml(labels.terms)}</a></li>
                        <li><a href="privacy">${escapeHtml(labels.privacy)}</a></li>
                    </ul>
                </div>
                <div class="footer-col">
                    <h3>${escapeHtml(labels.about)}</h3>
                    <p>${aboutText ? escapeHtml(aboutText) : '—'}</p>
                    ${socialLinks ? `<div class="footer-socials">${socialLinks}</div>` : ''}
                </div>
            </div>
            <div class="footer-bottom">
                <div>${escapeHtml(labels.poweredBy)} Crystal Automation &amp; Karakashkov</div>
                <div>&copy; ${new Date().getFullYear()}</div>
            </div>
        </div>
    `;
}

function renderSiteMap() {
    const mapEl = document.getElementById('site-map');
    if (!mapEl) return;

    const mapCfg = siteSettings?.map || {};
    const enabled = !!mapCfg.enabled;
    const lat = typeof mapCfg.lat === 'number' ? mapCfg.lat : parseFloat(mapCfg.lat);
    const lng = typeof mapCfg.lng === 'number' ? mapCfg.lng : parseFloat(mapCfg.lng);
    const zoom = Number.isFinite(Number(mapCfg.zoom)) ? Math.max(1, Math.min(19, Math.round(Number(mapCfg.zoom)))) : 16;
    const label = (mapCfg.label || siteSettings?.footer?.contacts?.address || '').toString().trim();

    if (!enabled || !Number.isFinite(lat) || !Number.isFinite(lng) || !window.L) {
        mapEl.style.display = 'none';
        mapEl.innerHTML = '';
        return;
    }

    mapEl.style.display = 'block';
    mapEl.innerHTML = '<div id="site-map-leaflet" style="width:100%;height:100%;"></div>';

    try {
        if (window.__siteLeafletMap && typeof window.__siteLeafletMap.remove === 'function') {
            window.__siteLeafletMap.remove();
        }
    } catch (e) {
        // ignore
    }

    const map = window.L.map('site-map-leaflet', { scrollWheelZoom: false });
    window.__siteLeafletMap = map;
    map.setView([lat, lng], zoom);

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const marker = window.L.marker([lat, lng]).addTo(map);
    if (label) {
        marker.bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -10] });
        marker.bindPopup(label);
    }
}

function escapeHtml(value) {
    return (value ?? '').toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Create a back arrow button before the logo and name in the top bar (mobile only)
function setupBackArrowMobile() {
    const topBar = document.getElementById('top-bar') || document.querySelector('.top-bar');
    const container = topBar?.querySelector('.container');
    const logo = document.getElementById('header-logo');

    if (!topBar || !container || !logo) return;
    if (topBar.querySelector('.back-arrow-btn')) return;

    // Hide any existing textual back links inside page content
    document.querySelectorAll('a[data-translate="back"], a[href="../"]').forEach(a => {
        a.style.display = 'none';
    });

    const btn = document.createElement('button');
    btn.className = 'back-arrow-btn';
    btn.setAttribute('aria-label', 'Back');
    btn.innerHTML = '←';
    btn.onclick = () => {
        saveCheckoutState();
        window.location.href = BASE_PATH + '/';
    };

    container.insertBefore(btn, container.firstChild);
}

async function loadCurrencySettings() {
    try {
        const res = await fetch(`${API_URL}/settings/currency`);
        if (res.ok) {
            currencySettings = await res.json();
        }
    } catch (e) {
        // keep defaults
    }
}

async function loadPaymentsConfig() {
    try {
        const res = await fetch(`${API_URL}/payments/config`);
        if (!res.ok) return;
        const cfg = await res.json();
        cardPaymentsEnabled = !!(cfg?.cardPayments?.enabled);
        ensureValidPaymentMethod();
    } catch (e) {
        cardPaymentsEnabled = false;
        ensureValidPaymentMethod();
    }
}

function setupResponsiveCheckoutHandlers() {
    if (!window || !window.matchMedia) return;

    const mql = window.matchMedia('(max-width: 768px)');
    let lastIsMobile = mql.matches;

    const maybeRerender = () => {
        const isMobile = mql.matches;
        if (isMobile === lastIsMobile) return;
        lastIsMobile = isMobile;
        // Re-render so mobile-only truncation and layout update immediately.
        renderCheckout();
    };

    // Fires in many browsers when crossing the breakpoint.
    if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', maybeRerender);
    } else if (typeof mql.addListener === 'function') {
        mql.addListener(maybeRerender);
    }

    // DevTools responsive mode often triggers resize without a media-query change event.
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(maybeRerender, 120);
    });
}

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

        const nameEl = document.getElementById('restaurant-name');
        if (nameEl) nameEl.textContent = settings.name;

        const rawLogo = (settings?.logo || '').toString().trim();
        const logoEl = document.getElementById('header-logo');
        if (rawLogo && logoEl) {
            let logoUrl = rawLogo;
            if (rawLogo.startsWith('/resturant-website/')) {
                const stripped = rawLogo.replace(/^\/resturant-website/, '');
                logoUrl = BASE_PATH ? `${BASE_PATH}${stripped}` : stripped;
            } else if (rawLogo.startsWith('/')) {
                logoUrl = `${BASE_PATH}${rawLogo}`;
            }

            restaurantLogoUrl = (logoUrl || '').toString().trim();

            logoEl.src = logoUrl;
            logoEl.classList.add('visible');
            if (nameEl) nameEl.style.display = 'none';
        } else {
            restaurantLogoUrl = '';
            if (logoEl) logoEl.classList.remove('visible');
            if (nameEl) nameEl.style.display = 'block';
        }

        // Load customization
        const customResponse = await fetch(`${API_URL}/settings/customization`);
        const customization = await customResponse.json();
        
        if (customization) {
            document.documentElement.style.setProperty('--top-bar-color', customization.topBarColor);
            document.documentElement.style.setProperty('--background-color', customization.backgroundColor);
            document.documentElement.style.setProperty('--highlight-color', customization.highlightColor);
            document.documentElement.style.setProperty('--price-color', customization.priceColor);

            const clampInt = (value, min, max, fallback) => {
                const n = Number.parseInt(value, 10);
                if (!Number.isFinite(n)) return fallback;
                return Math.max(min, Math.min(max, n));
            };

            const headerLogoHeight = clampInt(customization.headerLogoSize, 24, 96, 50);
            const headerLogoWidth = Math.round(headerLogoHeight * 1.6);
            const footerLogoMaxWidth = clampInt(customization.footerLogoMaxWidth, 80, 360, 180);
            document.documentElement.style.setProperty('--header-logo-height', `${headerLogoHeight}px`);
            document.documentElement.style.setProperty('--header-logo-width', `${headerLogoWidth}px`);
            document.documentElement.style.setProperty('--footer-logo-max-width', `${footerLogoMaxWidth}px`);
        }
    } catch (error) {
        console.error('Error loading restaurant info:', error);
    }
}

function getResolvedRestaurantLogoFallbackUrl() {
    try {
        return (restaurantLogoUrl || '').toString().trim();
    } catch (e) {
        return '';
    }
}

function syncCartLogoFallbackPresentation(imgEl) {
    try {
        if (!imgEl) return;
        const wrap = imgEl.closest?.('.cart-item-image-wrap');
        const logoFallbackUrl = getResolvedRestaurantLogoFallbackUrl();

        const attrSrc = (imgEl.getAttribute('src') || '').toString().trim();
        const propSrc = (imgEl.currentSrc || imgEl.src || '').toString().trim();

        const isLogo = !!logoFallbackUrl && (
            attrSrc === logoFallbackUrl ||
            propSrc === logoFallbackUrl ||
            (propSrc && propSrc.includes(logoFallbackUrl))
        );

        imgEl.classList.toggle('is-logo-fallback', isLogo);
        if (wrap) {
            wrap.classList.toggle('is-logo-fallback', isLogo);
            if (isLogo) {
                wrap.style.setProperty('--logo-fallback-bg', `url("${logoFallbackUrl}")`);
            } else {
                wrap.style.removeProperty('--logo-fallback-bg');
            }
        }
    } catch (e) {}
}

function handleBrokenCartItemImage(imgEl) {
    try {
        if (!imgEl) return;
        const fallback = (imgEl.getAttribute('data-fallback-src') || '').toString().trim();
        imgEl.onerror = null;
        if (fallback) imgEl.src = fallback;
        syncCartLogoFallbackPresentation(imgEl);
    } catch (e) {}
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
    try {
        const savedCart = localStorage.getItem('cart');
        cart = savedCart ? JSON.parse(savedCart) : [];
        if (!Array.isArray(cart)) cart = [];
    } catch (e) {
        console.error('Failed to parse saved cart from localStorage:', e);
        cart = [];
        try {
            localStorage.removeItem('cart');
        } catch (err) {
            // ignore
        }
    }
}

// Save cart to localStorage
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Language switcher
function setupLanguageSwitcher() {
    // checkout.html uses inline onclick/onchange handlers calling switchLanguage().
    // Keep this function focused on initializing the UI state.
    syncLanguageUi();
}

function syncLanguageUi() {
    const langBtns = Array.from(document.querySelectorAll('.lang-btn'));
    const dropdown = document.getElementById('lang-dropdown');

    // Ensure only one button is highlighted.
    langBtns.forEach(b => b.classList.remove('active'));
    const activeBtn = langBtns.find(b => b.dataset.lang === currentLanguage);
    if (activeBtn) activeBtn.classList.add('active');

    // Ensure dropdown reflects actual language.
    if (dropdown) {
        dropdown.value = currentLanguage;
    }
}

// Used by inline onclick/onchange in checkout.html
function switchLanguage(lang) {
    if (!lang) return;
    if (!translations[lang]) return;
    currentLanguage = (lang === 'en' || lang === 'bg') ? lang : 'bg';
    localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
    localStorage.setItem(LANGUAGE_USER_SELECTED_KEY, '1');
    syncLanguageUi();
    updateLanguage();
    renderCheckout();
    try { renderSiteMap(); } catch (e) {}
    try { renderSiteFooter(); } catch (e) {}
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

    // Keep language UI (buttons/dropdown) consistent with currentLanguage.
    syncLanguageUi();

    renderRestaurantStatusBanner();
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
    const restaurantClosedReason = getRestaurantClosedReason();
    const deliveryClosedReason = getDeliveryClosedReason();
    const pickupClosedReason = getPickupClosedReason();
    // If pickup was selected from saved state but is currently disabled,
    // try to fall back to delivery (if available).
    if (pickupClosedReason && deliveryMethod === 'pickup') {
        deliveryMethod = deliveryClosedReason ? '' : 'delivery';
        clearAppliedPromoState();
        enforceOrderSettingsConstraints();
    }

    // If delivery is currently outside delivery hours but was selected from saved state,
    // force pickup so the checkout stays usable.
    if (deliveryClosedReason && deliveryMethod === 'delivery') {
        deliveryMethod = pickupClosedReason ? '' : 'pickup';
        resetCheckoutFlowBelowDeliveryMethod();
        enforceOrderSettingsConstraints();
    }
    
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

    const allowLater = orderSettings?.allowOrderLater !== false;
    const deliveryDisabled = !!deliveryClosedReason || !!restaurantClosedReason;
    const pickupDisabled = !!pickupClosedReason || !!restaurantClosedReason;

    const deliveryNoticeText = deliveryClosedReason
        ? (deliveryClosedReason.type === 'disabled'
            ? (currentLanguage === 'bg' ? 'Доставката е временно изключена.' : 'Delivery is temporarily disabled.')
            : (currentLanguage === 'bg'
                ? (deliveryClosedReason.tomorrow
                    ? `Доставките започват утре в ${deliveryClosedReason.opensAt}.`
                    : `Доставките започват в ${deliveryClosedReason.opensAt}.`)
                : (deliveryClosedReason.tomorrow
                    ? `Delivery starts tomorrow at ${deliveryClosedReason.opensAt}.`
                    : `Delivery starts at ${deliveryClosedReason.opensAt}.`)))
        : '';

    const pickupNoticeText = pickupClosedReason
        ? (currentLanguage === 'bg' ? 'Взимането от място е временно изключено.' : 'Pickup is temporarily disabled.')
        : '';

    deliverySection.innerHTML = `
        <h2 class="section-title"><span class="step-number-badge">1</span> ${currentLanguage === 'bg' ? 'Метод за доставка' : 'Delivery Method'}</h2>
        <div class="delivery-method">
            <label class="delivery-option ${deliveryMethod === 'delivery' ? 'active' : ''} ${deliveryDisabled ? 'disabled' : ''}" ${deliveryDisabled ? 'aria-disabled="true"' : ''} onclick="selectDeliveryMethod('delivery')">
                <input type="radio" name="delivery" value="delivery" ${deliveryMethod === 'delivery' ? 'checked' : ''} ${deliveryDisabled ? 'disabled' : ''}>
                <div class="delivery-option-icon"><i class="fas fa-truck"></i></div>
                <div class="delivery-option-title">${currentLanguage === 'bg' ? 'Доставка' : 'Delivery'}</div>
                <div class="delivery-option-desc">${currentLanguage === 'bg' ? 'Директно до вас' : 'Directly to you'}</div>
            </label>
            <label class="delivery-option ${deliveryMethod === 'pickup' ? 'active' : ''} ${pickupDisabled ? 'disabled' : ''}" ${pickupDisabled ? 'aria-disabled="true"' : ''} onclick="selectDeliveryMethod('pickup')">
                <input type="radio" name="delivery" value="pickup" ${deliveryMethod === 'pickup' ? 'checked' : ''} ${pickupDisabled ? 'disabled' : ''}>
                <div class="delivery-option-icon"><i class="fas fa-shopping-bag"></i></div>
                <div class="delivery-option-title">${currentLanguage === 'bg' ? 'Вземи' : 'Pickup'}</div>
                <div class="delivery-option-desc">${currentLanguage === 'bg' ? 'От ресторанта' : 'From restaurant'}</div>
            </label>
        </div>
        ${deliveryClosedReason && !restaurantClosedReason ? `
            <div class="checkout-inline-notice checkout-inline-notice-danger" id="delivery-hours-notice">
                <i class="fas fa-clock"></i>
                <span>${escapeHtml(deliveryNoticeText)}</span>
            </div>
        ` : ''}
        ${pickupClosedReason && !restaurantClosedReason ? `
            <div class="checkout-inline-notice checkout-inline-notice-danger" id="pickup-disabled-notice">
                <i class="fas fa-info-circle"></i>
                <span>${escapeHtml(pickupNoticeText)}</span>
            </div>
        ` : ''}
        <div id="order-time-section" class="checkout-step" style="display: none;">
            <h2 class="section-title" style="margin-top: 30px;"><span class="step-number-badge">2</span> ${currentLanguage === 'bg' ? 'Време на Поръчката' : 'Order Time'}</h2>
        <div class="delivery-method">
            <label class="delivery-option ${orderTime === 'now' ? 'active' : ''}" onclick="selectOrderTime('now')">
                <input type="radio" name="orderTime" value="now" ${orderTime === 'now' ? 'checked' : ''}>
                <div class="delivery-option-icon"><i class="fas fa-bolt"></i></div>
                <div class="delivery-option-title">${currentLanguage === 'bg' ? 'Сега' : 'Now'}</div>
                <div class="delivery-option-desc">${currentLanguage === 'bg' ? 'Възможно най-скоро' : 'As soon as possible'}</div>
            </label>
            ${allowLater ? `
            <label class="delivery-option ${orderTime === 'later' ? 'active' : ''}" onclick="selectOrderTime('later')">
                <input type="radio" name="orderTime" value="later" ${orderTime === 'later' ? 'checked' : ''}>
                <div class="delivery-option-icon"><i class="fas fa-clock"></i></div>
                <div class="delivery-option-title">${currentLanguage === 'bg' ? 'По-късно' : 'Later'}</div>
                <div class="delivery-option-desc">${currentLanguage === 'bg' ? 'Изберете час' : 'Choose time'}</div>
            </label>
            ` : ''}
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
                                    ${selectedTimeSlot || minutesToHHMM(getMinAllowedTimeMinutes())}
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
        <h2 class="section-title" id="payment-method-title" data-translate="paymentMethod" style="margin-top: 30px;"><span class="step-number-badge">3</span> ${translations[currentLanguage].paymentMethod}</h2>
        <div class="delivery-method">
            <label class="delivery-option ${paymentMethod === 'cash' ? 'active' : ''}" onclick="selectPaymentMethod('cash')">
                <input type="radio" name="payment" value="cash" ${paymentMethod === 'cash' ? 'checked' : ''}>
                <div class="delivery-option-icon"><i class="fas fa-money-bill-wave"></i></div>
                <div class="delivery-option-title" data-translate="cash">${translations[currentLanguage].cash}</div>
                <div class="delivery-option-desc" data-translate="cashDesc">${translations[currentLanguage].cashDesc}</div>
            </label>
            ${cardPaymentsEnabled ? `
            <label class="delivery-option ${paymentMethod === 'card' ? 'active' : ''}" onclick="selectPaymentMethod('card')">
                <input type="radio" name="payment" value="card" ${paymentMethod === 'card' ? 'checked' : ''}>
                <div class="delivery-option-icon"><i class="fas fa-credit-card"></i></div>
                <div class="delivery-option-title" data-translate="card">${translations[currentLanguage].card}</div>
                <div class="delivery-option-desc" data-translate="cardDesc">${translations[currentLanguage].cardDesc}</div>
            </label>
            ` : ''}
        </div>
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
                    ${getAvailableDeliveryCities().map(city => {
                        const value = escapeHtmlAttribute(city);
                        const label = escapeHtml(city);
                        const selected = (customerInfo.city === city) ? 'selected' : '';
                        return `<option value="${value}" ${selected}>${label}</option>`;
                    }).join('')}
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
            <input type="text" class="promo-input" id="promo-code-input" placeholder="${currentLanguage === 'bg' ? 'Въведи промо код' : 'Enter promo code'}" value="${appliedPromo ? escapeHtmlAttribute(appliedPromo.code) : ''}" ${appliedPromo ? 'disabled' : ''}>
            <button class="apply-promo-btn" onclick="applyPromoCode()" ${appliedPromo ? 'disabled' : ''}>${currentLanguage === 'bg' ? 'Приложи' : 'Apply'}</button>
        </div>
        <div class="promo-message ${appliedPromo ? 'success' : ''}" id="promo-message">${appliedPromo ? translations[currentLanguage].promoSuccess : ''}</div>
        ${appliedPromo ? `<button class="remove-promo-btn" onclick="removePromoCode()">${currentLanguage === 'bg' ? 'Премахни' : 'Remove'}</button>` : ''}
    `;

    const summarySection = document.createElement('div');
    summarySection.className = 'summary-section';
    
    const { subtotal, discount, intermediateSubtotal, deliveryFee, freeDeliveryApplied, total } = calculateTotals();
    const minOrderAmountNow = getEffectiveMinimumOrderAmountForMethod(deliveryMethod);
    const minCompareAmount = intermediateSubtotal;
    const minNotMet = (minOrderAmountNow > 0 && minCompareAmount < minOrderAmountNow);
    const isClosed = (!!restaurantClosedReason) || (orderSettings?.temporarilyClosed === true);

    summarySection.innerHTML = `
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
        <div class="summary-row subtotal">
            <span>${currentLanguage === 'bg' ? 'Междинна сума' : 'Subtotal after discount'}</span>
            <span>${formatPrice(intermediateSubtotal)}</span>
        </div>
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
        ${minNotMet ? `
        <div class="order-warning">
            <i class="fas fa-exclamation-triangle"></i>
            ${currentLanguage === 'bg' ? 'Минимална сума за поръчка' : 'Minimum order amount'}: ${formatPrice(minOrderAmountNow)}
            <br>
            ${currentLanguage === 'bg' ? 'Текуща сума' : 'Current amount'}: ${formatPrice(minCompareAmount)}
        </div>
        ` : ''}
        <button class="checkout-btn" type="button" onclick="placeOrder()" ${isClosed || minNotMet ? 'disabled' : ''} aria-disabled="${isClosed || minNotMet ? 'true' : 'false'}">
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
    applyCheckoutStepVisibility();
    setupFormListeners();
    initializeTimePicker();
    renderRestaurantStatusBanner();
    applyCheckoutAvailabilityUi();
}

function buildCheckoutLockedOverlayHtml(reason) {
    const isBg = currentLanguage === 'bg';
    const title = reason?.type === 'manual'
        ? (isBg ? 'Временно затворено' : 'Temporarily closed')
        : (reason?.type === 'closed_day'
            ? (isBg ? 'Днес сме затворени' : 'Closed today')
            : (reason?.type === 'methods'
                ? (isBg ? 'Поръчките са спрени' : 'Ordering unavailable')
                : (isBg ? 'Извън работно време' : 'Outside working hours')));

    const sub = (() => {
        if (reason?.type === 'manual') {
            return isBg ? 'Заповядайте по-късно.' : 'Please come again later.';
        }
        if (reason?.type === 'closed_day') {
            return isBg ? 'Днес не приемаме поръчки.' : 'We are not accepting orders today.';
        }
        if (reason?.type === 'methods') {
            return isBg
                ? 'Доставката и взимането от място са временно изключени.'
                : 'Both delivery and pickup are temporarily disabled.';
        }
        const opensAt = reason?.opensAt ? escapeHtml(reason.opensAt) : '';
        if (!opensAt) {
            return isBg ? 'Заповядайте по-късно.' : 'Please come again later.';
        }

        const days = Number.isFinite(reason?.opensInDays) ? reason.opensInDays : (reason?.tomorrow ? 1 : 0);
        const dayKey = (reason?.opensDayKey || '').toString().trim();
        const dayName = dayKey ? (WORKING_HOURS_WEEKDAY_LABELS[isBg ? 'bg' : 'en']?.[dayKey] || '') : '';

        if (days === 0) {
            return isBg ? `Отваряме в ${opensAt}.` : `We open at ${opensAt}.`;
        }
        if (days === 1) {
            return isBg ? `Отваряме утре в ${opensAt}.` : `We open tomorrow at ${opensAt}.`;
        }
        return isBg
            ? `Отваряме в ${escapeHtml(dayName || dayKey)} в ${opensAt}.`
            : `We open on ${escapeHtml(dayName || dayKey)} at ${opensAt}.`;
    })();

    return `
        <div class="ux-checkout-lock">
            <div class="ux-checkout-lock-icon"><i class="fas fa-store-slash"></i></div>
            <div class="ux-checkout-lock-text">
                <div class="ux-checkout-lock-title">${title}</div>
                <div class="ux-checkout-lock-sub">${sub}</div>
            </div>
        </div>
    `;
}

function setSectionLocked(sectionEl, locked, overlayHtml) {
    if (!sectionEl) return;

    const existing = sectionEl.querySelector('.ux-step-overlay');
    if (!locked) {
        sectionEl.classList.remove('ux-step-locked');
        if (existing) existing.remove();
        return;
    }

    sectionEl.classList.add('ux-step-locked');
    if (existing) {
        existing.innerHTML = overlayHtml || '';
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'ux-step-overlay';
    overlay.innerHTML = overlayHtml || '';
    sectionEl.appendChild(overlay);
}

function applyCheckoutAvailabilityUi() {
    const restaurantClosedReason = getRestaurantClosedReason();
    const locked = !!restaurantClosedReason;
    const overlayHtml = locked ? buildCheckoutLockedOverlayHtml(restaurantClosedReason) : '';

    const stepsEl = document.querySelector('.delivery-options');
    setSectionLocked(stepsEl, locked, overlayHtml);

    const summaryEl = document.querySelector('.summary-section');
    setSectionLocked(summaryEl, locked, overlayHtml);
}

function parseHHMMToMinutes(hhmm) {
    if (!hhmm || typeof hhmm !== 'string') return null;
    const match = hhmm.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours * 60 + minutes;
}

function minutesToHHMM(totalMinutes) {
    if (!Number.isFinite(totalMinutes)) return '--:--';
    const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
    const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
    const minutes = String(normalized % 60).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function roundUpTo15Minutes(totalMinutes) {
    return Math.ceil(totalMinutes / 15) * 15;
}

function nowMinutesOfDay() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
}

function nowMinutesOfDayInTimeZoneClient(timeZone, date = new Date()) {
    const tz = (timeZone || 'Europe/Sofia').toString();
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).formatToParts(date);

        const hourStr = parts.find(p => p.type === 'hour')?.value;
        const minuteStr = parts.find(p => p.type === 'minute')?.value;
        const h = parseInt(hourStr || '', 10);
        const m = parseInt(minuteStr || '', 10);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return nowMinutesOfDay();
        return (h * 60) + m;
    } catch (e) {
        return nowMinutesOfDay();
    }
}

function isMinutesWithinWindow(nowMinutes, openMinutes, closeMinutes) {
    if (!Number.isFinite(nowMinutes) || !Number.isFinite(openMinutes) || !Number.isFinite(closeMinutes)) return false;
    if (openMinutes === closeMinutes) return false;
    // Normal window (same day)
    if (closeMinutes > openMinutes) {
        return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
    }
    // Overnight window (e.g. 18:00 - 02:00)
    return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
}

const WORKING_HOURS_DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const WORKING_HOURS_WEEKDAY_LABELS = {
    en: {
        mon: 'Monday',
        tue: 'Tuesday',
        wed: 'Wednesday',
        thu: 'Thursday',
        fri: 'Friday',
        sat: 'Saturday',
        sun: 'Sunday'
    },
    bg: {
        mon: 'Понеделник',
        tue: 'Вторник',
        wed: 'Сряда',
        thu: 'Четвъртък',
        fri: 'Петък',
        sat: 'Събота',
        sun: 'Неделя'
    }
};

function getWeekdayKeyInTimeZoneClient(timeZone, date = new Date()) {
    const tz = (timeZone || 'Europe/Sofia').toString();
    try {
        const weekdayShort = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(date);
        const map = { Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun' };
        return map[weekdayShort] || null;
    } catch (e) {
        return null;
    }
}

function getDayKeyByWeekdayOffsetClient(todayKey, offsetDays) {
    const offset = Number(offsetDays) || 0;
    const idx = WORKING_HOURS_DAY_KEYS.indexOf(todayKey);
    if (idx < 0) {
        const normalized = ((offset % 7) + 7) % 7;
        return WORKING_HOURS_DAY_KEYS[normalized] || 'mon';
    }
    const normalized = ((idx + offset) % 7 + 7) % 7;
    return WORKING_HOURS_DAY_KEYS[normalized] || todayKey;
}

function normalizeWorkingHoursConfigClient(raw) {
    const timeZone = (raw?.timezone || raw?.timeZone || 'Europe/Sofia').toString().trim() || 'Europe/Sofia';
    const legacyOpening = (raw?.openingTime || '09:00').toString().trim() || '09:00';
    const legacyClosing = (raw?.closingTime || '22:00').toString().trim() || '22:00';
    const legacyDay = { closed: false, openingTime: legacyOpening, closingTime: legacyClosing };
    const weeklyIn = (raw && typeof raw.weekly === 'object' && raw.weekly) ? raw.weekly : null;

    const weekly = {};
    for (const key of WORKING_HOURS_DAY_KEYS) {
        const d = weeklyIn ? weeklyIn[key] : null;
        weekly[key] = {
            closed: d?.closed === true,
            openingTime: (d?.openingTime || legacyDay.openingTime).toString().trim() || legacyDay.openingTime,
            closingTime: (d?.closingTime || legacyDay.closingTime).toString().trim() || legacyDay.closingTime
        };
    }

    return { timezone: timeZone, weekly };
}

function getWorkingHoursDayForNow() {
    const cfg = normalizeWorkingHoursConfigClient(workingHours || null);
    const tz = cfg.timezone || 'Europe/Sofia';
    const dayKey = getWeekdayKeyInTimeZoneClient(tz, new Date()) || null;
    const fallbackByLocal = (() => {
        const d = new Date().getDay();
        return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d] || 'mon';
    })();
    const key = dayKey || fallbackByLocal || 'mon';
    const day = (cfg.weekly && cfg.weekly[key]) ? cfg.weekly[key] : { closed: false, openingTime: '09:00', closingTime: '22:00' };
    return { timezone: tz, dayKey: key, ...day };
}

function getDayKeyByOffsetClient(timeZone, startDate, offsetDays) {
    const base = startDate instanceof Date ? startDate : new Date();
    const d = new Date(base);
    d.setDate(d.getDate() + (Number(offsetDays) || 0));
    const key = getWeekdayKeyInTimeZoneClient(timeZone, d);
    if (key) return key;
    const localMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const idx = d.getDay();
    return localMap[idx] || 'mon';
}

function getNextOpenInfoClient() {
    const cfg = normalizeWorkingHoursConfigClient(workingHours || null);
    const tz = cfg.timezone || 'Europe/Sofia';
    const nowDate = new Date();
    const todayKey = getWeekdayKeyInTimeZoneClient(tz, nowDate) || 'mon';
    const todayCfg = cfg.weekly?.[todayKey] || { closed: false, openingTime: '09:00', closingTime: '22:00' };

    const now = nowMinutesOfDayInTimeZoneClient(tz, nowDate);

    if (todayCfg.closed !== true) {
        const open = parseHHMMToMinutes(todayCfg.openingTime) ?? (9 * 60);
        const close = parseHHMMToMinutes(todayCfg.closingTime) ?? (22 * 60);
        const within = isMinutesWithinWindow(now, open, close);
        if (!within) {
            if (close > open) {
                if (now < open) {
                    return { dayKey: todayKey, opensAt: minutesToHHMM(open), daysAhead: 0 };
                }
            } else {
                // Overnight schedule: closed only in the gap [close, open)
                return { dayKey: todayKey, opensAt: minutesToHHMM(open), daysAhead: 0 };
            }
        }
    }

    for (let offset = 1; offset <= 7; offset++) {
        const key = getDayKeyByWeekdayOffsetClient(todayKey, offset);
        const dayCfg = cfg.weekly?.[key] || { closed: false, openingTime: '09:00', closingTime: '22:00' };
        if (dayCfg.closed === true) continue;
        const open = parseHHMMToMinutes(dayCfg.openingTime) ?? (9 * 60);
        return { dayKey: key, opensAt: minutesToHHMM(open), daysAhead: offset };
    }

    return null;
}

function getRestaurantWindowMinutes() {
    const day = getWorkingHoursDayForNow();
    if (day.closed === true) {
        return { open: NaN, close: NaN, closed: true, openingTime: day.openingTime, closingTime: day.closingTime };
    }
    const open = parseHHMMToMinutes(day.openingTime) ?? (9 * 60);
    const close = parseHHMMToMinutes(day.closingTime) ?? (22 * 60);
    return { open, close, closed: false, openingTime: day.openingTime, closingTime: day.closingTime };
}

function getDeliveryWindowMinutes() {
    const open = parseHHMMToMinutes(deliverySettings?.deliveryHours?.openingTime) ?? (11 * 60);
    const close = parseHHMMToMinutes(deliverySettings?.deliveryHours?.closingTime) ?? ((21 * 60) + 30);
    return { open, close };
}

function getWindowSelectionModel() {
    const window = getAllowedWindowMinutes();
    const open = window.open;
    const closeRaw = window.close;
    const now = nowMinutesOfDay();

    if (!Number.isFinite(open) || !Number.isFinite(closeRaw)) {
        return {
            openExt: open,
            closeExt: closeRaw,
            closeRaw,
            nowExt: now,
            overnight: false
        };
    }

    if (closeRaw > open) {
        return {
            openExt: open,
            closeExt: closeRaw,
            closeRaw,
            nowExt: now,
            overnight: false
        };
    }

    // Overnight window: close is next day.
    const closeExt = closeRaw + (24 * 60);
    const nowExt = (now < closeRaw) ? (now + (24 * 60)) : now;
    return {
        openExt: open,
        closeExt,
        closeRaw,
        nowExt,
        overnight: true
    };
}

function normalizePickedMinutesToSelection(pickedMinutes, model) {
    if (!Number.isFinite(pickedMinutes)) return pickedMinutes;
    if (!model || !model.overnight) return pickedMinutes;
    // If picked time is in the "next day" segment (00:00 -> closeRaw), shift it.
    return pickedMinutes < model.closeRaw ? (pickedMinutes + (24 * 60)) : pickedMinutes;
}

function getMinAllowedTimeMinutes() {
    const model = getWindowSelectionModel();
    const minFromNow = roundUpTo15Minutes(model.nowExt + 60);

    // If we're before opening, earliest selectable is (opening + 60 minutes).
    const minFromOpening = model.nowExt < model.openExt
        ? roundUpTo15Minutes(model.openExt + 60)
        : model.openExt;

    return Math.max(minFromNow, minFromOpening);
}

function getAllowedWindowMinutes() {
    const restaurant = getRestaurantWindowMinutes();
    if (deliveryMethod !== 'delivery') return restaurant;
    const delivery = getDeliveryWindowMinutes();
    return {
        open: Math.max(restaurant.open, delivery.open),
        close: Math.min(restaurant.close, delivery.close)
    };
}

function getRestaurantClosedReason() {
    if (orderSettings?.temporarilyClosed === true) {
        return { type: 'manual' };
    }

    // If both fulfillment methods are disabled, ordering is effectively closed.
    const pickupEnabled = orderSettings?.pickupEnabled !== false;
    const deliveryEnabled = deliverySettings?.deliveryEnabled !== false;
    if (!pickupEnabled && !deliveryEnabled) {
        return { type: 'methods' };
    }

    // Restaurant open/closed is based on working hours only.
    // Delivery-hours are handled separately (delivery option disabled with a notice).
    const window = getRestaurantWindowMinutes();
    if (window.closed === true) {
        const next = getNextOpenInfoClient();
        return {
            type: 'closed_day',
            opensAt: next?.opensAt || '',
            opensInDays: Number.isFinite(next?.daysAhead) ? next.daysAhead : null,
            opensDayKey: next?.dayKey || null,
            tomorrow: next?.daysAhead === 1
        };
    }

    const tz = getWorkingHoursDayForNow()?.timezone || 'Europe/Sofia';
    const now = nowMinutesOfDayInTimeZoneClient(tz, new Date());

    const within = isMinutesWithinWindow(now, window.open, window.close);
    if (within) return null;

    const next = getNextOpenInfoClient();
    const opensAt = next?.opensAt || minutesToHHMM(window.open);
    const opensInDays = Number.isFinite(next?.daysAhead) ? next.daysAhead : (now < window.open ? 0 : 1);
    const opensDayKey = next?.dayKey || null;
    return {
        type: 'hours',
        opensAt,
        opensInDays,
        opensDayKey,
        tomorrow: opensInDays === 1
    };
}

function getDeliveryClosedReason() {
    // Admin can disable delivery entirely.
    if (deliverySettings?.deliveryEnabled === false) {
        return { type: 'disabled' };
    }

    const window = getDeliveryWindowMinutes();
    const now = nowMinutesOfDay();

    const within = isMinutesWithinWindow(now, window.open, window.close);
    if (within) return null;

    if (window.close > window.open) {
        if (now < window.open) return { type: 'hours', opensAt: minutesToHHMM(window.open), tomorrow: false };
        return { type: 'hours', opensAt: minutesToHHMM(window.open), tomorrow: true };
    }

    return { type: 'hours', opensAt: minutesToHHMM(window.open), tomorrow: false };
}

function getPickupClosedReason() {
    if (orderSettings?.pickupEnabled === false) {
        return { type: 'disabled' };
    }
    return null;
}

function renderRestaurantStatusBanner() {
    const topBar = document.getElementById('top-bar') || document.querySelector('.top-bar');
    if (!topBar) return;

    const reason = getRestaurantClosedReason();
    const existing = document.getElementById('restaurant-status-banner');
    if (!reason) {
        if (existing) existing.remove();
        return;
    }

    const banner = existing || document.createElement('div');
    banner.id = 'restaurant-status-banner';
    banner.className = 'restaurant-status-banner';

    const msg = (() => {
        if (reason.type === 'manual') {
            return currentLanguage === 'bg'
                ? 'Ресторантът е временно затворен.'
                : 'The restaurant is temporarily closed.';
        }

        if (reason.type === 'methods') {
            return currentLanguage === 'bg'
                ? 'Поръчките са временно спрени.'
                : 'Ordering is temporarily unavailable.';
        }

        const isBg = currentLanguage === 'bg';
        const dayKey = reason.opensDayKey;
        const dayName = dayKey ? (WORKING_HOURS_WEEKDAY_LABELS[isBg ? 'bg' : 'en']?.[dayKey] || '') : '';
        const opensAt = reason.opensAt;
        const days = Number.isFinite(reason.opensInDays) ? reason.opensInDays : (reason.tomorrow ? 1 : 0);

        const openLine = (!opensAt)
            ? ''
            : (days === 0
                ? (isBg ? `Отваряме в ${opensAt}.` : `Opens at ${opensAt}.`)
                : (days === 1
                    ? (isBg ? `Отваряме утре в ${opensAt}.` : `Opens tomorrow at ${opensAt}.`)
                    : (isBg
                        ? `Отваряме в ${dayName || ''} в ${opensAt}.`
                        : `Opens on ${dayName || ''} at ${opensAt}.`)));

        if (reason.type === 'closed_day') {
            return isBg
                ? (`Днес не приемаме поръчки.${openLine ? ' ' + openLine : ''}`)
                : (`We are not accepting orders today.${openLine ? ' ' + openLine : ''}`);
        }

        return isBg
            ? (`Ресторантът в момента не работи.${openLine ? ' ' + openLine : ''}`)
            : (`The restaurant is currently closed.${openLine ? ' ' + openLine : ''}`);
    })();

    banner.textContent = msg;

    if (!existing) {
        topBar.insertAdjacentElement('afterend', banner);
    }
}

function showUxModal({ title, message, primaryText }) {
    try {
        const existing = document.getElementById('ux-modal-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'ux-modal-overlay';
        overlay.className = 'ux-modal-overlay';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        const modal = document.createElement('div');
        modal.className = 'ux-modal';
        modal.innerHTML = `
            <div class="ux-modal-header">
                <div class="ux-modal-title">${title || ''}</div>
                <button type="button" class="ux-modal-close" aria-label="Close">×</button>
            </div>
            <div class="ux-modal-body">${message || ''}</div>
            <div class="ux-modal-actions">
                <button type="button" class="ux-modal-btn ux-modal-btn-primary">${primaryText || 'OK'}</button>
            </div>
        `;

        modal.querySelector('.ux-modal-close')?.addEventListener('click', () => overlay.remove());
        modal.querySelector('.ux-modal-btn-primary')?.addEventListener('click', () => overlay.remove());

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    } catch (e) {
        // Fallback if DOM insertion fails
        alert(message || title || '');
    }
}

function showWorkingHoursModal() {
    const restaurant = getRestaurantWindowMinutes();
    const open = minutesToHHMM(restaurant.open);
    const overnight = restaurant.close <= restaurant.open;
    const close = overnight
        ? `${minutesToHHMM(restaurant.close)}${currentLanguage === 'bg' ? ' (утре)' : ' (next day)'}`
        : minutesToHHMM(restaurant.close);
    showRestaurantClosedModal({
        type: 'hours',
        context: 'restaurant',
        open,
        close
    });
}

function showDeliveryHoursModal() {
    const delivery = getDeliveryWindowMinutes();
    const overnight = delivery.close <= delivery.open;
    showRestaurantClosedModal({
        type: 'hours',
        context: 'delivery',
        open: minutesToHHMM(delivery.open),
        close: overnight
            ? `${minutesToHHMM(delivery.close)}${currentLanguage === 'bg' ? ' (утре)' : ' (next day)'}`
            : minutesToHHMM(delivery.close)
    });
}

function showRestaurantClosedModal({ type, context, open, close }) {
    const isBg = currentLanguage === 'bg';
    const isManual = type === 'manual';
    const contextTitle = isManual
        ? (isBg ? 'Временно затворено' : 'Temporarily closed')
        : (context === 'delivery'
            ? (isBg ? 'Извън часовете за доставка' : 'Outside delivery hours')
            : (isBg ? 'Извън работно време' : 'Outside working hours'));

    const heroIcon = isManual
        ? '<i class="fas fa-store-slash"></i>'
        : (context === 'delivery' ? '<i class="fas fa-truck"></i>' : '<i class="fas fa-clock"></i>');

    const heroTitle = isManual
        ? (isBg ? 'В момента не приемаме поръчки' : 'We are not accepting orders right now')
        : (isBg ? 'В момента сме затворени' : 'We are currently closed');

    const heroSub = isManual
        ? (isBg ? 'Заповядайте по-късно.' : 'Please come again later.')
        : (isBg
            ? 'Можете да поръчате в работното време по-долу.'
            : 'You can order during the hours shown below.');

    const hoursHtml = (!isManual && open && close)
        ? `
            <div class="ux-hours-row">
                <div class="ux-hour-chip"><i class="fas fa-door-open"></i> ${isBg ? 'От' : 'From'} <span>${escapeHtml(open)}</span></div>
                <div class="ux-hour-chip"><i class="fas fa-door-closed"></i> ${isBg ? 'До' : 'To'} <span>${escapeHtml(close)}</span></div>
            </div>
            <div class="ux-tip">
                <i class="fas fa-info-circle"></i>
                ${isBg
                    ? 'Когато отворим, ще можете да завършите поръчката за минути.'
                    : 'When we open, you’ll be able to complete your order in minutes.'}
            </div>
        `
        : '';

    const msg = `
        <div class="ux-closed-hero ${isManual ? 'manual' : ''}">
            <div class="ux-closed-icon">${heroIcon}</div>
            <div class="ux-closed-text">
                <div class="ux-closed-title">${heroTitle}</div>
                <div class="ux-closed-sub">${heroSub}</div>
            </div>
        </div>
        ${hoursHtml}
    `;

    showUxModal({
        title: contextTitle,
        message: msg,
        primaryText: isBg ? 'Разбрах' : 'OK'
    });
}

function navigateTo(url) {
    window.location.href = url;
}

// Initialize time picker with default time
function initializeTimePicker() {
    // When the restaurant is closed, checkout remains accessible but steps are locked.
    // Avoid popping modals or mutating time selection in that state.
    if (getRestaurantClosedReason()) return;
    if (orderTime !== 'later') return;

    const model = getWindowSelectionModel();
    const minAllowed = getMinAllowedTimeMinutes();
    const maxAllowed = model.closeExt;

    if (maxAllowed < minAllowed) {
        selectedTimeSlot = '';
        updateTimeDisplay();
        // No valid time slots remain today.
        return;
    }

    const currentRaw = parseHHMMToMinutes(selectedTimeSlot);
    const current = currentRaw === null ? null : normalizePickedMinutesToSelection(currentRaw, model);
    const clamped = current === null ? minAllowed : Math.min(Math.max(current, minAllowed), maxAllowed);
    selectedTimeSlot = minutesToHHMM(clamped);
    updateTimeDisplay();
}

// Adjust time by minutes (В±15)
function adjustTime(minutes) {
    if (getRestaurantClosedReason()) return;
    if (!selectedTimeSlot) {
        initializeTimePicker();
        return;
    }

    const model = getWindowSelectionModel();
    const currentRaw = parseHHMMToMinutes(selectedTimeSlot);
    const current = currentRaw === null ? null : normalizePickedMinutesToSelection(currentRaw, model);
    if (current === null) {
        initializeTimePicker();
        return;
    }

    const minAllowed = getMinAllowedTimeMinutes();
    const maxAllowed = model.closeExt;

    if (maxAllowed < minAllowed) {
        initializeTimePicker();
        return;
    }

    const next = current + minutes;
    const clamped = Math.min(Math.max(next, minAllowed), maxAllowed);
    selectedTimeSlot = minutesToHHMM(clamped);
    
    updateTimeDisplay();
    saveCheckoutState();
}

// Update time display
function updateTimeDisplay() {
    const display = document.getElementById('selected-time-display');
    if (display) {
        const fallback = minutesToHHMM(getMinAllowedTimeMinutes());
        display.textContent = selectedTimeSlot || fallback;
    }
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
        
        const displayName = currentLanguage === 'bg'
            ? (item.translations?.bg?.name || item.name)
            : (item.translations?.en?.name || item.baseName || item.name);

        const displayNameForUi = displayName;
        
        const displayCategory = currentLanguage === 'bg'
            ? (item.translations?.bg?.category || item.category)
            : (item.translations?.en?.category || item.category);

        const itemTotal = item.price * item.quantity;

        const logoFallbackUrl = getResolvedRestaurantLogoFallbackUrl();
        const fallbackImageUrl = logoFallbackUrl || 'https://via.placeholder.com/80x80?text=No+Image';

        const imageRaw = (item?.image || '').toString().trim();
        const originalImageUrl = imageRaw
            ? (imageRaw.startsWith('http') ? imageRaw : `${BASE_PATH}${imageRaw}`)
            : '';
        const safeImageUrl = originalImageUrl || fallbackImageUrl;

        itemElement.innerHTML = `
            <div class="cart-item-row">
                <div class="cart-item-image-wrap">
                    <img src="${safeImageUrl}" alt="${displayName}" class="cart-item-image" data-orig-src="${originalImageUrl}" data-fallback-src="${fallbackImageUrl}" onerror="handleBrokenCartItemImage(this)">
                    ${item.weight ? `<span class="cart-item-weight cart-item-weight-overlay">${item.weight}</span>` : ''}
                </div>
                <div class="cart-item-name" title="${escapeHtmlAttribute(displayName)}">${displayNameForUi}</div>
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

        try {
            const img = itemElement.querySelector('.cart-item-image');
            if (img) syncCartLogoFallbackPresentation(img);
        } catch (e) {}
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

    function computeEligibleSubtotalForPromo(promo) {
        if (!promo) return 0;
        const scope = (promo.scope || '').toString().trim().toLowerCase();
        const category = (promo.category || 'all').toString();
        const categories = Array.isArray(promo.categories) ? promo.categories.map(c => (c || '').toString()).filter(Boolean) : [];
        const normSet = new Set(categories.map(c => c.toLowerCase()));

        if (scope === 'all' || category === 'all' || normSet.has('all') || !scope) {
            return subtotal;
        }

        if (scope === 'category') {
            const fallback = category.toLowerCase();
            return cart.reduce((sum, item) => {
                const itemCat = (item.category || '').toString().toLowerCase();
                const match = normSet.size ? normSet.has(itemCat) : (itemCat === fallback);
                if (!match) return sum;
                return sum + (Number(item.price) * Number(item.quantity));
            }, 0);
        }

        if (scope === 'products') {
            const ids = Array.isArray(promo.productIds) ? promo.productIds : [];
            const set = new Set(ids.map(x => String(x)));
            return cart.reduce((sum, item) => {
                if (!set.has(String(item.id))) return sum;
                return sum + (Number(item.price) * Number(item.quantity));
            }, 0);
        }

        return subtotal;
    }
    
    if (appliedPromo) {
        const eligibleSubtotal = computeEligibleSubtotalForPromo(appliedPromo);
        discount = eligibleSubtotal * (appliedPromo.discount / 100);
    }

    const intermediateSubtotal = round2(subtotal - discount);
    
    // Calculate delivery fee
    let deliveryFee = 0;
    let freeDeliveryApplied = false;
    
    if (deliveryMethod === 'delivery') {
        const city = (customerInfo?.city || '').toString().trim();
        const cityEntry = getCityDeliveryEntry(city);
        const threshold = (cityEntry && Number.isFinite(cityEntry.freeDeliveryAmount))
            ? Math.max(0, cityEntry.freeDeliveryAmount)
            : null;

        if (threshold !== null && intermediateSubtotal >= threshold) {
            deliveryFee = 0;
            freeDeliveryApplied = true;
        } else {
            deliveryFee = getDeliveryFeeForCity(city);
        }
    }

    deliveryFee = round2(deliveryFee);
    const total = round2(intermediateSubtotal + deliveryFee);

    return { subtotal: round2(subtotal), discount: round2(discount), intermediateSubtotal, deliveryFee, freeDeliveryApplied, total };
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

    // Provide cart context so the server can ensure the promo applies to at least 1 item.
    const categories = [...new Set(cart.map(item => (item.category || '').toString()).filter(Boolean))];
    const productIds = [...new Set(cart.map(item => item.id).filter(v => v !== undefined && v !== null))];

    try {
        const response = await fetch(`${API_URL}/promo-codes/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code, categories, productIds, deliveryMethod })
        });

        const validPromo = await response.json();

        if (validPromo && validPromo.valid) {
            const promoCategories = Array.isArray(validPromo.categories)
                ? validPromo.categories.map(c => (c || '').toString()).filter(Boolean)
                : [];
            appliedPromo = {
                code: code,
                discount: validPromo.discount,
                scope: validPromo.scope || ((validPromo.category && validPromo.category !== 'all') ? 'category' : 'all'),
                category: validPromo.category || 'all',
                categories: promoCategories.length ? promoCategories : ((validPromo.category && validPromo.category !== 'all') ? [validPromo.category] : []),
                productIds: Array.isArray(validPromo.productIds) ? validPromo.productIds : [],
                startDate: validPromo.startDate || null,
                endDate: validPromo.endDate || null,
                allowedMethod: validPromo.allowedMethod || 'all'
            };
            saveAppliedPromoState();
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
    clearAppliedPromoState();
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
    if (isPlacingOrder) {
        return;
    }

    if (orderSettings?.temporarilyClosed === true) {
        showRestaurantClosedModal({ type: 'manual' });
        return;
    }

    // Checkout is accessible even when closed, but ordering is not.
    const restaurantClosedReason = getRestaurantClosedReason();
    if (restaurantClosedReason) {
        if (restaurantClosedReason.type === 'manual') {
            showRestaurantClosedModal({ type: 'manual' });
        } else {
            showWorkingHoursModal();
        }
        return;
    }

    // Minimum order amount feedback (avoid a disabled button doing "nothing")
    const totalsNow = calculateTotals();
    const minAmount = getEffectiveMinimumOrderAmountForMethod(deliveryMethod);
    if (minAmount > 0 && (totalsNow?.subtotal || 0) < minAmount) {
        alert(
            currentLanguage === 'bg'
                ? `Минимална сума за поръчка: ${formatPriceText(minAmount)}`
                : `Minimum order amount: ${formatPriceText(minAmount)}`
        );
        return;
    }

    if (deliveryMethod === 'delivery') {
        const deliveryClosedReason = getDeliveryClosedReason();
        if (deliveryClosedReason) {
            renderCheckout();
            applyCheckoutStepVisibility();
            requestAnimationFrame(() => {
                const notice = document.getElementById('delivery-hours-notice');
                if (notice) notice.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
            return;
        }
    }

    if (deliveryMethod === 'pickup') {
        const pickupClosedReason = getPickupClosedReason();
        if (pickupClosedReason) {
            renderCheckout();
            applyCheckoutStepVisibility();
            requestAnimationFrame(() => {
                const notice = document.getElementById('pickup-disabled-notice');
                if (notice) notice.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
            return;
        }
    }

    // Basic flow validation (prevents stale step states when user goes back)
    if (!deliveryMethod) {
        alert(currentLanguage === 'bg' ? 'Моля, изберете метод на доставка' : 'Please select a delivery method');
        return;
    }
    if (!orderTime) {
        alert(currentLanguage === 'bg' ? 'Моля, изберете време за поръчката' : 'Please select an order time');
        return;
    }

    // Working hours / delivery hours enforcement
    if (orderTime === 'now') {
        const restaurant = getRestaurantWindowMinutes();
        const nowMins = nowMinutesOfDay();
        if (!isMinutesWithinWindow(nowMins, restaurant.open, restaurant.close)) {
            showWorkingHoursModal();
            return;
        }

        if (deliveryMethod === 'delivery') {
            const delivery = getDeliveryWindowMinutes();
            if (!isMinutesWithinWindow(nowMins, delivery.open, delivery.close)) {
                showDeliveryHoursModal();
                return;
            }
        }
    }

    if (orderTime === 'later') {
        const picked = parseHHMMToMinutes(selectedTimeSlot);
        if (picked === null) {
            initializeTimePicker();
            return;
        }

        const model = getWindowSelectionModel();
        const pickedExt = normalizePickedMinutesToSelection(picked, model);
        const minAllowed = getMinAllowedTimeMinutes();
        if (pickedExt < minAllowed || pickedExt > model.closeExt) {
            // Force a valid time and explain constraints.
            initializeTimePicker();
            if (deliveryMethod === 'delivery' && nowMinutesOfDay() < getDeliveryWindowMinutes().open) {
                showDeliveryHoursModal();
            } else {
                showWorkingHoursModal();
            }
            return;
        }
    }

    ensureValidPaymentMethod();
    if (!paymentMethod) {
        alert(currentLanguage === 'bg' ? 'Моля, изберете метод на плащане' : 'Please select a payment method');
        return;
    }

    // Validate customer info
    const name = document.getElementById('customer-name')?.value?.trim() || '';
    const phone = document.getElementById('customer-phone')?.value?.trim() || '';
    const email = document.getElementById('customer-email')?.value?.trim() || '';
    const city = deliveryMethod === 'delivery' ? (document.getElementById('customer-city')?.value?.trim() || '') : '';
    const address = deliveryMethod === 'delivery' ? (document.getElementById('customer-address')?.value?.trim() || '') : '';
    const notes = document.getElementById('customer-notes')?.value?.trim() || '';

    if (!name || !phone || !email || (deliveryMethod === 'delivery' && (!city || !address))) {
        alert(translations[currentLanguage].fillAllFields);
        return;
    }

    // Save customer info
    customerInfo = { name, phone, email, city, address, notes };

    const { total, deliveryFee } = calculateTotals();

    // Scheduled ("order later") time robustness:
    // The UI can display a fallback time even if selectedTimeSlot is empty.
    // Always send a real HH:MM scheduledTime for "later" orders.
    let uiOrderTime = orderTime;
    try {
        const selected = document.querySelector('input[name="orderTime"]:checked');
        if (selected && typeof selected.value === 'string' && selected.value.trim()) {
            uiOrderTime = selected.value.trim();
        }
    } catch (e) {
        // Ignore DOM lookup errors
    }

    const pickedTimeRaw = (selectedTimeSlot || scheduledTime || '').toString().trim();
    const pickedTimeMatch = pickedTimeRaw.match(/(\d{1,2}:\d{2})/);
    const pickedTimeHHMM = pickedTimeMatch ? pickedTimeMatch[1] : '';
    const pickedTimeIsHHMM = /^\d{1,2}:\d{2}$/.test(pickedTimeHHMM);
    const effectiveOrderTime = (uiOrderTime === 'later' || pickedTimeIsHHMM) ? 'later' : uiOrderTime;

    let effectiveScheduledTime = '';
    if (effectiveOrderTime === 'later') {
        effectiveScheduledTime = pickedTimeIsHHMM ? pickedTimeHHMM : '';

        // Final fallback: if the time picker never initialized, derive the earliest allowed time.
        if (!effectiveScheduledTime) {
            try {
                effectiveScheduledTime = minutesToHHMM(getMinAllowedTimeMinutes());
            } catch (e) {
                effectiveScheduledTime = '';
            }
        }
    }
    
    // Prepare order data
    const orderData = {
        items: cart,
        promoCode: appliedPromo ? appliedPromo.code : null,
        discount: appliedPromo ? appliedPromo.discount : 0,
        deliveryFee: deliveryMethod === 'delivery' ? deliveryFee : 0,
        total: total,
        deliveryMethod: deliveryMethod,
        // Normalized alias (server will persist deliveryType for future flows)
        deliveryType: deliveryMethod,
        orderTime: effectiveOrderTime,
        scheduledTime: effectiveScheduledTime,
        customerInfo: customerInfo,
        timestamp: new Date().toISOString(),
        status: 'pending',
        paymentMethod: paymentMethod
    };

    let didNavigate = false;

    try {
        setPlaceOrderLoading(true);

        // Send order to backend
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            const errPayload = await response.json().catch(() => ({}));
            const errTextAny = (errPayload && (errPayload.error || errPayload.message))
                ? String(errPayload.error || errPayload.message)
                : '';
            if (response.status === 423) {
                const errText = errTextAny;
                if (/temporarily\s+closed/i.test(errText)) {
                    setPlaceOrderLoading(false);
                    showRestaurantClosedModal({ type: 'manual' });
                    return;
                }
                // Hours-based closure
                if ((errPayload && errPayload.reason) === 'hours' || /closed/i.test(errText)) {
                    // Prefer delivery hours modal if delivery is selected and we are outside delivery window.
                    if (deliveryMethod === 'delivery') {
                        const nowMins = nowMinutesOfDay();
                        const delivery = getDeliveryWindowMinutes();
                        const outOfDelivery = nowMins < delivery.open || nowMins >= delivery.close;
                        if (outOfDelivery) {
                            setPlaceOrderLoading(false);
                            showDeliveryHoursModal();
                            return;
                        }
                    }
                    setPlaceOrderLoading(false);
                    showWorkingHoursModal();
                    return;
                }
            }
            throw new Error(errTextAny || 'Failed to place order');
        }

        const result = await response.json();
        console.log('Order placed:', result);

        const createdOrderId = result?.order?.id || result?.orderId || '';

        if (result?.payment?.redirectUrl) {
            // Card payment flow: redirect to the provider. Keep cart for now (user might need it if payment fails).
            // We still prevent double-submit by keeping the button locked.
            didNavigate = true;
            window.location.href = result.payment.redirectUrl;
            return;
        }

        // Cash (or non-card) flow: clear cart and redirect immediately to thank-you.
        cart = [];
        clearAppliedPromoState();
        customerInfo = { name: '', phone: '', email: '', city: '', address: '', notes: '' };
        saveCart();

        try {
            localStorage.removeItem(CHECKOUT_STATE_KEY);
        } catch (e) {}

        const orderParam = createdOrderId ? `order=${encodeURIComponent(createdOrderId)}&` : '';
        didNavigate = true;
        window.location.href = `${BASE_PATH}/thank-you?${orderParam}status=success&payment=cash`;
    } catch (error) {
        console.error('Error placing order:', error);
        const msg = (error && error.message) ? String(error.message) : '';
        alert(msg || translations[currentLanguage].orderError);
        setPlaceOrderLoading(false);
    } finally {
        if (!didNavigate) {
            setPlaceOrderLoading(false);
        }
    }
}

// Select delivery method
function selectDeliveryMethod(method) {
    captureCustomerInfoFromDom();
    const prev = deliveryMethod;

    // Checkout is accessible even when closed, but steps are locked.
    // Ignore delivery-method changes while locked.
    if (getRestaurantClosedReason()) {
        renderCheckout();
        applyCheckoutStepVisibility();
        saveCheckoutState();
        return;
    }

    // If delivery is outside delivery hours, keep Delivery disabled.
    if (method === 'delivery') {
        const deliveryClosedReason = getDeliveryClosedReason();
        if (deliveryClosedReason) {
            renderCheckout();
            applyCheckoutStepVisibility();
            requestAnimationFrame(() => {
                const notice = document.getElementById('delivery-hours-notice');
                if (notice) notice.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
            saveCheckoutState();
            return;
        }
    }

    if (method === 'pickup') {
        const pickupClosedReason = getPickupClosedReason();
        if (pickupClosedReason) {
            renderCheckout();
            applyCheckoutStepVisibility();
            requestAnimationFrame(() => {
                const notice = document.getElementById('pickup-disabled-notice');
                if (notice) notice.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
            saveCheckoutState();
            return;
        }
    }

    deliveryMethod = method;

    // If a promo code is restricted to a specific method, drop it when switching.
    const promoAllowed = (appliedPromo?.allowedMethod || 'all').toString().trim().toLowerCase();
    if (appliedPromo && (promoAllowed === 'delivery' || promoAllowed === 'pickup') && promoAllowed !== deliveryMethod) {
        clearAppliedPromoState();
    }

    if (deliveryMethod === 'delivery') {
        // Ensure delivery fee reflects the (possibly preselected) city.
        calculateDeliveryFee();
    }

    const hasProgressBelow = !!(orderTime || scheduledTime || selectedTimeSlot || paymentMethod);
    if (prev && (prev !== method || hasProgressBelow)) {
        resetCheckoutFlowBelowDeliveryMethod();
    }

    enforceOrderSettingsConstraints();
    
    renderCheckout();
    applyCheckoutStepVisibility();

    // Scroll user to the next step
    const orderTimeSection = document.getElementById('order-time-section');
    if (orderTimeSection) {
        orderTimeSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    saveCheckoutState();
}

// Select order time
function selectOrderTime(time) {
    captureCustomerInfoFromDom();

    if (time === 'later' && orderSettings?.allowOrderLater === false) {
        return;
    }

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
    
    if (time !== 'later') {
        scheduledTime = '';
        selectedTimeSlot = '';
    }
    
    renderCheckout();
    saveCheckoutState();

    if (time === 'later') {
        // Ensure the selected time is always valid for the chosen delivery method.
        initializeTimePicker();

        // After re-render, ensure the time picker is centered on mobile.
        const isMobile = !!(window?.matchMedia && window.matchMedia('(max-width: 768px)').matches);
        setTimeout(() => {
            const timePickerSection = document.getElementById('time-picker-section');
            if (!timePickerSection) return;
            timePickerSection.scrollIntoView({
                behavior: 'smooth',
                block: isMobile ? 'center' : 'nearest'
            });
        }, 100);
    } else if (time === 'now') {
        // After re-render, bring Step 3 (payment/customer) into the center of the viewport.
        // Use manual scrollTo because scrollIntoView({block:'center'}) is inconsistent across browsers.
        setTimeout(() => {
            const isMobile = !!(window?.matchMedia && window.matchMedia('(max-width: 768px)').matches);

            // Delivery Step 3 is taller (city/address fields), so centering the whole step often
            // lands the payment title at the top. For delivery+now on mobile, center the title.
            if (deliveryMethod === 'delivery' && isMobile) {
                const paymentTitle = document.getElementById('payment-method-title');
                if (paymentTitle) {
                    scrollElementToViewportCenter(paymentTitle);
                    return;
                }
            }

            const step3 = document.getElementById('payment-customer-section');
            if (!step3) return;
            scrollElementToViewportCenter(step3);
        }, 150);
    }
}

// Select payment method
function selectPaymentMethod(method) {
    captureCustomerInfoFromDom();
    if (method === 'card' && !cardPaymentsEnabled) return;
    paymentMethod = method;
    saveCheckoutState();
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

    const persist = () => saveCheckoutState();
    if (nameInput) nameInput.addEventListener('input', (e) => { customerInfo.name = e.target.value; persist(); });
    if (phoneInput) phoneInput.addEventListener('input', (e) => { customerInfo.phone = e.target.value; persist(); });
    if (emailInput) emailInput.addEventListener('input', (e) => { customerInfo.email = e.target.value; persist(); });
    if (cityInput) cityInput.addEventListener('change', (e) => { customerInfo.city = e.target.value; persist(); });
    if (addressInput) addressInput.addEventListener('input', (e) => { customerInfo.address = e.target.value; persist(); });
    if (notesInput) notesInput.addEventListener('input', (e) => { customerInfo.notes = e.target.value; persist(); });
}

// Calculate delivery fee based on selected city
function calculateDeliveryFee() {
    // Fee is derived from per-city settings during totals calculation.
    updateOrderSummary();
}

// Update only the order summary section
function updateOrderSummary() {
    const summarySection = document.querySelector('.summary-section');
    if (!summarySection) return;
    
    const { subtotal, discount, intermediateSubtotal, deliveryFee, freeDeliveryApplied, total } = calculateTotals();
    const restaurantClosedReason = getRestaurantClosedReason();
    const minOrderAmountNow = getEffectiveMinimumOrderAmountForMethod(deliveryMethod);
    const minCompareAmount = intermediateSubtotal;
    const minNotMet = (minOrderAmountNow > 0 && minCompareAmount < minOrderAmountNow);
    const isClosed = (!!restaurantClosedReason) || (orderSettings?.temporarilyClosed === true);
    
    summarySection.innerHTML = `
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
        <div class="summary-row subtotal">
            <span>${currentLanguage === 'bg' ? 'Междинна сума' : 'Subtotal after discount'}</span>
            <span>${formatPrice(intermediateSubtotal)}</span>
        </div>
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
        ${orderTime === 'later' && selectedTimeSlot ? `
        <div class="summary-row time">
            <span>${deliveryMethod === 'pickup' ? translations[currentLanguage].pickupTime : translations[currentLanguage].deliveryTime}</span>
            <span style="color: #e67e22; font-weight: 700;">${selectedTimeSlot}</span>
        </div>
        ` : ''}
        ${minNotMet ? `
        <div class="order-warning">
            <i class="fas fa-exclamation-triangle"></i>
            <span>${currentLanguage === 'bg' ? `Минимална сума за поръчка: ${formatPrice(minOrderAmountNow)}` : `Minimum order amount: ${formatPrice(minOrderAmountNow)}`}</span>
        </div>
        ` : ''}
        ${orderSettings?.temporarilyClosed === true ? `
        <div class="order-warning">
            <i class="fas fa-exclamation-triangle"></i>
            <span>${currentLanguage === 'bg' ? 'Ресторантът е временно затворен.' : 'The restaurant is temporarily closed.'}</span>
        </div>
        ` : ''}
        <button class="checkout-btn" type="button" onclick="placeOrder()" ${isClosed || minNotMet ? 'disabled' : ''} aria-disabled="${isClosed || minNotMet ? 'true' : 'false'}">
            <i class="fas fa-${deliveryMethod === 'delivery' ? 'truck' : 'shopping-bag'}"></i>
            <span data-translate="placeOrder">${deliveryMethod === 'delivery' ? translations[currentLanguage].orderDelivery : translations[currentLanguage].orderPickup}</span>
        </button>
    `;

    applyCheckoutAvailabilityUi();
}

// Place order


