// Dynamic Base Path Detection (supports deployment under a subdirectory like /resturant-website)
const BASE_PATH = window.location.pathname.includes('/resturant-website') ? '/resturant-website' : '';
// API Configuration (prefix with BASE_PATH)
const API_URL = `${BASE_PATH}/api`;

// Initialize app
let products = [];
let categories = [];
let currentCategory = 'all';
const LANGUAGE_STORAGE_KEY = 'language';
const LANGUAGE_USER_SELECTED_KEY = 'language_user_selected_v1';

function getInitialLanguage() {
    const stored = (localStorage.getItem(LANGUAGE_STORAGE_KEY) || '').toString().trim().toLowerCase();
    const storedValid = (stored === 'en' || stored === 'bg') ? stored : '';

    // If the user has never explicitly chosen a language, force BG as the initial language.
    // This avoids older versions accidentally persisting EN as default.
    const userSelected = localStorage.getItem(LANGUAGE_USER_SELECTED_KEY) === '1';
    if (!userSelected) return 'bg';

    return storedValid || 'bg';
}

let currentLanguage = getInitialLanguage();
let appliedPromoCode = null;
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let currencySettings = {};

let siteSettings = null;
let siteSearchMode = 'names_and_descriptions';
let siteWorkingHours = null;

let modalProductId = null;
let modalQuantity = 1;

let topBarHeightSyncInitialized = false;

function syncTopBarHeightCssVar() {
    const topBar = document.querySelector('.top-bar');
    if (!topBar) return;
    const height = Math.ceil(topBar.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--top-bar-height', `${height}px`);
}

function initTopBarHeightSync() {
    if (topBarHeightSyncInitialized) return;
    topBarHeightSyncInitialized = true;

    const run = () => syncTopBarHeightCssVar();
    run();
    requestAnimationFrame(run);
    window.addEventListener('resize', () => requestAnimationFrame(run));
    window.addEventListener('orientationchange', run);
}

function getTopBarHeight() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--top-bar-height');
    const val = parseFloat(raw);
    if (Number.isFinite(val) && val > 0) return val;
    const topBar = document.querySelector('.top-bar');
    return topBar ? topBar.getBoundingClientRect().height : 0;
}

// Translations
const translations = {
    en: {
        categories: 'Menu Categories',
        searchPlaceholder: 'Search for dishes...',
        allItems: 'ALL ITEMS',
        noResults: 'No products found',
        addToCart: 'Add to Cart',
        addedToCart: 'Added to cart!',
        promo: 'PROMO',
        bundle: 'BUNDLE',
        save: 'SAVE'
    },
    bg: {
        categories: 'Категории Меню',
        searchPlaceholder: 'Търсене на ястия...',
        allItems: 'ВСИЧКИ ПРОДУКТИ',
        noResults: 'Не са намерени продукти',
        addToCart: 'Добави',
        addedToCart: 'Добавено в количката!',
        promo: 'ПРОМО',
        bundle: 'КОМБО',
        save: 'СПЕСТИ'
    }
};

function t(key, fallback) {
    const value = translations?.[currentLanguage]?.[key];
    return value || fallback || key;
}

// Switch language
function switchLanguage(lang) {
    currentLanguage = (lang === 'en' || lang === 'bg') ? lang : 'bg';
    localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
    localStorage.setItem(LANGUAGE_USER_SELECTED_KEY, '1');
    
    // Update active button
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    
    // Update dropdown value
    const dropdown = document.getElementById('lang-dropdown');
    if (dropdown) {
        dropdown.value = lang;
    }
    
    // Update all translatable elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) {
            el.textContent = translations[lang][key];
        }
    });
    
    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[lang][key]) {
            el.placeholder = translations[lang][key];
        }
    });
    
    // Re-render products to update Add to Cart buttons
    renderProducts();
    
    // Re-render to apply translations
    renderCategories();
    renderProducts();
}

// Initialize language on page load
function initLanguage() {
    // Set active button
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLanguage);
    });
    
    // Set dropdown value
    const dropdown = document.getElementById('lang-dropdown');
    if (dropdown) {
        dropdown.value = currentLanguage;
    }
    
    // Apply translations
    switchLanguage(currentLanguage);
}

