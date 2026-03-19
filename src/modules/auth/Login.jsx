import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]     = useState('');
  const [pass, setPass]       = useState('');
  const [error, setError]     = useState('');
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

  return (
    <div style={{
      minHeight:'100vh', background:'#F5F5F5',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:16, fontFamily:"'Inter', system-ui, sans-serif",
    }}>
      <div style={{ width:'100%', maxWidth:380 }}>

        {/* Brand */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:56, height:56, background:'#1B5E20', borderRadius:14, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'1.6rem', marginBottom:14, boxShadow:'0 4px 14px rgba(27,94,32,.3)' }}>
            🌿
          </div>
          <div style={{ fontSize:'1.4rem', fontWeight:800, color:'#1B5E20', letterSpacing:'-.01em' }}>AJÚA BPM</div>
          <div style={{ fontSize:'.82rem', color:'#757575', marginTop:4 }}>Sistema de Gestión Empresarial</div>
        </div>

        {/* Card */}
        <div style={{
          background:'#fff', borderRadius:12,
          boxShadow:'0 4px 24px rgba(0,0,0,.08), 0 1px 4px rgba(0,0,0,.05)',
          padding:32,
        }}>
          <div style={{ fontSize:'1rem', fontWeight:700, color:'#212121', marginBottom:24 }}>Iniciar sesión</div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'flex', flexDirection:'column', gap:6, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', color:'#616161', letterSpacing:'.06em' }}>
                Usuario
                <input
                  type="text" value={email} onChange={e=>setEmail(e.target.value)}
                  autoFocus placeholder="usuario o email"
                  style={{ padding:'11px 14px', border:'1.5px solid #E0E0E0', borderRadius:6, fontSize:'.9rem', outline:'none', fontFamily:'inherit', color:'#212121' }}
                  onFocus={e=>e.target.style.borderColor='#2E7D32'}
                  onBlur={e=>e.target.style.borderColor='#E0E0E0'}
                />
              </label>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'flex', flexDirection:'column', gap:6, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', color:'#616161', letterSpacing:'.06em' }}>
                Contraseña
                <input
                  type="password" value={pass} onChange={e=>setPass(e.target.value)}
                  placeholder="••••••••"
                  style={{ padding:'11px 14px', border:'1.5px solid #E0E0E0', borderRadius:6, fontSize:'.9rem', outline:'none', fontFamily:'inherit', color:'#212121' }}
                  onFocus={e=>e.target.style.borderColor='#2E7D32'}
                  onBlur={e=>e.target.style.borderColor='#E0E0E0'}
                />
              </label>
            </div>

            {error && (
              <div style={{ background:'#FFEBEE', color:'#C62828', borderRadius:6, padding:'10px 14px', marginBottom:16, fontSize:'.83rem', fontWeight:500 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !pass}
              style={{
                width:'100%', padding:'13px', borderRadius:6, border:'none',
                background: loading||!email||!pass ? '#BDBDBD' : '#1B5E20',
                color:'#fff', fontWeight:700, fontSize:'.92rem',
                cursor: loading||!email||!pass ? 'not-allowed' : 'pointer',
                fontFamily:'inherit', letterSpacing:'.02em',
                transition:'background .15s',
              }}
            >
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <div style={{ textAlign:'center', marginTop:20, fontSize:'.72rem', color:'#9E9E9E' }}>
          AGROINDUSTRIA AJÚA · Guatemala
        </div>
      </div>
    </div>
  );
}
