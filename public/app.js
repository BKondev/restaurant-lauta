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
let siteOrderSettings = null;

let restaurantLogoUrl = '';

let modalProductId = null;
let modalQuantity = 1;

// Promotional slideshow state
let slideshowSettings = null;
let slideshowCurrentIndex = 0;
let slideshowAutoplayTimer = null;

// Broken image retry throttle
const BROKEN_IMAGE_COOLDOWN_MS = 5 * 60 * 1000;
const BROKEN_IMAGE_COOLDOWN_STORAGE_KEY = 'broken_image_cooldown_v1';
let brokenImageCooldown = new Map();

function loadBrokenImageCooldown() {
    try {
        const raw = (localStorage.getItem(BROKEN_IMAGE_COOLDOWN_STORAGE_KEY) || '').toString();
        const obj = raw ? JSON.parse(raw) : {};
        const now = Date.now();
        brokenImageCooldown = new Map();
        if (obj && typeof obj === 'object') {
            for (const [k, v] of Object.entries(obj)) {
                const key = (k || '').toString().trim();
                const ts = Number(v);
                if (!key) continue;
                if (!Number.isFinite(ts)) continue;
                if (ts <= now) continue;
                brokenImageCooldown.set(key, ts);
            }
        }
    } catch (e) {
        brokenImageCooldown = new Map();
    }
}