// Load data from server
async function loadData() {
    try {
        // Load products
        const productsResponse = await fetch(`${API_URL}/products`);
        products = await productsResponse.json();
        
        // Load restaurant settings (name and logo)
        const settingsResponse = await fetch(`${API_URL}/settings`);
        const settingsData = await settingsResponse.json();
        document.getElementById('restaurant-name').textContent = settingsData.name;
        
        // Display logo if available
        const logoElement = document.getElementById('restaurant-logo');
        if (settingsData.logo) {
            logoElement.src = settingsData.logo;
            logoElement.classList.add('visible');
        } else {
            logoElement.classList.remove('visible');
        }
        
        // Load customization
        const customResponse = await fetch(`${API_URL}/settings/customization`);
        const customData = await customResponse.json();
        applyCustomization(customData);
        
        // Load currency settings
        const currencyResponse = await fetch(`${API_URL}/settings/currency`);
        currencySettings = await currencyResponse.json();

        // Load site settings (search mode, footer, legal)
        try {
            const siteRes = await fetch(`${API_URL}/settings/site`);
            if (siteRes.ok) {
                siteSettings = await siteRes.json();
                siteSearchMode = siteSettings?.search?.mode === 'names_only' ? 'names_only' : 'names_and_descriptions';
            }
        } catch (e) {
            // ignore
        }

        // Load working hours for footer display
        try {
            const whRes = await fetch(`${API_URL}/settings/working-hours`);
            if (whRes.ok) {
                siteWorkingHours = await whRes.json();
            }
        } catch (e) {
            // ignore
        }
        
        // Initialize language
        initLanguage();

        renderSiteMap();
        renderSiteFooter();
        
        extractCategories();
        renderCategories();
        renderProducts();
        handleInitialProductDeepLink();
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Failed to load menu data. Please make sure the server is running.');
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

    const openingTime = (siteWorkingHours?.openingTime || '').toString().trim();
    const closingTime = (siteWorkingHours?.closingTime || '').toString().trim();
    const hoursText = (openingTime && closingTime) ? `${openingTime} - ${closingTime}` : '';

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
        hoursText ? `<li><strong>${escapeHtml(labels.hours)}:</strong> ${escapeHtml(hoursText)}</li>` : '',
        contacts.phone ? `<li><strong>${escapeHtml(labels.phone)}:</strong> ${escapeHtml(contacts.phone)}</li>` : '',
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

// Show error message
function showError(message) {
    const container = document.getElementById('products-container');
    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #e74c3c;">
            <i class="fas fa-exclamation-circle" style="font-size: 60px; margin-bottom: 20px;"></i>
            <h3>${message}</h3>
            <p style="margin-top: 10px; color: #666;">Make sure to run: npm install && npm start</p>
        </div>
    `;
}

// Extract unique categories from products
function extractCategories() {
    const uniqueCategories = [...new Set(products.map(p => p.category))];
    
    // Separate special categories from regular ones
    const specialCategories = [];
    const regularCategories = [];
    
    uniqueCategories.forEach(cat => {
        if (cat === 'Combos & Bundles' || cat === 'Promotions') {
            specialCategories.push(cat);
        } else {
            regularCategories.push(cat);
        }
    });
    
    // Add "Promotions" category if there are products with promotions
    const hasPromoProducts = products.some(p => p.promo && (p.promo.isActive || p.promo.enabled));
    if (hasPromoProducts && !specialCategories.includes('Promotions')) {
        specialCategories.push('Promotions');
    }
    
    // Sort: Promotions first, then Combos & Bundles, then alphabetically sorted regular categories
    specialCategories.sort((a, b) => {
        if (a === 'Promotions') return -1;
        if (b === 'Promotions') return 1;
        return 0;
    });
    
    regularCategories.sort();
    
    // Combine: special categories first, then regular
    categories = [...specialCategories, ...regularCategories];
}

// Render categories in sidebar
function renderCategories() {
    const nav = document.getElementById('categories-nav');
    nav.innerHTML = '';
    
    // Add "All" category
    const allBtn = document.createElement('button');
    allBtn.className = 'category-btn' + (currentCategory === 'all' ? ' active' : '');
    allBtn.textContent = translations[currentLanguage].allItems;
    allBtn.onclick = () => filterByCategory('all');
    nav.appendChild(allBtn);
    
    // Add other categories
    categories.forEach(category => {
        const btn = document.createElement('button');
        btn.className = 'category-btn' + (currentCategory === category ? ' active' : '');
        
        // Try to get Bulgarian translation for category
        let displayName = category;
        if (currentLanguage === 'bg') {
            // Special translation for Promotions category
            if (category === 'Promotions') {
                displayName = 'Промоции';
            } else if (category === 'Combos & Bundles') {
                displayName = 'Комбо и Бъндъл Оферти';
            } else {
                const productWithCategory = products.find(p => p.category === category && p.translations?.bg?.category);
                if (productWithCategory) {
                    displayName = productWithCategory.translations.bg.category;
                }
            }
        }
        
        btn.textContent = displayName.toUpperCase();
        btn.onclick = () => filterByCategory(category);
        nav.appendChild(btn);
    });
}

// Filter products by category
function scrollToProductsTop({ behavior = 'auto' } = {}) {
    const container = document.getElementById('products-container') || document.querySelector('.content');
    if (!container) return;

    // Scroll slightly higher so the first products aren't tucked under the header.
    const offset = getTopBarHeight() + 24 + 40;
    const rect = container.getBoundingClientRect();
    const targetTop = rect.top + window.pageYOffset - offset;

    window.scrollTo({ top: Math.max(0, targetTop), behavior });
}

function filterByCategory(category, options = {}) {
    const { scrollToTop = true, scrollBehavior = 'smooth' } = options;
    currentCategory = category;
    renderCategories();
    renderProducts();

    if (scrollToTop) {
        // Run after render so layout is stable and scroll target is correct.
        requestAnimationFrame(() => scrollToProductsTop({ behavior: scrollBehavior }));
    }
}

function buildProductShareUrl(productId) {
    const url = new URL(window.location.href);
    url.searchParams.set('product', String(productId));
    url.hash = '';
    return url.toString();
}

async function shareProduct(productId) {
    const product = (products || []).find(p => String(p.id) === String(productId));
    const name = product
        ? ((currentLanguage === 'bg' && product.translations?.bg?.name) ? product.translations.bg.name : product.name)
        : 'Product';
    const url = buildProductShareUrl(productId);

    try {
        if (navigator.share) {
            await navigator.share({ title: name, text: name, url });
            return;
        }
    } catch (e) {
        // fall back
    }

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
            alert(currentLanguage === 'bg' ? 'Линкът е копиран!' : 'Link copied!');
            return;
        }
    } catch (e) {
        // ignore
    }

    window.prompt(currentLanguage === 'bg' ? 'Копирай линка:' : 'Copy the link:', url);
}

let didHandleInitialDeepLink = false;
function handleInitialProductDeepLink() {
    if (didHandleInitialDeepLink) return;
    didHandleInitialDeepLink = true;

    let productId = '';
    try {
        const url = new URL(window.location.href);
        productId = (url.searchParams.get('product') || '').toString().trim();
    } catch (e) {
        return;
    }

    if (!productId) return;

    const product = (products || []).find(p => String(p.id) === String(productId));
    if (!product) return;

    setTimeout(() => jumpToProduct(product), 50);
}

function getCategoryDisplayName(category) {
    if (currentLanguage !== 'bg') return category;

    if (category === 'Promotions') return 'Промоции';
    if (category === 'Combos & Bundles') return 'Комбо и Бъндъл Оферти';

    const productWithCategory = products.find(p => p.category === category && p.translations?.bg?.category);
    return productWithCategory ? productWithCategory.translations.bg.category : category;
}

// Render products
function renderProducts() {
    const container = document.getElementById('products-container');
    const emptyState = document.getElementById('empty-state');
    
    let filteredProducts = products;
    
    // Filter by category
    if (currentCategory !== 'all') {
        if (currentCategory === 'Promotions') {
            // Show all products with active promotions
            filteredProducts = filteredProducts.filter(p => p.promo && (p.promo.isActive || p.promo.enabled));
        } else {
            // Show products in selected category OR products with promotions if category is Promotions
            filteredProducts = filteredProducts.filter(p => p.category === currentCategory);
        }
    }
    
    // Show/hide empty state
    if (filteredProducts.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    } else {
        container.style.display = 'grid';
        emptyState.style.display = 'none';
    }
    
    // Render product cards
    container.innerHTML = '';
    filteredProducts.forEach(product => {
        const card = createProductCard(product);
        container.appendChild(card);
    });
}

// Format price (EUR only)
function formatPrice(priceEUR) {
    return `<span class="price-eur">${Number(priceEUR || 0).toFixed(2)} €</span>`;
}

// Create product card element
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.productId = String(product.id);
    card.onclick = () => openProductModal(product);
    
    // Get translated content
    let name = (currentLanguage === 'bg' && product.translations?.bg?.name) ? product.translations.bg.name : product.name;
    const description = (currentLanguage === 'bg' && product.translations?.bg?.description) ? product.translations.bg.description : product.description;
    const category = (currentLanguage === 'bg' && product.translations?.bg?.category) ? product.translations.bg.category : product.category;
    
    // Name wrapping is handled in CSS (2-line clamp), avoid JS truncation.
    
    // Handle image URL (check if it's a server upload or external URL)
    let imageUrl = product.image;
    if (imageUrl && imageUrl.startsWith('/uploads/')) {
        // Serve uploads relative to BASE_PATH
        imageUrl = `${BASE_PATH}${imageUrl}`;
    } else if (!imageUrl) {
        imageUrl = 'https://via.placeholder.com/280x200?text=No+Image';
    }
    
    const hasPromo = isPromoActive(product.promo);
    const effectivePrice = getEffectivePrice(product);
    const hasSpecialLabel = product.specialLabel && product.specialLabel.trim() !== '';
    
    // Calculate discount percentage
    let discountPercent = 0;
    let bundleOriginalPrice = 0;
    if (hasPromo && product.price > 0) {
        discountPercent = Math.round(((product.price - effectivePrice) / product.price) * 100);
    } else if (product.isCombo && product.comboProducts && product.comboProducts.length > 0) {
        // Calculate bundle discount
        const originalTotal = product.comboProducts.reduce((sum, productId) => {
            const bundleProduct = products.find(p => p.id === productId);
            return sum + (bundleProduct ? bundleProduct.price : 0);
        }, 0);
        bundleOriginalPrice = originalTotal;
        // Calculate discount percentage even if price equals or exceeds original
        if (originalTotal > 0 && product.price < originalTotal) {
            discountPercent = Math.round(((originalTotal - product.price) / originalTotal) * 100);
        }
    }
    
    let priceHTML;
    if (hasPromo) {
        priceHTML = `
            <div class="product-price-wrapper">
                <span class="product-price promo-price">${formatPrice(effectivePrice)}</span>
                <span class="product-price-original">${formatPrice(product.price)}</span>
            </div>
        `;
    } else if (product.isCombo && bundleOriginalPrice > product.price) {
        // Show bundle savings
        priceHTML = `
            <div class="product-price-wrapper">
                <span class="product-price promo-price">${formatPrice(product.price)}</span>
                <span class="product-price-original">${formatPrice(bundleOriginalPrice)}</span>
            </div>
        `;
    } else {
        priceHTML = `<span class="product-price">${formatPrice(product.price)}</span>`;
    }
    
    // Badge HTML - show promo or special label with discount percentage
    let badgeHTML = '';
    if (hasPromo) {
        // Show PROMO badge AND discount percentage separately
        if (discountPercent > 0) {
            badgeHTML = `
                <div class="badge-container">
                    <div class="promo-badge"><i class="fas fa-tag"></i> ${translations[currentLanguage].promo}</div>
                    <div class="promo-badge"><i class="fas fa-percent"></i> -${discountPercent}%</div>
                </div>
            `;
        } else {
            // Fallback if calculation fails
            badgeHTML = `<div class="badge-container"><div class="promo-badge"><i class="fas fa-tag"></i> ${translations[currentLanguage].promo}</div></div>`;
        }
    } else if (product.isCombo) {
        // Always show badge for bundles
        if (discountPercent > 0) {
            badgeHTML = `
                <div class="badge-container">
                    <div class="promo-badge" style="background: #27ae60;"><i class="fas fa-box"></i> ${translations[currentLanguage].bundle}</div>
                    <div class="promo-badge" style="background: #27ae60;"><i class="fas fa-percent"></i> -${discountPercent}%</div>
                </div>
            `;
        } else if (hasSpecialLabel) {
            badgeHTML = `<div class="badge-container"><div class="promo-badge" style="background: #27ae60;"><i class="fas fa-star"></i> ${product.specialLabel.toUpperCase()}</div></div>`;
        } else {
            // Fallback for bundles without calculated discount
            badgeHTML = `<div class="badge-container"><div class="promo-badge" style="background: #27ae60;"><i class="fas fa-box"></i> ${translations[currentLanguage].bundle}</div></div>`;
        }
    } else if (hasSpecialLabel) {
        // Show custom label if no discount calculated but special label exists
        badgeHTML = `<div class="badge-container"><div class="promo-badge" style="background: #27ae60;"><i class="fas fa-star"></i> ${product.specialLabel.toUpperCase()}</div></div>`;
    }
    
    card.innerHTML = `
        ${badgeHTML}
        <div class="product-image-wrap">
            <img src="${imageUrl}" 
                 alt="${name}" 
                 class="product-image"
                 onerror="this.src='https://via.placeholder.com/280x200?text=No+Image'">
            ${product.weight ? `<span class="product-weight-overlay">${product.weight}</span>` : ''}
        </div>
        <div class="product-info">
            <div class="product-name">${name}</div>
            <div class="product-description">${description}</div>
            <div class="product-footer">
                ${priceHTML}
                <span class="product-category">${category}</span>
            </div>
            <div class="product-actions">
                <button onclick="event.stopPropagation(); addToCart(${product.id})" class="add-to-cart-btn">
                    <i class="fas fa-shopping-cart"></i> ${translations[currentLanguage].addToCart}
                </button>
                <button onclick="event.stopPropagation(); shareProduct(${product.id})" class="share-product-btn" title="${(currentLanguage === 'bg' ? 'Сподели' : 'Share')}">
                    <i class="fas fa-share-alt"></i>
                </button>
            </div>
        </div>
    `;
    
    return card;
}

// Open product modal
function openProductModal(product) {
    const modal = document.getElementById('product-modal');

    modalProductId = product.id;
    modalQuantity = 1;
    
    // Get translated content
    const name = (currentLanguage === 'bg' && product.translations?.bg?.name) ? product.translations.bg.name : product.name;
    const description = (currentLanguage === 'bg' && product.translations?.bg?.description) ? product.translations.bg.description : product.description;
    
    let imageUrl = product.image;
    if (imageUrl && imageUrl.startsWith('/uploads/')) {
        imageUrl = `${BASE_PATH}${imageUrl}`;
    } else if (!imageUrl) {
        imageUrl = 'https://via.placeholder.com/300x300?text=No+Image';
    }
    
    const hasPromo = isPromoActive(product.promo);
    const effectivePrice = getEffectivePrice(product);
    
    // Calculate discount percentage for modal
    let discountPercent = 0;
    let bundleOriginalPrice = 0;
    if (hasPromo && product.price > 0) {
        discountPercent = Math.round(((product.price - effectivePrice) / product.price) * 100);
    } else if (product.isCombo && product.comboProducts && product.comboProducts.length > 0) {
        const originalTotal = product.comboProducts.reduce((sum, productId) => {
            const bundleProduct = products.find(p => p.id === productId);
            return sum + (bundleProduct ? bundleProduct.price : 0);
        }, 0);
        bundleOriginalPrice = originalTotal;
        if (originalTotal > 0 && product.price < originalTotal) {
            discountPercent = Math.round(((originalTotal - product.price) / originalTotal) * 100);
        }
    }
    
    const modalImage = document.getElementById('modal-image');
    modalImage.src = imageUrl;
    modalImage.alt = name;

    document.getElementById('modal-name').textContent = name;
    document.getElementById('modal-description').textContent = description;

    const weightEl = document.getElementById('modal-weight');
    if (product.weight) {
        weightEl.style.display = 'block';
        weightEl.innerHTML = `<i class="fas fa-weight"></i> ${product.weight}`;
    } else {
        weightEl.style.display = 'none';
        weightEl.textContent = '';
    }

    const unitPrice = hasPromo ? effectivePrice : getEffectivePrice(product);
    const qtyDisplay = document.getElementById('modal-qty-display');
    const bigPrice = document.getElementById('modal-big-price');

    function updateModalPricing() {
        qtyDisplay.textContent = String(modalQuantity);
        bigPrice.innerHTML = `${formatPrice(unitPrice * modalQuantity)}`;
    }

    document.getElementById('modal-qty-minus').onclick = () => {
        modalQuantity = Math.max(1, modalQuantity - 1);
        updateModalPricing();
    };
    document.getElementById('modal-qty-plus').onclick = () => {
        modalQuantity = modalQuantity + 1;
        updateModalPricing();
    };
    updateModalPricing();

    const addToCartBtn = document.getElementById('modal-add-to-cart');
    addToCartBtn.innerHTML = `<i class="fas fa-shopping-cart"></i> ${translations[currentLanguage].addToCart}`;
    addToCartBtn.onclick = () => {
        if (!modalProductId) return;
        addToCartWithQuantity(modalProductId, modalQuantity);
        closeModal();
    };

    modal.style.display = 'block';
}

// Close modal
function closeModal() {
    document.getElementById('product-modal').style.display = 'none';
    modalProductId = null;
    modalQuantity = 1;
}

function isProductMatch(product, searchTerm) {
    const term = (searchTerm || '').toLowerCase().trim();
    if (!term || term.length < 2) return false;

    const nameEN = (product.name || '').toLowerCase();
    const descriptionEN = (product.description || '').toLowerCase();
    const nameBG = (product.translations?.bg?.name || '').toLowerCase();
    const descriptionBG = (product.translations?.bg?.description || '').toLowerCase();

    const includeDescriptions = siteSearchMode !== 'names_only';

    return (
        nameEN.includes(term) ||
        nameBG.includes(term) ||
        (includeDescriptions && (descriptionEN.includes(term) || descriptionBG.includes(term)))
    );
}

// Add-to-cart button click animation (desktop + mobile)
document.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('.add-to-cart-btn');
    if (!btn) return;
    btn.classList.remove('btn-click-animate');
    // Force reflow so animation can retrigger
    void btn.offsetWidth;
    btn.classList.add('btn-click-animate');
    window.setTimeout(() => btn.classList.remove('btn-click-animate'), 1100);
}, true);

function hideSearchDropdown() {
    const dropdown = document.getElementById('search-results');
    if (dropdown) {
        dropdown.classList.remove('show');
        dropdown.innerHTML = '';
    }
}

function isDesktopSearch() {
    return !!(window?.matchMedia && window.matchMedia('(min-width: 769px)').matches);
}

function setSearchFocusActive(active) {
    if (!isDesktopSearch()) return;
    document.body.classList.toggle('search-focus-active', !!active);
}

function closeSearchFocus() {
    const input = document.getElementById('search-input');
    if (input) {
        input.value = '';
        input.blur();
    }
    hideSearchDropdown();
    setSearchFocusActive(false);
}

function renderSearchDropdown() {
    const searchInput = document.getElementById('search-input');
    const dropdown = document.getElementById('search-results');
    if (!searchInput || !dropdown) return;

    const term = (searchInput.value || '').toLowerCase().trim();
    if (!term || term.length < 2) {
        hideSearchDropdown();
        return;
    }

    const matches = products.filter(p => isProductMatch(p, term));
    if (matches.length === 0) {
        dropdown.innerHTML = `<div class="search-no-results">${translations[currentLanguage].noResults}</div>`;
        dropdown.classList.add('show');
        return;
    }

    const grouped = new Map();
    for (const product of matches) {
        const category = product.category || 'Other';
        if (!grouped.has(category)) grouped.set(category, []);
        grouped.get(category).push(product);
    }

    const orderedCategories = [
        ...categories.filter(c => grouped.has(c)),
        ...[...grouped.keys()].filter(c => !categories.includes(c)).sort()
    ];

    let totalShown = 0;
    const maxShown = 20;
    dropdown.innerHTML = '';

    for (const category of orderedCategories) {
        const groupItems = grouped.get(category) || [];
        if (groupItems.length === 0) continue;

        const title = document.createElement('div');
        title.className = 'search-result-group-title';
        title.textContent = getCategoryDisplayName(category);
        dropdown.appendChild(title);

        for (const product of groupItems) {
            if (totalShown >= maxShown) break;
            totalShown++;

            const name = (currentLanguage === 'bg' && product.translations?.bg?.name) ? product.translations.bg.name : product.name;
            const effectivePrice = getEffectivePrice(product);

            let imageUrl = product.image;
            if (imageUrl && imageUrl.startsWith('/uploads/')) {
                imageUrl = `${BASE_PATH}${imageUrl}`;
            } else if (!imageUrl) {
                imageUrl = 'https://via.placeholder.com/80x80?text=No+Image';
            }

            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
                <img class="search-result-img" src="${imageUrl}" alt="${name}" onerror="this.src='https://via.placeholder.com/80x80?text=No+Image'">
                <div class="search-result-info">
                    <div class="search-result-name">${name}</div>
                    <div class="search-result-meta">
                        ${product.weight ? `<span class="search-result-weight">${product.weight}</span>` : ''}
                        <span class="search-result-category">${getCategoryDisplayName(product.category)}</span>
                    </div>
                </div>
                <div class="search-result-price">${formatPrice(effectivePrice)}</div>
            `;

            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Close search UI first (especially on mobile) before navigating.
                closeMobileSearch();
                setTimeout(() => jumpToProduct(product), 0);
            });

            dropdown.appendChild(item);
        }

        if (totalShown >= maxShown) break;
    }

    dropdown.classList.add('show');
}

