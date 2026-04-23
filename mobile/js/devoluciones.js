'use strict';
// =====================================================
// Ferrisoluciones - POS Móvil - Módulo Devoluciones y Cambios
// =====================================================

let devLoading = false;
let devHistLoading = false;
let devActiveTab = 'historial';
let devCurrentVenta = null;
let devCurrentDetalles = [];
let devSelecciones = {};
let devCambioItems = [];
let devStep = 1;
let devMotivo = '';
let devTipoPago = 'EFECTIVO';

// ── Tab switching ──────────────────────────────────────

function devSwitchTab(tab) {
    devActiveTab = tab;
    $('devTabHistBtn').classList.toggle('active', tab === 'historial');
    $('devTabNuevaBtn').classList.toggle('active', tab === 'nueva');
    $('devHistorialPane').style.display = tab === 'historial' ? 'flex' : 'none';
    $('devNuevaPane').style.display     = tab === 'nueva'     ? 'flex' : 'none';
    if (tab === 'historial') loadDevHistorial();
}

// ── Historial de devoluciones ──────────────────────────

async function loadDevHistorial() {
    if (devHistLoading) return;
    devHistLoading = true;
    $('devHistList').innerHTML = '<div class="hist-empty"><i class="fas fa-spinner fa-spin"></i>Cargando historial…</div>';
    try {
        const desde = $('devHistDesde').value;
        const hasta = $('devHistHasta').value;
        let query = db.from('ferre_devoluciones')
            .select('id, id_devolucion, tipo, motivo, total_devuelto, total_cobrado, diferencia, tipo_pago_diferencia, estado, usuario_email, created_at, id_venta, venta_id')
            .order('created_at', { ascending: false });
        if (desde) {
            const [y, m, d] = desde.split('-').map(Number);
            query = query.gte('created_at', new Date(y, m - 1, d, 0, 0, 0, 0).toISOString());
        }
        if (hasta) {
            const [y, m, d] = hasta.split('-').map(Number);
            query = query.lte('created_at', new Date(y, m - 1, d, 23, 59, 59, 999).toISOString());
        }
        const { data, error } = await query.limit(200);
        if (error) throw error;
        const registros = data || [];
        if (registros.length > 0) {
            const ventaIds = [...new Set(registros.map(r => r.venta_id).filter(Boolean))];
            const { data: ventas } = await db.from('ferre_ventas').select('id, cliente_id').in('id', ventaIds);
            const ventaMap = {};
            (ventas || []).forEach(v => { ventaMap[v.id] = v; });
            renderDevHistorial(registros, ventaMap);
        } else {
            renderDevHistorial([], {});
        }
    } catch (err) {
        $('devHistList').innerHTML = `<div class="hist-empty" style="color:var(--danger);"><i class="fas fa-exclamation-triangle"></i>Error: ${escHtml(err.message)}</div>`;
    } finally {
        devHistLoading = false;
    }
}

function renderDevHistorial(registros, ventaMap) {
    if (!registros.length) {
        $('devHistList').innerHTML = '<div class="hist-empty"><i class="fas fa-list-alt"></i>Sin registros para este período</div>';
        return;
    }
    const list = $('devHistList');
    list.innerHTML = '';
    registros.forEach(r => {
        const fecha = new Date(r.created_at);
        const fechaStr = fecha.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const horaStr  = fecha.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
        const tipo = r.tipo || 'DEVOLUCION';
        const tipoCls  = tipo === 'CAMBIO' ? 'badge-cambiado' : 'badge-devuelto';
        const tipoIcon = tipo === 'CAMBIO' ? 'exchange-alt' : 'undo-alt';
        const venta = ventaMap[r.venta_id];
        const cid   = venta?.cliente_id;
        const clienteLabel = !cid ? r.id_venta
            : cid === '9999999999999' ? 'Consumidor Final'
            : (allClients.find(c => c.cedula === cid)?.razon_social || r.id_venta);
        const difAbs = Math.abs(r.diferencia || 0);
        const difHtml = difAbs >= 0.01
            ? `<div class="dev-hist-diferencia ${r.diferencia > 0 ? 'cobra' : 'da'}"><i class="fas fa-${r.diferencia > 0 ? 'arrow-up' : 'arrow-down'}"></i>${r.diferencia > 0 ? 'Pagó diferencia' : 'Vuelto dado'}: ${fmt(difAbs)}</div>`
            : '';
        const motiHtml = r.motivo
            ? `<div class="dev-hist-motivo"><i class="fas fa-comment"></i>${escHtml(r.motivo)}</div>` : '';
        const div = document.createElement('div');
        div.className = `dev-hist-card dev-hist-card-${tipo.toLowerCase()}`;
        div.innerHTML = `
            <div class="dev-hist-card-top">
                <span class="badge-dev-estado ${tipoCls}"><i class="fas fa-${tipoIcon}"></i> ${tipo}</span>
                <span class="dev-hist-fecha">${fechaStr} ${horaStr}</span>
            </div>
            <div class="dev-hist-card-mid">
                <span class="dev-hist-id">${escHtml(r.id_devolucion)}</span>
                <span class="dev-hist-total">${fmt(r.total_devuelto)}</span>
            </div>
            <div class="dev-hist-card-sub">
                <span class="dev-hist-cliente">${escHtml(clienteLabel)}</span>
                <span class="dev-hist-venta">${escHtml(r.id_venta)}</span>
            </div>
            ${difHtml}${motiHtml}
            <button class="dev-hist-detalle-btn" onclick="verDetalleHistDevolucion('${r.id}')">
                <i class="fas fa-eye"></i> Ver detalle
            </button>`;
        list.appendChild(div);
    });
}