function persistBrokenImageCooldown() {
    try {
        const now = Date.now();
        const obj = {};
        for (const [k, ts] of brokenImageCooldown.entries()) {
            if (!k) continue;
            if (!Number.isFinite(ts)) continue;
            if (ts <= now) continue;
            obj[k] = ts;
        }
        localStorage.setItem(BROKEN_IMAGE_COOLDOWN_STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {}
}

function isImageInCooldown(url) {
    const key = (url || '').toString().trim();
    if (!key) return false;
    const until = brokenImageCooldown.get(key);
    if (!Number.isFinite(until)) return false;
    if (until <= Date.now()) {
        brokenImageCooldown.delete(key);
        return false;
    }
    return true;
}

function markImageBroken(url) {
    const key = (url || '').toString().trim();
    if (!key) return;
    brokenImageCooldown.set(key, Date.now() + BROKEN_IMAGE_COOLDOWN_MS);
    persistBrokenImageCooldown();
}

function getSafeImageSrc(originalUrl, fallbackUrl) {
    const original = (originalUrl || '').toString().trim();
    if (!original) return fallbackUrl;
    if (isImageInCooldown(original)) return fallbackUrl;
    return original;
}

function handleBrokenProductImage(imgEl) {
    try {
        if (!imgEl) return;
        const original = (imgEl.getAttribute('data-orig-src') || '').toString().trim();
        const fallback = (imgEl.getAttribute('data-fallback-src') || '').toString().trim();

        if (original && (!fallback || original !== fallback)) {
            markImageBroken(original);
        }

        imgEl.onerror = null;
        if (fallback) imgEl.src = fallback;
    } catch (e) {}
}

loadBrokenImageCooldown();

function ensureMetaTag(selector, createAttrs) {
    let el = document.head ? document.head.querySelector(selector) : null;
    if (el) return el;
    if (!document.head) return null;
    el = document.createElement('meta');
    for (const [k, v] of Object.entries(createAttrs || {})) {
        el.setAttribute(k, v);
    }
    document.head.appendChild(el);
    return el;
}

function ensureLinkTag(selector, createAttrs) {
    let el = document.head ? document.head.querySelector(selector) : null;
    if (el) return el;
    if (!document.head) return null;
    el = document.createElement('link');
    for (const [k, v] of Object.entries(createAttrs || {})) {
        el.setAttribute(k, v);
    }
    document.head.appendChild(el);
    return el;
}

function updateSeoMeta({ restaurantName, logoUrl, contacts, seo }) {
    const seoObj = (seo && typeof seo === 'object') ? seo : {};
    const name = (restaurantName || '').toString().trim() || 'Restaurant';
    const canonicalDefault = `${window.location.origin}${BASE_PATH}/`;
    const canonicalOverride = (seoObj.canonicalUrl || '').toString().trim();
    const canonical = canonicalOverride || canonicalDefault;

    const title = (seoObj.title || '').toString().trim() || `${name} | Online Menu`;
    const description = (seoObj.description || '').toString().trim() || `${name} online menu. Order for delivery or pickup.`;

    const robotsDefault = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
    const robots = (seoObj.robots || '').toString().trim() || robotsDefault;
    const googleSiteVerification = (seoObj.googleSiteVerification || '').toString().trim();

    try { document.title = title; } catch (e) {}

    const canonicalLink = ensureLinkTag('link[rel="canonical"]', { rel: 'canonical' });
    if (canonicalLink) canonicalLink.setAttribute('href', canonical);

    const desc = ensureMetaTag('meta[name="description"]', { name: 'description' });
    if (desc) desc.setAttribute('content', description);

    const robotsEl = ensureMetaTag('meta[name="robots"]', { name: 'robots' });
    if (robotsEl) robotsEl.setAttribute('content', robots);
    const googlebotEl = ensureMetaTag('meta[name="googlebot"]', { name: 'googlebot' });
    if (googlebotEl) googlebotEl.setAttribute('content', robots);
    const gsvEl = ensureMetaTag('meta[name="google-site-verification"]', { name: 'google-site-verification' });
    if (gsvEl && googleSiteVerification) gsvEl.setAttribute('content', googleSiteVerification);

    const ogTitle = ensureMetaTag('meta[property="og:title"]', { property: 'og:title' });
    if (ogTitle) ogTitle.setAttribute('content', title);
    const ogDesc = ensureMetaTag('meta[property="og:description"]', { property: 'og:description' });
    if (ogDesc) ogDesc.setAttribute('content', description);
    const ogUrl = ensureMetaTag('meta[property="og:url"]', { property: 'og:url' });
    if (ogUrl) ogUrl.setAttribute('content', canonical);

    const image = ((seoObj.ogImageUrl || '').toString().trim() || (logoUrl || '').toString().trim());
    if (image) {
        const img = resolvePublicAssetUrl(image);
        const abs = img.startsWith('http') ? img : `${window.location.origin}${img.startsWith('/') ? img : `/${img}`}`;
        const ogImg = ensureMetaTag('meta[property="og:image"]', { property: 'og:image' });
        if (ogImg) ogImg.setAttribute('content', abs);
        const twImg = ensureMetaTag('meta[name="twitter:image"]', { name: 'twitter:image' });
        if (twImg) twImg.setAttribute('content', abs);
    }

    const twTitle = ensureMetaTag('meta[name="twitter:title"]', { name: 'twitter:title' });
    if (twTitle) twTitle.setAttribute('content', title);
    const twDesc = ensureMetaTag('meta[name="twitter:description"]', { name: 'twitter:description' });
    if (twDesc) twDesc.setAttribute('content', description);

    const ldEl = document.getElementById('ld-restaurant');
    if (ldEl) {
        const phone = (contacts?.phone || '').toString().trim();
        const address = (contacts?.address || '').toString().trim();
        const payload = {
            '@context': 'https://schema.org',
            '@type': 'Restaurant',
            name,
            url: canonical,
            telephone: phone || undefined,
            address: address ? { '@type': 'PostalAddress', streetAddress: address } : undefined
        };
        try {
            ldEl.textContent = JSON.stringify(payload).replace(/</g, '\\u003c');
        } catch (e) {}
    }
}

function resolvePublicAssetUrl(url) {
    const s = (url || '').toString().trim();
    if (!s) return '';
    // Backward compatibility: some instances stored absolute paths with /resturant-website prefix.
    // If we're deployed at root (BASE_PATH == ''), strip that prefix so /uploads/... resolves.
    if (s.startsWith('/resturant-website/')) {
        const stripped = s.replace(/^\/resturant-website/, '');
        return BASE_PATH ? `${BASE_PATH}${stripped}` : stripped;
    }
    if (s.startsWith('/')) return `${BASE_PATH}${s}`;
    return s;
}

function normalizeSlideshowSlides(rawSlides) {
    const arr = Array.isArray(rawSlides) ? rawSlides : [];
    return arr
        .slice(0, 10)
        .map(s => {
            if (typeof s === 'string') {
                return { image: s, title: '' };
            }
            const obj = (s && typeof s === 'object') ? s : {};
            const image = (obj.image || obj.imageUrl || obj.url || '').toString();
            const title = (obj.title || obj.caption || '').toString();
            return { image, title };
        })
        .filter(s => !!(s.image || '').toString().trim());
}

function stopSlideshowAutoplay() {
    if (slideshowAutoplayTimer) {
        clearInterval(slideshowAutoplayTimer);
        slideshowAutoplayTimer = null;
    }
}

function startSlideshowAutoplay() {
    stopSlideshowAutoplay();

    const slides = slideshowSettings?.slides;
    if (!slideshowSettings?.enabled) return;
    if (!Array.isArray(slides) || slides.length <= 1) return;
    if (currentCategory !== 'all') return;

    const intervalRaw = slideshowSettings?.autoPlayInterval;
    const ms = (typeof intervalRaw === 'number' ? intervalRaw : parseInt((intervalRaw ?? '').toString(), 10)) || 5000;
    if (!Number.isFinite(ms) || ms < 1000) return;

    slideshowAutoplayTimer = setInterval(() => {
        try { changeSlide(1); } catch (e) {}
    }, ms);
}

function showSlideAt(index) {
    const wrapper = document.getElementById('slides-wrapper');
    const dots = document.getElementById('slide-dots');
    if (!wrapper) return;

    const slideEls = Array.from(wrapper.children || []);
    if (slideEls.length === 0) return;

    const next = ((index % slideEls.length) + slideEls.length) % slideEls.length;
    slideshowCurrentIndex = next;

    slideEls.forEach((el, idx) => {
        el.style.display = idx === next ? '' : 'none';
    });

    if (dots) {
        const dotEls = Array.from(dots.children || []);
        dotEls.forEach((el, idx) => {
            el.classList.toggle('active', idx === next);
        });
    }
}

function changeSlide(direction) {
    const slides = slideshowSettings?.slides;
    if (!Array.isArray(slides) || slides.length === 0) return;
    showSlideAt(slideshowCurrentIndex + (parseInt(direction, 10) || 0));
    startSlideshowAutoplay();
}

function renderSlideshow() {
    const root = document.getElementById('promo-slideshow');
    const wrapper = document.getElementById('slides-wrapper');
    const dots = document.getElementById('slide-dots');
    if (!root || !wrapper || !dots) return;

    const slides = normalizeSlideshowSlides(slideshowSettings?.slides);
    wrapper.innerHTML = '';
    dots.innerHTML = '';

    slides.forEach((slide, idx) => {
        const imageUrl = resolvePublicAssetUrl(slide.image);
        const title = (slide.title || '').toString().trim();

        const slideEl = document.createElement('div');
        slideEl.className = 'slide';
        slideEl.style.display = 'none';

        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = title || `Slide ${idx + 1}`;
        img.loading = 'lazy';
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        slideEl.appendChild(img);

        if (title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'slide-title';
            titleEl.textContent = title;
            slideEl.appendChild(titleEl);
        }

        wrapper.appendChild(slideEl);

        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'slide-dot';
        dot.setAttribute('aria-label', `Slide ${idx + 1}`);
        dot.onclick = () => {
            showSlideAt(idx);
            startSlideshowAutoplay();
        };
        dots.appendChild(dot);
    });

    showSlideAt(0);
}

function updateSlideshowVisibility() {
    const root = document.getElementById('promo-slideshow');
    if (!root) return;

    const slides = normalizeSlideshowSlides(slideshowSettings?.slides);
    const shouldShow = !!(slideshowSettings?.enabled && slides.length > 0 && currentCategory === 'all');

    root.style.display = shouldShow ? '' : 'none';
    if (shouldShow) startSlideshowAutoplay();
    else stopSlideshowAutoplay();
}

async function loadSlideshowSettingsPublic() {
    try {
        const res = await fetch(`${API_URL}/slideshow`);
        if (!res.ok) return;
        const data = await res.json();

        slideshowSettings = {
            enabled: !!data.enabled,
            autoPlayInterval: data.autoPlayInterval || 5000,
            slides: normalizeSlideshowSlides(data.slides)
        };

        renderSlideshow();
        updateSlideshowVisibility();
    } catch (e) {
        // ignore
    }
}

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

let desktopSidebarClampInitialized = false;
let desktopSidebarClampRaf = 0;

function getStickyGap() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--sticky-gap');
    const val = parseFloat(raw);
    return Number.isFinite(val) ? val : 0;
}

function getDesktopSidebarClampTarget() {
    const mapEl = document.getElementById('site-map');
    if (mapEl) {
        const cs = getComputedStyle(mapEl);
        if (cs.display !== 'none') {
            const rect = mapEl.getBoundingClientRect();
            if (rect.height > 0) return mapEl;
        }
    }

    return document.getElementById('site-footer');
}

function updateDesktopSidebarClamp() {
    if (window.innerWidth <= 1024) return;

    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const clampTarget = getDesktopSidebarClampTarget();
    if (!clampTarget) return;

    const baseTop = 51;
    sidebar.style.top = `${baseTop}px`;
    sidebar.style.transform = '';

    const sidebarRect = sidebar.getBoundingClientRect();
    const sidebarHeight = sidebarRect.height;
    if (!sidebarHeight) return;

    const footerTopDoc = clampTarget.getBoundingClientRect().top + window.pageYOffset;
    const sidebarTopDoc = window.pageYOffset + baseTop;
    const sidebarBottomDoc = sidebarTopDoc + sidebarHeight;

    const overlap = sidebarBottomDoc - footerTopDoc;
    if (overlap > 0) {
        sidebar.style.transform = `translateY(${-Math.ceil(overlap)}px)`;
    }
}

function scheduleDesktopSidebarClampUpdate() {
    if (desktopSidebarClampRaf) return;
    desktopSidebarClampRaf = requestAnimationFrame(() => {
        desktopSidebarClampRaf = 0;
        updateDesktopSidebarClamp();
    });
}

function initDesktopSidebarClamp() {
    if (desktopSidebarClampInitialized) return;
    desktopSidebarClampInitialized = true;

    window.addEventListener('scroll', scheduleDesktopSidebarClampUpdate, { passive: true });
    window.addEventListener('resize', scheduleDesktopSidebarClampUpdate);
    window.addEventListener('orientationchange', scheduleDesktopSidebarClampUpdate);

    const sidebar = document.querySelector('.sidebar');
    if (sidebar && 'ResizeObserver' in window) {
        try {
            const ro = new ResizeObserver(() => scheduleDesktopSidebarClampUpdate());
            ro.observe(sidebar);
        } catch (e) {
            // ignore
        }
    }
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
        btn.classList.toggle('active', btn.dataset.lang === currentLanguage);
    });
    
    // Update dropdown value
    const dropdown = document.getElementById('lang-dropdown');
    if (dropdown) {
        dropdown.value = currentLanguage;
    }
    
    // Update all translatable elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLanguage][key]) {
            el.textContent = translations[currentLanguage][key];
        }
    });
    
    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[currentLanguage][key]) {
            el.placeholder = translations[currentLanguage][key];
        }
    });
    
    // Re-render products to update Add to Cart buttons
    renderProducts();
    
    // Re-render to apply translations
    renderCategories();
    renderProducts();

    renderRestaurantStatusBanner();

    try { renderSiteMap(); } catch (e) {}
    try { renderSiteFooter(); } catch (e) {}
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
    const cfg = normalizeWorkingHoursConfigClient(siteWorkingHours || null);
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

