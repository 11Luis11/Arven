import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export let supabase = null;

export function initializeSupabase(url, key) {
  if (!url || !key) { supabase = null; return; }
  try {
    supabase = createClient(url, key);
  } catch (error) {
    console.error('Error al inicializar Supabase:', error);
    supabase = null;
  }
}

// Inicializar siempre con variables de entorno
initializeSupabase(supabaseUrl, supabaseAnonKey);

// ==========================================
// DATOS POR DEFECTO (solo para UI inicial si Supabase falla)
// ==========================================
const DEFAULT_CONFIG = {
  storeName: 'Carrillo Store',
  storeSlogan: 'Polos que reflejan tu estilo',
  storeLogoUrl: '',
  storeLogoDarkUrl: '',
  storeFaviconUrl: '',
  heroTitle: 'Polos que reflejan tu estilo',
  heroSubtitle: 'Diseño minimalista, materiales premium y caída perfecta para elevar tu vestimenta diaria.',
  bannerText: 'ENVÍOS GRATIS A TODO EL PAÍS POR COMPRAS MAYORES A S/.199',
  heroImages: [
    'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=1600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=1600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=1600&auto=format&fit=crop&q=80'
  ],
  selectedOffers: [],
  videos: [],
  testimonials: [],
  footer: {
    whatsapp: '+51 987 654 321',
    email: 'soporte@carrillostore.com',
    address: 'Av. Larco 123, Lima, Perú',
    facebookUrl: '#',
    instagramUrl: '#',
    tiktokUrl: '#'
  },
  cupons: []
};

// ==========================================
// CACHE EN MEMORIA para reducir llamadas a Supabase
// ==========================================
const _cache = {};
const CACHE_TTL = 30_000; // 30 segundos

function getCached(key) {
  const entry = _cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}
function setCache(key, data) {
  _cache[key] = { data, ts: Date.now() };
}
// Recalcula el stock TOTAL de un producto a partir del stock por color/variante.
// Si el producto no maneja colores, respeta el stock manual ingresado.
// Esta es la ÚNICA fuente de verdad para el stock total en toda la app.
function normalizeStock(product) {
  if (Array.isArray(product.colors) && product.colors.length > 0) {
    const realStock = product.colors.reduce((sum, c) => sum + (parseInt(c.stock) || 0), 0);
    return { ...product, stock: realStock };
  }
  return { ...product, stock: parseInt(product.stock) || 0 };
}

function invalidateCache(prefix) {
  if (prefix) {
    Object.keys(_cache).forEach(k => { if (k.startsWith(prefix)) delete _cache[k]; });
  } else {
    Object.keys(_cache).forEach(k => delete _cache[k]);
  }
}

// ==========================================
// REALTIME (solo Supabase channels) — con debounce
// ==========================================
// Un único canal compartido por toda la app: antes cada pantalla abría su propio
// canal y cada cambio disparaba N recargas en paralelo.
const _realtimeListeners = new Set();
let _realtimeChannel = null;
let _realtimeTimer = null;

function ensureRealtimeChannel() {
  if (_realtimeChannel || !supabase) return;
  _realtimeChannel = supabase
    .channel('realtime-app')
    .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
      invalidateCache();
      clearTimeout(_realtimeTimer);
      _realtimeTimer = setTimeout(() => {
        _realtimeListeners.forEach(cb => {
          try { cb({ key: payload.table }); } catch (e) { console.error(e); }
        });
      }, 300);
    })
    .subscribe();
}

export function subscribeToRealtime(callback) {
  if (!supabase) return () => {};
  _realtimeListeners.add(callback);
  ensureRealtimeChannel();
  return () => {
    _realtimeListeners.delete(callback);
    if (_realtimeListeners.size === 0 && _realtimeChannel) {
      clearTimeout(_realtimeTimer);
      supabase.removeChannel(_realtimeChannel);
      _realtimeChannel = null;
    }
  };
}

// Cliente secundario SIN sesión persistente: sirve para verificar credenciales
// de un administrador o crear cuentas sin cerrar la sesión del usuario actual.
function secondaryClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'sb-secondary-auth' }
  });
}

function rpcError(error, fallback) {
  return new Error(error?.message || fallback);
}

