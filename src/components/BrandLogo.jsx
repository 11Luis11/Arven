// Logo de la tienda que se adapta al fondo donde se muestra.
//   config.storeLogoUrl      -> logo para fondos CLAROS (versión oscura del logo)
//   config.storeLogoDarkUrl  -> logo para fondos OSCUROS (versión blanca del logo)
// Si falta la versión adecuada, usa la otra sobre una placa de contraste para
// que nunca quede un logo negro sobre fondo negro (o blanco sobre blanco).
export default function BrandLogo({ config, bg = 'light', maxHeight = 44, maxWidth = 180, textStyle, crossOrigin }) {
  const forLight = config?.storeLogoUrl || '';
  const forDark = config?.storeLogoDarkUrl || '';
  const name = config?.businessName || config?.storeName || '';

  let url = '';
  let plate = null; // color de la placa de contraste, si hace falta
  if (bg === 'dark') {
    if (forDark) url = forDark;
    else if (forLight) { url = forLight; plate = '#FFFFFF'; }
  } else if (forLight) {
    url = forLight;
  } else if (forDark) {
    url = forDark; plate = '#0F172A';
  }

  if (!url) {
    return (
      <span style={{ fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: bg === 'dark' ? '#FFFFFF' : '#0F172A', ...textStyle }}>
        {name}
      </span>
    );
  }

  const img = (
    <img
      src={url}
      alt={name}
      crossOrigin={crossOrigin}
      style={{ maxHeight, maxWidth, objectFit: 'contain', display: 'block' }}
    />
  );

  return plate
    ? <span style={{ background: plate, borderRadius: 10, padding: '6px 10px', display: 'inline-flex' }}>{img}</span>
    : img;
}
