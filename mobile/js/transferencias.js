'use strict';
// =====================================================
// Ferrisoluciones - POS Móvil - Módulo Transferencias
// =====================================================

let transfLoading = false;

async function loadTransferencias() {
    if (transfLoading) return;
    transfLoading = true;
    $('transfList').innerHTML = '<div class="transf-empty"><i class="fas fa-spinner fa-spin"></i>Cargando…</div>';
    $('transfSummary').classList.add('hidden');
    $('transfPendientesSection').classList.add('hidden');

    try {
        const hoy = new Date();
        const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0, 0);
        const finHoy    = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999);

        const { data, error } = await db.from('ferre_transferencias')
            .select('*')
            .gte('fechahora', inicioHoy.toISOString())
            .lte('fechahora', finHoy.toISOString())
            .order('fechahora', { ascending: false });

        if (error) throw error;

        const items = data || [];
        renderTransferenciasHoy(items);

    } catch (err) {
        $('transfList').innerHTML = `<div class="transf-empty" style="color:var(--danger);">
            <i class="fas fa-exclamation-triangle"></i>Error: ${escHtml(err.message)}</div>`;
    } finally {
        transfLoading = false;
    }
}

function renderTransferenciasHoy(items) {
    if (!items.length) {
        $('transfList').innerHTML = '<div class="transf-empty"><i class="fas fa-exchange-alt"></i>Sin transferencias hoy.</div>';
        $('transfSummary').classList.add('hidden');
        $('transfPendientesSection').classList.add('hidden');
        return;
    }

    // Resumen global
    const totalIngreso = items.filter(t => (t.caso || '').toLowerCase() === 'ingreso')
        .reduce((s, t) => s + (parseFloat(t.monto) || 0), 0);
    const totalEgreso = items.filter(t => (t.caso || '').toLowerCase() === 'egreso')
        .reduce((s, t) => s + (parseFloat(t.monto) || 0), 0);
    const total = items.reduce((s, t) => s + (parseFloat(t.monto) || 0), 0);
    $('transfSummaryCount').textContent = `${items.length} movimiento${items.length !== 1 ? 's' : ''}`;
    $('transfSummaryIngreso').textContent = fmt(totalIngreso);
    $('transfSummaryEgreso').textContent  = fmt(totalEgreso);
    $('transfSummaryTotal').textContent   = fmt(total);
    $('transfSummary').classList.remove('hidden');
    $('transfPendientesSection').classList.add('hidden');

    // Categorizar: cambios = id_venta empieza con C, ventas = todo lo demás
    const ventas  = items.filter(t => !(t.id_venta || '').toUpperCase().startsWith('C'));
    const cambios = items.filter(t =>  (t.id_venta || '').toUpperCase().startsWith('C'));

    const list = $('transfList');
    list.innerHTML = '';

    if (ventas.length) {
        list.appendChild(buildTransfSectionHeader('💳 Ventas', 'var(--info)', ventas));
        const vPend = ventas.filter(t => !t.fotografia || t.fotografia.trim() === '');
        const vFoto = ventas.filter(t =>  t.fotografia && t.fotografia.trim() !== '');
        [...vPend, ...vFoto].forEach(t => list.appendChild(buildTransfCard(t, !t.fotografia || t.fotografia.trim() === '')));
    }

    if (cambios.length) {
        list.appendChild(buildTransfSectionHeader('🔄 Cambios de Dinero', '#9f7aea', cambios));
        const cPend = cambios.filter(t => !t.fotografia || t.fotografia.trim() === '');
        const cFoto = cambios.filter(t =>  t.fotografia && t.fotografia.trim() !== '');
        [...cPend, ...cFoto].forEach(t => list.appendChild(buildTransfCard(t, !t.fotografia || t.fotografia.trim() === '')));
    }
}

function buildTransfSectionHeader(titulo, color, items) {
    const pend = items.filter(t => !t.fotografia || t.fotografia.trim() === '').length;
    const div  = document.createElement('div');
    div.className = 'transf-section-label';
    div.style.cssText = `display:flex;justify-content:space-between;align-items:center;border-left:3px solid ${color};padding-left:8px;`;
    div.innerHTML = `<span style="color:${color};font-weight:700;">${titulo} (${items.length})</span>`
        + (pend ? `<span style="font-size:.72em;color:var(--danger);"><i class="fas fa-clock"></i> ${pend} sin comprobante</span>` : '');
    return div;
}

