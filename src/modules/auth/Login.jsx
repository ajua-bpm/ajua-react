import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const C = { green:'#1A3D28',acc:'#4A9E6A',sand:'#E8DCC8',bg:'#F9F6EF' };

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const ok = await login(email.trim(), pass);
      if(ok) {
        navigate('/dashboard', { replace: true });
      } else {
        setError('Usuario o contraseña incorrectos');
      }
    } catch(err) {
      setError('Error de conexión: ' + (err.message||'intenta de nuevo'));
    }
    setLoading(false);
  };

  return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{width:'100%',maxWidth:360}}>
        {/* Logo */}
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:'2rem',marginBottom:8}}>🌿</div>
          <div style={{fontSize:'1.4rem',fontWeight:900,color:C.green,letterSpacing:'.02em'}}>AJÚA BPM</div>
          <div style={{fontSize:'.82rem',color:'#6B8070',marginTop:4}}>Sistema de Gestión BPM</div>
        </div>

        <form onSubmit={handleSubmit} style={{background:'#fff',borderRadius:12,border:`1px solid ${C.sand}`,padding:28,boxShadow:'0 2px 12px rgba(0,0,0,.06)'}}>
          <div style={{marginBottom:16}}>
            <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:'.75rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
              Usuario / Email
              <input type="text" value={email} onChange={e=>setEmail(e.target.value)} autoFocus
                placeholder="usuario@agroajua.com"
                style={{padding:'11px 14px',border:`1.5px solid ${C.sand}`,borderRadius:6,fontSize:'.9rem',outline:'none',transition:'border .15s'}}
                onFocus={e=>e.target.style.borderColor=C.acc}
                onBlur={e=>e.target.style.borderColor=C.sand}
              />
            </label>
          </div>
          <div style={{marginBottom:20}}>
            <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:'.75rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
              Contraseña
              <input type="password" value={pass} onChange={e=>setPass(e.target.value)}
                placeholder="••••••••"
                style={{padding:'11px 14px',border:`1.5px solid ${C.sand}`,borderRadius:6,fontSize:'.9rem',outline:'none',transition:'border .15s'}}
                onFocus={e=>e.target.style.borderColor=C.acc}
                onBlur={e=>e.target.style.borderColor=C.sand}
              />
            </label>
          </div>
          {error&&(
            <div style={{background:'rgba(192,57,43,.1)',color:'#c0392b',borderRadius:6,padding:'10px 14px',marginBottom:16,fontSize:'.83rem',fontWeight:600}}>
              {error}
            </div>
          )}
          <button type="submit" disabled={loading||!email||!pass} style={{
            width:'100%',padding:'13px',background:loading||!email||!pass?'#ccc':C.green,
            color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.9rem',
            cursor:loading||!email||!pass?'not-allowed':'pointer',transition:'background .15s',
          }}>
            {loading?'Verificando...':'Ingresar'}
          </button>
        </form>

        <div style={{textAlign:'center',marginTop:20,fontSize:'.75rem',color:'#9aaa9e'}}>
          AGROINDUSTRIA AJÚA · Guatemala
        </div>
      </div>
    </div>
  );
}
