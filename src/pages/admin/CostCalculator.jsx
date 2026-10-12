import { useState, useMemo, useEffect, useRef } from 'react';
import { DataService } from '../../services/dataService';
import {
  Plus, Trash2, Edit3, CheckCircle, FileSpreadsheet, RefreshCw, Layers,
  DollarSign, Package, ToggleLeft, ToggleRight, ArrowLeft, Save, List, BarChart3, AlertCircle
} from 'lucide-react';
import { toast } from '../../utils/toast';

// ---------- Constantes y utilidades (módulo) ----------

const STORAGE_KEY = 'arven_manufacturing_projects';
const CATEGORIES = ['Polos', 'Calzado', 'Accesorios', 'Importaciones', 'Calzados', 'Otros'];
const STATES = ['En proceso', 'Finalizado', 'Archivado'];

const MARGIN_DEFS = [
  { key: 'mayorista', label: 'Mayorista', min: 25, max: 40, color: '#059669' },
  { key: 'minorista', label: 'Minorista', min: 50, max: 80, color: '#2563EB' },
  { key: 'distribuidor', label: 'Distribuidor', min: 15, max: 25, color: '#7C3AED' },
  { key: 'vip', label: 'Precio VIP', min: 35, max: 60, color: '#DB2777' },
  { key: 'volumen', label: 'Por volumen', min: 10, max: 20, color: '#D97706' }
];
const DEFAULT_MARGINS = { mayorista: 30, minorista: 50, distribuidor: 20, vip: 40, volumen: 15 };
// Nombre del campo en el proyecto guardado (compatibilidad con datos existentes)
const MARGIN_FIELD = { mayorista: 'marginMayorista', minorista: 'marginMinorista', distribuidor: 'marginDistribuidor', vip: 'marginVIP', volumen: 'marginVolumen' };

const IMPORT_LABELS = {
  fob: 'Valor FOB', freight: 'Flete', insurance: 'Seguro', aduanas: 'Gastos de aduana', aranceles: 'Aranceles',
  igvImport: 'IGV importación', agente: 'Agente de aduanas', transportNac: 'Transporte nacional', almacenaje: 'Almacenaje', otros: 'Otros'
};
const OP_LABELS = {
  alquiler: 'Alquiler', sueldos: 'Sueldos', marketing: 'Marketing', comisiones: 'Comisiones', plataforma: 'Plataformas / apps', servicios: 'Servicios'
};
const emptyImport = () => Object.fromEntries(Object.keys(IMPORT_LABELS).map(k => [k, '0']));
const emptyOp = () => Object.fromEntries(Object.keys(OP_LABELS).map(k => [k, '0']));
const defaultFabricCosts = (zero = true) => [
  { id: 'tela', label: 'Tela / Rollo', value: zero ? '0' : '1800', type: 'total_lote' },
  { id: 'corte', label: 'Corte', value: '0', type: 'per_unit' },
  { id: 'confeccion', label: 'Confección / Costura', value: zero ? '0' : '8', type: 'per_unit' },
  { id: 'estampado', label: 'Estampado / Ploteo', value: zero ? '0' : '6', type: 'per_unit' },
  { id: 'limpieza', label: 'Limpieza / Acabado', value: zero ? '0' : '1', type: 'per_unit' },
  { id: 'empaque', label: 'Bolsas / Empaque', value: zero ? '0' : '1.5', type: 'per_unit' }
];

const uid = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Convierte a número finito (0 si vacío o inválido). */
const toNum = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
/** Válido si está vacío o es un número finito >= 0. */
const isValidAmount = (v) => {
  if (v === '' || v === null || v === undefined) return true;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0;
};
const fmtNum = (n) => {
  const x = Number(n);
  return Number.isFinite(x) ? x.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
};
const symbolOf = (currency) => (currency === 'USD' ? '$' : 'S/.');
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Costeo único usado por el editor, la lista, los reportes y la exportación
 * (antes cada vista calculaba distinto: algunas omitían la compra unitaria o los gastos operativos).
 */
function computeCosts(p) {
  const qty = toNum(p.unitsQty) > 0 ? toNum(p.unitsQty) : 1;
  const acqUnit = p.purchaseType === 'unit' ? toNum(p.acquisitionCost) : 0;

  let fabLot = 0;
  (p.fabricCosts || []).forEach(f => {
    const v = toNum(f.value);
    fabLot += f.type === 'per_unit' ? v * qty : v;
  });
  const impLot = Object.values(p.importCosts || {}).reduce((s, v) => s + toNum(v), 0);
  const opLot = Object.values(p.opCosts || {}).reduce((s, v) => s + toNum(v), 0);
  const acqLot = acqUnit * qty;

  const baseLot = acqLot + fabLot + impLot;
  const lotCost = p.includeOpCosts ? baseLot + opLot : baseLot;
  const unitCost = lotCost / qty;

  const prices = {};
  MARGIN_DEFS.forEach(({ key }) => {
    const m = toNum(p[MARGIN_FIELD[key]] ?? DEFAULT_MARGINS[key]);
    prices[key] = unitCost * (1 + m / 100);
  });

  return { qty, acqLot, fabLot, impLot, opLot, lotCost, unitCost, prices };
}

