import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Star, Mail, Shield, CheckCircle, Truck, RefreshCw, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../services/dataService';
import SEO from '../components/SEO';
import { VideoPlayer, useResolvedUrl } from '../components/MediaResolver';

export default function Storefront({ onOpenCart }) {
  const [config, setConfig] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedOfferItems, setSelectedOfferItems] = useState([]);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);


  // Sliders State
  const [activeHeroIdx, setActiveHeroIdx] = useState(0);

  const [activeReviewIdx, setActiveReviewIdx] = useState(0);

  const revealRefs = useRef([]);

  const loadData = async () => {
    const cfg = await DataService.getConfig();
    setConfig(cfg);
    
    const prods = await DataService.getProducts();
    setProducts(prods.filter(p => p.active)); // Store all active products for the dynamic home search bar

    const cats = await DataService.getCategories();
    setCategories(cats.filter(c => c.active));

    // Filter selected active offers for the text carousel
    const selectedIds = cfg.selectedOffers || [];
    const activeOffers = prods.filter(p => p.active && selectedIds.includes(p.id) && (p.offer_price !== null || p.wholesale_price !== null));
    setSelectedOfferItems(activeOffers);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToRealtime(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  // Temporizador para el Hero Slider principal (cada 5 segundos)
  useEffect(() => {
    if (!config || !config.heroImages || config.heroImages.length <= 1) return;
    const interval = setInterval(() => {
      setActiveHeroIdx(prev => (prev + 1) % config.heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [config]);

  // Temporizador para el carrusel de texto de opiniones (cada 4.5 segundos)
  useEffect(() => {
    const reviewList = config?.testimonials || [];
    if (reviewList.length <= 1) return;
    const interval = setInterval(() => {
      setActiveReviewIdx(prev => (prev + 1) % reviewList.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [config]);

  // Scroll Reveal
  useEffect(() => {
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });

      revealRefs.current.forEach(ref => {
        if (ref) observer.observe(ref);
      });

      return () => observer.disconnect();
    }
  }, [products, categories]);



  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);
    setEmail('');
    setTimeout(() => setSubscribed(false), 4000);
  };

  const heroImageList = config?.heroImages && config.heroImages.length > 0 
    ? config.heroImages 
    : ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=1600&auto=format&fit=crop&q=80'];

  const activeHeroUrl = useResolvedUrl(heroImageList[activeHeroIdx]);

  if (!config) return null;

  const reviewList = config.testimonials || [];


  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SEO title="Inicio" description={config.heroSubtitle} ogImage={heroImageList[0]} />

      <div style={{
        backgroundColor: '#111',
        color: '#FFF',
        fontSize: '11px',
        fontWeight: 500,
        letterSpacing: '0.15em',
        padding: '10px 20px',
        textAlign: 'center',
        textTransform: 'uppercase'
      }}>
        {config.bannerText}
      </div>

      {/* HERO SLIDER PRINCIPAL INTERACTIVO */}
      <section style={{
        position: 'relative',
        height: '80vh',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFF',
        backgroundColor: '#111'
      }}>
        {/* Imagen del Slider Activo */}
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.7)), url(${activeHeroUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transition: 'background-image 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            zIndex: 1
          }}
        />

        {/* Contenido Hero Alineado al Centro-Derecha (Caja Roja del usuario) */}
        <div className="hero-content-container">
          <h1 style={{
            fontSize: 'calc(18px + 1vw)',
            fontWeight: 500,
            lineHeight: 1.2,
            color: '#DFB15B', // Color Dorado Lujoso
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.85)' // Sombra para legibilidad sin fondo
          }}>
            {config.heroTitle}
          </h1>
          <p style={{
            fontSize: '13px',
            color: '#F4E8C1', // Texto color crema dorado suave
            marginBottom: '24px',
            fontWeight: 300,
            lineHeight: 1.5,
            maxWidth: '520px',
            textShadow: '0 1px 8px rgba(0, 0, 0, 0.9)' // Sombra para legibilidad sin fondo
          }}>
            {config.heroSubtitle}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
            <Link to="/catalog" className="btn-primary" style={{ backgroundColor: '#DFB15B', color: '#111111', fontWeight: 600, border: 'none', borderRadius: '0px', padding: '10px 24px', fontSize: '12px', letterSpacing: '0.05em', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              Comprar ahora
            </Link>
            <Link to="/catalog" className="btn-secondary" style={{ borderColor: '#DFB15B', color: '#DFB15B', backgroundColor: 'rgba(0, 0, 0, 0.3)', fontWeight: 600, borderRadius: '0px', padding: '10px 24px', fontSize: '12px', letterSpacing: '0.05em', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              Ver colección
            </Link>
          </div>
        </div>

        <style>{`
          .hero-content-container {
            position: absolute;
            bottom: 50px;
            left: 36%;
            z-index: 2;
            max-width: 650px;
            width: calc(100% - 40%);
            text-align: left;
            animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          @media (max-width: 992px) {
            .hero-content-container {
              left: 20%;
              width: calc(100% - 25%);
            }
          }
          @media (max-width: 768px) {
            .hero-content-container {
              left: 20px;
              width: calc(100% - 40px);
              bottom: 40px;
            }
          }
        `}</style>

        {/* Flechas Hero */}
        {heroImageList.length > 1 && (
          <>
            <button 
              onClick={() => setActiveHeroIdx(prev => (prev - 1 + heroImageList.length) % heroImageList.length)}
              className="accessible-touch"
              style={{ position: 'absolute', left: '20px', zIndex: 10, background: 'none', border: 'none', color: '#FFF', cursor: 'pointer' }}
              aria-label="Anterior Slider"
            >
              <ChevronLeft size={32} />
            </button>
            <button 
              onClick={() => setActiveHeroIdx(prev => (prev + 1) % heroImageList.length)}
              className="accessible-touch"
              style={{ position: 'absolute', right: '20px', zIndex: 10, background: 'none', border: 'none', color: '#FFF', cursor: 'pointer' }}
              aria-label="Siguiente Slider"
            >
              <ChevronRight size={32} />
            </button>
          </>
        )}

        {/* Indicadores Slider */}
        <div style={{ position: 'absolute', bottom: '16px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '8px', zIndex: 10 }}>
          {heroImageList.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveHeroIdx(idx)}
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: activeHeroIdx === idx ? '#FFF' : 'rgba(255,255,255,0.4)',
                border: 'none',
                cursor: 'pointer',
                padding: 0
              }}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      </section>

      {/* ESTILOS Y ANIMACIONES CSS GLOBALES PARA EL CARRUSEL CONTINUO (MARQUEE) */}
      <style>{`
        @keyframes marquee-scroll {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-33.33%); }
        }
        .marquee-container:hover .marquee-content {
          animation-play-state: paused;
        }
        @media (max-width: 768px) {
          .marquee-content span {
            font-size: 10px !important;
            margin-right: 40px !important;
          }
        }
      `}</style>

      {/* CARRUSEL DE TEXTO DE PROMOCIONES EN MOVIMIENTO CONTINUO */}
      {selectedOfferItems.length > 0 && (
        <div 
          className="marquee-container"
          style={{
            backgroundColor: '#0F0F11', // Deep carbon charcoal dark background
            borderBottom: '1px solid #1F1F24',
            borderTop: '1px solid #1F1F24',
            padding: '16px 0',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            zIndex: 5
          }}
        >
          <div 
            className="marquee-content"
            style={{
              display: 'inline-block',
              animation: 'marquee-scroll 35s linear infinite',
              whiteSpace: 'nowrap'
            }}
          >
            {/* Triplicamos el array para que el scroll continuo sea completamente fluido y cubra toda la pantalla */}
            {[...selectedOfferItems, ...selectedOfferItems, ...selectedOfferItems].map((polo, idx) => (
              <span key={`${polo.id}-${idx}`} style={{
                fontSize: '11px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#E4E4E7',
                marginRight: '64px',
                display: 'inline-flex',
                alignItems: 'center',
                fontWeight: 500
              }}>
                {polo.offer_price ? (
                  <>
                    <span style={{
                      background: 'linear-gradient(135deg, #FF6B00, #FF3D00)',
                      color: '#FFFFFF',
                      padding: '2px 8px',
                      fontWeight: 700,
                      marginRight: '12px',
                      fontSize: '9px',
                      borderRadius: '0px'
                    }}>OFERTA</span>
                    <strong style={{ fontWeight: 600, color: '#FFF', marginRight: '6px' }}>{polo.name}</strong> a solo S/. {polo.offer_price.toFixed(2)} 
                    <span style={{ textDecoration: 'line-through', color: 'rgba(255,255,255,0.3)', marginLeft: '8px', fontSize: '10px' }}>S/. {polo.price.toFixed(2)}</span>
                  </>
                ) : (
                  <>
                    <span style={{
                      background: 'linear-gradient(135deg, #FF6B00, #FF3D00)',
                      color: '#FFFFFF',
                      padding: '2px 8px',
                      fontWeight: 700,
                      marginRight: '12px',
                      fontSize: '9px',
                      borderRadius: '0px'
                    }}>MAYORISTA</span>
                    <strong style={{ fontWeight: 600, color: '#FFF', marginRight: '6px' }}>{polo.name}</strong> a S/. {polo.wholesale_price.toFixed(2)} llevando {polo.wholesale_min_qty}+ uds
                  </>
                )}
                <Link to={`/product/${polo.id}`} style={{ color: '#FF6B00', marginLeft: '12px', textDecoration: 'underline', fontWeight: 700 }}>
                  VER DETALLES
                </Link>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* SECCIÓN CATEGORÍAS */}
      <section 
        ref={el => revealRefs.current[0] = el}
        className="reveal-on-scroll"
        style={{ padding: '80px 24px', maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto', width: '100%' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
          <div>
            <span style={{ fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Colecciones</span>
            <h2 style={{ fontSize: '28px', fontWeight: 500, marginTop: '8px' }}>Categorías Destacadas</h2>
          </div>
          <Link to="/catalog" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 500 }}>
            Ver Todo <ArrowRight size={16} />
          </Link>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '24px'
        }}>
          {categories.map((cat) => (
            <Link 
              to={`/catalog?category=${cat.slug}`}
              key={cat.id}
              className="hover-subtle"
              style={{
                display: 'block',
                position: 'relative',
                height: '380px',
                overflow: 'hidden',
                backgroundColor: '#FFF',
                border: '1px solid var(--border-color)',
              }}
            >
              <img 
                src={cat.image_url} 
                alt={cat.name} 
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transition: 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
              />
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '24px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.65))',
                color: '#FFF'
              }}>
                <h3 style={{ color: '#FFF', fontSize: '18px', fontWeight: 500, marginBottom: '4px' }}>{cat.name}</h3>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>{cat.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* PRODUCTOS DESTACADOS */}
      <section 
        ref={el => revealRefs.current[2] = el}
        className="reveal-on-scroll"
        style={{ padding: '80px 24px', backgroundColor: '#FFFFFF', width: '100%', borderBottom: '1px solid var(--border-color)' }}
      >
        <div style={{ maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <span style={{ fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Selección Exclusiva</span>
            <h2 style={{ fontSize: '32px', fontWeight: 400, marginTop: '8px', marginBottom: '24px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Nuestros Polos</h2>
          </div>

          {products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: '14px' }}>No hay polos cargados en el catálogo actualmente.</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '30px'
            }}>
              {products
                .slice(0, 8) // Mostrar los primeros 8 productos destacados
                .map((prod) => (
                  <div 
                    key={prod.id} 
                    className="hover-subtle"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      position: 'relative'
                    }}
                  >
                    {prod.offer_price && (
                      <span style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        background: 'linear-gradient(135deg, #FF6B00, #FF3D00)',
                        color: '#FFF',
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '4px 8px',
                        zIndex: 2,
                        letterSpacing: '0.08em'
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
                            borderRadius: '0px',
                            textAlign: 'center',
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
      </section>

      {/* BENEFICIOS */}
      <section 
        ref={el => revealRefs.current[3] = el}
        className="reveal-on-scroll"
        style={{ padding: '80px 24px', backgroundColor: 'var(--bg-primary)', borderTop: '1px solid var(--border-color)' }}
      >
        <div style={{
          maxWidth: '1200px',
          marginLeft: 'auto',
          marginRight: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '40px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <Truck size={28} strokeWidth={1.5} style={{ color: 'var(--color-primary)', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>Envíos Rápidos</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Despachos a todo el país el mismo día de tu compra.</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <Shield size={28} strokeWidth={1.5} style={{ color: 'var(--color-primary)', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>Pago 100% Seguro</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Encriptación SSL y pasarela certificada internacionalmente.</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <CheckCircle size={28} strokeWidth={1.5} style={{ color: 'var(--color-primary)', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>Calidad Premium</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Algodón seleccionado y acabados de sastrería de alta gama.</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <RefreshCw size={28} strokeWidth={1.5} style={{ color: 'var(--color-primary)', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>Cambios Fáciles</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>¿No te quedó la talla? Lo cambiamos sin costo adicional.</p>
          </div>
        </div>
      </section>

      {/* ESTILOS Y ANIMACIONES CSS GLOBALES PARA EL MARQUEE DE OPINIONES */}
      <style>{`
        @keyframes marquee-reviews-scroll {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .reviews-marquee-container:hover .reviews-marquee-content {
          animation-play-state: paused;
        }
      `}</style>

      {/* SECCIÓN TESTIMONIOS: CARRUSEL CONTINUO (MARQUEE) */}
      {reviewList.length > 0 && (
        <section 
          ref={el => revealRefs.current[4] = el}
          className="reveal-on-scroll"
          style={{ padding: '80px 0', backgroundColor: '#FAFAFA', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', overflow: 'hidden' }}
        >
          <div style={{ textAlign: 'center', marginBottom: '40px', padding: '0 24px' }}>
            <span style={{ fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Opiniones</span>
            <h2 style={{ fontSize: '28px', fontWeight: 400, marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lo que opinan nuestros clientes</h2>
          </div>

          <div 
            className="reviews-marquee-container"
            style={{
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              position: 'relative',
              width: '100%',
              display: 'flex'
            }}
          >
            <div 
              className="reviews-marquee-content"
              style={{
                display: 'inline-flex',
                animation: 'marquee-reviews-scroll 45s linear infinite',
                gap: '24px'
              }}
            >
              {[...reviewList, ...reviewList, ...reviewList].map((t, idx) => (
                <div 
                  key={`${t.id}-${idx}`}
                  style={{
                    display: 'inline-flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '24px 32px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#FFF',
                    minWidth: '350px',
                    maxWidth: '450px',
                    whiteSpace: 'normal',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                    {[...Array(t.stars)].map((_, i) => <Star key={i} size={14} fill="var(--text-primary)" stroke="none" />)}
                  </div>
                  <p style={{ fontSize: '13px', fontStyle: 'italic', marginBottom: '14px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    "{t.comment}"
                  </p>
                  <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                    — {t.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
 
      {/* SECCIÓN RUNWAY SHOWCASE - VIDEOS DE MODELOS */}
      <section style={{ 
        padding: '100px 24px', 
        backgroundColor: '#0A0A0C', // Immersive luxury black
        color: '#FFFFFF',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto' }}>
          <span style={{ fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#8E8E93', fontWeight: 600 }}>Cortes en Movimiento</span>
          <h2 style={{ fontSize: '32px', fontWeight: 400, marginTop: '10px', marginBottom: '16px', letterSpacing: '0.05em', color: '#FFF' }}>
            Runway Showcase
          </h2>
          <p style={{ fontSize: '14px', color: '#AEAEB2', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto', marginBottom: '60px', fontWeight: 300, lineHeight: 1.6 }}>
            Aprecia la caída perfecta y la fluidez de nuestros materiales premium en modelos reales bajo luz natural y de estudio.
          </p>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px',
            justifyContent: 'center'
          }}>
            {(config.videos && config.videos.length > 0 ? config.videos : [
              {
                url: 'https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3c054f4d823eec999811d2005efc8d1cf&profile_id=139&oauth2_token_id=57447761',
                title: 'Oversize Fit en Exterior',
                desc: 'Algodón pesado de 240g con caída natural estructurada'
              },
              {
                url: 'https://player.vimeo.com/external/435674703.sd.mp4?s=7fdf7022c4f1c99026388b13994e6347dbf5d878&profile_id=139&oauth2_token_id=57447761',
                title: 'Polo Básico Regular Fit',
                desc: 'Algodón Pima premium de tacto ultra suave y corte clásico'
              },
              {
                url: 'https://player.vimeo.com/external/540092323.sd.mp4?s=d9403c34a319da4601b138612ca495de2c050e04&profile_id=139&oauth2_token_id=57447761',
                title: 'Estampado Streetwear',
                desc: 'Diseño vanguardista con tintas ecológicas de larga duración'
              }
            ]).map((video, idx) => (
              <div key={idx} style={{ 
                backgroundColor: '#000', 
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                position: 'relative',
                height: '460px', // Reels vertical height
                width: '260px',
                transition: 'transform 0.3s ease'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden' }}>
                  <VideoPlayer 
                    url={video.url} 
                    title={video.title} 
                  />
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)',
                    pointerEvents: 'none',
                    zIndex: 1
                  }} />
                  <div style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '20px',
                    right: '20px',
                    textAlign: 'left',
                    color: '#FFF',
                    zIndex: 2
                  }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px', color: '#FFF', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{video.title}</h3>
                    <p style={{ fontSize: '11px', color: '#E5E5EA', fontWeight: 300, lineHeight: 1.3, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>{video.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section style={{ padding: '80px 24px', backgroundColor: '#111', color: '#FFF', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
          <Mail size={32} strokeWidth={1.5} style={{ marginBottom: '16px', opacity: 0.8 }} />
          <h2 style={{ fontSize: '28px', fontWeight: 400, color: '#FFF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
            Únete a la lista privada
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', marginBottom: '32px', fontWeight: 300 }}>
            Regístrate para recibir acceso exclusivo a nuevos lanzamientos, eventos especiales y descuentos de temporada.
          </p>

          {subscribed ? (
            <p style={{ color: 'var(--color-primary)', fontWeight: 500 }}>¡Gracias por suscribirte! Te enviaremos noticias pronto.</p>
          ) : (
            <form onSubmit={handleSubscribe} style={{ display: 'flex', gap: '8px', maxWidth: '450px', marginLeft: 'auto', marginRight: 'auto' }}>
              <input type="email" required placeholder="Ingresa tu correo electrónico" value={email} onChange={e => setEmail(e.target.value)} style={{ flex: 1, padding: '12px 16px', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)', color: '#FFF', outline: 'none', fontSize: '14px' }} />
              <button type="submit" style={{ padding: '12px 24px', backgroundColor: '#FFF', color: '#111', border: 'none', fontWeight: 500, cursor: 'pointer' }}>Suscribir</button>
            </form>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ backgroundColor: '#0A0A0A', color: 'rgba(255,255,255,0.5)', padding: '60px 24px 30px 24px', borderTop: '1px solid #222', fontSize: '13px' }}>
        <div style={{ maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '40px', marginBottom: '60px' }}>
          <div>
            <h3 style={{ color: '#FFF', fontSize: '16px', fontWeight: 500, marginBottom: '20px' }}>{config.storeName}</h3>
            <p style={{ lineHeight: 1.6, fontWeight: 300 }}>
              Tienda de ropa premium enfocada en el diseño minimalista, la caída perfecta y la máxima calidad.
            </p>
          </div>
          <div>
            <h4 style={{ color: '#FFF', fontSize: '14px', fontWeight: 500, marginBottom: '20px' }}>Enlaces</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li><Link to="/catalog" style={{ color: 'inherit' }}>Catálogo completo</Link></li>
              <li><Link to="/catalog?category=polos-oversize" style={{ color: 'inherit' }}>Polos Oversize</Link></li>
              <li><Link to="/catalog?category=polos-basicos" style={{ color: 'inherit' }}>Polos Básicos</Link></li>
            </ul>
          </div>
          <div>
            <h4 style={{ color: '#FFF', fontSize: '14px', fontWeight: 500, marginBottom: '20px' }}>Políticas</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li><a href="#" style={{ color: 'inherit' }}>Términos de servicio</a></li>
              <li><a href="#" style={{ color: 'inherit' }}>Políticas de privacidad</a></li>
              <li><a href="#" style={{ color: 'inherit' }}>Sitemap</a></li>
            </ul>
          </div>
          <div>
            <h4 style={{ color: '#FFF', fontSize: '14px', fontWeight: 500, marginBottom: '20px' }}>Contacto</h4>
            <p style={{ lineHeight: 1.6, fontWeight: 300, marginBottom: '8px' }}>Email: {config.footer?.email || 'soporte@carrillostore.com'}</p>
            <p style={{ lineHeight: 1.6, fontWeight: 300 }}>Soporte WhatsApp: {config.footer?.whatsapp || '+51 987 654 321'}</p>
          </div>
        </div>

        <div style={{ maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto', paddingTop: '30px', borderTop: '1px solid #1a1a1a', textAlign: 'center', fontSize: '12px' }}>
          © {new Date().getFullYear()} {config.storeName}. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}