function buildTransfCard(t, isPendiente) {
    const fecha = new Date(t.fechahora);
    const fechaLabel = fecha.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    const tieneFoto = t.fotografia && t.fotografia.trim() !== '';
    const card = document.createElement('div');
    card.className = 'transf-card' + (isPendiente ? ' transf-card-pending' : '');
    card.innerHTML = `
        <div class="transf-card-top">
            <div class="transf-card-motivo">${escHtml(t.motivo || '')}</div>
            <div class="transf-card-monto">${fmt(t.monto)}</div>
        </div>
        <div class="transf-card-bot">
            <div class="transf-card-meta">
                <span class="transf-hora">${fechaLabel}</span>
                ${t.subido_por ? `<span class="transf-user">${escHtml(t.subido_por.split('@')[0])}</span>` : ''}
                ${t.id_venta ? `<span class="transf-venta-id">${escHtml(t.id_venta)}</span>` : ''}
            </div>
            <div class="transf-card-estado">
                ${tieneFoto
                    ? `<span class="transf-badge transf-badge-ok"><i class="fas fa-image"></i> Comprobante</span>`
                    : `<span class="transf-badge transf-badge-pending"><i class="fas fa-clock"></i> Pendiente</span>`
                }
            </div>
        </div>`;
    card.addEventListener('click', () => verDetalleTransferencia(t));
    if (isPendiente && currentUserRole === 'admin') {
        const verBtn = document.createElement('button');
        verBtn.style.cssText = 'display:block;width:100%;margin-top:8px;padding:7px 12px;background:rgba(128,90,213,.1);color:#805ad5;border:none;border-radius:8px;cursor:pointer;font-size:.78em;font-weight:600;';
        verBtn.innerHTML = '<i class="fas fa-shield-alt"></i> Verificar (Admin)';
        verBtn.addEventListener('click', e => { e.stopPropagation(); openVerificarAdmin(t); });
        card.appendChild(verBtn);
    }
    return card;
}

