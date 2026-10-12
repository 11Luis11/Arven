import { useState, useEffect, useMemo } from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Eye, X, Package, AlertTriangle, PackageX, Boxes, Shirt } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../services/dataService';

const LOW_STOCK = 5;        // umbral de stock bajo por producto (igual que el Dashboard)
const LOW_STOCK_VARIANT = 3; // umbral por color / talla

const toInt = (v) => parseInt(v) || 0;
const money = (v) => (Number(v) || 0).toFixed(2);

function stockStatus(stock) {
  if (stock <= 0) return 'out';
  if (stock <= LOW_STOCK) return 'low';
  return 'ok';
}

function StockBadge({ stock }) {
  const s = stockStatus(stock);
  if (s === 'out') return <span className="badge badge-danger">Agotado</span>;
  if (s === 'low') return <span className="badge badge-warning">{stock} uds · Bajo</span>;
  return <span className="badge badge-success">{stock} uds</span>;
}

function SortTh({ field, label, sortField, sortAsc, onSort, align }) {
  const active = sortField === field;
  const Icon = active ? (sortAsc ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th style={{ textAlign: align || 'left', padding: 0 }} aria-sort={active ? (sortAsc ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(field)} style={{
        all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '12px 16px', width: '100%', justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        color: active ? 'var(--text-primary)' : 'inherit'
      }}>
        {label} <Icon size={12} />
      </button>
    </th>
  );
}

const thumb = { width: '40px', height: '50px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-subtle)', flexShrink: 0 };

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [stockFilter, setStockFilter] = useState('all'); // all | low | out | ok
  const [sortField, setSortField] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [detailProduct, setDetailProduct] = useState(null);

  const loadData = async () => {
    try {
      const [prods, cats] = await Promise.all([DataService.getProducts(), DataService.getCategories()]);
      setProducts(prods || []);
      setCategories(cats || []);
      setError('');
    } catch (err) {
      console.error(err);
      setError('No se pudo cargar el inventario. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos
    loadData();
    const unsubscribe = subscribeToRealtime(() => loadData());
    return () => unsubscribe();
  }, []);

  const handleSort = (field) => {
    if (sortField === field) setSortAsc(a => !a);
    else { setSortField(field); setSortAsc(true); }
  };

  const catName = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c.name])), [categories]);

  const stats = useMemo(() => {
    let units = 0, low = 0, out = 0;
    products.forEach(p => {
      const s = toInt(p.stock);
      units += Math.max(0, s);
      const st = stockStatus(s);
      if (st === 'low') low++;
      else if (st === 'out') out++;
    });
    return { total: products.length, units, low, out };
  }, [products]);

  const sorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = products.filter(p => {
      const matchesSearch = !q
        || (p.name || '').toLowerCase().includes(q)
        || (p.sku || '').toLowerCase().includes(q)
        || String(p.id || '').toLowerCase().includes(q);
      const matchesCat = selectedCat === 'all' || p.category_id === selectedCat;
      const matchesStock = stockFilter === 'all' || stockStatus(toInt(p.stock)) === stockFilter;
      return matchesSearch && matchesCat && matchesStock;
    });

    const getVal = (p) => {
      if (sortField === 'category') return catName[p.category_id] || '';
      if (sortField === 'stock') return toInt(p.stock);
      if (sortField === 'price') return Number(p.price) || 0;
      return String(p[sortField] ?? '');
    };
    return filtered.sort((a, b) => {
      const av = getVal(a), bv = getVal(b);
      const cmp = typeof av === 'number' ? av - bv : av.localeCompare(bv, 'es', { sensitivity: 'base' });
      return sortAsc ? cmp : -cmp;
    });
  }, [products, searchQuery, selectedCat, stockFilter, sortField, sortAsc, catName]);

  const sortProps = { sortField, sortAsc, onSort: handleSort };
  const hasFilters = searchQuery || selectedCat !== 'all' || stockFilter !== 'all';
  const clearFilters = () => { setSearchQuery(''); setSelectedCat('all'); setStockFilter('all'); };

  const statCards = [
    { key: 'all', label: 'Productos', value: stats.total, icon: Package, tone: 'primary' },
    { key: 'units', label: 'Unidades en stock', value: stats.units, icon: Boxes, tone: 'info' },
    { key: 'low', label: `Stock bajo (≤ ${LOW_STOCK})`, value: stats.low, icon: AlertTriangle, tone: 'warning' },
    { key: 'out', label: 'Agotados', value: stats.out, icon: PackageX, tone: 'danger' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1>Inventario</h1>
          <p>Vista de solo lectura. Para editar precios, stock por color o visibilidad, hazlo desde <strong>Productos</strong>.</p>
        </div>
      </div>

      {/* KPIs (los de alerta también sirven como filtro rápido) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        {statCards.map(s => {
          const Icon = s.icon;
          const clickable = s.key === 'low' || s.key === 'out' || s.key === 'all';
          const active = clickable && stockFilter === s.key && s.key !== 'all';
          return (
            <button key={s.key} type="button" className="stat-card"
              onClick={clickable ? () => setStockFilter(s.key === 'all' ? 'all' : (stockFilter === s.key ? 'all' : s.key)) : undefined}
              style={{
                textAlign: 'left', cursor: clickable ? 'pointer' : 'default', font: 'inherit', color: 'inherit',
                borderColor: active ? `var(--color-${s.tone})` : undefined,
                boxShadow: active ? `0 0 0 3px var(--color-${s.tone}-soft)` : undefined
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">{s.label}</span>
                <span className="stat-icon" style={{ background: `var(--color-${s.tone}-soft)`, color: `var(--color-${s.tone})`, width: '34px', height: '34px' }}><Icon size={18} /></span>
              </div>
              <span className="stat-value">{loading ? '—' : s.value}</span>
            </button>
          );
        })}
      </div>

      {!loading && (stats.low > 0 || stats.out > 0) && stockFilter === 'all' && (
        <div className="alert alert-warning" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: '200px' }}>
            {stats.out > 0 && <><strong>{stats.out}</strong> producto(s) agotado(s)</>}
            {stats.out > 0 && stats.low > 0 && ' y '}
            {stats.low > 0 && <><strong>{stats.low}</strong> con stock bajo</>}. Considera reponer pronto.
          </span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setStockFilter(stats.out > 0 ? 'out' : 'low')}>Ver productos</button>
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Filtros */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '420px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="text" className="input-field" style={{ paddingLeft: '38px' }}
            placeholder="Buscar por nombre, SKU o ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <select className="input-field" style={{ flex: '0 1 220px', width: 'auto' }} value={selectedCat} onChange={e => setSelectedCat(e.target.value)} aria-label="Filtrar por categoría">
          <option value="all">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input-field" style={{ flex: '0 1 180px', width: 'auto' }} value={stockFilter} onChange={e => setStockFilter(e.target.value)} aria-label="Filtrar por stock">
          <option value="all">Todo el stock</option>
          <option value="ok">Stock normal</option>
          <option value="low">Stock bajo</option>
          <option value="out">Agotados</option>
        </select>
        {hasFilters && <button type="button" className="btn-ghost btn-sm" onClick={clearFilters}><X size={14} /> Limpiar</button>}
        <span style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--text-secondary)' }}>{sorted.length} de {products.length}</span>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="table-wrap" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: '50px' }} />)}
        </div>
      ) : products.length === 0 ? (
        <div className="card empty-state">
          <Package size={40} style={{ color: 'var(--text-muted)' }} />
          <h3>Tu inventario está vacío</h3>
          <p style={{ fontSize: '14px' }}>Registra polos en <strong>Productos</strong> y aparecerán aquí con su stock.</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="card empty-state">
          <Search size={36} style={{ color: 'var(--text-muted)' }} />
          <h3>Sin resultados</h3>
          <p style={{ fontSize: '14px' }}>Ningún producto coincide con los filtros aplicados.</p>
          <button type="button" className="btn-secondary btn-sm" style={{ marginTop: '8px' }} onClick={clearFilters}>Limpiar filtros</button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <SortTh field="name" label="Producto" {...sortProps} />
                <SortTh field="sku" label="SKU" {...sortProps} />
                <SortTh field="category" label="Categoría" {...sortProps} />
                <SortTh field="stock" label="Stock" {...sortProps} />
                <SortTh field="price" label="Precio" align="right" {...sortProps} />
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(prod => {
                const stock = toInt(prod.stock);
                const st = stockStatus(stock);
                return (
                  <tr key={prod.id} style={st === 'out' ? { background: 'var(--color-danger-soft)' } : undefined}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '200px' }}>
                        {prod.image_url
                          ? <img src={prod.image_url} alt={prod.name} style={thumb} loading="lazy" />
                          : <div style={{ ...thumb, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shirt size={16} style={{ color: 'var(--text-muted)' }} /></div>}
                        <span style={{ fontWeight: 600 }}>{prod.name}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{prod.sku}</td>
                    <td>{catName[prod.category_id] || '—'}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}><StockBadge stock={stock} /></td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>S/. {money(prod.price)}</td>
                    <td>{prod.active ? <span className="badge badge-success">Visible</span> : <span className="badge">Pausado</span>}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => setDetailProduct(prod)}><Eye size={14} /> Detalle</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ======================== MODAL DETALLE ======================== */}
      {detailProduct && (
        <div className="modal-overlay" onClick={() => setDetailProduct(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={detailProduct.name} style={{ maxWidth: '620px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>{detailProduct.name}</h3>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>SKU: {detailProduct.sku} · {catName[detailProduct.category_id] || 'Sin categoría'}</span>
              </div>
              <button type="button" className="btn-ghost btn-icon" onClick={() => setDetailProduct(null)} aria-label="Cerrar"><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {detailProduct.image_url && (
                <img src={detailProduct.image_url} alt={detailProduct.name}
                  style={{ width: '120px', height: '150px', objectFit: 'cover', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', flexShrink: 0 }} />
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', flex: '1 1 260px' }}>
                <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Precio</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>S/. {money(detailProduct.price)}</div>
                </div>
                <div style={{ padding: '12px', background: detailProduct.offer_price ? 'var(--color-danger-soft)' : 'var(--bg-subtle)', borderRadius: 'var(--radius)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Oferta</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: detailProduct.offer_price ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                    {detailProduct.offer_price ? `S/. ${money(detailProduct.offer_price)}` : '—'}
                  </div>
                </div>
                <div style={{ padding: '12px', background: stockStatus(toInt(detailProduct.stock)) === 'ok' ? 'var(--color-success-soft)' : 'var(--color-warning-soft)', borderRadius: 'var(--radius)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Stock total</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{toInt(detailProduct.stock)} uds</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Estado</div>
                  <div style={{ marginTop: '4px' }}>{detailProduct.active ? <span className="badge badge-success">Visible</span> : <span className="badge">Pausado</span>}</div>
                </div>
              </div>
            </div>

            {detailProduct.description && (
              <div>
                <div className="field-label">Descripción</div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{detailProduct.description}</p>
              </div>
            )}

            {detailProduct.sizes?.length > 0 && !(detailProduct.colors?.length > 0) && (
              <div>
                <div className="field-label">Tallas disponibles</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {detailProduct.sizes.map(s => <span key={s} className="badge">{s}</span>)}
                </div>
              </div>
            )}

            {detailProduct.colors?.length > 0 && (
              <div>
                <div className="field-label">Stock por color{detailProduct.sizes?.length > 0 ? ' y talla' : ''}</div>
                <div className="table-wrap">
                  <table className="data-table" style={{ fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th>Color</th>
                        {(detailProduct.sizes || []).map(s => <th key={s} style={{ textAlign: 'center' }}>{s}</th>)}
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailProduct.colors.map(c => {
                        const cStock = toInt(c.stock);
                        const hasBreakdown = c.sizes_stock && Object.keys(c.sizes_stock).length > 0;
                        return (
                          <tr key={c.hex || c.name}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                                <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: c.hex, border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
                                {c.name}
                              </div>
                            </td>
                            {(detailProduct.sizes || []).map(s => {
                              const v = toInt(c.sizes_stock?.[s]);
                              return (
                                <td key={s} style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: !hasBreakdown ? 'var(--text-muted)' : v === 0 ? 'var(--color-danger)' : v <= LOW_STOCK_VARIANT ? 'var(--color-warning)' : undefined, fontWeight: hasBreakdown && v <= LOW_STOCK_VARIANT ? 600 : 400 }}>
                                  {hasBreakdown ? v : '—'}
                                </td>
                              );
                            })}
                            <td style={{ textAlign: 'right' }}>
                              <span className={`badge ${cStock <= 0 ? 'badge-danger' : cStock <= LOW_STOCK_VARIANT ? 'badge-warning' : 'badge-success'}`}>{cStock}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setDetailProduct(null)} className="btn-secondary">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
