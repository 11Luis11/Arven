import { useState, useEffect } from 'react';

const DB_NAME = 'CarrilloStoreMediaDB';
const STORE_NAME = 'media';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function storeMedia(key, blobOrDataUrl) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(blobOrDataUrl, key);
      req.onsuccess = () => resolve(key);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('Error storing media in IndexedDB:', e);
    return null;
  }
}

export async function getMedia(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('Error getting media from IndexedDB:', e);
    return null;
  }
}

export function useResolvedUrl(url) {
  const [resolvedUrl, setResolvedUrl] = useState(url);

  useEffect(() => {
    if (url && url.startsWith('dbmedia-')) {
      getMedia(url).then(data => {
        if (data) {
          setResolvedUrl(data);
        }
      });
    } else {
      setResolvedUrl(url);
    }
  }, [url]);

  return resolvedUrl;
}

export function SafeImage({ src, ...props }) {
  const resolved = useResolvedUrl(src);
  return <img src={resolved || ''} {...props} />;
}

export function SafeVideo({ src, ...props }) {
  const resolved = useResolvedUrl(src);
  return <video src={resolved || ''} {...props} />;
}

export function VideoPlayer({ url, title, style, speed = 1.0, ...props }) {
  const resolvedUrl = useResolvedUrl(url);

  if (!resolvedUrl) return null;

  // Detectar YouTube
  if (resolvedUrl.includes('youtube.com') || resolvedUrl.includes('youtu.be')) {
    let embedId = '';
    try {
      if (resolvedUrl.includes('youtube.com/embed/')) {
        embedId = resolvedUrl.split('youtube.com/embed/')[1]?.split('?')[0];
      } else if (resolvedUrl.includes('youtube.com/watch')) {
        embedId = new URL(resolvedUrl).searchParams.get('v');
      } else if (resolvedUrl.includes('youtu.be/')) {
        embedId = resolvedUrl.split('youtu.be/')[1]?.split('?')[0];
      }
    } catch (e) {
      console.error('Error parsing YouTube URL:', e);
    }

    if (embedId) {
      return (
        <iframe
          src={`https://www.youtube.com/embed/${embedId}?autoplay=1&mute=1&loop=1&playlist=${embedId}&controls=0&showinfo=0&rel=0`}
          title={title || "YouTube video player"}
          style={{ width: '100%', height: '100%', border: 'none', objectFit: 'cover', ...style }}
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      );
    }
  }

  // Detectar Vimeo
  if (resolvedUrl.includes('vimeo.com') && !resolvedUrl.includes('player.vimeo.com/external')) {
    const embedId = resolvedUrl.split('vimeo.com/')[1]?.split('?')[0];
    if (embedId) {
      return (
        <iframe
          src={`https://player.vimeo.com/video/${embedId}?autoplay=1&muted=1&loop=1&controls=0&background=1`}
          title={title || "Vimeo video player"}
          style={{ width: '100%', height: '100%', border: 'none', objectFit: 'cover', ...style }}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      );
    }
  }

  // Archivo directo de video o base64
  return (
    <video
      ref={(el) => {
        if (el) {
          el.playbackRate = speed;
        }
      }}
      onPlay={(e) => {
        e.target.playbackRate = speed;
      }}
      onLoadedMetadata={(e) => {
        e.target.playbackRate = speed;
      }}
      src={resolvedUrl}
      loop
      muted
      autoPlay
      playsInline
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        ...style
      }}
      {...props}
    />
  );
}
