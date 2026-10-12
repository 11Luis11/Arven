import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail, AlertCircle, ArrowLeft } from 'lucide-react';
import SEO from '../../components/SEO';
import { DataService } from '../../services/dataService';


export default function AdminLogin({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }
    setLoading(true);
    try {
      // Supabase Auth valida la contraseña en el servidor: el navegador nunca la ve
      const profile = await DataService.signIn(cleanEmail, password);
      const safeUser = { id: profile.id, name: profile.name, email: profile.email, role: profile.role };
      localStorage.setItem('admin_logged_in', 'true');
      localStorage.setItem('admin_user', JSON.stringify(safeUser));
      DataService.addActionLog('Inició sesión en el panel administrativo', safeUser.name);
      onLogin();
      navigate(safeUser.role === 'employee' ? '/admin/pos' : '/admin/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
      setError(err?.message?.includes('fetch')
        ? 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'
        : (err?.message || 'No se pudo iniciar sesión.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      <SEO title="Iniciar sesión - Admin" description="Acceso al panel administrativo." />

      <div className="login-card animate-slide-up">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: 'var(--color-primary-soft)', color: 'var(--color-primary)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <Lock size={22} strokeWidth={2} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Bienvenido de nuevo</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 }}>
            Ingresa al panel de ventas y administración
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label htmlFor="login-email" className="field-label">Correo electrónico</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} className="login-icon" />
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                autoFocus
                className="input-field"
                placeholder="tucorreo@empresa.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ paddingLeft: 38, minHeight: 44 }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="field-label">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} className="login-icon" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ paddingLeft: 38, paddingRight: 44, minHeight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="btn-ghost btn-icon"
                style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger" role="alert">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn-primary btn-lg btn-block" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? (
              <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,.35)', borderTopColor: '#fff' }} /> Verificando…</>
            ) : (
              <>Ingresar <ArrowRight size={16} /></>
            )}
          </button>
        </form>

        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center', width: '100%', marginTop: 24, fontSize: 13, color: 'var(--text-secondary)' }}>
          <ArrowLeft size={14} /> Volver a la tienda
        </Link>
      </div>

      <style>{`
        .login-root {
          min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px;
          background:
            radial-gradient(1200px 600px at 10% -10%, rgba(79,70,229,.10), transparent 60%),
            radial-gradient(900px 500px at 110% 110%, rgba(14,165,233,.08), transparent 60%),
            var(--bg-primary);
        }
        .login-card {
          width: 100%; max-width: 420px; background: var(--bg-card); border: 1px solid var(--border-color);
          border-radius: 18px; padding: 40px 32px; box-shadow: var(--shadow-lg);
        }
        .login-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
        @media (max-width: 480px) { .login-card { padding: 32px 20px; } }
      `}</style>
    </div>
  );
}
