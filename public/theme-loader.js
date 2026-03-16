(function () {
    const STORAGE_KEY = 'siteTheme';
    const MODERN_CLASS = 'theme-modern';

    const getBasePath = () => (window.location.pathname.includes('/resturant-website') ? '/resturant-website' : '');

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
        })
        .catch(() => {
            // ignore
        });
})();
