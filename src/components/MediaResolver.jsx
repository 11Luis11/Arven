import { useState, useEffect, useRef } from 'react';
import { useResolvedUrl } from '../utils/media';

// Nota: los helpers no-componentes (storeMedia, getMedia, useResolvedUrl) viven
// en src/utils/media.js para que este archivo solo exporte componentes
// (requisito de react-refresh / Fast Refresh).

export function SafeImage({ src, ...props }) {
  const resolved = useResolvedUrl(src);
  return <img src={resolved || undefined} {...props} />;
}

export function SafeVideo({ src, ...props }) {
  const resolved = useResolvedUrl(src);
  return <video src={resolved || undefined} {...props} />;
}

function getYouTubeId(url) {
  try {
    if (url.includes('youtube.com/embed/')) return url.split('youtube.com/embed/')[1]?.split(/[?&]/)[0];
    if (url.includes('youtube.com/shorts/')) return url.split('youtube.com/shorts/')[1]?.split(/[?&]/)[0];
    if (url.includes('youtube.com/watch')) return new URL(url).searchParams.get('v');
    if (url.includes('youtu.be/')) return url.split('youtu.be/')[1]?.split(/[?&]/)[0];
  } catch (e) {
    console.error('Error parsing YouTube URL:', e);
  }
  return '';
}

/**
 * Hook: true cuando el elemento entra (o está cerca) del viewport.
 * Si `enabled` es false devuelve true inmediatamente.
 */
function useInView(enabled) {
  const ref = useRef(null);
  const [inView, setInView] = useState(() => !enabled || typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (inView) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        setInView(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);

  return [ref, inView];
}

/**
 * Reproductor de video en bucle y silenciado (YouTube, Vimeo, archivo directo o dbmedia).
 * `lazy`: no monta el video/iframe hasta que está cerca del viewport (ahorra datos y CPU).
 */
export function VideoPlayer({ url, title, style, speed = 1.0, lazy = false, ...props }) {
  const resolvedUrl = useResolvedUrl(url);
  const [wrapperRef, inView] = useInView(lazy);

  if (!inView) {
    return <div ref={wrapperRef} style={{ width: '100%', height: '100%', background: '#111', ...style }} aria-hidden="true" />;
  }

  if (!resolvedUrl) return null;

  const frameStyle = { width: '100%', height: '100%', border: 'none', objectFit: 'cover', ...style };

  // YouTube
  if (resolvedUrl.includes('youtube.com') || resolvedUrl.includes('youtu.be')) {
    const embedId = getYouTubeId(resolvedUrl);
    if (embedId) {
      return (
        <iframe
          src={`https://www.youtube.com/embed/${embedId}?autoplay=1&mute=1&loop=1&playlist=${embedId}&controls=0&showinfo=0&rel=0&playsinline=1`}
          title={title || 'YouTube video player'}
          style={frameStyle}
          allow="autoplay; encrypted-media"
          loading="lazy"
          allowFullScreen
        />
      );
    }
  }

  // Vimeo
  if (resolvedUrl.includes('vimeo.com') && !resolvedUrl.includes('player.vimeo.com/external')) {
    const embedId = resolvedUrl.split('vimeo.com/')[1]?.split('?')[0];
    if (embedId) {
      return (
        <iframe
          src={`https://player.vimeo.com/video/${embedId}?autoplay=1&muted=1&loop=1&controls=0&background=1`}
          title={title || 'Vimeo video player'}
          style={frameStyle}
          allow="autoplay; fullscreen"
          loading="lazy"
          allowFullScreen
        />
      );
    }
  }

  // Archivo directo de video o base64
  const applySpeed = (e) => { e.currentTarget.playbackRate = speed; };
  return (
    <video
      ref={(el) => { if (el) el.playbackRate = speed; }}
      onPlay={applySpeed}
      onLoadedMetadata={applySpeed}
      src={resolvedUrl}
      loop
      muted
      autoPlay
      playsInline
      preload="metadata"
      style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }}
      {...props}
    />
  );
}