async function verDetalleTransferencia(t) {
    showModal('transfDetalleModal');
    const fecha = new Date(t.fechahora);
    const fechaLabel = fecha.toLocaleString('es-EC', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
    const tieneFoto = t.fotografia && t.fotografia.trim() !== '';

    // Render básico inmediato mientras cargamos el detalle de venta
    $('transfDetalleBody').innerHTML = `
        <div class="transf-detalle-wrap">
            <div class="transf-detalle-monto">${fmt(t.monto)}</div>
            <div class="transf-detalle-motivo">${escHtml(t.motivo || '')}</div>
            <div class="transf-detalle-row"><span>Fecha</span><strong>${fechaLabel}</strong></div>
            ${t.subido_por ? `<div class="transf-detalle-row"><span>Subido por</span><strong>${escHtml(t.subido_por)}</strong></div>` : ''}
            ${t.id_venta ? `<div class="transf-detalle-row"><span>Venta</span><strong style="font-family:monospace;">${escHtml(t.id_venta)}</strong></div>` : ''}
            <div class="transf-detalle-row"><span>Caso</span><strong>${escHtml(t.caso || '')}</strong></div>
            ${tieneFoto
                ? `<div class="transf-foto-wrap"><img src="${escHtml(t.fotografia)}" alt="Comprobante" class="transf-foto-img" onerror="this.style.display='none'"></div>`
                : `<div class="transf-no-foto"><i class="fas fa-image"></i><span>Sin comprobante adjunto</span></div>`
            }
            ${t.id_venta ? `<div id="transfVentaDetalle"><p style="text-align:center;padding:1rem;color:var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> Cargando venta…</p></div>` : ''}
        </div>`;

    // Si tiene id_venta, cargar los productos de la venta
    if (!t.id_venta) return;
    try {
        const { data: ventaArr, error: ve } = await db
            .from('ferre_ventas')
            .select('id, cliente_id, total, tipo_pago')
            .eq('id_venta', t.id_venta)
            .limit(1);
        if (ve) throw ve;
        if (!ventaArr || !ventaArr.length) {
            $('transfVentaDetalle').innerHTML = '<p style="color:var(--text-muted);font-size:.82rem;text-align:center;padding:.5rem 0;">Venta no encontrada en el sistema.</p>';
            return;
        }
        const venta = ventaArr[0];
        const { data: detalles, error: de } = await db
            .from('ferre_ventas_detalle')
            .select('*')
            .eq('venta_id', venta.id);
        if (de) throw de;

        // Resolver nombres de productos
        const ids = [...new Set((detalles || []).map(d => d.producto_id))];
        const prodMap = {};
        ids.forEach(id => { const p = allProducts.find(x => x.codigo === id); if (p) prodMap[id] = p.producto; });
        const missing = ids.filter(id => !prodMap[id]);
        if (missing.length) {
            for (let i = 0; i < missing.length; i += 10) {
                const chunk = missing.slice(i, i + 10);
                const { data: prods } = await db.from('ferre_inventario').select('codigo,producto').in('codigo', chunk);
                if (prods) prods.forEach(p => { prodMap[p.codigo] = p.producto; });
            }
        }

        const clienteLabel = venta.cliente_id === '9999999999999' ? 'Consumidor Final'
            : (allClients.find(c => c.cedula === venta.cliente_id)?.razon_social || venta.cliente_id);
        const detHtml = (detalles || []).map(d => {
            const subtotal = parseFloat(d.cantidad) * parseFloat(d.precio);
            return `<div class="detalle-prod-item">
                <span class="detalle-prod-name">${escHtml(prodMap[d.producto_id] || d.producto_id)}</span>
                <span class="detalle-prod-qty">x${d.cantidad} · ${fmt(d.precio)}</span>
                <span class="detalle-prod-sub">${fmt(subtotal)}</span>
            </div>`;
        }).join('');

        $('transfVentaDetalle').innerHTML = `
            <p class="detalle-section-title" style="margin-top:.9rem;">VENTA — ${escHtml(clienteLabel)}</p>
            ${detHtml || '<p style="color:var(--text-muted);font-size:.85rem;padding:.3rem 0;">Sin productos registrados.</p>'}
            <div class="transf-detalle-row" style="margin-top:.4rem;">
                <span>Total venta</span><strong style="color:var(--primary);">${fmt(venta.total)}</strong>
            </div>`;
    } catch (err) {
        if ($('transfVentaDetalle')) {
            $('transfVentaDetalle').innerHTML = `<p style="color:var(--danger);font-size:.82rem;text-align:center;padding:.5rem 0;">${escHtml(err.message)}</p>`;
        }
    }
}

function initTransferencias_eventListeners() {
    $('transfBackBtn').addEventListener('click', () => navigateTo('pos'));
    $('transfRefreshBtn').addEventListener('click', loadTransferencias);
    $('transfCambioBtn').addEventListener('click', openCambioModal);
    $('btnGuardarCambio').addEventListener('click', guardarCambio);
    $('btnCambioIngreso').addEventListener('click', function () {
        cambioSelectedCaso = 'ingreso';
        this.classList.add('active');
        $('btnCambioEgreso').classList.remove('active');
    });
    $('btnCambioEgreso').addEventListener('click', function () {
        cambioSelectedCaso = 'egreso';
        this.classList.add('active');
        $('btnCambioIngreso').classList.remove('active');
    });
    $('btnVerifPinConfirm').addEventListener('click', confirmarVerificacion);
    $('btnVerifPinCancel').addEventListener('click', () => hideModal('verificarAdminModal'));
    $('btnVerifPinClose').addEventListener('click', () => hideModal('verificarAdminModal'));
}

// ── Cambio de dinero ──────────────────────────────────
let cambioSelectedCaso = 'ingreso';

async function generarCodigoCambio() {
    const { data } = await db.from('ferre_transferencias')
        .select('id_venta')
        .like('id_venta', 'C%')
        .order('id_venta', { ascending: false })
        .limit(1);
    let num = 1;
    if (data && data.length && data[0].id_venta) {
        const parsed = parseInt(data[0].id_venta.slice(1), 10);
        if (!isNaN(parsed)) num = parsed + 1;
    }
    return 'C' + String(num).padStart(5, '0');
}

function openCambioModal() {
    cambioSelectedCaso = 'ingreso';
    $('btnCambioIngreso').classList.add('active');
    $('btnCambioEgreso').classList.remove('active');
    $('cambioSolicitanteInput').value = '';
    $('cambioRealizadorInput').value = currentUserName || '';
    $('cambioMotivoInput').value = '';
    $('cambioMontoInput').value = '';
    showModal('cambioDineroModal');
}

async function guardarCambio() {
    const solicitante = $('cambioSolicitanteInput').value.trim();
    const realizador  = $('cambioRealizadorInput').value.trim();
    const motivo      = $('cambioMotivoInput').value.trim();
    const monto       = parseFloat($('cambioMontoInput').value);

    if (!solicitante) { showToast('Ingresa el nombre del solicitante', 'error'); return; }
    if (!realizador)  { showToast('Ingresa el nombre del realizador', 'error'); return; }
    if (!motivo)      { showToast('Ingresa el motivo', 'error'); return; }
    if (!monto || monto <= 0) { showToast('Ingresa un monto válido', 'error'); return; }

    const btn = $('btnGuardarCambio');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando…';

    try {
        const codigo = await generarCodigoCambio();
        const ahora  = new Date();
        const hora   = ahora.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const fecha  = ahora.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
        const tipoLabel = cambioSelectedCaso === 'ingreso'
            ? 'Deposita a la cuenta (efectivo sale de caja, entra al banco)'
            : 'Retira de la cuenta (dinero sale del banco, entra a caja física)';
        const motivoFinal = `${tipoLabel}, solicita ${solicitante}, realiza ${realizador} a las ${hora} el ${fecha}, por motivo: ${motivo}`;

        const { error } = await db.from('ferre_transferencias').insert({
            fechahora: ahora.toISOString(),
            caso:      cambioSelectedCaso,
            monto,
            motivo:    motivoFinal,
            id_venta:  codigo,
            subido_por: realizador,
            fotografia: null,
            user_id:   currentUser?.id || null
        });
        if (error) throw error;

        // Webhook WhatsApp — no bloqueante
        const tipoEmoji  = cambioSelectedCaso === 'ingreso' ? '📤' : '📥';
        const cajaAccion = cambioSelectedCaso === 'ingreso' ? '_COJE de caja_' : '_DEJA en caja_';
        fetch('https://lpn8nwebhook.luispintasolutions.com/webhook/Mensaje_General', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mensaje: [
                    '🔔 *Notificación de Cambio de Dinero*',
                    '━━━━━━━━━━━━━━━━',
                    `🔑 *Código:* ${codigo}`,
                    `${tipoEmoji} *Operación:* ${cambioSelectedCaso === 'ingreso' ? 'Deposita a la cuenta' : 'Retira de la cuenta'}`,
                    `📌 ${cajaAccion}`,
                    `💵 *Monto:* $${monto.toFixed(2)}`,
                    `👤 *Solicita:* ${solicitante}`,
                    `👷 *Realiza:* ${realizador}`,
                    `📝 *Motivo:* ${motivo}`,
                    `🕐 *Fecha y hora:* ${hora} · ${fecha}`,
                    '',
                    `📎 Por favor verifica en el siguiente enlace: https://transferencias.ferrisoluciones.com/?v=${codigo}`,
                    '',
                    '🔴 ⚠️ *VERIFICAR ESTE MOVIMIENTO CON COMPROBANTE O NO SE PODRÁ HACER EL CIERRE DE CAJA DIARIO*'
                ]
            })
        })
        .then(r => r.json())
        .then(async data => {
            const idMessage = (data && data.length > 0 && data[0].data && data[0].data.key)
                ? data[0].data.key.id : null;
            if (idMessage) {
                await db.from('ferre_transferencias')
                    .update({ id_message: idMessage })
                    .eq('id_venta', codigo);
            }
        })
        .catch(err => console.error('Error webhook cambio', err));

        hideModal('cambioDineroModal');
        showToast(`Cambio ${codigo} registrado`, 'success');
        loadTransferencias();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Registrar';
    }
}

