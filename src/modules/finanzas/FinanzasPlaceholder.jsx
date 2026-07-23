const T = { forest: '#1F3A2C', muted: '#6B6B60', rule: 'rgba(26,26,24,.10)' };

export default function FinanzasPlaceholder({ titulo, subtitulo, icono = '🚧' }) {
  return (
    <div>
      <div style={{ fontSize: '.82rem', color: T.muted, marginBottom: 4 }}>Finanzas · {titulo}</div>
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.55rem', fontWeight: 600, color: T.forest }}>{titulo}</h1>
      <div style={{ fontSize: '.85rem', color: T.muted, marginBottom: 30 }}>{subtitulo}</div>
      <div style={{ padding: 60, background: 'white', border: `1px solid ${T.rule}`, textAlign: 'center', color: T.muted }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>{icono}</div>
        <h2 style={{ fontFamily: "'Fraunces', serif", color: T.forest, marginBottom: 8, fontSize: '1.1rem', fontWeight: 600 }}>Próximamente</h2>
        <p style={{ fontSize: '.88rem' }}>Esta página se habilita en Fase 2 del rollout.</p>
      </div>
    </div>
  );
}
