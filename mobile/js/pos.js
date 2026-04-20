'use strict';
// =====================================================
// Ferrisoluciones - POS Móvil - Módulo POS
// Carrito, búsqueda, pago, cliente, escáner
// =====================================================

// ── Búsqueda de productos ──────────────────────────────
function filterProducts() {
    const query = $('searchInput').value.trim();
    filteredProducts = [];
    $('addByCodeBtn').disabled = true;
    if (!query) { $('searchResults').innerHTML = ''; return; }
    const exact = allProducts.find(p => p.codigo === query);
    if (exact) $('addByCodeBtn').disabled = getAvailableStock(exact.codigo) <= 0;
    const q = query.toLowerCase();
    filteredProducts = allProducts.filter(p => p.producto.toLowerCase().includes(q) || p.codigo.startsWith(query));
    renderSearchResults();
}

function renderSearchResults() {
    const sr = $('searchResults');
    sr.innerHTML = '';
    if (!filteredProducts.length) {
        if ($('searchInput').value.trim()) sr.innerHTML = '<li style="text-align:center;padding:1rem;color:var(--text-muted);font-style:italic;">Sin resultados</li>';
        return;
    }
    filteredProducts.forEach(p => {
        const stock = getAvailableStock(p.codigo), li = document.createElement('li');
        li.className = 'search-result-item';
        li.innerHTML = `<div class="product-info"><div><h3>${escHtml(p.producto)}</h3><div class="product-code">Cód: ${escHtml(p.codigo)}</div></div><span class="product-price">${fmt(p.precio)}</span></div>
<div class="search-result-actions"><span class="product-stock ${stock <= 0 ? 'sin-stock' : ''}">Stock: ${stock} ${escHtml(p.unidad_paquete || '')}</span>
<div class="result-btns"><button class="btn-add-x" onclick="promptAddQuantity('${escHtml(p.codigo)}')" ${stock <= 0 ? 'disabled' : ''}>Añadir X</button><button class="btn-add-one" onclick="handleAddToCart('${escHtml(p.codigo)}',1)" ${stock <= 0 ? 'disabled' : ''}>+1</button></div></div>`;
        sr.appendChild(li);
    });
}

// ── Carrito ────────────────────────────────────────────
function getAvailableStock(code) {
    const p = allProducts.find(x => x.codigo === code);
    if (!p) return 0;
    const c = cart.find(x => x.code === code);
    return p.stock - (c ? c.quantity : 0);
}

function handleAddToCart(code, qty = 1) {
    updateQuantity(code, qty);
    $('searchInput').value = '';
    filterProducts();
}

function updateQuantity(code, change) {
    const product = allProducts.find(p => p.codigo === code);
    if (!product) { showToast('Producto no encontrado', 'error'); return; }
    const idx = cart.findIndex(i => i.code === code);
    const newQty = (idx !== -1 ? cart[idx].quantity : 0) + change;
    if (newQty > product.stock) { showToast(`Stock insuficiente. Disponible: ${product.stock}`, 'warning'); return; }
    if (newQty <= 0) { if (idx !== -1) cart.splice(idx, 1); }
    else if (idx !== -1) cart[idx].quantity = newQty;
    else cart.push({ code: product.codigo, name: product.producto, price: product.precio, quantity: newQty, stock: product.stock });
    renderCart();
    saveCartToStorage();
}

function removeFromCart(code) {
    cart = cart.filter(i => i.code !== code);
    renderCart();
    saveCartToStorage();
}

function renderCart() {
    const cc = $('cartContainer');
    cc.innerHTML = '';
    if (!cart.length) {
        $('cartHeader').classList.add('hidden');
        cc.innerHTML = '<p class="cart-empty-msg">El carrito está vacío.</p>';
    } else {
        $('cartHeader').classList.remove('hidden');
        $('cartCount').textContent = `${cart.length} item${cart.length !== 1 ? 's' : ''}`;
        cart.forEach(item => {
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `<div class="product-info"><div><h3>${escHtml(item.name)}</h3><div class="product-code">Cód: ${escHtml(item.code)}</div></div><span class="cart-item-subtotal">${fmt(item.price * item.quantity)}</span></div>
<div class="cart-item-details"><div class="quantity-control"><button class="qty-btn" onclick="updateQuantity('${escHtml(item.code)}',-1)"><i class="fas fa-minus"></i></button><span class="qty-value" onclick="promptEditItem('${escHtml(item.code)}','quantity')">${item.quantity}</span><button class="qty-btn" onclick="updateQuantity('${escHtml(item.code)}',1)"><i class="fas fa-plus"></i></button></div><span class="unit-price" onclick="promptEditItem('${escHtml(item.code)}','price')">${fmt(item.price)}</span><button class="btn-remove" onclick="removeFromCart('${escHtml(item.code)}')"><i class="fas fa-trash"></i></button></div>`;
            cc.appendChild(div);
        });
    }
    $('totalDisplay').textContent = fmt(cart.reduce((s, i) => s + i.price * i.quantity, 0));
}

