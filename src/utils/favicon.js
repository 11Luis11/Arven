// src/utils/favicon.js
//
// Aplica un favicon personalizado de forma confiable en cualquier página de
// la app. Simplemente cambiar el `href` de un <link rel="icon"> existente no
// siempre funciona: varios navegadores (sobre todo Chrome) mantienen en caché
// el ícono anterior y no repintan la pestaña. La forma robusta es ELIMINAR el
///los <link> de ícono existentes y crear uno nuevo desde cero, además de
// añadir un parámetro anti-caché a la URL.

function guessMimeType(url) {
  const clean = (url || '').split('?')[0].toLowerCase();
  if (clean.startsWith('data:')) {
    const match = clean.match(/^data:([^;]+);/);
    if (match) return match[1];
  }
  if (clean.endsWith('.svg')) return 'image/svg+xml';
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.ico')) return 'image/x-icon';
  return 'image/png';
}

function withCacheBust(url) {
  if (!url || url.startsWith('data:')) return url; // las URLs base64 no necesitan (ni admiten) query params
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${Date.now()}`;
}

/**
 * Reemplaza el favicon del documento actual por la URL indicada.
 * Seguro de llamar varias veces (en cada carga de página/config).
 * @param {string} url - URL pública o data-URL de la imagen del favicon.
 */
export function applyFavicon(url) {
  if (!url || typeof document === 'undefined') return;
  try {
    document.head
      .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]')
      .forEach((el) => el.remove());

    const link = document.createElement('link');
    link.id = 'app-favicon';
    link.rel = 'icon';
    link.type = guessMimeType(url);
    link.href = withCacheBust(url);
    document.head.appendChild(link);
  } catch (e) {
    console.warn('No se pudo aplicar el favicon:', e);
  }
}
