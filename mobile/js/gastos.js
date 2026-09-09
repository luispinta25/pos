'use strict';
let mgData = null, mgPeriod = null, mgTab = 'fixed', mgDailyMethod = 'EFECTIVO', mgFixedMethod = 'EFECTIVO';
const mgMoney = value => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
const mgDays = (from, to) => Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000);
const mgOutstanding = period => !['PAGADO', 'OMITIDO', 'ANULADO'].includes(period.estado);

function initGastosDate() {}
function mgSetTab(tab) {
    mgTab = tab;
    document.querySelectorAll('[data-mobile-gasto-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.mobileGastoTab === tab));
    $('mgFixedView').classList.toggle('hidden', tab !== 'fixed');
    $('mgDailyView').classList.toggle('hidden', tab !== 'daily');
    $('nuevoGastoFab').classList.toggle('hidden', tab !== 'daily');
}

async function loadGastos() {
    $('mgFixedList').innerHTML = '<div class="gastos-empty"><i class="fas fa-spinner fa-spin"></i>Actualizando...</div>';
    try {
        mgData = (await posApiRequest('/api/expenses/overview', { method: 'GET' })).data;
        renderMobileFixed(); renderGastos(mgData.paymentsToday || []); fillMobileExpenseOptions();
    } catch (error) {
        $('mgFixedList').innerHTML = `<div class="gastos-empty" style="color:var(--danger);"><i class="fas fa-exclamation-triangle"></i>${escHtml(error.message)}</div>`;
    }
}

function renderMobileFixed() {
    const templates = new Map((mgData.templates || []).map(item => [item.id, item]));
    const periods = (mgData.periods || []).map(p => ({ ...p, template: templates.get(p.gasto_fijo_id) }))
        .filter(p => mgOutstanding(p) && mgDays(mgData.today, p.fecha_vencimiento) <= 7)
        .sort((a, b) => (mgOutstanding(a) ? 0 : 1) - (mgOutstanding(b) ? 0 : 1) || a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
    const overdue = periods.filter(p => mgOutstanding(p) && p.fecha_vencimiento < mgData.today);
    const upcoming = periods.filter(p => { const d = mgDays(mgData.today, p.fecha_vencimiento); return mgOutstanding(p) && d >= 0 && d <= 7; });
    $('mgPendingCount').textContent = periods.filter(mgOutstanding).length;
    $('mgOverdue').textContent = mgMoney(overdue.reduce((sum, p) => sum + Number(p.saldo || 0), 0));
    $('mgUpcoming').textContent = mgMoney(upcoming.reduce((sum, p) => sum + Number(p.saldo || 0), 0));
    $('mgFixedList').innerHTML = periods.length ? periods.map(p => {
        const days = mgDays(mgData.today, p.fecha_vencimiento), pending = mgOutstanding(p);
        const state = !pending ? 'PAGADO' : days < 0 ? `VENCIDO ${Math.abs(days)} DÍAS` : days === 0 ? 'VENCE HOY' : `EN ${days} DÍAS`;
        const cls = !pending ? 'paid' : days < 0 ? 'overdue' : days <= 7 ? 'upcoming' : '';
        const amountInput = p.monto_esperado == null ? `<div class="mg-inline"><input type="number" data-mg-amount="${p.id}" min=".01" step=".01" placeholder="Monto de la planilla"><button data-mg-save="${p.id}"><i class="fas fa-save"></i></button></div>` : '';
        const pay = pending && p.monto_esperado != null ? `<button class="mg-pay" data-mg-pay="${p.id}"><i class="fas fa-wallet"></i> ${p.template?.permite_abonos ? 'Abonar' : 'Pagar'}</button>` : '';
        return `<article class="mg-fixed ${cls}"><div class="mg-fixed-head"><div><h3>${escHtml(p.template?.nombre || 'Gasto fijo')}</h3><small>${escHtml(p.template?.beneficiario || 'Sin beneficiario')} · ${escHtml(p.fecha_vencimiento)}</small></div><b>${state}</b></div><div class="mg-money"><span>Valor<strong>${p.monto_esperado == null ? 'Por confirmar' : mgMoney(p.monto_esperado)}</strong></span><span>Pagado<strong>${mgMoney(p.monto_pagado)}</strong></span><span>Saldo<strong>${p.saldo == null ? 'Por confirmar' : mgMoney(p.saldo)}</strong></span></div>${p.notas ? `<p>${escHtml(p.notas)}</p>` : ''}${amountInput}${pay}</article>`;
    }).join('') : '<div class="gastos-empty">No hay gastos vencidos ni próximos en los siguientes 7 días.</div>';
}

function renderGastos(gastos) {
    const active = gastos.filter(g => g.estado !== 'ANULADO');
    $('gastosSummaryCount').textContent = `${active.length} gasto${active.length === 1 ? '' : 's'}`;
    $('gastosSummaryTotal').textContent = mgMoney(active.reduce((sum, g) => sum + Number(g.monto || 0), 0));
    $('gastosSummary').classList.toggle('hidden', !gastos.length);
    $('gastosList').innerHTML = gastos.length ? gastos.map(g => `<div class="gasto-card ${g.estado === 'ANULADO' ? 'mg-cancelled' : ''}"><div class="gasto-card-left"><div class="gasto-motivo-text">${escHtml(g.motivo)}</div><div class="gasto-meta"><span>${escHtml(g.categoria_codigo)}</span><span>${escHtml(g.metodo_pago)}</span>${g.estado === 'ANULADO' ? '<span>ANULADO</span>' : ''}</div></div><div class="gasto-card-right"><span class="gasto-monto-text">${mgMoney(g.monto)}</span>${g.estado !== 'ANULADO' && ['admin','administrador'].includes(String(mgData.role).toLowerCase()) ? `<button class="btn-del-gasto" data-mg-cancel="${g.idigasto}"><i class="fas fa-ban"></i></button>` : ''}</div></div>`).join('') : '<div class="gastos-empty"><i class="fas fa-receipt"></i>Sin gastos registrados hoy.</div>';
}

function fillMobileExpenseOptions() {
    $('gastoCategoriaInput').innerHTML = (mgData.categories || []).map(c => `<option value="${escHtml(c.codigo)}">${escHtml(c.nombre)}</option>`).join('');
    const options = '<option value="">Selecciona una cuenta</option>' + (mgData.accounts || []).map(a => `<option value="${escHtml(a.codigo)}">${escHtml(a.nombre)}</option>`).join('');
    $('mgDailyAccount').innerHTML = options; $('mgFixedAccount').innerHTML = options;
}

function mgSelectMethod(kind, method) {
    if (kind === 'daily') mgDailyMethod = method; else mgFixedMethod = method;
    document.querySelectorAll(`[data-mg-${kind}-method]`).forEach(btn => btn.classList.toggle('active', btn.dataset[`mg${kind[0].toUpperCase()}${kind.slice(1)}Method`] === method));
    $(`mg${kind[0].toUpperCase()}${kind.slice(1)}AccountWrap`).classList.toggle('hidden', method !== 'TRANSFERENCIA');
}

async function saveMobileExpense(body) {
    const result = await posApiRequest('/api/expenses/payments', { method: 'POST', body: JSON.stringify(body) });
    showToast(result.data?.codigo_transferencia ? `Registrado. ${result.data.codigo_transferencia} espera comprobante.` : 'Gasto registrado', 'success', 4500);
    await loadGastos();
}

async function guardarGasto() {
    const body = { monto: Number($('gastoMontoInput').value), motivo: $('gastoMotivoInput').value.trim(), categoria_codigo: $('gastoCategoriaInput').value, beneficiario: $('gastoBeneficiarioInput').value.trim(), metodo_pago: mgDailyMethod, metodo_transferencia_codigo: $('mgDailyAccount').value || null, aplicaciones: [] };
    if (!body.monto || !body.motivo) return showToast('Completa monto y motivo', 'error');
    if (mgDailyMethod === 'TRANSFERENCIA' && !body.metodo_transferencia_codigo) return showToast('Selecciona la cuenta de origen', 'error');
    try { await saveMobileExpense(body); hideModal('nuevoGastoModal'); } catch (error) { showToast(error.message, 'error', 4500); }
}

function openMobileFixedPayment(id) {
    const period = (mgData.periods || []).find(p => p.id === id); if (!period) return;
    const template = (mgData.templates || []).find(t => t.id === period.gasto_fijo_id) || {};
    mgPeriod = { ...period, template }; $('mgPayTitle').textContent = template.nombre; $('mgPayBalance').textContent = `Saldo pendiente: ${mgMoney(period.saldo)}`;
    $('mgPayAmount').value = Number(period.saldo).toFixed(2); $('mgPayAmount').max = Number(period.saldo).toFixed(2); $('mgPayAmount').readOnly = !template.permite_abonos;
    mgSelectMethod('fixed', template.metodo_pago_predeterminado || 'EFECTIVO'); showModal('gastoFijoPagoModal');
}

async function confirmMobileFixedPayment() {
    if (!mgPeriod) return; const amount = Number($('mgPayAmount').value), account = $('mgFixedAccount').value, note = $('mgPayNote').value.trim();
    if (!amount || amount > Number(mgPeriod.saldo) + .005) return showToast('El monto supera el saldo', 'error');
    if (mgFixedMethod === 'TRANSFERENCIA' && !account) return showToast('Selecciona la cuenta de origen', 'error');
    try { await saveMobileExpense({ monto: amount, motivo: `Pago ${mgPeriod.template.nombre}${note ? ` - ${note}` : ''}`, categoria_codigo: mgPeriod.template.categoria_codigo, beneficiario: mgPeriod.template.beneficiario, metodo_pago: mgFixedMethod, metodo_transferencia_codigo: account || null, aplicaciones: [{ programado_id: mgPeriod.id, monto: amount }] }); hideModal('gastoFijoPagoModal'); mgPeriod = null; } catch (error) { showToast(error.message, 'error', 4500); }
}

async function saveMobileVariableAmount(id) {
    const amount = Number(document.querySelector(`[data-mg-amount="${id}"]`)?.value); if (!amount) return showToast('Ingresa el monto', 'error');
    try { await posApiRequest(`/api/expenses/periods/${encodeURIComponent(id)}/amount`, { method: 'PATCH', body: JSON.stringify({ monto: amount }) }); await loadGastos(); } catch (error) { showToast(error.message, 'error'); }
}

async function cancelMobileExpense(id) {
    const reason = prompt('Motivo obligatorio de la anulación:'); if (!reason?.trim()) return;
    try { await posApiRequest(`/api/expenses/payments/${id}/cancel`, { method: 'POST', body: JSON.stringify({ motivo: reason.trim() }) }); await loadGastos(); } catch (error) { showToast(error.message, 'error'); }
}

function initGastos_eventListeners() {
    $('gastosBackBtn').addEventListener('click', () => navigateTo('pos')); $('gastosRefreshBtn').addEventListener('click', loadGastos);
    document.querySelectorAll('[data-mobile-gasto-tab]').forEach(btn => btn.addEventListener('click', () => mgSetTab(btn.dataset.mobileGastoTab)));
    document.querySelectorAll('[data-mg-daily-method]').forEach(btn => btn.addEventListener('click', () => mgSelectMethod('daily', btn.dataset.mgDailyMethod)));
    document.querySelectorAll('[data-mg-fixed-method]').forEach(btn => btn.addEventListener('click', () => mgSelectMethod('fixed', btn.dataset.mgFixedMethod)));
    $('nuevoGastoFab').addEventListener('click', () => { $('gastoMontoInput').value=''; $('gastoMotivoInput').value=''; $('gastoBeneficiarioInput').value=''; mgSelectMethod('daily','EFECTIVO'); showModal('nuevoGastoModal'); });
    $('btnGuardarGasto').addEventListener('click', guardarGasto); $('mgConfirmPay').addEventListener('click', confirmMobileFixedPayment);
    $('gastosScreen').addEventListener('click', event => { const pay=event.target.closest('[data-mg-pay]'), save=event.target.closest('[data-mg-save]'), cancel=event.target.closest('[data-mg-cancel]'); if(pay)openMobileFixedPayment(pay.dataset.mgPay); if(save)saveMobileVariableAmount(save.dataset.mgSave); if(cancel)cancelMobileExpense(cancel.dataset.mgCancel); });
    mgSetTab('fixed');
}