async function verDetalleHistDevolucion(devolucionId) {
    showModal('devGestionModal');
    $('devGestionBody').innerHTML = '<p style="text-align:center;padding:2rem;"><i class="fas fa-spinner fa-spin"></i></p>';
    $('devGestionFooter').innerHTML = '<button class="btn-cancel" onclick="hideModal(\'devGestionModal\')">Cerrar</button>';
    try {
        const [devRes, camRes, cabRes] = await Promise.all([
            db.from('ferre_historial_devoluciones_detalle').select('*').eq('devolucion_id', devolucionId),
            db.from('ferre_cambios_detalle').select('*').eq('devolucion_id', devolucionId),
            db.from('ferre_devoluciones').select('*').eq('id', devolucionId).single()
        ]);
        const devRows = devRes.data || [];
        const camRows = camRes.data || [];
        const cab     = cabRes.data;
        const tipo = cab?.tipo || 'DEVOLUCION';
        // Enriquecer nombres de productos
        const allIds = [...new Set([...devRows.map(r => r.producto_id), ...camRows.map(r => r.producto_id)])];
        const prodMap = {};
        allIds.forEach(id => { const p = allProducts.find(x => x.codigo === id); if (p) prodMap[id] = p.producto; });
        const missing = allIds.filter(id => !prodMap[id]);
        if (missing.length) {
            const { data: prods } = await db.from('ferre_inventario').select('codigo,producto').in('codigo', missing);
            (prods || []).forEach(p => { prodMap[p.codigo] = p.producto; });
        }
        const devHtml = devRows.map(r => `
            <div class="dev-resumen-row">
                <span>${escHtml(prodMap[r.producto_id] || r.producto_id)}</span>
                <span style="white-space:nowrap;">x${r.cantidad_devuelta} · <strong>${fmt(r.subtotal_devuelto || r.cantidad_devuelta * r.precio_unitario || 0)}</strong></span>
            </div>`).join('');
        const camHtml = camRows.map(r => `
            <div class="dev-resumen-row">
                <span>${escHtml(prodMap[r.producto_id] || r.producto_id)}</span>
                <span style="white-space:nowrap;">x${r.cantidad} · <strong>${fmt(r.subtotal || r.cantidad * r.precio || 0)}</strong></span>
            </div>`).join('');
        const fechaFmt = cab ? new Date(cab.created_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
        $('devGestionBody').innerHTML = `
            <div class="dev-tipo-badge dev-tipo-badge-${tipo.toLowerCase()}" style="margin-bottom:.5rem;">
                <i class="fas fa-${tipo === 'CAMBIO' ? 'exchange-alt' : 'undo-alt'}"></i> ${tipo}
            </div>
            <div class="dev-venta-info" style="margin-bottom:.8rem;">
                <span class="dev-venta-id">${escHtml(cab?.id_devolucion || '')}</span>
                <span class="dev-venta-sep">·</span>
                <span class="dev-venta-id">${escHtml(cab?.id_venta || '')}</span>
            </div>
            <p class="detalle-section-title">ÍTEMs DEVUELTOS</p>
            ${devHtml || '<p style="color:var(--text-muted);font-size:.82rem;text-align:center;">Sin detalle</p>'}
            ${camHtml ? `<p class="detalle-section-title" style="margin-top:.7rem;">ÍTEMs ENTREGADOS AL CLIENTE</p>${camHtml}` : ''}
            <div class="dev-resumen-totales" style="margin-top:.6rem;">
                <div class="dev-resumen-total-row">
                    <span>Total devuelto:</span>
                    <strong style="color:var(--success);">${fmt(cab?.total_devuelto || 0)}</strong>
                </div>
                ${tipo === 'CAMBIO' ? `<div class="dev-resumen-total-row">
                    <span>Total entregado:</span>
                    <strong style="color:var(--danger);">${fmt(cab?.total_cobrado || 0)}</strong>
                </div>` : ''}
            </div>
            ${Math.abs(cab?.diferencia || 0) >= 0.01 ? `<div class="dev-diferencia-box ${(cab.diferencia || 0) > 0 ? 'dev-diferencia-cobrar' : 'dev-diferencia-dar'}">
                <i class="fas fa-${(cab.diferencia || 0) > 0 ? 'arrow-circle-up' : 'arrow-circle-down'}"></i>
                <span>${(cab.diferencia || 0) > 0 ? 'Cliente pagó diferencia' : 'Se entregó vuelto'}: <strong>${fmt(Math.abs(cab.diferencia))}</strong></span>
            </div>` : ''}
            ${cab?.motivo ? `<div style="font-size:.8rem;color:var(--text-muted);margin-top:.6rem;padding:.5rem .7rem;background:var(--bg3);border-radius:6px;"><i class="fas fa-comment" style="margin-right:5px;"></i>${escHtml(cab.motivo)}</div>` : ''}
            <div style="font-size:.75rem;color:var(--text-muted);margin-top:.6rem;text-align:right;">
                ${escHtml(cab?.usuario_email || '')} · ${fechaFmt}
            </div>`;
    } catch (err) {
        $('devGestionBody').innerHTML = `<p style="color:var(--danger);padding:1rem;font-size:.85rem;">${escHtml(err.message)}</p>`;
    }
}

// ── Lista de ventas (pestaña Nueva) ────────────────────

function initDevolucionesDate() {
    // Pestaña historial: última semana por defecto
    if (!$('devHistDesde').value) {
        const hace6 = new Date();
        hace6.setDate(hace6.getDate() - 6);
        $('devHistDesde').value = localDateStr(hace6);
    }
    if (!$('devHistHasta').value) {
        $('devHistHasta').value = localDateStr();
    }
    // Pestaña nueva devolución: hoy
    if (!$('devDateFilter').value) {
        $('devDateFilter').value = localDateStr();
    }
}

async function loadDevoluciones() {
    if (devLoading) return;
    devLoading = true;
    $('devList').innerHTML = '<div class="hist-empty"><i class="fas fa-spinner fa-spin"></i>Cargando ventas…</div>';
    try {
        const fecha = $('devDateFilter').value;
        const busq = $('devSearchInput').value.trim();
        let query = db.from('ferre_ventas')
            .select('id, id_venta, fecha_hora_venta, cliente_id, total, tipo_pago, tipo, estado')
            .in('estado', ['COMPLETADO', 'AUTORIZADO', 'CAMBIADO'])
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
        renderDevolucionesList(data || []);
    } catch (err) {
        $('devList').innerHTML = `<div class="hist-empty" style="color:var(--danger);"><i class="fas fa-exclamation-triangle"></i>Error: ${escHtml(err.message)}</div>`;
    } finally {
        devLoading = false;
    }
}

function renderDevolucionesList(ventas) {
    if (!ventas.length) {
        $('devList').innerHTML = '<div class="hist-empty"><i class="fas fa-undo-alt"></i>Sin ventas para este criterio.</div>';
        return;
    }
    const list = $('devList');
    list.innerHTML = '';
    ventas.forEach(v => {
        const fecha = new Date(v.fecha_hora_venta);
        const hora = fecha.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
        const tp = v.tipo_pago || 'EFECTIVO';
        const bc = badgeClass(tp);
        const clienteLabel = v.cliente_id === '9999999999999' ? 'Consumidor Final'
            : (allClients.find(c => c.cedula === v.cliente_id)?.razon_social || v.cliente_id);
        const estado = (v.estado || '').toUpperCase();
        const estadoBadge = estado === 'CAMBIADO'
            ? `<span class="badge-dev-estado badge-cambiado">CAMBIADO</span>`
            : '';
        const div = document.createElement('div');
        div.className = 'venta-card';
        div.innerHTML = `
            <div class="venta-card-top">
                <span class="venta-id-text">${escHtml(v.id_venta || '')}</span>
                <span class="venta-total-text">${fmt(v.total)}</span>
            </div>
            <div class="venta-card-bot">
                <span class="venta-cliente-text">${escHtml(clienteLabel)}</span>
                <span class="venta-hora-wrap">
                    ${estadoBadge}
                    <span class="venta-hora-text">${hora}</span>
                    <span class="badge ${bc}">${escHtml(tp)}</span>
                </span>
            </div>`;
        div.addEventListener('click', () => abrirDevolucion(v.id, v));
        list.appendChild(div);
    });
}

// ── Modal gestión ──────────────────────────────────────

async function abrirDevolucion(ventaId, v) {
    devCurrentVenta = v;
    devCurrentDetalles = [];
    devSelecciones = {};
    devCambioItems = [];
    devStep = 1;
    devMotivo = '';
    devTipoPago = 'EFECTIVO';

    showModal('devGestionModal');
    $('devGestionBody').innerHTML = '<p style="text-align:center;padding:2rem;"><i class="fas fa-spinner fa-spin"></i></p>';
    $('devGestionFooter').innerHTML = '';

    try {
        const { data: detalles, error: de } = await db.from('ferre_ventas_detalle')
            .select('*')
            .eq('venta_id', ventaId)
            .in('estado', ['ACTIVO', 'PARCIAL']);
        if (de) throw de;

        if (!detalles || detalles.length === 0) {
            $('devGestionBody').innerHTML = '<p style="text-align:center;padding:1.5rem;color:var(--text-muted);font-size:.9rem;">Esta venta no tiene ítems disponibles para devolver.</p>';
            return;
        }

        // Enriquecer nombres de productos
        const ids = [...new Set(detalles.map(d => d.producto_id))];
        const prodMap = {};
        ids.forEach(id => { const p = allProducts.find(x => x.codigo === id); if (p) prodMap[id] = p; });
        const missing = ids.filter(id => !prodMap[id]);
        if (missing.length) {
            for (let i = 0; i < missing.length; i += 10) {
                const chunk = missing.slice(i, i + 10);
                const { data: prods } = await db.from('ferre_inventario').select('codigo,producto').in('codigo', chunk);
                if (prods) prods.forEach(p => { prodMap[p.codigo] = { ...prodMap[p.codigo], producto: p.producto }; });
            }
        }

        // Calcular cuánto ya fue devuelto por línea (devoluciones parciales previas)
        const detalleIds = detalles.map(d => d.id);
        const { data: prevDev } = await db.from('ferre_historial_devoluciones_detalle')
            .select('detalle_id, cantidad_devuelta')
            .in('detalle_id', detalleIds);
        const yaDevuelto = {};
        (prevDev || []).forEach(r => {
            yaDevuelto[r.detalle_id] = (yaDevuelto[r.detalle_id] || 0) + parseFloat(r.cantidad_devuelta);
        });

        devCurrentDetalles = detalles
            .map(d => ({
                ...d,
                nombre: prodMap[d.producto_id]?.producto || d.producto_id,
                cantidad_max: Math.round((parseFloat(d.cantidad) - (yaDevuelto[d.id] || 0)) * 1000) / 1000
            }))
            .filter(d => d.cantidad_max > 0);

        if (devCurrentDetalles.length === 0) {
            $('devGestionBody').innerHTML = '<p style="text-align:center;padding:1.5rem;color:var(--text-muted);font-size:.9rem;">Todos los ítems de esta venta ya fueron devueltos.</p>';
            return;
        }

        renderDevStep1();
    } catch (err) {
        $('devGestionBody').innerHTML = `<p style="color:var(--danger);text-align:center;padding:1rem;font-size:.88rem;">${escHtml(err.message)}</p>`;
    }
}

// ── Step 1: Seleccionar cantidades a devolver ──────────

function renderDevStep1() {
    devStep = 1;
    const v = devCurrentVenta;
    const fecha = new Date(v.fecha_hora_venta);
    const clienteLabel = v.cliente_id === '9999999999999' ? 'CONSUMIDOR FINAL'
        : (allClients.find(c => c.cedula === v.cliente_id)?.razon_social || v.cliente_id);

    // Inicializar selecciones si no existen
    devCurrentDetalles.forEach(d => {
        if (!devSelecciones[d.id]) {
            devSelecciones[d.id] = {
                cantidad: 0,
                precio: parseFloat(d.precio),
                producto_id: d.producto_id,
                nombre: d.nombre,
                cantidad_max: d.cantidad_max,
                detalle_id: d.id,
                id_detalle: d.id_detalle
            };
        }
    });

    const itemsHtml = devCurrentDetalles.map(d => {
        const sel = devSelecciones[d.id];
        const esParcial = d.estado === 'PARCIAL';
        return `
        <div class="dev-item-row">
            <div class="dev-item-top">
                <div class="dev-item-name">${escHtml(d.nombre)}</div>
                <div class="dev-item-precio">${fmt(d.precio)}</div>
            </div>
            <div class="dev-item-bot">
                <span class="dev-item-info">
                    Vendido: ${parseFloat(d.cantidad)}
                    ${esParcial ? '<span class="dev-parcial-badge">PARCIAL</span>' : ''}
                    · Disp: <strong>${d.cantidad_max}</strong>
                </span>
                <div class="dev-qty-control">
                    <button class="dev-qty-btn" onclick="devAjustarCantidad('${escHtml(d.id)}', -1)">−</button>
                    <input type="number" class="dev-qty-input" id="devQty_${escHtml(d.id)}"
                        value="${sel.cantidad}" min="0" max="${d.cantidad_max}" step="0.001"
                        inputmode="decimal"
                        onchange="devSetCantidad('${escHtml(d.id)}', this.value)">
                    <button class="dev-qty-btn dev-qty-btn-plus" onclick="devAjustarCantidad('${escHtml(d.id)}', 1)">+</button>
                    <button class="dev-qty-btn dev-qty-btn-all" onclick="devSetCantidad('${escHtml(d.id)}', ${d.cantidad_max})">MAX</button>
                </div>
            </div>
        </div>`;
    }).join('');

    $('devGestionBody').innerHTML = `
        <div class="dev-venta-info">
            <span class="dev-venta-id">${escHtml(v.id_venta)}</span>
            <span class="dev-venta-sep">·</span>
            <span class="dev-venta-fecha">${fecha.toLocaleDateString('es-EC')}</span>
            <span class="dev-venta-sep">·</span>
            <span class="dev-venta-cliente">${escHtml(clienteLabel)}</span>
        </div>
        <p class="detalle-section-title" style="margin-top:.8rem;">SELECCIONA CANTIDADES A DEVOLVER</p>
        <div id="devItemsList">${itemsHtml}</div>
        <div style="margin-top:.8rem;">
            <label class="label-form">Motivo (opcional)</label>
            <input type="text" id="devMotivoInput" placeholder="Ej: Producto defectuoso, error en pedido…"
                value="${escHtml(devMotivo)}" autocomplete="off" style="margin-bottom:0;">
        </div>
        <div id="devStep1TotalesWrap" class="dev-totales-bar hidden" style="margin-top:.6rem;"></div>`;

    $('devGestionFooter').innerHTML = `
        <button class="btn-cancel" onclick="hideModal('devGestionModal')">Cancelar</button>
        <button class="btn-confirm" onclick="devPasarAStep2()"><i class="fas fa-arrow-right"></i> Continuar</button>`;

    setTimeout(() => {
        const inp = $('devMotivoInput');
        if (inp) inp.addEventListener('input', () => { devMotivo = inp.value; });
    }, 0);

    updateDevStep1Totales();
}

function devAjustarCantidad(id, delta) {
    const sel = devSelecciones[id];
    if (!sel) return;
    const nueva = Math.min(sel.cantidad_max, Math.max(0, (sel.cantidad || 0) + delta));
    devSetCantidad(id, nueva);
}

function devSetCantidad(id, val) {
    const sel = devSelecciones[id];
    if (!sel) return;
    let n = parseFloat(val) || 0;
    n = Math.round(Math.min(sel.cantidad_max, Math.max(0, n)) * 1000) / 1000;
    sel.cantidad = n;
    const inp = $(`devQty_${id}`);
    if (inp) inp.value = n;
    updateDevStep1Totales();
}

function updateDevStep1Totales() {
    const selArr = Object.values(devSelecciones).filter(x => x.cantidad > 0);
    const totalDevuelto = selArr.reduce((s, x) => s + x.cantidad * x.precio, 0);
    const wrap = $('devStep1TotalesWrap');
    if (!wrap) return;
    if (selArr.length > 0) {
        wrap.classList.remove('hidden');
        wrap.innerHTML = `<strong>${selArr.length} ítem${selArr.length > 1 ? 's' : ''}</strong> seleccionado${selArr.length > 1 ? 's' : ''} · a devolver: <span style="color:var(--primary);font-weight:700;">${fmt(totalDevuelto)}</span>`;
    } else {
        wrap.classList.add('hidden');
    }
}

// ── Pregunta tipo si selección es total ───────────────

function devPasarAStep2() {
    devMotivo = $('devMotivoInput')?.value || '';
    const seleccionados = Object.values(devSelecciones).filter(x => x.cantidad > 0);
    if (seleccionados.length === 0) {
        showToast('Selecciona al menos un ítem a devolver', 'warning');
        return;
    }
    // Es devolución total si todas las líneas están en su cantidad_max
    const esTotalCompleto = devCurrentDetalles.every(d => devSelecciones[d.id]?.cantidad === d.cantidad_max);
    if (esTotalCompleto && devCambioItems.length === 0) {
        renderDevPreguntaTipo();
    } else {
        renderDevStep2();
    }
}

function renderDevPreguntaTipo() {
    $('devGestionBody').innerHTML = `
        <div style="text-align:center;padding:.5rem 0 1.2rem;">
            <i class="fas fa-question-circle" style="font-size:2.5rem;color:#e67e22;margin-bottom:.8rem;display:block;"></i>
            <p style="font-size:.95rem;color:var(--text);margin-bottom:0;">Seleccionaste todos los ítems.<br>¿Qué deseas hacer?</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:1rem;">
            <button class="dev-tipo-btn dev-tipo-devolucion" onclick="renderDevStep3()">
                <i class="fas fa-undo-alt"></i>
                <div>
                    <strong>Devolución Total</strong>
                    <small>Cliente devuelve todo y recibe reembolso</small>
                </div>
            </button>
            <button class="dev-tipo-btn dev-tipo-cambio" onclick="renderDevStep2()">
                <i class="fas fa-exchange-alt"></i>
                <div>
                    <strong>Cambio</strong>
                    <small>Cliente quiere llevar otros productos</small>
                </div>
            </button>
        </div>`;
    $('devGestionFooter').innerHTML = `
        <button class="btn-cancel" onclick="renderDevStep1()"><i class="fas fa-arrow-left"></i> Volver</button>`;
}

// ── Step 2: Productos de cambio ────────────────────────

function renderDevStep2() {
    devStep = 2;
    const totalDevuelto = Object.values(devSelecciones).reduce((s, x) => s + x.cantidad * x.precio, 0);
    const totalCambio = devCambioItems.reduce((s, x) => s + x.quantity * x.price, 0);

    const cambioListHtml = devCambioItems.length
        ? devCambioItems.map((item, idx) => `
            <div class="dev-cambio-item">
                <div class="dev-cambio-item-name">${escHtml(item.name)}</div>
                <div class="dev-cambio-item-right">
                    <span class="dev-cambio-item-qty">x${item.quantity} · ${fmt(item.price)}</span>
                    <button class="dev-cambio-del-btn" onclick="devEliminarCambioItem(${idx})"><i class="fas fa-times"></i></button>
                </div>
            </div>`).join('')
        : '<p style="text-align:center;font-size:.8rem;color:var(--text-muted);padding:.7rem 0;">Sin productos agregados aún</p>';

    $('devGestionBody').innerHTML = `
        <p class="detalle-section-title">PRODUCTOS A ENTREGAR AL CLIENTE</p>
        <div class="dev-search-bar">
            <input type="text" id="devCambioSearch" placeholder="Buscar producto para cambio…"
                autocomplete="off" autocapitalize="none" spellcheck="false">
        </div>
        <div id="devCambioSearchResults" class="dev-search-results"></div>
        <p class="detalle-section-title" style="margin-top:.7rem;">ÍTEMS SELECCIONADOS</p>
        <div id="devCambioList">${cambioListHtml}</div>
        <div class="dev-totales-bar" style="margin-top:.6rem;">
            <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:3px;">
                <span style="color:var(--text-muted);">Total a devolver al cliente:</span>
                <span style="color:var(--success);font-weight:700;">−${fmt(totalDevuelto)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:.82rem;">
                <span style="color:var(--text-muted);">Total entregado al cliente:</span>
                <span id="devCambioTotalDisplay" style="color:var(--danger);font-weight:700;">+${fmt(totalCambio)}</span>
            </div>
        </div>`;

    $('devGestionFooter').innerHTML = `
        <button class="btn-cancel" onclick="renderDevStep1()"><i class="fas fa-arrow-left"></i> Volver</button>
        <button class="btn-confirm" onclick="renderDevStep3()"><i class="fas fa-arrow-right"></i> Continuar</button>`;

    setTimeout(() => {
        const inp = $('devCambioSearch');
        if (inp) inp.addEventListener('input', () => filterDevCambioSearch(inp.value.trim()));
    }, 0);
}

function filterDevCambioSearch(query) {
    const res = $('devCambioSearchResults');
    if (!query) { res.innerHTML = ''; return; }
    const q = query.toLowerCase();
    const matches = allProducts
        .filter(p => (p.producto.toLowerCase().includes(q) || p.codigo.startsWith(query)) && p.stock > 0)
        .slice(0, 8);
    if (!matches.length) {
        res.innerHTML = '<div class="dev-search-empty">Sin resultados con stock disponible</div>';
        return;
    }
    res.innerHTML = matches.map(p => `
        <div class="dev-search-result-item" onclick="devAgregarCambioItem('${escHtml(p.codigo)}')">
            <div>
                <div class="dev-search-result-name">${escHtml(p.producto)}</div>
                <div class="dev-search-result-sub">Cód: ${escHtml(p.codigo)} · Stock: ${p.stock}</div>
            </div>
            <span class="dev-search-result-price">${fmt(p.precio)}</span>
        </div>`).join('');
}

function devAgregarCambioItem(codigo) {
    const prod = allProducts.find(p => p.codigo === codigo);
    if (!prod) return;
    const existing = devCambioItems.find(x => x.code === codigo);
    const stockDisponible = prod.stock - (existing ? existing.quantity : 0);
    if (stockDisponible <= 0) {
        showToast('Stock insuficiente para ese producto', 'warning');
        return;
    }
    if (existing) {
        existing.quantity = Math.min(prod.stock, existing.quantity + 1);
    } else {
        devCambioItems.push({ code: codigo, name: prod.producto, price: prod.precio, quantity: 1 });
    }
    const totalCambio = devCambioItems.reduce((s, x) => s + x.quantity * x.price, 0);
    const cambioListHtml = devCambioItems.map((item, idx) => `
        <div class="dev-cambio-item">
            <div class="dev-cambio-item-name">${escHtml(item.name)}</div>
            <div class="dev-cambio-item-right">
                <span class="dev-cambio-item-qty">x${item.quantity} · ${fmt(item.price)}</span>
                <button class="dev-cambio-del-btn" onclick="devEliminarCambioItem(${idx})"><i class="fas fa-times"></i></button>
            </div>
        </div>`).join('');
    $('devCambioList').innerHTML = cambioListHtml;
    const td = $('devCambioTotalDisplay');
    if (td) td.textContent = `+${fmt(totalCambio)}`;
    $('devCambioSearch').value = '';
    $('devCambioSearchResults').innerHTML = '';
    showToast(`${prod.producto} agregado`, 'success');
}

function devEliminarCambioItem(idx) {
    devCambioItems.splice(idx, 1);
    renderDevStep2();
}

// ── Step 3: Resumen y confirmación ────────────────────

function renderDevStep3() {
    devStep = 3;
    const seleccionados = Object.values(devSelecciones).filter(x => x.cantidad > 0);
    const totalDevuelto = Math.round(seleccionados.reduce((s, x) => s + x.cantidad * x.precio, 0) * 100) / 100;
    const totalCambio = Math.round(devCambioItems.reduce((s, x) => s + x.quantity * x.price, 0) * 100) / 100;
    const diferencia = Math.round((totalCambio - totalDevuelto) * 100) / 100;
    const tipo = devCambioItems.length > 0 ? 'CAMBIO' : 'DEVOLUCION';

    const itemsDevHtml = seleccionados.map(x => `
        <div class="dev-resumen-row">
            <span>${escHtml(x.nombre)}</span>
            <span style="white-space:nowrap;">x${x.cantidad} · <strong>${fmt(x.cantidad * x.precio)}</strong></span>
        </div>`).join('');

    const itemsCambioHtml = devCambioItems.map(x => `
        <div class="dev-resumen-row">
            <span>${escHtml(x.name)}</span>
            <span style="white-space:nowrap;">x${x.quantity} · <strong>${fmt(x.quantity * x.price)}</strong></span>
        </div>`).join('');

    let diferenciaHtml = '';
    let tipoPagoHtml = '';
    if (Math.abs(diferencia) >= 0.01) {
        if (diferencia > 0) {
            diferenciaHtml = `
                <div class="dev-diferencia-box dev-diferencia-cobrar">
                    <i class="fas fa-arrow-circle-up"></i>
                    <span>Cliente paga la diferencia: <strong>${fmt(diferencia)}</strong></span>
                </div>`;
            tipoPagoHtml = `
                <p class="detalle-section-title" style="margin-top:.8rem;">FORMA DE PAGO DE LA DIFERENCIA</p>
                <div class="payment-types" style="grid-template-columns:1fr 1fr;gap:8px;">
                    <div class="payment-type-btn active" id="devTipoPagoEf" onclick="devSetTipoPago('EFECTIVO')">
                        <i class="fas fa-money-bill-alt"></i> Efectivo
                    </div>
                    <div class="payment-type-btn" id="devTipoPagoTr" onclick="devSetTipoPago('TRANSFERENCIA')">
                        <i class="fas fa-university"></i> Transferencia
                    </div>
                </div>`;
        } else {
            diferenciaHtml = `
                <div class="dev-diferencia-box dev-diferencia-dar">
                    <i class="fas fa-arrow-circle-down"></i>
                    <span>Ferretería da vuelto: <strong>${fmt(Math.abs(diferencia))}</strong></span>
                </div>`;
        }
    }

    const motiNote = devMotivo
        ? `<div style="font-size:.8rem;color:var(--text-muted);margin-top:.7rem;padding:.5rem .7rem;background:var(--bg3);border-radius:6px;"><i class="fas fa-comment" style="margin-right:5px;"></i>${escHtml(devMotivo)}</div>`
        : '';

    $('devGestionBody').innerHTML = `
        <div class="dev-tipo-badge dev-tipo-badge-${tipo.toLowerCase()}">
            <i class="fas fa-${tipo === 'CAMBIO' ? 'exchange-alt' : 'undo-alt'}"></i> ${tipo}
        </div>
        <p class="detalle-section-title" style="margin-top:.8rem;">ÍTEMS A DEVOLVER</p>
        ${itemsDevHtml}
        ${devCambioItems.length ? `<p class="detalle-section-title" style="margin-top:.7rem;">ÍTEMS ENTREGADOS</p>${itemsCambioHtml}` : ''}
        <div class="dev-resumen-totales">
            <div class="dev-resumen-total-row">
                <span>Total devuelto:</span>
                <strong style="color:var(--success);">${fmt(totalDevuelto)}</strong>
            </div>
            ${tipo === 'CAMBIO' ? `<div class="dev-resumen-total-row">
                <span>Total entregado:</span>
                <strong style="color:var(--danger);">${fmt(totalCambio)}</strong>
            </div>` : ''}
        </div>
        ${diferenciaHtml}
        ${tipoPagoHtml}
        ${motiNote}`;

    const backFn = devCambioItems.length > 0 ? 'renderDevStep2()' : 'renderDevStep1()';
    const tipoLabel = tipo === 'CAMBIO' ? 'Cambio' : 'Devolución';
    $('devGestionFooter').innerHTML = `
        <button class="btn-cancel" onclick="${backFn}"><i class="fas fa-arrow-left"></i> Volver</button>
        <button class="btn-confirm dev-btn-confirmar" id="devBtnConfirmar" onclick="confirmarDevolucion()">
            <i class="fas fa-check"></i> Confirmar ${tipoLabel}
        </button>`;
}

function devSetTipoPago(tipo) {
    devTipoPago = tipo;
    const ef = $('devTipoPagoEf'), tr = $('devTipoPagoTr');
    if (ef) ef.classList.toggle('active', tipo === 'EFECTIVO');
    if (tr) tr.classList.toggle('active', tipo === 'TRANSFERENCIA');
}

// ── Confirmar ──────────────────────────────────────────

async function confirmarDevolucion() {
    const btn = $('devBtnConfirmar');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando…'; }

    const seleccionados = Object.values(devSelecciones).filter(x => x.cantidad > 0);
    const totalDevuelto = Math.round(seleccionados.reduce((s, x) => s + x.cantidad * x.precio, 0) * 100) / 100;
    const totalCambio = Math.round(devCambioItems.reduce((s, x) => s + x.quantity * x.price, 0) * 100) / 100;
    const diferencia = Math.round((totalCambio - totalDevuelto) * 100) / 100;
    const tipo = devCambioItems.length > 0 ? 'CAMBIO' : 'DEVOLUCION';

    try {
        // 1. Crear cabecera ferre_devoluciones
        const idDevolucion = `DEV${Date.now()}`;
        const { data: devData, error: devErr } = await db.from('ferre_devoluciones').insert({
            id_devolucion: idDevolucion,
            venta_id: devCurrentVenta.id,
            id_venta: devCurrentVenta.id_venta,
            tipo,
            motivo: devMotivo || null,
            total_devuelto: totalDevuelto,
            total_cobrado: totalCambio,
            diferencia,
            tipo_pago_diferencia: diferencia > 0.009 ? devTipoPago : null,
            estado: 'COMPLETADO',
            usuario_email: currentUser?.email || ''
        }).select('id').single();
        if (devErr) throw devErr;

        const devolucionId = devData.id;

        // 2. Insertar ferre_historial_devoluciones_detalle
        //    Los triggers DB se encargan de: subir stock y actualizar ventas_detalle.estado
        const devDetalleRows = seleccionados.map(x => {
            const original = devCurrentDetalles.find(d => d.id === x.detalle_id);
            const cantidadRestante = Math.max(0, Math.round((x.cantidad_max - x.cantidad) * 1000) / 1000);
            return {
                detalle_id: x.detalle_id,
                id_detalle: x.id_detalle || '',
                venta_id: devCurrentVenta.id,
                id_venta: devCurrentVenta.id_venta,
                producto_id: x.producto_id,
                cantidad_original: parseFloat(original?.cantidad || x.cantidad),
                cantidad_devuelta: x.cantidad,
                cantidad_restante: cantidadRestante,
                motivo: devMotivo || null,
                usuario_email: currentUser?.email || '',
                devolucion_id: devolucionId,
                precio_unitario: x.precio,
                subtotal_devuelto: Math.round(x.cantidad * x.precio * 100) / 100
            };
        });
        const { error: ddErr } = await db.from('ferre_historial_devoluciones_detalle').insert(devDetalleRows);
        if (ddErr) throw ddErr;

        // 3. Insertar ferre_cambios_detalle (trigger DB baja el stock)
        if (devCambioItems.length > 0) {
            const cambioRows = devCambioItems.map(x => ({
                devolucion_id: devolucionId,
                producto_id: x.code,
                cantidad: x.quantity,
                precio: x.price,
                usuario_email: currentUser?.email || ''
            }));
            const { error: cdErr } = await db.from('ferre_cambios_detalle').insert(cambioRows);
            if (cdErr) throw cdErr;
        }

        // 4. Registrar en ferre_historial_modificaciones_ventas
        const nuevoEstado = tipo === 'DEVOLUCION' ? 'DEVUELTO' : 'CAMBIADO';
        await db.from('ferre_historial_modificaciones_ventas').insert({
            venta_id: devCurrentVenta.id,
            id_venta: devCurrentVenta.id_venta,
            tipo_modificacion: tipo,
            motivo: devMotivo || null,
            estado_anterior: devCurrentVenta.estado,
            estado_nuevo: nuevoEstado,
            total_anterior: parseFloat(devCurrentVenta.total),
            total_nuevo: parseFloat(devCurrentVenta.total),
            usuario_email: currentUser?.email || ''
        });

        // 5. Éxito
        hideModal('devGestionModal');
        showToast(
            tipo === 'DEVOLUCION' ? 'Devolución procesada correctamente' : 'Cambio procesado correctamente',
            'success', 3500
        );

        // Refrescar inventario en memoria y lista
        await loadProducts();
        loadDevoluciones();

    } catch (err) {
        showToast(`Error: ${err.message}`, 'error', 5000);
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Confirmar'; }
    }
}

// ── Event listeners ────────────────────────────────────

function initDevoluciones_eventListeners() {
    // Pestaña historial
    $('devTabHistBtn').addEventListener('click', () => devSwitchTab('historial'));
    $('devTabNuevaBtn').addEventListener('click', () => devSwitchTab('nueva'));
    $('devHistBuscarBtn').addEventListener('click', loadDevHistorial);
    $('devHistDesde').addEventListener('change', loadDevHistorial);
    $('devHistHasta').addEventListener('change', loadDevHistorial);
    // Pestaña nueva devolución
    $('devDateFilter').addEventListener('change', loadDevoluciones);
    $('devSearchBtn').addEventListener('click', loadDevoluciones);
    $('devSearchInput').addEventListener('keydown', e => { if (e.key === 'Enter') loadDevoluciones(); });
    // Cabecera
    $('devBackBtn').addEventListener('click', () => navigateTo('pos'));
    $('devRefreshBtn').addEventListener('click', () => {
        if (devActiveTab === 'historial') loadDevHistorial();
        else loadDevoluciones();
    });
}