// ── Verificación Admin ────────────────────────────────
let verifyPinExpected = null, verifyItemTarget = null;

async function openVerificarAdmin(t) {
    verifyItemTarget = t;
    verifyPinExpected = null;
    $('verifyPinInput').value = '';
    $('verifyPinError').textContent = '';
    $('btnVerifPinConfirm').disabled = false;
    $('btnVerifPinConfirm').innerHTML = '<i class="fas fa-shield-alt"></i> Verificar';
    $('verifyPinStatus').textContent = 'Enviando código PIN…';
    $('verifyPinStatus').style.color = 'var(--text-muted)';
    showModal('verificarAdminModal');
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    try {
        await fetch('https://lpn8nwebhook.luispintasolutions.com/webhook/4948e0c5-cb6d-48c1-a7d8-04a664a07e64', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_venta: t.id_venta || '',
                monto: t.monto,
                motivo: t.motivo || '',
                subido_por: t.subido_por || '',
                pin: pin
            })
        });
        verifyPinExpected = pin;
        $('verifyPinStatus').textContent = 'PIN enviado. Ingresa el código recibido:';
        $('verifyPinStatus').style.color = 'var(--success)';
        $('verifyPinInput').focus();
    } catch (err) {
        $('verifyPinStatus').textContent = 'Error al enviar PIN: ' + err.message;
        $('verifyPinStatus').style.color = 'var(--danger)';
    }
}

