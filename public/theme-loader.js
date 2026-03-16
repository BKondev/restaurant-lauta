(function () {
    const STORAGE_KEY = 'siteTheme';
    const FAVICON_KEY = 'siteFaviconUrl';
    const MODERN_CLASS = 'theme-modern';

    const getBasePath = () => (window.location.pathname.includes('/resturant-website') ? '/resturant-website' : '');

    const applyFavicon = (rawUrl, basePath) => {
        const url = (rawUrl || '').toString().trim();
        if (!url) return;

        const href = url.startsWith('/') ? `${basePath}${url}` : url;
        let link = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = href;
    };

    const applyTheme = (rawTheme) => {
        const theme = (rawTheme || '').toString().toLowerCase() === 'modern' ? 'modern' : 'classic';
        const root = document.documentElement;
        if (theme === 'modern') root.classList.add(MODERN_CLASS);
        else root.classList.remove(MODERN_CLASS);
        root.setAttribute('data-site-theme', theme);
    };

    try {
        applyTheme(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
        // ignore
    }

    const base = getBasePath();
    try {
        applyFavicon(localStorage.getItem(FAVICON_KEY), base);
    } catch (e) {
        // ignore
    }

    fetch(`${base}/api/settings/site`, { cache: 'no-store' })
        .then((res) => (res && res.ok ? res.json() : null))
        .then((settings) => {
            if (!settings || typeof settings !== 'object') return;
            const theme = settings.theme === 'modern' ? 'modern' : 'classic';
            try {
                localStorage.setItem(STORAGE_KEY, theme);
            } catch (e) {
                // ignore
            }
            applyTheme(theme);

            const faviconUrl = (settings.faviconUrl || '').toString().trim();
            if (faviconUrl) {
                try { localStorage.setItem(FAVICON_KEY, faviconUrl); } catch (e) {}
                applyFavicon(faviconUrl, base);
            }
        })
        .catch(() => {
            // ignore
        });
})();
