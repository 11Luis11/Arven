import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, Search, X, PackageSearch } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../services/dataService';
import SEO from '../components/SEO';
import ProductCard, { ProductCardSkeleton } from '../components/ProductCard';
import { getCardPricing } from '../utils/pricing';

// Búsqueda sin distinguir mayúsculas ni tildes ("algodon" encuentra "Algodón").
const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const chipStyle = (active) => ({
  padding: '8px 16px',
  minHeight: '38px',
  borderRadius: 'var(--radius-pill)',
  border: `1px solid ${active ? 'var(--text-primary)' : 'var(--border-color)'}`,
  background: active ? 'var(--text-primary)' : 'var(--bg-card)',
  color: active ? '#FFF' : 'var(--text-primary)',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 500,
  fontFamily: 'inherit',
  transition: 'background .15s ease, border-color .15s ease'
});

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('newest');

  // Categoría y búsqueda viven en la URL (fuente única de verdad): así los enlaces
  // del navbar/footer, el botón "atrás" y compartir el enlace funcionan siempre.
  const selectedCategory = searchParams.get('category') || 'all';
  const searchQuery = searchParams.get('search') || '';

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== 'all') next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      const [prods, cats] = await Promise.all([DataService.getProducts(), DataService.getCategories()]);
      if (cancelled) return;
      setProducts(prods.filter(p => p.active));
      setCategories(cats.filter(c => c.active));
      setLoading(false);
    };
    loadData();
    const unsubscribe = subscribeToRealtime(() => loadData());
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  const filteredProducts = useMemo(() => {
    const catObj = selectedCategory !== 'all' ? categories.find(c => c.slug === selectedCategory) : null;
    const query = normalize(searchQuery.trim());
    const list = products.filter(prod => {
      if (catObj && prod.category_id !== catObj.id) return false;
      if (query) return normalize(prod.name).includes(query) || normalize(prod.sku).includes(query);
      return true;
    });
    return list.sort((a, b) => {
      if (sortOrder === 'price-asc') return getCardPricing(a).price - getCardPricing(b).price;
      if (sortOrder === 'price-desc') return getCardPricing(b).price - getCardPricing(a).price;
      return (new Date(b.created_at).getTime() || 0) - (new Date(a.created_at).getTime() || 0);
    });
  }, [products, categories, selectedCategory, searchQuery, sortOrder]);

  const activeCategoryName = categories.find(c => c.slug === selectedCategory)?.name;
  const hasFilters = selectedCategory !== 'all' || !!searchQuery;

  return (
    <div
      className="catalog-page-root"
      style={{ padding: '40px 24px 64px', maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto', width: '100%', minHeight: '80vh', boxSizing: 'border-box' }}
    >
      <SEO
        title={activeCategoryName ? `${activeCategoryName} | Catálogo` : 'Catálogo de Polos'}
        description="Explora nuestra colección premium de polos básicos, oversize, estampados y exclusivos de algodón de alta gama."
      />

      <div className="catalog-header" style={{ marginBottom: '28px' }}>
        <span style={{ fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 500 }}>Colección</span>
        <h1 style={{ fontSize: '32px', fontWeight: 600, marginTop: '6px', letterSpacing: '-0.01em' }}>
          {activeCategoryName || 'Catálogo de prendas'}
        </h1>
        {!loading && (
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            {filteredProducts.length} {filteredProducts.length === 1 ? 'producto' : 'productos'}
            {searchQuery && <> para “{searchQuery}”</>}
          </p>
        )}
      </div>

      {/* Controles: categorías + búsqueda + orden */}
      <div
        className="catalog-filters"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '28px'
        }}
      >
        <div className="catalog-filter-cats" role="tablist" aria-label="Categorías" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" role="tab" aria-selected={selectedCategory === 'all'} onClick={() => updateParam('category', 'all')} style={chipStyle(selectedCategory === 'all')}>
            Todos
          </button>
          {categories.map(cat => (
            <button
              type="button"
              role="tab"
              key={cat.id}
              aria-selected={selectedCategory === cat.slug}
              onClick={() => updateParam('category', cat.slug)}
              style={chipStyle(selectedCategory === cat.slug)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="catalog-search-sort" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="search"
              className="input-field"
              placeholder="Buscar polo..."
              aria-label="Buscar productos"
              value={searchQuery}
              onChange={e => updateParam('search', e.target.value)}
              style={{ paddingLeft: '36px', paddingRight: searchQuery ? '36px' : undefined, width: '220px', fontSize: '14px' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => updateParam('search', '')}
                aria-label="Limpiar búsqueda"
                style={{ position: 'absolute', right: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '6px' }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <SlidersHorizontal size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} aria-hidden="true" />
            <select
              className="input-field"
              aria-label="Ordenar productos"
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              style={{ fontSize: '14px', width: 'auto' }}
            >
              <option value="newest">Más recientes</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="price-desc">Precio: mayor a menor</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid de productos */}
      {loading ? (
        <div className="catalog-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          {Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="empty-state" style={{ padding: '72px 24px' }}>
          <PackageSearch size={40} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
          <h3>No encontramos productos</h3>
          <p style={{ fontSize: '14px', maxWidth: '360px' }}>
            {hasFilters ? 'Prueba con otra búsqueda o categoría.' : 'Aún no hay prendas publicadas. Vuelve pronto.'}
          </p>
          {hasFilters && (
            <button type="button" className="btn-secondary" style={{ marginTop: '8px' }} onClick={() => setSearchParams({}, { replace: true })}>
              Ver todos los productos
            </button>
          )}
        </div>
      ) : (
        <div className="catalog-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          {filteredProducts.map((prod, idx) => (
            <ProductCard key={prod.id} product={prod} priority={idx < 3} />
          ))}
        </div>
      )}
    </div>
  );
}