// ── Modales carrito ────────────────────────────────────
function promptAddQuantity(code) {
    const p = allProducts.find(x => x.codigo === code);
    if (!p) return;
    const avail = getAvailableStock(code);
    if (avail <= 0) { showToast('Sin stock disponible', 'warning'); return; }
    $('qtyProductName').textContent = p.producto;
    $('qtyStockInfo').textContent = `Stock disponible: ${avail} ${p.unidad_paquete || ''}`;
    const input = $('quantityInput');
    input.value = '1';
    input.max = avail;
    const btn = $('btnConfirmarCantidad'), nb = btn.cloneNode(true);
    btn.parentNode.replaceChild(nb, btn);
    nb.addEventListener('click', () => {
        const qty = parseFloat(input.value);
        if (!qty || qty <= 0 || qty > avail) { showToast(`Ingresa entre 1 y ${avail}`, 'warning'); return; }
        handleAddToCart(code, qty);
        hideModal('addQuantityModal');
    });
    input.onkeypress = e => { if (e.key === 'Enter') { e.preventDefault(); nb.click(); } };
    showModal('addQuantityModal');
    setTimeout(() => { input.focus(); input.select(); }, 100);
}

function promptEditItem(code, type) {
    const idx = cart.findIndex(i => i.code === code);
    if (idx === -1) return;
    const item = cart[idx], product = allProducts.find(p => p.codigo === code);
    $('editItemName').textContent = item.name;
    if (type === 'quantity') {
        $('editItemTitle').textContent = 'Editar Cantidad';
        $('editItemLabel').textContent = 'Nueva Cantidad:';
        $('editItemInput').step = '1'; $('editItemInput').min = '1'; $('editItemInput').value = item.quantity; $('editItemInput').max = product ? product.stock : 9999;
        $('editItemInfo').textContent = product ? `Stock total: ${product.stock}` : '';
    } else {
        $('editItemTitle').textContent = 'Editar Precio';
        $('editItemLabel').textContent = 'Nuevo Precio:';
        $('editItemInput').step = '0.01'; $('editItemInput').min = '0.01'; $('editItemInput').value = item.price.toFixed(2); $('editItemInput').removeAttribute('max');
        $('editItemInfo').textContent = '';
    }
    const btn = $('btnConfirmarEdicion'), nb = btn.cloneNode(true);
    btn.parentNode.replaceChild(nb, btn);
    nb.addEventListener('click', () => {
        const val = parseFloat($('editItemInput').value);
        if (!val || val <= 0) { showToast('Valor inválido', 'warning'); return; }
        if (type === 'quantity') { if (product && val > product.stock) { showToast(`Máximo: ${product.stock}`, 'warning'); return; } cart[idx].quantity = parseFloat(val.toFixed(2)); }
        else cart[idx].price = parseFloat(val.toFixed(2));
        renderCart(); saveCartToStorage(); hideModal('editItemModal');
    });
    $('editItemInput').onkeypress = e => { if (e.key === 'Enter') { e.preventDefault(); nb.click(); } };
    showModal('editItemModal');
    setTimeout(() => { $('editItemInput').focus(); $('editItemInput').select(); }, 100);
}

// ── Cliente ────────────────────────────────────────────
function showClientModal() {
    $('modalClienteActual').textContent = `${currentClient.razon_social} (${currentClient.cedula})`;
    $('clientSearchInput').value = '';
    $('clientSearchResults').innerHTML = '';
    $('registerClientForm').classList.add('hidden');
    showModal('clientModal');
    setTimeout(() => $('clientSearchInput').focus(), 200);
}

