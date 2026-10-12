import { useEffect } from 'react';

const BASE_TITLE = 'Carrillo Store';
const DEFAULT_DESCRIPTION = 'Colección exclusiva de polos de algodón premium, oversize, básicos y estampados. Calidad superior y diseño sofisticado.';
const DEFAULT_OG_IMAGE = 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80';

/** Crea o actualiza un <meta> identificado por name/property. */
function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Componente SEO reutilizable
 * @param {Object} props
 * @param {string} props.title - Título específico de la página
 * @param {string} props.description - Descripción SEO de la página
 * @param {string} [props.canonical] - URL canónica
 * @param {string} [props.ogImage] - Imagen para redes sociales (solo URLs http/https)
 * @param {string} [props.ogType] - Tipo de contenido (default: 'website')
 */
export default function SEO({ title, description, canonical, ogImage, ogType = 'website' }) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${BASE_TITLE}` : `${BASE_TITLE} | Polos Premium & Estilo Minimalista`;
    const desc = description || DEFAULT_DESCRIPTION;
    // Las claves locales (dbmedia-*) o data URLs no sirven para redes sociales.
    const image = ogImage && /^https?:\/\//i.test(ogImage) ? ogImage : DEFAULT_OG_IMAGE;
    const url = canonical || window.location.href;

    document.title = fullTitle;
    upsertMeta('name', 'description', desc);

    let linkCanonical = document.head.querySelector('link[rel="canonical"]');
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.rel = 'canonical';
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute('href', url);

    upsertMeta('property', 'og:title', title ? fullTitle : BASE_TITLE);
    upsertMeta('property', 'og:description', desc);
    upsertMeta('property', 'og:image', image);
    upsertMeta('property', 'og:type', ogType);
    upsertMeta('property', 'og:url', url);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
  }, [title, description, canonical, ogImage, ogType]);

  return null;
}
