import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit, Trash2, X, Upload, Layers, Shirt, HelpCircle, Search, Link2, Star, Loader2 } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../services/dataService';
import { toast } from '../../utils/toast';

// Paleta base de colores comunes para polos. Se muestra como paleta rápida
// cuando todavía no hay colores preferidos guardados en la configuración.
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
const LOW_STOCK = 5; // mismo umbral que el Dashboard
const SPIN = { animation: 'spin 0.8s linear infinite' };

const EMPTY_FORM = {
  id: '', name: '', sku: '', description: '', price: 59.00,
  offer_price: '', wholesale_price: '', wholesale_min_qty: '',
  wholesale_tiers: [],
  stock: 10, category_id: '', image_url: '', images: [], active: true,
  colors: [],   // [{ hex, name, stock, sizes_stock, images }]
  sizes: [],    // ['S', 'M', 'L', ...]
  simple_promos: [],
  size_prices: {},
};

const EMPTY_CAT = { id: '', name: '', slug: '', description: '', image_url: '', active: true };

// ---------- helpers puros ----------
function readCurrentUser() {
  try {
    const raw = localStorage.getItem('admin_user');
    if (raw) return JSON.parse(raw);
  } catch { /* JSON corrupto: usar valor por defecto */ }
  return { name: 'Admin Principal', role: 'admin' };
}

const toInt = (v) => parseInt(v) || 0;
const sizeRank = (s) => { const i = TALLA_PRESETS.indexOf(s); return i === -1 ? 99 : i; };
const money = (v) => (Number(v) || 0).toFixed(2);
const sameHex = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase();
const parseOffer = (v) => (v === '' || v === null || v === undefined) ? null : (parseFloat(v) || null);

// Suma de stock solo de las tallas activas
const sumSizes = (sizesStock, sizes) => sizes.reduce((a, s) => a + toInt(sizesStock?.[s]), 0);

function buildPayload(form, categoryId) {
  const sizes = form.sizes || [];

  const colors = (form.colors || []).map(c => {
    const images = c.images?.length > 0 ? c.images : (c.image_url ? [c.image_url] : []);
    const out = { ...c, stock: toInt(c.stock), image_url: images[0] || '', images };
    // Si el color tiene desglose por talla, el total es la suma de las tallas ACTIVAS
    if (sizes.length > 0 && c.sizes_stock && Object.keys(c.sizes_stock).length > 0) {
      out.sizes_stock = Object.fromEntries(sizes.map(s => [s, toInt(c.sizes_stock[s])]));
      out.stock = sumSizes(out.sizes_stock, sizes);
    }
    return out;
  });

  // Solo guardar precios de tallas activas
  const sizePrices = {};
  sizes.forEach(s => {
    const d = form.size_prices?.[s] || {};
    sizePrices[s] = { price: d.price ?? '', offer_price: d.offer_price ?? '', wholesale_tiers: d.wholesale_tiers || [] };
  });

  // Precio de listado: el de la primera talla; sin tallas, el precio general
  let price = parseFloat(form.price) || 0;
  let offerPrice = parseOffer(form.offer_price);
  if (sizes.length > 0) {
    price = parseFloat(sizePrices[sizes[0]].price) || 0;
    offerPrice = parseOffer(sizePrices[sizes[0]].offer_price);
  }

  const colorImages = colors.flatMap(c => c.images);
  const generalImages = (form.images?.length > 0 ? form.images : [form.image_url]).filter(Boolean);
  const images = colorImages.length > 0 ? colorImages : generalImages;

  const payload = {
    ...form,
    category_id: categoryId,
    price,
    offer_price: offerPrice,
    wholesale_price: null,
    wholesale_min_qty: null,
    wholesale_tiers: [
      { type: 'simple_promos', data: form.simple_promos || [] },
      { type: 'size_prices', data: sizePrices },
    ],
    stock: colors.length > 0 ? colors.reduce((s, c) => s + c.stock, 0) : toInt(form.stock),
    image_url: images[0] || '',
    images,
    colors,
    sizes,
  };
  // Atributos temporales que no existen en el esquema SQL
  delete payload.simple_promos;
  delete payload.size_prices;
  return payload;
}

function stockBadge(stock) {
  if (stock <= 0) return <span className="badge badge-danger">Agotado</span>;
  if (stock <= LOW_STOCK) return <span className="badge badge-warning">{stock} · Bajo</span>;
  return <span className="badge badge-success">{stock} uds</span>;
}

// ---------- subcomponentes (fuera del componente principal) ----------
function SizeToggles({ sizes, onToggle }) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {[...TALLA_PRESETS, ...sizes.filter(s => !TALLA_PRESETS.includes(s))].map(s => {
        const active = sizes.includes(s);
        return (
          <button key={s} type="button" onClick={() => onToggle(s)} aria-pressed={active} style={{
            minWidth: '48px', padding: '7px 14px', fontSize: '13px', fontWeight: 600,
            borderRadius: 'var(--radius-pill)', border: '1px solid', cursor: 'pointer',
            borderColor: active ? 'var(--text-primary)' : 'var(--border-strong)',
            backgroundColor: active ? 'var(--text-primary)' : 'var(--bg-card)',
            color: active ? '#FFF' : 'var(--text-secondary)',
            transition: 'var(--transition-fast)'
          }}>{s}</button>
        );
      })}
    </div>
  );
}

function Swatch({ color, selected, onClick, onDelete }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '56px' }}>
      <button type="button" onClick={onClick} title={color.name} aria-pressed={selected} style={{
        width: '34px', height: '34px', borderRadius: '50%', cursor: 'pointer', backgroundColor: color.hex,
        border: '1px solid rgba(0,0,0,0.15)',
        boxShadow: selected ? '0 0 0 2px var(--bg-card), 0 0 0 4px var(--color-primary)' : 'none',
        transition: 'var(--transition-fast)'
      }} />
      <span style={{ fontSize: '10px', color: selected ? 'var(--text-primary)' : 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.2, fontWeight: selected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{color.name}</span>
      {onDelete && (
        <button type="button" onClick={onDelete} title="Quitar de preferidos" aria-label={`Quitar ${color.name} de preferidos`} style={{
          position: 'absolute', top: '-4px', right: '6px', width: '16px', height: '16px', borderRadius: '50%',
          border: 'none', background: 'var(--color-danger)', color: '#FFF', fontSize: '9px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)'
        }}><X size={10} /></button>
      )}
    </div>
  );
}

