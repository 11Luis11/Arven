import { useState, useEffect } from 'react';
import { ClipboardList, Search, RefreshCw, Trash2, ShieldAlert } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../services/dataService';

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [filterUser, setFilterUser] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    const actionLogs = await DataService.getActionLogs();
    setLogs(actionLogs);
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToRealtime(() => loadData());
    return () => unsub();
  }, []);

  useEffect(() => {
    let list = [...logs];

    if (filterUser) {
      list = list.filter(l => l.user.toLowerCase() === filterUser.toLowerCase());
    }

    if (filterDate) {
      list = list.filter(l => l.timestamp.startsWith(filterDate));
    }

    if (searchQuery) {
      list = list.filter(l => 
        l.action.toLowerCase().includes(searchQuery.toLowerCase()) || 
        l.user.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredLogs(list);
  }, [logs, filterUser, filterDate, searchQuery]);

  // Obtener usuarios únicos que han hecho acciones
  const uniqueUsers = Array.from(new Set(logs.map(l => l.user)));

  const handleClearFilters = () => {
    setFilterUser('');
    setFilterDate('');
    setSearchQuery('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Cabecera y Filtros */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Log de Acciones del Sistema</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Historial de operaciones de todos los usuarios operadores</p>
        </div>
        
        <button onClick={loadData} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '0px', fontSize: '13px' }}>
          <RefreshCw size={14} /> Refrescar
        </button>
      </div>

      {/* Panel de Filtros */}
      <div className="card" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 0.8fr', gap: '12px', alignItems: 'end', padding: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Buscar Acción</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Buscar por descripción..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px 8px 30px',
                fontSize: '13px',
                border: '1px solid var(--border-color)',
                outline: 'none',
                backgroundColor: '#FFF'
              }}
            />
            <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-secondary)' }} />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Operador</label>
          <select 
            value={filterUser} 
            onChange={e => setFilterUser(e.target.value)}
            style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', fontSize: '13px', backgroundColor: '#FFF', outline: 'none' }}
          >
            <option value="">Todos los operadores</option>
            {uniqueUsers.map(user => (
              <option key={user} value={user}>{user}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Fecha</label>
          <input 
            type="date" 
            value={filterDate} 
            onChange={e => setFilterDate(e.target.value)}
            style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border-color)', fontSize: '13px', backgroundColor: '#FFF', outline: 'none', fontFamily: 'var(--font-sans)' }}
          />
        </div>

        <button onClick={handleClearFilters} className="btn-secondary" style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '0px', height: '36px' }}>
          Limpiar Filtros
        </button>
      </div>

      {/* Tabla de Resultados */}
      <div className="card" style={{ padding: '0px', overflowHidden: true }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: '#FAFAFA' }}>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', width: '180px' }}>Fecha y Hora</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', width: '180px' }}>Operador</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No se encontraron registros de acciones con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      {log.user}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>
                      {log.action}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
