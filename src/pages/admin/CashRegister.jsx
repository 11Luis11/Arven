import { useState, useEffect } from 'react';
import { Wallet, Plus, Minus, DollarSign, Calendar, Clock, User, CheckCircle, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../services/dataService';

export default function CashRegister() {
  const loggedInUserRaw = localStorage.getItem('admin_user');
  const currentUser = loggedInUserRaw ? JSON.parse(loggedInUserRaw) : { name: 'Admin Principal', role: 'admin' };

  const [register, setRegister] = useState(null);
  const [movements, setMovements] = useState([]);
  
  // Formularios
  const [initialAmount, setInitialAmount] = useState('100.00');
  const [realAmount, setRealAmount] = useState('');
  
  // Agregar Movimiento
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveForm, setMoveForm] = useState({
    type: 'income',
    amount: '',
    description: ''
  });

  const [msg, setMsg] = useState({ type: '', text: '' });

  // Admin Authorization Modal
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authAction, setAuthAction] = useState(null);

  // Colaborador verification states
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState(false);
  const [authorizedAdminName, setAuthorizedAdminName] = useState('');

  const loadData = async () => {
    const reg = await DataService.getCashRegister();
    setRegister(reg);

    if (reg.status === 'open' && reg.currentSession) {
      const moves = await DataService.getCashMovements(reg.currentSession.id);
      setMovements(moves);
    } else {
      setMovements([]);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToRealtime(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  const handleOpen = (e) => {
    if (e) e.preventDefault();
    if (!initialAmount) return;
    
    const action = async (adminName) => {
      await DataService.openCashRegister(initialAmount, currentUser.name, adminName);
      setMsg({ type: 'success', text: `Caja chica aperturada y autorizada por ${adminName}.` });
      setIsAuthorizedAdmin(false);
      setAuthorizedAdminName('');
      setTimeout(() => setMsg({ type: '', text: '' }), 3000);
      loadData();
    };

    if (currentUser.role === 'admin' || isAuthorizedAdmin) {
      action(authorizedAdminName || currentUser.name);
    } else {
      setAuthAction(() => action);
      setAuthEmail('');
      setAuthPassword('');
      setAuthError('');
      setShowAuthModal(true);
    }
  };

  const handleClose = (e) => {
    if (e) e.preventDefault();
    if (!realAmount) return;

    const action = async (adminName) => {
      await DataService.closeCashRegister(realAmount, currentUser.name, adminName);
      setMsg({ type: 'success', text: `Caja chica cerrada. Turno guardado e impreso por ${adminName}.` });
      setRealAmount('');
      setIsAuthorizedAdmin(false);
      setAuthorizedAdminName('');
      setTimeout(() => setMsg({ type: '', text: '' }), 3000);
      loadData();
    };

    if (currentUser.role === 'admin' || isAuthorizedAdmin) {
      action(authorizedAdminName || currentUser.name);
    } else {
      setAuthAction(() => action);
      setAuthEmail('');
      setAuthPassword('');
      setAuthError('');
      setShowAuthModal(true);
    }
  };

  const handleAdminAuthSubmit = async (e) => {
    e.preventDefault();
    const config = await DataService.getConfig();
    let matchedAdmin = config.users?.find(
      u => u.email.toLowerCase() === authEmail.toLowerCase() && u.role === 'admin' && (u.password || 'password') === authPassword
    );
    if (!matchedAdmin && authEmail.toLowerCase() === 'admin@carrillostore.com' && authPassword === 'password') {
      matchedAdmin = { name: 'Admin Principal' };
    }

    if (matchedAdmin) {
      setShowAuthModal(false);
      if (authAction) {
        authAction(matchedAdmin.name);
      } else {
        setIsAuthorizedAdmin(true);
        setAuthorizedAdminName(matchedAdmin.name);
      }
    } else {
      setAuthError('Acceso denegado. Credenciales de Administrador inválidas.');
    }
  };

  const handleAddMovement = async (e) => {
    e.preventDefault();
    if (!moveForm.amount || !moveForm.description) return;

    await DataService.addCashMovement(
      register.currentSession.id,
      moveForm.type,
      moveForm.amount,
      moveForm.description,
      currentUser.name
    );

    setShowMoveModal(false);
    setMoveForm({ type: 'income', amount: '', description: '' });
    setMsg({ type: 'success', text: 'Movimiento de caja registrado.' });
    setTimeout(() => setMsg({ type: '', text: '' }), 3000);
    loadData();
  };

  const filteredHistory = register?.history
    ? (currentUser.role === 'admin' 
        ? register.history 
        : register.history.filter(h => h.opened_by === currentUser.name))
    : [];

  if (!register) return null;

  // Render para colaborador que no tiene autorización temporal
  const showLockScreen = currentUser.role === 'employee' && !isAuthorizedAdmin;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Mensajes */}
      {msg.text && (
        <div style={{
          padding: '12px 16px',
          border: '1px solid',
          borderColor: msg.type === 'success' ? '#DEF7EC' : '#FDE8E8',
          backgroundColor: msg.type === 'success' ? '#F3FBF7' : '#FDF2F2',
          color: msg.type === 'success' ? '#03543F' : '#9B1C1C',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px'
        }}>
          {msg.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* RENDERIZADO DE PANTALLA BLOQUEADA PARA COLABORADOR */}
      {showLockScreen ? (
        <div className="card" style={{ maxWidth: '520px', margin: '40px auto', width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '24px', padding: '40px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            color: '#EF4444',
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto'
          }}>
            <ShieldAlert size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Arqueo de Caja - Control de Turno</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '10px', lineHeight: '1.6' }}>
              {register.status === 'closed' 
                ? 'La caja se encuentra CERRADA. Para iniciar a realizar ventas, el Administrador debe loguearse para abrir el turno y poner el saldo inicial.'
                : 'La caja se encuentra ABIERTA. Al momento de retirarte, el Administrador debe iniciar sesión en esta pantalla para realizar tu arqueo físico y el cierre oficial del turno.'
              }
            </p>
          </div>

          <button 
            onClick={() => {
              setAuthAction(null); // Esto indica al submit que ponga isAuthorizedAdmin = true
              setAuthEmail('');
              setAuthPassword('');
              setAuthError('');
              setShowAuthModal(true);
            }} 
            className="btn-primary" 
            style={{ borderRadius: '0px', width: '100%', padding: '12px' }}
          >
            {register.status === 'closed' ? '🔑 Autorizar Apertura (Admin)' : '🔑 Iniciar Arqueo y Cierre (Admin)'}
          </button>
        </div>
      ) : (
        <>
          {/* CASO 1: CAJA CERRADA */}
          {register.status === 'closed' && (
            <div className="card" style={{ maxWidth: '500px', margin: '0 auto', width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                backgroundColor: 'rgba(26, 26, 255, 0.05)',
                color: 'var(--color-primary)',
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto'
              }}>
                <Wallet size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 500 }}>Apertura de Turno de Caja</h3>
                {isAuthorizedAdmin && (
                  <span style={{ fontSize: '12px', color: 'green', fontWeight: 600, display: 'block', marginTop: '6px' }}>
                    🔓 Autorizado por el Administrador: {authorizedAdminName}
                  </span>
                )}
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  Ingresa el fondo fijo de apertura para habilitar las ventas.
                </p>
              </div>

              <form onSubmit={handleOpen} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                    Monto Inicial en Efectivo (S/.)
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    className="input-field"
                    value={initialAmount}
                    onChange={e => setInitialAmount(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn-primary" style={{ borderRadius: '0px', width: '100%' }}>
                  Abrir Caja Chica
                </button>
              </form>
            </div>
          )}

          {/* CASO 2: CAJA ABIERTA */}
          {register.status === 'open' && register.currentSession && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '24px', alignItems: 'start' }}>
              
              {/* LADO IZQUIERDO: DETALLE DE MOVIMIENTOS */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Movimientos de Caja (Turno Activo)</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Lista de ingresos y egresos registrados durante el día</p>
                  </div>
                  {currentUser.role === 'admin' && (
                    <button onClick={() => setShowMoveModal(true)} className="btn-primary" style={{ fontSize: '13px', padding: '8px 16px', borderRadius: '0px' }}>
                      Registrar Movimiento
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {movements.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', padding: '30px' }}>
                      No hay movimientos registrados todavía.
                    </p>
                  ) : (
                    movements.map(m => (
                      <div key={m.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: '#FFF'
                      }}>
                        <div>
                          <span style={{
                            fontSize: '10px',
                            backgroundColor: m.type === 'income' ? '#EBFBEE' : '#FDE8E8',
                            color: m.type === 'income' ? '#2F855A' : '#9B1C1C',
                            padding: '2px 6px',
                            fontWeight: 600,
                            marginRight: '8px'
                          }}>
                            {m.type === 'income' ? 'INGRESO' : 'EGRESO'}
                          </span>
                          <strong style={{ fontSize: '13px' }}>{m.description}</strong>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Por: {m.created_by} • {new Date(m.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <span style={{
                          fontWeight: 600,
                          color: m.type === 'income' ? 'green' : 'var(--color-secondary)',
                          fontSize: '14px'
                        }}>
                          {m.type === 'income' ? '+' : '-'} S/. {m.amount.toFixed(2)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* LADO DERECHO: ARQUEO Y CIERRE */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Caja Teórica con Fórmula de Arqueo Exacta */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B' }}>Fórmula de Arqueo (Efectivo)</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                    
                    {/* 1. Apertura */}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#475569' }}>Dinero de Apertura:</span>
                      <strong style={{ color: '#0F172A' }}>S/. {register.currentSession.initial_amount.toFixed(2)}</strong>
                    </div>

                    {/* 2. Ventas */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'green' }}>
                      <span>(+) Ventas del Día:</span>
                      <strong>+ S/. {movements.filter(m => m.type === 'income' && m.description !== 'Apertura de Caja').reduce((s, m) => s + m.amount, 0).toFixed(2)}</strong>
                    </div>

                    {/* 3. Gastos */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#C53030' }}>
                      <span>(-) Gastos de Caja:</span>
                      <strong>- S/. {movements.filter(m => m.type === 'expense').reduce((s, m) => s + m.amount, 0).toFixed(2)}</strong>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '4px 0' }} />

                    {/* 4. Esperado */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700 }}>
                      <span>(=) Total Esperado:</span>
                      <span style={{ color: 'var(--color-primary)' }}>S/. {register.currentSession.theoretical_amount.toFixed(2)}</span>
                    </div>

                  </div>
                </div>

                {/* Cierre de Caja */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Arqueo de Cierre</h3>
                  {isAuthorizedAdmin && (
                    <span style={{ fontSize: '12px', color: 'green', fontWeight: 600, display: 'block' }}>
                      🔓 Autorizado por el Administrador: {authorizedAdminName}
                    </span>
                  )}
                  
                  <form onSubmit={handleClose} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                        Monto Real en Efectivo en Caja (S/.)
                      </label>
                      <input 
                        type="number"
                        step="0.01"
                        required
                        placeholder="Monto contado real"
                        className="input-field"
                        value={realAmount}
                        onChange={e => setRealAmount(e.target.value)}
                      />
                    </div>

                    {realAmount && (() => {
                      const theoretical = register.currentSession.theoretical_amount;
                      const real = parseFloat(realAmount) || 0;
                      const diff = real - theoretical;
                      return (
                        <div style={{
                          padding: '10px 12px',
                          fontSize: '13px',
                          fontWeight: 600,
                          backgroundColor: diff === 0 ? '#EBFBEE' : diff > 0 ? '#EBF8FF' : '#FFF5F5',
                          color: diff === 0 ? '#2F855A' : diff > 0 ? '#2B6CB0' : '#C53030',
                          border: '1px solid',
                          borderColor: diff === 0 ? '#C6F6D5' : diff > 0 ? '#BEE3F8' : '#FED7D7'
                        }}>
                          {diff === 0 && '✓ La caja cuadra perfectamente (S/. 0.00)'}
                          {diff > 0 && `↑ Sobrante en caja: S/. ${diff.toFixed(2)}`}
                          {diff < 0 && `↓ Faltante en caja: S/. ${Math.abs(diff).toFixed(2)}`}
                        </div>
                      );
                    })()}
                    
                    <button type="submit" className="btn-primary" style={{ borderRadius: '0px', backgroundColor: 'var(--color-secondary)' }}>
                      Confirmar y Cerrar Caja
                    </button>
                  </form>
                </div>
              </div>

            </div>
          )}

          {/* 3. HISTORIAL DE TURNOS CERRADOS */}
          {filteredHistory && filteredHistory.length > 0 && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Historial de Turnos de Caja</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Registro de arqueos de cierres anteriores</p>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: '#FAFAFA' }}>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Apertura</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Cierre</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Cajero / Colaborador</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Autorizado por</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Arqueado Por</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Monto Apertura</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Monto Esperado</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Monto Real</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((hist, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        {/* Fecha y hora de APERTURA */}
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: 500, fontSize: '12px' }}>{new Date(hist.opened_at).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                            <span style={{ fontSize: '11px', color: '#6B7280' }}>{new Date(hist.opened_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                          </div>
                        </td>
                        {/* Fecha y hora de CIERRE */}
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          {hist.closed_at ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontWeight: 500, fontSize: '12px' }}>{new Date(hist.closed_at).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                              <span style={{ fontSize: '11px', color: '#6B7280' }}>{new Date(hist.closed_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#9CA3AF' }}>—</span>
                          )}
                        </td>
                        {/* Nombre del cajero / colaborador que abrió */}
                        <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: '13px' }}>
                          {hist.opened_by || '—'}
                        </td>
                        {/* Admin que autorizó la apertura */}
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#374151' }}>
                          {hist.authorized_by && hist.authorized_by !== hist.opened_by ? hist.authorized_by : '—'}
                        </td>
                        {/* Quién hizo el arqueo/cierre */}
                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>{hist.closed_authorized_by || hist.closed_by || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>S/. {hist.initial_amount.toFixed(2)}</td>
                        <td style={{ padding: '12px 16px' }}>S/. {hist.theoretical_amount.toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>S/. {hist.real_amount.toFixed(2)}</td>
                        <td style={{
                          padding: '12px 16px',
                          fontWeight: 600,
                          color: hist.difference === 0 ? 'green' : hist.difference > 0 ? 'blue' : 'red'
                        }}>
                          {hist.difference === 0 ? 'S/. 0.00 (Cuadrada)' : `${hist.difference > 0 ? '+' : ''} S/. ${hist.difference.toFixed(2)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* REGISTRO DE MOVIMIENTO MODAL */}
      {showMoveModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleAddMovement} style={{ backgroundColor: '#FFF', padding: '30px', border: '1px solid var(--border-color)', maxWidth: '450px', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Registrar Movimiento de Caja</h3>
            
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>Tipo de Movimiento</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setMoveForm({ ...moveForm, type: 'income' })}
                  className="btn-secondary"
                  style={{
                    flex: 1,
                    borderRadius: '0px',
                    backgroundColor: moveForm.type === 'income' ? 'var(--text-primary)' : '#FFF',
                    color: moveForm.type === 'income' ? '#FFF' : 'var(--text-primary)',
                  }}
                >
                  <Plus size={12} style={{ marginRight: '4px', display: 'inline' }} /> Ingreso (Entrada)
                </button>
                <button 
                  type="button" 
                  onClick={() => setMoveForm({ ...moveForm, type: 'expense' })}
                  className="btn-secondary"
                  style={{
                    flex: 1,
                    borderRadius: '0px',
                    backgroundColor: moveForm.type === 'expense' ? 'var(--text-primary)' : '#FFF',
                    color: moveForm.type === 'expense' ? '#FFF' : 'var(--text-primary)',
                  }}
                >
                  <Minus size={12} style={{ marginRight: '4px', display: 'inline' }} /> Egreso (Salida)
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>Monto (S/.)</label>
              <input 
                type="number"
                step="0.01"
                required
                className="input-field"
                value={moveForm.amount}
                onChange={e => setMoveForm({ ...moveForm, amount: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>Concepto / Motivo</label>
              <input 
                type="text"
                required
                placeholder="Ej. Compra de suministros de limpieza"
                className="input-field"
                value={moveForm.description}
                onChange={e => setMoveForm({ ...moveForm, description: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button type="button" onClick={() => setShowMoveModal(false)} className="btn-secondary" style={{ flex: 1, borderRadius: '0px' }}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" style={{ flex: 1, borderRadius: '0px' }}>
                Registrar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE AUTORIZACIÓN DEL ADMINISTRADOR */}
      {showAuthModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleAdminAuthSubmit} style={{ backgroundColor: '#FFF', padding: '30px', border: '2px solid var(--text-primary)', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <Wallet size={20} style={{ color: 'var(--color-secondary)' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Autorización del Administrador</h3>
            </div>
            
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Esta acción requiere credenciales de seguridad de un Administrador para autorizar el arqueo / apertura.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Correo de Administrador</label>
              <input 
                type="email" 
                required 
                placeholder="admin@carrillostore.com" 
                className="input-field" 
                value={authEmail} 
                onChange={e => setAuthEmail(e.target.value)} 
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Contraseña</label>
              <input 
                type="password" 
                required 
                placeholder="••••••••" 
                className="input-field" 
                value={authPassword} 
                onChange={e => setAuthPassword(e.target.value)} 
              />
            </div>

            {authError && (
              <span style={{ fontSize: '11px', color: 'var(--color-secondary)', fontWeight: 600 }}>
                {authError}
              </span>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button type="button" onClick={() => setShowAuthModal(false)} className="btn-secondary" style={{ flex: 1, borderRadius: '0px', fontSize: '13px' }}>Cancelar</button>
              <button type="submit" className="btn-primary" style={{ flex: 1, borderRadius: '0px', fontSize: '13px' }}>Autorizar</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
