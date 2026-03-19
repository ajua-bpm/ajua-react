// ─── Design tokens ───────────────────────────────────────────────────────────
const T = {
  primary:  '#1B5E20',
  border:   '#E0E0E0',
  textMid:  '#6B6B60',
};
const card = {
  background: '#fff', borderRadius: 8,
  boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 0,
  overflow: 'hidden',
};

export default function Croquis() {
  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: T.primary, margin: 0 }}>
          Croquis de Bodega
        </h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, margin: '4px 0 0' }}>
          Distribución, zonas y plano interno de la bodega — Agroindustria Ajúa
        </p>
      </div>

      {/* Frame */}
      <div style={{ ...card, border: `1px solid ${T.border}` }}>
        <iframe
          src="https://agroajua.com/croquis_bodega.html"
          title="Croquis Bodega Ajúa"
          style={{ width: '100%', height: '80vh', border: 'none', display: 'block' }}
        />
      </div>
    </div>
  );
}
