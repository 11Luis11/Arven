import BrandLogo from './BrandLogo';
import { Link } from 'react-router-dom';
import { Mail, MessageCircle, MapPin } from 'lucide-react';
import { toWhatsAppPhone } from '../utils/pricing';

const FOOTER_CSS = `
.ft-root { background: #0A0A0A; color: rgba(255,255,255,.62); padding: 56px 24px 28px; font-size: 14px; }
.ft-root a { color: inherit; transition: color .15s ease; }
.ft-root a:hover { color: #fff; }
.ft-h { color: #fff; font-size: 14px; font-weight: 600; margin-bottom: 16px; letter-spacing: .02em; }
.ft-list { list-style: none; display: flex; flex-direction: column; gap: 10px; padding: 0; margin: 0; }
.ft-contact { display: flex; align-items: flex-start; gap: 8px; line-height: 1.5; overflow-wrap: anywhere; }
.ft-social { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.ft-social a { border: 1px solid rgba(255,255,255,.18); border-radius: 999px; padding: 6px 12px; font-size: 12px; }
.ft-social a:hover { border-color: rgba(255,255,255,.5); }
@media (max-width: 768px) { .ft-root { padding: 44px 16px 24px; } }
`;

const isRealUrl = (u) => typeof u === 'string' && u.trim() !== '' && u.trim() !== '#';

export default function Footer({ config }) {
  if (!config) return null;

  const footer = config.footer || {};
  const email = footer.email || 'soporte@carrillostore.com';
  const whatsapp = footer.whatsapp || '+51 987 654 321';
  const socials = [
    { label: 'Instagram', url: footer.instagramUrl },
    { label: 'Facebook', url: footer.facebookUrl },
    { label: 'TikTok', url: footer.tiktokUrl },
  ].filter(s => isRealUrl(s.url));

  return (
    <footer className="ft-root">
      <style href="footer-styles" precedence="default">{FOOTER_CSS}</style>
      <div className="footer-grid" style={{ maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '36px', marginBottom: '44px' }}>
        <div>
          {config.storeLogoDarkUrl
            ? <div style={{ marginBottom: '14px' }}><BrandLogo config={config} bg="dark" maxHeight={46} maxWidth={180} /></div>
            : <h3 style={{ color: '#FFF', fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>{config.storeName}</h3>}
          <p style={{ lineHeight: 1.6 }}>
            Tienda de ropa premium enfocada en el diseño minimalista, la caída perfecta y la máxima calidad.
          </p>
          {socials.length > 0 && (
            <div className="ft-social">
              {socials.map(s => (
                <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>
              ))}
            </div>
          )}
        </div>
        <div>
          <h4 className="ft-h">Enlaces</h4>
          <ul className="ft-list">
            <li><Link to="/catalog">Catálogo completo</Link></li>
            <li><Link to="/catalog?category=polos-oversize">Polos Oversize</Link></li>
            <li><Link to="/catalog?category=polos-basicos">Polos Básicos</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="ft-h">Políticas</h4>
          <ul className="ft-list">
            <li><a href="#">Términos de servicio</a></li>
            <li><a href="#">Políticas de privacidad</a></li>
            <li><a href="#">Sitemap</a></li>
          </ul>
        </div>
        <div>
          <h4 className="ft-h">Contacto</h4>
          <ul className="ft-list">
            <li className="ft-contact">
              <Mail size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <a href={`mailto:${email}`}>{email}</a>
            </li>
            <li className="ft-contact">
              <MessageCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <a href={`https://wa.me/${toWhatsAppPhone(whatsapp)}`} target="_blank" rel="noopener noreferrer">WhatsApp: {whatsapp}</a>
            </li>
            {footer.address && (
              <li className="ft-contact">
                <MapPin size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{footer.address}</span>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,.08)', textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,.45)' }}>
        © {new Date().getFullYear()} {config.storeName}. Todos los derechos reservados.
      </div>
    </footer>
  );
}