async function searchClients() {
    const raw = $('clientSearchInput').value.trim(), ql = raw.toLowerCase(), container = $('clientSearchResults');
    container.innerHTML = '';
    $('registerClientForm').classList.add('hidden');
    if (!raw) return;
    let results = allClients.filter(c => c.cedula.includes(raw) || (c.razon_social || '').toLowerCase().includes(ql));
    if (!results.length && raw.length >= 3) {
        try {
            const esNumerico = /^\d+$/.test(raw);
            let qb = db.from('ferre_clientes').select('*');
            qb = esNumerico ? qb.ilike('cedula', `${raw}%`) : qb.ilike('razon_social', `%${ql}%`);
            const { data } = await qb.limit(10);
            if (data && data.length) {
                data.forEach(c => { if (!allClients.find(x => x.cedula === c.cedula)) allClients.push(c); });
                results = data;
            }
        } catch (_) {}
    }
    if (results.length) {
        results.slice(0, 8).forEach(c => {
            const div = document.createElement('div');
            div.className = 'client-result-item';
            div.innerHTML = `<div><div class="client-name">${escHtml(c.razon_social)}</div><div class="client-id">${escHtml(c.cedula)}</div></div><button class="btn-select-client" onclick="selectClient('${escHtml(c.cedula)}')">Seleccionar</button>`;
            container.appendChild(div);
        });
    } else {
        container.innerHTML = `<p style="padding:.75rem;color:var(--text-muted);font-size:.85rem;text-align:center;">Sin resultados</p>`;
        if (/^\d{10}$|^\d{13}$/.test(raw)) container.innerHTML += `<p style="padding:0 .75rem .75rem;text-align:center;"><button onclick="showRegisterForm('${escHtml(raw)}')" style="background:var(--primary);color:#1a1a1a;padding:.45rem 1rem;border-radius:8px;font-size:.82rem;">Registrar cédula ${escHtml(raw)}</button></p>`;
    }
}

function selectClient(cedula) {
    const c = allClients.find(x => x.cedula === cedula);
    if (c) { currentClient = c; saveClientToStorage(); updateClientDisplay(); hideModal('clientModal'); showToast(`Cliente: ${c.razon_social}`, 'success', 2000); }
}

function resetToConsumidorFinal() {
    currentClient = defaultClient();
    saveClientToStorage();
    updateClientDisplay();
    hideModal('clientModal');
}

function updateClientDisplay() {
    $('clientBtnLabel').textContent = currentClient.cedula === '9999999999999' ? 'Cliente' : currentClient.razon_social.split(' ')[0];
}

function showRegisterForm(cedula) {
    $('clientSearchResults').innerHTML = '';
    $('newClientCedula').value = cedula;
    ['newClientNombre', 'newClientDireccion', 'newClientTelefono', 'newClientCorreo'].forEach(id => $(id).value = '');
    $('registerClientForm').classList.remove('hidden');
    setTimeout(() => $('newClientNombre').focus(), 100);
}

