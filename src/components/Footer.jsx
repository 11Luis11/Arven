import { Link } from 'react-router-dom';

export default function Footer({ config }) {
  if (!config) return null;

  return (
    <footer style={{ backgroundColor: '#0A0A0A', color: 'rgba(255,255,255,0.5)', padding: '60px 24px 30px 24px', borderTop: '1px solid #222', fontSize: '13px' }}>
      <div className="footer-grid" style={{ maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '40px', marginBottom: '60px' }}>
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
  );
}
