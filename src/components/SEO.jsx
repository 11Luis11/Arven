import { useEffect } from 'react';

/**
 * Componente SEO reutilizable
 * @param {Object} props
 * @param {string} props.title - Título específico de la página
 * @param {string} props.description - Descripción SEO de la página
 * @param {string} [props.canonical] - URL canónica
 * @param {string} [props.ogImage] - Imagen para redes sociales
 * @param {string} [props.ogType] - Tipo de contenido (default: 'website')
 */
export default function SEO({ title, description, canonical, ogImage, ogType = 'website' }) {
  useEffect(() => {
    // Actualizar título
    const baseTitle = 'Carrillo Store';
    document.title = title ? `${title} | ${baseTitle}` : `${baseTitle} | Polos Premium & Estilo Minimalista`;

    // Actualizar meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.name = 'description';
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', description || 'Colección exclusiva de polos de algodón premium, oversize, básicos y estampados. Calidad superior y diseño sofisticado.');

    // Actualizar canonical link
    let linkCanonical = document.querySelector('link[rel="canonical"]');
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.rel = 'canonical';
      document.head.appendChild(linkCanonical);
    }
    const currentUrl = canonical || window.location.href;
    linkCanonical.setAttribute('href', currentUrl);

    // OpenGraph Title
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute('content', title ? `${title} | ${baseTitle}` : baseTitle);

    // OpenGraph Description
    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (!ogDesc) {
      ogDesc = document.createElement('meta');
      ogDesc.setAttribute('property', 'og:description');
      document.head.appendChild(ogDesc);
    }
    ogDesc.setAttribute('content', description || 'Colección exclusiva de polos de algodón premium.');

    // OpenGraph Image
    let ogImg = document.querySelector('meta[property="og:image"]');
    if (!ogImg) {
      ogImg = document.createElement('meta');
      ogImg.setAttribute('property', 'og:image');
      document.head.appendChild(ogImg);
    }
    ogImg.setAttribute('content', ogImage || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80');

    // OpenGraph Type
    let ogTypeMeta = document.querySelector('meta[property="og:type"]');
    if (!ogTypeMeta) {
      ogTypeMeta = document.createElement('meta');
      ogTypeMeta.setAttribute('property', 'og:type');
      document.head.appendChild(ogTypeMeta);
    }
    ogTypeMeta.setAttribute('content', ogType);

  }, [title, description, canonical, ogImage, ogType]);

  return null;
}
