// Genera el PDF a partir del MISMO elemento HTML del comprobante, para que el
// archivo descargado conserve exactamente el diseño que se ve en pantalla.

async function waitForImages(element) {
  const imgs = Array.from(element.querySelectorAll('img'));
  await Promise.all(imgs.map(img => (img.complete ? Promise.resolve() : new Promise(res => {
    img.addEventListener('load', res, { once: true });
    img.addEventListener('error', res, { once: true });
  }))));
  if (document.fonts?.ready) await document.fonts.ready;
}

export async function receiptToPdfBlob(element, variant) {
  const [{ default: html2canvas }, jspdfMod] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const JsPDF = jspdfMod.jsPDF || jspdfMod.default;
  await waitForImages(element);

  const canvas = await html2canvas(element, {
    scale: 2.5,
    useCORS: true,
    backgroundColor: '#FFFFFF',
    logging: false,
    windowWidth: element.scrollWidth,
  });

  if (variant === 'ticket') {
    const widthMm = 80;
    const heightMm = (canvas.height * widthMm) / canvas.width;
    const doc = new JsPDF({ unit: 'mm', format: [widthMm, Math.max(heightMm, 60)] });
    doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, widthMm, heightMm);
    return doc.output('blob');
  }

  // A4: si el comprobante es largo, se divide en varias páginas
  const pageW = 210;
  const pageH = 297;
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const pxPerMm = canvas.width / pageW;
  const pagePx = Math.floor(pageH * pxPerMm);
  let offset = 0;
  let first = true;
  while (offset < canvas.height) {
    const sliceH = Math.min(pagePx, canvas.height - offset);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceH;
    const ctx = slice.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, offset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    if (!first) doc.addPage();
    doc.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageW, sliceH / pxPerMm);
    offset += sliceH;
    first = false;
  }
  return doc.output('blob');
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
