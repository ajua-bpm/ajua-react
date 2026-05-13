import { useState, useRef, useEffect } from 'react';
import { useIngieMari } from './useIngieMari';
import { useVoice } from './useVoice';

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
  alignSelf: 'flex-end', maxWidth: '85%', background: '#166534', color: '#fff',
  padding: '8px 12px', borderRadius: '14px 14px 4px 14px',
  fontSize: '.88rem', lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
} : {
  alignSelf: 'flex-start', maxWidth: '85%', background: '#F0FDF4', color: '#1a1a1a',
  padding: '8px 12px', borderRadius: '14px 14px 14px 4px',
  fontSize: '.88rem', lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  borderLeft: '3px solid #166534',
};

export default function IngieMari() {
  const [isOpen, setIsOpen]   = useState(false);
  const [input,  setInput]    = useState('');
  const [ttsOn,  setTtsOn]    = useState(false);
  const { messages, sendMessage, clearHistory, loading } = useIngieMari();
  const endRef = useRef(null);
  const lastSpokenRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  const { listening, speaking, supported: micSupported, ttsSupported,
          startListening, stopListening, speak, stopSpeaking } =
    useVoice({ onTranscript: (t) => { setInput(''); sendMessage(t); }, lang: 'es-GT' });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { if (isOpen) endRef.current?.scrollIntoView({ behavior: 'smooth' }); },
    [messages, isOpen, loading]);

  // Auto-speak new MARI replies when TTS is on
  useEffect(() => {
    if (!ttsOn) return;
    const last = messages[messages.length - 1];
    if (last && last.role === 'assistant' && last.content !== lastSpokenRef.current && !last.content.startsWith('⚠')) {
      lastSpokenRef.current = last.content;
      speak(last.content);
    }
  }, [messages, ttsOn, speak]);

  const handleSend = (text) => {
    const t = (text || input).trim();
    if (!t || loading) return;
    setInput('');
    sendMessage(t);
  };

  const toggleMic = () => { if (listening) stopListening(); else startListening(); };
  const toggleTts = () => { if (speaking) stopSpeaking(); setTtsOn(v => !v); };

  return (
    <>
      <style>{`
        @keyframes mari-pulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(22,101,52,0.5); }
          50%      { box-shadow: 0 4px 24px rgba(22,101,52,0.85), 0 0 0 10px rgba(22,101,52,0.15); }
        }
        @keyframes mari-mic {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220,38,38,0.6); }
          50%      { transform: scale(1.08); box-shadow: 0 0 0 10px rgba(220,38,38,0); }
        }
        @keyframes mari-dots {
          0%, 20%   { opacity: 0.25; }
          50%       { opacity: 1; }
          80%, 100% { opacity: 0.25; }
        }
      `}</style>

      {!isOpen && (
        <button onClick={() => setIsOpen(true)} title="Inge MARI" style={{
          position: 'fixed', bottom: 24, left: 24, zIndex: 9999,
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg, #166534, #15803d)',
          boxShadow: '0 4px 20px rgba(22,101,52,0.5)',
          border: '3px solid #fff', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 26, fontFamily: 'inherit',
          animation: messages.length === 0 ? 'mari-pulse 5s ease-in-out infinite' : 'none',
        }}>
          <span style={{ lineHeight: 1 }}>👩‍🔬</span>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.06em', marginTop: 2 }}>MARI</span>
        </button>
      )}

      {isOpen && (
        <div style={{
          position: 'fixed', bottom: 100, left: isMobile ? 12 : 24,
          width: isMobile ? '92vw' : 340, height: isMobile ? '65vh' : 500,
          borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          background: '#fff', display: 'flex', flexDirection: 'column',
          zIndex: 9998, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, #166534, #15803d)',
            color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 26, lineHeight: 1 }}>👩‍🔬</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '.95rem' }}>
                Inge MARI {speaking && <span style={{ fontSize: '.7rem', opacity: .85 }}>🔊 hablando…</span>}
              </div>
              <div style={{ fontSize: '.68rem', opacity: 0.9 }}>Agrónoma · Química · Bodega</div>
            </div>
            {ttsSupported && (
              <button onClick={toggleTts} title={ttsOn ? 'Silenciar voz' : 'Activar voz'}
                style={iconBtn(ttsOn ? '#FEF3C7' : 'transparent', ttsOn ? '#166534' : '#fff')}>
                {ttsOn ? '🔊' : '🔇'}
              </button>
            )}
            <button onClick={clearHistory} title="Limpiar historial" style={iconBtn('transparent', '#fff')}>🗑️</button>
            <button onClick={() => setIsOpen(false)} title="Cerrar"
              style={{ ...iconBtn('transparent', '#fff'), fontWeight: 700 }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex',
            flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && (
              <>
                <div style={msgStyle('assistant')}>{WELCOME}</div>
                <div style={{ display: 'flex', overflowX: 'auto', gap: 6, paddingBottom: 4 }}>
                  {CHIPS.map(c => (
                    <button key={c.text} onClick={() => handleSend(c.text)} style={chipStyle}>
                      {c.emoji} {c.text}
                    </button>
                  ))}
                </div>
                {micSupported && (
                  <div style={{ fontSize: '.7rem', color: '#6B6B60', textAlign: 'center', marginTop: 4 }}>
                    🎤 Tocá el micrófono y hablale a MARI
                  </div>
                )}
              </>
            )}
            {messages.map((m, i) => <div key={i} style={msgStyle(m.role)}>{m.content}</div>)}
            {loading && (
              <div style={{ ...msgStyle('assistant'), display: 'inline-flex', gap: 3 }}>
                <span style={{ animation: 'mari-dots 1.2s infinite' }}>●</span>
                <span style={{ animation: 'mari-dots 1.2s infinite', animationDelay: '.2s' }}>●</span>
                <span style={{ animation: 'mari-dots 1.2s infinite', animationDelay: '.4s' }}>●</span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Listening banner */}
          {listening && (
            <div style={{ padding: '6px 12px', background: '#FEE2E2', color: '#991B1B',
              fontSize: '.78rem', fontWeight: 600, textAlign: 'center', borderTop: '1px solid #FCA5A5' }}>
              🎙️ Escuchando… hablá ahora
            </div>
          )}

          {/* Input */}
          <div style={{ display: 'flex', gap: 6, padding: 10, borderTop: '1px solid #E5E7EB', background: '#fff' }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={listening ? '🎙️ Escuchando...' : 'Preguntale a MARI o tocá 🎤'}
              disabled={loading || listening}
              style={{ flex: 1, minHeight: 44, padding: '0 14px',
                border: '1.5px solid #E5E7EB', borderRadius: 22,
                fontSize: '.9rem', outline: 'none', fontFamily: 'inherit',
                background: loading || listening ? '#F5F5F5' : '#fff' }} />
            {micSupported && (
              <button onClick={toggleMic} disabled={loading}
                title={listening ? 'Parar' : 'Hablar'}
                style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: listening ? '#DC2626' : '#fff',
                  color: listening ? '#fff' : '#166534',
                  border: `1.5px solid ${listening ? '#DC2626' : '#166534'}`,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontFamily: 'inherit',
                  animation: listening ? 'mari-mic 1.2s ease-in-out infinite' : 'none',
                }}>
                {listening ? '⏹' : '🎤'}
              </button>
            )}
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

const iconBtn = (bg, col) => ({
  background: bg, border: 'none', color: col, cursor: 'pointer',
  fontSize: 16, padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
});
const chipStyle = {
  flexShrink: 0, padding: '6px 12px', borderRadius: 20,
  border: '1px solid #166534', background: '#F0FDF4', color: '#166534',
  fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
};