const DEMO_PROJECT = {
  id: 'demo-1',
  projectName: 'Lote Polos Oversize Premium',
  category: 'Polos',
  brand: 'Arven',
  provider: 'Texcope',
  status: 'En proceso',
  date: new Date().toLocaleDateString('es-PE'),
  currency: 'PEN',
  exchangeRate: 3.75,
  unitsQty: 120,
  purchaseType: 'fabric_roll',
  acquisitionCost: 1800,
  fabricCosts: defaultFabricCosts(false).filter(f => f.id !== 'corte'),
  fabricKilosInput: [{ id: 'roll1', label: 'Rollo Jersey 30/1', weight: '20' }],
  importCosts: emptyImport(),
  includeOpCosts: false,
  opCosts: emptyOp(),
  marginMayorista: 30, marginMinorista: 50, marginDistribuidor: 20, marginVIP: 40, marginVolumen: 15
};

const loadProjects = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('No se pudieron leer los proyectos guardados:', e);
  }
  return [DEMO_PROJECT];
};

const INVEST_COLORS = ['#4F46E5', '#DB2777', '#D97706', '#059669', '#2563EB', '#7C3AED'];
const PROFIT_COLORS = ['#059669', '#10B981', '#047857', '#34D399'];
const STATUS_BADGE = { 'Finalizado': 'badge-success', 'Archivado': '', 'En proceso': 'badge-warning' };

// ---------- Gráficos (canvas) ----------

function setupCanvas(canvas, height) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.parentElement.offsetWidth || 300;
  canvas.width = w * dpr;
  canvas.height = height * dpr;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, height);
  return { ctx, w, h: height };
}

function MiniBarChart({ data, colors, height = 160 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;
    const { ctx, w, h } = setupCanvas(canvas, height);
    const maxVal = Math.max(...data.map(d => d.value), 1);
    const barW = Math.max(8, Math.min(40, (w - 20) / data.length - 8));
    const gap = (w - data.length * barW) / (data.length + 1);
    data.forEach((d, i) => {
      const barH = Math.max(0, (d.value / maxVal) * (h - 40));
      const x = gap + i * (barW + gap);
      const y = h - 24 - barH;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
      else ctx.rect(x, y, barW, barH);
      ctx.fill();
      ctx.fillStyle = '#6B7280';
      ctx.font = '500 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.label.length > 10 ? d.label.slice(0, 10) + '…' : d.label, x + barW / 2, h - 8);
      ctx.fillStyle = '#111827';
      ctx.font = '600 10px Inter, sans-serif';
      ctx.fillText(fmtNum(d.value), x + barW / 2, y - 6);
    });
  }, [data, colors, height]);
  return <canvas ref={canvasRef} style={{ width: '100%', display: 'block' }} />;
}

function MiniLineChart({ data, color = '#4F46E5', height = 140 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;
    const { ctx, w, h } = setupCanvas(canvas, height);
    const maxVal = Math.max(...data.map(d => d.value), 1);
    const padX = 30; const padY = 20;
    const drawW = w - padX * 2; const drawH = h - padY * 2;
    ctx.strokeStyle = '#F3F4F6'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const gy = padY + (drawH / 4) * i;
      ctx.beginPath(); ctx.moveTo(padX, gy); ctx.lineTo(w - padX, gy); ctx.stroke();
    }
    const pointAt = (d, i) => ({
      x: padX + (drawW / Math.max(data.length - 1, 1)) * i,
      y: padY + drawH - (d.value / maxVal) * drawH
    });
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach((d, i) => {
      const { x, y } = pointAt(d, i);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    data.forEach((d, i) => {
      const { x, y } = pointAt(d, i);
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6B7280'; ctx.font = '500 10px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(d.label.length > 10 ? d.label.slice(0, 10) + '…' : d.label, x, h - 4);
    });
  }, [data, color, height]);
  return <canvas ref={canvasRef} style={{ width: '100%', display: 'block' }} />;
}

// ---------- UI helpers (módulo) ----------

