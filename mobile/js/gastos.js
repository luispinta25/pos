'use strict';
// =====================================================
// Ferrisoluciones - POS Móvil - Módulo Gastos
// =====================================================

let gastosLoading = false;

function initGastosDate() {
    if (!$('gastosDateFilter').value) {
        $('gastosDateFilter').value = localDateStr();
    }
}

async function loadGastos() {
    if (gastosLoading) return;
    gastosLoading = true;
    $('gastosSummary').classList.add('hidden');
    $('gastosList').innerHTML = '<div class="gastos-empty"><i class="fas fa-spinner fa-spin"></i>Cargando gastos\u2026</div>';
    try {
        const fecha = $('gastosDateFilter').value || localDateStr();
        const { data, error } = await db.from('ferre_gastos')
            .select('*')
            .gte('fechayhora', `${fecha}T00:00:00-05:00`)
            .lte('fechayhora', `${fecha}T23:59:59-05:00`)
            .order('fechayhora', { ascending: false });
        if (error) throw error;
        renderGastos(data || []);
    } catch (err) {
        $('gastosList').innerHTML = `<div class="gastos-empty" style="color:var(--danger);"><i class="fas fa-exclamation-triangle"></i>Error: ${escHtml(err.message)}</div>`;
    } finally {
        gastosLoading = false;
    }
}

function renderGastos(gastos) {
    if (!gastos.length) {
        $('gastosList').innerHTML = '<div class="gastos-empty"><i class="fas fa-money-bill-wave"></i>Sin gastos en esta fecha.</div>';
        $('gastosSummary').classList.add('hidden');
        return;
    }
    const total = gastos.reduce((s, g) => s + parseFloat(g.monto || 0), 0);
    $('gastosSummaryCount').textContent = `${gastos.length} gasto${gastos.length !== 1 ? 's' : ''}`;
    $('gastosSummaryTotal').textContent = fmt(total);
    $('gastosSummary').classList.remove('hidden');
    const list = $('gastosList');
    list.innerHTML = '';
    gastos.forEach(g => {
        const fecha = new Date(g.fechayhora);
        const hora = fecha.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: true });
        const usuarioLabel = g.usuario ? g.usuario.split('@')[0] : 'desconocido';
        const div = document.createElement('div');
        div.className = 'gasto-card';
        div.innerHTML = `
            <div class="gasto-card-left">
                <div class="gasto-motivo-text">${escHtml(g.motivo || '')}</div>
                <div class="gasto-meta">
                    <span><i class="fas fa-clock"></i> ${hora}</span>
                    <span><i class="fas fa-user"></i> ${escHtml(usuarioLabel)}</span>
                    ${g.messageid ? '<span style="color:var(--success);"><i class="fas fa-check-circle"></i> Notificado</span>' : '<span style="color:var(--text-muted);"><i class="fas fa-exclamation-circle"></i> Sin notificar</span>'}
                </div>
            </div>
            <div class="gasto-card-right">
                <span class="gasto-monto-text">${fmt(g.monto)}</span>
                <button class="btn-del-gasto" onclick="confirmarEliminarGasto('${escHtml(String(g.idigasto))}','${escHtml(String(g.messageid || ''))}','${escHtml(String(g.remotejid || ''))}')"><i class="fas fa-trash-alt"></i></button>
            </div>`;
        list.appendChild(div);
    });
}

