(function () {
    const DAY = 86400000;
    let generation = 0, active = false, timer = null, cache = null;
    let serverOffset = 0;

    function intervalFor(status, now) {
        if (status.expired) return 600000;
        const expiry = Date.parse(status.expiresAt);
        if (!Number.isFinite(expiry)) return null;
        const remaining = expiry - now;
        if (remaining > 3 * DAY) return null;
        if (remaining <= DAY) return 600000;
        if (remaining <= 2 * DAY) return 1800000;
        return 3600000;
    }

    function leave() {
        active = false;
        generation++;
        clearTimeout(timer);
        timer = null;
        cache = null;
    }

    function tick() {
        clearTimeout(timer);
        if (!active || !cache) return;
        const now = Date.now() + serverOffset;
        const interval = intervalFor(cache, now);
        const expiry = Date.parse(cache.expiresAt);
        // Reevaluate locally when the three-day notification window begins.
        if (!interval) {
            if (Number.isFinite(expiry)) timer = setTimeout(tick, Math.min(2147483647, Math.max(1000, expiry - now - 3 * DAY)));
            return;
        }
        const key = 'pos.billingValidity.last.' + (cache.expiresAt || 'expired');
        let last = 0;
        try { last = Number(sessionStorage.getItem(key)) || 0; } catch (_) {}
        if (!document.hidden && now - last >= interval) {
            const days = Math.max(0, Math.ceil((expiry - now) / DAY));
            const message = cache.expired || expiry <= now
                ? 'La credencial del servicio de facturacion ha vencido. Solicita su renovacion.'
                : `La credencial del servicio de facturacion vence en ${days} dia${days === 1 ? '' : 's'}. Solicita su renovacion.`;
            window.app.showToast(message, 'warning', 12000);
            try { sessionStorage.setItem(key, String(now)); } catch (_) {}
            last = now;
        }
        timer = setTimeout(tick, document.hidden ? interval : Math.max(1000, interval - (now - last)));
    }

    async function enter() {
        leave();
        active = true;
        const current = generation;
        try {
            const status = await window.posApiRequest('/billing/api-key-validity');
            if (!active || current !== generation) return;
            cache = status;
            const checked = Date.parse(status.checkedAt);
            serverOffset = Number.isFinite(checked) ? checked - Date.now() : 0;
            tick();
        } catch (_) {
            // An unavailable check must not interrupt checkout or expose upstream errors.
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (active && !document.hidden) tick();
    });
    window.billingValidity = { enter, leave, intervalFor };
})();
