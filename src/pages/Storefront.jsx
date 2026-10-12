import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Star, Mail, CheckCircle, Truck, RefreshCw, MessageCircle, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../services/dataService';
import SEO from '../components/SEO';
import { VideoPlayer } from '../components/MediaResolver';
import ProductCard, { ProductCardSkeleton } from '../components/ProductCard';
import { useResolvedUrl } from '../utils/media';
import { toNumber, formatMoney } from '../utils/pricing';

const DEFAULT_HERO = 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=1600&auto=format&fit=crop&q=80';

const DEFAULT_VIDEOS = [
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
];

const BENEFITS = [
  { Icon: Truck, title: 'Envíos rápidos', text: 'Despachos a todo el país el mismo día de tu compra.' },
  { Icon: MessageCircle, title: 'Compra por WhatsApp', text: 'Te atendemos personalmente y coordinamos pago y entrega contigo.' },
  { Icon: CheckCircle, title: 'Calidad premium', text: 'Algodón seleccionado y acabados de sastrería de alta gama.' },
  { Icon: RefreshCw, title: 'Cambios fáciles', text: '¿No te quedó la talla? Lo cambiamos sin costo adicional.' }
];

const PAGE_CSS = `
.sf-section-head { text-align: center; margin-bottom: 36px; }
.sf-eyebrow { display: inline-block; font-size: 12px; letter-spacing: .2em; text-transform: uppercase; color: var(--text-secondary); font-weight: 500; }
.sf-title { font-size: 32px; font-weight: 600; margin-top: 8px; letter-spacing: -0.01em; }
.sf-hero-slide { position: absolute; inset: 0; opacity: 0; transition: opacity .9s cubic-bezier(.16,1,.3,1); }
.sf-hero-slide.is-active { opacity: 1; }
.sf-hero-slide img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sf-hero-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.15) 0%, rgba(0,0,0,.25) 55%, rgba(0,0,0,.65) 100%); z-index: 1; }
.sf-hero-cta { position: absolute; bottom: 64px; left: 0; right: 0; z-index: 2; display: flex; justify-content: center; padding: 0 16px; animation: slideUp .8s cubic-bezier(.16,1,.3,1) both; }
.sf-hero-cta a { background: #DFB15B; color: #111; font-weight: 600; border-radius: 10px; padding: 14px 36px; font-size: 14px; letter-spacing: .08em; text-transform: uppercase; box-shadow: 0 8px 24px rgba(0,0,0,.25); display: inline-flex; align-items: center; gap: 10px; transition: transform .2s ease, background .2s ease; }
.sf-hero-cta a:hover { background: #E8C27A; transform: translateY(-1px); }
.sf-hero-arrow { position: absolute; top: 50%; transform: translateY(-50%); z-index: 3; width: 44px; height: 44px; border-radius: 999px; border: none; background: rgba(255,255,255,.18); backdrop-filter: blur(6px); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background .2s ease; }
.sf-hero-arrow:hover { background: rgba(255,255,255,.32); }
.sf-hero-dots { position: absolute; bottom: 20px; left: 0; right: 0; display: flex; justify-content: center; gap: 4px; z-index: 3; }
.sf-hero-dot { width: 24px; height: 24px; border: none; background: none; padding: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.sf-hero-dot span { display: block; height: 6px; width: 6px; border-radius: 999px; background: rgba(255,255,255,.5); transition: width .3s ease, background .3s ease; }
.sf-hero-dot.is-active span { width: 20px; background: #fff; }
.sf-cat-card { display: flex; flex-direction: column; gap: 10px; text-decoration: none; min-width: 0; }
.sf-cat-img { width: 100%; aspect-ratio: 4 / 3; border-radius: 12px; overflow: hidden; background: #F3F4F6; border: 1px solid var(--border-color); }
.sf-cat-img img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .5s cubic-bezier(.16,1,.3,1); }
.sf-cat-card:hover .sf-cat-img img { transform: scale(1.05); }
.sf-cat-name { font-size: 13px; font-weight: 600; text-align: center; color: var(--text-primary); text-transform: uppercase; letter-spacing: .04em; }
.sf-marquee { background: #111; padding: 14px 0; overflow: hidden; white-space: nowrap; display: flex; align-items: center; }
.sf-marquee-track { display: inline-block; white-space: nowrap; animation: marquee-scroll 35s linear infinite; }
.sf-marquee:hover .sf-marquee-track { animation-play-state: paused; }
.sf-marquee-item { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #E4E4E7; margin-right: 56px; display: inline-flex; align-items: center; gap: 8px; font-weight: 500; }
.sf-marquee-tag { background: var(--color-secondary); color: #fff; padding: 3px 9px; font-weight: 700; font-size: 10px; border-radius: 999px; letter-spacing: .06em; }
.sf-marquee-item a { color: #DFB15B; text-decoration: underline; font-weight: 600; }
@keyframes marquee-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-33.333%); } }
@keyframes marquee-reviews-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-33.333%); } }
.sf-reviews { overflow: hidden; display: flex; width: 100%; }
.sf-reviews-track { display: inline-flex; animation: marquee-reviews-scroll 45s linear infinite; padding: 4px 0 8px; }
.sf-reviews:hover .sf-reviews-track { animation-play-state: paused; }
.sf-review { display: flex; flex-direction: column; justify-content: center; margin: 0 20px 0 0; padding: 22px 26px; border: 1px solid var(--border-color); background: #fff; width: min(380px, 80vw); flex-shrink: 0; border-radius: 12px; box-shadow: var(--shadow-xs); white-space: normal; }
.sf-benefit { text-align: center; padding: 8px; }
.sf-benefit-icon { width: 52px; height: 52px; border-radius: 999px; background: var(--bg-card); border: 1px solid var(--border-color); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 14px; color: var(--text-primary); }
.sf-video-card { background: #000; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 30px rgba(0,0,0,.4); border: 1px solid rgba(255,255,255,.08); position: relative; height: 460px; width: 260px; transition: transform .3s ease; }
.sf-video-card:hover { transform: translateY(-4px); }
.sf-newsletter input { flex: 1; min-width: 0; padding: 12px 16px; border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.06); color: #fff; outline: none; font-size: 15px; border-radius: 10px; font-family: inherit; }
.sf-newsletter input:focus { border-color: rgba(255,255,255,.5); }
.sf-newsletter button { padding: 12px 24px; background: #fff; color: #111; border: none; font-weight: 600; cursor: pointer; border-radius: 10px; font-family: inherit; font-size: 14px; }
@media (max-width: 768px) {
  .sf-title { font-size: 24px; }
  .sf-section-head { margin-bottom: 24px; }
  .sf-hero-cta { bottom: 48px; }
  .sf-hero-cta a { padding: 13px 28px; font-size: 13px; }
  .sf-hero-arrow { display: none; }
  .sf-marquee-item { font-size: 11px; margin-right: 36px; }
  .sf-review { padding: 18px 20px; }
}
`;

