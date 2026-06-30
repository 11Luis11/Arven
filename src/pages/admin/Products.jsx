import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Upload, CheckCircle, AlertTriangle, Layers, Shirt, HelpCircle, Circle } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../services/dataService';

// Paleta de colores comunes para polos — hex + nombre
const COLOR_PRESETS = [
  { hex: '#FFFFFF', name: 'Blanco' },
  { hex: '#F5F0E8', name: 'Crema' },
  { hex: '#F5F5DC', name: 'Beige' },
  { hex: '#111111', name: 'Negro' },
  { hex: '#4A4A4A', name: 'Gris Oscuro' },
  { hex: '#9E9E9E', name: 'Gris Medio' },
  { hex: '#D3D3D3', name: 'Gris Claro' },
  { hex: '#1C2B4A', name: 'Navy' },
  { hex: '#2563EB', name: 'Azul Royal' },
  { hex: '#7DD3FC', name: 'Celeste' },
  { hex: '#16A34A', name: 'Verde Oliva' },
  { hex: '#86EFAC', name: 'Verde Menta' },
  { hex: '#7C3AED', name: 'Morado' },
  { hex: '#F97316', name: 'Naranja' },
  { hex: '#EF4444', name: 'Rojo' },
  { hex: '#EC4899', name: 'Rosa' },
  { hex: '#FDE68A', name: 'Amarillo' },
  { hex: '#B45309', name: 'Café / Caramelo' },
  { hex: '#5C3A1E', name: 'Marrón Oscuro' },
  { hex: '#047857', name: 'Verde Botella' },
];

const TALLA_PRESETS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

const EMPTY_FORM = {
  id: '', name: '', sku: '', description: '', price: 59.00,
  offer_price: '', wholesale_price: '', wholesale_min_qty: '',
  wholesale_tiers: [],
  stock: 10, category_id: '', image_url: '', images: [], active: true,
  colors: [],   // [{ hex, name, stock, sizes_stock }]
  sizes: [],    // ['S', 'M', 'L', ...]
};

