// =====================================================
// Ferrisoluciones - Aplicación Principal
// Gestor de módulos y navegación
// =====================================================

// Estado de la aplicación
const appState = {
    currentModule: null,
    moduleCache: {}
};

// =====================================================
// GESTIÓN DE MÓDULOS
// =====================================================

/**
 * Actualizar el contador del navbar según el módulo activo
 */
function updateNavbarCounter(moduleName, value = null) {
    const totalLabel = document.querySelector('.total-label');
    const totalAmount = document.getElementById('navTotalAmount');
    
    if (!totalLabel || !totalAmount) return;

    switch (moduleName) {
        case 'punto-venta':
            totalLabel.textContent = 'Total:';
            if (value !== null) {
                totalAmount.textContent = formatCurrency(value);
            } else {
                totalAmount.textContent = '$0.00';
            }
            break;
        
        case 'ventas':
            totalLabel.textContent = 'Ventas del día:';
            // Solo actualizar si se pasa un valor explícito
            if (value !== null && value !== undefined) {
                totalAmount.textContent = String(value);
            }
            break;
        
        case 'gastos':
            totalLabel.textContent = 'Gastos del día:';
            // Solo actualizar si se pasa un valor explícito
            if (value !== null && value !== undefined) {
                totalAmount.textContent = String(value); // Asegurar que sea texto plano
            }
            // Si no hay valor, no modificar (el módulo lo actualizará después)
            break;
        
        case 'proveedores':
            totalLabel.textContent = 'Facturas:';
            if (value !== null && value !== undefined) {
                totalAmount.textContent = String(value);
            } else {
                totalAmount.textContent = '-';
            }
            break;
        case 'cxc':
            totalLabel.textContent = 'Deudas activas:';
            if (typeof value === 'number') {
                totalAmount.textContent = formatCurrency(value);
            } else if (value !== null && value !== undefined) {
                totalAmount.textContent = String(value);
            } else {
                totalAmount.textContent = '$0.00';
            }
            break;
        
        case 'utilidades':
            totalLabel.textContent = 'Herramientas:';
            totalAmount.textContent = '';
            break;
        
        default:
            totalLabel.textContent = 'Total:';
            totalAmount.textContent = '0';
            break;
    }
}

/**
 * Cargar un módulo HTML en el contenedor
 */
async function loadModule(moduleName) {
    try {
        // Marcar botón activo
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-module="${moduleName}"]`)?.classList.add('active');

        // Actualizar el tipo de información que muestra el header según el módulo
        updateNavbarCounter(moduleName);

        // Mostrar loading rediseñado
        const container = document.getElementById('moduleContainer');
        container.innerHTML = `
            <div class="loading">
                <div class="spinner-container">
                    <div class="spinner"></div>
                    <img src="https://i.ibb.co/8gLPXfjh/FERRISOLUCIONES-1.png" class="loading-logo-mini" alt="Loading...">
                </div>
                <p>Cargando ${moduleName.replace('-', ' ')}...</p>
                <div class="login-footer" style="border-top: none; margin-top: 10px;">
                    <p class="powered-by">Powered by</p>
                    <img src="img/dev/lpsolutionsblack.webp" alt="Developer Logo" class="dev-logo" style="height: 20px;">
                </div>
            </div>
        `;

        // Cargar HTML del módulo
        const response = await fetch(`views/${moduleName}.html`);
        if (!response.ok) throw new Error('Módulo no encontrado');
        
        const html = await response.text();
        
        // Limpiar el contenedor
        container.innerHTML = '';
        
        // Crear un div temporal para parsear el HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Extraer y ejecutar scripts manualmente
        const scripts = tempDiv.querySelectorAll('script');
        const scriptContents = [];
        
        scripts.forEach(script => {
            scriptContents.push(script.textContent);
            script.remove(); // Remover para evitar duplicados
        });
        
        // Insertar el HTML sin scripts
        container.innerHTML = tempDiv.innerHTML;
        
        // Preparar el nombre de la función init del módulo (ej: initProveedores)
        const initFunctionName = `init${toPascalCase(moduleName)}`;

        // Ejecutar los scripts uno por uno dentro de un IIFE para aislar declaraciones
        // y exponer la función de inicialización en `window` si fue definida en el script.
        scriptContents.forEach(scriptContent => {
            try {
                // Usamos concatenación simple para evitar problemas con template literals (${} o `) en el contenido del script
                let wrapper = '(function(){\n"use strict";\n';
                wrapper += scriptContent;
                wrapper += '\n// Export known helpers if the module defined them (to keep backward compatibility)\n';
                wrapper += 'try{ if (typeof ' + initFunctionName + ' === "function") window["' + initFunctionName + '"] = ' + initFunctionName + '; }catch(e){}\n';
                wrapper += 'try{ if (typeof showAppLoader === "function") window.showAppLoader = showAppLoader; }catch(e){}\n';
                wrapper += 'try{ if (typeof hideAppLoader === "function") window.hideAppLoader = hideAppLoader; }catch(e){}\n';
                wrapper += 'try{ if (typeof proveedoresAlert === "function") window.proveedoresAlert = proveedoresAlert; }catch(e){}\n';
                wrapper += 'try{ if (typeof proveedoresConfirm === "function") window.proveedoresConfirm = proveedoresConfirm; }catch(e){}\n';
                wrapper += 'try{ if (typeof mostrarNotificacionProveedor === "function") window.mostrarNotificacionProveedor = mostrarNotificacionProveedor; }catch(e){}\n';
                wrapper += 'try{ if (typeof mostrarNotificacionIngreso === "function") window.mostrarNotificacionIngreso = mostrarNotificacionIngreso; }catch(e){}\n';
                wrapper += '})();';
                
                const scriptElement = document.createElement('script');
                scriptElement.textContent = wrapper;
                document.body.appendChild(scriptElement);
                document.body.removeChild(scriptElement);
            } catch (error) {
                console.error('[app.js] Error al inyectar script del módulo:', error);
            }
        });

        // Esperar a que los scripts se ejecuten
        await new Promise(resolve => setTimeout(resolve, 100));

        // Ejecutar función de inicialización del módulo si existe
        if (window[initFunctionName]) {
            try { window[initFunctionName](); } catch (err) {  }
        } else {
        }

        appState.currentModule = moduleName;

    } catch (error) {
        document.getElementById('moduleContainer').innerHTML = `
            <div class="container">
                <div class="alert alert-danger">
                    <strong>Error:</strong> No se pudo cargar el módulo "${moduleName}".
                    ${error.message}
                </div>
            </div>
        `;
    }
}

