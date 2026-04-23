'use strict';
// =====================================================
// Ferrisoluciones - POS Móvil - Módulo Historial
// =====================================================

let histLoading = false;

function initHistorialDate() {
    if (!$('histDateFilter').value) {
        $('histDateFilter').value = localDateStr();
    }
}

async function loadHistorial() {
    if (histLoading) return;
    histLoading = true;
    $('histSummary').classList.add('hidden');
    $('histList').innerHTML = '<div class="hist-empty"><i class="fas fa-spinner fa-spin"></i>Cargando ventas…</div>';
    try {
        const fecha = $('histDateFilter').value;
        const busq = $('histSearchInput').value.trim();
        let query = db.from('ferre_ventas')
            .select('id, id_venta, fecha_hora_venta, cliente_id, total, tipo_pago, tipo, estado')
            .order('fecha_hora_venta', { ascending: false });
        if (busq) {
            query = query.ilike('id_venta', `%${busq}%`).limit(100);
        } else if (fecha) {
            const [y, m, d] = fecha.split('-').map(Number);
            const s = new Date(y, m - 1, d, 0, 0, 0, 0);
            const e = new Date(y, m - 1, d, 23, 59, 59, 999);
            query = query.gte('fecha_hora_venta', s.toISOString()).lte('fecha_hora_venta', e.toISOString());
        } else {
            const s = new Date(); s.setHours(0, 0, 0, 0);
            const e = new Date(); e.setHours(23, 59, 59, 999);
            query = query.gte('fecha_hora_venta', s.toISOString()).lte('fecha_hora_venta', e.toISOString());
        }
        const { data, error } = await query;
        if (error) throw error;
        renderHistorial(data || []);
    } catch (err) {
        $('histList').innerHTML = `<div class="hist-empty" style="color:var(--danger);"><i class="fas fa-exclamation-triangle"></i>Error: ${escHtml(err.message)}</div>`;
    } finally {
        histLoading = false;
    }
}

function badgeClass(tipo_pago) {
    if (!tipo_pago) return 'badge-ef';
    if (tipo_pago === 'TRANSFERENCIA') return 'badge-tr';
    if (tipo_pago === 'CREDITO' || tipo_pago === 'CRÉDITO') return 'badge-cr';
    return 'badge-ef';
}

function renderHistorial(ventas) {
    if (!ventas.length) {
        $('histList').innerHTML = '<div class="hist-empty"><i class="fas fa-receipt"></i>Sin ventas para este criterio.</div>';
        $('histSummary').classList.add('hidden');
        return;
    }
    const totalSum = ventas.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
    $('histSummaryCount').textContent = `${ventas.length} venta${ventas.length !== 1 ? 's' : ''}`;
    $('histSummaryTotal').textContent = fmt(totalSum);
    $('histSummary').classList.remove('hidden');
    const list = $('histList');
    list.innerHTML = '';
    ventas.forEach(v => {
        const fecha = new Date(v.fecha_hora_venta);
        const hora = fecha.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
        const tp = v.tipo_pago || 'EFECTIVO';
        const bc = badgeClass(tp);
        const clienteLabel = v.cliente_id === '9999999999999' ? 'Consumidor Final'
            : (allClients.find(c => c.cedula === v.cliente_id)?.razon_social || v.cliente_id);
        const tipo = (v.tipo || '').toUpperCase();
        const estado = (v.estado || '').toUpperCase();
        let cardClass = 'venta-card';
        if (estado === 'DEVUELTO') {
            cardClass += ' card-devuelto';
        } else if (estado === 'CAMBIADO') {
            cardClass += ' card-cambiado';
        } else if (tipo === 'RECIBO') {
            cardClass += ' card-recibo';
        } else if (tipo === 'FACTURA') {
            cardClass += estado === 'AUTORIZADO' ? ' card-factura-aprobada' : ' card-factura-rechazada';
        }
        const div = document.createElement('div');
        div.className = cardClass;
        div.innerHTML = `
            <div class="venta-card-top">
                <span class="venta-id-text">${escHtml(v.id_venta || '')}</span>
                <span class="venta-total-text">${fmt(v.total)}</span>
            </div>
            <div class="venta-card-bot">
                <span class="venta-cliente-text">${escHtml(clienteLabel)}</span>
                <span class="venta-hora-wrap">
                    <span class="venta-hora-text">${hora}</span>
                    <span class="badge ${bc}">${escHtml(tp)}</span>
                </span>
            </div>`;
        div.addEventListener('click', () => verDetalleVenta(v.id, v));
        list.appendChild(div);
    });
}

