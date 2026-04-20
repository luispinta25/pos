'use strict';
// =====================================================
// Ferrisoluciones - POS Móvil - Módulo Utilidades
// Inventario y proveedores
// =====================================================

let utilProveedoresList = [];
let utilProdSeleccionado = null;
let utilProvSeleccionado = null;

// ── Escáner para utilidades ────────────────────────────
function utilStartScanner() {
    if (isNativeScannerActive) return;
    if (!('BarcodeDetector' in window)) { showToast('Tu navegador no soporta escaneo', 'error', 4000); return; }
    showToast('Iniciando cámara...', 'info', 1500);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } })
        .then(stream => {
            isNativeScannerActive = true; nativeStream = stream;
            createScannerUI(stream);
            setTimeout(() => { if (isNativeScannerActive) utilStartBarcodeDetection(); }, 500);
        })
        .catch(err => {
            const msg = err.name === 'NotAllowedError' ? 'Permiso de cámara denegado' : err.name === 'NotFoundError' ? 'No se encontró cámara' : 'Error: ' + err.message;
            showToast(msg, 'error', 4000); isNativeScannerActive = false;
        });
}

function utilStartBarcodeDetection() {
    if (!isNativeScannerActive || !nativeVideoElement) return;
    let detector;
    try { detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'code_93', 'upc_a', 'upc_e', 'itf', 'qr_code'] }); }
    catch (_) { showToast('Error iniciando escáner', 'error'); stopNativeScanner(); return; }
    const detect = async () => {
        if (!isNativeScannerActive || !nativeVideoElement || nativeVideoElement.paused) return;
        try {
            const codes = await detector.detect(nativeVideoElement);
            if (codes.length) {
                playBeep(); stopNativeScanner();
                const raw = codes[0].rawValue.trim();
                $('utilProdSearchInput').value = raw;
                $('utilProdSearchInput').dispatchEvent(new Event('input'));
                return;
            }
        } catch (_) {}
        if (isNativeScannerActive) requestAnimationFrame(detect);
    };
    if (nativeVideoElement.readyState >= 2) requestAnimationFrame(detect);
    else nativeVideoElement.addEventListener('loadeddata', function h() { requestAnimationFrame(detect); nativeVideoElement.removeEventListener('loadeddata', h); });
}

// ── Buscar producto ────────────────────────────────────
async function abrirUtilBuscarProd() {
    $('utilProdSearchInput').value = '';
    $('utilProdSearchResults').innerHTML = '';
    showModal('utilBuscarProdModal');
    setTimeout(() => $('utilProdSearchInput').focus(), 200);
    if (!utilProveedoresList.length) await utilCargarProveedores();
}

async function utilBuscarProducto() {
    const q = $('utilProdSearchInput').value.trim();
    const container = $('utilProdSearchResults');
    if (!q) { container.innerHTML = ''; return; }
    let results = allProducts.filter(p =>
        p.producto.toLowerCase().includes(q.toLowerCase()) || p.codigo.startsWith(q)
    ).slice(0, 12);
    if (!results.length) {
        try {
            const isNum = /^\d/.test(q);
            let qb = db.from('ferre_inventario').select('*');
            qb = isNum ? qb.ilike('codigo', `${q}%`) : qb.ilike('producto', `%${q}%`);
            const { data } = await qb.limit(12);
            results = data || [];
        } catch (_) {}
    }
    container.innerHTML = '';
    if (!results.length) {
        container.innerHTML = '<p style="padding:.75rem;text-align:center;color:var(--text-muted);font-size:.85rem;">Sin resultados</p>';
        return;
    }
    results.forEach(p => {
        const div = document.createElement('div');
        div.className = 'util-search-result';
        div.innerHTML = `<span class="util-search-name">${escHtml(p.producto)}</span><span class="util-search-sub">Cód: ${escHtml(p.codigo)} · Stock: ${p.stock} ${escHtml(p.unidad_paquete || '')}</span>`;
        div.addEventListener('click', () => utilSeleccionarProducto(p));
        container.appendChild(div);
    });
}

function utilSeleccionarProducto(p) {
    utilProdSeleccionado = p;
    hideModal('utilBuscarProdModal');
    $('utilEditProdNombre').textContent = p.producto;
    $('utilEditProdCodigo').textContent = `Código: ${p.codigo}`;
    $('utilEditStockActual').textContent = `${p.stock} ${p.unidad_paquete || 'und'}`;
    $('utilEditStockInput').value = p.stock ?? '';
    $('utilEditZonaInput').value = p.zona || '';
    $('utilEditStockMinInput').value = p.stock_minimo ?? '';
    const sel = $('utilEditProveedorSelect');
    sel.innerHTML = '<option value="">Sin Proveedor</option>';
    utilProveedoresList.forEach(pv => {
        const o = document.createElement('option');
        o.value = pv.id; o.textContent = pv.empresa;
        if (pv.id === p.proveedor_id) o.selected = true;
        sel.appendChild(o);
    });
    showModal('utilEditProdModal');
    setTimeout(() => { $('utilEditStockInput').focus(); $('utilEditStockInput').select(); }, 200);
}