function jumpToProduct(product) {
    if (!product) return;

    const category = product.category || 'all';
    filterByCategory(category, { scrollToTop: false });

    const tryScroll = () => {
        const card = document.querySelector(`.product-card[data-product-id="${product.id}"]`);
        if (!card) return false;
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.remove('pulse');
        void card.offsetWidth;
        card.classList.add('pulse');
        return true;
    };

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (tryScroll()) return;
            setTimeout(tryScroll, 120);
        });
    });
}

function toggleMobileSearch() {
    const container = document.getElementById('search-container');
    if (!container) return;
    container.classList.toggle('active');

    document.body.classList.toggle('mobile-search-open', container.classList.contains('active'));

    const input = document.getElementById('search-input');
    if (container.classList.contains('active') && input) {
        input.focus();
    } else {
        hideSearchDropdown();
    }
}

function closeMobileSearch() {
    const container = document.getElementById('search-container');
    if (container) container.classList.remove('active');
    document.body.classList.remove('mobile-search-open');
    setSearchFocusActive(false);
    const input = document.getElementById('search-input');
    if (input) input.value = '';
    hideSearchDropdown();
}

// Search functionality
document.addEventListener('DOMContentLoaded', function() {
    initTopBarHeightSync();
    loadData();
    
    // Search input
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', renderSearchDropdown);
    searchInput.addEventListener('focus', () => {
        setSearchFocusActive(true);
    });
    searchInput.addEventListener('blur', () => {
        // If user leaves search with no query and no dropdown, remove overlay.
        setTimeout(() => {
            const val = (searchInput.value || '').trim();
            const dropdown = document.getElementById('search-results');
            const dropdownOpen = !!(dropdown && dropdown.classList.contains('show'));
            if (!dropdownOpen && !val) {
                setSearchFocusActive(false);
            }
        }, 0);
    });
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSearchFocus();
            return;
        }
        if (e.key === 'Enter') {
            const firstItem = document.querySelector('#search-results .search-result-item');
            if (firstItem) firstItem.click();
        }
    });

    // Clicking the blurred overlay should close the search (desktop)
    const overlay = document.getElementById('search-focus-overlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            closeSearchFocus();
        });
    }
    
    // Modal close button
    const closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) closeBtn.onclick = closeModal;

    // Close modal when clicking outside (shell overlay covers the full screen)
    const modal = document.getElementById('product-modal');
    const shell = document.querySelector('#product-modal .product-modal-shell');
    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeModal();
        });
    }
    if (shell) {
        shell.addEventListener('click', (event) => {
            if (event.target === shell) closeModal();
        });
    }

    document.addEventListener('click', (e) => {
        const searchContainer = document.getElementById('search-container');
        if (!searchContainer) return;
        if (!searchContainer.contains(e.target)) {
            closeSearchFocus();
        }
    });
});

