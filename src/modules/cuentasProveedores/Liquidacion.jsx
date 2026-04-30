// Liquidacion.jsx — Liquidación por categoría de recepción (Papa Grande/Mediana/Pequeña)
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, doc, getDoc, addDoc, updateDoc, collection, query, where, onSnapshot } from '../../firebase';

const T = {
  primary: '#1B5E20', secondary: '#2E7D32',
  white: '#FFFFFF', border: '#E0E0E0', bgLight: '#F5F5F5',
  bgGreen: '#E8F5E9', textDark: '#1A1A18', textMid: '#6B6B60',
  danger: '#C62828', warn: '#E65100', blue: '#1565C0',
};

const fmtQ   = n => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtF   = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
const todayS = () => new Date().toISOString().slice(0, 10);

const CATS_PAPA = ['Papa Grande', 'Papa Mediana', 'Papa Pequeña'];
const initCats  = () => CATS_PAPA.map(nombre => ({ nombre, lbs: '', precioUnit: '' }));

const INP = {
  padding: '8px 11px', border: `1.5px solid ${T.border}`, borderRadius: 6,
  fontSize: '.85rem', outline: 'none', fontFamily: 'inherit',
  width: '100%', boxSizing: 'border-box', background: '#fff', color: T.textDark,
};

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '.08em', color: T.secondary, marginBottom: 14, paddingBottom: 10,
      borderBottom: `1px solid ${T.border}` }}>
      {children}
    </div>
  );
}

function card(extra = {}) {
  return { background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10, padding: 20, marginBottom: 16, ...extra };
}

