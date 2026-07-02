import React, { useState, useMemo, useEffect } from 'react';
import { DataService } from '../../services/dataService';
import { 
  Plus, Trash2, Edit3, Save, Play, FileText, CheckCircle, 
  Archive, FileSpreadsheet, Download, RefreshCw, Layers, 
  TrendingUp, Percent, DollarSign, Package, Compass, Truck, 
  Users, BarChart3, HelpCircle, Eye, ToggleLeft, ToggleRight
} from 'lucide-react';

// format utilities
const fmtNum = (n) => {
  if (isNaN(n) || !isFinite(n)) return '0.00';
  return Number(n).toFixed(2);
};

const CATEGORIES = ['Polos', 'Calzado', 'Accesorios', 'Importaciones', 'Calzados', 'Otros'];
const STATES = ['En proceso', 'Finalizado', 'Archivado'];
const GAIN_TIERS = [15, 20, 25, 30, 40, 50, 60, 80, 100];

const RECOMMENDED_MARGINS = {
  mayorista: { min: 25, max: 40, label: 'Recomendado: 25-40%' },
  minorista: { min: 50, max: 80, label: 'Recomendado: 50-80%' },
  distribuidor: { min: 15, max: 25, label: 'Recomendado: 15-25%' },
  vip: { min: 35, max: 60, label: 'Recomendado: 35-60%' },
  volumen: { min: 10, max: 20, label: 'Recomendado: 10-20%' }
};

// Simple mini bar chart drawn via canvas ref callback
function MiniBarChart({ data, colors, height = 160 }) {
  const canvasRef = React.useRef(null);
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.offsetWidth;
    const h = canvas.height = height;
    ctx.clearRect(0, 0, w, h);
    const maxVal = Math.max(...data.map(d => d.value), 1);
    const barW = Math.min(40, (w - 20) / data.length - 8);
    const gap = (w - data.length * barW) / (data.length + 1);
    data.forEach((d, i) => {
      const barH = (d.value / maxVal) * (h - 40);
      const x = gap + i * (barW + gap);
      const y = h - 24 - barH;
      // Bar
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
      ctx.fill();
      // Label
      ctx.fillStyle = '#6B7280';
      ctx.font = '600 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.label.length > 8 ? d.label.slice(0,8)+'…' : d.label, x + barW/2, h - 8);
      // Value
      ctx.fillStyle = '#111';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(fmtNum(d.value), x + barW/2, y - 6);
    });
  }, [data, colors, height]);
  return <canvas ref={canvasRef} style={{ width: '100%', display: 'block' }} />;
}

function MiniLineChart({ data, color = '#C5A880', height = 140 }) {
  const canvasRef = React.useRef(null);
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.offsetWidth;
    const h = canvas.height = height;
    ctx.clearRect(0, 0, w, h);
    const maxVal = Math.max(...data.map(d => d.value), 1);
    const padX = 30; const padY = 20;
    const drawW = w - padX * 2; const drawH = h - padY * 2;
    // Grid lines
    ctx.strokeStyle = '#F3F4F6'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const gy = padY + (drawH / 4) * i;
      ctx.beginPath(); ctx.moveTo(padX, gy); ctx.lineTo(w - padX, gy); ctx.stroke();
    }
    // Line
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = padX + (drawW / Math.max(data.length - 1, 1)) * i;
      const y = padY + drawH - (d.value / maxVal) * drawH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    // Dots & labels
    data.forEach((d, i) => {
      const x = padX + (drawW / Math.max(data.length - 1, 1)) * i;
      const y = padY + drawH - (d.value / maxVal) * drawH;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6B7280'; ctx.font = '600 9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(d.label, x, h - 4);
    });
  }, [data, color, height]);
  return <canvas ref={canvasRef} style={{ width: '100%', display: 'block' }} />;
}