async function guardarCliente() {
    const cedula = $('newClientCedula').value.trim(), nombre = $('newClientNombre').value.trim(),
          direccion = $('newClientDireccion').value.trim(), telefono = $('newClientTelefono').value.trim(),
          correo = $('newClientCorreo').value.trim();
    if (!cedula || !nombre || !direccion || !correo) { showToast('Rellena los campos obligatorios', 'warning'); return; }
    if (!/^\d{10}$|^\d{13}$/.test(cedula)) { showToast('Cédula/RUC no válida', 'warning'); return; }
    if (!correo.includes('@')) { showToast('Correo no válido', 'warning'); return; }
    showLoader();
    try {
        const { data, error } = await db.from('ferre_clientes').upsert([{ cedula, razon_social: nombre, direccion, telefono, correo }], { onConflict: 'cedula' }).select().single();
        if (error) throw error;
        const idx = allClients.findIndex(c => c.cedula === cedula);
        if (idx !== -1) allClients[idx] = data; else allClients.push(data);
        selectClient(cedula);
        showToast('Cliente guardado', 'success');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { hideLoader(); }
}

// ── Pago ───────────────────────────────────────────────
function setTipoPago(tipo) {
    currentTipoPago = tipo;
    $('btnTipoEfectivo').classList.toggle('active', tipo === 'EFECTIVO');
    $('btnTipoTransf').classList.toggle('active', tipo === 'TRANSFERENCIA');
    $('btnTipoMixto').classList.toggle('active', tipo === 'MIXTO');
    $('efectivoSection').classList.toggle('hidden', tipo !== 'EFECTIVO');
    $('transferenciaSection').classList.toggle('hidden', tipo !== 'TRANSFERENCIA');
    $('mixtoSection').classList.toggle('hidden', tipo !== 'MIXTO');
    const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    if (tipo === 'TRANSFERENCIA') {
        $('montoTransfDisplay').textContent = fmt(total);
        const btn = $('btnConfirmarVenta'); btn.disabled = false; btn.style.opacity = '1';
    } else if (tipo === 'MIXTO') {
        $('montoEfectivoMixto').value = '';
        $('montoTransfMixto').textContent = fmt(total);
        const btn = $('btnConfirmarVenta'); btn.disabled = true; btn.style.opacity = '.5';
        setTimeout(() => { $('montoEfectivoMixto').focus(); }, 100);
    } else {
        calcularCambio();
    }
}

function calcularMixto() {
    const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const cash  = Math.round((parseFloat($('montoEfectivoMixto').value) || 0) * 100) / 100;
    const transf = Math.max(0, Math.round((total - cash) * 100) / 100);
    $('montoTransfMixto').textContent = fmt(transf);
    const valid = cash > 0.001 && transf > 0.001;
    const btn = $('btnConfirmarVenta');
    btn.disabled = !valid;
    btn.style.opacity = valid ? '1' : '.5';
}

function showPaymentModal() {
    if (!cart.length) { showToast('El carrito está vacío', 'warning'); return; }
    const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    $('paymentTotal').textContent = fmt(total);
    $('montoRecibido').value = total.toFixed(2);
    $('cambioDisplay').textContent = '$0.00';
    $('montoTransfDisplay').textContent = fmt(total);
    $('postSaveSection').classList.add('hidden');
    $('paymentFooter').classList.remove('hidden');
    setTipoPago('EFECTIVO');
    calcularCambio();
    showModal('paymentModal');
    setTimeout(() => { const i = $('montoRecibido'); i.focus(); i.select(); }, 200);
}

function calcularCambio() {
    const total = cart.reduce((s, i) => s + i.price * i.quantity, 0), pagado = parseFloat($('montoRecibido').value) || 0;
    $('cambioDisplay').textContent = fmt(Math.max(0, pagado - total));
    const btn = $('btnConfirmarVenta');
    btn.disabled = currentTipoPago === 'EFECTIVO' && pagado < total - 0.01;
    btn.style.opacity = btn.disabled ? '.5' : '1';
}

async function processSale() {
    if (isProcessingSale) return;
    isProcessingSale = true;
    const btn = $('btnConfirmarVenta');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    showLoader();
    try {
        const total = Math.round(cart.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;
        let pagadoCon, vuelto, _montoCashMixto = 0, _montoTransfMixto = 0;
        if (currentTipoPago === 'MIXTO') {
            _montoCashMixto  = Math.round((parseFloat($('montoEfectivoMixto').value) || 0) * 100) / 100;
            _montoTransfMixto = Math.max(0, Math.round((total - _montoCashMixto) * 100) / 100);
            if (_montoCashMixto <= 0 || _montoTransfMixto <= 0) { showToast('Ingresa un monto en efectivo válido', 'warning'); return; }
            pagadoCon = Math.round((_montoCashMixto + _montoTransfMixto) * 100) / 100;
            vuelto = 0;
        } else if (currentTipoPago === 'EFECTIVO') {
            pagadoCon = Math.round((parseFloat($('montoRecibido').value) || total) * 100) / 100;
            vuelto = Math.max(0, Math.round((pagadoCon - total) * 100) / 100);
            if (pagadoCon < total - 0.01) { showToast('Monto insuficiente', 'warning'); return; }
        } else {
            pagadoCon = total; vuelto = 0;
        }
        const ventaId = `S${Date.now()}`;
        const { data: venta, error: ve } = await db.from('ferre_ventas').insert([{
            id_venta: ventaId, fecha_hora_venta: new Date().toISOString(), cliente_id: currentClient.cedula,
            total, pagado_con: pagadoCon, vuelto, tipo: 'RECIBO', tipo_pago: currentTipoPago, estado: 'COMPLETADO',
            usuario_email: currentUser?.email || null, doc: null, clave_acceso: null, fecha_factura: null
        }]).select().single();
        if (ve) throw new Error(ve.message);
        const detalles = cart.map((item, i) => ({
            id_detalle: `${ventaId}_${i + 1}`, venta_id: venta.id, id_venta: ventaId,
            producto_id: item.code, cantidad: parseFloat(item.quantity), precio: parseFloat(item.price), estado: 'ACTIVO'
        }));
        const { error: de } = await db.from('ferre_ventas_detalle').insert(detalles);
        if (de) { await db.from('ferre_ventas').delete().eq('id', venta.id); throw new Error(de.message); }
        detalles.forEach(d => { const p = allProducts.find(x => x.codigo === d.producto_id); if (p) p.stock = Math.max(0, p.stock - d.cantidad); });
        if (currentTipoPago === 'TRANSFERENCIA' || currentTipoPago === 'MIXTO') {
            const prods = detalles.map(d => { const c = cart.find(x => x.code === d.producto_id); return `${d.cantidad} x ${c ? c.name : d.producto_id}`; }).join('\n');
            const extra = currentTipoPago === 'MIXTO'
                ? { monto_efectivo: _montoCashMixto.toFixed(2), monto_transferencia: _montoTransfMixto.toFixed(2) }
                : {};
            const montoWebhook = currentTipoPago === 'MIXTO' ? _montoTransfMixto : total;
            fetch('https://lpn8nwebhook.luispintasolutions.com/webhook/7d2a34e2-84b5-4c84-aedc-7f82416ccadc', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idventa: ventaId, productos: prods, monto: montoWebhook.toFixed(2), tipo_pago: currentTipoPago, total_venta: total.toFixed(2), cliente: currentClient.razon_social, ...extra })
            })
            .then(r => r.json())
            .then(async data => {
                const idMessage = (data && data.length > 0 && data[0].data && data[0].data.key)
                    ? data[0].data.key.id : null;
                const { error: transError } = await db.from('ferre_transferencias').insert({
                    id_venta: ventaId,
                    monto: montoWebhook,
                    motivo: `Venta POS ${ventaId}`,
                    caso: 'ingreso',
                    id_message: idMessage || null,
                    subido_por: currentUser?.email || null,
                    user_id: currentUser?.id || null,
                    fotografia: null,
                    fechahora: new Date().toISOString()
                });
                if (transError) console.error('Error al crear registro de transferencia:', transError);
            })
            .catch(err => console.error('Error webhook venta', err));
        }
        cart = []; saveCartToStorage();
        $('ventaExitoMsg').textContent = '¡Venta registrada!';
        $('ventaExitoSub').textContent = `#${ventaId} · ${fmt(total)} · ${currentTipoPago}`;
        $('postSaveSection').classList.remove('hidden');
        $('paymentFooter').classList.add('hidden');
        showToast('Venta guardada', 'success', 3000);
    } catch (err) { showToast('Error: ' + err.message, 'error', 5000); }
    finally { isProcessingSale = false; hideLoader(); btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Confirmar'; }
}

