'use strict';
// =====================================================
// Ferrisoluciones - POS Móvil - Configuración global
// Supabase, estado compartido y utilidades comunes
// =====================================================

const SUPABASE_URL = 'https://lpsupabase.luispintasolutions.com';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.LJEZ3yyGRxLBmCKM9z3EW-Yla1SszwbmvQMngMe3IWA';
const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Estado compartido ──────────────────────────────────
let allProducts = [], filteredProducts = [], cart = [], allClients = [];
let currentClient = defaultClient();
let currentUser = null, currentUserName = '', currentUserRole = '', isProcessingSale = false, currentTipoPago = 'EFECTIVO';
let nativeStream = null, isNativeScannerActive = false, nativeVideoElement = null, nativeScannerContainer = null, audioCtx = null;

function defaultClient() {
    return { cedula: '9999999999999', razon_social: 'CONSUMIDOR FINAL', direccion: 'S/N', telefono: 'S/N', correo: 'consumidor@final.com' };
}

// ── Helpers DOM ────────────────────────────────────────
const $ = id => document.getElementById(id);
const fmt = v => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0);
const showLoader = () => $('screenBlocker').classList.add('active');
const hideLoader = () => $('screenBlocker').classList.remove('active');
const showModal  = id => $(id).classList.add('active');
const hideModal  = id => $(id).classList.remove('active');
const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── Toast ──────────────────────────────────────────────
function showToast(msg, type = 'info', dur = 2800) {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    $('toastContainer').appendChild(t);
    void t.offsetWidth;
    t.classList.add('show');
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, dur);
}

// ── Confirm dialog ─────────────────────────────────────
function showConfirm(msg, onYes) {
    $('confirmMessage').textContent = msg;
    const y = $('confirmYesBtn'), n = $('confirmCancelBtn');
    const ny = y.cloneNode(true), nn = n.cloneNode(true);
    y.parentNode.replaceChild(ny, y);
    n.parentNode.replaceChild(nn, n);
    ny.addEventListener('click', () => { hideModal('confirmDialog'); onYes(); });
    nn.addEventListener('click', () => hideModal('confirmDialog'));
    showModal('confirmDialog');
}

// ── LocalStorage cart / client ─────────────────────────
const saveCartToStorage   = () => localStorage.setItem('fp_cart', JSON.stringify(cart));
const loadCartFromStorage = () => { try { cart = JSON.parse(localStorage.getItem('fp_cart')) || []; } catch (_) { cart = []; } };
const saveClientToStorage   = () => localStorage.setItem('fp_client', JSON.stringify(currentClient));
const loadClientFromStorage = () => { try { currentClient = JSON.parse(localStorage.getItem('fp_client')) || defaultClient(); } catch (_) { currentClient = defaultClient(); } };