/**
 * Convertir nombre de módulo a PascalCase
 */
function toPascalCase(str) {
    return str
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

/**
 * Recargar módulo actual
 */
function reloadCurrentModule() {
    if (appState.currentModule) {
        loadModule(appState.currentModule);
    }
}

// =====================================================
// UTILIDADES GLOBALES
// =====================================================

/**
 * Formatear número como moneda
 */
function formatCurrency(value) {
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

/**
 * Formatear fecha
 */
function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('es-EC', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

/**
 * Formatear fecha y hora
 */
function formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('es-EC', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Mostrar notificación toast
 */
function showToast(message, type = 'info', duration = 3000) {
    // Crear elemento toast si no existe
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(toastContainer);
    }

    // Crear toast
    const toast = document.createElement('div');
    toast.className = `alert alert-${type}`;
    toast.style.cssText = `
        min-width: 300px;
        animation: slideInRight 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    toast.innerHTML = message;

    toastContainer.appendChild(toast);

    // Eliminar después de la duración
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Confirmar acción
 */
async function confirmAction(message) {
    return await window.showCustomConfirm(message);
}

/**
 * Validar formato de cédula ecuatoriana
 */
function validarCedula(cedula) {
    if (cedula.length !== 10) return false;
    
    const provincia = parseInt(cedula.substring(0, 2));
    if (provincia < 1 || provincia > 24) return false;
    
    const digitos = cedula.split('').map(Number);
    const digitoVerificador = digitos[9];
    
    let suma = 0;
    for (let i = 0; i < 9; i++) {
        let digito = digitos[i];
        if (i % 2 === 0) {
            digito *= 2;
            if (digito > 9) digito -= 9;
        }
        suma += digito;
    }
    
    const residuo = suma % 10;
    const resultado = residuo === 0 ? 0 : 10 - residuo;
    
    return resultado === digitoVerificador;
}

/**
 * Validar formato de RUC ecuatoriano
 */
function validarRUC(ruc) {
    if (ruc.length !== 13) return false;
    
    // RUC debe terminar en 001
    if (!ruc.endsWith('001')) return false;
    
    // Los primeros 10 dígitos deben ser una cédula válida
    const cedula = ruc.substring(0, 10);
    return validarCedula(cedula);
}

/**
 * Debounce para búsquedas
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// =====================================================
// ACCESO RÁPIDO A SUPABASE
// =====================================================

/**
 * Cliente de Supabase global (definido en config.js)
 */
let db;

/**
 * Obtener cliente de Supabase (lazy loading)
 */
function getDB() {
    if (!db) {
        db = typeof getSupabaseClient === 'function' ? getSupabaseClient() : supabaseClient;
    }
    return db;
}

/**
 * Ejecutar consulta con manejo de errores
 */
async function executeQuery(queryFn) {
    try {
        const { data, error } = await queryFn();
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// =====================================================
// INICIALIZACIÓN DE LA APP
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // Inicializar referencia a Supabase client
    db = getDB();
    
    // Event listeners para navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const module = btn.getAttribute('data-module');
            if (module) {
                loadModule(module);
            }
        });
    });

    // Cargar módulo por defecto (punto de venta) cuando la app esté visible
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.id === 'appScreen' && 
                !mutation.target.classList.contains('hidden')) {
                loadModule('punto-venta');
                observer.disconnect();
            }
        });
    });

    observer.observe(document.getElementById('appScreen'), {
        attributes: true,
        attributeFilter: ['class']
    });

    // Agregar estilos para animaciones
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
});

// =====================================================
// SISTEMA DE MODALES PERSONALIZADOS GLOBALES
// =====================================================

/**
 * Muestra un modal de alerta personalizado
 */
function showCustomAlert(message, type = 'info', title = null) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('customModalOverlay');
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

// =====================================================
// EXPORTAR UTILIDADES GLOBALES
// =====================================================

window.app = {
    loadModule,
    reloadCurrentModule,
    updateNavbarCounter,
    formatCurrency,
    formatDate,
    formatDateTime,
    showToast,
    confirmAction,
    validarCedula,
    validarRUC,
    debounce,
    get db() { return getDB(); }, // Usar getter for lazy loading
    executeQuery,
    showCustomAlert,
    showCustomConfirm,
    showCustomPrompt
};

// Removed debug scroll helper and floating debug button

