import { useState, useEffect, useMemo, useCallback } from 'react';
import { ClipboardList, Search, RefreshCw, X } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../services/dataService';

const PAGE_SIZE = 100;

// Fecha local YYYY-MM-DD (los timestamps se guardan en UTC/ISO)
const toLocalDateKey = (value) => {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('sv-SE');
};

// Categoría visual de la acción según palabras clave del texto
const CATEGORIES = [
  { test: /anul/i, label: 'Anulación', cls: 'badge-danger' },
  { test: /cambio de producto|cambi[oó] /i, label: 'Cambio', cls: 'badge-primary' },
  { test: /caja|arqueo|apertura|cierre/i, label: 'Caja', cls: 'badge-warning' },
  { test: /venta|boleta|factura|ticket/i, label: 'Venta', cls: 'badge-success' },
  { test: /producto|stock|inventario|categor/i, label: 'Inventario', cls: 'badge-info' },
  { test: /usuario|sesi[oó]n|login|config/i, label: 'Sistema', cls: '' },
];
const categorize = (action = '') => CATEGORIES.find(c => c.test.test(action)) || { label: 'General', cls: '' };

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterUser, setFilterUser] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const loadData = useCallback(async () => {
    try {
      const actionLogs = await DataService.getActionLogs();
      setLogs(Array.isArray(actionLogs) ? actionLogs : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsub = subscribeToRealtime(() => loadData());
    return () => unsub();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Filtrado derivado (sin estado duplicado ni efecto extra)
  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const u = filterUser.toLowerCase();
    return logs.filter(l => {
      const user = String(l.user || '');
      const action = String(l.action || '');
      if (u && user.toLowerCase() !== u) return false;
      if (filterDate && toLocalDateKey(l.timestamp) !== filterDate) return false;
      if (q && !action.toLowerCase().includes(q) && !user.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, filterUser, filterDate, searchQuery]);

  const uniqueUsers = useMemo(
    () => Array.from(new Set(logs.map(l => l.user).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [logs]
  );

  const hasFilters = Boolean(filterUser || filterDate || searchQuery);

  const handleClearFilters = () => {
    setFilterUser('');
    setFilterDate('');
    setSearchQuery('');
    setVisible(PAGE_SIZE);
  };

  const setFilter = (setter) => (e) => {
    setter(e.target.value);
    setVisible(PAGE_SIZE);
  };

  const shown = filteredLogs.slice(0, visible);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1>Registro de actividad</h1>
          <p>Historial de operaciones realizadas por todos los usuarios del sistema.</p>
        </div>
        <button onClick={handleRefresh} className="btn-secondary" disabled={refreshing}>
          <RefreshCw size={16} style={refreshing ? { animation: 'spin 0.8s linear infinite' } : undefined} />
          {refreshing ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '12px', alignItems: 'end' }}>
        <div style={{ minWidth: 0 }}>
          <label className="field-label" htmlFor="logs-search">Buscar</label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              id="logs-search"
              type="search"
              className="input-field"
              placeholder="Buscar por acción u operador…"
              value={searchQuery}
              onChange={setFilter(setSearchQuery)}
              style={{ paddingLeft: '36px' }}
            />
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="logs-user">Operador</label>
          <select id="logs-user" className="input-field" value={filterUser} onChange={setFilter(setFilterUser)}>
            <option value="">Todos</option>
            {uniqueUsers.map(user => (
              <option key={user} value={user}>{user}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="logs-date">Fecha</label>
          <input id="logs-date" type="date" className="input-field" value={filterDate} onChange={setFilter(setFilterDate)} />
        </div>

        <button onClick={handleClearFilters} className="btn-ghost" disabled={!hasFilters} style={{ minHeight: '40px' }}>
          <X size={16} /> Limpiar
        </button>
      </div>

      {!loading && (
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '-4px 0 0' }}>
          {filteredLogs.length === logs.length
            ? `${logs.length} registro${logs.length === 1 ? '' : 's'}`
            : `${filteredLogs.length} de ${logs.length} registros`}
        </p>
      )}

      {/* Resultados */}
      {loading ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: '20px' }} />
          ))}
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <ClipboardList size={36} strokeWidth={1.5} />
            <h3>{hasFilters ? 'Sin resultados' : 'Aún no hay actividad registrada'}</h3>
            <p style={{ fontSize: '14px' }}>
              {hasFilters ? 'Ningún registro coincide con los filtros aplicados.' : 'Las operaciones del sistema aparecerán aquí.'}
            </p>
            {hasFilters && (
              <button className="btn-secondary btn-sm" onClick={handleClearFilters} style={{ marginTop: '8px' }}>
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '170px' }}>Fecha y hora</th>
                  <th style={{ width: '170px' }}>Operador</th>
                  <th style={{ width: '120px' }}>Tipo</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((log, idx) => {
                  const d = new Date(log.timestamp);
                  const valid = !isNaN(d.getTime());
                  const cat = categorize(log.action);
                  return (
                    <tr key={log.id || `${log.timestamp}-${idx}`}>
                      <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        <div style={{ fontWeight: 500 }}>
                          {valid ? d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {valid ? d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : ''}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{log.user || '—'}</td>
                      <td><span className={`badge ${cat.cls}`}>{cat.label}</span></td>
                      <td style={{ color: 'var(--text-primary)', lineHeight: 1.5, minWidth: '260px' }}>{log.action}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredLogs.length > visible && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setVisible(v => v + PAGE_SIZE)}>
                Mostrar más ({filteredLogs.length - visible} restantes)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