function Card({ title, subtitle, right, children, style }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16, ...style }}>
      {(title || right) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            {title && <h3 style={{ fontSize: 16, fontWeight: 600 }}>{title}</h3>}
            {subtitle && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

function NumInput({ value, onChange, prefix, invalid, ...rest }) {
  return (
    <div style={{ position: 'relative' }}>
      {prefix && (
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-muted)', pointerEvents: 'none' }}>{prefix}</span>
      )}
      <input
        type="number" inputMode="decimal" min="0" step="0.01"
        className="input-field"
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        style={{
          textAlign: 'right', fontVariantNumeric: 'tabular-nums',
          paddingLeft: prefix ? 36 : undefined,
          borderColor: invalid ? 'var(--color-danger)' : undefined
        }}
        {...rest}
      />
    </div>
  );
}

const grid = (min) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`, gap: 12 });

// ---------- Componente principal ----------

export default function CostCalculator() {
  const [projects, setProjects] = useState(loadProjects);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'editor' | 'dashboard'
  const [integrating, setIntegrating] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // Formulario del proyecto activo
  const [editingId, setEditingId] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [category, setCategory] = useState('Polos');
  const [brand, setBrand] = useState('');
  const [provider, setProvider] = useState('');
  const [status, setStatus] = useState('En proceso');

  const [currency, setCurrency] = useState('PEN');
  const [exchangeRate, setExchangeRate] = useState('3.75'); // 1 USD = X PEN
  const currSymbol = symbolOf(currency);
  const fmt = (n) => `${currSymbol} ${fmtNum(n)}`;

  const [unitsQty, setUnitsQty] = useState('100');
  const [purchaseType, setPurchaseType] = useState('unit');
  const [acquisitionCost, setAcquisitionCost] = useState('0');
  const [fabricCosts, setFabricCosts] = useState(() => defaultFabricCosts(false));
  const [fabricKilosInput, setFabricKilosInput] = useState([{ id: 'roll1', label: 'Rollo Algodón', weight: '20' }]);

  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [newFieldType, setNewFieldType] = useState('per_unit');

  const [importCosts, setImportCosts] = useState(emptyImport);
  const [includeOpCosts, setIncludeOpCosts] = useState(false);
  const [opCosts, setOpCosts] = useState(emptyOp);
  const [margins, setMargins] = useState(DEFAULT_MARGINS);

  const persistProjects = (updated) => {
    setProjects(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
      toast.error('No se pudo guardar en este navegador (almacenamiento lleno o bloqueado).');
    }
  };

  // Proyecto "borrador" con el estado actual del formulario
  const draft = useMemo(() => ({
    unitsQty, purchaseType, acquisitionCost, fabricCosts, importCosts, includeOpCosts, opCosts,
    ...Object.fromEntries(MARGIN_DEFS.map(({ key }) => [MARGIN_FIELD[key], margins[key]]))
  }), [unitsQty, purchaseType, acquisitionCost, fabricCosts, importCosts, includeOpCosts, opCosts, margins]);

  const calc = useMemo(() => {
    const c = computeCosts(draft);
    return {
      ...c,
      totalFabricKilos: fabricKilosInput.reduce((sum, k) => sum + toNum(k.weight), 0),
      totalImportLot: c.impLot,
      totalOpLot: c.opLot,
      totalFabricationLot: c.fabLot + c.acqLot
    };
  }, [draft, fabricKilosInput]);

  // Validación de entradas numéricas (evita NaN / negativos)
  const errors = useMemo(() => {
    const e = {};
    const q = parseFloat(unitsQty);
    if (!Number.isFinite(q) || q < 1 || !Number.isInteger(q)) e.unitsQty = 'Ingresa una cantidad entera mayor a 0.';
    if (purchaseType === 'unit' && !isValidAmount(acquisitionCost)) e.acquisitionCost = 'Monto inválido.';
    fabricCosts.forEach(f => { if (!isValidAmount(f.value)) e[`fab-${f.id}`] = true; });
    Object.entries(importCosts).forEach(([k, v]) => { if (!isValidAmount(v)) e[`imp-${k}`] = true; });
    Object.entries(opCosts).forEach(([k, v]) => { if (!isValidAmount(v)) e[`op-${k}`] = true; });
    fabricKilosInput.forEach(r => { if (!isValidAmount(r.weight)) e[`kg-${r.id}`] = true; });
    const rate = parseFloat(exchangeRate);
    if (!Number.isFinite(rate) || rate <= 0) e.exchangeRate = 'Tipo de cambio inválido.';
    if (!projectName.trim()) e.projectName = 'Ingresa un nombre para el lote.';
    return e;
  }, [unitsQty, purchaseType, acquisitionCost, fabricCosts, importCosts, opCosts, fabricKilosInput, exchangeRate, projectName]);
  const hasError = (k) => showErrors && !!errors[k];

  const projectRows = useMemo(() => projects.map(p => ({ p, c: computeCosts(p) })), [projects]);

  const dashboardStats = useMemo(() => {
    let totalInvestment = 0, finishedCount = 0, inProcessCount = 0;
    projectRows.forEach(({ p, c }) => {
      // Lotes en dólares se convierten a soles con su propio T/C guardado
      const rate = p.currency === 'USD' ? (toNum(p.exchangeRate) || 1) : 1;
      totalInvestment += c.lotCost * rate;
      if (p.status === 'Finalizado') finishedCount++;
      if (p.status === 'En proceso') inProcessCount++;
    });
    return { totalInvestment, finishedCount, inProcessCount };
  }, [projectRows]);

  // ---------- Acciones del editor ----------

  const resetForm = () => {
    setShowErrors(false);
    setEditingId(null);
    setProjectName('');
    setCategory('Polos');
    setBrand('');
    setProvider('');
    setStatus('En proceso');
    setUnitsQty('100');
    setPurchaseType('unit');
    setAcquisitionCost('0');
    setFabricCosts(defaultFabricCosts(true));
    setFabricKilosInput([{ id: 'roll1', label: 'Rollo 1', weight: '0' }]);
    setImportCosts(emptyImport());
    setIncludeOpCosts(false);
    setOpCosts(emptyOp());
    setMargins(DEFAULT_MARGINS);
  };

  const handleAddNewProject = () => {
    resetForm();
    setActiveTab('editor');
  };

  const handleEditProject = (p) => {
    setShowErrors(false);
    setEditingId(p.id);
    setProjectName(p.projectName || '');
    setCategory(p.category || 'Polos');
    setBrand(p.brand || '');
    setProvider(p.provider || '');
    setStatus(p.status || 'En proceso');
    setCurrency(p.currency || 'PEN');
    setExchangeRate(String(p.exchangeRate ?? 3.75));
    setUnitsQty(String(p.unitsQty || 100));
    setPurchaseType(p.purchaseType || 'unit');
    setAcquisitionCost(String(p.acquisitionCost || 0));
    setFabricCosts((p.fabricCosts || []).map(f => ({ ...f, value: String(f.value ?? '0') })));
    setFabricKilosInput(p.fabricKilosInput?.length ? p.fabricKilosInput : [{ id: 'roll1', label: 'Rollo 1', weight: '0' }]);
    setImportCosts({ ...emptyImport(), ...(p.importCosts || {}) });
    setIncludeOpCosts(!!p.includeOpCosts);
    setOpCosts({ ...emptyOp(), ...(p.opCosts || {}) });
    setMargins(Object.fromEntries(MARGIN_DEFS.map(({ key }) => [key, p[MARGIN_FIELD[key]] ?? DEFAULT_MARGINS[key]])));
    setActiveTab('editor');
  };

  const validate = () => {
    setShowErrors(true);
    const keys = Object.keys(errors);
    if (keys.length === 0) return true;
    toast.error(errors.projectName || errors.unitsQty || errors.exchangeRate || 'Revisa los montos marcados en rojo: deben ser números mayores o iguales a 0.');
    return false;
  };

  /** Guarda el proyecto. `overrides` permite fijar campos (p. ej. estado) sin depender del setState asíncrono. */
  const handleSaveProject = (overrides = {}, { silent = false } = {}) => {
    if (!validate()) return false;
    const newProj = {
      id: editingId || uid('proj'),
      projectName: projectName.trim(),
      category,
      brand: brand.trim(),
      provider: provider.trim(),
      status,
      date: new Date().toLocaleDateString('es-PE'),
      currency,
      exchangeRate: toNum(exchangeRate),
      unitsQty: toNum(unitsQty),
      purchaseType,
      acquisitionCost: toNum(acquisitionCost),
      fabricCosts,
      fabricKilosInput,
      importCosts,
      includeOpCosts,
      opCosts,
      ...Object.fromEntries(MARGIN_DEFS.map(({ key }) => [MARGIN_FIELD[key], toNum(margins[key])])),
      ...overrides
    };
    const exists = projects.some(p => p.id === newProj.id);
    persistProjects(exists ? projects.map(p => (p.id === newProj.id ? newProj : p)) : [newProj, ...projects]);
    if (!silent) toast.success('Lote guardado');
    setActiveTab('list');
    return true;
  };

  const handleDeleteProject = (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este presupuesto/lote?')) return;
    persistProjects(projects.filter(p => p.id !== id));
    toast.success('Lote eliminado');
  };

  const handleAddCustomField = () => {
    if (!newFieldName.trim()) { toast.warning('Escribe el nombre del concepto.'); return; }
    if (!isValidAmount(newFieldValue)) { toast.warning('El costo debe ser un número mayor o igual a 0.'); return; }
    setFabricCosts(prev => [...prev, { id: uid('custom'), label: newFieldName.trim(), value: String(toNum(newFieldValue)), type: newFieldType }]);
    setNewFieldName('');
    setNewFieldValue('');
  };

  // Actualizaciones inmutables (antes se mutaban los objetos del estado)
  const updateFabric = (id, patch) => setFabricCosts(prev => prev.map(f => (f.id === id ? { ...f, ...patch } : f)));
  const removeFabric = (id) => setFabricCosts(prev => prev.filter(f => f.id !== id));
  const updateKilo = (id, patch) => setFabricKilosInput(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const addKiloRow = () => setFabricKilosInput(prev => [...prev, { id: uid('roll'), label: `Rollo ${prev.length + 1}`, weight: '0' }]);
  const removeKiloRow = (id) => setFabricKilosInput(prev => (prev.length === 1 ? prev : prev.filter(r => r.id !== id)));

  // Publica el lote como producto del inventario (precios siempre en soles)
  const handleIntegrateInventory = async () => {
    if (integrating || !validate()) return;
    const rate = currency === 'USD' ? toNum(exchangeRate) : 1;
    const toPen = (v) => Math.round(v * rate * 100) / 100;
    const unitPen = toPen(calc.unitCost);
    const retailPen = toPen(calc.prices.minorista);
    const wholesalePen = toPen(calc.prices.mayorista);

    if (!window.confirm(
      `¿Registrar "${projectName.trim()}" en el inventario?\n\n` +
      `Costo unitario: S/. ${fmtNum(unitPen)}\nPrecio de venta (minorista): S/. ${fmtNum(retailPen)}\n` +
      `Precio mayorista: S/. ${fmtNum(wholesalePen)}\nStock inicial: ${Math.round(calc.qty)} uds` +
      (currency === 'USD' ? `\n\n(Convertido con T/C ${fmtNum(rate)})` : '')
    )) return;

    setIntegrating(true);
    try {
      let categoryId = null;
      try {
        const cats = await DataService.getCategories();
        categoryId = (cats || []).find(c => (c.name || '').toLowerCase() === category.toLowerCase())?.id ?? null;
      } catch (e) {
        console.error(e);
      }

      await DataService.saveProduct({
        name: projectName.trim(),
        category_id: categoryId,
        price: retailPen,
        offer_price: null,
        wholesale_price: wholesalePen,
        stock: Math.round(calc.qty),
        image_url: '',
        images: [],
        colors: [],
        sizes: [],
        active: true,
        description: `Lote ${projectName.trim()} (${category}). Costo por unidad: S/. ${fmtNum(unitPen)}`
      });

      setStatus('Finalizado');
      handleSaveProject({ status: 'Finalizado' }, { silent: true });
      toast.success('Producto creado en el inventario. Ya puedes venderlo desde el POS; recuerda añadirle imagen.');
    } catch (err) {
      console.error(err);
      toast.error(`No se pudo publicar en el inventario: ${err?.message || 'verifica tu conexión.'}`);
    } finally {
      setIntegrating(false);
    }
  };

  // Exportar a Excel (.xls vía tabla HTML)
  const handleExportSpreadsheet = (p) => {
    const c = computeCosts(p);
    const sym = symbolOf(p.currency);
    const money = (v) => `${sym} ${fmtNum(v)}`;
    const rows = (p.fabricCosts || []).map(f => {
      const v = toNum(f.value);
      const lotVal = f.type === 'per_unit' ? v * c.qty : v;
      return `<tr><td>${escapeHtml(f.label)}</td><td>${f.type === 'per_unit' ? 'Por unidad' : 'Por lote'}</td><td>${money(lotVal)}</td><td>${money(lotVal / c.qty)}</td></tr>`;
    }).join('');

    const priceRows = MARGIN_DEFS.map(({ key, label }) =>
      `<tr><td>${label}</td><td>${toNum(p[MARGIN_FIELD[key]] ?? DEFAULT_MARGINS[key])}%</td><td class="highlight">${money(c.prices[key])}</td></tr>`
    ).join('');

    const xls = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"/><style>
        table { border-collapse: collapse; font-family: Segoe UI, Arial; }
        th { background-color: #111827; color: #ffffff; font-weight: bold; font-size: 11px; }
        td, th { border: 1px solid #dddddd; padding: 8px; text-align: left; font-size: 11px; }
        .total-row { background-color: #f9fafb; font-weight: bold; }
        .highlight { color: #059669; font-weight: bold; }
      </style></head>
      <body>
      <h2>Presupuesto: ${escapeHtml(p.projectName)}</h2>
      <table>
        <tr><td><strong>Categoría</strong></td><td>${escapeHtml(p.category)}</td><td><strong>Marca</strong></td><td>${escapeHtml(p.brand || '—')}</td></tr>
        <tr><td><strong>Proveedor</strong></td><td>${escapeHtml(p.provider || '—')}</td><td><strong>Estado</strong></td><td>${escapeHtml(p.status)}</td></tr>
        <tr><td><strong>Unidades</strong></td><td>${c.qty}</td><td><strong>Fecha</strong></td><td>${escapeHtml(p.date)}</td></tr>
      </table>
      <br/>
      <h3>Detalle de costos</h3>
      <table>
        <tr><th>Concepto</th><th>Modo</th><th>Total lote</th><th>Costo unitario</th></tr>
        ${c.acqLot > 0 ? `<tr><td>Compra por unidad</td><td>Por unidad</td><td>${money(c.acqLot)}</td><td>${money(c.acqLot / c.qty)}</td></tr>` : ''}
        ${rows}
        <tr class="total-row"><td colspan="2">SUBTOTAL FABRICACIÓN</td><td>${money(c.fabLot + c.acqLot)}</td><td>${money((c.fabLot + c.acqLot) / c.qty)}</td></tr>
        <tr><td colspan="2">Importación (distribuido)</td><td>${money(c.impLot)}</td><td>${money(c.impLot / c.qty)}</td></tr>
        ${p.includeOpCosts ? `<tr><td colspan="2">Gastos operativos (distribuido)</td><td>${money(c.opLot)}</td><td>${money(c.opLot / c.qty)}</td></tr>` : ''}
        <tr class="total-row"><td colspan="2">COSTO TOTAL</td><td>${money(c.lotCost)}</td><td>${money(c.unitCost)}</td></tr>
      </table>
      <br/>
      <h3>Lista de precios sugeridos</h3>
      <table>
        <tr><th>Canal</th><th>Margen</th><th>Precio unitario</th></tr>
        ${priceRows}
      </table>
      </body></html>
    `;

    const blob = new Blob([xls], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Costos_${String(p.projectName || 'lote').replace(/[^\w-]+/g, '_')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('Excel exportado');
  };

  // ---------- Datos para reportes ----------
  const chartData = useMemo(() => ({
    investment: projectRows.map(({ p, c }) => ({ label: p.projectName || '—', value: c.lotCost })),
    unitCost: projectRows.map(({ p, c }) => ({ label: p.projectName || '—', value: c.unitCost })),
    profit: projectRows.map(({ p, c }) => ({ label: p.projectName || '—', value: (c.prices.mayorista - c.unitCost) * c.qty }))
  }), [projectRows]);
  const avgMargin = projects.length > 0
    ? projects.reduce((s, p) => s + toNum(p.marginMayorista ?? DEFAULT_MARGINS.mayorista), 0) / projects.length
    : 0;

  const tabBtn = (id, label, Icon) => (
    <button type="button" className={`tab${activeTab === id ? ' active' : ''}`} onClick={() => setActiveTab(id)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Icon size={15} /> {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1200, margin: '0 auto', width: '100%' }}>

      <div className="page-header" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="stat-icon" style={{ width: 44, height: 44, borderRadius: 'var(--radius)', background: 'var(--color-primary-soft)', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={22} />
          </div>
          <div>
            <h1>Costos de fabricación</h1>
            <p>Costea lotes, importaciones y gastos, define precios y publícalos en el inventario.</p>
          </div>
        </div>
        <button type="button" className="btn-primary" onClick={handleAddNewProject} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Plus size={16} /> Nuevo lote
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="tabs">
          {tabBtn('list', 'Mis lotes', List)}
          {tabBtn('dashboard', 'Reportes', BarChart3)}
          {activeTab === 'editor' && tabBtn('editor', editingId ? 'Editando lote' : 'Nuevo lote', Edit3)}
        </div>

        {activeTab === 'editor' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="tabs" style={{ padding: 3 }}>
              <button type="button" className={`tab${currency === 'PEN' ? ' active' : ''}`} onClick={() => setCurrency('PEN')}>Soles (S/.)</button>
              <button type="button" className={`tab${currency === 'USD' ? ' active' : ''}`} onClick={() => setCurrency('USD')}>Dólares ($)</button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
              T/C 1 USD =
              <input type="number" inputMode="decimal" min="0" step="0.01" className="input-field" value={exchangeRate}
                onChange={e => setExchangeRate(e.target.value)}
                style={{ width: 90, minHeight: 36, padding: '6px 8px', textAlign: 'center', borderColor: hasError('exchangeRate') ? 'var(--color-danger)' : undefined }} />
              PEN
            </label>
          </div>
        )}
      </div>

      {/* ==================== LISTA ==================== */}
      {activeTab === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 16 }}>
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">Inversión total proyectada</span>
                <span className="stat-icon" style={{ background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}><DollarSign size={18} /></span>
              </div>
              <span className="stat-value">S/. {fmtNum(dashboardStats.totalInvestment)}</span>
            </div>
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">Lotes en proceso</span>
                <span className="stat-icon"><RefreshCw size={18} /></span>
              </div>
              <span className="stat-value">{dashboardStats.inProcessCount}</span>
            </div>
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">Lotes finalizados</span>
                <span className="stat-icon" style={{ background: 'var(--color-success-soft)', color: 'var(--color-success)' }}><CheckCircle size={18} /></span>
              </div>
              <span className="stat-value">{dashboardStats.finishedCount}</span>
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="card empty-state">
              <Layers size={36} style={{ opacity: 0.4 }} />
              <h3>Aún no tienes lotes</h3>
              <p>Crea tu primer presupuesto de fabricación o importación.</p>
              <button type="button" className="btn-primary" onClick={handleAddNewProject} style={{ marginTop: 8 }}><Plus size={16} /> Nuevo lote</button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Proyecto / lote</th>
                    <th>Categoría</th>
                    <th>Marca / proveedor</th>
                    <th style={{ textAlign: 'right' }}>Unidades</th>
                    <th style={{ textAlign: 'right' }}>Costo unit.</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {projectRows.map(({ p, c }) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.projectName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.date}</div>
                      </td>
                      <td>{p.category}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{p.brand || '—'} / {p.provider || '—'}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.unitsQty}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{symbolOf(p.currency)} {fmtNum(c.unitCost)}</td>
                      <td><span className={`badge ${STATUS_BADGE[p.status] ?? ''}`}>{p.status}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <button type="button" className="btn-ghost btn-icon" onClick={() => handleEditProject(p)} title="Editar"><Edit3 size={16} /></button>
                          <button type="button" className="btn-ghost btn-icon" onClick={() => handleExportSpreadsheet(p)} title="Exportar a Excel" style={{ color: 'var(--color-success)' }}><FileSpreadsheet size={16} /></button>
                          <button type="button" className="btn-ghost btn-icon" onClick={() => handleDeleteProject(p.id)} title="Eliminar" style={{ color: 'var(--color-danger)' }}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== EDITOR ==================== */}
      {activeTab === 'editor' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>

          <div style={{ flex: '1 1 540px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {showErrors && Object.keys(errors).length > 0 && (
              <div className="alert alert-danger"><AlertCircle size={16} /> Hay campos con valores inválidos. Revisa los marcados en rojo.</div>
            )}

            <Card title="1. Información del lote">
              <div style={grid(220)}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="field-label">Nombre del producto / lote *</label>
                  <input type="text" className="input-field" value={projectName} onChange={e => setProjectName(e.target.value)}
                    placeholder="Ej. Polos Boxy Algodón Pima" style={{ borderColor: hasError('projectName') ? 'var(--color-danger)' : undefined }} />
                </div>
                <div>
                  <label className="field-label">Categoría</label>
                  <select className="input-field" value={category} onChange={e => setCategory(e.target.value)}>
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Estado</label>
                  <select className="input-field" value={status} onChange={e => setStatus(e.target.value)}>
                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Marca</label>
                  <input type="text" className="input-field" value={brand} onChange={e => setBrand(e.target.value)} placeholder="Ej. Arven" />
                </div>
                <div>
                  <label className="field-label">Proveedor</label>
                  <input type="text" className="input-field" value={provider} onChange={e => setProvider(e.target.value)} placeholder="Ej. Importador Lima" />
                </div>
              </div>
            </Card>

            <Card title="2. Adquisición y cantidades" subtitle="Usa punto para decimales (ej. 1800.50).">
              <div style={grid(180)}>
                <div>
                  <label className="field-label">Unidades del lote *</label>
                  <input type="number" inputMode="numeric" min="1" step="1" className="input-field" value={unitsQty}
                    onChange={e => setUnitsQty(e.target.value)} placeholder="Ej. 120"
                    style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', borderColor: hasError('unitsQty') ? 'var(--color-danger)' : undefined }} />
                  {hasError('unitsQty') && <p className="field-hint" style={{ color: 'var(--color-danger)' }}>{errors.unitsQty}</p>}
                </div>
                <div>
                  <label className="field-label">Modo de compra</label>
                  <select className="input-field" value={purchaseType} onChange={e => setPurchaseType(e.target.value)}>
                    <option value="unit">Por unidad</option>
                    <option value="fabric_roll">Materia prima / rollo</option>
                    <option value="box">Por caja</option>
                    <option value="pack">Por paquete</option>
                  </select>
                </div>
                {purchaseType === 'unit' && (
                  <div>
                    <label className="field-label">Precio de compra unitario</label>
                    <NumInput prefix={currSymbol} value={acquisitionCost} onChange={setAcquisitionCost} invalid={hasError('acquisitionCost')} placeholder="0.00" />
                  </div>
                )}
              </div>
              {purchaseType !== 'unit' && (
                <p className="field-hint" style={{ marginTop: 0 }}>Registra el costo del rollo, caja o paquete como concepto “Por lote” en la sección 3.</p>
              )}
            </Card>

            <Card title="3. Costos de fabricación" subtitle="Cada concepto puede ser por unidad o por el lote completo.">
              <div style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--radius)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Rollos / kilos de tela</span>
                  <button type="button" className="btn-secondary btn-sm" onClick={addKiloRow}><Plus size={14} /> Añadir rollo</button>
                </div>
                <div style={grid(220)}>
                  {fabricKilosInput.map(row => (
                    <div key={row.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="text" className="input-field" value={row.label} onChange={e => updateKilo(row.id, { label: e.target.value })}
                        placeholder="Nombre / tipo" style={{ flex: 1.3, minWidth: 0 }} />
                      <input type="number" inputMode="decimal" min="0" step="0.01" className="input-field" value={row.weight}
                        onChange={e => updateKilo(row.id, { weight: e.target.value })} placeholder="kg"
                        style={{ flex: 0.8, minWidth: 0, textAlign: 'right', borderColor: hasError(`kg-${row.id}`) ? 'var(--color-danger)' : undefined }} />
                      <button type="button" className="btn-ghost btn-icon" onClick={() => removeKiloRow(row.id)} disabled={fabricKilosInput.length === 1}
                        title="Quitar rollo" style={{ color: 'var(--color-danger)', flexShrink: 0 }}><Trash2 size={15} /></button>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>Total: {fmtNum(calc.totalFabricKilos)} kg</div>
              </div>

              {fabricCosts.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Sin conceptos. Añade uno abajo.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fabricCosts.map(item => (
                  <div key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                    <span style={{ flex: '1 1 160px', fontSize: 14, fontWeight: 500 }}>{item.label}</span>
                    <div className="tabs" style={{ padding: 3 }}>
                      <button type="button" className={`tab${item.type === 'per_unit' ? ' active' : ''}`} style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => updateFabric(item.id, { type: 'per_unit' })}>Por unidad</button>
                      <button type="button" className={`tab${item.type === 'total_lote' ? ' active' : ''}`} style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => updateFabric(item.id, { type: 'total_lote' })}>Por lote</button>
                    </div>
                    <div style={{ width: 140 }}>
                      <NumInput prefix={currSymbol} value={item.value} onChange={v => updateFabric(item.id, { value: v })} invalid={hasError(`fab-${item.id}`)} placeholder="0.00" />
                    </div>
                    <button type="button" className="btn-ghost btn-icon" onClick={() => removeFabric(item.id)} title="Eliminar concepto" style={{ color: 'var(--color-danger)' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px dashed var(--border-color)', paddingTop: 14, alignItems: 'center' }}>
                <input type="text" className="input-field" value={newFieldName} onChange={e => setNewFieldName(e.target.value)}
                  placeholder="Nuevo concepto (ej. Bordado)" style={{ flex: '2 1 180px' }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomField(); } }} />
                <select className="input-field" value={newFieldType} onChange={e => setNewFieldType(e.target.value)} style={{ flex: '1 1 130px' }}>
                  <option value="per_unit">Por unidad</option>
                  <option value="total_lote">Por lote</option>
                </select>
                <div style={{ flex: '1 1 110px' }}>
                  <NumInput prefix={currSymbol} value={newFieldValue} onChange={setNewFieldValue} placeholder="0.00" />
                </div>
                <button type="button" className="btn-secondary" onClick={handleAddCustomField}><Plus size={15} /> Añadir</button>
              </div>
            </Card>

            <Card title="4. Costos de importación" subtitle="Montos totales del lote; se reparten entre todas las unidades.">
              <div style={grid(150)}>
                {Object.keys(importCosts).map(key => (
                  <div key={key}>
                    <label className="field-label" style={{ fontSize: 12 }}>{IMPORT_LABELS[key] || key}</label>
                    <NumInput value={importCosts[key]} onChange={v => setImportCosts(prev => ({ ...prev, [key]: v }))} invalid={hasError(`imp-${key}`)} placeholder="0.00" />
                  </div>
                ))}
              </div>
            </Card>

            <Card title="5. Gastos operativos" subtitle="Opcional: prorratea gastos fijos del periodo en el costo del lote."
              right={
                <button type="button" onClick={() => setIncludeOpCosts(v => !v)} className="btn-ghost btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: includeOpCosts ? 'var(--color-success)' : 'var(--text-secondary)' }}
                  aria-pressed={includeOpCosts}>
                  {includeOpCosts ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  {includeOpCosts ? 'Incluidos en el costo' : 'No incluidos'}
                </button>
              }>
              <div style={{ ...grid(150), opacity: includeOpCosts ? 1 : 0.6 }}>
                {Object.keys(opCosts).map(key => (
                  <div key={key}>
                    <label className="field-label" style={{ fontSize: 12 }}>{OP_LABELS[key] || key}</label>
                    <NumInput value={opCosts[key]} onChange={v => setOpCosts(prev => ({ ...prev, [key]: v }))} invalid={hasError(`op-${key}`)} placeholder="0.00" />
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 84 }}>
            <div className="card" style={{ background: '#111827', color: '#F9FAFB', border: 'none', boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A5B4FC' }}>Resumen de costeo</span>
              {[
                ['Unidades', String(calc.qty)],
                ['Fabricación y compra', fmt(calc.totalFabricationLot)],
                ['Importación', fmt(calc.totalImportLot)],
                ...(includeOpCosts ? [['Gastos operativos', fmt(calc.totalOpLot)]] : [])
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: 'rgba(255,255,255,0.65)' }}>{label}</span>
                  <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#A5B4FC' }}>Costo unitario</span>
                <span style={{ fontSize: 26, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(calc.unitCost)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'rgba(255,255,255,0.65)' }}>Inversión total del lote</span>
                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(calc.lotCost)}</span>
              </div>
              {currency === 'USD' && toNum(exchangeRate) > 0 && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>≈ S/. {fmtNum(calc.unitCost * toNum(exchangeRate))} por unidad</div>
              )}
            </div>

            <Card title="6. Precios y margen" subtitle="Margen sobre el costo unitario.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {MARGIN_DEFS.map(({ key, label, min, max, color }) => {
                  const m = toNum(margins[key]);
                  const inRange = m >= min && m <= max;
                  return (
                    <div key={key} style={{ padding: 12, borderRadius: 'var(--radius)', background: 'var(--bg-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{label} <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>({m}%)</span></span>
                        <span style={{ fontSize: 16, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{fmt(calc.prices[key])}</span>
                      </div>
                      <input type="range" min="5" max="150" value={m} aria-label={`Margen ${label}`}
                        onChange={e => setMargins(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                        style={{ width: '100%', marginTop: 8, accentColor: color }} />
                      <span style={{ fontSize: 12, color: inRange ? 'var(--color-success)' : 'var(--color-warning)' }}>
                        Recomendado: {min}–{max}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button type="button" className="btn-secondary btn-block" onClick={() => handleSaveProject()} disabled={integrating}>
                <Save size={16} /> Guardar presupuesto
              </button>
              <button type="button" className="btn-primary btn-block" onClick={handleIntegrateInventory} disabled={integrating}>
                {integrating ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Package size={16} />}
                {integrating ? 'Publicando…' : 'Publicar en inventario'}
              </button>
              <button type="button" className="btn-ghost btn-block" onClick={() => setActiveTab('list')} disabled={integrating}>
                <ArrowLeft size={16} /> Volver sin guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== REPORTES ==================== */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 16 }}>
            <div className="stat-card">
              <span className="stat-label">Inversión total acumulada</span>
              <span className="stat-value">S/. {fmtNum(dashboardStats.totalInvestment)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Margen mayorista promedio</span>
              <span className="stat-value" style={{ color: 'var(--color-success)' }}>{fmtNum(avgMargin)}%</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Lotes finalizados</span>
              <span className="stat-value">{dashboardStats.finishedCount} / {projects.length}</span>
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="card empty-state"><BarChart3 size={36} style={{ opacity: 0.4 }} /><h3>Sin datos</h3><p>Crea lotes para ver reportes.</p></div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 16 }}>
                <Card title="Inversión por lote">
                  <MiniBarChart data={chartData.investment} colors={INVEST_COLORS} height={180} />
                </Card>
                <Card title="Costo unitario por lote">
                  <MiniLineChart data={chartData.unitCost} color="#4F46E5" height={180} />
                </Card>
                <Card title="Ganancia esperada por lote (precio mayorista)" style={{ gridColumn: '1 / -1' }}>
                  <MiniBarChart data={chartData.profit} colors={PROFIT_COLORS} height={160} />
                </Card>
              </div>

              <Card title="Rentabilidad por lote" subtitle="Montos en la moneda de cada lote.">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Lote</th>
                        <th style={{ textAlign: 'right' }}>Unidades</th>
                        <th style={{ textAlign: 'right' }}>Inversión</th>
                        <th style={{ textAlign: 'right' }}>Costo unit.</th>
                        <th style={{ textAlign: 'right' }}>P. mayorista</th>
                        <th style={{ textAlign: 'right' }}>Ganancia esp.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectRows.map(({ p, c }) => {
                        const sym = symbolOf(p.currency);
                        const cell = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
                        return (
                          <tr key={p.id}>
                            <td style={{ fontWeight: 600 }}>{p.projectName}</td>
                            <td style={cell}>{c.qty}</td>
                            <td style={cell}>{sym} {fmtNum(c.lotCost)}</td>
                            <td style={cell}>{sym} {fmtNum(c.unitCost)}</td>
                            <td style={cell}>{sym} {fmtNum(c.prices.mayorista)}</td>
                            <td style={{ ...cell, color: 'var(--color-success)', fontWeight: 600 }}>+ {sym} {fmtNum((c.prices.mayorista - c.unitCost) * c.qty)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
