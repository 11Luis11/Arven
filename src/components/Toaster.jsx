import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { subscribeToasts } from '../utils/toast';

const ICONS = { success: CheckCircle2, error: AlertCircle, warning: AlertTriangle, info: Info };
const COLORS = {
  success: 'var(--color-success)',
  error: 'var(--color-danger)',
  warning: 'var(--color-warning)',
  info: 'var(--color-primary)',
};

export default function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(() => subscribeToasts(item => {
    setItems(prev => [...prev.slice(-3), item]);
    setTimeout(() => setItems(prev => prev.filter(i => i.id !== item.id)), item.duration);
  }), []);

  const dismiss = id => setItems(prev => prev.filter(i => i.id !== id));

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed', bottom: 20, right: 20, left: 20, zIndex: 5000,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, pointerEvents: 'none',
      }}
    >
      {items.map(item => {
        const Icon = ICONS[item.type] || Info;
        return (
          <div
            key={item.id}
            role="status"
            style={{
              pointerEvents: 'auto', display: 'flex', alignItems: 'flex-start', gap: 10,
              maxWidth: 380, width: '100%', padding: '12px 14px',
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderLeft: `4px solid ${COLORS[item.type]}`, borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow-lg)', fontFamily: 'var(--font-sans)', fontSize: 14,
              color: 'var(--text-primary)', animation: 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1) both',
            }}
          >
            <Icon size={18} style={{ color: COLORS[item.type], flexShrink: 0, marginTop: 1 }} />
            <span style={{ flex: 1, lineHeight: 1.45, whiteSpace: 'pre-line' }}>{item.message}</span>
            <button
              onClick={() => dismiss(item.id)}
              aria-label="Cerrar notificación"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