export const DataService = {
  isSupabaseEnabled() {
    return supabase !== null;
  },

  // --- AUTENTICACIÓN (Supabase Auth + tabla profiles) ---
  async getProfile(client, userId) {
    const { data, error } = await client.from('profiles').select('id, name, email, role, active').eq('id', userId).single();
    if (error) return null;
    return data;
  },

  async signIn(email, password) {
    if (!supabase) throw new Error('La base de datos no está configurada (revisa el archivo .env).');
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      if (/invalid login credentials/i.test(error.message)) throw new Error('Correo o contraseña incorrectos.');
      if (/email not confirmed/i.test(error.message)) throw new Error('Esta cuenta aún no confirmó su correo.');
      throw new Error(error.message);
    }
    const profile = await this.getProfile(supabase, data.user.id);
    if (!profile || !profile.active) {
      await supabase.auth.signOut();
      throw new Error('Tu cuenta está pendiente de activación por un administrador.');
    }
    invalidateCache();
    return profile;
  },

  async signOut() {
    if (supabase) await supabase.auth.signOut();
    invalidateCache();
  },

  // Perfil de la sesión actual (null si no hay sesión válida o está desactivada)
  async getSessionProfile() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    const user = data?.session?.user;
    if (!user) return null;
    const profile = await this.getProfile(supabase, user.id);
    return profile && profile.active ? profile : null;
  },

  onAuthChange(callback) {
    if (!supabase) return () => {};
    const { data } = supabase.auth.onAuthStateChange((event) => callback(event));
    return () => data.subscription.unsubscribe();
  },

  // Verifica credenciales de un ADMINISTRADOR sin tocar la sesión actual
  // (autorización de apertura/cierre de caja pedida por un colaborador).
  async verifyAdmin(email, password) {
    if (!supabase) return null;
    const client = secondaryClient();
    const { data, error } = await client.auth.signInWithPassword({ email: (email || '').trim().toLowerCase(), password });
    if (error || !data?.user) return null;
    try {
      const profile = await this.getProfile(client, data.user.id);
      return profile && profile.active && profile.role === 'admin' ? profile : null;
    } finally {
      await client.auth.signOut();
    }
  },

  async changeOwnPassword(currentPassword, newPassword) {
    const { data } = await supabase.auth.getUser();
    const email = data?.user?.email;
    if (!email) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
    const client = secondaryClient();
    const { error: checkErr } = await client.auth.signInWithPassword({ email, password: currentPassword });
    if (checkErr) throw new Error('La contraseña actual es incorrecta.');
    await client.auth.signOut();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(`No se pudo cambiar la contraseña: ${error.message}`);
  },

  // --- USUARIOS DEL PANEL ---
  async listUsers() {
    if (!supabase) return [];
    const { data, error } = await supabase.from('profiles').select('id, name, email, role, active, created_at').order('created_at');
    if (error) throw new Error(`No se pudieron cargar los usuarios: ${error.message}`);
    return data || [];
  },

  async createUser({ name, email, password, role }) {
    if (!supabase) throw new Error('La base de datos no está configurada.');
    const cleanEmail = email.trim().toLowerCase();

    // 1) Vía recomendada: función del servidor (migración 003). Crea la cuenta
    //    ya confirmada, sin enviar correos y sin abrir el registro público.
    const { data: created, error: rpcErr } = await supabase.rpc('admin_create_user', {
      p_email: cleanEmail, p_password: password, p_name: name, p_role: role
    });
    if (!rpcErr) return created;
    const missingFn = rpcErr.code === 'PGRST202' || /could not find the function/i.test(rpcErr.message || '');
    if (!missingFn) throw new Error(rpcErr.message || 'No se pudo crear la cuenta.');

    // 2) Respaldo (si aún no se ejecutó la migración 003): registro público de Supabase
    const client = secondaryClient();
    const { data, error } = await client.auth.signUp({ email: cleanEmail, password, options: { data: { name } } });
    if (error) {
      if (/rate limit/i.test(error.message)) {
        throw new Error('Supabase bloqueó el envío de correos de confirmación (límite por hora). Ejecuta supabase/migrations/003_usuarios_sin_correo.sql para crear usuarios sin correo.');
      }
      if (/signups? not allowed|signup is disabled/i.test(error.message)) {
        throw new Error('El registro está desactivado. Ejecuta supabase/migrations/003_usuarios_sin_correo.sql para crear usuarios desde el panel.');
      }
      if (/already registered/i.test(error.message)) throw new Error('Ya existe una cuenta con este correo.');
      throw new Error(`No se pudo crear la cuenta: ${error.message}`);
    }
    // Supabase devuelve identities vacío cuando el correo ya existía
    if (!data?.user || (Array.isArray(data.user.identities) && data.user.identities.length === 0)) {
      throw new Error('Ya existe una cuenta con este correo.');
    }
    const needsConfirmation = !data.session;
    if (data.session) await client.auth.signOut();
    const { data: profile, error: upErr } = await supabase.from('profiles')
      .update({ name, role, active: true }).eq('id', data.user.id).select().single();
    if (upErr) throw new Error(`Cuenta creada, pero no se pudo activar: ${upErr.message}`);
    if (needsConfirmation) {
      throw new Error('La cuenta se creó, pero Supabase exige confirmar el correo antes de entrar. Ejecuta supabase/migrations/003_usuarios_sin_correo.sql (confirma las cuentas pendientes) o desactiva "Confirm email".');
    }
    return profile;
  },

  async setUserPassword(userId, password) {
    const { error } = await supabase.rpc('admin_set_password', { p_user_id: userId, p_password: password });
    if (error) {
      if (error.code === 'PGRST202') throw new Error('Ejecuta supabase/migrations/003_usuarios_sin_correo.sql para poder restablecer contraseñas.');
      throw new Error(error.message);
    }
  },

  async updateUser(id, patch) {
    const allowed = {};
    ['name', 'role', 'active'].forEach(k => { if (k in patch) allowed[k] = patch[k]; });
    const { data, error } = await supabase.from('profiles').update(allowed).eq('id', id).select().single();
    if (error) throw new Error(`No se pudo actualizar el usuario: ${error.message}`);
    return data;
  },

  async testSupabaseConnection(url, key) {
    if (!url || !key) return { success: false, message: 'URL o Key no proporcionados.' };
    try {
      const client = createClient(url, key);
      const { error } = await client.from('config').select('*').limit(1);
      if (error) return { success: false, message: `Error de Supabase: ${error.message} (Código ${error.code})` };
      return { success: true, message: 'Conexión exitosa. Base de datos vinculada.' };
    } catch (err) {
      return { success: false, message: `Fallo de red o credencial: ${err.message}` };
    }
  },

  async getCredentials() {
    return {
      url: import.meta.env.VITE_SUPABASE_URL || '',
      key: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    };
  },

  // Mantener compatibilidad con Config.jsx (panel de BD)
  async saveCredentials(url, key) {
    // Con .env las credenciales son fijas; esta función no hace nada
    initializeSupabase(url || supabaseUrl, key || supabaseAnonKey);
    return true;
  },

  // --- CONFIGURACIÓN DE TIENDA ---
  async getConfig() {
    const cached = getCached('config');
    if (cached) return cached;
    if (supabase) {
      try {
        const { data, error } = await supabase.from('config').select('value').eq('key', 'config').single();
        if (!error && data) {
          const { users: _legacyUsers, ...value } = data.value || {}; // eslint-disable-line no-unused-vars
          const result = { ...DEFAULT_CONFIG, ...value };
          setCache('config', result);
          return result;
        }
      } catch (e) {
        console.error('Error al obtener config de Supabase:', e);
      }
    }
    return DEFAULT_CONFIG;
  },

  async saveConfig(newConfig) {
    // Las cuentas viven en Supabase Auth: nunca guardar usuarios/contraseñas en config
    const { users: _users, ...rest } = newConfig || {}; // eslint-disable-line no-unused-vars
    const updated = { ...DEFAULT_CONFIG, ...rest };
    if (supabase) {
      const { error } = await supabase.from('config').upsert({ key: 'config', value: updated });
      if (error) {
        console.error('Error al guardar config en Supabase:', error);
        invalidateCache('config');
        throw new Error(`No se pudo guardar la configuración: ${error.message}`);
      }
    }
    invalidateCache('config');
    // Avisar a toda la app (menú del panel, tienda) para que use la config nueva al instante
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('store-config-updated', { detail: updated }));
    return updated;
  },

  // --- CATEGORÍAS ---
  async getCategories() {
    const cached = getCached('categories');
    if (cached) return cached;
    if (supabase) {
      try {
        const { data, error } = await supabase.from('categories').select('*');
        if (!error && data) { setCache('categories', data); return data; }
      } catch (e) {
        console.error('Error al obtener categorías de Supabase:', e);
      }
    }
    return [];
  },

  async saveCategory(category) {
    let updatedCategory = { ...category };
    if (!category.id) {
      updatedCategory.id = 'cat-' + Math.random().toString(36).substr(2, 9);
      if (!updatedCategory.slug) {
        updatedCategory.slug = updatedCategory.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      }
    }
    if (supabase) {
      const { data, error } = await supabase.from('categories').upsert(updatedCategory).select().single();
      invalidateCache('categories');
      if (error) throw new Error(`No se pudo guardar la categoría: ${error.message}`);
      if (data) return data;
    }
    invalidateCache('categories');
    return updatedCategory;
  },

  async deleteCategory(id) {
    if (supabase) {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw new Error(`No se pudo eliminar la categoría: ${error.message}`);
    }
    invalidateCache('categories');
    return true;
  },

  // --- PRODUCTOS ---
  async getProducts() {
    const cached = getCached('products');
    if (cached) return cached;
    if (supabase) {
      try {
        const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          // Normaliza el stock: si el producto tiene colores/variantes, el stock TOTAL
          // siempre debe ser la suma exacta del stock de cada color. Esto evita que
          // el número mostrado en Inventario/Productos/POS quede desincronizado del
          // stock real por variante (fuente de la verdad).
          const normalized = data.map(p => normalizeStock(p));
          setCache('products', normalized);
          return normalized;
        }
      } catch (e) {
        console.error('Error al obtener productos de Supabase:', e);
      }
    }
    return [];
  },

  async saveProduct(product) {
    let updatedProduct = { ...product };
    if (!updatedProduct.images || updatedProduct.images.length === 0) {
      updatedProduct.images = [updatedProduct.image_url];
    }
    if (!product.id) {
      updatedProduct.id = 'prod-' + Math.random().toString(36).substr(2, 9);
      updatedProduct.created_at = new Date().toISOString();
    }

    if (supabase) {
      try {
        // El stock total SIEMPRE se recalcula a partir del stock por color/variante
        // cuando el producto tiene colores definidos. Así ninguna pantalla puede
        // guardar un stock total "manual" que no coincida con la suma real.
        const normalizedProduct = normalizeStock(updatedProduct);
        const payload = {
          id: normalizedProduct.id,
          category_id: normalizedProduct.category_id,
          name: normalizedProduct.name,
          sku: normalizedProduct.sku,
          description: normalizedProduct.description,
          price: parseFloat(normalizedProduct.price) || 0,
          offer_price: normalizedProduct.offer_price !== null ? parseFloat(normalizedProduct.offer_price) : null,
          wholesale_price: normalizedProduct.wholesale_price !== null ? parseFloat(normalizedProduct.wholesale_price) : null,
          wholesale_min_qty: parseInt(normalizedProduct.wholesale_min_qty) || 6,
          wholesale_tiers: normalizedProduct.wholesale_tiers || [],
          stock: normalizedProduct.stock,
          image_url: normalizedProduct.image_url,
          images: normalizedProduct.images,
          colors: normalizedProduct.colors || [],
          sizes: normalizedProduct.sizes || [],
          active: normalizedProduct.active,
          created_at: normalizedProduct.created_at,
          updated_at: new Date().toISOString()
        };
        const { error } = await supabase.from('products').upsert(payload);
        if (error) {
          throw new Error(error.message || 'Error desconocido al guardar en Supabase.');
        }
        invalidateCache('products');
        return payload;
      } catch (e) {
        console.error('Error al guardar producto en Supabase:', e);
        throw e;
      }
    }
    invalidateCache('products');
    return updatedProduct;
  },

  async deleteProduct(id) {
    if (supabase) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      invalidateCache('products');
      if (error) throw new Error(`No se pudo eliminar el producto: ${error.message}`);
    }
    invalidateCache('products');
    return true;
  },

  // --- CLIENTES ---
  async getCustomers() {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('customers').select('*');
        if (!error && data) return data;
      } catch (e) {
        console.error('Error al obtener clientes de Supabase:', e);
      }
    }
    return [];
  },

  async saveCustomer(customer) {
    let updatedCustomer = { ...customer };
    if (!customer.id) {
      updatedCustomer.id = 'cust-' + Math.random().toString(36).substr(2, 9);
    }
    if (supabase) {
      const { data, error } = await supabase.from('customers').upsert(updatedCustomer).select().single();
      if (error) {
        console.error('Error al guardar cliente en Supabase:', error);
        throw new Error(`No se pudo guardar el cliente: ${error.message}`);
      }
      if (data) return data;
    }
    return updatedCustomer;
  },

  async deleteCustomer(id) {
    if (supabase) {
      try {
        const { error } = await supabase.from('customers').delete().eq('id', id);
        if (error) throw error;
      } catch (e) {
        console.error('Error al eliminar cliente de Supabase:', e);
        throw e;
      }
    }
    return true;
  },

  // --- CAJA REGISTRADORA ---
  async getCashRegister() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('cash_sessions')
          .select('*')
          .order('opened_at', { ascending: false });
        if (!error && data) {
          const open = data.find(s => s.status === 'open');
          return {
            status: open ? 'open' : 'closed',
            currentSession: open || null,
            history: data.filter(s => s.status === 'closed')
          };
        }
      } catch (e) {
        console.error('Error al obtener caja de Supabase:', e);
      }
    }
    return { status: 'closed', currentSession: null, history: [] };
  },

  async openCashRegister(initialAmount, operator = 'Administrador', authorizedBy = 'Administrador') {
    // Evita abrir dos cajas a la vez (doble clic o dos terminales)
    const existing = await this.getCashRegister();
    if (existing.status === 'open' && existing.currentSession) return existing;
    const newSession = {
      id: 'session-' + Math.random().toString(36).substr(2, 9),
      opened_at: new Date().toISOString(),
      opened_by: operator,
      authorized_by: authorizedBy,
      initial_amount: parseFloat(initialAmount) || 0,
      theoretical_amount: parseFloat(initialAmount) || 0,
      status: 'open',
    };
    if (supabase) {
      const { error } = await supabase.from('cash_sessions').insert(newSession);
      if (error?.code === '23505') return this.getCashRegister(); // otra terminal ya la abrió
      if (error) throw new Error(`No se pudo abrir la caja: ${error.message}`);
    }
    await this.addCashMovement(newSession.id, 'income', initialAmount, 'Apertura de Caja', operator);
    await this.addActionLog(`Apertura de caja con fondo S/. ${(parseFloat(initialAmount) || 0).toFixed(2)} por ${operator} (Autorizado por ${authorizedBy})`, operator);
    return { status: 'open', currentSession: newSession, history: [] };
  },

  async closeCashRegister(realAmount, operator = 'Administrador', authorizedBy = 'Administrador') {
    const register = await this.getCashRegister();
    if (register.status !== 'open' || !register.currentSession) return register;
    const session = register.currentSession;
    const real = parseFloat(realAmount) || 0;
    const theoretical = parseFloat(session.theoretical_amount) || 0;
    const difference = real - theoretical;
    const closedSession = {
      ...session,
      closed_at: new Date().toISOString(),
      closed_by: operator,
      closed_authorized_by: authorizedBy,
      real_amount: real,
      difference,
      status: 'closed',
    };
    if (supabase) {
      const { error } = await supabase.from('cash_sessions').update({
          closed_at: closedSession.closed_at,
          closed_by: closedSession.closed_by,
          closed_authorized_by: closedSession.closed_authorized_by,
          real_amount: closedSession.real_amount,
          difference: closedSession.difference,
          status: 'closed'
        }).eq('id', session.id);
      if (error) throw new Error(`No se pudo cerrar la caja: ${error.message}`);
    }
    let diffText = 'Cuadrada';
    if (difference > 0) diffText = `Sobrante de S/. ${difference.toFixed(2)}`;
    if (difference < 0) diffText = `Faltante de S/. ${Math.abs(difference).toFixed(2)}`;
    await this.addActionLog(`Cierre de caja de ${operator}: Real S/. ${real.toFixed(2)}, Teórico S/. ${theoretical.toFixed(2)} (${diffText}) - Autorizado por ${authorizedBy}`, operator);
    return { status: 'closed', currentSession: null, history: [closedSession] };
  },

  async addCashMovement(sessionId, type, amount, description, user = 'Administrador') {
    if (!supabase) return null;
    // El monto teórico se actualiza en el servidor de forma atómica
    const { data, error } = await supabase.rpc('add_cash_movement', {
      p_session_id: sessionId,
      p_type: type,
      p_amount: parseFloat(amount) || 0,
      p_description: description,
      p_user: user
    });
    if (error) throw rpcError(error, 'No se pudo registrar el movimiento de caja.');
    return data;
  },

  async getCashMovements(sessionId) {
    if (supabase) {
      try {
        let query = supabase.from('cash_movements').select('*').order('created_at', { ascending: false });
        if (sessionId) query = query.eq('cash_register_id', sessionId);
        const { data, error } = await query;
        if (!error && data) return data;
      } catch (e) {
        console.error('Error al obtener movimientos de Supabase:', e);
      }
    }
    return [];
  },

  // --- VENTAS ---
  async getSales() {
    if (supabase) {
      try {
        // Sin filtro por operador: devuelve ventas de TODOS los colaboradores
        const { data, error } = await supabase.from('sales').select('*').order('created_at', { ascending: false });
        if (!error && data) return data;
      } catch (e) {
        console.error('Error al obtener ventas de Supabase:', e);
      }
    }
    return [];
  },

  async getSaleItems(saleId) {
    if (supabase) {
      try {
        let query = supabase.from('sale_items').select('*');
        if (saleId) query = query.eq('sale_id', saleId);
        const { data, error } = await query;
        if (!error && data) return data;
      } catch (e) {
        console.error('Error al obtener items de venta de Supabase:', e);
      }
    }
    return [];
  },

  async createSale(saleData) {
    if (!supabase) throw new Error('La base de datos no está configurada.');
    // Todo ocurre en una transacción del servidor: correlativo por secuencia,
    // detalle, descuento de stock con bloqueo de fila y movimiento de caja.
    const p_sale = {
      customer_id: saleData.customer_id || null,
      customer_name: saleData.customer_name,
      customer_document: saleData.customer_document,
      total_amount: parseFloat(saleData.total_amount) || 0,
      discount_amount: parseFloat(saleData.discount_amount) || 0,
      payment_method: saleData.payment_method || 'Efectivo',
      document_type: saleData.document_type || 'Boleta',
      operator: saleData.operator || 'Sistema',
      type: saleData.type || 'pos'
    };
    const p_items = (saleData.items || []).map(item => ({
      product_id: item.product_id,
      product_name: item.product_name || 'Producto',
      quantity: item.quantity,
      unit_price: item.unit_price,
      color_hex: item.color_hex || null,
      selected_size: item.selected_size || null,
      // Datos para el comprobante detallado (reimpresiones iguales al original)
      sku: item.sku || null,
      base_name: item.base_name || null,
      color_name: item.color_name || null,
      list_price: item.list_price ?? null,
      promo_label: item.promo_label || null
    }));
    const { data, error } = await supabase.rpc('create_sale', { p_sale, p_items });
    if (error) throw rpcError(error, 'No se pudo registrar la venta.');
    invalidateCache('products');
    return data;
  },

  async voidSale(saleId, operator = 'Administrador') {
    if (!supabase) throw new Error('La base de datos no está configurada.');
    const { data, error } = await supabase.rpc('void_sale', { p_sale_id: saleId, p_operator: operator });
    if (error) throw rpcError(error, 'No se pudo anular la venta.');
    invalidateCache('products');
    return data;
  },

  async exchangeProduct(saleId, itemId, newProductId, newColorHex, newColorName, newSize, operator = 'Administrador', exchangeQty = 1) {
    if (supabase) {
      try {
        // 1. Obtener el item de venta actual
        const { data: item, error: itemErr } = await supabase.from('sale_items').select('*').eq('id', itemId).single();
        if (itemErr || !item) throw new Error('No se encontró el item de la venta.');

        const qtyToExchange = Math.min(item.quantity, parseInt(exchangeQty) || 1);

        // 2-3. Devolver la prenda original y descontar la nueva, de forma atómica en el servidor
        const { data: newProd, error: newProdErr } = await supabase.from('products').select('*').eq('id', newProductId).single();
        if (newProdErr || !newProd) throw new Error('No se encontró el producto nuevo para el cambio.');

        const { error: backErr } = await supabase.rpc('apply_stock', {
          p_items: [{ product_id: item.product_id, quantity: qtyToExchange, color_hex: item.color_hex, selected_size: item.selected_size }],
          p_sign: 1
        });
        if (backErr) throw new Error(`No se pudo devolver el stock: ${backErr.message}`);
        const { error: outErr } = await supabase.rpc('apply_stock', {
          p_items: [{ product_id: newProductId, quantity: qtyToExchange, color_hex: newColorHex || null, selected_size: newSize || null }],
          p_sign: -1
        });
        if (outErr) throw new Error(`No se pudo descontar el stock: ${outErr.message}`);

        // 3b. Obtener el precio del nuevo producto para la talla seleccionada
        const newSizePrices = (newProd.wholesale_tiers || []).find(t => t.type === 'size_prices')?.data || {};
        const newSizeData = newSizePrices[newSize] || {};
        const newRegularPrice = (newSizeData.price && newSizeData.price !== '')
          ? parseFloat(newSizeData.price)
          : (newProd.offer_price !== null ? parseFloat(newProd.offer_price) : parseFloat(newProd.price));

        const newActivePrice = (newSizeData.offer_price && newSizeData.offer_price !== '')
          ? parseFloat(newSizeData.offer_price)
          : newRegularPrice;

        // Calcular la diferencia de precio TOTAL para el cambio
        const originalUnitPrice = parseFloat(item.unit_price) || 0;
        const priceDiff = (newActivePrice - originalUnitPrice) * qtyToExchange;

        // 4. Actualizar el registro del item en la venta (sale_items)
        if (item.quantity > qtyToExchange) {
          // Decrementar la cantidad del item original
          await supabase.from('sale_items').update({
            quantity: item.quantity - qtyToExchange,
            total_price: (item.quantity - qtyToExchange) * originalUnitPrice
          }).eq('id', itemId);

          // Crear un nuevo registro para la prenda cambiada (con cantidad = qtyToExchange y el precio de la nueva prenda)
          const newItemId = 'item-' + Math.random().toString(36).substr(2, 9);
          const newItemPayload = {
            id: newItemId,
            sale_id: saleId,
            product_id: newProductId,
            product_name: `${newProd.name} (${newColorName || 'Sin Color'}, ${newSize || 'Sin Talla'}) [CAMBIO]`,
            quantity: qtyToExchange,
            unit_price: newActivePrice,
            total_price: newActivePrice * qtyToExchange,
            color_hex: newColorHex || null,
            selected_size: newSize || null
          };
          await supabase.from('sale_items').insert(newItemPayload);
        } else {
          // Si cambiamos toda la cantidad, actualizamos la fila existente
          const updatedItem = {
            product_id: newProductId,
            product_name: `${newProd.name} (${newColorName || 'Sin Color'}, ${newSize || 'Sin Talla'}) [CAMBIO]`,
            selected_size: newSize || null,
            color_hex: newColorHex || null,
            unit_price: newActivePrice,
            total_price: newActivePrice * qtyToExchange
          };
          await supabase.from('sale_items').update(updatedItem).eq('id', itemId);
        }

        // 4b. Obtener la venta actual para actualizar su total
        const { data: sale, error: saleErr } = await supabase.from('sales').select('*').eq('id', saleId).single();
        if (saleErr || !sale) throw new Error('No se encontró la venta para actualizar el total.');

        const newTotalAmount = Math.max(0, parseFloat(sale.total_amount) + priceDiff);

        // 4c. Marcar la venta como cambiada y actualizar total_amount en la tabla sales
        await supabase.from('sales').update({
          status: 'exchanged',
          total_amount: newTotalAmount
        }).eq('id', saleId);

        // 4d. Registrar movimiento de caja por diferencia si corresponde
        const register = await this.getCashRegister();
        if (sale.type === 'pos' && register.status === 'open' && register.currentSession && sale.payment_method === 'Efectivo' && priceDiff !== 0) {
          const isIncome = priceDiff > 0;
          await this.addCashMovement(
            register.currentSession.id,
            isIncome ? 'income' : 'expense',
            Math.abs(priceDiff),
            `CAMBIO DE PRODUCTO EN VENTA ${sale.invoice_number} (${isIncome ? 'Cobro Extra' : 'Devolución'})`,
            operator
          );
        }

        // Obtener datos del comprobante para la bitácora
        const invoiceNum = sale ? sale.invoice_number : `#${saleId.slice(-5)}`;
        await this.addActionLog(
          `Realizó cambio en Venta ${invoiceNum}: ${qtyToExchange}x ${item.product_name} ➔ ${newProd.name} (${newColorName || 'Sin Color'}, ${newSize || 'Sin Talla'}). Dif: S/. ${priceDiff.toFixed(2)}`,
          operator
        );

        invalidateCache('products');
        invalidateCache('sales');
        return { success: true };
      } catch (err) {
        console.error('Error al realizar cambio de producto:', err);
        throw err;
      }
    }
    return { success: false, message: 'Supabase no inicializado.' };
  },

  // --- BITÁCORA ---
  async getActionLogs() {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('action_logs').select('*').order('timestamp', { ascending: false });
        if (!error && data) return data;
      } catch (e) {
        console.error('Error al obtener logs de Supabase:', e);
      }
    }
    return [];
  },

  async addActionLog(action, user = 'Sistema') {
    const newLog = {
      id: 'log-' + Math.random().toString(36).substr(2, 9),
      user,
      action,
      timestamp: new Date().toISOString()
    };
    if (supabase) {
      try {
        await supabase.from('action_logs').insert(newLog);
      } catch (e) {
        console.error('Error al guardar log en Supabase:', e);
      }
    }
    return newLog;
  },

  // --- COLORES PREFERIDOS ---
  async getPreferredColors() {
    const config = await this.getConfig();
    return config.preferredColors || [];
  },

  async addPreferredColor(color) {
    const config = await this.getConfig();
    const list = config.preferredColors || [];
    if (!list.some(c => c.hex.toLowerCase() === color.hex.toLowerCase())) {
      const updatedList = [...list, color];
      await this.saveConfig({ ...config, preferredColors: updatedList });
      return updatedList;
    }
    return list;
  },

  async deletePreferredColor(hex) {
    const config = await this.getConfig();
    const list = config.preferredColors || [];
    const updatedList = list.filter(c => c.hex.toLowerCase() !== hex.toLowerCase());
    await this.saveConfig({ ...config, preferredColors: updatedList });
    return updatedList;
  },

  // --- COMPROBANTES PDF (para enviarlos por WhatsApp) ---
  async uploadReceipt(file) {
    if (!supabase) throw new Error('La base de datos no está configurada.');
    const fileName = `receipts/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.pdf`;
    const { error } = await supabase.storage
      .from('store-media')
      .upload(fileName, file, { cacheControl: '3600', upsert: false, contentType: 'application/pdf' });
    if (error) throw new Error(`No se pudo subir el comprobante: ${error.message}`);
    return supabase.storage.from('store-media').getPublicUrl(fileName).data.publicUrl;
  },

  // --- IMÁGENES (Supabase Storage) ---
  async uploadImage(file) {
    if (supabase && file instanceof File) {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
      const { data, error } = await supabase.storage
        .from('store-media')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      
      if (error) {
        if (error.message && error.message.toLowerCase().includes('bucket not found')) {
          throw new Error('El bucket "store-media" no existe en tu Supabase. Por favor, ve a la sección "Storage" de tu panel de Supabase, crea un nuevo bucket llamado "store-media" y márcalo como público (Public Bucket).');
        }
        throw new Error(`Error de Supabase Storage: ${error.message || 'No se pudo subir la foto.'}`);
      }
      
      if (data) {
        const { data: urlData } = supabase.storage.from('store-media').getPublicUrl(fileName);
        return urlData.publicUrl;
      }
    }
    throw new Error('Supabase no está inicializado o el archivo es inválido.');
  }
};