function ImageThumbs({ images, onRemove, onMakeMain }) {
  if (!images.length) return null;
  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      {images.map((url, idx) => (
        <div key={`${url}-${idx}`} style={{ position: 'relative', flexShrink: 0 }}>
          <img src={url} alt="" style={{
            width: '56px', height: '70px', objectFit: 'cover', borderRadius: 'var(--radius-sm)',
            border: idx === 0 ? '2px solid var(--color-primary)' : '1px solid var(--border-color)'
          }} />
          {idx === 0 && (
            <span style={{ position: 'absolute', bottom: '3px', left: '3px', fontSize: '9px', background: 'var(--color-primary)', color: '#FFF', padding: '1px 4px', borderRadius: '4px', fontWeight: 600 }}>Principal</span>
          )}
          <button type="button" title="Eliminar foto" aria-label="Eliminar foto" onClick={() => onRemove(idx)} style={{
            position: 'absolute', top: '-6px', right: '-6px', width: '18px', height: '18px', borderRadius: '50%',
            border: 'none', background: 'var(--color-danger)', color: '#FFF', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)'
          }}><X size={11} /></button>
          {idx > 0 && (
            <button type="button" title="Poner como principal" aria-label="Poner como principal" onClick={() => onMakeMain(idx)} style={{
              position: 'absolute', bottom: '-6px', right: '-6px', width: '18px', height: '18px', borderRadius: '50%',
              border: 'none', background: 'var(--color-primary)', color: '#FFF', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)'
            }}><Star size={10} /></button>
          )}
        </div>
      ))}
    </div>
  );
}

const moveToFront = (arr, idx) => { const a = [...arr]; const [m] = a.splice(idx, 1); a.unshift(m); return a; };

