import { useState, useEffect } from 'react';
import { db, doc, getDoc, setDoc } from '../../firebase';
import { useToast } from '../../components/Toast';

const T = {
  primary: '#1B5E20', secondary: '#2E7D32',
  border: '#E0E0E0', textMid: '#6B6B60', textDark: '#1A1A18',
};

const ZONAS_DEFAULT = [
  { id: 'recepcion', label: 'Recepción de Producto',  icon: '📥', color: '#E3F2FD', border: '#1565C0', notas: '' },
  { id: 'bodega',    label: 'Bodega Principal',        icon: '🏭', color: '#E8F5E9', border: '#2E7D32', notas: '' },
  { id: 'proceso',   label: 'Área de Proceso',         icon: '⚙️', color: '#FFF3E0', border: '#E65100', notas: '' },
  { id: 'maquila',   label: 'Maquila Externa',         icon: '🔧', color: '#FFF8E1', border: '#F57F17', notas: '' },
  { id: 'precarga',  label: 'Pre-carga / Embarque',    icon: '🚛', color: '#F3E5F5', border: '#6A1B9A', notas: '' },
  { id: 'pallets',   label: 'Área de Pallets',         icon: '📦', color: '#EFEBE9', border: '#4E342E', notas: '' },
  { id: 'frio',      label: 'Cuarto Frío',             icon: '❄️', color: '#E0F7FA', border: '#00695C', notas: '' },
  { id: 'oficinas',  label: 'Oficinas',                icon: '🖥️', color: '#FCE4EC', border: '#C62828', notas: '' },
  { id: 'banos',     label: 'Baños / Vestidores',      icon: '🚿', color: '#F5F5F5', border: '#757575', notas: '' },
];

export default function Croquis() {
  const toast = useToast();
  const [zonas,     setZonas]     = useState(ZONAS_DEFAULT);
  const [editId,    setEditId]    = useState(null);
  const [editVal,   setEditVal]   = useState('');
  const [saving,    setSaving]    = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'ajua_bpm', 'croquis_bodega'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.zonas?.length) {
            const savedMap = Object.fromEntries(data.zonas.map(z => [z.id, z]));
            setZonas(ZONAS_DEFAULT.map(z => ({ ...z, ...(savedMap[z.id] || {}) })));
          }
          setUpdatedAt(data.updatedAt || null);
        }
      } catch (e) { console.warn('Croquis load:', e.message); }
      setLoading(false);
    })();
  }, []);

  const setZona = (id, field, value) =>
    setZonas(prev => prev.map(z => z.id !== id ? z : { ...z, [field]: value }));

  const startRename = (z) => { setEditId(z.id); setEditVal(z.label); };
  const commitRename = () => {
    if (editId && editVal.trim()) setZona(editId, 'label', editVal.trim());
    setEditId(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await setDoc(doc(db, 'ajua_bpm', 'croquis_bodega'), {
        zonas: zonas.map(({ id, label, notas }) => ({ id, label, notas })),
        updatedAt: now,
      });
      setUpdatedAt(now);
      toast('✓ Croquis guardado');
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    }
    setSaving(false);
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: T.textMid }}>Cargando…</div>;

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: T.primary, margin: 0 }}>Croquis de Bodega</h1>
          <p style={{ fontSize: '.82rem', color: T.textMid, margin: '4px 0 0' }}>
            Distribución, zonas y notas internas — Agroindustria Ajúa
            {updatedAt && (
              <span style={{ marginLeft: 10 }}>
                · Guardado: {new Date(updatedAt).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleSave} disabled={saving}
          style={{ padding: '10px 24px', background: saving ? '#BDBDBD' : T.primary, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
        >
          {saving ? 'Guardando…' : 'Guardar Cambios'}
        </button>
      </div>

      {/* Zone grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16, marginBottom: 20 }}>
        {zonas.map(z => (
          <div key={z.id} style={{
            background: z.color, border: `2px solid ${z.border}`, borderRadius: 10,
            padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.08)',
          }}>
            {/* Zone title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: '1.15rem', flexShrink: 0 }}>{z.icon}</span>
              {editId === z.id ? (
                <input
                  autoFocus value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => e.key === 'Enter' && commitRename()}
                  style={{ flex: 1, padding: '4px 8px', border: `1.5px solid ${z.border}`, borderRadius: 5, fontSize: '.88rem', fontFamily: 'inherit', outline: 'none', fontWeight: 700, background: '#fff' }}
                />
              ) : (
                <span style={{ flex: 1, fontWeight: 700, fontSize: '.9rem', color: T.textDark, lineHeight: 1.3 }}>
                  {z.label}
                  <button onClick={() => startRename(z)} title="Renombrar zona" style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: '.7rem', color: T.textMid, padding: '0 2px' }}>✏</button>
                </span>
              )}
            </div>

            {/* Notes */}
            <textarea
              value={z.notas}
              onChange={e => setZona(z.id, 'notas', e.target.value)}
              placeholder="Notas, observaciones, cambios en esta zona…"
              rows={3}
              style={{ width: '100%', padding: '8px 10px', border: `1.5px solid ${z.border}55`, borderRadius: 6, fontSize: '.82rem', fontFamily: 'inherit', outline: 'none', resize: 'vertical', background: 'rgba(255,255,255,.75)', boxSizing: 'border-box', color: T.textDark }}
            />
          </div>
        ))}
      </div>

      <div style={{ padding: '10px 14px', background: '#F5F5F0', borderRadius: 6, fontSize: '.76rem', color: T.textMid }}>
        Clic en ✏ para renombrar una zona · Las notas se guardan en Firestore al presionar "Guardar Cambios"
      </div>
    </div>
  );
}
