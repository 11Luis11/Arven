// src/utils/imageAutofit.js
//
// Recorta automáticamente los márgenes vacíos (transparentes o de color sólido
// uniforme) de una imagen subida por el usuario, de modo que el contenido
// visible (logo, ícono, favicon) quede ajustado al máximo dentro del lienzo.
//
// Esto soluciona el problema de "subo un logo y se ve chiquito": si el archivo
// original tiene mucho espacio en blanco/transparente alrededor del dibujo,
// ese espacio se recorta antes de guardar la imagen, así cuando se muestra en
// el navbar, el panel admin o la pestaña del navegador (favicon), el diseño
// real ocupa el máximo posible del contenedor.

function colorDistance(a, b) {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 +
    (a[1] - b[1]) ** 2 +
    (a[2] - b[2]) ** 2
  );
}

/**
 * @param {File} file - Imagen original seleccionada por el usuario.
 * @param {Object} [options]
 * @param {number} [options.paddingRatio=0.08] - Margen relativo a conservar alrededor del contenido detectado.
 * @param {number} [options.minPaddingPx=2] - Margen mínimo en píxeles.
 * @param {number} [options.alphaThreshold=16] - Por debajo de este alfa, el píxel se considera transparente/fondo.
 * @param {number} [options.colorThreshold=28] - Distancia de color para considerar un píxel como "fondo sólido".
 * @param {number} [options.sampleStep=2] - Paso de muestreo de píxeles (rendimiento en imágenes grandes).
 * @param {number} [options.skipIfMarginBelow=0.02] - Si el margen detectado ya es mínimo, no se recorta (se evita procesamiento innecesario).
 * @returns {Promise<File>} Imagen recortada (PNG, con transparencia preservada) o el archivo original si no se pudo procesar.
 */
export async function autoCropToContent(file, options = {}) {
  const {
    paddingRatio = 0.08,
    minPaddingPx = 2,
    alphaThreshold = 16,
    colorThreshold = 28,
    sampleStep = 2,
    skipIfMarginBelow = 0.02,
  } = options;

  if (!file || !(file instanceof File)) return file;
  if (!file.type || !file.type.startsWith('image/')) return file;
  if (file.type === 'image/svg+xml') return file; // los SVG son vectoriales: ya escalan sin perder definición

  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return file;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    const pixelAt = (x, y) => {
      const i = (y * w + x) * 4;
      return [data[i], data[i + 1], data[i + 2], data[i + 3]];
    };

    // Detectar un posible color de fondo sólido a partir de las 4 esquinas.
    const corners = [pixelAt(0, 0), pixelAt(w - 1, 0), pixelAt(0, h - 1), pixelAt(w - 1, h - 1)];
    const opaqueCorners = corners.filter((c) => c[3] > 200);
    let bgColor = null;
    if (opaqueCorners.length >= 3) {
      const avg = [0, 0, 0];
      opaqueCorners.forEach((c) => { avg[0] += c[0]; avg[1] += c[1]; avg[2] += c[2]; });
      avg[0] /= opaqueCorners.length;
      avg[1] /= opaqueCorners.length;
      avg[2] /= opaqueCorners.length;
      const consistent = opaqueCorners.every((c) => colorDistance(c, avg) < colorThreshold);
      if (consistent) bgColor = avg;
    }

    let minX = w, minY = h, maxX = -1, maxY = -1;

    for (let y = 0; y < h; y += sampleStep) {
      for (let x = 0; x < w; x += sampleStep) {
        const [r, g, b, a] = pixelAt(x, y);
        if (a < alphaThreshold) continue; // transparente -> fondo
        if (bgColor && a > 200 && colorDistance([r, g, b], bgColor) < colorThreshold) continue; // fondo sólido uniforme
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    if (maxX < minX || maxY < minY) return file; // no se detectó contenido distinguible: no tocar la imagen

    const contentW = maxX - minX + 1;
    const contentH = maxY - minY + 1;

    const marginLeft = minX / w;
    const marginRight = (w - 1 - maxX) / w;
    const marginTop = minY / h;
    const marginBottom = (h - 1 - maxY) / h;
    const maxMargin = Math.max(marginLeft, marginRight, marginTop, marginBottom);
    if (maxMargin < skipIfMarginBelow) return file; // ya está bien ajustada, no merece la pena recortar

    const pad = Math.max(minPaddingPx, Math.round(Math.max(contentW, contentH) * paddingRatio));

    const cropX = Math.max(0, minX - pad);
    const cropY = Math.max(0, minY - pad);
    const cropW = Math.min(w, maxX + pad + 1) - cropX;
    const cropH = Math.min(h, maxY + pad + 1) - cropY;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = cropW;
    outCanvas.height = cropH;
    const outCtx = outCanvas.getContext('2d');
    outCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const blob = await new Promise((resolve) => outCanvas.toBlob(resolve, 'image/png'));
    if (!blob) return file;

    const newName = file.name.replace(/\.[^./\\]+$/, '') + '.png';
    return new File([blob], newName, { type: 'image/png' });
  } catch (err) {
    console.warn('No se pudo optimizar automáticamente la imagen, se usará el archivo original:', err);
    return file;
  }
}
