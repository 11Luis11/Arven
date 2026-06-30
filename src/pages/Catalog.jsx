import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { MessageSquare, SlidersHorizontal, Search } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../services/dataService';
import SEO from '../components/SEO';

export default function Catalog({ onOpenCart }) {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    const prods = await DataService.getProducts();
    setProducts(prods.filter(p => p.active));

    const cats = await DataService.getCategories();
    setCategories(cats.filter(c => c.active));
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToRealtime(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  // Leer categoría e inicializar búsqueda del query string
  useEffect(() => {
    const catQuery = searchParams.get('category');
    if (catQuery) {
      setSelectedCategory(catQuery);
    } else {
      setSelectedCategory('all');
    }

    const searchQueryParam = searchParams.get('search');
    if (searchQueryParam) {
      setSearchQuery(searchQueryParam);
    } else {
      setSearchQuery('');
    }
  }, [searchParams]);



  // Filtrado y Ordenación
  const filteredProducts = products.filter(prod => {
    // Filtrar por categoría
    if (selectedCategory !== 'all') {
      const catObj = categories.find(c => c.slug === selectedCategory);
      if (catObj && prod.category_id !== catObj.id) return false;
    }
    // Filtrar por búsqueda
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return prod.name.toLowerCase().includes(query) || prod.sku.toLowerCase().includes(query);
    }
    return true;
  }).sort((a, b) => {
    if (sortOrder === 'price-asc') {
      return (a.offer_price || a.price) - (b.offer_price || b.price);
    }
    if (sortOrder === 'price-desc') {
      return (b.offer_price || b.price) - (a.offer_price || a.price);
    }
    // 'newest'
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div style={{ padding: '40px 24px', maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto', width: '100%', minHeight: '80vh' }}>
      <SEO 
        title="Catálogo de Polos" 
        description="Explora nuestra colección premium de polos básicos, oversize, estampados y exclusivos de algodón de alta gama." 
      />

      <div style={{ marginBottom: '40px' }}>
        <span style={{ fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Colección</span>
        <h1 style={{ fontSize: '32px', fontWeight: 500, marginTop: '8px' }}>Catálogo de Prendas</h1>
      </div>

      {/* Controles de filtro y búsqueda */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '20px',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '24px',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: '40px'
      }}>
        {/* Categorías */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setSelectedCategory('all')}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--border-color)',
              background: selectedCategory === 'all' ? 'var(--text-primary)' : '#FFF',
              color: selectedCategory === 'all' ? '#FFF' : 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500
            }}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setSelectedCategory(cat.slug)}
              style={{
                padding: '8px 16px',
                border: '1px solid var(--border-color)',
                background: selectedCategory === cat.slug ? 'var(--text-primary)' : '#FFF',
                color: selectedCategory === cat.slug ? '#FFF' : 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Buscador y Ordenación */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Campo búsqueda */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }} />
            <input 
              type="text"
              placeholder="Buscar polo..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                padding: '8px 12px 8px 36px',
                border: '1px solid var(--border-color)',
                fontSize: '13px',
                outline: 'none',
                width: '200px'
              }}
            />
          </div>

          {/* Ordenar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SlidersHorizontal size={14} style={{ color: 'var(--text-secondary)' }} />
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              style={{
                padding: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '13px',
                outline: 'none',
                backgroundColor: '#FFF'
              }}
            >
              <option value="newest">Más recientes</option>
              <option value="price-asc">Precio: Menor a Mayor</option>
              <option value="price-desc">Precio: Mayor a Menor</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid de productos */}
      {filteredProducts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--text-secondary)' }}>
          <p>No se encontraron productos con los criterios especificados.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '30px'
        }}>
          {filteredProducts.map((prod) => (
            <div 
              key={prod.id} 
              className="hover-subtle"
              style={{
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid var(--border-color)',
                backgroundColor: '#FFF',
                position: 'relative'
              }}
            >
              {prod.offer_price && (
                <span style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  backgroundColor: 'var(--color-secondary)',
                  color: '#FFF',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 8px',
                  zIndex: 2,
                  letterSpacing: '0.05em'
                }}>
                  OFERTA
                </span>
              )}

              <Link to={`/product/${prod.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', overflow: 'hidden', backgroundColor: '#F8F8F8' }}>
                <img 
                  src={prod.image_url} 
                  alt={prod.name} 
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    transition: 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                    padding: '8px'
                  }}
                  onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                />
              </Link>

              <div style={{ padding: '20px', backgroundColor: '#FFF', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '6px' }}>{prod.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 600 }}>
                      S/. {(prod.offer_price || prod.price).toFixed(2)}
                    </span>
                    {prod.offer_price && (
                      <span style={{ fontSize: '13px', textDecoration: 'line-through', color: 'var(--text-secondary)' }}>
                        S/. {prod.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex' }}>
                  <Link 
                    to={`/product/${prod.id}`}
                    className="btn-primary"
                    style={{
                      flex: 1,
                      fontSize: '13px',
                      padding: '10px',
                      textAlign: 'center',
                      borderRadius: '0px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      backgroundColor: prod.stock === 0 ? '#CBD5E1' : 'var(--text-primary)',
                      color: '#FFF',
                      textDecoration: 'none',
                      fontWeight: 600
                    }}
                  >
                    <MessageSquare size={14} />
                    {prod.stock === 0 ? 'AGOTADO' : 'PEDIR POR WHATSAPP'}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