const sectionStyle = { border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '16px', background: 'var(--bg-card)' };
const subtleSection = { ...sectionStyle, background: 'var(--bg-subtle)' };
const sectionTitle = { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' };
const sectionHint = { fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 };
const thumbStyle = { width: '44px', height: '54px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', flexShrink: 0 };

// =====================================================================

export default function Products() {
  const [currentUser] = useState(readCurrentUser);
  const isAdmin = currentUser.role === 'admin';

  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [preferredColors, setPreferredColors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  // Editor de producto
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editorTab, setEditorTab] = useState('general'); // 'general' | 'prices' | 'stock'
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploadingColorHex, setUploadingColorHex] = useState(null);
  const [customColor, setCustomColor] = useState({ hex: '#CCCCCC', name: '' });
  const [newPromo, setNewPromo] = useState({ qty: '', price: '' });
  const [newSizeTierQty, setNewSizeTierQty] = useState({});
  const [newSizeTierPrice, setNewSizeTierPrice] = useState({});

  // Editor de categoría
  const [isEditingCat, setIsEditingCat] = useState(false);
  const [catForm, setCatForm] = useState(EMPTY_CAT);
  const [catUploading, setCatUploading] = useState(false);
  const [savingCat, setSavingCat] = useState(false);

  const loadData = async () => {
    try {
      const [prods, cats, colors] = await Promise.all([
        DataService.getProducts(),
        DataService.getCategories(),
        DataService.getPreferredColors()
      ]);
      setProducts(prods || []);
      setCategories(cats || []);
      setPreferredColors(colors || []);
    } catch (err) {
      console.error(err);
      toast.error('No se pudieron cargar los productos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos
    loadData();
    const unsub = subscribeToRealtime(() => loadData());
    return () => unsub();
  }, []);

  const catName = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c.name])), [categories]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p =>
      (catFilter === 'all' || p.category_id === catFilter) &&
      (!q || (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))
    );
  }, [products, search, catFilter]);

  // --- COLORES ---
  const toggleColor = (preset) => {
    setForm(f => f.colors.some(c => sameHex(c.hex, preset.hex))
      ? { ...f, colors: f.colors.filter(c => !sameHex(c.hex, preset.hex)) }
      : { ...f, colors: [...f.colors, { hex: preset.hex, name: preset.name, stock: 0, images: [] }] });
  };

  const addCustomColor = async () => {
    const name = customColor.name.trim();
    if (!name) { toast.warning('Escribe un nombre para el color.'); return; }
    const color = { hex: customColor.hex, name };
    setForm(f => f.colors.some(c => sameHex(c.hex, color.hex))
      ? f
      : { ...f, colors: [...f.colors, { ...color, stock: 0, images: [] }] });
    setCustomColor({ hex: '#CCCCCC', name: '' });
    try {
      const updatedList = await DataService.addPreferredColor(color);
      setPreferredColors(updatedList);
    } catch (err) {
      console.error(err);
      toast.error('El color se agregó al polo, pero no se pudo guardar en preferidos.');
    }
  };

  const handleDeletePreferredColor = async (e, hex) => {
    e.stopPropagation();
    try {
      const updatedList = await DataService.deletePreferredColor(hex);
      setPreferredColors(updatedList);
    } catch (err) {
      console.error(err);
      toast.error('No se pudo quitar el color de preferidos.');
    }
  };

  const updateColorStock = (hex, stock) => {
    setForm(f => ({ ...f, colors: f.colors.map(c => sameHex(c.hex, hex) ? { ...c, stock: toInt(stock) } : c) }));
  };

  const updateColorSizeStock = (hex, size, stockValue) => {
    const val = Math.max(0, toInt(stockValue));
    setForm(f => ({
      ...f,
      colors: f.colors.map(c => {
        if (!sameHex(c.hex, hex)) return c;
        const sizes_stock = { ...(c.sizes_stock || {}), [size]: val };
        return { ...c, sizes_stock, stock: sumSizes(sizes_stock, f.sizes) };
      })
    }));
  };

  const removeColor = (hex) => setForm(f => ({ ...f, colors: f.colors.filter(c => !sameHex(c.hex, hex)) }));

  const updateColorImages = (hex, fn) => {
    setForm(f => ({ ...f, colors: f.colors.map(c => sameHex(c.hex, hex) ? { ...c, images: fn(c.images || []) } : c) }));
  };

  const handleColorImagesUpload = async (e, hex) => {
    const input = e.target;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    setUploadingColorHex(hex);
    try {
      const urls = await Promise.all(files.map(file => DataService.uploadImage(file)));
      updateColorImages(hex, imgs => [...imgs, ...urls]);
      toast.success(urls.length > 1 ? `${urls.length} fotos subidas.` : 'Foto subida.');
    } catch (err) {
      console.error(err);
      toast.error(`Error al subir imagen: ${err.message || 'Error desconocido'}`);
    } finally {
      setUploadingColorHex(null);
      input.value = '';
    }
  };

  // --- IMÁGENES GENERALES (productos sin colores) ---
  const handleImageUpload = async (e) => {
    const input = e.target;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(files.map(file => DataService.uploadImage(file)));
      setForm(f => ({ ...f, image_url: f.image_url || urls[0], images: [...(f.images || []), ...urls] }));
      toast.success(urls.length > 1 ? `${urls.length} fotos subidas.` : 'Foto subida.');
    } catch (err) {
      console.error(err);
      toast.error(`Error al subir imagen: ${err.message || 'Error desconocido'}`);
    } finally {
      setUploading(false);
      input.value = '';
    }
  };

  const addImageByUrl = () => {
    const url = newImageUrl.trim();
    if (!/^https?:\/\//i.test(url)) { toast.warning('Ingresa una URL válida (https://...).'); return; }
    setForm(f => ({ ...f, image_url: f.image_url || url, images: [...(f.images || []), url] }));
    setNewImageUrl('');
  };

  const setGeneralImages = (images) => setForm(f => ({ ...f, images, image_url: images[0] || '' }));

  // --- TALLAS Y PRECIOS ---
  const toggleSize = (s) => {
    setForm(f => {
      const sizes = f.sizes.includes(s)
        ? f.sizes.filter(x => x !== s)
        : [...f.sizes, s].sort((x, y) => sizeRank(x) - sizeRank(y)); // orden XS→3XL (tallas personalizadas al final)
      // Recalcula el total de colores con desglose por talla
      const colors = f.colors.map(c =>
        c.sizes_stock && Object.keys(c.sizes_stock).length > 0 && sizes.length > 0
          ? { ...c, stock: sumSizes(c.sizes_stock, sizes) } : c);
      return { ...f, sizes, colors };
    });
  };

  const setSizePrice = (size, patch) => {
    setForm(f => ({
      ...f,
      size_prices: { ...(f.size_prices || {}), [size]: { ...(f.size_prices?.[size] || {}), ...patch } }
    }));
  };

  const addPromo = () => {
    const qty = parseInt(newPromo.qty);
    const price = parseFloat(newPromo.price);
    if (!(qty > 0) || !(price > 0)) { toast.warning('Ingresa una cantidad y un precio válidos.'); return; }
    setForm(f => ({ ...f, simple_promos: [...(f.simple_promos || []), { qty, price }].sort((a, b) => a.qty - b.qty) }));
    setNewPromo({ qty: '', price: '' });
  };

  const addSizeTier = (size) => {
    const qty = parseInt(newSizeTierQty[size]);
    const price = parseFloat(newSizeTierPrice[size]);
    if (!(qty > 0) || !(price > 0)) { toast.warning('Ingresa unidades mínimas y precio válidos.'); return; }
    setForm(f => {
      const current = f.size_prices?.[size]?.wholesale_tiers || [];
      const list = [...current, { min_qty: qty, price }].sort((a, b) => a.min_qty - b.min_qty);
      return { ...f, size_prices: { ...(f.size_prices || {}), [size]: { ...(f.size_prices?.[size] || {}), wholesale_tiers: list } } };
    });
    setNewSizeTierQty(prev => ({ ...prev, [size]: '' }));
    setNewSizeTierPrice(prev => ({ ...prev, [size]: '' }));
  };

  // --- PRODUCTOS ---
  const resetEditorInputs = () => {
    setEditorTab('general');
    setNewPromo({ qty: '', price: '' });
    setNewSizeTierQty({});
    setNewSizeTierPrice({});
    setNewImageUrl('');
    setCustomColor({ hex: '#CCCCCC', name: '' });
  };

  const handleOpenCreate = () => {
    if (categories.length === 0) {
      toast.warning('Primero crea una categoría.');
      setActiveTab('categories');
      return;
    }
    setForm({ ...EMPTY_FORM, category_id: categories[0]?.id || '', sizes: ['S', 'M', 'L'] });
    resetEditorInputs();
    setIsEditing(true);
  };

  const handleOpenEdit = (prod) => {
    const tiers = Array.isArray(prod.wholesale_tiers) ? prod.wholesale_tiers : [];
    const simplePromos = tiers.find(t => t.type === 'simple_promos')?.data || [];
    const sizePrices = tiers.find(t => t.type === 'size_prices')?.data || {};

    const cleanSizePrices = {};
    (prod.sizes || []).forEach(size => {
      const sData = sizePrices[size] || {};
      cleanSizePrices[size] = {
        price: sData.price ?? '',
        offer_price: sData.offer_price ?? '',
        wholesale_tiers: sData.wholesale_tiers || []
      };
    });

    setForm({
      ...EMPTY_FORM,
      ...prod,
      description: prod.description || '',
      offer_price: prod.offer_price ?? '',
      wholesale_price: '',
      wholesale_min_qty: '',
      wholesale_tiers: [],
      simple_promos: simplePromos,
      size_prices: cleanSizePrices,
      images: prod.images?.length > 0 ? prod.images.filter(Boolean) : [prod.image_url].filter(Boolean),
      colors: (prod.colors || []).map(c => ({
        ...c,
        images: c.images?.length > 0 ? c.images : (c.image_url ? [c.image_url] : []),
      })),
      sizes: prod.sizes || [],
    });
    resetEditorInputs();
    setIsEditing(true);
  };

  const closeEditor = () => { if (!saving) setIsEditing(false); };

  const handleDelete = async (prod) => {
    if (!isAdmin) { toast.error('No tienes permisos para eliminar polos.'); return; }
    if (!window.confirm(`¿Eliminar el polo "${prod.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await DataService.deleteProduct(prod.id);
      setProducts(list => list.filter(p => p.id !== prod.id));
      toast.success('Polo eliminado.');
      DataService.addActionLog(`Eliminó el polo "${prod.name}" (ID ${prod.id})`, currentUser.name).catch(() => {});
    } catch (err) {
      console.error(err);
      toast.error('No se pudo eliminar el polo.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!isAdmin) { toast.error('No tienes permisos para guardar polos.'); return; }
    if (!(form.name || '').trim() || !(form.sku || '').trim()) { setEditorTab('general'); toast.error('Nombre y SKU son obligatorios.'); return; }

    const sku = (form.sku || '').trim().toLowerCase();
    if (products.some(p => p.id !== form.id && (p.sku || '').trim().toLowerCase() === sku)) {
      setEditorTab('general'); toast.error('Ya existe otro polo con ese SKU.'); return;
    }

    const targetCategoryId = form.category_id || categories[0]?.id || '';
    if (!targetCategoryId) { toast.error('Crea una categoría primero.'); return; }

    const missing = (form.sizes || []).filter(s => !(parseFloat(form.size_prices?.[s]?.price) > 0));
    if (missing.length > 0) {
      setEditorTab('prices');
      toast.error(`Falta el precio regular de: ${missing.join(', ')}.`);
      return;
    }

    const payload = buildPayload({ ...form, name: (form.name || '').trim(), sku: (form.sku || '').trim() }, targetCategoryId);
    const isNew = !form.id;
    setSaving(true);
    try {
      await DataService.saveProduct(payload);
      await loadData();
      toast.success(isNew ? 'Polo creado con éxito.' : 'Cambios guardados.');
      setIsEditing(false);
      DataService.addActionLog(`${isNew ? 'Creó' : 'Editó'} el polo "${payload.name}" (SKU: ${payload.sku})`, currentUser.name).catch(() => {});
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Error al guardar el polo.');
    } finally {
      setSaving(false);
    }
  };

  // --- CATEGORÍAS ---
  const handleOpenCreateCat = () => { setCatForm(EMPTY_CAT); setIsEditingCat(true); };
  const handleOpenEditCat = (cat) => { setCatForm({ ...EMPTY_CAT, ...cat, description: cat.description || '', slug: cat.slug || '', image_url: cat.image_url || '' }); setIsEditingCat(true); };
  const closeCatEditor = () => { if (!savingCat) setIsEditingCat(false); };

  const handleDeleteCat = async (cat) => {
    if (!isAdmin) { toast.error('No tienes permisos.'); return; }
    if (products.some(p => p.category_id === cat.id)) { toast.warning('Reasigna los polos de esta categoría antes de eliminarla.'); return; }
    if (!window.confirm(`¿Eliminar la categoría "${cat.name}"?`)) return;
    try {
      await DataService.deleteCategory(cat.id);
      setCategories(list => list.filter(c => c.id !== cat.id));
      toast.success('Categoría eliminada.');
      DataService.addActionLog(`Eliminó la categoría "${cat.name}" (ID ${cat.id})`, currentUser.name).catch(() => {});
    } catch (err) {
      console.error(err);
      toast.error('No se pudo eliminar la categoría.');
    }
  };

  const handleCatImageUpload = async (e) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setCatUploading(true);
    try {
      const url = await DataService.uploadImage(file);
      setCatForm(f => ({ ...f, image_url: url }));
    } catch (err) {
      console.error(err);
      toast.error(`Error al subir imagen: ${err.message || 'Error desconocido'}`);
    } finally {
      setCatUploading(false);
      input.value = '';
    }
  };

  const handleSubmitCat = async (e) => {
    e.preventDefault();
    if (savingCat) return;
    if (!isAdmin) { toast.error('No tienes permisos.'); return; }
    if (!(catForm.name || '').trim()) { toast.error('Ingresa el nombre.'); return; }
    const isNew = !catForm.id;
    setSavingCat(true);
    try {
      await DataService.saveCategory({ ...catForm, name: (catForm.name || '').trim() });
      await loadData();
      toast.success(isNew ? 'Categoría creada.' : 'Categoría guardada.');
      setIsEditingCat(false);
      DataService.addActionLog(`${isNew ? 'Creó' : 'Editó'} la categoría "${catForm.name}"`, currentUser.name).catch(() => {});
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'No se pudo guardar la categoría.');
    } finally {
      setSavingCat(false);
    }
  };

  // Paleta a mostrar: preferidos guardados; si no hay, la paleta base
  const palette = preferredColors.length > 0 ? preferredColors : COLOR_PRESETS;
  const formTotalStock = form.colors.reduce((s, c) => s + toInt(c.stock), 0);

  // =================================================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1>Catálogo</h1>
          <p>Administra tus polos, precios por talla, colores, stock y categorías.</p>
        </div>
        {isAdmin && (
          activeTab === 'products'
            ? <button onClick={handleOpenCreate} className="btn-primary"><Plus size={16} /> Nuevo polo</button>
            : <button onClick={handleOpenCreateCat} className="btn-primary"><Plus size={16} /> Nueva categoría</button>
        )}
      </div>

      <div className="alert alert-info">
        <HelpCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
        <div style={{ lineHeight: 1.5 }}>
          <strong>Flujo:</strong> (1) Crea categorías → (2) Agrega polos con colores y tallas → (3) El stock total se calcula automáticamente sumando el stock por color. El inventario se descuenta al registrar ventas en el POS.
        </div>
      </div>

      <div className="tabs" style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
        <button className={`tab ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Shirt size={14} /> Polos <span className="badge" style={{ padding: '0 8px' }}>{products.length}</span>
        </button>
        <button className={`tab ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Layers size={14} /> Categorías <span className="badge" style={{ padding: '0 8px' }}>{categories.length}</span>
        </button>
      </div>

      {/* === TAB PRODUCTOS === */}
      {activeTab === 'products' && (
        <>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '420px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="input-field" style={{ paddingLeft: '38px' }} placeholder="Buscar por nombre o SKU..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input-field" style={{ flex: '0 1 220px', width: 'auto' }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="all">Todas las categorías</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="table-wrap" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '52px' }} />)}
            </div>
          ) : products.length === 0 ? (
            <div className="card empty-state">
              <Shirt size={40} style={{ color: 'var(--text-muted)' }} />
              <h3>Aún no tienes polos registrados</h3>
              <p style={{ fontSize: '14px', maxWidth: '380px' }}>Crea tu primer polo con sus tallas, colores y fotos. Aparecerá en la tienda y en el POS.</p>
              {isAdmin && <button className="btn-primary" style={{ marginTop: '8px' }} onClick={handleOpenCreate}><Plus size={16} /> Crear primer polo</button>}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="card empty-state">
              <Search size={36} style={{ color: 'var(--text-muted)' }} />
              <h3>Sin resultados</h3>
              <p style={{ fontSize: '14px' }}>No hay polos que coincidan con tu búsqueda.</p>
              <button className="btn-secondary btn-sm" style={{ marginTop: '8px' }} onClick={() => { setSearch(''); setCatFilter('all'); }}>Limpiar filtros</button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Polo</th>
                    <th>Categoría</th>
                    <th style={{ textAlign: 'right' }}>Precio</th>
                    <th>Stock</th>
                    <th>Variantes</th>
                    <th>Estado</th>
                    {isAdmin && <th style={{ textAlign: 'right' }}>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(prod => {
                    const hasOffer = prod.offer_price && Number(prod.offer_price) < Number(prod.price);
                    return (
                      <tr key={prod.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
                            {prod.image_url
                              ? <img src={prod.image_url} alt={prod.name} style={thumbStyle} loading="lazy" />
                              : <div style={{ ...thumbStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shirt size={18} style={{ color: 'var(--text-muted)' }} /></div>}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{prod.name}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{prod.sku}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', userSelect: 'all' }} title="ID del producto">{prod.id}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{catName[prod.category_id] || '—'}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {hasOffer ? (
                            <>
                              <div style={{ fontWeight: 600, color: 'var(--color-danger)' }}>S/. {money(prod.offer_price)}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>S/. {money(prod.price)}</div>
                            </>
                          ) : <span style={{ fontWeight: 600 }}>S/. {money(prod.price)}</span>}
                        </td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{stockBadge(toInt(prod.stock))}</td>
                        <td>
                          {prod.colors?.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '140px' }}>
                              {prod.colors.map(c => (
                                <span key={c.hex} title={`${c.name} — ${toInt(c.stock)} uds`} style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: c.hex, border: '1px solid rgba(0,0,0,0.15)' }} />
                              ))}
                            </div>
                          )}
                          {prod.sizes?.length > 0 && (
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', whiteSpace: 'nowrap' }}>{prod.sizes.join(' · ')}</div>
                          )}
                          {!prod.colors?.length && !prod.sizes?.length && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td>{prod.active ? <span className="badge badge-success">Activo</span> : <span className="badge">Pausado</span>}</td>
                        {isAdmin && (
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button className="btn-ghost btn-icon" title="Editar" aria-label={`Editar ${prod.name}`} onClick={() => handleOpenEdit(prod)}><Edit size={16} /></button>
                            <button className="btn-ghost btn-icon" title="Eliminar" aria-label={`Eliminar ${prod.name}`} onClick={() => handleDelete(prod)} style={{ color: 'var(--color-danger)' }}><Trash2 size={16} /></button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* === TAB CATEGORÍAS === */}
      {activeTab === 'categories' && (
        loading ? (
          <div className="table-wrap" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: '48px' }} />)}
          </div>
        ) : categories.length === 0 ? (
          <div className="card empty-state">
            <Layers size={40} style={{ color: 'var(--text-muted)' }} />
            <h3>Aún no hay categorías</h3>
            <p style={{ fontSize: '14px', maxWidth: '360px' }}>Las categorías agrupan tus polos en la tienda (ej. Oversize, Básicos, Pima).</p>
            {isAdmin && <button className="btn-primary" style={{ marginTop: '8px' }} onClick={handleOpenCreateCat}><Plus size={16} /> Crear categoría</button>}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Slug</th>
                  <th style={{ textAlign: 'right' }}>Polos</th>
                  {isAdmin && <th style={{ textAlign: 'right' }}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {categories.map(cat => {
                  const pCount = products.filter(p => p.category_id === cat.id).length;
                  return (
                    <tr key={cat.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '200px' }}>
                          {cat.image_url
                            ? <img src={cat.image_url} alt={cat.name} style={{ ...thumbStyle, height: '44px' }} loading="lazy" />
                            : <div style={{ ...thumbStyle, height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Layers size={16} style={{ color: 'var(--text-muted)' }} /></div>}
                          <div>
                            <div style={{ fontWeight: 600 }}>{cat.name}</div>
                            {cat.description && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{cat.description}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '13px' }}>/{cat.slug}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><span className="badge badge-primary">{pCount}</span></td>
                      {isAdmin && (
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button className="btn-ghost btn-icon" title="Editar" aria-label={`Editar ${cat.name}`} onClick={() => handleOpenEditCat(cat)}><Edit size={16} /></button>
                          <button className="btn-ghost btn-icon" title="Eliminar" aria-label={`Eliminar ${cat.name}`} onClick={() => handleDeleteCat(cat)} style={{ color: 'var(--color-danger)' }}><Trash2 size={16} /></button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ======================== MODAL EDITOR DE POLO ======================== */}
      {isEditing && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '880px', padding: 0, display: 'flex', flexDirection: 'column' }} role="dialog" aria-modal="true" aria-label={form.id ? 'Editar polo' : 'Nuevo polo'}>
            <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ padding: '20px 24px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700 }}>{form.id ? 'Editar polo' : 'Nuevo polo'}</h3>
                    {form.name && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{form.name}</p>}
                  </div>
                  <button type="button" className="btn-ghost btn-icon" onClick={closeEditor} aria-label="Cerrar"><X size={18} /></button>
                </div>
                <div className="tabs">
                  {[
                    { id: 'general', label: '1. Datos básicos' },
                    { id: 'prices', label: '2. Precios y escalas' },
                    { id: 'stock', label: '3. Colores, stock y fotos' }
                  ].map(tab => (
                    <button key={tab.id} type="button" className={`tab ${editorTab === tab.id ? 'active' : ''}`} onClick={() => setEditorTab(tab.id)}>{tab.label}</button>
                  ))}
                </div>
              </div>

              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* TAB 1: DATOS BÁSICOS */}
                {editorTab === 'general' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                      <div>
                        <label className="field-label" htmlFor="prod-name">Nombre del polo *</label>
                        <input id="prod-name" className="input-field" value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej. Polo Oversize Pima" />
                      </div>
                      <div>
                        <label className="field-label" htmlFor="prod-sku">Código SKU *</label>
                        <input id="prod-sku" className="input-field" value={form.sku || ''} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="Ej. POL-OVS-BLK" />
                      </div>
                    </div>

                    <div>
                      <label className="field-label" htmlFor="prod-cat">Categoría</label>
                      <select id="prod-cat" className="input-field" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="field-label" htmlFor="prod-desc">Descripción</label>
                      <textarea id="prod-desc" className="input-field" style={{ minHeight: '120px' }}
                        placeholder="Describe el polo. Los saltos de línea se verán reflejados al cliente."
                        value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                      <input type="checkbox" checked={!!form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} style={{ width: '18px', height: '18px' }} />
                      Activo (visible en la tienda pública)
                    </label>
                  </>
                )}

                {/* TAB 2: PRECIOS Y ESCALAS */}
                {editorTab === 'prices' && (
                  <>
                    <div style={subtleSection}>
                      <div style={sectionTitle}>Tallas activas</div>
                      <p style={sectionHint}>Cada talla activa necesita su precio regular.</p>
                      <SizeToggles sizes={form.sizes} onToggle={toggleSize} />
                    </div>

                    {form.sizes.length === 0 ? (
                      <div style={sectionStyle}>
                        <div style={sectionTitle}>Precio general</div>
                        <p style={sectionHint}>Este polo no maneja tallas; usa un único precio.</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                          <div>
                            <label className="field-label">Precio regular (S/.)</label>
                            <input type="number" step="0.01" min="0" className="input-field" value={form.price ?? ''} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                          </div>
                          <div>
                            <label className="field-label">Precio oferta (S/.)</label>
                            <input type="number" step="0.01" min="0" className="input-field" placeholder="Opcional" value={form.offer_price ?? ''} onChange={e => setForm(f => ({ ...f, offer_price: e.target.value }))} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                          <div style={sectionTitle}>Precios y escalas por talla</div>
                          <p style={{ ...sectionHint, marginBottom: 0 }}>Precio regular obligatorio, oferta opcional y escalas al por mayor por talla.</p>
                        </div>
                        {form.sizes.map(size => {
                          const sizeData = form.size_prices?.[size] || {};
                          const sizeTiers = sizeData.wholesale_tiers || [];
                          const missingPrice = !(parseFloat(sizeData.price) > 0);
                          return (
                            <div key={size} style={{ ...sectionStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
                                <span className="badge badge-primary" style={{ fontSize: '13px', padding: '4px 12px' }}>Talla {size}</span>
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                  <div style={{ width: '130px' }}>
                                    <label className="field-label" style={{ fontSize: '12px' }}>P. regular (S/.) *</label>
                                    <input type="number" step="0.01" min="0" placeholder="59.00" className="input-field"
                                      style={missingPrice ? { borderColor: 'var(--color-warning)' } : undefined}
                                      value={sizeData.price ?? ''} onChange={e => setSizePrice(size, { price: e.target.value })} />
                                  </div>
                                  <div style={{ width: '130px' }}>
                                    <label className="field-label" style={{ fontSize: '12px' }}>P. oferta (S/.)</label>
                                    <input type="number" step="0.01" min="0" placeholder="Opcional" className="input-field"
                                      value={sizeData.offer_price ?? ''} onChange={e => setSizePrice(size, { offer_price: e.target.value })} />
                                  </div>
                                </div>
                              </div>

                              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Escalas de descuento</div>
                                {sizeTiers.length === 0 ? (
                                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Sin escalas para esta talla.</p>
                                ) : (
                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                    {sizeTiers.map((tier, idx) => (
                                      <span key={`${tier.min_qty}-${idx}`} className="badge badge-info" style={{ padding: '4px 6px 4px 12px' }}>
                                        Desde {tier.min_qty} uds: S/. {money(tier.price)} c/u
                                        <button type="button" aria-label="Quitar escala" onClick={() => setSizePrice(size, { wholesale_tiers: sizeTiers.filter((_, i) => i !== idx) })}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'inline-flex', padding: '2px' }}><X size={12} /></button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                  <div style={{ flex: '1 1 110px' }}>
                                    <label className="field-label" style={{ fontSize: '12px' }}>Mín. unidades</label>
                                    <input type="number" min="1" placeholder="6" className="input-field" value={newSizeTierQty[size] || ''} onChange={e => setNewSizeTierQty(prev => ({ ...prev, [size]: e.target.value }))} />
                                  </div>
                                  <div style={{ flex: '1 1 110px' }}>
                                    <label className="field-label" style={{ fontSize: '12px' }}>Precio c/u (S/.)</label>
                                    <input type="number" step="0.01" min="0" placeholder="45.00" className="input-field" value={newSizeTierPrice[size] || ''} onChange={e => setNewSizeTierPrice(prev => ({ ...prev, [size]: e.target.value }))} />
                                  </div>
                                  <button type="button" className="btn-secondary" onClick={() => addSizeTier(size)}><Plus size={14} /> Escala</button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Promociones simples */}
                    <div style={subtleSection}>
                      <div style={sectionTitle}>Promociones por paquete</div>
                      <p style={sectionHint}>Precio fijo por paquete (ej. 3 polos por S/. 80). Aplican a todas las tallas.</p>
                      {(form.simple_promos || []).length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                          {form.simple_promos.map((promo, idx) => (
                            <div key={`${promo.qty}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-card)', padding: '8px 8px 8px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                              <span style={{ fontSize: '13px', flex: 1 }}>
                                <strong>{promo.qty}</strong> unidades por <strong style={{ color: 'var(--color-primary)' }}>S/. {money(promo.price)}</strong>
                                <span style={{ color: 'var(--text-secondary)' }}> (S/. {money(promo.qty ? promo.price / promo.qty : 0)} c/u)</span>
                              </span>
                              <button type="button" className="btn-ghost btn-icon btn-sm" aria-label="Quitar promoción" style={{ color: 'var(--color-danger)' }}
                                onClick={() => setForm(f => ({ ...f, simple_promos: f.simple_promos.filter((_, i) => i !== idx) }))}><X size={14} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 130px' }}>
                          <label className="field-label" style={{ fontSize: '12px' }}>Cantidad de polos</label>
                          <input type="number" min="1" placeholder="3" className="input-field" value={newPromo.qty} onChange={e => setNewPromo(p => ({ ...p, qty: e.target.value }))} />
                        </div>
                        <div style={{ flex: '1 1 130px' }}>
                          <label className="field-label" style={{ fontSize: '12px' }}>Precio del paquete (S/.)</label>
                          <input type="number" step="0.01" min="0" placeholder="80.00" className="input-field" value={newPromo.price} onChange={e => setNewPromo(p => ({ ...p, price: e.target.value }))} />
                        </div>
                        <button type="button" className="btn-secondary" onClick={addPromo}><Plus size={14} /> Promoción</button>
                      </div>
                    </div>
                  </>
                )}

                {/* TAB 3: COLORES, STOCK Y FOTOS */}
                {editorTab === 'stock' && (
                  <>
                    <div style={subtleSection}>
                      <div style={sectionTitle}>1. Tallas activas</div>
                      <p style={sectionHint}>El stock por talla se pide solo para las tallas activas.</p>
                      <SizeToggles sizes={form.sizes} onToggle={toggleSize} />
                    </div>

                    <div style={sectionStyle}>
                      <div style={sectionTitle}>2. Colores</div>
                      <p style={sectionHint}>
                        {preferredColors.length > 0 ? 'Toca un color para agregarlo o quitarlo.' : 'Paleta sugerida. Los colores personalizados que crees se guardarán como preferidos.'}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 4px', marginBottom: '16px' }}>
                        {palette.map(preset => (
                          <Swatch key={preset.hex} color={preset}
                            selected={form.colors.some(c => sameHex(c.hex, preset.hex))}
                            onClick={() => toggleColor(preset)}
                            onDelete={preferredColors.length > 0 ? (e) => handleDeletePreferredColor(e, preset.hex) : null} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input type="color" value={customColor.hex} onChange={e => setCustomColor(c => ({ ...c, hex: e.target.value }))} aria-label="Elegir color"
                          style={{ width: '40px', height: '40px', padding: '3px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', cursor: 'pointer', background: 'var(--bg-card)' }} />
                        <input placeholder="Nombre del color (ej. Verde Oliva)" className="input-field" style={{ flex: '1 1 200px', width: 'auto' }}
                          value={customColor.name} onChange={e => setCustomColor(c => ({ ...c, name: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomColor(); } }} />
                        <button type="button" className="btn-secondary" onClick={addCustomColor}><Plus size={14} /> Añadir color</button>
                      </div>
                    </div>

                    {form.colors.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={sectionTitle}>3. Stock y fotos por color</div>
                        {form.colors.map(c => {
                          const sizesStock = c.sizes_stock || {};
                          const hasBreakdown = Object.keys(sizesStock).length > 0;
                          const busy = uploadingColorHex && sameHex(uploadingColorHex, c.hex);
                          return (
                            <div key={c.hex} style={{ ...subtleSection, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <span style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: c.hex, border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
                                <span style={{ fontSize: '14px', fontWeight: 600, flex: 1 }}>{c.name}</span>
                                {stockBadge(toInt(c.stock))}
                                <button type="button" className="btn-ghost btn-sm" onClick={() => removeColor(c.hex)} style={{ color: 'var(--color-danger)' }}><Trash2 size={14} /> Quitar</button>
                              </div>

                              {/* Fotos del color */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Fotos ({(c.images || []).length})</span>
                                  <label className="btn-secondary btn-sm" style={{ cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                                    {busy ? <><Loader2 size={14} style={SPIN} /> Subiendo...</> : <><Upload size={14} /> Agregar fotos</>}
                                    <input type="file" accept="image/*" multiple disabled={!!busy} style={{ display: 'none' }} onChange={e => handleColorImagesUpload(e, c.hex)} />
                                  </label>
                                </div>
                                {(c.images || []).length > 0 ? (
                                  <ImageThumbs images={c.images}
                                    onRemove={idx => updateColorImages(c.hex, imgs => imgs.filter((_, i) => i !== idx))}
                                    onMakeMain={idx => updateColorImages(c.hex, imgs => moveToFront(imgs, idx))} />
                                ) : (
                                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sin fotos. La primera que subas será la principal.</span>
                                )}
                              </div>

                              {form.sizes.length > 0 ? (
                                <div>
                                  {!hasBreakdown && toInt(c.stock) > 0 && (
                                    <p className="field-hint" style={{ marginTop: 0, marginBottom: '8px' }}>
                                      Este color tiene {toInt(c.stock)} uds sin desglose por talla. Al ingresar el stock por talla, el total se recalculará.
                                    </p>
                                  )}
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: '8px' }}>
                                    {form.sizes.map(size => (
                                      <div key={size}>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textAlign: 'center' }}>{size}</label>
                                        <input type="number" min="0" className="input-field" style={{ textAlign: 'center', padding: '8px 6px', fontVariantNumeric: 'tabular-nums' }}
                                          value={sizesStock[size] ?? 0}
                                          onFocus={e => e.target.select()}
                                          onChange={e => updateColorSizeStock(c.hex, size, e.target.value)} />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Stock de este color:</span>
                                  <input type="number" min="0" className="input-field" style={{ width: '100px', textAlign: 'center' }}
                                    value={c.stock ?? 0} onFocus={e => e.target.select()} onChange={e => updateColorStock(c.hex, e.target.value)} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, paddingTop: '4px' }}>
                          Stock total: <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formTotalStock}</span> unidades
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={sectionStyle}>
                          <div style={sectionTitle}>Stock total</div>
                          <p style={sectionHint}>Sin colores definidos, el stock se ingresa manualmente.</p>
                          <input type="number" min="0" className="input-field" style={{ maxWidth: '140px' }}
                            value={form.stock ?? ''} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
                        </div>

                        <div style={sectionStyle}>
                          <div style={sectionTitle}>Fotos del producto</div>
                          <p style={sectionHint}>Se usan cuando el polo no tiene colores. La primera es la principal.</p>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            <label className="btn-secondary" style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
                              {uploading ? <><Loader2 size={14} style={SPIN} /> Subiendo...</> : <><Upload size={14} /> Subir fotos</>}
                              <input type="file" accept="image/*" multiple disabled={uploading} style={{ display: 'none' }} onChange={handleImageUpload} />
                            </label>
                            <div style={{ display: 'flex', gap: '8px', flex: '1 1 260px' }}>
                              <input className="input-field" placeholder="o pega una URL https://..." value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addImageByUrl(); } }} />
                              <button type="button" className="btn-secondary" onClick={addImageByUrl} aria-label="Agregar URL"><Link2 size={14} /></button>
                            </div>
                          </div>
                          {(form.images || []).length > 0 ? (
                            <ImageThumbs images={form.images}
                              onRemove={idx => setGeneralImages(form.images.filter((_, i) => i !== idx))}
                              onMakeMain={idx => setGeneralImages(moveToFront(form.images, idx))} />
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Aún no hay fotos.</span>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', padding: '16px 24px', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}>
                <button type="button" onClick={closeEditor} className="btn-secondary" disabled={saving}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving || uploading || !!uploadingColorHex} style={{ opacity: saving ? 0.7 : 1 }}>
                  {saving ? <><Loader2 size={16} style={SPIN} /> Guardando...</> : (form.id ? 'Guardar cambios' : 'Crear polo')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================== MODAL CATEGORÍA ======================== */}
      {isEditingCat && (
        <div className="modal-overlay" onClick={closeCatEditor}>
          <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={catForm.id ? 'Editar categoría' : 'Nueva categoría'}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>{catForm.id ? 'Editar categoría' : 'Nueva categoría'}</h3>
              <button type="button" className="btn-ghost btn-icon" onClick={closeCatEditor} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmitCat} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="field-label" htmlFor="cat-name">Nombre *</label>
                <input id="cat-name" required className="input-field" placeholder="Ej. Polos Oversize" value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="field-label" htmlFor="cat-slug">Slug URL</label>
                <input id="cat-slug" className="input-field" placeholder="polos-oversize" value={catForm.slug} onChange={e => setCatForm(f => ({ ...f, slug: e.target.value }))} />
                <p className="field-hint">Si lo dejas vacío se genera a partir del nombre.</p>
              </div>
              <div>
                <label className="field-label" htmlFor="cat-desc">Descripción</label>
                <textarea id="cat-desc" className="input-field" rows={2} value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Imagen</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {catForm.image_url
                    ? <img src={catForm.image_url} alt="" style={{ width: '88px', height: '88px', objectFit: 'cover', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }} />
                    : <div style={{ width: '88px', height: '88px', borderRadius: 'var(--radius)', border: '1px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-subtle)' }}><Layers size={20} style={{ color: 'var(--text-muted)' }} /></div>}
                  <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label className="btn-secondary btn-sm" style={{ alignSelf: 'flex-start', cursor: catUploading ? 'not-allowed' : 'pointer', opacity: catUploading ? 0.6 : 1 }}>
                      {catUploading ? <><Loader2 size={14} style={SPIN} /> Subiendo...</> : <><Upload size={14} /> Subir imagen</>}
                      <input type="file" accept="image/*" disabled={catUploading} onChange={handleCatImageUpload} style={{ display: 'none' }} />
                    </label>
                    <input className="input-field" placeholder="o pega una URL https://..." value={catForm.image_url} onChange={e => setCatForm(f => ({ ...f, image_url: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px', flexWrap: 'wrap' }}>
                <button type="button" onClick={closeCatEditor} className="btn-secondary" disabled={savingCat}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={savingCat || catUploading}>
                  {savingCat ? <><Loader2 size={16} style={SPIN} /> Guardando...</> : 'Guardar categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