export default function Products() {
  const loggedInUserRaw = localStorage.getItem('admin_user');
  const currentUser = loggedInUserRaw ? JSON.parse(loggedInUserRaw) : { name: 'Admin Principal', role: 'admin' };

  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [preferredColors, setPreferredColors] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [editorTab, setEditorTab] = useState('general'); // 'general', 'prices', 'stock', 'images'
  const [uploading, setUploading] = useState(false);
  const [customColor, setCustomColor] = useState({ hex: '#CCCCCC', name: '' });

  const [isEditingCat, setIsEditingCat] = useState(false);
  const [catForm, setCatForm] = useState({ id: '', name: '', slug: '', description: '', image_url: '', active: true });
  const [catUploading, setCatUploading] = useState(false);
  const [uploadingColorHex, setUploadingColorHex] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const loadData = async () => {
    const [prods, cats, colors] = await Promise.all([
      DataService.getProducts(),
      DataService.getCategories(),
      DataService.getPreferredColors()
    ]);
    setProducts(prods);
    setCategories(cats);
    setPreferredColors(colors);
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToRealtime(() => loadData());
    return () => unsub();
  }, []);

  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: '', text: '' }), 3000);
  };

  // --- COLORES ---
  const toggleColor = (preset) => {
    const exists = form.colors.find(c => c.hex === preset.hex);
    if (exists) {
      setForm(f => ({ ...f, colors: f.colors.filter(c => c.hex !== preset.hex) }));
    } else {
      setForm(f => ({ ...f, colors: [...f.colors, { hex: preset.hex, name: preset.name, stock: 0 }] }));
    }
  };

  const addCustomColor = async () => {
    if (!customColor.name) return;
    const exists = form.colors.find(c => c.hex === customColor.hex);
    if (!exists) {
      setForm(f => ({ ...f, colors: [...f.colors, { ...customColor, stock: 0 }] }));
    }
    const updatedList = await DataService.addPreferredColor(customColor);
    setPreferredColors(updatedList);
    setCustomColor({ hex: '#CCCCCC', name: '' });
  };

  const handleDeletePreferredColor = async (e, hex) => {
    e.stopPropagation();
    const updatedList = await DataService.deletePreferredColor(hex);
    setPreferredColors(updatedList);
  };

  const updateColorStock = (hex, stock) => {
    setForm(f => ({ ...f, colors: f.colors.map(c => c.hex === hex ? { ...c, stock: parseInt(stock) || 0 } : c) }));
  };

  const updateColorSizeStock = (hex, size, stockValue) => {
    const val = parseInt(stockValue) || 0;
    setForm(f => {
      const updatedColors = f.colors.map(c => {
        if (c.hex === hex) {
          const sizes_stock = { ...(c.sizes_stock || {}), [size]: val };
          const totalStock = Object.values(sizes_stock).reduce((a, b) => a + b, 0);
          return { ...c, sizes_stock, stock: totalStock };
        }
        return c;
      });
      return { ...f, colors: updatedColors };
    });
  };

  const removeColor = (hex) => {
    setForm(f => ({ ...f, colors: f.colors.filter(c => c.hex !== hex) }));
  };

  // --- TALLAS ---
  const toggleSize = (s) => {
    const exists = form.sizes.includes(s);
    setForm(f => ({ ...f, sizes: exists ? f.sizes.filter(x => x !== s) : [...f.sizes, s] }));
  };

  // --- PRODUCTOS ---
  const handleOpenCreate = () => {
    setForm({ ...EMPTY_FORM, category_id: categories[0]?.id || '', image_url: '', images: [], colors: [], sizes: ['S', 'M', 'L'] });
    setEditorTab('general');
    setIsEditing(true);
  };

  const handleOpenEdit = (prod) => {
    setForm({
      ...prod,
      offer_price: prod.offer_price !== null ? prod.offer_price : '',
      wholesale_price: prod.wholesale_price ?? '',
      wholesale_min_qty: prod.wholesale_min_qty ?? '',
      wholesale_tiers: prod.wholesale_tiers || [],
      images: prod.images?.length > 0 ? prod.images : [prod.image_url].filter(Boolean),
      colors: prod.colors || [],
      sizes: prod.sizes || [],
    });
    setEditorTab('general');
    setIsEditing(true);
  };

  const handleDelete = async (id) => {
    if (currentUser.role !== 'admin') { showMsg('error', 'No tienes permisos para eliminar polos.'); return; }
    if (!window.confirm('¿Eliminar este polo?')) return;
    await DataService.deleteProduct(id);
    await DataService.addActionLog(`Eliminó el polo ID "${id}"`, currentUser.name);
    showMsg('success', 'Polo eliminado.');
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const url = await DataService.uploadImage(file);
      setForm(f => ({ ...f, image_url: f.image_url || url, images: [...f.images, url] }));
    } catch { showMsg('error', 'Error al subir imagen.'); }
    finally { setUploading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (currentUser.role !== 'admin') { showMsg('error', 'No tienes permisos para guardar polos.'); return; }
    if (!form.name || !form.sku) { showMsg('error', 'Nombre y SKU son obligatorios.'); return; }
    
    // Si no se ha seleccionado categoría, asignar la primera por defecto
    const targetCategoryId = form.category_id || categories[0]?.id || '';
    if (!targetCategoryId) { showMsg('error', 'Crea una categoría primero.'); return; }
    
    const colorImages = form.colors.map(col => col.image_url).filter(Boolean);
    const payload = {
      ...form,
      category_id: targetCategoryId,
      price: parseFloat(form.price) || 0,
      offer_price: form.offer_price === '' ? null : parseFloat(form.offer_price) || null,
      wholesale_price: form.wholesale_price === '' ? null : parseFloat(form.wholesale_price) || null,
      wholesale_min_qty: form.wholesale_min_qty === '' ? null : parseInt(form.wholesale_min_qty) || null,
      stock: form.colors.length > 0
        ? form.colors.reduce((s, c) => s + c.stock, 0)
        : parseInt(form.stock) || 0,
      image_url: colorImages[0] || form.image_url || '',
      images: colorImages.length > 0 ? colorImages : [form.image_url].filter(Boolean),
    };
    const isNew = !form.id;
    try {
      await DataService.saveProduct(payload);
      await loadData();
      await DataService.addActionLog(`${isNew ? 'Creó' : 'Editó'} el polo "${payload.name}" (SKU: ${payload.sku})`, currentUser.name);
      showMsg('success', 'Polo guardado con éxito.');
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      showMsg('error', err.message || 'Error al guardar el polo.');
    }
  };

  // --- CATEGORÍAS ---
  const handleOpenCreateCat = () => { setCatForm({ id: '', name: '', slug: '', description: '', image_url: '', active: true }); setIsEditingCat(true); };
  const handleOpenEditCat = (cat) => { setCatForm({ ...cat }); setIsEditingCat(true); };
  const handleDeleteCat = async (id) => {
    if (currentUser.role !== 'admin') { showMsg('error', 'No tienes permisos.'); return; }
    if (products.some(p => p.category_id === id)) { showMsg('error', 'Reasigna los polos de esta categoría antes de eliminarla.'); return; }
    if (!window.confirm('¿Eliminar esta categoría?')) return;
    await DataService.deleteCategory(id); 
    await DataService.addActionLog(`Eliminó la categoría ID "${id}"`, currentUser.name);
    showMsg('success', 'Categoría eliminada.');
  };
  const handleCatImageUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setCatUploading(true);
    try { const url = await DataService.uploadImage(file); setCatForm(f => ({ ...f, image_url: url })); }
    catch { showMsg('error', 'Error al subir imagen.'); }
    finally { setCatUploading(false); }
  };
  const handleSubmitCat = async (e) => {
    e.preventDefault();
    if (currentUser.role !== 'admin') { showMsg('error', 'No tienes permisos.'); return; }
    if (!catForm.name) { showMsg('error', 'Ingresa el nombre.'); return; }
    const isNew = !catForm.id;
    await DataService.saveCategory(catForm); 
    await loadData();
    await DataService.addActionLog(`${isNew ? 'Creó' : 'Editó'} la categoría "${catForm.name}"`, currentUser.name);
    showMsg('success', 'Categoría guardada.'); 
    setIsEditingCat(false);
  };

  // Shared tab style
  const tabStyle = (active) => ({
    background: 'none', border: 'none', padding: '8px 4px', fontSize: '13px', fontWeight: 500,
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    borderBottom: active ? '2px solid var(--text-primary)' : '2px solid transparent',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '-1px',
    letterSpacing: '0.02em'
  });

  const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid var(--border-color)', backgroundColor: '#FFF', fontSize: '13px', outline: 'none', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Info flujo */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '14px 18px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <HelpCircle size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: '1px' }} />
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Flujo:</strong> (1) Crea categorías → (2) Agrega polos con colores y tallas → (3) El stock total se calcula automáticamente sumando el stock por color. El inventario se descuenta al registrar ventas en el POS.
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '20px' }}>
        <button onClick={() => { setActiveTab('products'); setIsEditing(false); }} style={tabStyle(activeTab === 'products')}>
          <Shirt size={14} /> Polos
        </button>
        <button onClick={() => { setActiveTab('categories'); setIsEditingCat(false); }} style={tabStyle(activeTab === 'categories')}>
          <Layers size={14} /> Categorías
        </button>
      </div>

      {msg.text && (
        <div style={{
          padding: '10px 14px', border: '1px solid',
          borderColor: msg.type === 'success' ? '#DEF7EC' : '#FDE8E8',
          backgroundColor: msg.type === 'success' ? '#F3FBF7' : '#FDF2F2',
          color: msg.type === 'success' ? '#03543F' : '#9B1C1C',
          display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px'
        }}>
          {msg.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          {msg.text}
        </div>
      )}

      {/* === TAB PRODUCTOS === */}
      {activeTab === 'products' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Gestión de Polos</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{products.length} productos registrados</p>
            </div>
            {!isEditing && currentUser.role === 'admin' && (
              <button onClick={handleOpenCreate} className="btn-primary" style={{ display: 'flex', gap: '6px', alignItems: 'center', borderRadius: '0', fontSize: '13px' }}>
                <Plus size={14} /> Nuevo polo
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="card" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{form.id ? 'Editar polo' : 'Nuevo polo'}</h3>
                <button onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <X size={18} />
                </button>
              </div>

              {/* Sub-Tabs Form Navigation */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', paddingBottom: '2px', flexWrap: 'wrap' }}>
                {[
                  { id: 'general', label: '1. Datos Básicos' },
                  { id: 'prices', label: '2. Precios y Escalas' },
                  { id: 'stock', label: '3. Tallas, Colores y Stock' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setEditorTab(tab.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: editorTab === tab.id ? 'var(--color-primary)' : 'var(--text-secondary)',
                      borderBottom: editorTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* TAB 1: DATOS BÁSICOS */}
                {editorTab === 'general' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-primary)' }}>Nombre del Polo *</label>
                        <input required style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej. Polo Oversize Pima" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-primary)' }}>Código SKU *</label>
                        <input required style={inputStyle} value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="Ej. POL-OVS-BLK" />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-primary)' }}>Categoría</label>
                      <select style={inputStyle} value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-primary)' }}>Descripción (Permite saltos de línea)</label>
                      <textarea 
                        style={{ ...inputStyle, resize: 'vertical', minHeight: '120px' }} 
                        placeholder="Ingresa la descripción del polo. Los saltos de línea se verán reflejados al cliente." 
                        value={form.description} 
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <input type="checkbox" id="active-check" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                      <label htmlFor="active-check" style={{ fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>Activo (visible en la tienda pública)</label>
                    </div>
                  </div>
                )}

                {/* TAB 2: PRECIOS Y ESCALAS */}
                {editorTab === 'prices' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-primary)' }}>Precio Regular (S/.) *</label>
                        <input type="number" step="0.01" required style={inputStyle} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="Ej. 59.00" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-primary)' }}>Precio Oferta (S/.) <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>(Opcional)</span></label>
                        <input type="number" step="0.01" style={inputStyle} value={form.offer_price} onChange={e => setForm(f => ({ ...f, offer_price: e.target.value }))} placeholder="Ej. 49.00" />
                      </div>
                    </div>

                    {/* Múltiples Escalas por Mayor */}
                    <div style={{ border: '1px solid var(--border-color)', padding: '16px', backgroundColor: 'var(--bg-primary)' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        Escalas de Descuento al por Mayor
                      </label>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                        Define precios reducidos según la cantidad que lleve el cliente (ej. 6 unidades a S/.45, 12 a S/.40).
                      </p>
                      
                      {(!form.wholesale_tiers || form.wholesale_tiers.length === 0) ? (
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '12px', backgroundColor: '#FFF', padding: '10px', border: '1px dashed var(--border-color)' }}>
                          No hay escalas configuradas. Añade una abajo.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                          {form.wholesale_tiers.map((tier, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#FFF', padding: '8px 12px', border: '1px solid var(--border-color)' }}>
                              <span style={{ fontSize: '12px', flex: 1, fontWeight: 500 }}>
                                A partir de <strong>{tier.min_qty}</strong> unidades: <strong style={{ color: 'var(--color-primary)' }}>S/. {parseFloat(tier.price).toFixed(2)}</strong> c/u
                              </span>
                              <button type="button" onClick={() => {
                                const updatedTiers = form.wholesale_tiers.filter((_, i) => i !== idx);
                                setForm(f => ({
                                  ...f,
                                  wholesale_tiers: updatedTiers,
                                  wholesale_price: updatedTiers[0]?.price || '',
                                  wholesale_min_qty: updatedTiers[0]?.min_qty || ''
                                }));
                              }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-secondary)', padding: '4px' }}>
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', backgroundColor: '#FFF', padding: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Llevando (Min. unidades)</label>
                          <input id="new-tier-qty" type="number" min="1" placeholder="Ej. 6" style={inputStyle} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Precio Unitario (S/.)</label>
                          <input id="new-tier-price" type="number" step="0.01" min="0" placeholder="Ej. 45.00" style={inputStyle} />
                        </div>
                        <button type="button" onClick={() => {
                          const qtyInput = document.getElementById('new-tier-qty');
                          const priceInput = document.getElementById('new-tier-price');
                          const qtyVal = parseInt(qtyInput?.value);
                          const priceVal = parseFloat(priceInput?.value);
                          if (qtyVal && priceVal) {
                            const newTier = { min_qty: qtyVal, price: priceVal };
                            const list = [...(form.wholesale_tiers || []), newTier];
                            list.sort((a, b) => a.min_qty - b.min_qty);
                            setForm(f => ({
                              ...f,
                              wholesale_tiers: list,
                              wholesale_price: list[0]?.price || '',
                              wholesale_min_qty: list[0]?.min_qty || ''
                            }));
                            qtyInput.value = '';
                            priceInput.value = '';
                          }
                        }} className="btn-secondary" style={{ padding: '8px 16px', height: '36px', fontSize: '12px', whiteSpace: 'nowrap', fontWeight: 600 }}>
                          + Agregar Escala
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: TALLAS, COLORES Y STOCK */}
                {editorTab === 'stock' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Tallas */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', color: 'var(--text-secondary)' }}>1. Activa las Tallas</label>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {TALLA_PRESETS.map(s => {
                          const active = form.sizes.includes(s);
                          return (
                            <button key={s} type="button" onClick={() => toggleSize(s)} style={{
                              padding: '6px 14px', fontSize: '12px', fontWeight: 600,
                              border: '1px solid', cursor: 'pointer',
                              borderColor: active ? 'var(--text-primary)' : 'var(--border-color)',
                              backgroundColor: active ? 'var(--text-primary)' : '#FFF',
                              color: active ? '#FFF' : 'var(--text-secondary)',
                              transition: 'all 0.1s ease'
                            }}>{s}</button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Colores */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', color: 'var(--text-secondary)' }}>2. Elige los Colores</label>
                      
                      {/* Preferidos */}
                      {preferredColors.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                          {preferredColors.map(preset => {
                            const selected = form.colors.find(c => c.hex === preset.hex);
                            return (
                              <div key={preset.hex} style={{ position: 'relative', display: 'inline-block' }}>
                                <button type="button" onClick={() => toggleColor(preset)}
                                  title={preset.name}
                                  style={{
                                    width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer',
                                    backgroundColor: preset.hex,
                                    border: selected ? '2px solid var(--text-primary)' : '1px solid var(--border-color)',
                                    boxShadow: selected ? '0 0 0 2px var(--bg-primary), 0 0 0 4px var(--text-primary)' : 'none',
                                    transition: 'all 0.15s ease',
                                    flexShrink: 0
                                  }}
                                />
                                <button 
                                  type="button" 
                                  onClick={(e) => handleDeletePreferredColor(e, preset.hex)}
                                  title="Eliminar de preferidos"
                                  style={{
                                    position: 'absolute',
                                    top: '-4px',
                                    right: '-4px',
                                    backgroundColor: '#FF4D6D',
                                    color: '#FFF',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '14px',
                                    height: '14px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '9px',
                                    fontWeight: 'bold',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Crear color personalizado */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', maxWidth: '400px' }}>
                        <input type="color" value={customColor.hex} onChange={e => setCustomColor(c => ({ ...c, hex: e.target.value }))}
                          style={{ width: '36px', height: '36px', padding: '2px', border: '1px solid var(--border-color)', cursor: 'pointer' }} />
                        <input placeholder="Nombre del color (ej. Verde Oliva)" style={inputStyle}
                          value={customColor.name} onChange={e => setCustomColor(c => ({ ...c, name: e.target.value }))} />
                        <button type="button" onClick={addCustomColor} style={{
                          padding: '8px 14px', border: '1px solid var(--border-color)', background: '#FFF',
                          cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap', color: 'var(--text-primary)', fontWeight: 600
                        }}>+ Añadir Color</button>
                      </div>

                      {/* Grilla de stock */}
                      {form.colors.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>3. Asigna Stock por Talla</label>
                          {form.colors.map(c => {
                            const sizesStock = c.sizes_stock || {};
                            return (
                              <div key={c.hex} style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: c.hex, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                                  <span style={{ fontSize: '13px', fontWeight: 600, flex: 1 }}>{c.name}</span>
                                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total color: <strong>{c.stock || 0}</strong> uds</span>
                                  <button type="button" onClick={() => removeColor(c.hex)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-secondary)', padding: '4px' }}>
                                    ✕ Quitar Color
                                  </button>
                                </div>
                                
                                {/* Foto de este color: subir directa o elegir de galería */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '28px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>📸 Foto:</span>
                                  
                                  {/* Botón subir foto directa para este color */}
                                  <label style={{
                                    padding: '4px 10px', fontSize: '11px', fontWeight: 600,
                                    border: '1px dashed var(--border-color)', backgroundColor: 'var(--bg-primary)',
                                    cursor: uploadingColorHex === c.hex ? 'not-allowed' : 'pointer',
                                    whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    opacity: uploadingColorHex === c.hex ? 0.6 : 1
                                  }}>
                                    {uploadingColorHex === c.hex ? '⏳ Subiendo...' : '⬆ Subir foto'}
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      disabled={uploadingColorHex === c.hex}
                                      style={{ display: 'none' }}
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0]; if (!file) return;
                                        const targetHex = c.hex;
                                        setUploadingColorHex(targetHex);
                                        try {
                                          const url = await DataService.uploadImage(file);
                                          setForm(f => {
                                            const updatedColors = f.colors.map(col => 
                                              col?.hex?.toLowerCase() === targetHex?.toLowerCase() 
                                                ? { ...col, image_url: url } 
                                                : col
                                            );
                                            return {
                                              ...f,
                                              image_url: f.image_url || url,
                                              images: [...(f.images || []), url],
                                              colors: updatedColors
                                            };
                                          });
                                        } catch (err) { 
                                          console.error(err);
                                          window.alert(`Error al subir imagen:\n${err.message || 'Error desconocido'}`); 
                                        } finally {
                                          setUploadingColorHex(null);
                                        }
                                      }}
                                    />
                                  </label>



                                  {/* Preview de la imagen asociada */}
                                  {c.image_url ? (
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                      <img src={c.image_url} alt="" style={{ width: '36px', height: '44px', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                                      <button type="button" onClick={() => {
                                        setForm(f => ({
                                          ...f,
                                          colors: f.colors.map(col => col?.hex?.toLowerCase() === c?.hex?.toLowerCase() ? { ...col, image_url: '' } : col)
                                        }));
                                      }} style={{
                                        position: 'absolute', top: '-5px', right: '-5px',
                                        backgroundColor: '#FF4D6D', color: '#FFF', border: 'none', borderRadius: '50%',
                                        width: '14px', height: '14px', cursor: 'pointer', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', fontSize: '8px',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                      }}>✕</button>
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: '10px', color: '#B0B0B0', fontStyle: 'italic' }}>Sin foto</span>
                                  )}
                                </div>
                                {form.sizes.length > 0 ? (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: '8px', paddingLeft: '28px' }}>
                                    {form.sizes.map(size => (
                                      <div key={size} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>{size}</label>
                                        <input type="number" min="0" 
                                          value={sizesStock[size] !== undefined ? sizesStock[size] : 0}
                                          onChange={e => updateColorSizeStock(c.hex, size, e.target.value)}
                                          style={{ ...inputStyle, padding: '4px 6px', textAlign: 'center' }} />
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '28px' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Stock total de este color:</span>
                                    <input type="number" min="0" value={c.stock || 0}
                                      onChange={e => updateColorStock(c.hex, e.target.value)}
                                      style={{ ...inputStyle, width: '80px', padding: '4px 8px', textAlign: 'center' }} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                            Stock total sumado: {form.colors.reduce((s, c) => s + c.stock, 0)} unidades
                          </div>
                        </div>
                      )}

                      {/* Stock manual */}
                      {form.colors.length === 0 && (
                        <div style={{ marginTop: '10px', backgroundColor: 'var(--bg-primary)', padding: '12px', border: '1px solid var(--border-color)' }}>
                          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Stock total (al no tener colores especificados)</label>
                          <input type="number" style={{ ...inputStyle, maxWidth: '120px' }}
                            value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
                        </div>
                      )}
                    </div>
                  </div>
                )}



                {/* Footer Buttons */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '12px' }}>
                  <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary" style={{ borderRadius: '0', fontSize: '13px', padding: '10px 20px' }}>Cancelar</button>
                  <button type="submit" className="btn-primary" style={{ borderRadius: '0', fontSize: '13px', padding: '10px 20px', fontWeight: 600 }}>Guardar polo</button>
                </div>
              </form>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
              {products.map(prod => {
                const cat = categories.find(c => c.id === prod.category_id);
                return (
                  <div key={prod.id} className="card" style={{ display: 'flex', gap: '14px', padding: '14px' }}>
                    <img src={prod.image_url} alt={prod.name} style={{ width: '64px', height: '80px', objectFit: 'cover', backgroundColor: '#F0F0F0', flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                          <h4 style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.3 }}>{prod.name}</h4>
                          <span style={{ fontSize: '9px', backgroundColor: prod.active ? '#EBFBEE' : '#F3F4F6', color: prod.active ? '#2F855A' : '#4B5563', padding: '2px 5px', fontWeight: 700, flexShrink: 0, letterSpacing: '0.05em' }}>
                            {prod.active ? 'ACTIVO' : 'PAUSADO'}
                          </span>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{prod.sku} · {cat?.name || '—'}</p>
                        <p style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '1px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ userSelect: 'all', cursor: 'text', title: 'ID del producto' }}>ID: {prod.id}</span>
                        </p>
                        <p style={{ fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>S/. {(prod.offer_price || prod.price).toFixed(2)}</p>
                        
                        {/* Colores */}
                        {prod.colors?.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                            {prod.colors.map(c => (
                              <div key={c.hex} title={`${c.name} — ${c.stock} uds`} style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: c.hex, border: '1px solid rgba(0,0,0,0.12)' }} />
                            ))}
                          </div>
                        )}

                        {/* Tallas */}
                        {prod.sizes?.length > 0 && (
                          <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', letterSpacing: '0.03em' }}>
                            {prod.sizes.join(' · ')}
                          </p>
                        )}

                        <p style={{ fontSize: '11px', marginTop: '4px' }}>Stock: <strong>{prod.stock}</strong> uds</p>
                      </div>
                      {currentUser.role === 'admin' && (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '8px' }}>
                          <button onClick={() => handleOpenEdit(prod)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}>
                            <Edit size={15} />
                          </button>
                          <button onClick={() => handleDelete(prod.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-secondary)', padding: '4px' }}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* === TAB CATEGORÍAS === */}
      {activeTab === 'categories' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Colecciones</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{categories.length} categorías</p>
            </div>
            {!isEditingCat && currentUser.role === 'admin' && (
              <button onClick={handleOpenCreateCat} className="btn-primary" style={{ display: 'flex', gap: '6px', alignItems: 'center', borderRadius: '0', fontSize: '13px' }}>
                <Plus size={14} /> Nueva categoría
              </button>
            )}
          </div>

          {isEditingCat ? (
            <div className="card" style={{ maxWidth: '540px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600 }}>{catForm.id ? 'Editar categoría' : 'Nueva categoría'}</h3>
                <button onClick={() => setIsEditingCat(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
              </div>
              <form onSubmit={handleSubmitCat} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[['Nombre *', 'name', true, 'Ej. Polos Oversize'], ['Slug URL', 'slug', false, 'polos-oversize'], ['Descripción', 'description', false, '']].map(([lbl, key, req, ph]) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '5px' }}>{lbl}</label>
                    {key === 'description'
                      ? <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={catForm[key]} onChange={e => setCatForm(f => ({ ...f, [key]: e.target.value }))} />
                      : <input required={req} placeholder={ph} style={inputStyle} value={catForm[key]} onChange={e => setCatForm(f => ({ ...f, [key]: e.target.value }))} />
                    }
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '5px' }}>Imagen</label>
                    <div style={{ border: '1px dashed var(--border-color)', padding: '14px', textAlign: 'center', position: 'relative', cursor: 'pointer', backgroundColor: 'var(--bg-primary)' }}>
                      <input type="file" accept="image/*" onChange={handleCatImageUpload} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }} />
                      <Upload size={16} style={{ color: 'var(--text-secondary)' }} />
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{catUploading ? 'Subiendo...' : 'Subir'}</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '5px' }}>URL directa</label>
                    <input style={inputStyle} placeholder="https://..." value={catForm.image_url} onChange={e => setCatForm(f => ({ ...f, image_url: e.target.value }))} />
                    {catForm.image_url && (
                      <img src={catForm.image_url} alt="" style={{ width: '100%', height: '70px', objectFit: 'cover', marginTop: '8px', border: '1px solid var(--border-color)' }} />
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <button type="button" onClick={() => setIsEditingCat(false)} className="btn-secondary" style={{ borderRadius: '0', fontSize: '13px' }}>Cancelar</button>
                  <button type="submit" className="btn-primary" style={{ borderRadius: '0', fontSize: '13px' }}>Guardar</button>
                </div>
              </form>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
              {categories.map(cat => {
                const pCount = products.filter(p => p.category_id === cat.id).length;
                return (
                  <div key={cat.id} className="card" style={{ display: 'flex', gap: '14px', padding: '14px' }}>
                    <img src={cat.image_url} alt={cat.name} style={{ width: '64px', height: '64px', objectFit: 'cover', backgroundColor: '#F0F0F0', flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <h4 style={{ fontSize: '13px', fontWeight: 600 }}>{cat.name}</h4>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>/{cat.slug}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{pCount} polos vinculados</p>
                      </div>
                      {currentUser.role === 'admin' && (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button onClick={() => handleOpenEditCat(cat)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}><Edit size={15} /></button>
                          <button onClick={() => handleDeleteCat(cat.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-secondary)', padding: '4px' }}><Trash2 size={15} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