function getNextOpenInfoClient() {
    const cfg = normalizeWorkingHoursConfigClient(siteWorkingHours || null);
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

function getStorefrontClosedReason() {
    if (siteOrderSettings?.temporarilyClosed === true) {
        return { type: 'manual' };
    }

    const day = getWorkingHoursDayForNow();
    if (day.closed === true) {
        const next = getNextOpenInfoClient();
        return {
            type: 'closed_day',
            opensAt: next?.opensAt || '',
            opensInDays: Number.isFinite(next?.daysAhead) ? next.daysAhead : null,
            opensDayKey: next?.dayKey || null,
            tomorrow: next?.daysAhead === 1
        };
    }

    const open = parseHHMMToMinutes(day.openingTime) ?? (9 * 60);
    const close = parseHHMMToMinutes(day.closingTime) ?? (22 * 60);
    const now = nowMinutesOfDayInTimeZoneClient(day.timezone || 'Europe/Sofia', new Date());

    const within = isMinutesWithinWindow(now, open, close);
    if (within) return null;

    const next = getNextOpenInfoClient();
    const opensAt = next?.opensAt || minutesToHHMM(open);
    const opensInDays = Number.isFinite(next?.daysAhead) ? next.daysAhead : (now < open ? 0 : 1);
    const opensDayKey = next?.dayKey || null;

    return {
        type: 'hours',
        opensAt,
        opensInDays,
        opensDayKey,
        tomorrow: opensInDays === 1
    };
}

function renderRestaurantStatusBanner() {
    const topBar = document.getElementById('top-bar') || document.querySelector('.top-bar');
    if (!topBar) return;

    const reason = getStorefrontClosedReason();
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
                <div>
                    <div class="ux-modal-title">${title || ''}</div>
                </div>
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
        alert((title || '') + (message ? `\n${message}` : ''));
    }
}

