(function () {
    const contexts = new Map();
    const call = (path, body) => window.posApiRequest('/cxc-authorization/' + path, body ? { method: 'POST', body: JSON.stringify(body) } : {});
    const fingerprint = p => JSON.stringify([p.deudorId, p.tipo, Math.round(Number(p.monto) * 100), p.autorizador, p.motivo, p.notas || null]);
    async function mount(key, container, proposal, selected) {
        if (!container) return;
        const state = { proposal, selected, person: null, challenge: null, verified: null };
        contexts.set(key, state);
        const panel = document.createElement('div');
        panel.className = 'form-group';
        panel.innerHTML = '<strong>Deudor autorizado</strong><div data-people style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:8px 0"></div><label>Autorizado por</label><select data-author required><option value="">Selecciona quien autoriza</option></select><div style="display:flex;gap:8px;margin-top:8px"><button type="button" class="btn btn-secondary" data-request><i class="fab fa-whatsapp"></i> Solicitar codigo</button><input data-code type="password" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="Codigo recibido" style="min-width:0;flex:1"></div><div data-status role="status"></div>';
        container.prepend(panel);
        state.panel = panel;
        const author = panel.querySelector('[data-author]');
        try {
            const allowed = await call('allowed');
            if (!panel.isConnected) return;
            state.allowed = allowed;
            for (const a of allowed.autorizadores) {
                const option = document.createElement('option'); option.value = a.key; option.textContent = a.nombre; author.appendChild(option);
            }
            for (const person of allowed.deudores) {
                const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-secondary'; button.textContent = person.nombre;
                button.style.whiteSpace = 'normal'; button.style.minHeight = '52px';
                button.addEventListener('click', () => {
                    state.person = person; state.challenge = null; state.verified = null;
                    panel.querySelector('[data-code]').value = '';
                    panel.querySelector('[data-status]').textContent = '';
                    panel.querySelectorAll('[data-people] button').forEach(b => { b.classList.toggle('btn-primary', b === button); b.setAttribute('aria-pressed', String(b === button)); });
                    for (const option of author.options) { const a = allowed.autorizadores.find(a => a.key === option.value); option.disabled = !!a && a.deudorId === person.id; }
                    if (author.selectedOptions[0]?.disabled) author.value = '';
                    selected(person);
                });
                panel.querySelector('[data-people]').appendChild(button);
            }
            author.addEventListener('change', () => { state.challenge = null; state.verified = null; panel.querySelector('[data-code]').value = ''; });
            panel.querySelector('[data-request]').addEventListener('click', async event => {
                const button = event.currentTarget;
                try {
                    if (!state.person || !author.value) throw new Error('Selecciona deudor y autorizador.');
                    const p = { ...proposal(), deudorId: state.person.id, autorizador: author.value };
                    button.disabled = true;
                    state.challenge = null; state.verified = null;
                    const result = await call('request-code', p);
                    if (state.person?.id !== p.deudorId || author.value !== p.autorizador) return;
                    state.challenge = { ...result, expiresAt: new Date(Date.now() + Date.parse(result.expiresAt) - Date.parse(result.checkedAt)).toISOString(), fingerprint: fingerprint(p) };
                    panel.querySelector('[data-status]').textContent = 'Codigo enviado al WhatsApp del autorizador. Vence en 5 minutos.';
                } catch (error) { window.app.showToast(error.message, 'warning', 5000); }
                finally { button.disabled = false; }
            });
        } catch (_) { panel.querySelector('[data-status]').textContent = 'No se pudieron cargar los deudores autorizados. Recarga antes de continuar.'; }
    }
    async function authorize(key) {
        const state = contexts.get(key);
        if (!state?.person) throw new Error('Selecciona un deudor autorizado en la botonera.');
        const p = { ...state.proposal(), deudorId: state.person.id, autorizador: state.panel.querySelector('[data-author]').value };
        if (!state.challenge || state.challenge.fingerprint !== fingerprint(p) || Date.parse(state.challenge.expiresAt) <= Date.now()) throw new Error('Solicita un codigo para el deudor e importe actuales.');
        const challenge = state.challenge, person = state.person;
        if (state.verified) await call('authorization-status', { id: state.verified.autorizacionId });
        if (!state.verified) {
            const code = state.panel.querySelector('[data-code]').value;
            const verified = await call('verify-code', { id: challenge.id, code });
            if (state.challenge !== challenge || state.person?.id !== person.id || fingerprint({ ...state.proposal(), deudorId: person.id, autorizador: state.panel.querySelector('[data-author]').value }) !== challenge.fingerprint) throw new Error('Los datos cambiaron durante la autorizacion. Solicita otro codigo.');
            state.verified = verified;
            state.panel.querySelector('[data-code]').value = '';
        }
        return { autorizacionId: state.verified.autorizacionId, deudor: person };
    }
    function notify(key) {
        const state = contexts.get(key);
        if (state) { state.challenge = null; state.verified = null; state.person = null; state.panel.querySelector('[data-code]').value = ''; state.panel.querySelector('[data-author]').value = ''; state.panel.querySelector('[data-status]').textContent = ''; state.panel.querySelectorAll('[data-people] button').forEach(b => { b.classList.remove('btn-primary'); b.setAttribute('aria-pressed', 'false'); }); }
        call('notify', {}).catch(() => window.app.showToast('Deuda guardada; aviso al grupo pendiente de envio.', 'warning', 5000));
    }
    window.cxcAutorizacion = { mount, authorize, notify };
})();
