(function () {
    const BASE_PATH = window.location.pathname.includes('/resturant-website') ? '/resturant-website' : '';
    const API_URL = `${BASE_PATH}/api`;

    function stripDangerousHtml(html) {
        // Light sanitization: removes <script> blocks, inline event handlers, and javascript: URLs.
        // Admin controls this content; this is a defense-in-depth guardrail.
        let out = (html || '').toString();
        out = out.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
        out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
        out = out.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, '$1=$2#$3');
        return out;
    }

    async function loadSiteSettings() {
        const res = await fetch(`${API_URL}/settings/site`);
        if (!res.ok) throw new Error('Failed to load site settings');
        return await res.json();
    }

    async function renderLegalPage() {
        const mount = document.getElementById('legal-content');
        if (!mount) return;

        const pageType = (mount.dataset.page || '').toLowerCase();
        const titleEl = document.getElementById('legal-title');

        try {
            const settings = await loadSiteSettings();
            const html = pageType === 'terms'
                ? (settings?.legal?.termsHtml || '')
                : (settings?.legal?.privacyHtml || '');

            if (titleEl) {
                titleEl.textContent = pageType === 'terms' ? 'Terms & Conditions' : 'Privacy Policy';
            }

            const safeHtml = stripDangerousHtml(html);
            mount.innerHTML = safeHtml || '<p>Content not configured yet.</p>';
        } catch (e) {
            mount.innerHTML = '<p>Unable to load content right now.</p>';
        }
    }

    document.addEventListener('DOMContentLoaded', renderLegalPage);
})();