async function guardarInventario() {
    const p = utilProdSeleccionado; if (!p) return;
    const nuevoStock    = parseFloat($('utilEditStockInput').value) ?? 0;
    const nuevaZona     = $('utilEditZonaInput').value.trim();
    const nuevoStockMin = parseFloat($('utilEditStockMinInput').value) || 0;
    const nuevoProvId   = $('utilEditProveedorSelect').value || null;
    const cambios = {};
    if (nuevoStock !== p.stock)                                cambios.stock = nuevoStock;
    if (nuevaZona !== (p.zona || ''))                          cambios.zona  = nuevaZona || null;
    if (nuevoStockMin !== (p.stock_minimo || 0))               cambios.stock_minimo = nuevoStockMin;
    if ((nuevoProvId || null) !== (p.proveedor_id || null))    cambios.proveedor_id = nuevoProvId;
    if (!Object.keys(cambios).length) { showToast('Sin cambios que guardar', 'warning'); return; }
    const btn = $('btnGuardarInventario');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    showLoader();
    try {
        const { error } = await db.from('ferre_inventario').update(cambios).eq('codigo', p.codigo);
        if (error) throw error;
        const idx = allProducts.findIndex(x => x.codigo === p.codigo);
        if (idx !== -1) Object.assign(allProducts[idx], cambios);
        hideModal('utilEditProdModal');
        showToast('Producto actualizado', 'success');
    } catch (err) { showToast('Error: ' + err.message, 'error', 4000); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Guardar'; hideLoader(); }
}

// ── Buscar proveedor ───────────────────────────────────
async function abrirUtilBuscarProv() {
    $('utilProvSearchInput').value = '';
    $('utilProvSearchResults').innerHTML = '';
    showModal('utilBuscarProvModal');
    setTimeout(() => $('utilProvSearchInput').focus(), 200);
    await utilCargarProveedores();
    utilRenderProvResults(utilProveedoresList.slice(0, 20));
}

async function utilCargarProveedores() {
    try {
        const { data } = await db.from('ferre_proveedores').select('id, empresa, vendedor, contacto').order('empresa');
        utilProveedoresList = data || [];
    } catch (_) {}
}

async function utilBuscarProveedor() {
    const q = $('utilProvSearchInput').value.trim().toLowerCase();
    if (!q) { utilRenderProvResults(utilProveedoresList.slice(0, 20)); return; }
    let results = utilProveedoresList.filter(p => p.empresa.toLowerCase().includes(q));
    if (!results.length) {
        try {
            const { data } = await db.from('ferre_proveedores').select('id,empresa,vendedor,contacto').ilike('empresa', `%${q}%`).limit(15);
            results = data || [];
        } catch (_) {}
    }
    utilRenderProvResults(results);
}

function utilRenderProvResults(lista) {
    const container = $('utilProvSearchResults');
    container.innerHTML = '';
    if (!lista.length) { container.innerHTML = '<p style="padding:.75rem;text-align:center;color:var(--text-muted);font-size:.85rem;">Sin resultados</p>'; return; }
    lista.forEach(p => {
        const div = document.createElement('div');
        div.className = 'util-search-result';
        div.innerHTML = `<span class="util-search-name">${escHtml(p.empresa)}</span><span class="util-search-sub">${escHtml(p.vendedor || 'Sin vendedor')} · ${escHtml(p.contacto || 'Sin contacto')}</span>`;
        div.addEventListener('click', () => utilSeleccionarProveedor(p));
        container.appendChild(div);
    });
}

function utilSeleccionarProveedor(p) {
    utilProvSeleccionado = p;
    hideModal('utilBuscarProvModal');
    $('utilEditProvInfo').textContent = p.empresa;
    $('utilEditVendedorInput').value = p.vendedor || '';
    $('utilEditContactoInput').value = p.contacto || '';
    showModal('utilEditProvModal');
    setTimeout(() => $('utilEditVendedorInput').focus(), 200);
}

async function guardarProveedor() {
    const p = utilProvSeleccionado; if (!p) return;
    const nuevoVendedor = $('utilEditVendedorInput').value.trim();
    const nuevoContacto = $('utilEditContactoInput').value.trim();
    if (nuevoVendedor === (p.vendedor || '') && nuevoContacto === (p.contacto || '')) {
        showToast('Sin cambios que guardar', 'warning'); return;
    }
    const btn = $('btnGuardarProveedor');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    showLoader();
    try {
        const { error } = await db.from('ferre_proveedores').update({
            vendedor: nuevoVendedor || null,
            contacto: nuevoContacto || null
        }).eq('id', p.id);
        if (error) throw error;
        const idx = utilProveedoresList.findIndex(x => x.id === p.id);
        if (idx !== -1) { utilProveedoresList[idx].vendedor = nuevoVendedor; utilProveedoresList[idx].contacto = nuevoContacto; }
        hideModal('utilEditProvModal');
        showToast('Proveedor actualizado', 'success');
    } catch (err) { showToast('Error: ' + err.message, 'error', 4000); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Guardar'; hideLoader(); }
}

// ── Registro de event listeners ────────────────────────
function initUtilidades_eventListeners() {
    $('utilidadesBackBtn').addEventListener('click', () => navigateTo('pos'));
    $('utilActualizarInventarioBtn').addEventListener('click', abrirUtilBuscarProd);
    $('utilActualizarProveedorBtn').addEventListener('click', abrirUtilBuscarProv);
    $('utilScanBtn').addEventListener('click', utilStartScanner);
    $('utilProdSearchInput').addEventListener('input', utilBuscarProducto);
    $('utilProvSearchInput').addEventListener('input', utilBuscarProveedor);
    $('btnGuardarInventario').addEventListener('click', guardarInventario);
    $('btnGuardarProveedor').addEventListener('click', guardarProveedor);
}