// Apply customization
function applyCustomization(custom) {
    const root = document.documentElement;
    
    // Apply colors
    root.style.setProperty('--top-bar-color', custom.topBarColor || '#2c3e50');
    root.style.setProperty('--background-color', custom.backgroundColor || '#f5f5f5');
    root.style.setProperty('--highlight-color', custom.highlightColor || '#e74c3c');
    root.style.setProperty('--price-color', custom.priceColor || '#e74c3c');
    
    // Apply background
    if (custom.backgroundImage) {
        document.body.style.backgroundImage = `url('${custom.backgroundImage}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundAttachment = 'fixed';
    } else {
        document.body.style.backgroundImage = 'none';
        document.body.style.backgroundColor = custom.backgroundColor || '#f5f5f5';
    }
}

// Check if promo is active
function isPromoActive(promo) {
    if (!promo || !promo.enabled) return false;
    
    if (promo.type === 'permanent') return true;
    
    if (promo.type === 'timed' && promo.startDate && promo.endDate) {
        const now = new Date();
        const start = new Date(promo.startDate);
        const end = new Date(promo.endDate);
        return now >= start && now <= end;
    }
    
    return false;
}

// Get effective price
function getEffectivePrice(product) {
    let price = product.price;
    
    // First check product-specific promo
    if (isPromoActive(product.promo)) {
        price = product.promo.price;
    }
    
    // Then apply promo code if applicable
    if (appliedPromoCode) {
        if (appliedPromoCode.category === 'all' || appliedPromoCode.category === product.category) {
            price = price * (1 - appliedPromoCode.discount / 100);
        }
    }
    
    return price;
}

// Apply promo code
async function applyPromoCode() {
    const input = document.getElementById('promo-code-input');
    const message = document.getElementById('promo-message');
    const code = input.value.trim().toUpperCase();
    
    if (!code) {
        message.style.display = 'block';
        message.style.color = '#e74c3c';
        message.innerHTML = '<i class="fas fa-exclamation-circle"></i> Please enter a promo code';
        return;
    }
    
    try {
        // Validate against first product's category to test
        const response = await fetch(`${API_URL}/promo-codes/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code, category: 'all' })
        });
        
        const result = await response.json();
        
        if (result.valid) {
            appliedPromoCode = result;
            message.style.display = 'block';
            message.style.color = '#27ae60';
            message.innerHTML = `<i class="fas fa-check-circle"></i> Promo code applied! ${result.discount}% off ${result.category === 'all' ? 'all items' : result.category}`;
            input.style.borderColor = '#27ae60';
            
            // Re-render products with new prices
            renderProducts();
        } else {
            message.style.display = 'block';
            message.style.color = '#e74c3c';
            message.innerHTML = '<i class="fas fa-times-circle"></i> Invalid or expired promo code';
            input.style.borderColor = '#e74c3c';
        }
    } catch (error) {
        console.error('Error validating promo code:', error);
        message.style.display = 'block';
        message.style.color = '#e74c3c';
        message.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error validating promo code';
    }
}