async function guardarGasto() {
    const monto = parseFloat($('gastoMontoInput').value);
    const motivo = $('gastoMotivoInput').value.trim();
    if (!monto || monto <= 0) { showToast('El monto debe ser mayor a 0', 'warning'); return; }
    if (!motivo) { showToast('El motivo es obligatorio', 'warning'); return; }
    const btn = $('btnGuardarGasto');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando…';
    try {
        const { data: userData } = await db.from('ferre_usuarios_ferreteria')
            .select('nombres, apellidos').eq('email', currentUser.email).single();
        const nomcompleto = userData ? `${userData.nombres} ${userData.apellidos}` : currentUser.email;

        let totalActual = 0;
        document.querySelectorAll('.gasto-monto-text').forEach(el => {
            totalActual += parseFloat(el.textContent.replace(/[^0-9.]/g, '')) || 0;
        });
        const totalConNuevo = totalActual + monto;
        const fechayhora = new Date().toISOString();

        const whatsapp = await enviarNotificacionGasto({ monto, motivo, fechayhora, totalDia: totalConNuevo }, nomcompleto);

        const { error } = await db.from('ferre_gastos').insert([{
            monto, motivo, usuario: currentUser.email,
            messageid: whatsapp?.messageId || null,
            remotejid: whatsapp?.remoteJid || null
        }]);
        if (error) throw error;

        hideModal('nuevoGastoModal');
        showToast('Gasto registrado' + (whatsapp ? ' y notificado' : ''), 'success');
        loadGastos();
    } catch (err) {
        showToast('Error: ' + err.message, 'error', 4000);
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Guardar';
    }
}

async function enviarNotificacionGasto(gasto, nomcompleto) {
    try {
        const { data: fd, error } = await db.from('ferre_ferredatos').select('*').limit(1).single();
        if (error || !fd) return null;
        const fecha = new Date(gasto.fechayhora);
        const fechaFmt = fecha.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const horaFmt  = fecha.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        const texto = `\u{1F4B8} *Nuevo Gasto Registrado*\n\n*DETALLES DEL GASTO*\n\n\u{1F4C5} *Fecha:* ${fechaFmt}\n\u{1F550} *Hora:* ${horaFmt}\n\n\u{1F4B5} *Monto:* $${parseFloat(gasto.monto).toFixed(2)}\n\n\u{1F4DD} *Motivo:*\n${gasto.motivo}\n\n\u{1F464} *Registrado por:*\n${nomcompleto}\n\n\u{1F4CA} *Total Gastos del D\u00eda:* $${parseFloat(gasto.totalDia).toFixed(2)}\n\n_Sistema de Gesti\u00f3n Ferrisoluciones_\n_Powered by Ferrisoluciones Tech_`;
        const url = `https://api.luispintasolutions.com/message/sendText/${fd.instance}`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'apikey': fd.apikey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: fd.number, text: texto, delay: 1000, linkPreview: false })
        });
        const json = await resp.json();
        if (resp.ok && json.key?.id) return { messageId: json.key.id, remoteJid: json.key.remoteJid };
        return null;
    } catch (_) { return null; }
}

function confirmarEliminarGasto(idigasto, messageid, remotejid) {
    showConfirm('\u00bfEliminar este gasto?', async () => {
        showLoader();
        try {
            if (messageid && messageid !== 'null' && remotejid && remotejid !== 'null') {
                await eliminarMensajeWhatsApp(messageid, remotejid);
            }
            const { error } = await db.from('ferre_gastos').delete().eq('idigasto', idigasto);
            if (error) throw error;
            showToast('Gasto eliminado', 'success');
            loadGastos();
        } catch (err) {
            showToast('Error: ' + err.message, 'error', 4000);
        } finally {
            hideLoader();
        }
    });
}

async function eliminarMensajeWhatsApp(messageid, remotejid) {
    try {
        const { data: fd, error } = await db.from('ferre_ferredatos').select('*').limit(1).single();
        if (error || !fd) return;
        const url = `https://api.luispintasolutions.com/chat/deleteMessageForEveryone/${fd.instance}`;
        await fetch(url, {
            method: 'DELETE',
            headers: { 'apikey': fd.apikey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: messageid, remoteJid: remotejid, fromMe: true })
        });
    } catch (_) {}
}

// ── Registro de event listeners ────────────────────────
function initGastos_eventListeners() {
    $('gastosBackBtn').addEventListener('click', () => navigateTo('pos'));
    $('gastosRefreshBtn').addEventListener('click', loadGastos);
    $('gastosDateFilter').addEventListener('change', loadGastos);
    $('nuevoGastoFab').addEventListener('click', () => {
        $('gastoMontoInput').value = '';
        $('gastoMotivoInput').value = '';
        showModal('nuevoGastoModal');
        setTimeout(() => $('gastoMontoInput').focus(), 200);
    });
    $('btnGuardarGasto').addEventListener('click', guardarGasto);
}
