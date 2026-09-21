'use strict';
let mgData = null, mgPeriod = null, mgTab = 'fixed', mgDailyMethod = 'EFECTIVO', mgFixedMethod = 'EFECTIVO';
const mgMoney = value => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
const mgDate = value => new Intl.DateTimeFormat('es-EC', { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`));
const mgTime = value => value ? new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' }).format(new Date(value)) : '';
const mgCategoryName = code => (mgData?.categories || []).find(item => item.codigo === code)?.nombre || code || 'Otros';
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
        const expected = Number(p.monto_esperado || 0), paid = Number(p.monto_pagado || 0), progress = expected ? Math.min(100, Math.round(paid / expected * 100)) : 0;
        const amountInput = p.monto_esperado == null ? `<div class="mg-inline"><input type="number" data-mg-amount="${p.id}" min=".01" step=".01" placeholder="Monto de la planilla"><button data-mg-save="${p.id}" title="Confirmar monto"><i class="fas fa-check"></i></button></div>` : '';
        const pay = pending && p.monto_esperado != null ? `<button class="mg-pay" data-mg-pay="${p.id}"><i class="fas fa-wallet"></i> ${p.template?.permite_abonos ? 'Abonar' : 'Pagar'}</button>` : '';
        return `<article class="mg-fixed ${cls}"><div class="mg-fixed-head"><div class="mg-fixed-title"><span><i class="fas ${days < 0 ? 'fa-triangle-exclamation' : 'fa-calendar-day'}"></i></span><div><h3>${escHtml(p.template?.nombre || 'Gasto fijo')}</h3><small>${escHtml(p.template?.beneficiario || 'Sin beneficiario')}</small></div></div><b>${state}</b></div><div class="mg-due"><span>Saldo pendiente<strong>${p.saldo == null ? 'Por confirmar' : mgMoney(p.saldo)}</strong></span><time>${escHtml(mgDate(p.fecha_vencimiento))}</time></div><div class="mg-progress"><span style="width:${progress}%"></span></div><div class="mg-money"><span>Obligación<strong>${p.monto_esperado == null ? 'Por confirmar' : mgMoney(p.monto_esperado)}</strong></span><span>Pagado<strong>${mgMoney(p.monto_pagado)}</strong></span></div>${p.notas ? `<p><i class="fas fa-note-sticky"></i> ${escHtml(p.notas)}</p>` : ''}${amountInput}${pay}</article>`;
    }).join('') : '<div class="gastos-empty">No hay gastos vencidos ni próximos en los siguientes 7 días.</div>';
}

function renderGastos(gastos) {
    const active = gastos.filter(g => g.estado !== 'ANULADO');
    $('gastosSummaryCount').textContent = `${active.length} gasto${active.length === 1 ? '' : 's'}`;
    $('gastosSummaryTotal').textContent = mgMoney(active.reduce((sum, g) => sum + Number(g.monto || 0), 0));
    $('gastosSummary').classList.toggle('hidden', !gastos.length);
    $('gastosList').innerHTML = gastos.length ? gastos.map(g => {
        const cancelled = g.estado === 'ANULADO', transfer = g.metodo_pago === 'TRANSFERENCIA', time = mgTime(g.fechayhora);
        const beneficiary = g.beneficiario ? `<span><i class="fas fa-user"></i>${escHtml(g.beneficiario)}</span>` : '';
        return `<article class="gasto-card ${cancelled ? 'mg-cancelled' : ''}"><span class="gasto-method-icon ${transfer ? 'transfer' : ''}"><i class="fas ${transfer ? 'fa-building-columns' : 'fa-money-bill-wave'}"></i></span><div class="gasto-card-left"><div class="gasto-motivo-text">${escHtml(g.motivo)}</div><div class="gasto-meta"><b>${escHtml(mgCategoryName(g.categoria_codigo))}</b>${beneficiary}${cancelled ? '<b>ANULADO</b>' : ''}</div></div><div class="gasto-card-right"><span class="gasto-monto-text">${mgMoney(g.monto)}</span><small>${escHtml(transfer ? 'Transferencia' : 'Efectivo')}${time ? ` · ${escHtml(time)}` : ''}</small>${!cancelled && ['admin','administrador'].includes(String(mgData.role).toLowerCase()) ? `<button class="btn-del-gasto" data-mg-cancel="${g.idigasto}" title="Anular gasto"><i class="fas fa-ban"></i></button>` : ''}</div></article>`;
    }).join('') : '<div class="gastos-empty"><i class="fas fa-receipt"></i>Sin movimientos registrados hoy.</div>';
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
    $('gastosBackBtn').addEventListener('click', () => navigateTo('pos')); $('gastosRefreshBtn').addEventListener('click', () => { loadGastos(); if (ixData) loadIngresos(); });
    document.querySelectorAll('[data-mobile-gasto-tab]').forEach(btn => btn.addEventListener('click', () => mgSetTab(btn.dataset.mobileGastoTab)));
    document.querySelectorAll('[data-mg-daily-method]').forEach(btn => btn.addEventListener('click', () => mgSelectMethod('daily', btn.dataset.mgDailyMethod)));
    document.querySelectorAll('[data-mg-fixed-method]').forEach(btn => btn.addEventListener('click', () => mgSelectMethod('fixed', btn.dataset.mgFixedMethod)));
    $('nuevoGastoFab').addEventListener('click', () => { $('gastoMontoInput').value=''; $('gastoMotivoInput').value=''; $('gastoBeneficiarioInput').value=''; mgSelectMethod('daily','EFECTIVO'); showModal('nuevoGastoModal'); });
    $('btnGuardarGasto').addEventListener('click', guardarGasto); $('mgConfirmPay').addEventListener('click', confirmMobileFixedPayment);
    $('gastosScreen').addEventListener('click', event => { const pay=event.target.closest('[data-mg-pay]'), save=event.target.closest('[data-mg-save]'), cancel=event.target.closest('[data-mg-cancel]'); if(pay)openMobileFixedPayment(pay.dataset.mgPay); if(save)saveMobileVariableAmount(save.dataset.mgSave); if(cancel)cancelMobileExpense(cancel.dataset.mgCancel); });
    mgSetTab('fixed');
    initIngresos_eventListeners();
}

// ─── Sección Ingresos (submódulo, espeja la lógica de Gastos arriba) ──────
let ixData = null, ixPeriod = null, ixTab = 'fixed', ixDailyMethod = 'EFECTIVO', ixFixedMethod = 'EFECTIVO';
const ixCategoryName = code => (ixData?.categories || []).find(item => item.codigo === code)?.nombre || code || 'Otros';
const ixOutstanding = period => !['PAGADO', 'OMITIDO', 'ANULADO'].includes(period.estado);

function mgSetSection(section) {
    document.querySelectorAll('[data-mg-section]').forEach(btn => btn.classList.toggle('active', btn.dataset.mgSection === section));
    const esIngresos = section === 'ingresos';
    $('mgSectionGastos').classList.toggle('hidden', esIngresos);
    $('mgSectionIngresos').classList.toggle('hidden', !esIngresos);
    $('mgKicker').textContent = esIngresos ? 'INGRESOS DISTINTOS A VENTAS' : 'CONTROL DE EGRESOS';
    $('mgTitle').textContent = esIngresos ? 'Ingresos' : 'Gastos';
    if (esIngresos && !ixData) loadIngresos();
    if (esIngresos) ixSetTab(ixTab);
}

function ixSetTab(tab) {
    ixTab = tab;
    document.querySelectorAll('[data-mobile-ingreso-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.mobileIngresoTab === tab));
    $('ixFixedView').classList.toggle('hidden', tab !== 'fixed');
    $('ixDailyView').classList.toggle('hidden', tab !== 'daily');
    $('nuevoIngresoFab').classList.toggle('hidden', tab !== 'daily');
}

async function loadIngresos() {
    $('ixFixedList').innerHTML = '<div class="gastos-empty"><i class="fas fa-spinner fa-spin"></i>Actualizando...</div>';
    try {
        ixData = (await posApiRequest('/api/income/overview', { method: 'GET' })).data;
        renderMobileIngresosFixed(); renderIngresos(ixData.paymentsToday || []); fillMobileIncomeOptions();
    } catch (error) {
        $('ixFixedList').innerHTML = `<div class="gastos-empty" style="color:var(--danger);"><i class="fas fa-exclamation-triangle"></i>${escHtml(error.message)}</div>`;
    }
}

function renderMobileIngresosFixed() {
    const templates = new Map((ixData.templates || []).map(item => [item.id, item]));
    const periods = (ixData.periods || []).map(p => ({ ...p, template: templates.get(p.ingreso_fijo_id) }))
        .filter(p => ixOutstanding(p) && mgDays(ixData.today, p.fecha_vencimiento) <= 7)
        .sort((a, b) => (ixOutstanding(a) ? 0 : 1) - (ixOutstanding(b) ? 0 : 1) || a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
    const overdue = periods.filter(p => ixOutstanding(p) && p.fecha_vencimiento < ixData.today);
    const upcoming = periods.filter(p => { const d = mgDays(ixData.today, p.fecha_vencimiento); return ixOutstanding(p) && d >= 0 && d <= 7; });
    $('ixPendingCount').textContent = periods.filter(ixOutstanding).length;
    $('ixOverdue').textContent = mgMoney(overdue.reduce((sum, p) => sum + Number(p.saldo || 0), 0));
    $('ixUpcoming').textContent = mgMoney(upcoming.reduce((sum, p) => sum + Number(p.saldo || 0), 0));
    $('ixFixedList').innerHTML = periods.length ? periods.map(p => {
        const days = mgDays(ixData.today, p.fecha_vencimiento), pending = ixOutstanding(p);
        const state = !pending ? 'COBRADO' : days < 0 ? `VENCIDO ${Math.abs(days)} DÍAS` : days === 0 ? 'VENCE HOY' : `EN ${days} DÍAS`;
        const cls = !pending ? 'paid' : days < 0 ? 'overdue' : days <= 7 ? 'upcoming' : '';
        const expected = Number(p.monto_esperado || 0), paid = Number(p.monto_pagado || 0), progress = expected ? Math.min(100, Math.round(paid / expected * 100)) : 0;
        const amountInput = p.monto_esperado == null ? `<div class="mg-inline"><input type="number" data-ix-amount="${p.id}" min=".01" step=".01" placeholder="Monto esperado"><button data-ix-save="${p.id}" title="Confirmar monto"><i class="fas fa-check"></i></button></div>` : '';
        const pay = pending && p.monto_esperado != null ? `<button class="mg-pay" data-ix-pay="${p.id}"><i class="fas fa-wallet"></i> ${p.template?.permite_abonos ? 'Abonar' : 'Cobrar'}</button>` : '';
        return `<article class="mg-fixed ${cls}"><div class="mg-fixed-head"><div class="mg-fixed-title"><span><i class="fas ${days < 0 ? 'fa-triangle-exclamation' : 'fa-calendar-day'}"></i></span><div><h3>${escHtml(p.template?.nombre || 'Ingreso fijo')}</h3><small>${escHtml(p.template?.pagador || 'Sin pagador')}</small></div></div><b>${state}</b></div><div class="mg-due"><span>Saldo pendiente<strong>${p.saldo == null ? 'Por confirmar' : mgMoney(p.saldo)}</strong></span><time>${escHtml(mgDate(p.fecha_vencimiento))}</time></div><div class="mg-progress"><span style="width:${progress}%"></span></div><div class="mg-money"><span>Esperado<strong>${p.monto_esperado == null ? 'Por confirmar' : mgMoney(p.monto_esperado)}</strong></span><span>Cobrado<strong>${mgMoney(p.monto_pagado)}</strong></span></div>${p.notas ? `<p><i class="fas fa-note-sticky"></i> ${escHtml(p.notas)}</p>` : ''}${amountInput}${pay}</article>`;
    }).join('') : '<div class="gastos-empty">No hay ingresos vencidos ni próximos en los siguientes 7 días.</div>';
}

function renderIngresos(rows) {
    const active = rows.filter(r => r.estado !== 'ANULADO');
    $('ingresosSummaryCount').textContent = `${active.length} ingreso${active.length === 1 ? '' : 's'}`;
    $('ingresosSummaryTotal').textContent = mgMoney(active.reduce((sum, r) => sum + Number(r.monto || 0), 0));
    $('ingresosSummary').classList.toggle('hidden', !rows.length);
    $('ingresosList').innerHTML = rows.length ? rows.map(r => {
        const cancelled = r.estado === 'ANULADO', transfer = r.metodo_cobro === 'TRANSFERENCIA', time = mgTime(r.fechayhora);
        const payer = r.pagador ? `<span><i class="fas fa-user"></i>${escHtml(r.pagador)}</span>` : '';
        return `<article class="gasto-card ${cancelled ? 'mg-cancelled' : ''}"><span class="gasto-method-icon ${transfer ? 'transfer' : ''}"><i class="fas ${transfer ? 'fa-building-columns' : 'fa-money-bill-wave'}"></i></span><div class="gasto-card-left"><div class="gasto-motivo-text">${escHtml(r.motivo)}</div><div class="gasto-meta"><b>${escHtml(ixCategoryName(r.categoria_codigo))}</b>${payer}${cancelled ? '<b>ANULADO</b>' : ''}</div></div><div class="gasto-card-right"><span class="gasto-monto-text" style="color:#1a7f37;">${mgMoney(r.monto)}</span><small>${escHtml(transfer ? 'Transferencia' : 'Efectivo')}${time ? ` · ${escHtml(time)}` : ''}</small>${!cancelled && ['admin','administrador'].includes(String(ixData.role).toLowerCase()) ? `<button class="btn-del-gasto" data-ix-cancel="${r.idiingreso}" title="Anular ingreso"><i class="fas fa-ban"></i></button>` : ''}</div></article>`;
    }).join('') : '<div class="gastos-empty"><i class="fas fa-receipt"></i>Sin movimientos registrados hoy.</div>';
}

function fillMobileIncomeOptions() {
    $('ingresoCategoriaInput').innerHTML = (ixData.categories || []).map(c => `<option value="${escHtml(c.codigo)}">${escHtml(c.nombre)}</option>`).join('');
    const options = '<option value="">Selecciona una cuenta</option>' + (ixData.accounts || []).map(a => `<option value="${escHtml(a.codigo)}">${escHtml(a.nombre)}</option>`).join('');
    $('ixDailyAccount').innerHTML = options; $('ixFixedAccount').innerHTML = options;
}

function ixSelectMethod(kind, method) {
    if (kind === 'daily') ixDailyMethod = method; else ixFixedMethod = method;
    document.querySelectorAll(`[data-ix-${kind}-method]`).forEach(btn => btn.classList.toggle('active', btn.dataset[`ix${kind[0].toUpperCase()}${kind.slice(1)}Method`] === method));
    $(`ix${kind[0].toUpperCase()}${kind.slice(1)}AccountWrap`).classList.toggle('hidden', method !== 'TRANSFERENCIA');
}

async function saveMobileIncome(body) {
    const result = await posApiRequest('/api/income/payments', { method: 'POST', body: JSON.stringify(body) });
    showToast(result.data?.codigo_transferencia ? `Registrado. ${result.data.codigo_transferencia}` : 'Ingreso registrado', 'success', 4500);
    await loadIngresos();
}

async function guardarIngreso() {
    const body = { monto: Number($('ingresoMontoInput').value), motivo: $('ingresoMotivoInput').value.trim(), categoria_codigo: $('ingresoCategoriaInput').value, pagador: $('ingresoPagadorInput').value.trim(), metodo_cobro: ixDailyMethod, metodo_transferencia_codigo: $('ixDailyAccount').value || null, aplicaciones: [] };
    if (!body.monto || !body.motivo) return showToast('Completa monto y motivo', 'error');
    if (ixDailyMethod === 'TRANSFERENCIA' && !body.metodo_transferencia_codigo) return showToast('Selecciona la cuenta de destino', 'error');
    try { await saveMobileIncome(body); hideModal('nuevoIngresoModal'); } catch (error) { showToast(error.message, 'error', 4500); }
}

function openMobileFixedIncome(id) {
    const period = (ixData.periods || []).find(p => p.id === id); if (!period) return;
    const template = (ixData.templates || []).find(t => t.id === period.ingreso_fijo_id) || {};
    ixPeriod = { ...period, template }; $('ixPayTitle').textContent = template.nombre; $('ixPayBalance').textContent = `Saldo pendiente: ${mgMoney(period.saldo)}`;
    $('ixPayAmount').value = Number(period.saldo).toFixed(2); $('ixPayAmount').max = Number(period.saldo).toFixed(2); $('ixPayAmount').readOnly = !template.permite_abonos;
    ixSelectMethod('fixed', template.metodo_cobro_predeterminado || 'EFECTIVO'); showModal('ingresoFijoCobroModal');
}

async function confirmMobileFixedIncome() {
    if (!ixPeriod) return; const amount = Number($('ixPayAmount').value), account = $('ixFixedAccount').value, note = $('ixPayNote').value.trim();
    if (!amount || amount > Number(ixPeriod.saldo) + .005) return showToast('El monto supera el saldo', 'error');
    if (ixFixedMethod === 'TRANSFERENCIA' && !account) return showToast('Selecciona la cuenta de destino', 'error');
    try { await saveMobileIncome({ monto: amount, motivo: `Cobro ${ixPeriod.template.nombre}${note ? ` - ${note}` : ''}`, categoria_codigo: ixPeriod.template.categoria_codigo, pagador: ixPeriod.template.pagador, metodo_cobro: ixFixedMethod, metodo_transferencia_codigo: account || null, aplicaciones: [{ programado_id: ixPeriod.id, monto: amount }] }); hideModal('ingresoFijoCobroModal'); ixPeriod = null; } catch (error) { showToast(error.message, 'error', 4500); }
}

async function saveMobileIncomeVariableAmount(id) {
    const amount = Number(document.querySelector(`[data-ix-amount="${id}"]`)?.value); if (!amount) return showToast('Ingresa el monto', 'error');
    try { await posApiRequest(`/api/income/periods/${encodeURIComponent(id)}/amount`, { method: 'PATCH', body: JSON.stringify({ monto: amount }) }); await loadIngresos(); } catch (error) { showToast(error.message, 'error'); }
}

async function cancelMobileIncome(id) {
    const reason = prompt('Motivo obligatorio de la anulación:'); if (!reason?.trim()) return;
    try { await posApiRequest(`/api/income/payments/${id}/cancel`, { method: 'POST', body: JSON.stringify({ motivo: reason.trim() }) }); await loadIngresos(); } catch (error) { showToast(error.message, 'error'); }
}

function initIngresos_eventListeners() {
    document.querySelectorAll('[data-mg-section]').forEach(btn => btn.addEventListener('click', () => mgSetSection(btn.dataset.mgSection)));
    document.querySelectorAll('[data-mobile-ingreso-tab]').forEach(btn => btn.addEventListener('click', () => ixSetTab(btn.dataset.mobileIngresoTab)));
    document.querySelectorAll('[data-ix-daily-method]').forEach(btn => btn.addEventListener('click', () => ixSelectMethod('daily', btn.dataset.ixDailyMethod)));
    document.querySelectorAll('[data-ix-fixed-method]').forEach(btn => btn.addEventListener('click', () => ixSelectMethod('fixed', btn.dataset.ixFixedMethod)));
    $('nuevoIngresoFab').addEventListener('click', () => { $('ingresoMontoInput').value=''; $('ingresoMotivoInput').value=''; $('ingresoPagadorInput').value=''; ixSelectMethod('daily','EFECTIVO'); showModal('nuevoIngresoModal'); });
    $('btnGuardarIngreso').addEventListener('click', guardarIngreso); $('ixConfirmPay').addEventListener('click', confirmMobileFixedIncome);
    $('gastosScreen').addEventListener('click', event => { const pay=event.target.closest('[data-ix-pay]'), save=event.target.closest('[data-ix-save]'), cancel=event.target.closest('[data-ix-cancel]'); if(pay)openMobileFixedIncome(pay.dataset.ixPay); if(save)saveMobileIncomeVariableAmount(save.dataset.ixSave); if(cancel)cancelMobileIncome(cancel.dataset.ixCancel); });
    ixSetTab('fixed');
}
