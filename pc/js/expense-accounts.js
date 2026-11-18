(function () {
    window.createExpenseAccounts = function ({ select, amount, container, accounts, money, request }) {
        let codes = [], serial = 0, plan = null, loading = false, stamp = '', timer = null;
        const snapshot = () => JSON.stringify([Number(amount.value), codes]);
        const render = message => {
            container.replaceChildren();
            if (message) { container.textContent = message; return; }
            if (!plan) return;
            plan.cuentas.forEach((row, index) => {
                const line = document.createElement('div'); line.className = 'gx-bank-leg';
                const name = document.createElement('span'); name.textContent = (index + 1) + '. ' + (accounts.find(a => a.codigo === row.codigo)?.nombre || row.codigo);
                const value = document.createElement('strong'); value.textContent = money(row.monto); line.append(name, value);
                if (index > 0) {
                    const remove = document.createElement('button'); remove.type = 'button'; remove.title = 'Quitar esta cuenta y las siguientes'; remove.setAttribute('aria-label', remove.title);
                    remove.innerHTML = '<i class="fas fa-times"></i>';
                    remove.onclick = () => { codes = codes.slice(0, index); refresh(); }; line.append(remove);
                }
                container.append(line);
            });
            const status = document.createElement('div'); status.className = plan.pendiente > 0 ? 'gx-bank-pending' : 'gx-bank-ready';
            status.textContent = plan.pendiente > 0 ? 'Faltan ' + money(plan.pendiente) : 'Total cubierto: ' + money(amount.value); container.append(status);
            if (plan.pendiente > 0) {
                const next = document.createElement('select'); next.setAttribute('aria-label', 'Siguiente cuenta de origen');
                const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Selecciona otra cuenta'; next.append(empty);
                accounts.filter(a => !codes.includes(a.codigo)).forEach(a => { const option = document.createElement('option'); option.value = a.codigo; option.textContent = a.nombre; next.append(option); });
                next.onchange = () => { if (next.value) { codes.push(next.value); refresh(); } }; container.append(next);
            }
        };
        async function refresh() {
            clearTimeout(timer);
            const token = ++serial, total = Number(amount.value); plan = null; loading = false;
            if (!codes.length) return render('Selecciona la primera cuenta.');
            if (!Number.isFinite(total) || total <= 0) return render('Ingresa el monto del gasto.');
            loading = true; render('Consultando reparto...'); const current = snapshot();
            try {
                const result = await request('/api/expenses/transfer-plan', { method: 'POST', body: JSON.stringify({ monto: total, cuentas: codes.map(codigo => ({ codigo })) }) });
                if (!container.isConnected || token !== serial) return;
                plan = result.data; stamp = current; render();
            } catch (error) { if (container.isConnected && token === serial) render(error.message); }
            finally { if (token === serial) loading = false; }
        }
        function reset() { clearTimeout(timer); serial++; codes = []; plan = null; loading = false; select.value = ''; container.replaceChildren(); }
        select.onchange = () => { codes = select.value ? [select.value] : []; refresh(); };
        amount.oninput = () => { serial++; plan = null; loading = false; clearTimeout(timer); timer = setTimeout(refresh, 200); };
        return {
            refresh, reset, destroy: () => { clearTimeout(timer); serial++; },
            allocation() {
                if (loading || !plan || stamp !== snapshot()) throw new Error('Consulta el reparto de cuentas antes de guardar.');
                if (Number(plan.pendiente) > 0) throw new Error('Selecciona otra cuenta para cubrir el monto restante.');
                return plan.cuentas.map(row => ({ codigo: row.codigo, monto: Number(row.monto) }));
            }
        };
    };
})();
