import { useState, useEffect, useCallback, useRef } from 'react';
import { Wallet, Plus, Minus, Lock, Unlock, ShieldAlert, ShieldCheck, ArrowDownCircle, ArrowUpCircle, History, KeyRound } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../services/dataService';
import { toast } from '../../utils/toast';

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('admin_user');
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    /* sesión corrupta: usar valores por defecto */
  }
  return { name: 'Admin Principal', role: 'admin' };
};

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (v) => `S/. ${num(v).toFixed(2)}`;
const isZero = (v) => Math.abs(num(v)) < 0.005;

// Valida un monto ingresado. Devuelve { value } o { error }.
const parseAmount = (raw, { allowZero = true } = {}) => {
  if (raw === '' || raw === null || raw === undefined) return { error: 'Ingresa un monto.' };
  const n = parseFloat(String(raw).replace(',', '.'));
  if (!Number.isFinite(n)) return { error: 'El monto no es válido.' };
  if (n < 0) return { error: 'El monto no puede ser negativo.' };
  if (!allowZero && n === 0) return { error: 'El monto debe ser mayor a 0.' };
  if (n > 1000000) return { error: 'El monto es demasiado alto. Verifica la cifra.' };
  return { value: Math.round(n * 100) / 100 };
};

const fmtDate = (v) => new Date(v).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtTime = (v) => new Date(v).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });

export default function CashRegister() {
  const [currentUser] = useState(getCurrentUser);

  const [register, setRegister] = useState(null);
  const [movements, setMovements] = useState([]);

  // Formularios
  const [initialAmount, setInitialAmount] = useState('100.00');
  const [realAmount, setRealAmount] = useState('');
  const [busy, setBusy] = useState(false); // apertura / cierre en curso
  const busyRef = useRef(false);           // candado síncrono contra doble clic

  // Agregar Movimiento
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveForm, setMoveForm] = useState({ type: 'income', amount: '', description: '' });
  const [moveSaving, setMoveSaving] = useState(false);

  // Modal de autorización de administrador
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authAction, setAuthAction] = useState(null);
  const [authChecking, setAuthChecking] = useState(false);

  // Autorización temporal para colaborador
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState(false);
  const [authorizedAdminName, setAuthorizedAdminName] = useState('');

  const loadSeq = useRef(0);
  const loadData = useCallback(async () => {
    const seq = ++loadSeq.current;
    const reg = await DataService.getCashRegister();
    const moves = reg.status === 'open' && reg.currentSession
      ? await DataService.getCashMovements(reg.currentSession.id)
      : [];
    if (seq !== loadSeq.current) return; // respuesta obsoleta
    setRegister(reg);
    setMovements(Array.isArray(moves) ? moves : []);
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToRealtime(() => loadData());
    return () => unsubscribe();
  }, [loadData]);

  const openAuthModal = (action) => {
    setAuthAction(() => action);
    setAuthEmail('');
    setAuthPassword('');
    setAuthError('');
    setShowAuthModal(true);
  };

  // Ejecuta una acción protegida contra doble clic / doble envío
  const runExclusive = async (fn) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast.error(err?.message || 'Ocurrió un error. Inténtalo nuevamente.');
    } finally {
      busyRef.current = false;
      setBusy(false);
      loadData();
    }
  };

  const handleOpen = (e) => {
    if (e) e.preventDefault();
    if (busyRef.current) return;
    const parsed = parseAmount(initialAmount);
    if (parsed.error) { toast.warning(parsed.error); return; }

    const action = (adminName) => runExclusive(async () => {
      // Revalida por si otra terminal ya abrió la caja
      const fresh = await DataService.getCashRegister();
      if (fresh.status === 'open') {
        toast.warning('La caja ya se encuentra abierta.');
        return;
      }
      await DataService.openCashRegister(parsed.value, currentUser.name, adminName);
      toast.success(`Caja abierta con ${money(parsed.value)}. Autorizado por ${adminName}.`);
      setIsAuthorizedAdmin(false);
      setAuthorizedAdminName('');
    });

    if (currentUser.role === 'admin' || isAuthorizedAdmin) {
      action(authorizedAdminName || currentUser.name);
    } else {
      openAuthModal(action);
    }
  };

  const handleClose = (e) => {
    if (e) e.preventDefault();
    if (busyRef.current) return;
    const parsed = parseAmount(realAmount);
    if (parsed.error) { toast.warning(parsed.error); return; }

    const theoretical = num(register?.currentSession?.theoretical_amount);
    const diff = parsed.value - theoretical;
    if (!isZero(diff)) {
      const label = diff > 0 ? `un SOBRANTE de ${money(diff)}` : `un FALTANTE de ${money(Math.abs(diff))}`;
      if (!window.confirm(`El conteo registra ${label}. ¿Deseas cerrar la caja de todas formas?`)) return;
    }

    const action = (adminName) => runExclusive(async () => {
      const fresh = await DataService.getCashRegister();
      if (fresh.status !== 'open') {
        toast.warning('La caja ya fue cerrada.');
        return;
      }
      await DataService.closeCashRegister(parsed.value, currentUser.name, adminName);
      toast.success(`Caja cerrada. Turno guardado por ${adminName}.`);
      setRealAmount('');
      setIsAuthorizedAdmin(false);
      setAuthorizedAdminName('');
    });

    if (currentUser.role === 'admin' || isAuthorizedAdmin) {
      action(authorizedAdminName || currentUser.name);
    } else {
      openAuthModal(action);
    }
  };

  const handleAdminAuthSubmit = async (e) => {
    e.preventDefault();
    if (authChecking) return;
    setAuthChecking(true);
    try {
      const email = authEmail.trim().toLowerCase();
      const matchedAdmin = await DataService.verifyAdmin(email, authPassword);

      if (matchedAdmin) {
        setShowAuthModal(false);
        if (authAction) {
          authAction(matchedAdmin.name);
        } else {
          setIsAuthorizedAdmin(true);
          setAuthorizedAdminName(matchedAdmin.name);
          toast.success(`Autorizado por ${matchedAdmin.name}.`);
        }
      } else {
        setAuthError('Acceso denegado. Credenciales de administrador inválidas.');
      }
    } catch {
      setAuthError('No se pudo verificar las credenciales. Inténtalo nuevamente.');
    } finally {
      setAuthChecking(false);
    }
  };

  const handleAddMovement = async (e) => {
    e.preventDefault();
    if (moveSaving) return;
    const parsed = parseAmount(moveForm.amount, { allowZero: false });
    if (parsed.error) { toast.warning(parsed.error); return; }
    const description = moveForm.description.trim();
    if (!description) { toast.warning('Ingresa el concepto del movimiento.'); return; }
    if (!register?.currentSession) { toast.error('No hay una caja abierta.'); return; }

    setMoveSaving(true);
    try {
      await DataService.addCashMovement(
        register.currentSession.id,
        moveForm.type,
        parsed.value,
        description,
        currentUser.name
      );
      setShowMoveModal(false);
      setMoveForm({ type: 'income', amount: '', description: '' });
      toast.success(moveForm.type === 'income' ? 'Ingreso registrado.' : 'Egreso registrado.');
    } catch (err) {
      toast.error(err?.message || 'No se pudo registrar el movimiento.');
    } finally {
      setMoveSaving(false);
      loadData();
    }
  };

  if (!register) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
        <div className="spinner" />
      </div>
    );
  }

  const filteredHistory = register.history
    ? (currentUser.role === 'admin'
        ? register.history
        : register.history.filter(h => h.opened_by === currentUser.name))
    : [];

  const isOpen = register.status === 'open' && !!register.currentSession;
  const session = register.currentSession;
  const salesIncome = movements.filter(m => m.type === 'income' && m.description !== 'Apertura de Caja').reduce((s, m) => s + num(m.amount), 0);
  const expenses = movements.filter(m => m.type === 'expense').reduce((s, m) => s + num(m.amount), 0);

  // Colaborador sin autorización temporal
  const showLockScreen = currentUser.role === 'employee' && !isAuthorizedAdmin;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1>Caja</h1>
          <p>Apertura, movimientos y arqueo de cierre del turno.</p>
        </div>
      </div>

      {/* ESTADO DE CAJA — muy visible */}
      <div
        role="status"
        style={{
          display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
          padding: '18px 20px',
          borderRadius: 'var(--radius-lg)',
          border: `1px solid ${isOpen ? '#A7F3D0' : 'var(--border-strong)'}`,
          background: isOpen ? 'var(--color-success-soft)' : 'var(--bg-subtle)',
        }}
      >
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: isOpen ? 'var(--color-success)' : 'var(--text-secondary)', color: '#fff'
        }}>
          {isOpen ? <Unlock size={22} /> : <Lock size={22} />}
        </div>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em', color: isOpen ? '#065F46' : 'var(--text-primary)' }}>
            {isOpen ? 'Caja ABIERTA' : 'Caja CERRADA'}
          </div>
          <div style={{ fontSize: '13px', color: isOpen ? '#047857' : 'var(--text-secondary)', marginTop: '2px' }}>
            {isOpen
              ? `Abierta por ${session.opened_by || '—'} el ${fmtDate(session.opened_at)} a las ${fmtTime(session.opened_at)}`
              : 'Abre un turno para habilitar las ventas en efectivo.'}
          </div>
        </div>
        {isOpen && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: '#047857', fontWeight: 500 }}>Efectivo esperado</div>
            <div style={{ fontSize: '24px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#065F46' }}>
              {money(session.theoretical_amount)}
            </div>
          </div>
        )}
      </div>

      {showLockScreen ? (
        <div className="card" style={{ maxWidth: '520px', margin: '8px auto', width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', padding: '32px' }}>
          <div style={{ width: '64px', height: '64px', background: 'var(--color-danger-soft)', color: 'var(--color-danger)', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
            <ShieldAlert size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Se requiere autorización</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
              {register.status === 'closed'
                ? 'La caja está cerrada. Un administrador debe autorizar la apertura del turno e ingresar el fondo inicial.'
                : 'La caja está abierta. Al terminar tu turno, un administrador debe autorizar el arqueo físico y el cierre oficial.'}
            </p>
          </div>
          <button onClick={() => openAuthModal(null)} className="btn-primary btn-lg btn-block">
            <KeyRound size={18} />
            {register.status === 'closed' ? 'Autorizar apertura (Admin)' : 'Iniciar arqueo y cierre (Admin)'}
          </button>
        </div>
      ) : (
        <>
          {isAuthorizedAdmin && (
            <div className="alert alert-success">
              <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>Autorizado por el administrador <strong>{authorizedAdminName}</strong>.</span>
            </div>
          )}

          {/* CASO 1: CAJA CERRADA */}
          {!isOpen && (
            <div className="card" style={{ maxWidth: '480px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ textAlign: 'center' }}>
                <div className="stat-icon" style={{ width: '56px', height: '56px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                  <Wallet size={24} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '12px' }}>Apertura de turno</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Ingresa el fondo de efectivo con el que inicia la caja.
                </p>
              </div>

              <form onSubmit={handleOpen} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="field-label" htmlFor="cash-initial">Monto inicial en efectivo (S/.)</label>
                  <input
                    id="cash-initial"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    required
                    className="input-field"
                    value={initialAmount}
                    onChange={e => setInitialAmount(e.target.value)}
                    disabled={busy}
                    style={{ fontSize: '18px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                  />
                </div>
                <button type="submit" className="btn-success btn-lg btn-block" disabled={busy}>
                  {busy ? 'Abriendo…' : <><Unlock size={18} /> Abrir caja</>}
                </button>
              </form>
            </div>
          )}

          {/* CASO 2: CAJA ABIERTA */}
          {isOpen && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '24px', alignItems: 'start' }}>

              {/* MOVIMIENTOS */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Movimientos del turno</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Ingresos y egresos registrados</p>
                  </div>
                  {currentUser.role === 'admin' && (
                    <button onClick={() => setShowMoveModal(true)} className="btn-primary btn-sm">
                      <Plus size={16} /> Registrar movimiento
                    </button>
                  )}
                </div>

                {movements.length === 0 ? (
                  <div className="empty-state" style={{ padding: '32px 16px' }}>
                    <Wallet size={32} strokeWidth={1.5} />
                    <p style={{ fontSize: '14px' }}>Aún no hay movimientos en este turno.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {movements.map(m => {
                      const income = m.type === 'income';
                      return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', background: 'var(--bg-card)' }}>
                          {income
                            ? <ArrowDownCircle size={22} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                            : <ArrowUpCircle size={22} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, overflowWrap: 'anywhere' }}>{m.description}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              <span className={`badge ${income ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '11px', padding: '0 8px', marginRight: '6px' }}>
                                {income ? 'Ingreso' : 'Egreso'}
                              </span>
                              {m.created_by} · {fmtTime(m.created_at)}
                            </div>
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '15px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: income ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {income ? '+' : '−'} {money(m.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ARQUEO Y CIERRE */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>

                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-subtle)' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Fórmula de arqueo (efectivo)</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Fondo de apertura</span>
                      <strong>{money(session.initial_amount)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success)' }}>
                      <span>(+) Ventas e ingresos</span>
                      <strong>+ {money(salesIncome)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-danger)' }}>
                      <span>(−) Gastos / egresos</span>
                      <strong>− {money(expenses)}</strong>
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-strong)', margin: '2px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 700 }}>
                      <span>(=) Total esperado</span>
                      <span style={{ color: 'var(--color-primary)' }}>{money(session.theoretical_amount)}</span>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Arqueo de cierre</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Cuenta el efectivo físico e ingrésalo.</p>
                  </div>

                  <form onSubmit={handleClose} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label className="field-label" htmlFor="cash-real">Efectivo contado en caja (S/.)</label>
                      <input
                        id="cash-real"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        required
                        placeholder="0.00"
                        className="input-field"
                        value={realAmount}
                        onChange={e => setRealAmount(e.target.value)}
                        disabled={busy}
                        style={{ fontSize: '18px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                      />
                    </div>

                    {realAmount !== '' && (() => {
                      const diff = num(realAmount) - num(session.theoretical_amount);
                      const zero = isZero(diff);
                      return (
                        <div className={`alert ${zero ? 'alert-success' : diff > 0 ? 'alert-info' : 'alert-danger'}`} style={{ fontWeight: 600, fontSize: '14px' }}>
                          {zero && `✓ La caja cuadra (S/. 0.00)`}
                          {!zero && diff > 0 && `↑ Sobrante: ${money(diff)}`}
                          {!zero && diff < 0 && `↓ Faltante: ${money(Math.abs(diff))}`}
                        </div>
                      );
                    })()}

                    <button type="submit" className="btn-danger btn-lg btn-block" disabled={busy}>
                      {busy ? 'Cerrando…' : <><Lock size={18} /> Confirmar y cerrar caja</>}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* HISTORIAL DE TURNOS */}
          {filteredHistory.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={18} style={{ color: 'var(--text-secondary)' }} />
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Historial de turnos</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Arqueos de cierres anteriores</p>
                </div>
              </div>

              <div className="table-wrap">
                <table className="data-table" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <thead>
                    <tr>
                      <th>Apertura</th>
                      <th>Cierre</th>
                      <th>Cajero</th>
                      <th>Autorizó apertura</th>
                      <th>Arqueado por</th>
                      <th style={{ textAlign: 'right' }}>Fondo inicial</th>
                      <th style={{ textAlign: 'right' }}>Esperado</th>
                      <th style={{ textAlign: 'right' }}>Real</th>
                      <th style={{ textAlign: 'right' }}>Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((hist, idx) => {
                      const diff = num(hist.difference);
                      const zero = isZero(diff);
                      return (
                        <tr key={hist.id || idx}>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 500, fontSize: '13px' }}>{fmtDate(hist.opened_at)}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{fmtTime(hist.opened_at)}</div>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {hist.closed_at ? (
                              <>
                                <div style={{ fontWeight: 500, fontSize: '13px' }}>{fmtDate(hist.closed_at)}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{fmtTime(hist.closed_at)}</div>
                              </>
                            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td style={{ fontWeight: 600 }}>{hist.opened_by || '—'}</td>
                          <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {hist.authorized_by && hist.authorized_by !== hist.opened_by ? hist.authorized_by : '—'}
                          </td>
                          <td style={{ fontSize: '13px' }}>{hist.closed_authorized_by || hist.closed_by || '—'}</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(hist.initial_amount)}</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(hist.theoretical_amount)}</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{money(hist.real_amount)}</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <span className={`badge ${zero ? 'badge-success' : diff > 0 ? 'badge-info' : 'badge-danger'}`}>
                              {zero ? 'Cuadrada' : `${diff > 0 ? '+' : '−'} ${money(Math.abs(diff))}`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: REGISTRAR MOVIMIENTO */}
      {showMoveModal && (
        <div className="modal-overlay" onClick={() => !moveSaving && setShowMoveModal(false)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={handleAddMovement} style={{ maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Registrar movimiento de caja</h3>

            <div>
              <span className="field-label">Tipo de movimiento</span>
              <div className="tabs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <button type="button" className={`tab ${moveForm.type === 'income' ? 'active' : ''}`} onClick={() => setMoveForm(f => ({ ...f, type: 'income' }))}
                  style={moveForm.type === 'income' ? { color: 'var(--color-success)' } : undefined}>
                  <Plus size={14} style={{ verticalAlign: '-2px', marginRight: '4px' }} /> Ingreso
                </button>
                <button type="button" className={`tab ${moveForm.type === 'expense' ? 'active' : ''}`} onClick={() => setMoveForm(f => ({ ...f, type: 'expense' }))}
                  style={moveForm.type === 'expense' ? { color: 'var(--color-danger)' } : undefined}>
                  <Minus size={14} style={{ verticalAlign: '-2px', marginRight: '4px' }} /> Egreso
                </button>
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="mov-amount">Monto (S/.)</label>
              <input
                id="mov-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                required
                autoFocus
                className="input-field"
                value={moveForm.amount}
                onChange={e => setMoveForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="mov-desc">Concepto / motivo</label>
              <input
                id="mov-desc"
                type="text"
                required
                maxLength={200}
                placeholder="Ej. Compra de suministros de limpieza"
                className="input-field"
                value={moveForm.description}
                onChange={e => setMoveForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button type="button" onClick={() => setShowMoveModal(false)} className="btn-secondary" style={{ flex: 1 }} disabled={moveSaving}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={moveSaving}>
                {moveSaving ? 'Guardando…' : 'Registrar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: AUTORIZACIÓN DEL ADMINISTRADOR */}
      {showAuthModal && (
        <div className="modal-overlay" style={{ zIndex: 4000 }} onClick={() => !authChecking && setShowAuthModal(false)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={handleAdminAuthSubmit} style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius)', background: 'var(--color-warning-soft)', color: 'var(--color-warning)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <KeyRound size={20} />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 600 }}>Autorización del administrador</h3>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Esta acción requiere las credenciales de un administrador para autorizar la apertura o el arqueo.
            </p>

            <div>
              <label className="field-label" htmlFor="auth-email">Correo del administrador</label>
              <input id="auth-email" type="email" required autoFocus autoComplete="off" placeholder="admin@correo.com" className="input-field" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
            </div>

            <div>
              <label className="field-label" htmlFor="auth-pass">Contraseña</label>
              <input id="auth-pass" type="password" required autoComplete="off" placeholder="••••••••" className="input-field" value={authPassword} onChange={e => setAuthPassword(e.target.value)} />
            </div>

            {authError && <div className="alert alert-danger">{authError}</div>}

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button type="button" onClick={() => setShowAuthModal(false)} className="btn-secondary" style={{ flex: 1 }} disabled={authChecking}>Cancelar</button>
              <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={authChecking}>
                {authChecking ? 'Verificando…' : 'Autorizar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
