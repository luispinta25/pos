// =====================================================
// Ferrisoluciones - Autenticación con Supabase
// Manejo de sesiones y roles de usuario
// =====================================================

// Estado de autenticación
let currentUser = null;
let userRole = null;
let userNombres = null;
let userApellidos = null;

// =====================================================
// FUNCIONES DE AUTENTICACIÓN
// =====================================================

/**
 * Obtener cliente de Supabase (lazy loading)
 */
function getSupabaseClient() {
    if (!supabaseClient) {
        initSupabase();
    }
    return supabaseClient;
}

/**
 * Inicializar autenticación al cargar la página
 */
async function initAuth() {
    const client = getSupabaseClient();
    if (!client) {
        showLogin();
        return;
    }

    try {
        // Verificar sesión actual
        const { data: { session } } = await client.auth.getSession();
        
        if (session) {
            currentUser = session.user;
            await loadUserRole();
            showApp();
        } else {
            showLogin();
        }
    } catch (error) {
        showLogin();
    }
}

/**
 * Cargar rol del usuario desde la base de datos
 */
async function loadUserRole() {
    const client = getSupabaseClient();
    try {
        const { data, error } = await client
            .from('ferre_usuarios_ferreteria')
            .select('rol, nombres, apellidos')
            .eq('user_id', currentUser.id)
            .single();

        if (error) {
            // Si no tiene rol asignado, asignar rol por defecto
            userRole = 'usuario';
            userNombres = currentUser.email.split('@')[0];
            userApellidos = '';
        } else {
            userRole = data.rol || 'usuario';
            userNombres = data.nombres || currentUser.email.split('@')[0];
            userApellidos = data.apellidos || '';
        }

        // Guardar en localStorage para acceso rápido
        localStorage.setItem('userRole', userRole);
        localStorage.setItem('userNombres', userNombres);
        localStorage.setItem('userApellidos', userApellidos);

    } catch (error) {
        userRole = 'usuario';
    }
}

/**
 * Login de usuario
 */
async function login(email, password) {
    const client = getSupabaseClient();
    try {
        const { data, error } = await client.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        currentUser = data.user;
        await loadUserRole();
        showApp();
        return { success: true };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Registro de nuevo usuario
 */
async function register(email, password, nombres, apellidos) {
    const client = getSupabaseClient();
    try {
        // Crear usuario en Supabase Auth
        const { data, error } = await client.auth.signUp({
            email: email,
            password: password
        });

        if (error) throw error;

        // Crear registro en tabla usuarios_ferreteria
        const { error: insertError } = await client
            .from('ferre_usuarios_ferreteria')
            .insert([
                {
                    user_id: data.user.id,
                    email: email,
                    nombres: nombres,
                    apellidos: apellidos,
                    rol: 'usuario' // Rol por defecto
                }
            ]);

        if (insertError) {
        }

        return { 
            success: true, 
            message: 'Cuenta creada exitosamente. Por favor inicia sesión.' 
        };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Cerrar sesión
 */
async function logout() {
    const client = getSupabaseClient();
    try {
        const { error } = await client.auth.signOut();
        if (error) throw error;

        // Limpiar estado
        currentUser = null;
        userRole = null;
        userNombres = null;
        userApellidos = null;
        localStorage.clear();

        showLogin();

    } catch (error) {
        await window.showCustomAlert('Error al cerrar sesión: ' + error.message, 'error');
    }
}

/**
 * Verificar si el usuario tiene un rol específico
 */
function hasRole(requiredRole) {
    if (!userRole) return false;
    
    const roleHierarchy = {
        'admin': 3,
        'contador': 2,
        'usuario': 1
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

// =====================================================
// FUNCIONES DE UI
// =====================================================

/**
 * Mostrar pantalla de login
 */
function showLogin() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appScreen').classList.add('hidden');
    document.body.classList.add('loaded');
}

/**
 * Mostrar aplicación principal
 */
function showApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');
    
    // Actualizar info de usuario en navbar
    document.getElementById('userName').textContent = `${userNombres} ${userApellidos}`;
    document.getElementById('userRole').textContent = userRole.toUpperCase();
    
    document.body.classList.add('loaded');
}

/**
 * Mostrar mensaje en pantalla de autenticación
 */
function showAuthMessage(message, type = 'error') {
    const messageDiv = document.getElementById('authMessage');
    messageDiv.textContent = message;
    messageDiv.className = `auth-message ${type}`;
    messageDiv.classList.remove('hidden');

    // Ocultar después de 5 segundos
    setTimeout(() => {
        messageDiv.classList.add('hidden');
    }, 5000);
}

// =====================================================
// EVENT LISTENERS
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // No ejecutar si estamos en un módulo personalizado (como Contabilidad)
    if (window.CONTABILIDAD_MODULE) {
        return;
    }
    
    // Inicializar autenticación
    initAuth();

    // Toggle entre login y registro
    document.getElementById('showRegister')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.remove('hidden');
        document.getElementById('authMessage').classList.add('hidden');
    });

    document.getElementById('showLogin')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('registerForm').classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('authMessage').classList.add('hidden');
    });

    // Formulario de login
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        const result = await login(email, password);
        
        if (!result.success) {
            showAuthMessage('Error al iniciar sesión: ' + result.error, 'error');
        }
    });

    // Formulario de registro
    document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nombres = document.getElementById('registerNombres').value;
        const apellidos = document.getElementById('registerApellidos').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

        // Validar que las contraseñas coincidan
        if (password !== passwordConfirm) {
            showAuthMessage('Las contraseñas no coinciden', 'error');
            return;
        }

        // Validar longitud de contraseña
        if (password.length < 6) {
            showAuthMessage('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }

        const result = await register(email, password, nombres, apellidos);
        
        if (result.success) {
            showAuthMessage(result.message, 'success');
            // Volver al formulario de login
            setTimeout(() => {
                document.getElementById('registerForm').classList.add('hidden');
                document.getElementById('loginForm').classList.remove('hidden');
                document.getElementById('registerForm').reset();
            }, 2000);
        } else {
            showAuthMessage('Error al crear cuenta: ' + result.error, 'error');
        }
    });

    // Botón de logout
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        const confirmed = await window.showCustomConfirm('¿Estás seguro de que deseas cerrar sesión?');
        if (confirmed) {
            logout();
        }
    });
});

// =====================================================
// EXPORTAR FUNCIONES GLOBALES
// =====================================================
window.auth = {
    getCurrentUser: () => currentUser,
    getUserEmail: () => currentUser?.email || null,
    getUserRole: () => userRole,
    getUserNombres: () => userNombres,
    getUserApellidos: () => userApellidos,
    hasRole: hasRole,
    logout: logout
};