// ========== SHOPPING CART FUNCTIONS ==========

// Add item to cart
function addToCart(productId) {
    addToCartWithQuantity(productId, 1);
}

function addToCartWithQuantity(productId, quantity) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const qty = Math.max(1, Number(quantity) || 1);

    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += qty;
    } else {
        cart.push({
            id: product.id,
            name: currentLanguage === 'bg' && product.translations?.bg?.name ? product.translations.bg.name : product.name,
            price: getEffectivePrice(product),
            originalPrice: product.price,
            image: product.image,
            category: product.category,
            weight: product.weight,
            quantity: qty,
            translations: product.translations
        });
    }

    saveCart();
    updateCartUI();
    animateCartBadge();
}

// Remove item from cart
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartUI();
}

// Update item quantity
function updateCartQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (!item) return;
    
    item.quantity += change;
    
    if (item.quantity <= 0) {
        removeFromCart(productId);
    } else {
        saveCart();
        updateCartUI();
    }
}

// Save cart to localStorage
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Update cart UI
function updateCartUI() {
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCountElement = document.getElementById('cart-count');
    const cartBadge = document.querySelector('.cart-badge');
    
    if (cartCountElement) {
        cartCountElement.textContent = cartCount;
    }
    
    if (cartBadge) {
        cartBadge.textContent = cartCount;
        cartBadge.style.display = cartCount > 0 ? 'flex' : 'none';
    }
}

function animateCartBadge() {
    const cartBadge = document.querySelector('.cart-badge');
    if (!cartBadge) return;
    cartBadge.classList.remove('cart-badge-animate');
    void cartBadge.offsetWidth;
    cartBadge.classList.add('cart-badge-animate');
}

// Show cart notification
function showCartNotification(message) {
    // No-op: replaced with cart badge animation.
}

// Navigate to menu (scroll to top and show all items)
function navigateToMenu() {
    currentCategory = 'all';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderCategories();
    renderProducts();
}

// Initialize cart on page load
document.addEventListener('DOMContentLoaded', function() {
    updateCartUI();
    
    // Make logo clickable
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.addEventListener('click', navigateToMenu);
    }
});
