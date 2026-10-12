// src/utils/media.js
//
// Utilidades (no-componentes) para medios guardados localmente en IndexedDB.
// Las URLs con prefijo `dbmedia-` son claves locales que se resuelven a un
// data URL / Blob URL almacenado en el navegador.

import { useState, useEffect } from 'react';

const DB_NAME = 'CarrilloStoreMediaDB';
const STORE_NAME = 'media';
const DB_MEDIA_PREFIX = 'dbmedia-';

let dbPromise = null;

function openDB() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB no disponible'));
  }
  // Reutiliza una única conexión en vez de abrir una por cada lectura.
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => {
        dbPromise = null;
        reject(e.target.error);
      };
    });
  }
  return dbPromise;
}

export function isDbMediaKey(url) {
  return typeof url === 'string' && url.startsWith(DB_MEDIA_PREFIX);
}

export async function storeMedia(key, blobOrDataUrl) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(blobOrDataUrl, key);
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
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('Error getting media from IndexedDB:', e);
    return null;
  }
}

/**
 * Devuelve la URL utilizable para `url`. Si es una clave `dbmedia-*`, la resuelve
 * de IndexedDB (devuelve null mientras carga o si no existe).
 */
export function useResolvedUrl(url) {
  const [resolved, setResolved] = useState({ key: null, value: null });
  const needsLookup = isDbMediaKey(url);

  useEffect(() => {
    if (!needsLookup) return undefined;
    let cancelled = false;
    getMedia(url).then((data) => {
      if (!cancelled) setResolved({ key: url, value: data || null });
    });
    return () => { cancelled = true; };
  }, [url, needsLookup]);

  if (!needsLookup) return url || null;
  return resolved.key === url ? resolved.value : null;
}