function closePaymentAndReset() {
    hideModal('paymentModal');
    renderCart();
    resetToConsumidorFinal();
    loadProducts();
}

// ── Escáner de código de barras ────────────────────────
function startNativeScanner() {
    if (isNativeScannerActive) return;
    if (!('BarcodeDetector' in window)) { showToast('Tu navegador no soporta escaneo', 'error', 4000); return; }
    showToast('Iniciando cámara...', 'info', 1500);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } })
        .then(stream => { isNativeScannerActive = true; nativeStream = stream; createScannerUI(stream); setTimeout(() => { if (isNativeScannerActive) startBarcodeDetection(); }, 500); })
        .catch(err => { const msg = err.name === 'NotAllowedError' ? 'Permiso de cámara denegado' : err.name === 'NotFoundError' ? 'No se encontró cámara' : 'Error: ' + err.message; showToast(msg, 'error', 4000); isNativeScannerActive = false; });
}

function createScannerUI(stream) {
    nativeScannerContainer = document.createElement('div');
    Object.assign(nativeScannerContainer.style, { position: 'fixed', inset: '0', background: '#000', zIndex: '10000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' });
    const title = Object.assign(document.createElement('div'), { textContent: 'Apunte al código de barras' });
    Object.assign(title.style, { color: 'white', padding: '10px', fontSize: '15px', textAlign: 'center', position: 'absolute', top: '0', width: '100%', background: 'rgba(0,0,0,.6)', zIndex: '3' });
    const wrap = document.createElement('div');
    Object.assign(wrap.style, { width: '100%', height: '100%', position: 'relative', overflow: 'hidden' });
    nativeVideoElement = document.createElement('video');
    nativeVideoElement.srcObject = stream; nativeVideoElement.autoplay = true; nativeVideoElement.playsInline = true;
    Object.assign(nativeVideoElement.style, { width: '100%', height: '100%', objectFit: 'cover', zIndex: '1' });
    const style = document.createElement('style');
    style.textContent = '@keyframes scanAnim{0%{top:10%}50%{top:88%}100%{top:10%}}';
    document.head.appendChild(style);
    const line = document.createElement('div');
    Object.assign(line.style, { position: 'absolute', left: '5%', right: '5%', height: '3px', background: 'linear-gradient(to right,transparent,rgba(212,160,23,.9),transparent)', boxShadow: '0 0 10px rgba(212,160,23,.8)', borderRadius: '2px', zIndex: '2', animation: 'scanAnim 2.5s infinite linear' });
    const close = document.createElement('button');
    close.textContent = 'Cancelar';
    Object.assign(close.style, { position: 'absolute', bottom: '30px', padding: '12px 30px', background: 'rgba(212,160,23,.85)', color: '#1a1a1a', border: 'none', borderRadius: '10px', zIndex: '3', fontWeight: 'bold', fontSize: '1rem' });
    close.onclick = stopNativeScanner;
    wrap.append(nativeVideoElement, line);
    nativeScannerContainer.append(wrap, title, close);
    document.body.appendChild(nativeScannerContainer);
    nativeVideoElement.addEventListener('loadedmetadata', () => nativeVideoElement.play().catch(() => stopNativeScanner()));
}

