// =====================================================
// Ferrisoluciones - Configuración de Supabase
// =====================================================

const SUPABASE_URL = 'https://lpsupabase.luispintasolutions.com';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.LJEZ3yyGRxLBmCKM9z3EW-Yla1SszwbmvQMngMe3IWA';

// Variable global para el cliente
let supabaseClient = null;

// Función para inicializar Supabase
function initSupabase() {
    if (supabaseClient) {
        return supabaseClient; // Ya está inicializado
    }

    if (typeof window.supabase !== 'undefined') {
        const { createClient } = window.supabase;
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return supabaseClient;
    } else {
        return null;
    }
}

// Función para obtener el cliente (con getter)
function getSupabaseClient() {
    if (!supabaseClient) {
        initSupabase();
    }
    return supabaseClient;
}

// Intentar inicializar inmediatamente
initSupabase();

// =====================================================
// SISTEMA DE MODALES PERSONALIZADOS GLOBALES
// =====================================================

/**
 * Muestra un modal de alerta personalizado
 */
function showCustomAlert(message, type = 'info', title = null) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('customModalOverlay');
        if (!overlay) {
            // Fallback to browser alert if modal not loaded
            alert(message);
            resolve();
            return;
        }
        
        const modal = overlay.querySelector('.custom-modal');
        const iconEl = document.getElementById('customModalIcon');
        const titleEl = document.getElementById('customModalTitle');
        const messageEl = document.getElementById('customModalMessage');
        const inputContainer = document.getElementById('customModalInputContainer');
        const cancelBtn = document.getElementById('customModalCancel');
        const confirmBtn = document.getElementById('customModalConfirm');
        const closeBtn = document.getElementById('customModalClose');

        // Configurar tipo
        modal.className = `custom-modal custom-modal-${type}`;
        
        // Configurar icono
        const icons = {
            info: 'fas fa-info-circle',
            success: 'fas fa-check-circle',
            warning: 'fas fa-exclamation-triangle',
            error: 'fas fa-times-circle'
        };
        iconEl.className = `custom-modal-icon ${icons[type] || icons.info}`;
        
        // Configurar título
        titleEl.textContent = title || (type === 'error' ? 'Error' : type === 'warning' ? 'Advertencia' : type === 'success' ? 'Éxito' : 'Información');
        
        // Configurar mensaje
        messageEl.innerHTML = message;
        
        // Ocultar input (para alert)
        inputContainer.style.display = 'none';
        
        // Configurar botones
        cancelBtn.style.display = 'none';
        confirmBtn.textContent = 'Aceptar';
        confirmBtn.className = 'btn btn-primary custom-modal-btn';
        
        // Mostrar modal
        overlay.classList.add('active');
        
        const closeModal = () => {
            overlay.classList.remove('active');
            cleanup();
            resolve();
        };
        
        const cleanup = () => {
            confirmBtn.removeEventListener('click', closeModal);
            closeBtn.removeEventListener('click', closeModal);
            document.removeEventListener('keydown', handleKeys);
        };
        
        const handleKeys = (e) => {
            if (e.key === 'Escape' || e.key === 'Enter') {
                closeModal();
            }
        };
        
        confirmBtn.addEventListener('click', closeModal);
        closeBtn.addEventListener('click', closeModal);
        document.addEventListener('keydown', handleKeys);
    });
}

/**
 * Muestra un modal de confirmación personalizado
 */