/** Una diapositiva del hero (resuelve URLs dbmedia- de IndexedDB). */
function HeroSlide({ src, active, first, alt }) {
  const url = useResolvedUrl(src);
  return (
    <div className={`sf-hero-slide${active ? ' is-active' : ''}`} aria-hidden={!active}>
      {url && (
        <img
          src={url}
          alt={active ? alt : ''}
          loading={first ? 'eager' : 'lazy'}
          fetchPriority={first ? 'high' : 'low'}
          decoding={first ? 'sync' : 'async'}
        />
      )}
    </div>
  );
}

/**
 * Slider del hero con su propio estado: el intervalo solo re-renderiza este
 * componente (no toda la home) y se pausa si la pestaña no está visible.
 */
function HeroSlider({ images, storeName }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const touchStartX = useRef(null);
  const count = images.length;
  const current = count > 0 ? activeIdx % count : 0;

  useEffect(() => {
    if (count <= 1) return undefined;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setActiveIdx(prev => (prev + 1) % count);
    }, 5000);
    return () => clearInterval(interval);
  }, [count, activeIdx]); // reinicia el temporizador tras navegar manualmente

  const go = (delta) => setActiveIdx(prev => ((prev % count) + delta + count) % count);

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null || count <= 1) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  return (
    <section
      className="hero-section"
      aria-roledescription="carrusel"
      aria-label="Destacados"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ position: 'relative', height: '80vh', overflow: 'hidden', backgroundColor: '#111', color: '#FFF' }}
    >
      {images.map((src, idx) => (
        <HeroSlide key={`${src}-${idx}`} src={src} active={idx === current} first={idx === 0} alt={storeName} />
      ))}
      <div className="sf-hero-shade" />

      <div className="sf-hero-cta">
        <Link to="/catalog">Comprar ahora <ArrowRight size={16} /></Link>
      </div>

      {count > 1 && (
        <>
          <button type="button" className="sf-hero-arrow" style={{ left: '20px' }} onClick={() => go(-1)} aria-label="Imagen anterior">
            <ChevronLeft size={24} />
          </button>
          <button type="button" className="sf-hero-arrow" style={{ right: '20px' }} onClick={() => go(1)} aria-label="Imagen siguiente">
            <ChevronRight size={24} />
          </button>
          <div className="sf-hero-dots">
            {images.map((_, idx) => (
              <button
                type="button"
                key={idx}
                className={`sf-hero-dot${idx === current ? ' is-active' : ''}`}
                onClick={() => setActiveIdx(idx)}
                aria-label={`Ir a la imagen ${idx + 1}`}
                aria-current={idx === current}
              >
                <span />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function StorefrontSkeleton() {
  return (
    <div style={{ width: '100%' }} aria-busy="true" aria-label="Cargando tienda">
      <div className="skeleton hero-section" style={{ height: '80vh', borderRadius: 0 }} />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px 16px' }}>
        <div className="skeleton" style={{ height: 28, width: 220, margin: '0 auto 32px' }} />
        <div className="products-home-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '24px' }}>
          {Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      </div>
    </div>
  );
}

function OfferMarqueeItem({ polo }) {
  const offer = toNumber(polo.offer_price);
  const wholesale = toNumber(polo.wholesale_price);
  const regular = toNumber(polo.price);
  return (
    <span className="sf-marquee-item">
      {offer !== null ? (
        <>
          <span className="sf-marquee-tag">Oferta</span>
          <strong style={{ fontWeight: 600, color: '#FFF' }}>{polo.name}</strong> a solo {formatMoney(offer)}
          {regular !== null && regular > offer && (
            <span style={{ textDecoration: 'line-through', color: 'rgba(255,255,255,0.4)', fontSize: '0.9em' }}>{formatMoney(regular)}</span>
          )}
        </>
      ) : (
        <>
          <span className="sf-marquee-tag">Mayorista</span>
          <strong style={{ fontWeight: 600, color: '#FFF' }}>{polo.name}</strong> a {formatMoney(wholesale)} llevando {polo.wholesale_min_qty || 6}+ uds
        </>
      )}
      <Link to={`/product/${polo.id}`}>Ver detalles</Link>
    </span>
  );
}

export default function Storefront() {
  const [config, setConfig] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedOfferItems, setSelectedOfferItems] = useState([]);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const revealRefs = useRef([]);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      // Carga en paralelo (antes eran 3 peticiones secuenciales)
      const [cfg, prods, cats] = await Promise.all([
        DataService.getConfig(),
        DataService.getProducts(),
        DataService.getCategories()
      ]);
      if (cancelled) return;
      const activeProducts = prods.filter(p => p.active);
      setConfig(cfg);
      setProducts(activeProducts);
      setCategories(cats.filter(c => c.active));

      // Ofertas seleccionadas para el carrusel de texto
      const selectedIds = cfg.selectedOffers || [];
      setSelectedOfferItems(activeProducts.filter(p =>
        selectedIds.includes(p.id) && (toNumber(p.offer_price) !== null || toNumber(p.wholesale_price) !== null)
      ));
    };
    loadData();
    const unsubscribe = subscribeToRealtime(() => loadData());
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  // Scroll reveal (si no hay IntersectionObserver, se muestran directamente)
  useEffect(() => {
    if (!config) return undefined;
    const nodes = revealRefs.current.filter(Boolean);
    if (!('IntersectionObserver' in window)) {
      nodes.forEach(n => n.classList.add('visible'));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    nodes.forEach(n => observer.observe(n));
    return () => observer.disconnect();
  }, [config, products.length, categories.length]);

  // Mensaje de "gracias" temporal, con limpieza del timeout
  useEffect(() => {
    if (!subscribed) return undefined;
    const t = setTimeout(() => setSubscribed(false), 4000);
    return () => clearTimeout(t);
  }, [subscribed]);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
    setEmail('');
  };

  if (!config) return <StorefrontSkeleton />;

  const heroImageList = Array.isArray(config.heroImages) && config.heroImages.filter(Boolean).length > 0
    ? config.heroImages.filter(Boolean)
    : [DEFAULT_HERO];
  const reviewList = Array.isArray(config.testimonials) ? config.testimonials : [];
  const videos = Array.isArray(config.videos) && config.videos.length > 0 ? config.videos : DEFAULT_VIDEOS;
  const featured = products.slice(0, 8);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden', width: '100%' }}>
      <SEO title="Inicio" description={config.heroSubtitle} ogImage={heroImageList[0]?.startsWith('dbmedia-') ? undefined : heroImageList[0]} />
      <style href="storefront-home-styles" precedence="default">{PAGE_CSS}</style>

      {config.bannerText && (
        <div style={{ backgroundColor: '#111', color: '#FFF', fontSize: '11px', fontWeight: 500, letterSpacing: '0.12em', padding: '10px 16px', textAlign: 'center', textTransform: 'uppercase', lineHeight: 1.5 }}>
          {config.bannerText}
        </div>
      )}

      <HeroSlider images={heroImageList} storeName={config.storeName} />

      {/* Carrusel de promociones (CSS puro, sin re-renders) */}
      {selectedOfferItems.length > 0 && (
        <div className="sf-marquee" aria-label="Promociones">
          <div className="sf-marquee-track">
            {/* Se triplica la lista para que el desplazamiento sea continuo */}
            {[0, 1, 2].flatMap(rep => selectedOfferItems.map(polo => (
              <OfferMarqueeItem key={`${polo.id}-${rep}`} polo={polo} />
            )))}
          </div>
        </div>
      )}

      {/* CATEGORÍAS */}
      {categories.length > 0 && (
        <section
          ref={el => { revealRefs.current[0] = el; }}
          className="reveal-on-scroll section-padded"
          style={{ padding: '72px 24px', maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto', width: '100%' }}
        >
          <div className="sf-section-head">
            <span className="sf-eyebrow">Colecciones</span>
            <h2 className="sf-title">Categorías destacadas</h2>
          </div>

          <div className="categories-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
            {categories.map((cat) => (
              <Link to={`/catalog?category=${cat.slug}`} key={cat.id} className="sf-cat-card">
                <div className="sf-cat-img">
                  {cat.image_url && <img src={cat.image_url} alt={cat.name} loading="lazy" decoding="async" />}
                </div>
                <span className="sf-cat-name">{cat.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* PRODUCTOS DESTACADOS */}
      <section
        ref={el => { revealRefs.current[1] = el; }}
        className="reveal-on-scroll section-padded"
        style={{ padding: '72px 24px', backgroundColor: '#FFFFFF', width: '100%', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}
      >
        <div style={{ maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto' }}>
          <div className="sf-section-head">
            <span className="sf-eyebrow">Selección exclusiva</span>
            <h2 className="sf-title">Nuestros polos</h2>
          </div>

          {featured.length === 0 ? (
            <div className="empty-state">
              <h3>Muy pronto nuevas prendas</h3>
              <p style={{ fontSize: '14px' }}>Estamos preparando la colección. Vuelve en unos días.</p>
            </div>
          ) : (
            <>
              <div className="products-home-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '24px' }}>
                {featured.map((prod) => (
                  <ProductCard key={prod.id} product={prod} />
                ))}
              </div>
              {products.length > featured.length && (
                <div style={{ textAlign: 'center', marginTop: '36px' }}>
                  <Link to="/catalog" className="btn-secondary btn-lg" style={{ borderRadius: '10px' }}>
                    Ver todo el catálogo <ArrowRight size={16} />
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* BENEFICIOS */}
      <section
        ref={el => { revealRefs.current[2] = el; }}
        className="reveal-on-scroll section-padded"
        style={{ padding: '64px 24px', backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="benefits-grid" style={{ maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '32px' }}>
          {BENEFITS.map(({ Icon, title, text }) => (
            <div key={title} className="sf-benefit">
              <span className="sf-benefit-icon"><Icon size={22} strokeWidth={1.6} /></span>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>{title}</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIOS (marquee CSS) */}
      {reviewList.length > 0 && (
        <section
          ref={el => { revealRefs.current[3] = el; }}
          className="reveal-on-scroll section-padded-v"
          style={{ padding: '72px 0', backgroundColor: '#FAFAFA', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', overflow: 'hidden' }}
        >
          <div className="sf-section-head" style={{ padding: '0 16px' }}>
            <span className="sf-eyebrow">Opiniones</span>
            <h2 className="sf-title">Lo que opinan nuestros clientes</h2>
          </div>

          <div className="sf-reviews">
            <div className="sf-reviews-track">
              {[0, 1, 2].flatMap(rep => reviewList.map((t, i) => {
                const stars = Math.min(5, Math.max(0, parseInt(t.stars, 10) || 0));
                return (
                  <figure key={`${t.id ?? i}-${rep}`} className="sf-review" aria-hidden={rep > 0}>
                    <div style={{ display: 'flex', gap: '3px', marginBottom: '10px' }} aria-label={`${stars} de 5 estrellas`}>
                      {Array.from({ length: stars }, (_, s) => <Star key={s} size={14} fill="#F5A524" stroke="none" />)}
                    </div>
                    <blockquote style={{ fontSize: '14px', margin: '0 0 12px', color: 'var(--text-primary)', lineHeight: 1.55 }}>
                      “{t.comment}”
                    </blockquote>
                    <figcaption style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                      — {t.name}
                    </figcaption>
                  </figure>
                );
              }))}
            </div>
          </div>
        </section>
      )}

      {/* RUNWAY SHOWCASE - VIDEOS (se montan solo al acercarse al viewport) */}
      <section className="section-padded" style={{ padding: '88px 24px', backgroundColor: '#0A0A0C', color: '#FFFFFF', textAlign: 'center' }}>
        <div style={{ maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto' }}>
          <span className="sf-eyebrow" style={{ color: '#8E8E93' }}>Cortes en movimiento</span>
          <h2 className="sf-title" style={{ color: '#FFF', marginBottom: '12px' }}>Runway Showcase</h2>
          <p style={{ fontSize: '15px', color: '#AEAEB2', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto', marginBottom: '48px', lineHeight: 1.6 }}>
            Aprecia la caída perfecta y la fluidez de nuestros materiales premium en modelos reales bajo luz natural y de estudio.
          </p>

          <div className="runway-videos-wrapper" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}>
            {videos.map((video, idx) => (
              <div key={`${video.url}-${idx}`} className="runway-video-card sf-video-card">
                <VideoPlayer url={video.url} title={video.title} lazy />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)', pointerEvents: 'none', zIndex: 1 }} />
                <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px', textAlign: 'left', color: '#FFF', zIndex: 2 }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px', color: '#FFF' }}>{video.title}</h3>
                  {video.desc && <p style={{ fontSize: '12px', color: '#E5E5EA', lineHeight: 1.4 }}>{video.desc}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="section-padded" style={{ padding: '72px 24px', backgroundColor: '#111', color: '#FFF', textAlign: 'center' }}>
        <div style={{ maxWidth: '560px', marginLeft: 'auto', marginRight: 'auto' }}>
          <Mail size={30} strokeWidth={1.5} style={{ marginBottom: '14px', opacity: 0.85 }} />
          <h2 className="sf-title" style={{ color: '#FFF', marginBottom: '10px' }}>Únete a la lista privada</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '15px', marginBottom: '28px', lineHeight: 1.6 }}>
            Regístrate para recibir acceso exclusivo a nuevos lanzamientos, eventos especiales y descuentos de temporada.
          </p>

          {subscribed ? (
            <p role="status" style={{ color: '#86EFAC', fontWeight: 500 }}>¡Gracias por suscribirte! Te enviaremos noticias pronto.</p>
          ) : (
            <form onSubmit={handleSubscribe} className="newsletter-form sf-newsletter" style={{ display: 'flex', gap: '8px', maxWidth: '460px', marginLeft: 'auto', marginRight: 'auto' }}>
              <input type="email" required placeholder="Tu correo electrónico" aria-label="Correo electrónico" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
              <button type="submit">Suscribirme</button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