async function confirmarVerificacion() {
    const enteredPin = ($('verifyPinInput').value || '').trim();
    if (!verifyPinExpected) {
        $('verifyPinError').textContent = 'Primero espera que se genere el PIN.';
        return;
    }
    if (!enteredPin) {
        $('verifyPinError').textContent = 'Ingresa el código PIN.';
        return;
    }
    if (enteredPin !== verifyPinExpected) {
        $('verifyPinError').textContent = 'Código incorrecto. Verifica el PIN recibido.';
        $('verifyPinInput').value = '';
        $('verifyPinInput').focus();
        return;
    }
    const btn = $('btnVerifPinConfirm');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    try {
        const ADMIN_FOTO = 'https://lpsupabase.luispintasolutions.com/storage/v1/object/public/utilidades/Imagenes%20de%20apoyo/Verificado%20por%20el%20admin.png';
        const { error } = await db.from('ferre_transferencias')
            .update({ fotografia: ADMIN_FOTO })
            .eq('id', verifyItemTarget.id);
        if (error) throw error;
        // Obtener id_message fresco (puede haberse guardado después del render)
        const { data: fresh } = await db.from('ferre_transferencias')
            .select('id_message')
            .eq('id', verifyItemTarget.id)
            .maybeSingle();
        const idMsgFresh = (fresh && fresh.id_message) || verifyItemTarget.id_message || '';
        // Notificación de verificación (no-blocking)
        fetch('https://lpn8nwebhook.luispintasolutions.com/webhook/a93e51ea-2752-4a11-9190-49460bb0745f', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: ADMIN_FOTO,
                caption: (verifyItemTarget.id_venta || '').startsWith('S')
                    ? 'Se ha verificado que el dinero de esta venta ha ingresado a la cuenta, muchas gracias'
                    : 'Se ha verificado correctamente este cambio de dinero, muchas gracias',
                id_message_original: idMsgFresh
            })
        }).catch(e => console.warn('Webhook verificación:', e));
        hideModal('verificarAdminModal');
        verifyPinExpected = null;
        verifyItemTarget = null;
        showToast('Movimiento verificado correctamente', 'success');
        loadTransferencias();
    } catch (err) {
        $('verifyPinError').textContent = 'Error: ' + err.message;
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-shield-alt"></i> Verificar';
    }
}

// ── Alerta transferencias/cambios pendientes ──────────
let _transfAlertInterval = null;

