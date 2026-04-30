import { useState, useEffect } from 'react';
import { useToast } from '../../../components/Toast';
import { useProveedores } from '../../../hooks/useMainData';

const T = { primary:'#1B5E20', secondary:'#2E7D32', border:'#E0E0E0', white:'#FFFFFF', textMid:'#6B6B60', textDark:'#1A1A18' };
const IS = { padding:'9px 12px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.85rem', fontFamily:'inherit', width:'100%', color:T.textDark, background:T.white, boxSizing:'border-box', marginTop:2 };
const LS = { fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:T.primary };

const empty = (di, cotDuca) => ({
  numeroDuca:      di?.numeroDuca      || cotDuca || '',
  fechaDuca:       di?.fechaDuca       || '',
  factProveedor:   di?.factProveedor   || '',
  factProductor:   di?.factProductor   || '',
  productorId:     di?.productorId     || '',
  productorNombre: di?.productorNombre || '',
  proveedorId:     di?.proveedorId     || '',
  proveedorNombre: di?.proveedorNombre || '',
  aduana:          di?.aduana          || '',
  obs:             di?.obs             || '',
});

export default function PasoDuca({ cot, update }) {
  const toast = useToast();
  const { proveedores } = useProveedores();
  const [f, setF] = useState(() => empty(cot.ducaInfo, cot.duca));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setF(empty(cot.ducaInfo, cot.duca)); }, [cot.id]); // eslint-disable-line

  const autoFillProveedor = (nombre) => {
    const p = proveedores.find(p => (p.nombre||p.razonSocial||'').toLowerCase() === nombre.toLowerCase());
    setF(prev => ({ ...prev, proveedorNombre: nombre, proveedorId: p?.nit || p?.rfc || p?.id || prev.proveedorId }));
  };
  const autoFillProductor = (nombre) => {
    const p = proveedores.find(p => (p.nombre||p.razonSocial||'').toLowerCase() === nombre.toLowerCase());
    setF(prev => ({ ...prev, productorNombre: nombre, productorId: p?.nit || p?.rfc || p?.id || prev.productorId }));
  };

  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    if (!f.numeroDuca.trim()) { toast('Número de DUCA requerido'); return; }
    setSaving(true);
    try {
      const ducaInfo = { ...f, ts: new Date().toISOString() };
      await update({ ducaInfo, estado: 'duca', duca: f.numeroDuca });
      toast('✅ Información DUCA guardada');
    } catch(err) { toast('Error: ' + err.message); }
    finally { setSaving(false); }
  };

  const alreadySaved = !!cot.ducaInfo?.numeroDuca;

  return (
    <div style={{ padding:20, maxWidth:700 }}>
      {/* Datalist para autocomplete */}
      <datalist id="dl-proveedores">
        {proveedores.map((p,i) => <option key={i} value={p.nombre||p.razonSocial} />)}
      </datalist>
      {alreadySaved && (
        <div style={{ marginBottom:16, padding:'8px 14px', background:'rgba(46,125,50,.08)', border:'1px solid rgba(46,125,50,.25)', borderRadius:6, fontSize:'.82rem', color:T.secondary }}>
          ✅ DUCA registrada: <strong>{cot.ducaInfo.numeroDuca}</strong> — {cot.ducaInfo.fechaDuca}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <div>
          <label style={LS}>Número de DUCA *</label>
          <input value={f.numeroDuca} onChange={set('numeroDuca')} style={IS} placeholder="ej: GT-DUA-2026-00123" />
        </div>
        <div>
          <label style={LS}>Fecha DUCA</label>
          <input type="date" value={f.fechaDuca} onChange={set('fechaDuca')} style={IS} />
        </div>
        <div>
          <label style={LS}>Factura proveedor</label>
          <input value={f.factProveedor} onChange={set('factProveedor')} style={IS} placeholder="No. de factura" />
        </div>
        <div>
          <label style={LS}>Factura productor</label>
          <input value={f.factProductor} onChange={set('factProductor')} style={IS} placeholder="No. de factura" />
        </div>
        <div>
          <label style={LS}>Nombre proveedor</label>
          <input value={f.proveedorNombre} list="dl-proveedores"
            onChange={e => autoFillProveedor(e.target.value)}
            style={IS} placeholder="Razón social" />
        </div>
        <div>
          <label style={LS}>RFC / NIT proveedor</label>
          <input value={f.proveedorId} onChange={set('proveedorId')} style={IS} placeholder="RFC / NIT" />
        </div>
        <div>
          <label style={LS}>Nombre productor</label>
          <input value={f.productorNombre} list="dl-proveedores"
            onChange={e => autoFillProductor(e.target.value)}
            style={IS} placeholder="Razón social" />
        </div>
        <div>
          <label style={LS}>RFC / NIT productor</label>
          <input value={f.productorId} onChange={set('productorId')} style={IS} placeholder="RFC / NIT" />
        </div>
        <div>
          <label style={LS}>Aduana</label>
          <input value={f.aduana} onChange={set('aduana')} style={IS} placeholder="ej: Tecún Umán, La Mesilla" />
        </div>
        <div>
          <label style={LS}>Observaciones</label>
          <input value={f.obs} onChange={set('obs')} style={IS} />
        </div>
      </div>

      <div style={{ marginTop:20, display:'flex', gap:10 }}>
        <button onClick={handleSave} disabled={saving}
          style={{ padding:'9px 24px', background:T.primary, color:T.white, border:'none', borderRadius:6, fontWeight:700, fontSize:'.88rem', cursor:'pointer', opacity:saving?.6:1, fontFamily:'inherit' }}>
          {saving ? 'Guardando…' : alreadySaved ? '💾 Actualizar DUCA' : '📄 Guardar DUCA → avanzar a bodega'}
        </button>
      </div>

      {cot.estado === 'duca' && (
        <div style={{ marginTop:10, fontSize:'.78rem', color:T.textMid }}>
          Estado actualizado a <strong>DUCA recibida</strong>. Ve a la pestaña Bodega para confirmar recepción.
        </div>
      )}
    </div>
  );
}
