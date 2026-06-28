import { useState, useEffect } from 'react';
import { Search, Filter, ArrowUpDown, Check, Edit2, Eye, X } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../services/dataService';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [sortField, setSortField] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [msg, setMsg] = useState('');

  // Estados para Edición Rápida en Línea
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ stock: 0, price: 0 });

  // Modal de detalle
  const [detailProduct, setDetailProduct] = useState(null);

  const loadData = async () => {
    const prods = await DataService.getProducts();
    setProducts(prods);

    const cats = await DataService.getCategories();
    setCategories(cats);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToRealtime(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  const handleStartEdit = (prod) => {
    setEditingId(prod.id);
    setEditForm({
      stock: prod.stock,
      price: prod.price
    });
  };

  const handleSaveInline = async (prod) => {
    const updated = {
      ...prod,
      stock: parseInt(editForm.stock) || 0,
      price: parseFloat(editForm.price) || 0
    };

    await DataService.saveProduct(updated);
    setEditingId(null);
    setMsg('Inventario actualizado con éxito.');
    setTimeout(() => setMsg(''), 3000);
  };

  const handleToggleActive = async (prod) => {
    const updated = {
      ...prod,
      active: !prod.active
    };
    await DataService.saveProduct(updated);
    setMsg(`Visibilidad de "${prod.name}" cambiada a ${!prod.active ? 'Visible' : 'Pausado'}.`);
    setTimeout(() => setMsg(''), 3000);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Filtrado
  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCat === 'all' || p.category_id === selectedCat;
    return matchesSearch && matchesCat;
  });

  // Ordenamiento
  const sorted = [...filtered].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (sortField === 'category') {
      aVal = categories.find(c => c.id === a.category_id)?.name || '';
      bVal = categories.find(c => c.id === b.category_id)?.name || '';
    }

    if (typeof aVal === 'string') {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    } else {
      return sortAsc ? aVal - bVal : bVal - aVal;
    }
  });

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {msg && (
        <div style={{
          padding: '10px 12px',
          backgroundColor: '#EBFBEE',
          color: '#2F855A',
          border: '1px solid #C6F6D5',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Check size={14} /> {msg}
        </div>
      )}

      {/* Controles de Filtros */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        {/* Búsqueda */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }} />
          <input 
            type="text"
            placeholder="Buscar por código, SKU o nombre..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              padding: '8px 12px 8px 36px',
              border: '1px solid var(--border-color)',
              fontSize: '13px',
              outline: 'none',
              width: '260px'
            }}
          />
        </div>

        {/* Filtrar Categoría */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
          <select
            value={selectedCat}
            onChange={e => setSelectedCat(e.target.value)}
            style={{
              padding: '8px',
              border: '1px solid var(--border-color)',
              fontSize: '13px',
              outline: 'none',
              backgroundColor: '#FFF'
            }}
          >
            <option value="all">Todas las Categorías</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla de Inventario */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '13px',
          textAlign: 'left'
        }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)', backgroundColor: '#FAFAFA' }}>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Imagen</th>
              
              <th 
                onClick={() => handleSort('name')}
                style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}
              >
                Producto <ArrowUpDown size={12} style={{ marginLeft: '4px', display: 'inline' }} />
              </th>

              <th 
                onClick={() => handleSort('sku')}
                style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}
              >
                SKU <ArrowUpDown size={12} style={{ marginLeft: '4px', display: 'inline' }} />
              </th>

              <th 
                onClick={() => handleSort('category')}
                style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}
              >
                Categoría <ArrowUpDown size={12} style={{ marginLeft: '4px', display: 'inline' }} />
              </th>

              <th 
                onClick={() => handleSort('stock')}
                style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}
              >
                Stock <ArrowUpDown size={12} style={{ marginLeft: '4px', display: 'inline' }} />
              </th>

              <th 
                onClick={() => handleSort('price')}
                style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}
              >
                Precio (S/.) <ArrowUpDown size={12} style={{ marginLeft: '4px', display: 'inline' }} />
              </th>

              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Estado</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500, textAlign: 'right' }}>Acciones rápidas</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(prod => {
              const isEditing = editingId === prod.id;
              const catObj = categories.find(c => c.id === prod.category_id);
              
              return (
                <tr 
                  key={prod.id} 
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: prod.stock <= 3 ? 'rgba(255, 77, 109, 0.02)' : 'transparent',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  {/* Imagen */}
                  <td style={{ padding: '12px 16px' }}>
                    <img 
                      src={prod.image_url} 
                      alt={prod.name} 
                      style={{ width: '40px', height: '50px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                    />
                  </td>

                  {/* Detalle */}
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>{prod.name}</td>

                  {/* SKU */}
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{prod.sku}</td>

                  {/* Categoria */}
                  <td style={{ padding: '12px 16px' }}>{catObj ? catObj.name : 'Polo'}</td>

                  {/* Stock (Edición Rápida) */}
                  <td style={{ padding: '12px 16px' }}>
                    {isEditing ? (
                      <input 
                        type="number"
                        value={editForm.stock}
                        onChange={e => setEditForm({ ...editForm, stock: e.target.value })}
                        style={{ width: '60px', padding: '4px', border: '1px solid var(--color-primary)' }}
                      />
                    ) : (
                      <span style={{
                        color: prod.stock <= 5 ? 'var(--color-secondary)' : 'inherit',
                        fontWeight: prod.stock <= 5 ? 600 : 'normal'
                      }}>
                        {prod.stock} uds
                      </span>
                    )}
                  </td>

                  {/* Precio (Edición Rápida) */}
                  <td style={{ padding: '12px 16px' }}>
                    {isEditing ? (
                      <input 
                        type="number"
                        step="0.1"
                        value={editForm.price}
                        onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                        style={{ width: '80px', padding: '4px', border: '1px solid var(--color-primary)' }}
                      />
                    ) : (
                      <span>S/. {prod.price.toFixed(2)}</span>
                    )}
                  </td>

                  {/* Estado Toggle */}
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => handleToggleActive(prod)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: prod.active ? 'var(--text-primary)' : '#FFF',
                        color: prod.active ? '#FFF' : 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                    >
                      {prod.active ? 'Visible' : 'Pausado'}
                    </button>
                  </td>

                  {/* Acciones */}
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button
                        onClick={() => setDetailProduct(prod)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px'
                        }}
                      >
                        <Eye size={13} /> Detalle
                      </button>
                    {isEditing ? (
                      <button 
                        onClick={() => handleSaveInline(prod)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'green',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Check size={16} /> Guardar
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleStartEdit(prod)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-primary)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Edit2 size={13} /> Editar rápido
                      </button>
                    )}
                    </div>
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ======================== MODAL DETALLE PRODUCTO ======================== */}
      {detailProduct && (() => {
        const catObj = categories.find(c => c.id === detailProduct.category_id);
        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
          }}>
            <div className="card" style={{
              width: '100%', maxWidth: '560px', maxHeight: '85vh',
              overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px',
              position: 'relative'
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>{detailProduct.name}</h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>SKU: {detailProduct.sku}</span>
                </div>
                <button
                  onClick={() => setDetailProduct(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Imagen */}
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <img
                  src={detailProduct.image_url}
                  alt={detailProduct.name}
                  style={{ width: '120px', height: '150px', objectFit: 'cover', border: '1px solid var(--border-color)', flexShrink: 0 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ padding: '10px 12px', backgroundColor: '#F9FAFB', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Precio</div>
                      <div style={{ fontSize: '16px', fontWeight: 700 }}>S/. {detailProduct.price?.toFixed(2)}</div>
                    </div>
                    {detailProduct.offer_price ? (
                      <div style={{ padding: '10px 12px', backgroundColor: '#FFF5F5', border: '1px solid #FEB2B2' }}>
                        <div style={{ fontSize: '11px', color: '#9B1C1C', marginBottom: '2px' }}>Precio Oferta</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#C53030' }}>S/. {detailProduct.offer_price?.toFixed(2)}</div>
                      </div>
                    ) : (
                      <div style={{ padding: '10px 12px', backgroundColor: '#F9FAFB', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Sin oferta</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>—</div>
                      </div>
                    )}
                    <div style={{ padding: '10px 12px', backgroundColor: detailProduct.stock <= 5 ? '#FFF5F5' : '#F0FFF4', border: `1px solid ${detailProduct.stock <= 5 ? '#FEB2B2' : '#9AE6B4'}` }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Stock Total</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: detailProduct.stock <= 5 ? '#C53030' : '#276749' }}>{detailProduct.stock} uds</div>
                    </div>
                    <div style={{ padding: '10px 12px', backgroundColor: '#F9FAFB', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Categoría</div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{catObj ? catObj.name : '—'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Estado:</span>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, padding: '2px 8px',
                      backgroundColor: detailProduct.active ? 'var(--text-primary)' : '#E5E7EB',
                      color: detailProduct.active ? '#FFF' : 'var(--text-secondary)'
                    }}>
                      {detailProduct.active ? 'Visible' : 'Pausado'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Descripción */}
              {detailProduct.description && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>Descripción</div>
                  <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5', margin: 0 }}>{detailProduct.description}</p>
                </div>
              )}

              {/* Tallas */}
              {detailProduct.sizes?.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Tallas disponibles</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {detailProduct.sizes.map(s => (
                      <span key={s} style={{
                        padding: '4px 12px', border: '1px solid var(--border-color)',
                        fontSize: '12px', fontWeight: 600, backgroundColor: '#F9FAFB'
                      }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Colores con stock */}
              {detailProduct.colors?.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Colores y stock por color</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {detailProduct.colors.map((c, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 12px', border: '1px solid var(--border-color)',
                        backgroundColor: '#FAFAFA'
                      }}>
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '50%',
                          backgroundColor: c.hex, border: '1px solid var(--border-color)', flexShrink: 0
                        }} />
                        <span style={{ fontSize: '13px', flex: 1 }}>{c.name}</span>
                        <span style={{
                          fontSize: '12px', fontWeight: 600,
                          color: c.stock <= 3 ? '#C53030' : '#276749',
                          padding: '2px 8px',
                          backgroundColor: c.stock <= 3 ? '#FFF5F5' : '#F0FFF4',
                          border: `1px solid ${c.stock <= 3 ? '#FEB2B2' : '#9AE6B4'}`
                        }}>{c.stock} uds</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cerrar */}
              <button
                onClick={() => setDetailProduct(null)}
                className="btn-secondary"
                style={{ alignSelf: 'flex-end', padding: '8px 20px', fontSize: '13px', borderRadius: '0px' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