export default function Liquidacion() {
  const { recepcionId } = useParams();
  const navigate = useNavigate();

  const [recepcion,  setRecepcion]  = useState(null);
  const [proveedor,  setProveedor]  = useState(null);
  const [liquidacion, setLiquidacion] = useState(null);
  const [loadingRec, setLoadingRec] = useState(true);

  const [fecha,   setFecha]   = useState(todayS());
  const [cats,    setCats]    = useState(initCats());
  const [pudre,   setPudre]   = useState('');
  const [rechazo, setRechazo] = useState('');
  const [notas,   setNotas]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  // Cargar recepción y proveedor
  useEffect(() => {
    if (!recepcionId) return;
    setLoadingRec(true);
    getDoc(doc(db, 'cuentasProveedores', recepcionId)).then(async snap => {
      if (!snap.exists()) { setLoadingRec(false); return; }
      const data = { id: snap.id, ...snap.data() };
      setRecepcion(data);
      if (data.proveedorId) {
        const pSnap = await getDoc(doc(db, 'proveedores', data.proveedorId));
        if (pSnap.exists()) setProveedor({ id: pSnap.id, ...pSnap.data() });
      }
      setLoadingRec(false);
    }).catch(() => setLoadingRec(false));
  }, [recepcionId]);

  // Escuchar liquidación existente (tiempo real)
  useEffect(() => {
    if (!recepcionId) return;
    const q = query(collection(db, 'liquidacionesProveedores'), where('recepcionId', '==', recepcionId));
    return onSnapshot(q, snap => {
      if (snap.empty) return;
      const liq = { id: snap.docs[0].id, ...snap.docs[0].data() };
      setLiquidacion(liq);
      setFecha(liq.fecha || todayS());
      if (liq.categorias?.length) {
        setCats(liq.categorias.map(c => ({ ...c, lbs: String(c.lbs ?? ''), precioUnit: String(c.precioUnit ?? '') })));
      }
      setPudre(String(liq.pudre ?? ''));
      setRechazo(String(liq.rechazo ?? ''));
      setNotas(liq.notas || '');
    });
  }, [recepcionId]);

  const setcat = useCallback((idx, field, val) =>
    setCats(cs => cs.map((c, i) => i === idx ? { ...c, [field]: val } : c)), []);

  // Cálculos
  const totalRecibido = Number(recepcion?.cantidad || 0);
  const sumCatsLbs    = cats.reduce((s, c) => s + Number(c.lbs || 0), 0);
  const pudreLbs      = Number(pudre   || 0);
  const rechazoLbs    = Number(rechazo || 0);
  const sumTotal      = sumCatsLbs + pudreLbs + rechazoLbs;
  const diff          = totalRecibido - sumTotal;
  const cuadra        = totalRecibido === 0 || Math.abs(diff) < 0.01;
  const totalAPagar   = cats.reduce((s, c) => s + Number(c.lbs || 0) * Number(c.precioUnit || 0), 0);

  const handleSave = async () => {
    if (!recepcion || totalAPagar <= 0) return;
    setSaving(true);
    try {
      const payload = {
        recepcionId,
        proveedorId:           recepcion.proveedorId,
        correlativoRecepcion:  recepcion.correlativo || '',
        productoRecepcion:     recepcion.producto    || '',
        fechaRecepcion:        recepcion.fecha       || '',
        fecha,
        totalRecibido,
        categorias: cats.map(c => ({
          nombre:    c.nombre,
          lbs:       Number(c.lbs       || 0),
          precioUnit: Number(c.precioUnit || 0),
          subtotal:  Number(c.lbs || 0) * Number(c.precioUnit || 0),
        })),
        pudre:       pudreLbs,
        rechazo:     rechazoLbs,
        totalAPagar,
        notas,
      };

      if (liquidacion) {
        await updateDoc(doc(db, 'liquidacionesProveedores', liquidacion.id), {
          ...payload, ultimaEdicion: new Date().toISOString(),
        });
      } else {
        const ref = await addDoc(collection(db, 'liquidacionesProveedores'), {
          ...payload, creadoEn: new Date().toISOString(),
        });
        await updateDoc(doc(db, 'cuentasProveedores', recepcionId), {
          liquidacionId: ref.id,
          totalBruto:    totalAPagar,
          ultimaEdicion: new Date().toISOString(),
        });
      }

      // Actualizar totalBruto en ediciones también
      if (liquidacion) {
        await updateDoc(doc(db, 'cuentasProveedores', recepcionId), {
          totalBruto:    totalAPagar,
          ultimaEdicion: new Date().toISOString(),
        });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('Error al guardar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const html = buildPDF({ recepcion, proveedor, cats, pudreLbs, rechazoLbs, totalAPagar, fecha, notas, sumCatsLbs });
    const w = window.open('', '_blank', 'width=820,height=700');
    if (!w) { alert('Permite ventanas emergentes para imprimir.'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 600);
  };

  if (loadingRec) return (
    <div style={{ padding: 48, textAlign: 'center', color: T.textMid, fontFamily: 'Inter, system-ui, sans-serif' }}>
      Cargando...
    </div>
  );

  if (!recepcion) return (
    <div style={{ padding: 48, textAlign: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ color: T.danger, fontWeight: 700, marginBottom: 16 }}>Recepción no encontrada</div>
      <button onClick={() => navigate('/cuentas-proveedores')}
        style={{ padding: '8px 20px', borderRadius: 6, border: `1px solid ${T.border}`, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
        ← Volver
      </button>
    </div>
  );

  return (
    <div style={{ maxWidth: 760, fontFamily: 'Inter, system-ui, sans-serif', color: T.textDark, paddingBottom: 60 }}>

      {/* Encabezado */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => navigate('/cuentas-proveedores')} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: T.textMid,
          fontSize: '.82rem', padding: '0 0 8px', display: 'flex', alignItems: 'center', gap: 4,
        }}>
          ← Cuentas Proveedores
        </button>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: T.primary, margin: 0 }}>
          Liquidación de Recepción
        </h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, margin: '4px 0 0' }}>
          {proveedor?.nombre || '—'} · {recepcion.producto || 'PAPA'} · {fmtF(recepcion.fecha)}
          {recepcion.correlativo && (
            <span style={{ marginLeft: 8, fontWeight: 700, color: T.blue }}>#{recepcion.correlativo}</span>
          )}
          {liquidacion && (
            <span style={{ marginLeft: 10, background: T.bgGreen, color: T.secondary,
              fontSize: '.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>
              ✓ Liquidado
            </span>
          )}
        </p>
      </div>

      {/* Datos recepción */}
      <div style={{ background: '#E3F2FD', border: '1px solid #90CAF9', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
        <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.blue, marginBottom: 8 }}>
          Datos de la Recepción
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: '4px 20px', fontSize: '.82rem' }}>
          <div><span style={{ color: T.textMid }}>Proveedor: </span><strong>{proveedor?.nombre || '—'}</strong></div>
          <div><span style={{ color: T.textMid }}>Fecha: </span><strong>{fmtF(recepcion.fecha)}</strong></div>
          <div><span style={{ color: T.textMid }}>Producto: </span><strong>{recepcion.producto || '—'}</strong></div>
          <div>
            <span style={{ color: T.textMid }}>Total recibido: </span>
            <strong style={{ color: T.blue }}>{totalRecibido.toLocaleString('es-GT')} {recepcion.unidad || 'lbs'}</strong>
          </div>
        </div>
      </div>

      {/* Fecha liquidación */}
      <div style={card()}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 200 }}>
          <span style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.secondary }}>
            Fecha de liquidación
          </span>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={INP} />
        </label>
      </div>

      {/* Categorías */}
      <div style={card()}>
        <SectionTitle>Desglose por Categoría</SectionTitle>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 110px', gap: '0 12px', marginBottom: 6 }}>
          {['Categoría', 'Libras', 'Precio / lb', 'Subtotal'].map(h => (
            <div key={h} style={{ fontSize: '.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: T.textMid, paddingBottom: 4 }}>{h}</div>
          ))}
        </div>

        {cats.map((c, i) => {
          const sub = Number(c.lbs || 0) * Number(c.precioUnit || 0);
          return (
            <div key={c.nombre} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 110px', gap: '6px 12px', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: '.85rem', fontWeight: 600, color: T.textDark }}>{c.nombre}</div>
              <input type="number" min="0" step="0.1" value={c.lbs}
                onChange={e => setcat(i, 'lbs', e.target.value)}
                placeholder="0" style={{ ...INP, textAlign: 'right' }} />
              <input type="number" min="0" step="0.01" value={c.precioUnit}
                onChange={e => setcat(i, 'precioUnit', e.target.value)}
                placeholder="0.00" style={{ ...INP, textAlign: 'right' }} />
              <div style={{ textAlign: 'right', fontSize: '.85rem', fontWeight: 700, padding: '8px 4px',
                color: sub > 0 ? T.blue : T.textMid }}>
                {sub > 0 ? fmtQ(sub) : '—'}
              </div>
            </div>
          );
        })}

        <div style={{ borderTop: `2px solid ${T.primary}`, marginTop: 8, paddingTop: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '.82rem', color: T.textMid }}>
            Total categorías: <strong style={{ color: T.textDark }}>{sumCatsLbs.toLocaleString('es-GT')} lbs</strong>
          </span>
          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: T.primary }}>{fmtQ(totalAPagar)}</span>
        </div>
      </div>

      {/* Descuentos */}
      <div style={card()}>
        <SectionTitle>Descuentos</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.danger }}>
              Pudre (lbs) — no se devuelve
            </span>
            <input type="number" min="0" step="0.1" value={pudre}
              onChange={e => setPudre(e.target.value)}
              placeholder="0" style={{ ...INP, borderColor: pudreLbs > 0 ? T.danger : T.border }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.warn }}>
              Rechazo (lbs) — se devuelve
            </span>
            <input type="number" min="0" step="0.1" value={rechazo}
              onChange={e => setRechazo(e.target.value)}
              placeholder="0" style={{ ...INP, borderColor: rechazoLbs > 0 ? T.warn : T.border }} />
          </label>
        </div>
      </div>

      {/* Validación cuadre */}
      {totalRecibido > 0 && (
        <div style={{
          background: cuadra ? T.bgGreen : '#FFEBEE',
          border: `1.5px solid ${cuadra ? T.secondary : T.danger}`,
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{ fontSize: '.82rem' }}>
            <strong style={{ color: T.blue }}>{totalRecibido.toLocaleString('es-GT')} lbs</strong>
            <span style={{ color: T.textMid, margin: '0 8px' }}>=</span>
            <span style={{ color: T.textDark }}>
              Cat. {sumCatsLbs.toLocaleString('es-GT')} + Pudre {pudreLbs.toLocaleString('es-GT')} + Rechazo {rechazoLbs.toLocaleString('es-GT')}
              <strong style={{ marginLeft: 6 }}>= {sumTotal.toLocaleString('es-GT')}</strong>
            </span>
          </div>
          {cuadra
            ? <span style={{ fontSize: '.82rem', fontWeight: 700, color: T.secondary }}>✓ Cuadra</span>
            : <span style={{ fontSize: '.82rem', fontWeight: 700, color: T.danger }}>
                {diff > 0 ? `Faltan ${diff.toFixed(1)} lbs` : `Sobran ${Math.abs(diff).toFixed(1)} lbs`}
              </span>
          }
        </div>
      )}

      {/* Notas */}
      <div style={card()}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.secondary }}>
            Notas (opcional)
          </span>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
            placeholder="Observaciones sobre la liquidación..."
            style={{ ...INP, resize: 'vertical', lineHeight: 1.5 }} />
        </label>
      </div>

      {/* Total a pagar */}
      <div style={{
        background: T.primary, borderRadius: 10, padding: '18px 24px', marginBottom: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.7)', marginBottom: 2 }}>
            Total a pagar al proveedor
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{fmtQ(totalAPagar)}</div>
        </div>
        {liquidacion && (
          <span style={{ background: 'rgba(255,255,255,.2)', color: '#fff', padding: '5px 14px', borderRadius: 99, fontSize: '.78rem', fontWeight: 700 }}>
            ✓ Liquidado
          </span>
        )}
      </div>

      {/* Botones */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={handleSave} disabled={saving || totalAPagar <= 0} style={{
          padding: '11px 28px', borderRadius: 6, border: 'none', fontFamily: 'inherit',
          background: saving ? '#BDBDBD' : T.primary, color: '#fff',
          fontWeight: 700, fontSize: '.9rem',
          cursor: saving || totalAPagar <= 0 ? 'not-allowed' : 'pointer',
          opacity: totalAPagar <= 0 ? 0.6 : 1,
        }}>
          {saving ? 'Guardando...' : saved ? '✓ Guardado' : liquidacion ? 'Actualizar Liquidación' : 'Guardar Liquidación'}
        </button>
        <button onClick={handlePrint} disabled={totalAPagar <= 0} style={{
          padding: '11px 24px', borderRadius: 6, border: `1.5px solid ${T.blue}`,
          background: '#fff', color: T.blue, fontWeight: 700, fontSize: '.9rem',
          cursor: totalAPagar <= 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          opacity: totalAPagar <= 0 ? 0.5 : 1,
        }}>
          🖨️ Ver / Imprimir PDF
        </button>
        <button onClick={() => navigate('/cuentas-proveedores')} style={{
          padding: '11px 20px', borderRadius: 6, border: `1px solid ${T.border}`,
          background: '#fff', color: T.textMid, fontWeight: 600, fontSize: '.9rem',
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          ← Volver
        </button>
      </div>
    </div>
  );
}

function buildPDF({ recepcion, proveedor, cats, pudreLbs, rechazoLbs, totalAPagar, fecha, notas, sumCatsLbs }) {
  const fQ  = n => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fFx = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const hoy     = fFx(new Date().toISOString().split('T')[0]);
  const docNum  = `LIQ-${Date.now().toString().slice(-6)}`;
  const totalRec = Number(recepcion?.cantidad || 0);

  const catRows = cats
    .filter(c => Number(c.lbs) > 0)
    .map(c => {
      const sub = Number(c.lbs) * Number(c.precioUnit || 0);
      return `<tr>
        <td style="padding:7px 12px;border-bottom:1px solid #EEE">${c.nombre}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #EEE;text-align:right">${Number(c.lbs).toLocaleString('es-GT')} lbs</td>
        <td style="padding:7px 12px;border-bottom:1px solid #EEE;text-align:right">${fQ(c.precioUnit)}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #EEE;text-align:right;font-weight:700;color:#1565C0">${fQ(sub)}</td>
      </tr>`;
    }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Liquidación — ${proveedor?.nombre || ''}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:12px;color:#212121;background:#fff}
  @page{margin:15mm 12mm;size:letter}
  @media print{.no-print{display:none!important}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  table{border-collapse:collapse;width:100%}
</style>
</head>
<body>
<div style="max-width:720px;margin:0 auto;padding:32px 40px 48px">

  <!-- Encabezado -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <div style="font-size:2rem;font-weight:900;letter-spacing:4px;color:#1B5E20;line-height:1">AJÚA</div>
      <div style="font-size:11px;color:#616161;margin-top:3px;line-height:1.7">
        AGROINDUSTRIA AJÚA, S.A.<br>Guatemala, Guatemala<br>agroajua@gmail.com
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:1px">Liquidación de Compra</div>
      <div style="font-size:11px;color:#616161;margin-top:4px;line-height:1.9">
        <b>No.</b> ${docNum}<br>
        <b>Emisión:</b> ${hoy}<br>
        ${recepcion?.correlativo ? `<b>Recepción:</b> #${recepcion.correlativo}` : ''}
      </div>
    </div>
  </div>

  <div style="height:3px;background:#1B5E20;margin:12px 0 4px"></div>
  <div style="height:1px;background:#EEE;margin-bottom:20px"></div>

  <!-- Proveedor + Recepción -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
    <div style="border:1px solid #BDBDBD;border-radius:4px;overflow:hidden">
      <div style="background:#EEE;padding:5px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#616161">Proveedor</div>
      <div style="padding:10px 12px;line-height:1.9">
        <div style="font-weight:700;font-size:13px">${proveedor?.nombre || '—'}</div>
        ${proveedor?.telefono ? `<div style="font-size:11px;color:#616161"><b>Tel:</b> ${proveedor.telefono}</div>` : ''}
        ${proveedor?.nit      ? `<div style="font-size:11px;color:#616161"><b>NIT:</b> ${proveedor.nit}</div>`      : ''}
      </div>
    </div>
    <div style="border:1px solid #BDBDBD;border-radius:4px;overflow:hidden">
      <div style="background:#EEE;padding:5px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#616161">Recepción</div>
      <div style="padding:10px 12px;line-height:1.9">
        <div style="font-size:11px;color:#616161"><b>Fecha recepción:</b> ${fFx(recepcion?.fecha)}</div>
        <div style="font-size:11px;color:#616161"><b>Fecha liquidación:</b> ${fFx(fecha)}</div>
        <div style="font-size:11px;color:#616161"><b>Producto:</b> ${recepcion?.producto || 'PAPA'}</div>
        <div style="font-size:11px;color:#616161"><b>Total bruto recibido:</b>
          <strong style="color:#1565C0">${totalRec.toLocaleString('es-GT')} lbs</strong>
        </div>
      </div>
    </div>
  </div>

  <!-- Tabla categorías -->
  <div style="border:1px solid #BDBDBD;border-radius:4px;overflow:hidden;margin-bottom:20px">
    <div style="background:#1B5E20;padding:6px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#fff">
      Desglose por Categoría
    </div>
    <table>
      <thead>
        <tr style="background:#F5F5F5;border-bottom:2px solid #1B5E20">
          <th style="padding:7px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#616161">Categoría</th>
          <th style="padding:7px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#616161">Libras</th>
          <th style="padding:7px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#616161">Precio / lb</th>
          <th style="padding:7px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#616161">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${catRows || '<tr><td colspan="4" style="padding:12px;text-align:center;color:#616161;font-style:italic">Sin categorías</td></tr>'}
      </tbody>
      <tfoot>
        <tr style="background:#F5F5F5;border-top:2px solid #1B5E20">
          <td style="padding:8px 12px;font-weight:700">Total Categorías</td>
          <td style="padding:8px 12px;text-align:right;font-weight:700">${sumCatsLbs.toLocaleString('es-GT')} lbs</td>
          <td></td>
          <td style="padding:8px 12px;text-align:right;font-weight:800;color:#1565C0;font-size:13px">${fQ(totalAPagar)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- Descuentos -->
  <div style="border:1px solid #BDBDBD;border-radius:4px;overflow:hidden;margin-bottom:20px">
    <div style="background:#EEE;padding:6px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#616161">
      Descuentos (no cobrados al proveedor)
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr">
      <div style="padding:12px 16px;border-right:1px solid #EEE;border-top:3px solid #BDBDBD;background:#F5F5F5">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#616161;margin-bottom:4px">Total Bruto</div>
        <div style="font-size:15px;font-weight:800;color:#212121">${totalRec.toLocaleString('es-GT')} lbs</div>
      </div>
      <div style="padding:12px 16px;border-right:1px solid #EEE;border-top:3px solid #EF9A9A;background:#FFEBEE">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#616161;margin-bottom:4px">Pudre</div>
        <div style="font-size:15px;font-weight:800;color:#C62828">${pudreLbs.toLocaleString('es-GT')} lbs</div>
      </div>
      <div style="padding:12px 16px;border-right:1px solid #EEE;border-top:3px solid #FFCC80;background:#FFF8E1">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#616161;margin-bottom:4px">Rechazo</div>
        <div style="font-size:15px;font-weight:800;color:#E65100">${rechazoLbs.toLocaleString('es-GT')} lbs</div>
      </div>
      <div style="padding:12px 16px;border-top:3px solid #A5D6A7;background:#E8F5E9">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#616161;margin-bottom:4px">Lbs Reales Pagadas</div>
        <div style="font-size:15px;font-weight:800;color:#1B5E20">${sumCatsLbs.toLocaleString('es-GT')} lbs</div>
      </div>
    </div>
  </div>

  <!-- Total a pagar -->
  <div style="background:#1B5E20;border-radius:8px;padding:18px 24px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:center">
    <div style="color:rgba(255,255,255,.8);font-size:12px;text-transform:uppercase;letter-spacing:.1em">Total a Pagar al Proveedor</div>
    <div style="font-size:28px;font-weight:900;color:#fff">${fQ(totalAPagar)}</div>
  </div>

  ${notas ? `
  <div style="border:1px solid #BDBDBD;border-left:4px solid #1B5E20;border-radius:4px;padding:10px 16px;margin-bottom:28px;background:#F9F9F9">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#616161;margin-bottom:4px">Notas</div>
    <div style="font-size:12px">${notas}</div>
  </div>` : ''}

  <!-- Firmas -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:56px;margin-bottom:20px">
    <div style="text-align:center">
      <div style="height:52px"></div>
      <div style="border-top:1.5px solid #212121;padding-top:8px">
        <div style="font-weight:700;font-size:11px">Recibido por AJÚA</div>
        <div style="font-size:10.5px;color:#616161;margin-top:2px">AGROINDUSTRIA AJÚA, S.A.</div>
      </div>
    </div>
    <div style="text-align:center">
      <div style="height:52px"></div>
      <div style="border-top:1.5px solid #212121;padding-top:8px">
        <div style="font-weight:700;font-size:11px">Entregado por Proveedor</div>
        <div style="font-size:10.5px;color:#616161;margin-top:2px">${proveedor?.nombre || ''}</div>
      </div>
    </div>
  </div>

  <div style="border-top:1px solid #EEE;padding-top:10px;display:flex;justify-content:space-between">
    <div style="font-size:9.5px;color:#616161">AGROINDUSTRIA AJÚA, S.A. · agroajua@gmail.com · Guatemala</div>
    <div style="font-size:9.5px;color:#616161">${docNum} · Sistema AJÚA BPM</div>
  </div>

  <div class="no-print" style="margin-top:24px;text-align:center">
    <button onclick="window.print()" style="padding:10px 28px;border-radius:6px;border:none;background:#1B5E20;color:#fff;font-weight:700;font-size:13px;cursor:pointer;font-family:Arial,sans-serif">
      🖨️ Imprimir / Guardar PDF
    </button>
  </div>

</div>
</body>
</html>`;
}