function showRestaurantClosedModal({ type, open, close, opensAt, tomorrow, opensInDays, opensDayKey }) {
    const isBg = currentLanguage === 'bg';
    const isManual = type === 'manual';
    const isClosedDay = type === 'closed_day';

    const title = isManual
        ? (isBg ? 'Временно затворено' : 'Temporarily closed')
        : (isClosedDay
            ? (isBg ? 'Днес сме затворени' : 'Closed today')
            : (isBg ? 'Извън работно време' : 'Outside working hours'));

    const heroIcon = isManual ? '<i class="fas fa-store-slash"></i>' : '<i class="fas fa-clock"></i>';
    const heroTitle = isManual
        ? (isBg ? 'В момента не приемаме поръчки' : 'We are not accepting orders right now')
        : (isClosedDay
            ? (isBg ? 'Днес сме затворени' : 'We are closed today')
            : (isBg ? 'В момента сме затворени' : 'We are currently closed'));

    const openLine = (() => {
        if (isManual) return '';
        const at = (opensAt || '').toString().trim();
        if (!at) return '';
        const days = Number.isFinite(opensInDays) ? opensInDays : (tomorrow ? 1 : 0);
        const dayKey = (opensDayKey || '').toString().trim();
        const dayName = dayKey ? (WORKING_HOURS_WEEKDAY_LABELS[isBg ? 'bg' : 'en']?.[dayKey] || '') : '';

        if (days === 0) {
            return isBg
                ? `Отваряме в <b>${escapeHtml(at)}</b>.`
                : `Opens at <b>${escapeHtml(at)}</b>.`;
        }
        if (days === 1) {
            return isBg
                ? `Отваряме утре в <b>${escapeHtml(at)}</b>.`
                : `Opens tomorrow at <b>${escapeHtml(at)}</b>.`;
        }
        return isBg
            ? `Отваряме в <b>${escapeHtml(dayName || dayKey)}</b> в <b>${escapeHtml(at)}</b>.`
            : `Opens on <b>${escapeHtml(dayName || dayKey)}</b> at <b>${escapeHtml(at)}</b>.`;
    })();

    const heroSub = isManual
        ? (isBg ? 'Заповядайте по-късно.' : 'Please come again later.')
        : (isClosedDay
            ? (isBg ? 'Днес не приемаме поръчки.' : 'We are not accepting orders today.')
            : (openLine || (isBg ? 'Можете да поръчате в работното време по-долу.' : 'You can order during the hours shown below.')));

    const hoursHtml = (!isManual && open && close)
        ? `
            <div class="ux-hours-row">
                <div class="ux-hour-chip"><i class="fas fa-door-open"></i> ${isBg ? 'От' : 'From'} <span>${escapeHtml(open)}</span></div>
                <div class="ux-hour-chip"><i class="fas fa-door-closed"></i> ${isBg ? 'До' : 'To'} <span>${escapeHtml(close)}</span></div>
            </div>
            <div class="ux-tip">
                <i class="fas fa-info-circle"></i>
                ${isBg ? 'Можете да разгледате менюто и да се върнете, когато отворим.' : 'You can browse the menu and come back when we open.'}
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
        title,
        message: msg,
        primaryText: isBg ? 'Разбрах' : 'OK'
    });
}

function maybeShowClosedModalOnce() {
    const reason = getStorefrontClosedReason();
    if (!reason) return;

    const key = `closedModalShown:${reason.type}`;
    if (sessionStorage.getItem(key) === '1') return;
    sessionStorage.setItem(key, '1');

    const day = getWorkingHoursDayForNow();
    const open = day.closed === true ? '' : (day.openingTime || '').toString().trim();
    const close = day.closed === true ? '' : (day.closingTime || '').toString().trim();
    showRestaurantClosedModal({
        type: reason.type,
        open: open || undefined,
        close: close || undefined,
        opensAt: reason.opensAt,
        tomorrow: !!reason.tomorrow,
        opensInDays: reason.opensInDays,
        opensDayKey: reason.opensDayKey
    });
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
        const nameEl = document.getElementById('restaurant-name');
        if (nameEl) nameEl.textContent = settingsData.name;
        restaurantLogoUrl = (settingsData?.logo || '').toString().trim();
        
        // Display logo if available
        const logoElement = document.getElementById('restaurant-logo');
        if (restaurantLogoUrl) {
            if (logoElement) {
                logoElement.src = resolvePublicAssetUrl(restaurantLogoUrl);
                logoElement.classList.add('visible');
            }
            if (nameEl) nameEl.style.display = 'none';
        } else {
            if (logoElement) logoElement.classList.remove('visible');
            if (nameEl) nameEl.style.display = '';
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

        try {
            updateSeoMeta({
                restaurantName: settingsData?.name,
                logoUrl: settingsData?.logo,
                contacts: siteSettings?.footer?.contacts,
                seo: siteSettings?.seo
            });
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

        // Load order settings (for temporarily closed banner)
        try {
            const orderRes = await fetch(`${API_URL}/settings/order`);
            if (orderRes.ok) {
                siteOrderSettings = await orderRes.json();
            }
        } catch (e) {
            // ignore
        }
        
        // Initialize language
        initLanguage();

        renderSiteMap();
        renderSiteFooter();

        renderRestaurantStatusBanner();
        maybeShowClosedModalOnce();

        try { await loadSlideshowSettingsPublic(); } catch (e) {}
        
        extractCategories();
        renderCategories();
        renderProducts();
        initDesktopSidebarClamp();
        scheduleDesktopSidebarClampUpdate();
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
    const aboutLogoRaw = (siteSettings?.footer?.aboutLogoUrl || '').toString().trim();
    const restaurantLogoRaw = (restaurantLogoUrl || '').toString().trim();
    const footerLogoRaw = aboutLogoRaw || restaurantLogoRaw;
    const aboutLogoUrl = footerLogoRaw ? resolvePublicAssetUrl(footerLogoRaw) : '';
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

    const wh = normalizeWorkingHoursConfigClient(siteWorkingHours || null);
    const closedText = currentLanguage === 'bg' ? 'Затворено' : 'Closed';
    const dayNames = currentLanguage === 'bg'
        ? { mon: 'Понеделник', tue: 'Вторник', wed: 'Сряда', thu: 'Четвъртък', fri: 'Петък', sat: 'Събота', sun: 'Неделя' }
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
                    ${aboutLogoUrl ? `<img class="footer-about-logo" src="${escapeHtml(aboutLogoUrl)}" alt="${escapeHtml(labels.about)}" />` : ''}
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
    const uniqueCategories = [...new Set(products.map(p => (p?.category ?? '').toString().trim()).filter(Boolean))];
    
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
    
    // Ensure "Promotions" exists and is pinned first when there are active promos or bundles.
    const hasPromoProducts = products.some(p => isPromoActive(p?.promo));
    const hasBundleProducts = products.some(p => p?.isCombo === true);
    const shouldPinPromotions = hasPromoProducts || hasBundleProducts;
    if (shouldPinPromotions && !specialCategories.includes('Promotions')) {
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
    const computed = [...specialCategories, ...regularCategories];

    // Apply admin-defined category order (optional)
    const orderCfg = siteSettings?.categories?.order;
    if (Array.isArray(orderCfg) && orderCfg.length > 0) {
        const want = orderCfg.map(x => (x ?? '').toString().trim()).filter(Boolean);
        const existing = new Set(computed);
        const ordered = [];
        const seen = new Set();

        want.forEach(k => {
            if (!existing.has(k)) return;
            if (seen.has(k)) return;
            seen.add(k);
            ordered.push(k);
        });

        computed.forEach(k => {
            if (seen.has(k)) return;
            ordered.push(k);
        });

        categories = ordered;
    } else {
        categories = computed;
    }

    // Force Promotions to render first (after "All") when deals exist.
    if (shouldPinPromotions && Array.isArray(categories)) {
        const idx = categories.indexOf('Promotions');
        if (idx > 0) {
            categories = ['Promotions', ...categories.slice(0, idx), ...categories.slice(idx + 1)];
        }
    }
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

        const displayName = getCategoryDisplayName(category);
        btn.textContent = (displayName || category).toUpperCase();
        btn.onclick = () => filterByCategory(category);
        nav.appendChild(btn);
    });

    // On mobile, keep the active category centered in the horizontal scroller.
    requestAnimationFrame(() => centerActiveCategoryButton({ behavior: 'smooth' }));
}

function centerActiveCategoryButton({ behavior = 'auto' } = {}) {
    const nav = document.getElementById('categories-nav');
    if (!nav) return;

    const isMobile = !!(window?.matchMedia && window.matchMedia('(max-width: 768px)').matches);
    if (!isMobile) return;

    // Only attempt to scroll if the nav is horizontally scrollable.
    if (nav.scrollWidth <= nav.clientWidth + 4) return;

    const active = nav.querySelector('.category-btn.active');
    if (!active) return;

    const targetCenter = active.offsetLeft + (active.offsetWidth / 2);
    const targetLeft = targetCenter - (nav.clientWidth / 2);
    const maxLeft = Math.max(0, nav.scrollWidth - nav.clientWidth);
    const clamped = Math.min(Math.max(0, targetLeft), maxLeft);

    try {
        nav.scrollTo({ left: clamped, behavior });
    } catch (e) {
        nav.scrollLeft = clamped;
    }
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
    scheduleDesktopSidebarClampUpdate();

    // Keep restaurant status visible/updated even when switching categories.
    renderRestaurantStatusBanner();

    try { updateSlideshowVisibility(); } catch (e) {}

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
    const key = (category ?? '').toString();
    const overrides = siteSettings?.categories?.labels;
    const label = overrides && typeof overrides === 'object' ? overrides[key] : null;

    if (currentLanguage === 'bg') {
        const overrideBg = (label && typeof label === 'object') ? (label.bg || '') : '';
        if (overrideBg) return overrideBg;

        if (key === 'Promotions') return 'Промоции';
        if (key === 'Combos & Bundles') return 'Комбо и Бъндъл Оферти';

        const productWithCategory = products.find(p => p.category === key && p.translations?.bg?.category);
        return productWithCategory ? productWithCategory.translations.bg.category : key;
    }

    const overrideEn = (label && typeof label === 'object') ? (label.en || '') : '';
    if (overrideEn) return overrideEn;

    return key;
}

function normalizeAvailabilityStatus(value) {
    if (value === undefined || value === null) return null;
    const s = String(value).trim().toLowerCase();
    if (!s) return null;
    if (['available', 'in_stock', 'instock', 'active', 'enabled'].includes(s)) return 'available';
    if (['limited', 'low_stock', 'lowstock'].includes(s)) return 'limited';
    if (['out_of_stock', 'outofstock', 'out-of-stock', 'sold_out', 'soldout'].includes(s)) return 'out_of_stock';
    if (['not_available', 'notavailable', 'not-available', 'inactive', 'disabled'].includes(s)) return 'not_available';
    return null;
}

function getProductAvailabilityStatus(product) {
    const status = normalizeAvailabilityStatus(product?.availabilityStatus ?? product?.availability_status);
    if (status) return status;
    if (product?.availability === undefined || product?.availability === null) return 'available';
    return product.availability ? 'available' : 'not_available';
}

function isProductVisible(product) {
    return getProductAvailabilityStatus(product) !== 'not_available';
}

function isProductOrderable(product) {
    const status = getProductAvailabilityStatus(product);
    return status === 'available' || status === 'limited';
}

// Render products
function renderProducts() {
    const container = document.getElementById('products-container');
    const emptyState = document.getElementById('empty-state');
    
    let filteredProducts = (products || []).filter(isProductVisible);
    
    // Filter by category
    if (currentCategory !== 'all') {
        if (currentCategory === 'Promotions') {
            // Show all deal items: active promos OR bundles/combos
            filteredProducts = filteredProducts.filter(p => isPromoActive(p?.promo) || p?.isCombo === true);
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

    updateAddToCartInCartBadges();
}

// Format price
function round2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round((x + Number.EPSILON) * 100) / 100;
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

// Create product card element
function normalizeComboProductsList(comboProducts) {
    if (!Array.isArray(comboProducts)) return [];

    return comboProducts.map(item => {
        // Legacy format: [1,2,3]
        if (typeof item === 'number' || typeof item === 'string') {
            const pid = Number(item);
            if (!Number.isFinite(pid)) return null;
            return { productId: pid, qty: 1 };
        }

        // New format: [{ productId, qty }]
        if (item && typeof item === 'object') {
            const pid = Number(item.productId);
            const qty = Math.max(1, Math.floor(Number(item.qty ?? 1)));
            if (!Number.isFinite(pid)) return null;
            return { productId: pid, qty: Number.isFinite(qty) ? qty : 1 };
        }

        return null;
    }).filter(Boolean);
}

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
    const fallbackImageUrl = 'https://via.placeholder.com/280x200?text=No+Image';
    const imageRaw = (product.image || '').toString().trim();
    let originalImageUrl = imageRaw;
    if (originalImageUrl && originalImageUrl.startsWith('/uploads/')) {
        // Serve uploads relative to BASE_PATH
        originalImageUrl = `${BASE_PATH}${originalImageUrl}`;
    }
    const imageUrl = getSafeImageSrc(originalImageUrl, fallbackImageUrl);
    
    const hasPromo = isPromoActive(product.promo);
    const effectivePrice = getEffectivePrice(product);
    const hasSpecialLabel = product.specialLabel && product.specialLabel.trim() !== '';
    const availabilityStatus = getProductAvailabilityStatus(product);
    const isLimited = availabilityStatus === 'limited';
    const isOutOfStock = availabilityStatus === 'out_of_stock';
    const orderable = isProductOrderable(product);

    const inCartQty = getCartQuantity(product.id);
    const inCartQtyLabel = inCartQty > 99 ? '99+' : String(inCartQty);
    
    // Calculate discount percentage
    let discountPercent = 0;
    let bundleOriginalPrice = 0;
    if (hasPromo && product.price > 0) {
        discountPercent = Math.round(((product.price - effectivePrice) / product.price) * 100);
    } else if (product.isCombo && product.comboProducts && product.comboProducts.length > 0) {
        // Calculate bundle discount
        const comboItems = normalizeComboProductsList(product.comboProducts);
        const originalTotal = comboItems.reduce((sum, item) => {
            const bundleProduct = products.find(p => p.id === item.productId);
            const unitPrice = bundleProduct ? (Number(bundleProduct.price) || 0) : 0;
            return sum + (unitPrice * (Number(item.qty) || 1));
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
                <span class="product-price-original">${formatPrice(product.price, { showBgn: false })}</span>
            </div>
        `;
    } else if (product.isCombo && bundleOriginalPrice > product.price) {
        // Show bundle savings
        priceHTML = `
            <div class="product-price-wrapper">
                <span class="product-price promo-price">${formatPrice(product.price)}</span>
                <span class="product-price-original">${formatPrice(bundleOriginalPrice, { showBgn: false })}</span>
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

    if (isLimited) {
        const limitedText = currentLanguage === 'bg' ? 'ОГРАНИЧЕНО' : 'LIMITED';
        const limitedBadge = `<div class="promo-badge"><i class="fas fa-hourglass-half"></i> ${limitedText}</div>`;
        if (badgeHTML && badgeHTML.includes('badge-container')) {
            badgeHTML = badgeHTML.replace('<div class="badge-container">', `<div class="badge-container">${limitedBadge}`);
        } else {
            badgeHTML = `<div class="badge-container">${limitedBadge}</div>`;
        }
    }

    if (isOutOfStock) {
        const outText = currentLanguage === 'bg' ? 'ИЗЧЕРПАНО' : 'OUT OF STOCK';
        const outBadge = `<div class="promo-badge"><i class="fas fa-ban"></i> ${outText}</div>`;
        if (badgeHTML && badgeHTML.includes('badge-container')) {
            badgeHTML = badgeHTML.replace('<div class="badge-container">', `<div class="badge-container">${outBadge}`);
        } else {
            badgeHTML = `<div class="badge-container">${outBadge}</div>`;
        }
    }
    
    card.innerHTML = `
        ${badgeHTML}
        <div class="product-image-wrap">
            <img src="${imageUrl}" 
                 alt="${name}" 
                 class="product-image"
                 data-orig-src="${originalImageUrl}"
                 data-fallback-src="${fallbackImageUrl}"
                 onerror="handleBrokenProductImage(this)">
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
                <button ${orderable ? `onclick="event.stopPropagation(); addToCart(${product.id})"` : ''} class="add-to-cart-btn" data-product-id="${product.id}" ${orderable ? '' : 'disabled'} style="${orderable ? '' : 'opacity:0.6; cursor:not-allowed;'}">
                    <span class="add-to-cart-icon" aria-hidden="true">
                        <i class="fas fa-shopping-cart"></i>
                        <span class="add-to-cart-count-badge" style="${inCartQty > 0 ? 'display:inline-flex;' : 'display:none;'}">${inCartQtyLabel}</span>
                    </span>
                    <span class="add-to-cart-label">${orderable ? translations[currentLanguage].addToCart : (currentLanguage === 'bg' ? 'Изчерпан' : 'Out of stock')}</span>
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
    
    const modalFallbackImageUrl = 'https://via.placeholder.com/300x300?text=No+Image';
    const imageRaw = (product.image || '').toString().trim();
    let originalImageUrl = imageRaw;
    if (originalImageUrl && originalImageUrl.startsWith('/uploads/')) {
        originalImageUrl = `${BASE_PATH}${originalImageUrl}`;
    }
    const imageUrl = getSafeImageSrc(originalImageUrl, modalFallbackImageUrl);
    
    const hasPromo = isPromoActive(product.promo);
    const effectivePrice = getEffectivePrice(product);
    
    // Calculate discount percentage for modal
    let discountPercent = 0;
    let bundleOriginalPrice = 0;
    if (hasPromo && product.price > 0) {
        discountPercent = Math.round(((product.price - effectivePrice) / product.price) * 100);
    } else if (product.isCombo && product.comboProducts && product.comboProducts.length > 0) {
        const comboItems = normalizeComboProductsList(product.comboProducts);
        const originalTotal = comboItems.reduce((sum, item) => {
            const bundleProduct = products.find(p => p.id === item.productId);
            const unitPrice = bundleProduct ? (Number(bundleProduct.price) || 0) : 0;
            return sum + (unitPrice * (Number(item.qty) || 1));
        }, 0);
        bundleOriginalPrice = originalTotal;
        if (originalTotal > 0 && product.price < originalTotal) {
            discountPercent = Math.round(((originalTotal - product.price) / originalTotal) * 100);
        }
    }
    
    const modalImage = document.getElementById('modal-image');
    if (modalImage) {
        modalImage.setAttribute('data-orig-src', originalImageUrl);
        modalImage.setAttribute('data-fallback-src', modalFallbackImageUrl);
        modalImage.onerror = () => handleBrokenProductImage(modalImage);
        modalImage.src = imageUrl;
        modalImage.alt = name;
    }

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
    const orderable = isProductOrderable(product);
    addToCartBtn.disabled = !orderable;
    addToCartBtn.style.opacity = orderable ? '' : '0.6';
    addToCartBtn.style.cursor = orderable ? '' : 'not-allowed';
    addToCartBtn.dataset.productId = String(product.id);
    const inCartQty = getCartQuantity(product.id);
    const inCartQtyLabel = inCartQty > 99 ? '99+' : String(inCartQty);
    addToCartBtn.innerHTML = `
        <span class="add-to-cart-icon" aria-hidden="true">
            <i class="fas fa-shopping-cart"></i>
            <span class="add-to-cart-count-badge" style="${inCartQty > 0 ? 'display:inline-flex;' : 'display:none;'}">${inCartQtyLabel}</span>
        </span>
        <span class="add-to-cart-label">${orderable ? translations[currentLanguage].addToCart : (currentLanguage === 'bg' ? 'Изчерпан' : 'Out of stock')}</span>
    `;
    addToCartBtn.onclick = () => {
        if (!modalProductId) return;
        if (!orderable) return;
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
    window.setTimeout(() => btn.classList.remove('btn-click-animate'), 750);
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

            const fallbackImageUrl = 'https://via.placeholder.com/80x80?text=No+Image';
            const imageRaw = (product.image || '').toString().trim();
            let originalImageUrl = imageRaw;
            if (originalImageUrl && originalImageUrl.startsWith('/uploads/')) {
                originalImageUrl = `${BASE_PATH}${originalImageUrl}`;
            }
            const imageUrl = getSafeImageSrc(originalImageUrl, fallbackImageUrl);

            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
                <img class="search-result-img" src="${imageUrl}" alt="${name}" data-orig-src="${originalImageUrl}" data-fallback-src="${fallbackImageUrl}" onerror="handleBrokenProductImage(this)">
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
    initDesktopSidebarClamp();
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

    const clampInt = (value, min, max, fallback) => {
        const n = Number.parseInt(value, 10);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, n));
    };
    
    // Apply colors
    root.style.setProperty('--top-bar-color', custom.topBarColor || '#2c3e50');
    root.style.setProperty('--background-color', custom.backgroundColor || '#f5f5f5');
    root.style.setProperty('--highlight-color', custom.highlightColor || '#e74c3c');
    root.style.setProperty('--price-color', custom.priceColor || '#e74c3c');

    // Apply logo sizes
    const headerLogoSize = clampInt(custom?.headerLogoSize, 24, 96, 50);
    const footerLogoMaxWidth = clampInt(custom?.footerLogoMaxWidth, 80, 360, 180);
    root.style.setProperty('--header-logo-size', `${headerLogoSize}px`);
    root.style.setProperty('--footer-logo-max-width', `${footerLogoMaxWidth}px`);
    
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
        const scope = (appliedPromoCode.scope || '').toString().trim().toLowerCase();
        const category = (appliedPromoCode.category || 'all').toString();
        const categories = Array.isArray(appliedPromoCode.categories) ? appliedPromoCode.categories.map(c => (c || '').toString()).filter(Boolean) : [];
        const normSet = new Set(categories.map(c => c.toLowerCase()));

        let applies = false;
        if (!scope || scope === 'all' || category === 'all' || normSet.has('all')) {
            applies = true;
        } else if (scope === 'category') {
            const itemNorm = (product.category || '').toString().toLowerCase();
            applies = normSet.size ? normSet.has(itemNorm) : ((category || '').toString().toLowerCase() === itemNorm);
        } else if (scope === 'products') {
            const ids = Array.isArray(appliedPromoCode.productIds) ? appliedPromoCode.productIds : [];
            applies = ids.map(String).includes(String(product.id));
        }

        if (applies) {
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
        const response = await fetch(`${API_URL}/promo-codes/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
        });
        
        const result = await response.json();
        
        if (result.valid) {
            const promoCategories = Array.isArray(result.categories)
                ? result.categories.map(c => (c || '').toString()).filter(Boolean)
                : [];
            appliedPromoCode = {
                code,
                discount: result.discount,
                scope: result.scope || ((result.category && result.category !== 'all') ? 'category' : 'all'),
                category: result.category || 'all',
                categories: promoCategories.length ? promoCategories : ((result.category && result.category !== 'all') ? [result.category] : []),
                productIds: Array.isArray(result.productIds) ? result.productIds : [],
                allowedMethod: result.allowedMethod || 'all',
                startDate: result.startDate || null,
                endDate: result.endDate || null
            };
            message.style.display = 'block';
            message.style.color = '#27ae60';
            message.innerHTML = `<i class="fas fa-check-circle"></i> Promo code applied! ${result.discount}% off`;
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

function getCartQuantity(productId) {
    const item = cart.find(x => String(x.id) === String(productId));
    const qty = item ? Number(item.quantity) : 0;
    return Number.isFinite(qty) && qty > 0 ? qty : 0;
}

function updateAddToCartInCartBadges() {
    const qtyById = new Map((cart || []).map(item => [String(item.id), Number(item.quantity) || 0]));
    const buttons = document.querySelectorAll('.add-to-cart-btn[data-product-id]');
    if (!buttons || !buttons.length) return;

    buttons.forEach(btn => {
        const pid = btn.dataset.productId;
        const qty = Math.max(0, qtyById.get(String(pid)) || 0);
        const badge = btn.querySelector('.add-to-cart-count-badge');
        if (!badge) return;

        if (qty > 0) {
            badge.textContent = qty > 99 ? '99+' : String(qty);
            badge.style.display = 'inline-flex';
        } else {
            badge.textContent = '';
            badge.style.display = 'none';
        }
    });
}

// Add item to cart
function addToCart(productId) {
    addToCartWithQuantity(productId, 1);
}

function addToCartWithQuantity(productId, quantity) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (!isProductOrderable(product)) {
        alert(currentLanguage === 'bg' ? 'Този продукт не е наличен.' : 'This product is not available.');
        return;
    }
    const qty = Math.max(1, Number(quantity) || 1);

    let effectivePrice = getEffectivePrice(product);
    let originalPrice = product.price;
    let discountLabel = '';

    // Bundle/combo: preserve original sum price so it can be shown later (email/track/admin).
    if (product.isCombo && Array.isArray(product.comboProducts) && product.comboProducts.length > 0) {
        const comboItems = normalizeComboProductsList(product.comboProducts);
        const originalTotal = comboItems.reduce((sum, item) => {
            const p = products.find(x => x.id === item.productId);
            const unitPrice = p ? (Number(p.price) || 0) : 0;
            return sum + (unitPrice * (Number(item.qty) || 1));
        }, 0);
        if (originalTotal > 0) originalPrice = originalTotal;
        discountLabel = (translations && translations[currentLanguage] && translations[currentLanguage].bundle) ? translations[currentLanguage].bundle : 'Bundle';
    } else if (isPromoActive(product.promo)) {
        discountLabel = (translations && translations[currentLanguage] && translations[currentLanguage].promo) ? translations[currentLanguage].promo : 'Promo';
    } else if (appliedPromoCode && effectivePrice < originalPrice) {
        const scope = (appliedPromoCode.scope || '').toString().trim().toLowerCase();
        const category = (appliedPromoCode.category || 'all').toString();
        const categories = Array.isArray(appliedPromoCode.categories) ? appliedPromoCode.categories.map(c => (c || '').toString()).filter(Boolean) : [];
        const normSet = new Set(categories.map(c => c.toLowerCase()));
        let applies = false;
        if (!scope || scope === 'all' || category === 'all' || normSet.has('all')) {
            applies = true;
        } else if (scope === 'category') {
            const itemNorm = (product.category || '').toString().toLowerCase();
            applies = normSet.size ? normSet.has(itemNorm) : ((category || '').toString().toLowerCase() === itemNorm);
        } else if (scope === 'products') {
            const ids = Array.isArray(appliedPromoCode.productIds) ? appliedPromoCode.productIds : [];
            applies = ids.map(String).includes(String(product.id));
        }
        if (applies) discountLabel = 'Promo code';
    }

    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += qty;
    } else {
        cart.push({
            id: product.id,
            name: currentLanguage === 'bg' && product.translations?.bg?.name ? product.translations.bg.name : product.name,
            baseName: product.name,
            price: effectivePrice,
            originalPrice,
            ...(discountLabel ? { discountLabel } : {}),
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

    updateAddToCartInCartBadges();
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
    try { updateSlideshowVisibility(); } catch (e) {}
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
