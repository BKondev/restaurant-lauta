// Dynamic Base Path Detection (supports deployment under a subdirectory like /resturant-website)
const BASE_PATH = window.location.pathname.includes('/resturant-website') ? '/resturant-website' : '';
// API Configuration (prefix with BASE_PATH)
const API_URL = `${BASE_PATH}/api`;

// Initialize app
let products = [];
let categories = [];
let currentCategory = 'all';
let currentLanguage = localStorage.getItem('language') || 'en';
let appliedPromoCode = null;
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let currencySettings = {
    eurToBgnRate: 1.9558,
    showBgnPrices: true
};

let modalProductId = null;
let modalQuantity = 1;

// Translations
const translations = {
    en: {
        categories: 'Menu Categories',
        searchPlaceholder: 'Search for dishes...',
        allItems: 'ALL ITEMS',
        noResults: 'No products found',
        addToCart: 'Add to Cart',
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
        promo: 'ПРОМО',
        bundle: 'КОМБО',
        save: 'СПЕСТИ'
    }
};

// Switch language
function switchLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    
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
        
        // Initialize language
        initLanguage();
        
        extractCategories();
        renderCategories();
        renderProducts();
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Failed to load menu data. Please make sure the server is running.');
    }
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
function filterByCategory(category) {
    currentCategory = category;
    renderCategories();
    renderProducts();
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

// Format price with EUR and BGN
function formatPrice(priceEUR) {
    const priceBGN = (priceEUR * currencySettings.eurToBgnRate).toFixed(2);
    
    if (currencySettings.showBgnPrices) {
        return `<span class="price-bgn">${priceBGN} лв</span> <span class="price-separator">/</span> <span class="price-eur">€${priceEUR.toFixed(2)}</span>`;
    } else {
        return `<span class="price-eur">€${priceEUR.toFixed(2)}</span>`;
    }
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
            <button onclick="event.stopPropagation(); addToCart(${product.id})" class="add-to-cart-btn">
                <i class="fas fa-shopping-cart"></i> ${translations[currentLanguage].addToCart}
            </button>
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
    const qtyLine = document.getElementById('modal-qty-line');
    const bigPrice = document.getElementById('modal-big-price');

    const unitPriceLabel = currentLanguage === 'bg' ? 'ед. цена' : 'unit price';
    qtyLine.innerHTML = `<span class="product-modal-unitprice">${formatPrice(unitPrice)}</span> <span class="product-modal-unitprice-label">${unitPriceLabel}</span>`;

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
        showCartNotification('Item(s) added to cart!');
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

    return (
        nameEN.includes(term) ||
        descriptionEN.includes(term) ||
        nameBG.includes(term) ||
        descriptionBG.includes(term)
    );
}

function hideSearchDropdown() {
    const dropdown = document.getElementById('search-results');
    if (dropdown) {
        dropdown.classList.remove('show');
        dropdown.innerHTML = '';
    }
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
    filterByCategory(category);

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
    const input = document.getElementById('search-input');
    if (input) input.value = '';
    hideSearchDropdown();
}

// Search functionality
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    
    // Search input
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', renderSearchDropdown);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideSearchDropdown();
            return;
        }
        if (e.key === 'Enter') {
            const firstItem = document.querySelector('#search-results .search-result-item');
            if (firstItem) firstItem.click();
        }
    });
    
    // Modal close button
    const closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) closeBtn.onclick = closeModal;
    
    // Close modal when clicking outside
    window.onclick = function(event) {
        const modal = document.getElementById('product-modal');
        if (event.target === modal) {
            closeModal();
        }
    };

    document.addEventListener('click', (e) => {
        const searchContainer = document.getElementById('search-container');
        if (!searchContainer) return;
        if (!searchContainer.contains(e.target)) {
            hideSearchDropdown();
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
    showCartNotification('Item added to cart!');
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

// Show cart notification
function showCartNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: #27ae60;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    notification.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
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