function showCustomConfirm(message, title = 'Confirmar', confirmText = 'Aceptar', cancelText = 'Cancelar') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('customModalOverlay');
        if (!overlay) {
            // Fallback to browser confirm
            const result = confirm(message);
            resolve(result);
            return;
        }
        
        const modal = overlay.querySelector('.custom-modal');
        const iconEl = document.getElementById('customModalIcon');
        const titleEl = document.getElementById('customModalTitle');
        const messageEl = document.getElementById('customModalMessage');
        const inputContainer = document.getElementById('customModalInputContainer');
        const cancelBtn = document.getElementById('customModalCancel');
        const confirmBtn = document.getElementById('customModalConfirm');
        const closeBtn = document.getElementById('customModalClose');

        // Configurar tipo
        modal.className = 'custom-modal custom-modal-confirm';
        
        // Configurar icono
        iconEl.className = 'custom-modal-icon fas fa-question-circle';
        
        // Configurar título
        titleEl.textContent = title;
        
        // Configurar mensaje
        messageEl.innerHTML = message;
        
        // Ocultar input
        inputContainer.style.display = 'none';
        
        // Configurar botones
        cancelBtn.style.display = 'inline-block';
        cancelBtn.textContent = cancelText;
        confirmBtn.textContent = confirmText;
        confirmBtn.className = 'btn btn-primary custom-modal-btn';
        cancelBtn.className = 'btn btn-secondary custom-modal-btn';
        
        // Mostrar modal
        overlay.classList.add('active');
        
        const handleConfirm = () => {
            overlay.classList.remove('active');
            cleanup();
            resolve(true);
        };
        
        const handleCancel = () => {
            overlay.classList.remove('active');
            cleanup();
            resolve(false);
        };
        
        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            closeBtn.removeEventListener('click', handleCancel);
            document.removeEventListener('keydown', handleKeys);
        };
        
        const handleKeys = (e) => {
            if (e.key === 'Escape') {
                handleCancel();
            } else if (e.key === 'Enter') {
                handleConfirm();
            }
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        closeBtn.addEventListener('click', handleCancel);
        document.addEventListener('keydown', handleKeys);
    });
}

/**
 * Muestra un modal de prompt personalizado
 */
function showCustomPrompt(message, defaultValue = '', title = 'Ingrese valor', placeholder = 'Escriba aquí...') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('customModalOverlay');
        if (!overlay) {
            // Fallback to browser prompt
            const result = prompt(message, defaultValue);
            resolve(result);
            return;
        }
        
        const modal = overlay.querySelector('.custom-modal');
        const iconEl = document.getElementById('customModalIcon');
        const titleEl = document.getElementById('customModalTitle');
        const messageEl = document.getElementById('customModalMessage');
        const inputContainer = document.getElementById('customModalInputContainer');
        const inputEl = document.getElementById('customModalInput');
        const cancelBtn = document.getElementById('customModalCancel');
        const confirmBtn = document.getElementById('customModalConfirm');
        const closeBtn = document.getElementById('customModalClose');

        // Configurar tipo
        modal.className = 'custom-modal custom-modal-prompt';
        
        // Configurar icono
        iconEl.className = 'custom-modal-icon fas fa-edit';
        
        // Configurar título
        titleEl.textContent = title;
        
        // Configurar mensaje
        messageEl.innerHTML = message;
        
        // Mostrar input
        inputContainer.style.display = 'block';
        inputEl.value = defaultValue;
        inputEl.placeholder = placeholder;
        
        // Configurar botones
        cancelBtn.style.display = 'inline-block';
        cancelBtn.textContent = 'Cancelar';
        confirmBtn.textContent = 'Aceptar';
        confirmBtn.className = 'btn btn-primary custom-modal-btn';
        cancelBtn.className = 'btn btn-secondary custom-modal-btn';
        
        // Mostrar modal
        overlay.classList.add('active');
        
        // Focus en input
        setTimeout(() => inputEl.focus(), 100);
        
        const handleConfirm = () => {
            const value = inputEl.value;
            overlay.classList.remove('active');
            cleanup();
            resolve(value);
        };
        
        const handleCancel = () => {
            overlay.classList.remove('active');
            cleanup();
            resolve(null);
        };
        
        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            closeBtn.removeEventListener('click', handleCancel);
            document.removeEventListener('keydown', handleKeys);
        };
        
        const handleKeys = (e) => {
            if (e.key === 'Escape') {
                handleCancel();
            } else if (e.key === 'Enter') {
                handleConfirm();
            }
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        closeBtn.addEventListener('click', handleCancel);
        document.addEventListener('keydown', handleKeys);
    });
}

// Hacer disponibles globalmente
window.showCustomAlert = showCustomAlert;
window.showCustomConfirm = showCustomConfirm;
window.showCustomPrompt = showCustomPrompt;