async function checkTransfPendientes() {
    try {
        const hoy = new Date();
        const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0, 0).toISOString();
        const fin    = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999).toISOString();
        const { data } = await db.from('ferre_transferencias')
            .select('id, id_venta, monto, motivo, caso')
            .gte('fechahora', inicio)
            .lte('fechahora', fin)
            .or('fotografia.is.null,fotografia.eq.');
        const pendientes = (data || []).filter(t => !t.fotografia || t.fotografia.trim() === '');
        if (!pendientes.length) return;

        // Cargar ventas + detalles + productos para las S-
        const ventasIds = pendientes.filter(t => (t.id_venta||'').startsWith('S')).map(t => t.id_venta);
        const ventaMap = {};
        const detalleMap = {}; // id_venta -> [{nombre, cantidad, precio}]
        if (ventasIds.length) {
            const [{ data: ventas }, { data: detalles }] = await Promise.all([
                db.from('ferre_ventas').select('id_venta, total, cliente_id, id').in('id_venta', ventasIds),
                db.from('ferre_ventas_detalle').select('id_venta, producto_id, cantidad, precio').in('id_venta', ventasIds)
            ]);
            (ventas || []).forEach(v => { ventaMap[v.id_venta] = v; });
            // Resolver nombres de productos
            const allIds = [...new Set((detalles || []).map(d => d.producto_id))];
            const prodMap = {};
            allProducts.forEach(p => { if (allIds.includes(p.codigo)) prodMap[p.codigo] = p.producto; });
            const missing = allIds.filter(id => !prodMap[id]);
            if (missing.length) {
                for (let i = 0; i < missing.length; i += 10) {
                    const { data: prods } = await db.from('ferre_inventario').select('codigo,producto').in('codigo', missing.slice(i, i+10));
                    (prods || []).forEach(p => { prodMap[p.codigo] = p.producto; });
                }
            }
            (detalles || []).forEach(d => {
                if (!detalleMap[d.id_venta]) detalleMap[d.id_venta] = [];
                detalleMap[d.id_venta].push({
                    nombre: prodMap[d.producto_id] || d.producto_id,
                    cantidad: d.cantidad,
                    precio: d.precio
                });
            });
        }

        let html = '';
        pendientes.forEach(t => {
            const esVenta = (t.id_venta || '').startsWith('S');
            if (esVenta) {
                const v = ventaMap[t.id_venta];
                const clienteLabel = v ? (v.cliente_id === '9999999999999' ? 'Consumidor Final' : v.cliente_id) : '';
                const totalLabel   = v ? fmt(v.total) : fmt(t.monto);
                const items = detalleMap[t.id_venta] || [];
                const prodsHtml = items.map(d =>
                    `<div style="display:flex;justify-content:space-between;font-size:.78rem;color:#555;padding:2px 0;border-bottom:1px solid #fed7d7;">
                        <span style="flex:1;">${escHtml(d.nombre)}</span>
                        <span style="white-space:nowrap;margin-left:8px;">x${d.cantidad} &middot; ${fmt(d.precio)}</span>
                    </div>`
                ).join('');
                html += `<div style="border:1px solid rgba(229,62,62,.3);border-radius:12px;padding:14px 16px;margin-bottom:10px;background:#fff5f5;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                        <i class="fas fa-university" style="color:#e53e3e;"></i>
                        <span style="font-weight:700;font-size:.9rem;color:#c53030;">Venta con Transferencia</span>
                        <span style="margin-left:auto;font-family:monospace;font-size:.78rem;color:#3182ce;">${escHtml(t.id_venta)}</span>
                    </div>
                    ${clienteLabel ? `<div style="font-size:.82rem;color:#555;margin-bottom:6px;"><i class="fas fa-user" style="width:14px;"></i> ${escHtml(clienteLabel)}</div>` : ''}
                    ${prodsHtml ? `<div style="margin:6px 0 8px;">${prodsHtml}</div>` : ''}
                    <div style="font-size:.9rem;font-weight:700;color:#e53e3e;text-align:right;margin-top:4px;">Total: ${totalLabel}</div>
                </div>`;
            } else {
                html += `<div style="border:1px solid rgba(229,62,62,.3);border-radius:12px;padding:14px 16px;margin-bottom:10px;background:#fff5f5;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                        <i class="fas fa-exchange-alt" style="color:#9f7aea;"></i>
                        <span style="font-weight:700;font-size:.9rem;color:#553c9a;">Cambio de Dinero</span>
                        <span style="margin-left:auto;font-family:monospace;font-size:.78rem;color:#9f7aea;">${escHtml(t.id_venta||'')}</span>
                    </div>
                    <div style="font-size:.82rem;color:#555;">${escHtml(t.motivo||'')}</div>
                    <div style="font-size:.88rem;font-weight:700;color:#9f7aea;margin-top:4px;">${fmt(t.monto)}</div>
                </div>`;
            }
        });

        $('transfAlertBody').innerHTML = html;
        $('transfAlertOverlay').style.display = 'flex';
    } catch (e) {
        console.warn('checkTransfPendientes error:', e);
    }
}

function startTransfAlertPolling() {
    checkTransfPendientes();
    if (_transfAlertInterval) clearInterval(_transfAlertInterval);
    _transfAlertInterval = setInterval(checkTransfPendientes, 2 * 60 * 1000);
    $('transfAlertAceptar').addEventListener('click', () => {
        $('transfAlertOverlay').style.display = 'none';
    });
}
