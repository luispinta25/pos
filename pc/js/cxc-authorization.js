(function () {
    const contexts = new Map();
    const call = (path, body) => window.posApiRequest('/api/cxc-authorization/' + path, body ? { method: 'POST', body: JSON.stringify(body) } : {});
    const fingerprint = p => JSON.stringify([p.deudorId, p.tipo, Math.round(Number(p.monto) * 100), p.autorizador, p.motivo, p.notas || null]);
    async function mount(key, container, proposal, selected, options = {}) {
        if (!container) return;
        const state = { proposal, selected, options, pendingId: null, person: null, authorizer: '', challenge: null, verified: null };
        contexts.set(key, state);
        const panel = document.createElement('div');
        panel.className = 'form-group';
        panel.innerHTML = '<strong>Deudor autorizado</strong><div data-people style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:8px 0"></div><strong>Autorizado por</strong><div data-authors style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:8px 0"></div><div style="display:flex;gap:8px;margin-top:8px"><button type="button" class="btn btn-secondary" data-request><i class="fab fa-whatsapp"></i> Solicitar codigo</button><input class="form-input" data-code type="password" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="Codigo recibido" style="min-width:0;flex:1"></div><div data-status role="status"></div>';
        container.prepend(panel);
        state.panel = panel;
        try {
            const allowed = await call('allowed');
            if (!panel.isConnected || contexts.get(key) !== state) return;
            state.allowed = allowed;
            for (const a of allowed.autorizadores) {
                const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-secondary'; button.textContent = a.nombre;
                button.dataset.authorKey = a.key; button.style.whiteSpace = 'normal'; button.style.minHeight = '52px'; button.disabled = true;
                button.setAttribute('aria-pressed', 'false');
                button.addEventListener('click', () => {
                    state.authorizer = a.key; clearChallenge(state); renderAuthors(state);
                });
                panel.querySelector('[data-authors]').appendChild(button);
            }
            for (const person of allowed.deudores) {
                const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-secondary'; button.textContent = person.nombre;
                button.dataset.personId = person.id;
                button.style.whiteSpace = 'normal'; button.style.minHeight = '52px';
                button.addEventListener('click', () => {
                    state.pendingId = null;
                    state.person = person; state.challenge = null; state.verified = null;
                    panel.querySelector('[data-code]').value = '';
                    panel.querySelector('[data-status]').textContent = '';
                    panel.querySelectorAll('[data-people] button').forEach(b => { b.classList.toggle('btn-primary', b === button); b.classList.toggle('btn-secondary', b !== button); b.setAttribute('aria-pressed', String(b === button)); });
                    if (allowed.autorizadores.find(a => a.key === state.authorizer)?.deudorId === person.id) state.authorizer = '';
                    const eligible = allowed.autorizadores.filter(a => a.deudorId !== person.id);
                    if (options.autoCross && eligible.length === 1) state.authorizer = eligible[0].key;
                    renderAuthors(state);
                    selected(person);
                });
                panel.querySelector('[data-people]').appendChild(button);
            }
            panel.querySelector('[data-request]').addEventListener('click', async event => {
                const button = event.currentTarget;
                try {
                    if (!state.person || !state.authorizer) throw new Error('Selecciona deudor y autorizador.');
                    const p = { ...proposal(), deudorId: state.person.id, autorizador: state.authorizer };
                    clearChallenge(state);
                    const invalid = validateRequest(p);
                    if (invalid) {
                        const field = document.getElementById(options.fields?.[invalid.field] || '');
                        field?.focus();
                        field?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                        throw new Error(invalid.message);
                    }
                    button.disabled = true;
                    state.challenge = null; state.verified = null;
                    const result = await call('request-code', p);
                    if (state.person?.id !== p.deudorId || state.authorizer !== p.autorizador) return;
                    state.challenge = { ...result, expiresAt: new Date(Date.now() + Date.parse(result.expiresAt) - Date.parse(result.checkedAt)).toISOString(), fingerprint: fingerprint(p) };
                    panel.querySelector('[data-status]').textContent = 'Codigo enviado al WhatsApp del autorizador. Vence en 5 minutos.';
                } catch (error) {
                    panel.querySelector('[data-status]').textContent = error.message;
                    window.app.showToast(error.message, 'warning', 5000);
                }
                finally { button.disabled = false; }
            });
            if (state.pendingId) select(key, state.pendingId);
        } catch (_) { panel.querySelector('[data-status]').textContent = 'No se pudieron cargar los deudores autorizados. Recarga antes de continuar.'; }
    }
    async function authorize(key) {
        const state = contexts.get(key);
        if (!state?.person) throw new Error('Selecciona un deudor autorizado en la botonera.');
        const p = { ...state.proposal(), deudorId: state.person.id, autorizador: state.authorizer };
        if (!state.challenge || state.challenge.fingerprint !== fingerprint(p) || Date.parse(state.challenge.expiresAt) <= Date.now()) throw new Error('Solicita un codigo para el deudor e importe actuales.');
        const challenge = state.challenge, person = state.person;
        if (state.verified) await call('authorization-status', { id: state.verified.autorizacionId });
        if (!state.verified) {
            const code = state.panel.querySelector('[data-code]').value;
            const verified = await call('verify-code', { id: challenge.id, code });
            if (state.challenge !== challenge || state.person?.id !== person.id || fingerprint({ ...state.proposal(), deudorId: person.id, autorizador: state.authorizer }) !== challenge.fingerprint) throw new Error('Los datos cambiaron durante la autorizacion. Solicita otro codigo.');
            state.verified = verified;
            state.panel.querySelector('[data-code]').value = '';
        }
        return { autorizacionId: state.verified.autorizacionId, deudor: person };
    }
    function validateRequest(proposal) {
        if (!['VENTA', 'EFECTIVO', 'OTROS'].includes(proposal.tipo)) return { field: 'tipo', message: 'Selecciona el tipo de obligacion antes de solicitar el codigo.' };
        const amount = Math.round(Number(proposal.monto) * 100) / 100;
        if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) return { field: 'monto', message: 'Ingresa un monto mayor que cero (maximo $1.000.000) antes de solicitar el codigo.' };
        const reason = String(proposal.motivo || '').trim();
        if (!reason || reason.length > 500) return { field: 'motivo', message: 'Completa el motivo de la deuda (maximo 500 caracteres) antes de solicitar el codigo.' };
        if (String(proposal.notas || '').length > 2000) return { field: 'notas', message: 'Las notas no pueden superar los 2000 caracteres.' };
        return null;
    }
    function clearChallenge(state) {
        state.challenge = null; state.verified = null;
        state.panel.querySelector('[data-code]').value = '';
        state.panel.querySelector('[data-status]').textContent = '';
    }
    function renderAuthors(state) {
        state.panel.querySelectorAll('[data-author-key]').forEach(button => {
            const author = state.allowed?.autorizadores.find(a => a.key === button.dataset.authorKey);
            button.disabled = !state.person || author?.deudorId === state.person.id;
            const active = !button.disabled && state.authorizer === button.dataset.authorKey;
            button.classList.toggle('btn-primary', active); button.classList.toggle('btn-secondary', !active);
            button.setAttribute('aria-pressed', String(active));
        });
    }
    function reset(key) {
        const state = contexts.get(key);
        if (state) { clearChallenge(state); state.pendingId = null; state.person = null; state.authorizer = ''; renderAuthors(state); state.panel.querySelectorAll('[data-people] button').forEach(b => { b.classList.remove('btn-primary'); b.classList.add('btn-secondary'); b.setAttribute('aria-pressed', 'false'); }); }
    }
    function select(key, personId) {
        const state = contexts.get(key);
        if (!state || !personId || personId === 'todos') return false;
        if (!state.allowed) { state.pendingId = personId; return false; }
        state.pendingId = null;
        const button = [...state.panel.querySelectorAll('[data-person-id]')].find(b => b.dataset.personId === personId);
        if (!button) {
            state.panel.querySelector('[data-status]').textContent = 'El deudor filtrado no esta autorizado para nuevas deudas. Selecciona uno de la botonera.';
            return false;
        }
        button.click();
        return true;
    }
    function notify(key) {
        reset(key);
        call('notify', {}).catch(() => window.app.showToast('Deuda guardada; aviso al grupo pendiente de envio.', 'warning', 5000));
    }
    window.cxcAutorizacion = { mount, authorize, notify, reset, select };
})();
