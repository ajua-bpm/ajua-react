import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [email,   setEmail]   = useState('');
  const [pass,    setPass]    = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const ok = await login(email.trim(), pass);
      if (ok) navigate('/dashboard', { replace: true });
      else setError('Usuario o contraseña incorrectos');
    } catch (err) {
      setError('Error de conexión: ' + (err.message || 'intenta de nuevo'));
    }
    setLoading(false);
  };

  const canSubmit = !loading && email && pass;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--cream)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '2.6rem',
            fontWeight: 700,
            color: 'var(--forest)',
            letterSpacing: '3px',
            lineHeight: 1,
            marginBottom: 10,
          }}>
            AJÚA
          </div>
          <div style={{
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '2.5px',
            textTransform: 'uppercase',
            color: 'var(--ink-light)',
          }}>
            Sistema de Gestión Interno
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '32px 28px',
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            color: 'var(--ink-light)',
            marginBottom: 24,
          }}>
            Iniciar sesión
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={lblStyle}>Usuario</span>
                <input
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoFocus
                  placeholder="usuario o email"
                  style={inputStyle}
                />
              </label>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={lblStyle}>Contraseña</span>
                <input
                  type="password"
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  placeholder="••••••••"
                  style={inputStyle}
                />
              </label>
            </div>

            {error && (
              <div style={{
                background: '#FEF2F2',
                color: '#991B1B',
                border: '1px solid #FCA5A5',
                borderRadius: 3,
                padding: '10px 14px',
                marginBottom: 16,
                fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 3,
                border: 'none',
                background: canSubmit ? 'var(--forest)' : 'var(--border)',
                color: canSubmit ? '#fff' : 'var(--ink-light)',
                fontWeight: 700,
                fontSize: '11px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                transition: 'background .15s',
              }}
            >
              {loading ? 'Verificando…' : 'Ingresar'}
            </button>
          </form>
        </div>

        <div style={{
          textAlign: 'center',
          marginTop: 24,
          fontSize: '11px',
          color: 'var(--ink-light)',
          letterSpacing: '.5px',
        }}>
          AGROINDUSTRIA AJÚA · Guatemala
        </div>
      </div>
    </div>
  );
}

const lblStyle = {
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '1px',
  color: 'var(--ink-light)',
};

const inputStyle = {
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 3,
  fontSize: '14px',
  outline: 'none',
  color: 'var(--ink)',
  background: 'var(--white)',
  width: '100%',
  boxSizing: 'border-box',
};
