// =====================================================
// FERRESOLUCIONES - Configuración de Supabase
// =====================================================

const SUPABASE_URL = 'https://lpsupabase.manasakilla.com';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.mKBTuXoyxw3lXRGl1VpSlGbSeiMnRardlIx1q5n-o0k';

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
