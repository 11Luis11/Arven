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
  users: [
    { id: 'u-1', name: 'Administrador Principal', email: 'admin@carrillostore.com', role: 'admin' }
  ],
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
export function subscribeToRealtime(callback) {
  if (!supabase) return () => {};

  let debounceTimer = null;
  const debouncedCb = (payload) => {
    // Invalidar caché al recibir cambios
    invalidateCache();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => callback(payload), 300);
  };

  const channelName = 'realtime-' + Math.random().toString(36).substr(2, 9);
  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
      debouncedCb({ key: payload.table });
    })
    .subscribe();

  return () => {
    clearTimeout(debounceTimer);
    supabase.removeChannel(channel);
  };
}

export const DataService = {
  isSupabaseEnabled() {
    return supabase !== null;
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
          const result = { ...DEFAULT_CONFIG, ...data.value };
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
    const updated = { ...DEFAULT_CONFIG, ...newConfig };
    if (supabase) {
      try {
        await supabase.from('config').upsert({ key: 'config', value: updated });
      } catch (e) {
        console.error('Error al guardar config en Supabase:', e);
      }
    }
    invalidateCache('config');
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
      try {
        const { data, error } = await supabase.from('categories').upsert(updatedCategory).select().single();
        if (!error && data) { invalidateCache('categories'); return data; }
      } catch (e) {
        console.error('Error al guardar categoría en Supabase:', e);
      }
    }
    invalidateCache('categories');
    return updatedCategory;
  },

  async deleteCategory(id) {
    if (supabase) {
      try {
        await supabase.from('categories').delete().eq('id', id);
      } catch (e) {
        console.error('Error al eliminar categoría de Supabase:', e);
      }
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
        if (!error && data) { setCache('products', data); return data; }
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
        const payload = {
          id: updatedProduct.id,
          category_id: updatedProduct.category_id,
          name: updatedProduct.name,
          sku: updatedProduct.sku,
          description: updatedProduct.description,
          price: parseFloat(updatedProduct.price) || 0,
          offer_price: updatedProduct.offer_price !== null ? parseFloat(updatedProduct.offer_price) : null,
          wholesale_price: updatedProduct.wholesale_price !== null ? parseFloat(updatedProduct.wholesale_price) : null,
          wholesale_min_qty: parseInt(updatedProduct.wholesale_min_qty) || 6,
          wholesale_tiers: updatedProduct.wholesale_tiers || [],
          stock: parseInt(updatedProduct.stock) || 0,
          image_url: updatedProduct.image_url,
          images: updatedProduct.images,
          colors: updatedProduct.colors || [],
          sizes: updatedProduct.sizes || [],
          active: updatedProduct.active,
          created_at: updatedProduct.created_at,
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
      try {
        await supabase.from('products').delete().eq('id', id);
      } catch (e) {
        console.error('Error al eliminar producto de Supabase:', e);
      }
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
      try {
        const { data, error } = await supabase.from('customers').upsert(updatedCustomer).select().single();
        if (!error && data) return data;
      } catch (e) {
        console.error('Error al guardar cliente en Supabase:', e);
      }
    }
    return updatedCustomer;
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
      try {
        await supabase.from('cash_sessions').insert(newSession);
      } catch (e) {
        console.error('Error al abrir caja en Supabase:', e);
      }
    }
    await this.addCashMovement(newSession.id, 'income', initialAmount, 'Apertura de Caja', operator);
    await this.addActionLog(`Apertura de caja con fondo S/. ${parseFloat(initialAmount).toFixed(2)} por ${operator} (Autorizado por ${authorizedBy})`, operator);
    return { status: 'open', currentSession: newSession, history: [] };
  },

  async closeCashRegister(realAmount, operator = 'Administrador', authorizedBy = 'Administrador') {
    const register = await this.getCashRegister();
    if (register.status !== 'open' || !register.currentSession) return register;
    const session = register.currentSession;
    const real = parseFloat(realAmount) || 0;
    const difference = real - session.theoretical_amount;
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
      try {
        await supabase.from('cash_sessions').update({
          closed_at: closedSession.closed_at,
          closed_by: closedSession.closed_by,
          closed_authorized_by: closedSession.closed_authorized_by,
          real_amount: closedSession.real_amount,
          difference: closedSession.difference,
          status: 'closed'
        }).eq('id', session.id);
      } catch (e) {
        console.error('Error al cerrar caja en Supabase:', e);
      }
    }
    let diffText = 'Cuadrada';
    if (difference > 0) diffText = `Sobrante de S/. ${difference.toFixed(2)}`;
    if (difference < 0) diffText = `Faltante de S/. ${Math.abs(difference).toFixed(2)}`;
    await this.addActionLog(`Cierre de caja de ${operator}: Real S/. ${real.toFixed(2)}, Teórico S/. ${session.theoretical_amount.toFixed(2)} (${diffText}) - Autorizado por ${authorizedBy}`, operator);
    return { status: 'closed', currentSession: null, history: [closedSession] };
  },

  async addCashMovement(sessionId, type, amount, description, user = 'Administrador') {
    const newMovement = {
      id: 'mov-' + Math.random().toString(36).substr(2, 9),
      cash_register_id: sessionId,
      type,
      amount: parseFloat(amount) || 0,
      description,
      created_by: user,
      created_at: new Date().toISOString(),
    };
    if (supabase) {
      try {
        await supabase.from('cash_movements').insert(newMovement);
        // Actualizar monto teórico de la sesión si está abierta
        if (description !== 'Apertura de Caja') {
          const change = type === 'income' ? parseFloat(amount) : -parseFloat(amount);
          const { data: sess } = await supabase.from('cash_sessions').select('theoretical_amount').eq('id', sessionId).single();
          if (sess) {
            await supabase.from('cash_sessions').update({
              theoretical_amount: (sess.theoretical_amount || 0) + change
            }).eq('id', sessionId);
          }
        }
      } catch (e) {
        console.error('Error al guardar movimiento en Supabase:', e);
      }
    }
    return newMovement;
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
    const allSales = await this.getSales();
    const isFactura = saleData.document_type === 'Factura';
    const isTicket = saleData.document_type === 'Sin Datos';
    const prefix = isFactura ? 'FFF1' : isTicket ? 'TTT1' : 'BBB1';
    const seriesNumber = String(allSales.length + 1).padStart(6, '0');
    const invoiceNumber = `${prefix}-${seriesNumber}`;
    const saleId = 'sale-' + Math.random().toString(36).substr(2, 9);

    const newSale = {
      id: saleId,
      invoice_number: invoiceNumber,
      customer_id: saleData.customer_id || null,
      customer_name: saleData.customer_name || 'Cliente Genérico',
      customer_document: saleData.customer_document || '00000000',
      total_amount: saleData.total_amount,
      discount_amount: saleData.discount_amount || 0,
      payment_method: saleData.payment_method || 'Efectivo',
      document_type: saleData.document_type || 'Boleta',
      operator: saleData.operator || 'Sistema',
      type: saleData.type || 'pos',
      status: 'completed',
      created_at: new Date().toISOString(),
    };

    const itemsPayload = saleData.items.map(item => ({
      id: 'item-' + Math.random().toString(36).substr(2, 9),
      sale_id: saleId,
      product_id: item.product_id,
      product_name: item.product_name || 'Producto',
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.quantity * item.unit_price,
      color_hex: item.color_hex || null,
      selected_size: item.selected_size || null
    }));

    if (supabase) {
      try {
        await supabase.from('sales').insert(newSale);
        await supabase.from('sale_items').insert(itemsPayload);
        for (const item of saleData.items) {
          const { data: prod } = await supabase.from('products').select('stock, colors').eq('id', item.product_id).single();
          if (prod) {
            const updates = { stock: Math.max(0, prod.stock - item.quantity) };
            if (item.color_hex && Array.isArray(prod.colors)) {
              updates.colors = prod.colors.map(c => {
                if (c.hex === item.color_hex) {
                  const currentStock = c.stock || 0;
                  const newColorStock = Math.max(0, currentStock - item.quantity);
                  if (item.selected_size && c.sizes_stock) {
                    const newSizesStock = { ...c.sizes_stock };
                    newSizesStock[item.selected_size] = Math.max(0, (newSizesStock[item.selected_size] || 0) - item.quantity);
                    return { ...c, stock: newColorStock, sizes_stock: newSizesStock };
                  }
                  return { ...c, stock: newColorStock };
                }
                return c;
              });
            }
            await supabase.from('products').update(updates).eq('id', item.product_id);
          }
        }
      } catch (e) {
        console.error('Error al guardar venta en Supabase:', e);
      }
    }

    const register = await this.getCashRegister();
    const operator = saleData.operator || 'Sistema';
    if (saleData.type === 'pos' && register.status === 'open' && register.currentSession && saleData.payment_method === 'Efectivo') {
      await this.addCashMovement(
        register.currentSession.id,
        'income',
        saleData.total_amount,
        `Venta POS #${saleId.toUpperCase().slice(-5)} - Doc: ${invoiceNumber}`,
        operator
      );
    }
    await this.addActionLog(`Registró Venta POS ${invoiceNumber} por S/. ${saleData.total_amount.toFixed(2)} (${saleData.payment_method})`, operator);
    return newSale;
  },

  async voidSale(saleId, operator = 'Administrador') {
    const allSales = await this.getSales();
    const sale = allSales.find(s => s.id === saleId);
    if (!sale || sale.status === 'voided') return sale;

    if (supabase) {
      try {
        await supabase.from('sales').update({ status: 'voided' }).eq('id', saleId);
        const items = await this.getSaleItems(saleId);
        for (const item of items) {
          const { data: prod } = await supabase.from('products').select('stock, colors').eq('id', item.product_id).single();
          if (prod) {
            const updates = { stock: prod.stock + item.quantity };
            if (item.color_hex && Array.isArray(prod.colors)) {
              updates.colors = prod.colors.map(c => {
                if (c.hex === item.color_hex) {
                  const currentStock = c.stock || 0;
                  const newColorStock = currentStock + item.quantity;
                  if (item.selected_size && c.sizes_stock) {
                    const newSizesStock = { ...c.sizes_stock };
                    newSizesStock[item.selected_size] = (newSizesStock[item.selected_size] || 0) + item.quantity;
                    return { ...c, stock: newColorStock, sizes_stock: newSizesStock };
                  }
                  return { ...c, stock: newColorStock };
                }
                return c;
              });
            }
            await supabase.from('products').update(updates).eq('id', item.product_id);
          }
        }
      } catch (e) {
        console.error('Error al anular venta en Supabase:', e);
      }
    }

    const register = await this.getCashRegister();
    if (sale.type === 'pos' && register.status === 'open' && register.currentSession && sale.payment_method === 'Efectivo') {
      await this.addCashMovement(
        register.currentSession.id,
        'expense',
        sale.total_amount,
        `ANULACIÓN VENTA POS #${sale.id.toUpperCase().slice(-5)} (${sale.invoice_number})`,
        operator
      );
    }
    await this.addActionLog(`Anuló Venta POS ${sale.invoice_number} de S/. ${sale.total_amount.toFixed(2)}`, operator);
    return { ...sale, status: 'voided' };
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