export default function CostCalculator() {
  const [projects, setProjects] = useState([]);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'editor' | 'dashboard'
  
  // Active Project Form State
  const [editingId, setEditingId] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [category, setCategory] = useState('Polos');
  const [brand, setBrand] = useState('');
  const [provider, setProvider] = useState('');
  const [status, setStatus] = useState('En proceso');

  // Currency & Exchange rate
  const [currency, setCurrency] = useState('PEN'); // 'PEN' | 'USD'
  const [exchangeRate, setExchangeRate] = useState('3.75'); // 1 USD = X PEN

  const currSymbol = currency === 'PEN' ? 'S/.' : '$';
  const fmt = (n) => `${currSymbol} ${fmtNum(n)}`;
  
  // 2. Costos de Adquisición
  const [unitsQty, setUnitsQty] = useState('100');
  const [purchaseType, setPurchaseType] = useState('unit'); // 'unit' | 'fabric_roll' | 'box' | 'pack'
  const [acquisitionCost, setAcquisitionCost] = useState('0'); // cost for the lot/roll/box/pack
  
  // 3. Costos de Fabricación (Multiplicable por polo o por lote)
  // Each entry: { id, label, value, type: 'per_unit' | 'total_lote' }
  const [fabricCosts, setFabricCosts] = useState([
    { id: 'tela', label: 'Tela / Rollo', value: '1800', type: 'total_lote' },
    { id: 'corte', label: 'Corte', value: '0', type: 'per_unit' },
    { id: 'confeccion', label: 'Confección / Costura', value: '8', type: 'per_unit' }, // S/. 960 for 120 = S/. 8
    { id: 'estampado', label: 'Estampado / Ploteo', value: '6', type: 'per_unit' }, // S/. 720 for 120 = S/. 6
    { id: 'limpieza', label: 'Limpieza / Acabado', value: '1', type: 'per_unit' }, // S/. 120 for 120 = S/. 1
    { id: 'empaque', label: 'Bolsas / Empaque', value: '1.5', type: 'per_unit' }, // S/. 180 for 120 = S/. 1.5
  ]);

  // Multiple roll/fabric rows helper
  const [fabricKilosInput, setFabricKilosInput] = useState([
    { id: 'roll1', label: 'Rollo Algodón', weight: '20' },
  ]);

  // Custom cost field helper
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [newFieldType, setNewFieldType] = useState('per_unit');

  // 4. Costos de Importación (Distribuidos entre todas las unidades)
  const [importCosts, setImportCosts] = useState({
    fob: '0',
    freight: '0',
    insurance: '0',
    aduanas: '0',
    aranceles: '0',
    igvImport: '0',
    agente: '0',
    transportNac: '0',
    almacenaje: '0',
    otros: '0'
  });

  // 5. Gastos Operativos (Opcional incluir en el costo)
  const [includeOpCosts, setIncludeOpCosts] = useState(false);
  const [opCosts, setOpCosts] = useState({
    alquiler: '0',
    sueldos: '0',
    marketing: '0',
    comisiones: '0',
    plataforma: '0',
    servicios: '0'
  });

  // 7. Lista de Ganancias Múltiples (Margen deseado)
  const [marginMayorista, setMarginMayorista] = useState(30);
  const [marginMinorista, setMarginMinorista] = useState(50);
  const [marginDistribuidor, setMarginDistribuidor] = useState(20);
  const [marginVIP, setMarginVIP] = useState(40);
  const [marginVolumen, setMarginVolumen] = useState(15);

  // Load projects from database/local storage mock to ensure state persistence
  useEffect(() => {
    const saved = localStorage.getItem('arven_manufacturing_projects');
    if (saved) {
      try {
        setProjects(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    } else {
      // Mock initial demo project matching user description
      const demo = {
        id: 'demo-1',
        projectName: 'Lote Polos Oversize Premium',
        category: 'Polos',
        brand: 'Arven',
        provider: 'Texcope',
        status: 'En proceso',
        date: new Date().toLocaleDateString('es-PE'),
        unitsQty: 120,
        purchaseType: 'fabric_roll',
        acquisitionCost: 1800,
        fabricCosts: [
          { id: 'tela', label: 'Tela / Rollo', value: '1800', type: 'total_lote' },
          { id: 'confeccion', label: 'Confección / Costura', value: '8', type: 'per_unit' }, // 960 total
          { id: 'estampado', label: 'Estampado / Ploteo', value: '6', type: 'per_unit' }, // 720 total
          { id: 'limpieza', label: 'Limpieza / Acabado', value: '1', type: 'per_unit' }, // 120 total
          { id: 'empaque', label: 'Bolsas / Empaque', value: '1.5', type: 'per_unit' }, // 180 total
        ],
        fabricKilosInput: [{ id: 'roll1', label: 'Rollo Jersey 30/1', weight: '20' }],
        importCosts: { fob: 0, freight: 0, insurance: 0, aduanas: 0, aranceles: 0, igvImport: 0, agente: 0, transportNac: 0, almacenaje: 0, otros: 0 },
        includeOpCosts: false,
        opCosts: { alquiler: 0, sueldos: 0, marketing: 0, comisiones: 0, plataforma: 0, servicios: 0 },
        marginMayorista: 30,
        marginMinorista: 50,
        marginDistribuidor: 20,
        marginVIP: 40,
        marginVolumen: 15
      };
      setProjects([demo]);
      localStorage.setItem('arven_manufacturing_projects', JSON.stringify([demo]));
    }
  }, []);

  const saveProjectsToStorage = (updated) => {
    setProjects(updated);
    localStorage.setItem('arven_manufacturing_projects', JSON.stringify(updated));
  };

  // 6. Costeo Automático computado en base al estado del formulario
  const calc = useMemo(() => {
    const qty = parseFloat(unitsQty) || 1;
    const acq = parseFloat(acquisitionCost) || 0;

    // Kilos de tela totales
    const totalFabricKilos = fabricKilosInput.reduce((sum, k) => sum + (parseFloat(k.weight) || 0), 0);

    // Sumar fabricación
    let totalFabricationLot = 0;
    let totalFabricationUnit = 0;

    fabricCosts.forEach(item => {
      const val = parseFloat(item.value) || 0;
      if (item.type === 'per_unit') {
        totalFabricationUnit += val;
        totalFabricationLot += val * qty;
      } else {
        totalFabricationLot += val;
        totalFabricationUnit += val / qty;
      }
    });

    // Sumar Importaciones
    const fVal = parseFloat(importCosts.fob) || 0;
    const freightVal = parseFloat(importCosts.freight) || 0;
    const insVal = parseFloat(importCosts.insurance) || 0;
    const aduVal = parseFloat(importCosts.aduanas) || 0;
    const aranVal = parseFloat(importCosts.aranceles) || 0;
    const igvVal = parseFloat(importCosts.igvImport) || 0;
    const agentVal = parseFloat(importCosts.agente) || 0;
    const transVal = parseFloat(importCosts.transportNac) || 0;
    const almVal = parseFloat(importCosts.almacenaje) || 0;
    const otrVal = parseFloat(importCosts.otros) || 0;

    const totalImportLot = fVal + freightVal + insVal + aduVal + aranVal + igvVal + agentVal + transVal + almVal + otrVal;
    const totalImportUnit = totalImportLot / qty;

    // Sumar Gastos Operativos
    const alq = parseFloat(opCosts.alquiler) || 0;
    const suel = parseFloat(opCosts.sueldos) || 0;
    const mkt = parseFloat(opCosts.marketing) || 0;
    const com = parseFloat(opCosts.comisiones) || 0;
    const plat = parseFloat(opCosts.plataforma) || 0;
    const serv = parseFloat(opCosts.servicios) || 0;

    const totalOpLot = alq + suel + mkt + com + plat + serv;
    const totalOpUnit = totalOpLot / qty;

    // Costo Total
    const baseUnitCost = (purchaseType === 'unit' ? acq : 0) + totalFabricationUnit + totalImportUnit;
    const baseLotCost = (purchaseType === 'unit' ? acq * qty : 0) + totalFabricationLot + totalImportLot;

    const finalUnitCost = includeOpCosts ? (baseUnitCost + totalOpUnit) : baseUnitCost;
    const finalLotCost = includeOpCosts ? (baseLotCost + totalOpLot) : baseLotCost;

    // List of prices helper builder
    const getSalePrice = (margin) => finalUnitCost * (1 + (margin / 100));

    return {
      qty,
      totalFabricKilos,
      totalFabricationLot,
      totalFabricationUnit,
      totalImportLot,
      totalImportUnit,
      totalOpLot,
      totalOpUnit,
      finalUnitCost,
      finalLotCost,
      prices: {
        mayorista: getSalePrice(marginMayorista),
        minorista: getSalePrice(marginMinorista),
        distribuidor: getSalePrice(marginDistribuidor),
        vip: getSalePrice(marginVIP),
        volumen: getSalePrice(marginVolumen)
      }
    };
  }, [
    unitsQty, purchaseType, acquisitionCost, fabricCosts, fabricKilosInput,
    importCosts, includeOpCosts, opCosts, marginMayorista, marginMinorista,
    marginDistribuidor, marginVIP, marginVolumen
  ]);

  // Dashboard Stats
  const dashboardStats = useMemo(() => {
    if (projects.length === 0) return { totalInvestment: 0, finishedCount: 0, inProcessCount: 0 };
    let total = 0;
    let finished = 0;
    let inProcess = 0;
    projects.forEach(p => {
      // Re-calculate total investment for project
      const qty = p.unitsQty || 1;
      let fabLot = 0;
      (p.fabricCosts || []).forEach(f => {
        const val = parseFloat(f.value) || 0;
        fabLot += f.type === 'per_unit' ? val * qty : val;
      });
      const imp = Object.values(p.importCosts || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      const acq = p.purchaseType === 'unit' ? (p.acquisitionCost * qty) : 0;
      total += acq + fabLot + imp;
      
      if (p.status === 'Finalizado') finished++;
      if (p.status === 'En proceso') inProcess++;
    });
    return {
      totalInvestment: total,
      finishedCount: finished,
      inProcessCount: inProcess
    };
  }, [projects]);

  // Editor Actions
  const handleAddNewProject = () => {
    setEditingId(null);
    setProjectName('');
    setCategory('Polos');
    setBrand('');
    setProvider('');
    setStatus('En proceso');
    setUnitsQty('100');
    setPurchaseType('unit');
    setAcquisitionCost('0');
    setFabricCosts([
      { id: 'tela', label: 'Tela / Rollo', value: '0', type: 'total_lote' },
      { id: 'corte', label: 'Corte', value: '0', type: 'per_unit' },
      { id: 'confeccion', label: 'Confección / Costura', value: '0', type: 'per_unit' },
      { id: 'estampado', label: 'Estampado / Ploteo', value: '0', type: 'per_unit' },
      { id: 'limpieza', label: 'Limpieza / Acabado', value: '0', type: 'per_unit' },
      { id: 'empaque', label: 'Bolsas / Empaque', value: '0', type: 'per_unit' },
    ]);
    setFabricKilosInput([{ id: 'roll1', label: 'Rollo 1', weight: '0' }]);
    setImportCosts({ fob: '0', freight: '0', insurance: '0', aduanas: '0', aranceles: '0', igvImport: '0', agente: '0', transportNac: '0', almacenaje: '0', otros: '0' });
    setIncludeOpCosts(false);
    setOpCosts({ alquiler: '0', sueldos: '0', marketing: '0', comisiones: '0', plataforma: '0', servicios: '0' });
    setMarginMayorista(30);
    setMarginMinorista(50);
    setMarginDistribuidor(20);
    setMarginVIP(40);
    setMarginVolumen(15);
    setActiveTab('editor');
  };

  const handleEditProject = (p) => {
    setEditingId(p.id);
    setProjectName(p.projectName);
    setCategory(p.category || 'Polos');
    setBrand(p.brand || '');
    setProvider(p.provider || '');
    setStatus(p.status || 'En proceso');
    setUnitsQty(String(p.unitsQty || 100));
    setPurchaseType(p.purchaseType || 'unit');
    setAcquisitionCost(String(p.acquisitionCost || 0));
    setFabricCosts(p.fabricCosts || []);
    setFabricKilosInput(p.fabricKilosInput || [{ id: 'roll1', label: 'Rollo 1', weight: '0' }]);
    
    // Safety check objects
    const defaultImp = { fob: '0', freight: '0', insurance: '0', aduanas: '0', aranceles: '0', igvImport: '0', agente: '0', transportNac: '0', almacenaje: '0', otros: '0' };
    setImportCosts({ ...defaultImp, ...(p.importCosts || {}) });
    
    setIncludeOpCosts(!!p.includeOpCosts);
    const defaultOp = { alquiler: '0', sueldos: '0', marketing: '0', comisiones: '0', plataforma: '0', servicios: '0' };
    setOpCosts({ ...defaultOp, ...(p.opCosts || {}) });

    setMarginMayorista(p.marginMayorista ?? 30);
    setMarginMinorista(p.marginMinorista ?? 50);
    setMarginDistribuidor(p.marginDistribuidor ?? 20);
    setMarginVIP(p.marginVIP ?? 40);
    setMarginVolumen(p.marginVolumen ?? 15);
    setActiveTab('editor');
  };

  const handleSaveProject = () => {
    if (!projectName.trim()) {
      alert('Por favor ingresa un nombre para el proyecto.');
      return;
    }
    const newProj = {
      id: editingId || 'proj-' + Date.now(),
      projectName,
      category,
      brand,
      provider,
      status,
      date: new Date().toLocaleDateString('es-PE'),
      unitsQty: parseFloat(unitsQty) || 0,
      purchaseType,
      acquisitionCost: parseFloat(acquisitionCost) || 0,
      fabricCosts,
      fabricKilosInput,
      importCosts,
      includeOpCosts,
      opCosts,
      marginMayorista,
      marginMinorista,
      marginDistribuidor,
      marginVIP,
      marginVolumen
    };

    let updatedList;
    if (editingId) {
      updatedList = projects.map(p => p.id === editingId ? newProj : p);
    } else {
      updatedList = [newProj, ...projects];
    }

    saveProjectsToStorage(updatedList);
    alert('Proyecto guardado con éxito.');
    setActiveTab('list');
  };

  const handleDeleteProject = (id) => {
    if (window.confirm('¿Seguro que deseas eliminar este presupuesto/lote?')) {
      const updated = projects.filter(p => p.id !== id);
      saveProjectsToStorage(updated);
    }
  };

  // Add custom manufacturing cost row
  const handleAddCustomField = () => {
    if (!newFieldName.trim()) return;
    const newRow = {
      id: 'custom-' + Date.now(),
      label: newFieldName.trim(),
      value: String(parseFloat(newFieldValue) || 0),
      type: newFieldType
    };
    setFabricCosts([...fabricCosts, newRow]);
    setNewFieldName('');
    setNewFieldValue('');
  };

  // Remove fabrication row
  const handleRemoveFabricCost = (id) => {
    setFabricCosts(fabricCosts.filter(f => f.id !== id));
  };

  // Fabric Weight Helpers
  const handleAddWeightRow = () => {
    setFabricKilosInput([...fabricKilosInput, { id: 'roll-' + Date.now(), label: `Rollo ${fabricKilosInput.length + 1}`, weight: '0' }]);
  };

  const handleRemoveWeightRow = (id) => {
    if (fabricKilosInput.length === 1) return;
    setFabricKilosInput(fabricKilosInput.filter(f => f.id !== id));
  };

  // Integration to Inventory / Supabase Products mock-up action handler
  const handleIntegrateInventory = async () => {
    if (window.confirm(`¿Deseas registrar automáticamente el producto "${projectName}" en el Inventario de Ventas con un costo unitario de S/. ${fmt(calc.finalUnitCost)} y precio mayorista sugerido de S/. ${fmt(calc.prices.mayorista)}?`)) {
      try {
        // Build mock payload for DB insertion
        const newProductPayload = {
          name: projectName,
          category,
          price: calc.prices.minorista,
          offer_price: calc.prices.mayorista, // Sugerido mayorista
          cost: calc.finalUnitCost,
          stock: calc.qty,
          active: true,
          description: `Fabricación de Lote ${projectName} - Categoría: ${category}. Costo por unidad: S/. ${fmt(calc.finalUnitCost)}`
        };

        // Call database setup helper or API
        await DataService.createProduct(newProductPayload);
        alert('¡Producto creado e integrado con éxito al inventario activo! Ya puedes venderlo desde el POS.');
        
        // Update local state to show integrated/finished
        setStatus('Finalizado');
        handleSaveProject();
      } catch (err) {
        console.error(err);
        alert('El producto se guardó localmente en la calculadora pero no se pudo publicar automáticamente en Supabase. Verifica tu conexión.');
      }
    }
  };

  // Export to real Excel spreadsheet (.xls via HTML table)
  const handleExportSpreadsheet = (p) => {
    const qty = p.unitsQty || 1;
    let totalLot = 0;
    const rows = (p.fabricCosts || []).map(f => {
      const v = parseFloat(f.value) || 0;
      const lotVal = f.type === 'per_unit' ? (v * qty) : v;
      totalLot += lotVal;
      return `<tr><td>${f.label}</td><td>${f.type === 'per_unit' ? 'Por Unidad' : 'Por Lote'}</td><td>${currSymbol} ${fmtNum(lotVal)}</td><td>${currSymbol} ${fmtNum(lotVal / qty)}</td></tr>`;
    }).join('');

    const impTotal = Object.values(p.importCosts || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    const unitCost = (totalLot + impTotal) / qty;
    const pMay = unitCost * (1 + ((p.marginMayorista || 30) / 100));
    const pMin = unitCost * (1 + ((p.marginMinorista || 50) / 100));

    const xls = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"/><style>
        table { border-collapse: collapse; font-family: Segoe UI, Arial; }
        th { background-color: #111111; color: #C5A880; font-weight: bold; font-size: 11px; }
        td, th { border: 1px solid #dddddd; padding: 8px; text-align: left; font-size: 11px; }
        .total-row { background-color: #f9fafb; font-weight: bold; }
        .highlight { color: #10B981; font-weight: bold; }
        h2 { font-family: Segoe UI, Arial; color: #111; }
      </style></head>
      <body>
      <h2>Presupuesto: ${p.projectName}</h2>
      <table>
        <tr><td><strong>Categoría</strong></td><td>${p.category}</td><td><strong>Marca</strong></td><td>${p.brand || '—'}</td></tr>
        <tr><td><strong>Proveedor</strong></td><td>${p.provider || '—'}</td><td><strong>Estado</strong></td><td>${p.status}</td></tr>
        <tr><td><strong>Unidades</strong></td><td>${qty}</td><td><strong>Fecha</strong></td><td>${p.date}</td></tr>
      </table>
      <br/>
      <h3>Detalle de Costos de Fabricación</h3>
      <table>
        <tr><th>Concepto</th><th>Modo</th><th>Total Lote</th><th>Costo Unitario</th></tr>
        ${rows}
        <tr class="total-row"><td colspan="2"><strong>SUBTOTAL FABRICACIÓN</strong></td><td><strong>${currSymbol} ${fmtNum(totalLot)}</strong></td><td><strong>${currSymbol} ${fmtNum(totalLot/qty)}</strong></td></tr>
        <tr><td colspan="2">Importación (distribuido)</td><td>${currSymbol} ${fmtNum(impTotal)}</td><td>${currSymbol} ${fmtNum(impTotal/qty)}</td></tr>
        <tr class="total-row"><td colspan="2"><strong>COSTO TOTAL</strong></td><td><strong>${currSymbol} ${fmtNum(totalLot + impTotal)}</strong></td><td><strong>${currSymbol} ${fmtNum(unitCost)}</strong></td></tr>
      </table>
      <br/>
      <h3>Lista de Precios Sugeridos</h3>
      <table>
        <tr><th>Canal</th><th>Margen</th><th>Precio Unitario</th></tr>
        <tr><td>Mayorista</td><td>${p.marginMayorista || 30}%</td><td class="highlight">${currSymbol} ${fmtNum(pMay)}</td></tr>
        <tr><td>Minorista</td><td>${p.marginMinorista || 50}%</td><td class="highlight">${currSymbol} ${fmtNum(pMin)}</td></tr>
      </table>
      </body></html>
    `;

    const blob = new Blob([xls], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Costos_${p.projectName.replace(/\s+/g, '_')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #111 0%, #222 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Layers size={22} color="#C5A880" />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111', margin: 0, letterSpacing: '-0.02em' }}>
              Costos de Fabricación y ERP
            </h1>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: '3px 0 0' }}>
              Control de lotes, importaciones, gastos operativos e integración directa con inventario
            </p>
          </div>
        </div>

        {/* CURRENCY TOOLBAR */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#FFF' }}>
            <button onClick={() => setCurrency('PEN')} style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', backgroundColor: currency === 'PEN' ? '#111' : '#FFF', color: currency === 'PEN' ? '#C5A880' : '#6B7280' }}>🇵🇪 Soles (S/.)</button>
            <button onClick={() => setCurrency('USD')} style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', backgroundColor: currency === 'USD' ? '#111' : '#FFF', color: currency === 'USD' ? '#C5A880' : '#6B7280' }}>🇺🇸 Dólares ($)</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#374151' }}>
            <span style={{ fontWeight: 700 }}>T/C:</span>
            <span style={{ color: '#6B7280' }}>1 USD =</span>
            <input type="number" step="0.01" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} style={{ width: '70px', padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: '4px', fontSize: '12px', fontWeight: 700, textAlign: 'center' }} />
            <span style={{ color: '#6B7280' }}>PEN</span>
          </div>
          <div style={{ fontSize: '10px', color: '#9CA3AF', backgroundColor: '#FFFBEB', padding: '4px 10px', borderRadius: '4px', border: '1px solid #FDE68A' }}>
            💡 Usa punto decimal para los centavos: <strong>1800.50</strong> &nbsp;(no comas)
          </div>
        </div>

        {/* NAVIGATION BUTTONS */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setActiveTab('list')}
            style={{
              padding: '9px 16px', fontSize: '13px', fontWeight: 700, borderRadius: '8px', cursor: 'pointer',
              backgroundColor: activeTab === 'list' ? '#111' : '#F3F4F6',
              color: activeTab === 'list' ? '#C5A880' : '#4B5563',
              border: activeTab === 'list' ? 'none' : '1px solid #E5E7EB',
              transition: 'all 0.2s'
            }}
          >
            📋 Mis Lotes
          </button>
          <button 
            onClick={() => setActiveTab('dashboard')}
            style={{
              padding: '9px 16px', fontSize: '13px', fontWeight: 700, borderRadius: '8px', cursor: 'pointer',
              backgroundColor: activeTab === 'dashboard' ? '#111' : '#F3F4F6',
              color: activeTab === 'dashboard' ? '#C5A880' : '#4B5563',
              border: activeTab === 'dashboard' ? 'none' : '1px solid #E5E7EB',
              transition: 'all 0.2s'
            }}
          >
            📈 Reportes / KPI
          </button>
          <button 
            onClick={handleAddNewProject}
            style={{
              padding: '9px 18px', fontSize: '13px', fontWeight: 700, borderRadius: '8px', cursor: 'pointer',
              backgroundColor: '#C5A880', color: '#111', border: 'none',
              boxShadow: '0 2px 8px rgba(197,168,128,0.3)', transition: 'transform 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            ➕ Nuevo Lote
          </button>
        </div>
      </div>

      {/* ==================== TAB 1: LIST OF BATCHES ==================== */}
      {activeTab === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Simple summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            <div style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Inversión Total Proyectada</span>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#111', marginTop: '4px' }}>S/. {fmt(dashboardStats.totalInvestment)}</div>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={20} color="#D97706" />
              </div>
            </div>
            <div style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Lotes En Proceso</span>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#6366F1', marginTop: '4px' }}>{dashboardStats.inProcessCount}</div>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw size={18} color="#6366F1" />
              </div>
            </div>
            <div style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Lotes Finalizados</span>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#10B981', marginTop: '4px' }}>{dashboardStats.finishedCount}</div>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={18} color="#10B981" />
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', color: '#4B5563' }}>
                  <th style={{ padding: '14px 20px', fontWeight: 700 }}>Proyecto / Lote</th>
                  <th style={{ padding: '14px 20px', fontWeight: 700 }}>Categoría</th>
                  <th style={{ padding: '14px 20px', fontWeight: 700 }}>Marca / Prov</th>
                  <th style={{ padding: '14px 20px', fontWeight: 700, textAlign: 'center' }}>Unidades</th>
                  <th style={{ padding: '14px 20px', fontWeight: 700, textAlign: 'right' }}>Costo Unit.</th>
                  <th style={{ padding: '14px 20px', fontWeight: 700 }}>Estado</th>
                  <th style={{ padding: '14px 20px', fontWeight: 700, textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>
                      No hay proyectos de costeo registrados. ¡Haz clic en "Nuevo Lote" para comenzar!
                    </td>
                  </tr>
                ) : (
                  projects.map(p => {
                    // Quick unit cost calc
                    const pQty = p.unitsQty || 1;
                    let fTotal = 0;
                    (p.fabricCosts || []).forEach(f => {
                      const v = parseFloat(f.value) || 0;
                      fTotal += f.type === 'per_unit' ? (v * pQty) : v;
                    });
                    const imp = Object.values(p.importCosts || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);
                    const acqCost = p.purchaseType === 'unit' ? (p.acquisitionCost * pQty) : 0;
                    
                    const unitCost = (acqCost + fTotal + imp) / pQty;

                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6', transition: 'background-color 0.15s' }}>
                        <td style={{ padding: '14px 20px', fontWeight: 700, color: '#111' }}>
                          {p.projectName}
                          <span style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#9CA3AF', marginTop: '2px' }}>{p.date}</span>
                        </td>
                        <td style={{ padding: '14px 20px', color: '#4B5563' }}>{p.category}</td>
                        <td style={{ padding: '14px 20px', color: '#6B7280' }}>
                          {p.brand || '—'} / {p.provider || '—'}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#6366F1' }}>{p.unitsQty}</td>
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 800, color: '#111' }}>
                          {fmt(unitCost)}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{
                            padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                            backgroundColor: p.status === 'Finalizado' ? '#D1FAE5' : p.status === 'Archivado' ? '#F3F4F6' : '#FEF3C7',
                            color: p.status === 'Finalizado' ? '#065F46' : p.status === 'Archivado' ? '#374151' : '#92400E'
                          }}>
                            {p.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button onClick={() => handleEditProject(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B82F6' }} title="Editar">
                              <Edit3 size={15} />
                            </button>
                            <button onClick={() => handleExportSpreadsheet(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10B981' }} title="Exportar CSV">
                              <FileSpreadsheet size={15} />
                            </button>
                            <button onClick={() => handleDeleteProject(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }} title="Eliminar">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: DETAILED ERP EDITOR ==================== */}
      {activeTab === 'editor' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* LEFT PANELS: DATA ENTRY */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* 1. GENERAL INFORMATION */}
            <div style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#111', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                1. Información del Proyecto
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#6B7280' }}>NOMBRE DEL PRODUCTO / LOTE</label>
                  <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Ej: Polos Boxy Algodón Pima" style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#6B7280' }}>CATEGORÍA</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: '13px', fontWeight: 600, backgroundColor: '#FFF' }}>
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#6B7280' }}>MARCA</label>
                  <input type="text" value={brand} onChange={e => setBrand(e.target.value)} placeholder="Ej: Arven" style={{ width: '100%', padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: '12px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#6B7280' }}>PROVEEDOR</label>
                  <input type="text" value={provider} onChange={e => setProvider(e.target.value)} placeholder="Ej: Importador Lima" style={{ width: '100%', padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: '12px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#6B7280' }}>ESTADO</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: '12px', backgroundColor: '#FFF' }}>
                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* 2. ADQUISICIÓN / MATERIA PRIMA */}
            <div style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#111', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                2. Adquisición y Cantidades
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#6B7280' }}>CANTIDAD DE UNIDADES DEL LOTE</label>
                  <input type="number" value={unitsQty} onChange={e => setUnitsQty(e.target.value)} placeholder="Ej: 120" style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: '14px', fontWeight: 800, color: '#6366F1', backgroundColor: '#EEF2FF' }} />
                  <span style={{ fontSize: '9px', color: '#9CA3AF', marginTop: '2px', display: 'block' }}>Ingresa solo números enteros. Ej: 120</span>
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#6B7280' }}>MODO DE COMPRA</label>
                  <select value={purchaseType} onChange={e => setPurchaseType(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: '13px', fontWeight: 600, backgroundColor: '#FFF' }}>
                    <option value="unit">Por Unidad</option>
                    <option value="fabric_roll">Materia Prima / Rollo</option>
                    <option value="box">Por Caja</option>
                    <option value="pack">Por Paquete</option>
                  </select>
                </div>
                {purchaseType === 'unit' && (
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: '#6B7280' }}>PRECIO COMPRA UNITARIO ({currSymbol})</label>
                    <input type="number" value={acquisitionCost} onChange={e => setAcquisitionCost(e.target.value)} placeholder="0.00" style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }} />
                    <span style={{ fontSize: '9px', color: '#9CA3AF', marginTop: '2px', display: 'block' }}>Ej: 15.50 (usa punto para centavos)</span>
                  </div>
                )}
              </div>
            </div>

            {/* 3. COSTOS DE FABRICACIÓN (CON CAMPOS EDITABLES Y METRICAS POR POLO O LOTE) */}
            <div style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#111', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  3. Costos de Fabricación y Confección
                </h3>
              </div>

              {/* Fabric rolls weight calculator logic */}
              <div style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#374151', textTransform: 'uppercase' }}>⚖️ Registro de Rollos / Kilos de Tela</span>
                  <button onClick={handleAddWeightRow} style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 700, backgroundColor: '#111', color: '#C5A880', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    + Añadir Rollo
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {fabricKilosInput.map((row, i) => (
                    <div key={row.id} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input 
                        type="text" 
                        value={row.label} 
                        onChange={e => {
                          const updated = [...fabricKilosInput];
                          updated[i].label = e.target.value;
                          setFabricKilosInput(updated);
                        }} 
                        placeholder="Nombre / Tipo" 
                        style={{ flex: 1.2, padding: '5px 8px', fontSize: '11px', border: '1px solid #D1D5DB', borderRadius: '4px' }} 
                      />
                      <input 
                        type="number" 
                        value={row.weight} 
                        onChange={e => {
                          const updated = [...fabricKilosInput];
                          updated[i].weight = e.target.value;
                          setFabricKilosInput(updated);
                        }} 
                        placeholder="Kilos" 
                        style={{ flex: 0.8, padding: '5px 8px', fontSize: '11px', border: '1px solid #D1D5DB', borderRadius: '4px', fontWeight: 700 }} 
                      />
                      <button onClick={() => handleRemoveWeightRow(row.id)} style={{ padding: '4px 6px', backgroundColor: '#FEE2E2', color: '#EF4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '8px', fontSize: '11px', fontWeight: 700, color: '#4B5563', textAlign: 'right' }}>
                  Total Kilos: {calc.totalFabricKilos} kg
                </div>
              </div>

              {/* Dynamic rows for processes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {fabricCosts.map((item, idx) => (
                  <div key={item.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: '#FAFAFA', padding: '10px 14px', borderRadius: '8px', border: '1px solid #F3F4F6' }}>
                    <span style={{ flex: 1.5, fontSize: '12.5px', fontWeight: 700, color: '#374151' }}>{item.label}</span>
                    
                    {/* Mode selector: Per unit vs per batch */}
                    <div style={{ display: 'flex', gap: '4px', backgroundColor: '#E5E7EB', padding: '2px', borderRadius: '6px' }}>
                      <button 
                        onClick={() => {
                          const updated = [...fabricCosts];
                          updated[idx].type = 'per_unit';
                          setFabricCosts(updated);
                        }}
                        style={{
                          padding: '4px 8px', fontSize: '10px', fontWeight: 700, border: 'none', borderRadius: '4px', cursor: 'pointer',
                          backgroundColor: item.type === 'per_unit' ? '#FFF' : 'transparent',
                          color: item.type === 'per_unit' ? '#111' : '#6B7280'
                        }}
                      >
                        Por Polo
                      </button>
                      <button 
                        onClick={() => {
                          const updated = [...fabricCosts];
                          updated[idx].type = 'total_lote';
                          setFabricCosts(updated);
                        }}
                        style={{
                          padding: '4px 8px', fontSize: '10px', fontWeight: 700, border: 'none', borderRadius: '4px', cursor: 'pointer',
                          backgroundColor: item.type === 'total_lote' ? '#FFF' : 'transparent',
                          color: item.type === 'total_lote' ? '#111' : '#6B7280'
                        }}
                      >
                        Por Lote
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '130px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280' }}>S/.</span>
                      <input 
                        type="number" 
                        value={item.value} 
                        onChange={e => {
                          const updated = [...fabricCosts];
                          updated[idx].value = e.target.value;
                          setFabricCosts(updated);
                        }} 
                        placeholder="0.00" 
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #D1D5DB', borderRadius: '4px', fontSize: '12.5px', fontWeight: 800, textAlign: 'right' }} 
                      />
                    </div>

                    <button onClick={() => handleRemoveFabricCost(item.id)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }} title="Eliminar concepto">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Row to add custom field */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px', borderTop: '1px dashed #E5E7EB', paddingTop: '14px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  value={newFieldName} 
                  onChange={e => setNewFieldName(e.target.value)} 
                  placeholder="Nuevo concepto (Ej: Bordado)" 
                  style={{ flex: 1.5, padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '12px' }} 
                />
                <select value={newFieldType} onChange={e => setNewFieldType(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '12px', backgroundColor: '#FFF' }}>
                  <option value="per_unit">Por Polo</option>
                  <option value="total_lote">Por Lote</option>
                </select>
                <input 
                  type="number" 
                  value={newFieldValue} 
                  onChange={e => setNewFieldValue(e.target.value)} 
                  placeholder="Costo S/." 
                  style={{ width: '90px', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '12px', textAlign: 'right' }} 
                />
                <button onClick={handleAddCustomField} style={{ padding: '8px 14px', backgroundColor: '#111', color: '#C5A880', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  Añadir
                </button>
              </div>
            </div>

            {/* 4. COSTOS DE IMPORTACIÓN */}
            <div style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#111', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                4. Costos de Importación (Distribuidos)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                {Object.keys(importCosts).map(key => (
                  <div key={key}>
                    <label style={{ fontSize: '9px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>{key}</label>
                    <input 
                      type="number" 
                      value={importCosts[key]} 
                      onChange={e => setImportCosts({ ...importCosts, [key]: e.target.value })} 
                      placeholder="0.00" 
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #D1D5DB', borderRadius: '4px', fontSize: '12px', textAlign: 'right' }} 
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 5. GASTOS OPERATIVOS */}
            <div style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#111', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  5. Gastos Operativos (Fijos / Variables)
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#4B5563' }}>Incluir en Costo Unitario:</span>
                  <button 
                    onClick={() => setIncludeOpCosts(!includeOpCosts)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    {includeOpCosts ? <ToggleRight size={28} color="#10B981" /> : <ToggleLeft size={28} color="#9CA3AF" />}
                  </button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                {Object.keys(opCosts).map(key => (
                  <div key={key}>
                    <label style={{ fontSize: '9px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>{key}</label>
                    <input 
                      type="number" 
                      value={opCosts[key]} 
                      onChange={e => setOpCosts({ ...opCosts, [key]: e.target.value })} 
                      placeholder="0.00" 
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #D1D5DB', borderRadius: '4px', fontSize: '12px', textAlign: 'right' }} 
                    />
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT PANELS: SIMULATOR & PRICES */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'sticky', top: '84px' }}>
            
            {/* COST SUMMARY */}
            <div style={{
              background: 'linear-gradient(135deg, #111 0%, #1a1a2e 100%)',
              borderRadius: '14px', padding: '24px', color: '#FFF',
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)'
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#C5A880', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
                ✦ Resumen de Costeo Automático
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Unidades Totales</span>
                  <span style={{ fontSize: '16px', fontWeight: 800 }}>{calc.qty}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Costo Fabricación Lote</span>
                  <span style={{ fontSize: '15px', fontWeight: 700 }}>{fmt(calc.totalFabricationLot)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Costo Importación Lote</span>
                  <span style={{ fontSize: '15px', fontWeight: 700 }}>{fmt(calc.totalImportLot)}</span>
                </div>
                {includeOpCosts && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Gastos Operativos Lote</span>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#F59E0B' }}>{fmt(calc.totalOpLot)}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#C5A880', fontWeight: 700 }}>COSTO UNITARIO REAL</span>
                <span style={{ fontSize: '24px', fontWeight: 800, color: '#C5A880' }}>{fmt(calc.finalUnitCost)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Inversión Total del Lote</span>
                <span style={{ fontSize: '16px', fontWeight: 700 }}>{fmt(calc.finalLotCost)}</span>
              </div>
            </div>

            {/* MULTIPLE PRICES DEFINITION */}
            <div style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#111', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                7. Lista de Precios y Ganancia
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Mayorista */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FAFAFA', padding: '10px', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>Mayorista ({marginMayorista}%)</span>
                    <input 
                      type="range" min="5" max="150" value={marginMayorista} 
                      onChange={e => setMarginMayorista(parseFloat(e.target.value))} 
                      style={{ display: 'block', width: '120px', marginTop: '6px' }}
                    />
                    <span style={{ fontSize: '9px', color: marginMayorista >= RECOMMENDED_MARGINS.mayorista.min && marginMayorista <= RECOMMENDED_MARGINS.mayorista.max ? '#10B981' : '#F59E0B' }}>{RECOMMENDED_MARGINS.mayorista.label}</span>
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#10B981' }}>{fmt(calc.prices.mayorista)}</span>
                </div>

                {/* Minorista */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FAFAFA', padding: '10px', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>Minorista ({marginMinorista}%)</span>
                    <input 
                      type="range" min="5" max="150" value={marginMinorista} 
                      onChange={e => setMarginMinorista(parseFloat(e.target.value))} 
                      style={{ display: 'block', width: '120px', marginTop: '6px' }}
                    />
                    <span style={{ fontSize: '9px', color: marginMinorista >= RECOMMENDED_MARGINS.minorista.min && marginMinorista <= RECOMMENDED_MARGINS.minorista.max ? '#10B981' : '#F59E0B' }}>{RECOMMENDED_MARGINS.minorista.label}</span>
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#3B82F6' }}>{fmt(calc.prices.minorista)}</span>
                </div>

                {/* Distribuidor */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FAFAFA', padding: '10px', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>Distribuidor ({marginDistribuidor}%)</span>
                    <input 
                      type="range" min="5" max="150" value={marginDistribuidor} 
                      onChange={e => setMarginDistribuidor(parseFloat(e.target.value))} 
                      style={{ display: 'block', width: '120px', marginTop: '6px' }}
                    />
                    <span style={{ fontSize: '9px', color: marginDistribuidor >= RECOMMENDED_MARGINS.distribuidor.min && marginDistribuidor <= RECOMMENDED_MARGINS.distribuidor.max ? '#10B981' : '#F59E0B' }}>{RECOMMENDED_MARGINS.distribuidor.label}</span>
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#8B5CF6' }}>{fmt(calc.prices.distribuidor)}</span>
                </div>

                {/* VIP */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FAFAFA', padding: '10px', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>Precio VIP ({marginVIP}%)</span>
                    <input 
                      type="range" min="5" max="150" value={marginVIP} 
                      onChange={e => setMarginVIP(parseFloat(e.target.value))} 
                      style={{ display: 'block', width: '120px', marginTop: '6px' }}
                    />
                    <span style={{ fontSize: '9px', color: marginVIP >= RECOMMENDED_MARGINS.vip.min && marginVIP <= RECOMMENDED_MARGINS.vip.max ? '#10B981' : '#F59E0B' }}>{RECOMMENDED_MARGINS.vip.label}</span>
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#EC4899' }}>{fmt(calc.prices.vip)}</span>
                </div>
              </div>
            </div>

            {/* SAVE AND INTEGRATE ERP ACTION BUTTONS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={handleSaveProject}
                style={{ width: '100%', padding: '12px', fontSize: '13px', fontWeight: 700, borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: '#FFF', color: '#111', cursor: 'pointer' }}
              >
                💾 Guardar como Presupuesto / Borrador
              </button>
              
              <button 
                onClick={handleIntegrateInventory}
                style={{
                  width: '100%', padding: '14px', fontSize: '13px', fontWeight: 700, borderRadius: '8px', border: 'none',
                  backgroundColor: '#C5A880', color: '#111', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(197,168,128,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <Package size={16} /> Enviar Costo y Publicar en Inventario
              </button>
            </div>

          </div>

        </div>
      )}

      {/* ==================== TAB 3: ANALYTICS & REPORTS ==================== */}
      {activeTab === 'dashboard' && (() => {
        // Pre-compute chart data
        const chartInvestment = projects.map(p => {
          const qty = p.unitsQty || 1;
          let fabLot = 0;
          (p.fabricCosts || []).forEach(f => { const v = parseFloat(f.value) || 0; fabLot += f.type === 'per_unit' ? (v * qty) : v; });
          const imp = Object.values(p.importCosts || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);
          return { label: p.projectName, value: fabLot + imp };
        });
        const chartProfit = projects.map(p => {
          const qty = p.unitsQty || 1;
          let fabLot = 0;
          (p.fabricCosts || []).forEach(f => { const v = parseFloat(f.value) || 0; fabLot += f.type === 'per_unit' ? (v * qty) : v; });
          const imp = Object.values(p.importCosts || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);
          const unitCost = (fabLot + imp) / qty;
          const priceMay = unitCost * (1 + ((p.marginMayorista || 30) / 100));
          return { label: p.projectName, value: (priceMay - unitCost) * qty };
        });
        const chartUnitCost = projects.map(p => {
          const qty = p.unitsQty || 1;
          let fabLot = 0;
          (p.fabricCosts || []).forEach(f => { const v = parseFloat(f.value) || 0; fabLot += f.type === 'per_unit' ? (v * qty) : v; });
          const imp = Object.values(p.importCosts || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);
          return { label: p.projectName, value: (fabLot + imp) / qty };
        });
        const avgMargin = projects.length > 0 ? (projects.reduce((s,p) => s + (p.marginMayorista || 30), 0) / projects.length) : 0;

        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Main indicators */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            <div style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
              <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 600 }}>INVERSIÓN TOTAL ACUMULADA</span>
              <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#111', margin: '8px 0 0' }}>{fmt(dashboardStats.totalInvestment)}</h2>
            </div>
            <div style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
              <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 600 }}>RENTABILIDAD PROMEDIO</span>
              <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#10B981', margin: '8px 0 0' }}>{fmtNum(avgMargin)} %</h2>
            </div>
            <div style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
              <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 600 }}>PROYECTOS COMPLETADOS</span>
              <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#6366F1', margin: '8px 0 0' }}>{dashboardStats.finishedCount} / {projects.length}</h2>
            </div>
          </div>

          {/* CHARTS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Bar chart: Investment per Project */}
            <div style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#111', marginBottom: '14px', textTransform: 'uppercase' }}>📊 Inversión por Lote</h4>
              {projects.length > 0 ? (
                <MiniBarChart data={chartInvestment} colors={['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6']} height={180} />
              ) : <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Sin datos</span>}
            </div>

            {/* Line chart: Unit cost trend */}
            <div style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#111', marginBottom: '14px', textTransform: 'uppercase' }}>📈 Costo Unitario por Lote</h4>
              {projects.length > 0 ? (
                <MiniLineChart data={chartUnitCost} color="#C5A880" height={180} />
              ) : <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Sin datos</span>}
            </div>

            {/* Bar chart: Profits */}
            <div style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px', gridColumn: '1 / -1' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#111', marginBottom: '14px', textTransform: 'uppercase' }}>💰 Ganancia Esperada por Lote</h4>
              {projects.length > 0 ? (
                <MiniBarChart data={chartProfit} colors={['#10B981', '#34D399', '#059669', '#047857', '#065F46', '#064E3B']} height={160} />
              ) : <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Sin datos</span>}
            </div>
          </div>

          {/* Detailed profitability table */}
          <div style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#111', marginBottom: '18px' }}>Rentabilidad por Proyecto / Lote</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {projects.map(p => {
                const qty = p.unitsQty || 1;
                let fabLot = 0;
                (p.fabricCosts || []).forEach(f => {
                  const v = parseFloat(f.value) || 0;
                  fabLot += f.type === 'per_unit' ? (v * qty) : v;
                });
                const imp = Object.values(p.importCosts || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);
                const acq = p.purchaseType === 'unit' ? (p.acquisitionCost * qty) : 0;
                const costTotal = acq + fabLot + imp;
                const unitCost = costTotal / qty;
                const priceMay = unitCost * (1 + ((p.marginMayorista || 30) / 100));
                const profitUnit = priceMay - unitCost;

                return (
                  <div key={p.id} style={{ borderBottom: '1px solid #F3F4F6', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                      <span>{p.projectName}</span>
                      <span style={{ color: '#10B981' }}>+ {fmt(profitUnit * qty)} (Esp.)</span>
                    </div>
                    <div style={{ display: 'flex', gap: '20px', fontSize: '11px', color: '#6B7280' }}>
                      <span>Inversión: {fmt(costTotal)}</span>
                      <span>Unidades: {qty}</span>
                      <span>Costo unitario: {fmt(unitCost)}</span>
                      <span>Precio mayorista: {fmt(priceMay)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        );
      })()}

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 900px) {
          div[style*="gridTemplateColumns: '1.4fr 1fr'"] {
            grid-template-columns: 1fr !important;
          }
        }
      ` }} />

    </div>
  );
}