function startBarcodeDetection() {
    if (!isNativeScannerActive || !nativeVideoElement) return;
    let detector;
    try { detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'code_93', 'upc_a', 'upc_e', 'itf', 'qr_code'] }); }
    catch (_) { showToast('Error iniciando escáner', 'error'); stopNativeScanner(); return; }
    const detect = async () => {
        if (!isNativeScannerActive || !nativeVideoElement || nativeVideoElement.paused) return;
        try { const codes = await detector.detect(nativeVideoElement); if (codes.length) { playBeep(); stopNativeScanner(); processScannedCode(codes[0].rawValue); return; } } catch (_) {}
        if (isNativeScannerActive) requestAnimationFrame(detect);
    };
    if (nativeVideoElement.readyState >= 2) requestAnimationFrame(detect);
    else nativeVideoElement.addEventListener('loadeddata', function h() { requestAnimationFrame(detect); nativeVideoElement.removeEventListener('loadeddata', h); });
}

function stopNativeScanner() {
    if (nativeStream) { nativeStream.getTracks().forEach(t => t.stop()); nativeStream = null; }
    if (nativeScannerContainer?.parentNode) nativeScannerContainer.parentNode.removeChild(nativeScannerContainer);
    isNativeScannerActive = false; nativeVideoElement = null; nativeScannerContainer = null;
}

function processScannedCode(raw) {
    const code = raw.trim().replace(/^0+/, '') || raw.trim(), product = allProducts.find(p => p.codigo === code);
    if (product) { const stock = getAvailableStock(code); if (stock > 0) promptAddQuantity(code); else showToast(`Sin stock: ${product.producto}`, 'warning'); }
    else showToast(`Código "${code}" no encontrado`, 'error');
}

function playBeep() {
    try {
        if (!audioCtx || audioCtx.state === 'closed') audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const now = audioCtx.currentTime, osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.type = 'square'; osc.frequency.setValueAtTime(3800, now); gain.gain.setValueAtTime(.25, now); gain.gain.exponentialRampToValueAtTime(.001, now + .15);
        osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + .15);
    } catch (_) {}
}

// ── Registro de event listeners ────────────────────────
function initPos_eventListeners() {
    $('searchInput').addEventListener('input', filterProducts);
    $('addByCodeBtn').addEventListener('click', () => { const code = $('searchInput').value.trim(); if (code && !$('addByCodeBtn').disabled) promptAddQuantity(code); });
    $('clearCartBtn').addEventListener('click', () => { if (!cart.length) return; showConfirm('¿Vaciar el carrito?', () => { cart = []; renderCart(); saveCartToStorage(); resetToConsumidorFinal(); }); });
    $('cobrarBtn').addEventListener('click', showPaymentModal);
    $('clientBtn').addEventListener('click', showClientModal);
    $('scanBtn').addEventListener('click', startNativeScanner);
    $('montoRecibido').addEventListener('input', calcularCambio);
    $('btnConfirmarVenta').addEventListener('click', processSale);
    $('clientSearchInput').addEventListener('input', searchClients);
    $('btnGuardarCliente').addEventListener('click', guardarCliente);
}
