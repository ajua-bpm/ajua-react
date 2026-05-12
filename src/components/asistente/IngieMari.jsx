import { useState, useRef, useEffect } from 'react';
import { useIngieMari } from './useIngieMari';

const CHIPS = [
  { emoji: '🌡️', text: 'Temperatura' },
  { emoji: '🥬', text: 'Repollo' },
  { emoji: '🧪', text: 'Cloro' },
  { emoji: '📦', text: 'Rechazo' },
  { emoji: '🐛', text: 'Plaga' },
  { emoji: '💊', text: 'Enfermo' },
];

const WELCOME = `¡Hola! Soy MARI 👩‍🔬\nTu Inge de bodega en AJÚA.\n¿En qué te ayudo?`;

const msgStyle = (role) => role === 'user' ? {
  alignSelf: 'flex-end', maxWidth: '85%',
  background: '#166534', color: '#fff',
  padding: '8px 12px', borderRadius: '14px 14px 4px 14px',
  fontSize: '.88rem', lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
} : {
  alignSelf: 'flex-start', maxWidth: '85%',
  background: '#F0FDF4', color: '#1a1a1a',
  padding: '8px 12px', borderRadius: '14px 14px 14px 4px',
  fontSize: '.88rem', lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  borderLeft: '3px solid #166534',
};

export default function IngieMari() {
  const [isOpen, setIsOpen] = useState(false);
  const [input,  setInput]  = useState('');
  const { messages, sendMessage, clearHistory, loading } = useIngieMari();
  const endRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (isOpen) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, loading]);

  const handleSend = (text) => {
    const t = (text || input).trim();
    if (!t || loading) return;
    setInput('');
    sendMessage(t);
  };

  return (
    <>
      <style>{`
        @keyframes mari-pulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(22,101,52,0.5); }
          50%      { box-shadow: 0 4px 24px rgba(22,101,52,0.85), 0 0 0 10px rgba(22,101,52,0.15); }
        }
        @keyframes mari-dots {
          0%, 20%   { opacity: 0.25; }
          50%       { opacity: 1; }
          80%, 100% { opacity: 0.25; }
        }
      `}</style>

      {!isOpen && (
        <button onClick={() => setIsOpen(true)} title="Inge MARI" style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg, #166534, #15803d)',
          boxShadow: '0 4px 20px rgba(22,101,52,0.5)',
          border: '3px solid #fff', cursor: 'pointer',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 26, fontFamily: 'inherit',
          animation: messages.length === 0 ? 'mari-pulse 5s ease-in-out infinite' : 'none',
        }}>
          <span style={{ lineHeight: 1 }}>👩‍🔬</span>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.06em', marginTop: 2 }}>MARI</span>
        </button>
      )}

      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: 100,
          right: isMobile ? 12 : 24,
          width: isMobile ? '92vw' : 340,
          height: isMobile ? '65vh' : 500,
          borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          background: '#fff', display: 'flex', flexDirection: 'column',
          zIndex: 9998, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #166534, #15803d)',
            color: '#fff', padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 26, lineHeight: 1 }}>👩‍🔬</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '.95rem' }}>Inge MARI</div>
              <div style={{ fontSize: '.68rem', opacity: 0.9 }}>Agrónoma · Química · Bodega</div>
            </div>
            <button onClick={clearHistory} title="Limpiar historial"
              style={{ background: 'transparent', border: 'none', color: '#fff',
                cursor: 'pointer', fontSize: 16, padding: 4 }}>🗑️</button>
            <button onClick={() => setIsOpen(false)} title="Cerrar"
              style={{ background: 'transparent', border: 'none', color: '#fff',
                cursor: 'pointer', fontSize: 18, padding: 4, fontWeight: 700 }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex',
            flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && (
              <>
                <div style={msgStyle('assistant')}>{WELCOME}</div>
                <div style={{ display: 'flex', overflowX: 'auto', gap: 6, paddingBottom: 4 }}>
                  {CHIPS.map(c => (
                    <button key={c.text} onClick={() => handleSend(c.text)} style={{
                      flexShrink: 0, padding: '6px 12px', borderRadius: 20,
                      border: '1px solid #166534', background: '#F0FDF4',
                      color: '#166534', fontSize: '.78rem', fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}>{c.emoji} {c.text}</button>
                  ))}
                </div>
              </>
            )}
            {messages.map((m, i) => (
              <div key={i} style={msgStyle(m.role)}>{m.content}</div>
            ))}
            {loading && (
              <div style={{ ...msgStyle('assistant'), display: 'inline-flex', gap: 3 }}>
                <span style={{ animation: 'mari-dots 1.2s infinite', animationDelay: '0s' }}>●</span>
                <span style={{ animation: 'mari-dots 1.2s infinite', animationDelay: '0.2s' }}>●</span>
                <span style={{ animation: 'mari-dots 1.2s infinite', animationDelay: '0.4s' }}>●</span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 6, padding: 10, borderTop: '1px solid #E5E7EB',
            background: '#fff' }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Preguntale a MARI..." disabled={loading}
              style={{ flex: 1, minHeight: 44, padding: '0 14px',
                border: '1.5px solid #E5E7EB', borderRadius: 22,
                fontSize: '.9rem', outline: 'none', fontFamily: 'inherit',
                background: loading ? '#F5F5F5' : '#fff' }} />
            <button onClick={() => handleSend()} disabled={loading || !input.trim()}
              style={{ width: 44, height: 44, borderRadius: '50%',
                background: loading || !input.trim() ? '#BDBDBD' : '#166534',
                color: '#fff', border: 'none',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0 }}>➤</button>
          </div>
        </div>
      )}
    </>
  );
}
