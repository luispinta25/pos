'use strict';
// =====================================================
// Ferrisoluciones - POS Móvil - App principal
// Autenticación, navegación, carga de datos, bootstrap
// =====================================================

// ── Sesión y autenticación ─────────────────────────────
async function checkSession() {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
        currentUser = session.user;
        $('loginScreen').style.display = 'none';
        await initApp();
    } else {
        hideLoader();
    }
}

async function initApp() {
    $('loginScreen').style.display = 'none';
    $('appScreen').classList.remove('hidden');
    showLoader();
    try {
        const { data } = await db.from('ferre_usuarios_ferreteria').select('nombres, rol').eq('user_id', currentUser.id).maybeSingle();
        currentUserName = data?.nombres || currentUser.email.split('@')[0];
        currentUserRole = data?.rol || 'usuario';
        $('headerUser').textContent = currentUserName;
    } catch (_) {}
    await Promise.allSettled([loadProducts(), loadClients()]);
    loadCartFromStorage();
    loadClientFromStorage();
    renderCart();
    updateClientDisplay();
    hideLoader();
    startTransfAlertPolling();
}

async function loadProducts() {
    try {
        const { data, error } = await db.from('ferre_inventario').select('*').order('producto');
        if (error) throw error;
        allProducts = data || [];
    } catch (_) { showToast('Error cargando inventario', 'error'); }
}

async function loadClients() {
    try {
        const { data } = await db.from('ferre_clientes').select('*').order('razon_social');
        allClients = data || [];
    } catch (_) {}
}

// ── Navegación ─────────────────────────────────────────
let currentScreen = 'pos';

function openDrawer() {
    $('navDrawer').classList.add('open');
    $('navOverlay').classList.add('active');
}

function closeDrawer() {
    $('navDrawer').classList.remove('open');
    $('navOverlay').classList.remove('active');
}

function navigateTo(screen) {
    closeDrawer();
    if (screen === currentScreen) return;
    $('appScreen').classList.toggle('hidden', screen !== 'pos');
    $('historialScreen').classList.toggle('hidden', screen !== 'hist');
    $('gastosScreen').classList.toggle('hidden', screen !== 'gastos');
    $('utilidadesScreen').classList.toggle('hidden', screen !== 'utilidades');
    $('transferenciasScreen').classList.toggle('hidden', screen !== 'transferencias');
    $('devolucionesScreen').classList.toggle('hidden', screen !== 'devoluciones');
    currentScreen = screen;
    document.querySelectorAll('.nav-item[data-screen]').forEach(el => {
        el.classList.toggle('active', el.dataset.screen === screen);
    });
    if (screen === 'hist') { initHistorialDate(); loadHistorial(); }
    if (screen === 'gastos') { initGastosDate(); loadGastos(); }
    if (screen === 'transferencias') { loadTransferencias(); }
    if (screen === 'devoluciones') { initDevolucionesDate(); loadDevHistorial(); }
}

// ── Event listeners globales ───────────────────────────
function initApp_eventListeners() {
    $('loginForm').addEventListener('submit', async e => {
        e.preventDefault();
        const email = $('loginEmail').value.trim(), password = $('loginPassword').value, btn = $('btnLogin');
        $('loginError').classList.add('hidden');
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        try {
            const { data, error } = await db.auth.signInWithPassword({ email, password });
            if (error) throw error;
            currentUser = data.user; await initApp();
        } catch (err) {
            $('loginError').textContent = err.message || 'Error de autenticación';
            $('loginError').classList.remove('hidden');
        } finally {
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
        }
    });

    $('logoutBtn').addEventListener('click', () => showConfirm('¿Cerrar sesión?', async () => {
        await db.auth.signOut();
        $('appScreen').classList.add('hidden');
        $('historialScreen').classList.add('hidden');
        $('gastosScreen').classList.add('hidden');
        $('utilidadesScreen').classList.add('hidden');
        $('transferenciasScreen').classList.add('hidden');
        $('devolucionesScreen').classList.add('hidden');
        $('loginScreen').style.display = 'flex';
        currentScreen = 'pos';
        cart = []; currentClient = defaultClient(); allProducts = []; saveCartToStorage();
    }));

    $('hamburgerBtn').addEventListener('click', openDrawer);
    $('navOverlay').addEventListener('click', closeDrawer);

    document.querySelectorAll('.nav-item[data-screen]').forEach(el => {
        el.addEventListener('click', () => navigateTo(el.dataset.screen));
    });
}

// ── Bootstrap: carga views → registra listeners → sesión ─
async function bootstrap() {
    showLoader();
    const views = ['login', 'pos', 'historial', 'gastos', 'utilidades', 'transferencias', 'devoluciones'];
    const container = $('viewsContainer');
    for (const view of views) {
        try {
            const res = await fetch(`views/${view}.html`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const html = await res.text();
            container.insertAdjacentHTML('beforeend', html);
        } catch (e) { console.error('Error cargando vista:', view, e); }
    }
    // Registrar todos los event listeners ahora que el DOM está listo
    initPos_eventListeners();
    initHistorial_eventListeners();
    initGastos_eventListeners();
    initUtilidades_eventListeners();
    initTransferencias_eventListeners();
    initDevoluciones_eventListeners();
    initApp_eventListeners();
    // Verificar sesión (muestra login o inicia app)
    await checkSession();
}

document.addEventListener('DOMContentLoaded', bootstrap);