async function verDetalleVenta(ventaId, v) {
    showModal('histDetalleModal');
    $('histDetalleBody').innerHTML = '<p style="text-align:center;padding:2rem;"><i class="fas fa-spinner fa-spin"></i></p>';
    try {
        const { data: detalles, error: de } = await db.from('ferre_ventas_detalle').select('*').eq('venta_id', ventaId);
        if (de) throw de;
        const ids = [...new Set((detalles || []).map(d => d.producto_id))];
        const prodMap = {};
        ids.forEach(id => { const p = allProducts.find(x => x.codigo === id); if (p) prodMap[id] = p.producto; });
        const missing = ids.filter(id => !prodMap[id]);
        if (missing.length) {
            const chunkSize = 10;
            for (let i = 0; i < missing.length; i += chunkSize) {
                const chunk = missing.slice(i, i + chunkSize);
                const { data: prods } = await db.from('ferre_inventario').select('codigo,producto').in('codigo', chunk);
                if (prods) prods.forEach(p => prodMap[p.codigo] = p.producto);
            }
        }
        const fecha = new Date(v.fecha_hora_venta);
        const tp = v.tipo_pago || 'EFECTIVO';
        const bc = badgeClass(tp);
        const clienteLabel = v.cliente_id === '9999999999999' ? 'CONSUMIDOR FINAL'
            : (allClients.find(c => c.cedula === v.cliente_id)?.razon_social || v.cliente_id);
        const detHtml = (detalles || []).map(d => {
            const subtotal = parseFloat(d.cantidad) * parseFloat(d.precio);
            return `<div class="detalle-prod-item">
                <span class="detalle-prod-name">${escHtml(prodMap[d.producto_id] || d.producto_id)}</span>
                <span class="detalle-prod-qty">x${d.cantidad} · ${fmt(d.precio)}</span>
                <span class="detalle-prod-sub">${fmt(subtotal)}</span>
            </div>`;
        }).join('');
        const estadoVenta = (v.estado || '').toUpperCase();
        const puedeDevolver = ['COMPLETADO', 'AUTORIZADO', 'CAMBIADO'].includes(estadoVenta);
        const btnDevolucion = puedeDevolver
            ? `<button class="btn-gestionar-dev" onclick="hideModal('histDetalleModal');abrirDevolucion('${v.id}', ${JSON.stringify(v).replace(/</g,'\\u003c')})">
                <i class="fas fa-undo-alt"></i> Gestionar Devolución / Cambio
               </button>`
            : '';
        $('histDetalleBody').innerHTML = `
            <div class="detalle-info-row"><label>Código</label><span style="font-family:monospace;">${escHtml(v.id_venta || '')}</span></div>
            <div class="detalle-info-row"><label>Fecha</label><span>${fecha.toLocaleString('es-EC')}</span></div>
            <div class="detalle-info-row"><label>Cliente</label><span>${escHtml(clienteLabel)}</span></div>
            <div class="detalle-info-row"><label>Pago</label><span><span class="badge ${bc}">${escHtml(tp)}</span></span></div>
            <div class="detalle-info-row"><label>Total</label><span style="color:var(--primary);font-size:1.05rem;">${fmt(v.total)}</span></div>
            <p class="detalle-section-title">PRODUCTOS (${(detalles || []).length})</p>
            ${detHtml || '<p style="color:var(--text-muted);font-size:.85rem;padding:.5rem 0;">Sin productos registrados</p>'}
            ${btnDevolucion}`;
    } catch (err) {
        $('histDetalleBody').innerHTML = `<p style="color:var(--danger);text-align:center;padding:1rem;">${escHtml(err.message)}</p>`;
    }
}

// ── Registro de event listeners ────────────────────────
function initHistorial_eventListeners() {
    $('histDateFilter').addEventListener('change', loadHistorial);
    $('histSearchBtn').addEventListener('click', loadHistorial);
    $('histSearchInput').addEventListener('keydown', e => { if (e.key === 'Enter') loadHistorial(); });
    $('histBackBtn').addEventListener('click', () => navigateTo('pos'));
    $('histRefreshBtn').addEventListener('click', loadHistorial);
}
