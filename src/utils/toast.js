// Notificaciones no bloqueantes. Reemplaza a window.alert():
//   toast.success('Guardado'); toast.error('No se pudo guardar'); toast('Mensaje neutro');
const listeners = new Set();

function emit(message, type = 'info', duration = 3500) {
  const item = { id: `${Date.now()}-${Math.random()}`, message: String(message), type, duration };
  listeners.forEach(fn => fn(item));
}

export function toast(message, type, duration) { emit(message, type, duration); }
toast.success = (m, d) => emit(m, 'success', d);
toast.error = (m, d) => emit(m, 'error', d ?? 5000);
toast.warning = (m, d) => emit(m, 'warning', d);
toast.info = (m, d) => emit(m, 'info', d);

export function subscribeToasts(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
