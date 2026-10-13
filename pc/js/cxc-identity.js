(function () {
    function normalizar(documento) {
        const value = String(documento || '').trim();
        if (!/^(\d{10}|\d{13})$/.test(value)) throw new Error('Ingresa una cedula de 10 digitos o RUC de 13 digitos.');
        return /^\d{2}[0-5]\d{7}001$/.test(value) ? value.slice(0, 10) : value;
    }
    async function buscar(db, documento) {
        const { data, error } = await db.from('ferre_deudores').select('*').eq('identidad_cxc', normalizar(documento)).maybeSingle();
        if (error) throw error;
        return data;
    }
    window.cxcIdentidad = { normalizar, buscar };
})();
