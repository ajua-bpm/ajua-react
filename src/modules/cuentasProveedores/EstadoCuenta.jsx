// EstadoCuenta.jsx — Estado de cuenta formal, abre en ventana nueva para imprimir

const C = {
  verde:      '#1B5E20',
  verdeClaro: '#E8F5E9',
  azul:       '#1565C0',
  rojo:       '#C62828',
  naranja:    '#E65100',
  gris1:      '#F5F5F5',
  gris2:      '#EEEEEE',
  borde:      '#BDBDBD',
  texto:      '#212121',
  textoMid:   '#616161',
};

const fmtQ   = n => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtF   = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtFL  = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
const hoyISO = () => new Date().toISOString().split('T')[0];

const TIPO_LABEL = { recepcion: 'RECEPCIÓN', pago: 'PAGO', rechazo: 'RECHAZO' };
const TIPO_BG    = { recepcion: '#E3F2FD',   pago: '#E8F5E9', rechazo: '#FFEBEE' };
const TIPO_FG    = { recepcion: '#1565C0',   pago: '#1B5E20', rechazo: '#C62828' };
const TIPO_BD    = { recepcion: '#90CAF9',   pago: '#A5D6A7', rechazo: '#EF9A9A' };

function calcResumen(movimientos) {
  let comprado = 0, pagado = 0, cargoNeto = 0, abonoOrfanos = 0;
  movimientos.forEach(m => {
    if (m.tipo === 'recepcion') { comprado += Number(m.totalBruto || 0); cargoNeto += m.cargo || 0; }
    if (m.tipo === 'pago')       pagado       += Number(m.monto || 0);
    if (m.tipo === 'rechazo' && !m._isChild) abonoOrfanos += m.abono || 0;
  });
  const rechazos = comprado - cargoNeto + abonoOrfanos;
  const saldo = comprado - rechazos - pagado;
  return { comprado, rechazos, pagado, saldo };
}

/* ─── genera HTML completo para abrir en nueva ventana ─── */
function buildHTML({ proveedor, movimientos, desde, hasta, titulo }) {
  const hoy    = fmtFL(hoyISO());
  const docNum = `EC-${Date.now().toString().slice(-6)}`;
  const r      = calcResumen(movimientos);

  const totalCargo = movimientos.reduce((s, m) => s + (m.cargo || 0), 0);
  const totalAbono = movimientos.reduce((s, m) => s + (m.abono || 0), 0);

  const filas = movimientos.length === 0
    ? `<tr><td colspan="8" style="padding:24px;text-align:center;color:#616161;font-style:italic">Sin movimientos en el período</td></tr>`
    : movimientos.map((m, i) => {
        const desc = m.descripcion
          || (m.tipo === 'recepcion' ? m.producto : null)
          || (m.tipo === 'pago'      ? [m.metodoPago, m.referencia].filter(Boolean).join(' · ') : null)
          || (m.tipo === 'rechazo'   ? (m.resolucion || m.motivo) : null)
          || '—';
        const cant = m.tipo === 'recepcion' && m.cantidad
          ? `${Number(m.cantidad).toLocaleString('es-GT')} ${m.unidad || ''}`.trim()
          : '—';
        const bg   = i % 2 === 0 ? '#fff' : '#F5F5F5';
        const tipoBg = TIPO_BG[m.tipo]  || '#F5F5F5';
        const tipoBd = TIPO_BD[m.tipo]  || '#BDBDBD';
        const tipoFg = TIPO_FG[m.tipo]  || '#212121';
        const cargoColor = m.cargo > 0 ? '#1565C0' : '#616161';
        const abonoColor = m.abono > 0 ? '#1B5E20' : '#616161';
        const saldoColor = (m.saldoAcum || 0) > 0 ? '#E65100' : '#1B5E20';

        return `
          <tr style="background:${bg};border-bottom:1px solid #EEEEEE">
            <td style="padding:6px 8px;text-align:center;color:#616161;font-size:10px">${i + 1}</td>
            <td style="padding:6px 8px;white-space:nowrap;color:#616161">${fmtF(m.fecha)}</td>
            <td style="padding:6px 8px;text-align:center">
              <span style="display:inline-block;padding:2px 8px;border-radius:3px;font-size:9.5px;font-weight:700;letter-spacing:.05em;background:${tipoBg};color:${tipoFg};border:1px solid ${tipoBd}">
                ${TIPO_LABEL[m.tipo] || m.tipo}
              </span>
            </td>
            <td style="padding:6px 8px;color:#212121">${desc}${m.numFactura ? `<span style="margin-left:6px;font-size:10px;color:#616161">Fact. ${m.numFactura}</span>` : ''}</td>
            <td style="padding:6px 8px;text-align:right;color:#616161">${cant}</td>
            <td style="padding:6px 8px;text-align:right;font-weight:${m.cargo > 0 ? 700 : 400};color:${cargoColor}">${m.cargo > 0 ? fmtQ(m.cargo) : '—'}</td>
            <td style="padding:6px 8px;text-align:right;font-weight:${m.abono > 0 ? 700 : 400};color:${abonoColor}">${m.abono > 0 ? fmtQ(m.abono) : '—'}</td>
            <td style="padding:6px 8px;text-align:right;font-weight:700;color:${saldoColor}">${fmtQ(m.saldoAcum || 0)}</td>
          </tr>`;
      }).join('');

  const saldoColor = r.saldo > 0 ? '#E65100' : '#1B5E20';
  const saldoBg    = r.saldo > 0 ? '#FFF8E1'  : '#E8F5E9';
  const saldoBd    = r.saldo > 0 ? '#FFCC80'  : '#A5D6A7';
  const saldoMsg   = r.saldo > 0
    ? 'Se adeuda al proveedor un saldo pendiente de pago correspondiente al período indicado.'
    : 'La cuenta del proveedor se encuentra al día. No existe saldo pendiente.';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Estado de Cuenta — ${proveedor?.nombre || ''}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #212121; background: #fff; }
  @page { margin: 15mm 12mm; size: letter; }
  @media print {
    .no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  table { border-collapse: collapse; width: 100%; }
  th, td { font-size: 11.5px; }
</style>
</head>
<body>
<div style="max-width:820px;margin:0 auto;padding:32px 40px 48px">

  <!-- ENCABEZADO -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0">
    <div>
      <div style="font-size:2rem;font-weight:900;letter-spacing:4px;color:#1B5E20;line-height:1">AJÚA</div>
      <div style="font-size:11px;color:#616161;margin-top:3px;line-height:1.7">
        AGROINDUSTRIA AJÚA, S.A.<br>Guatemala, Guatemala<br>agroajua@gmail.com
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:1px">Estado de Cuenta</div>
      <div style="font-size:11px;color:#616161;margin-top:4px;line-height:1.9">
        <b>No.</b> ${docNum}<br>
        <b>Emisión:</b> ${hoy}<br>
        ${titulo ? `<b style="color:#E65100">Filtro:</b> ${titulo}<br>` : ''}
      </div>
    </div>
  </div>

  <div style="height:3px;background:#1B5E20;margin:12px 0 4px"></div>
  <div style="height:1px;background:#EEEEEE;margin-bottom:20px"></div>

  <!-- DATOS PROVEEDOR + PERÍODO -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
    <div style="border:1px solid #BDBDBD;border-radius:4px;overflow:hidden">
      <div style="background:#EEEEEE;padding:5px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#616161">Datos del Proveedor</div>
      <div style="padding:10px 12px;line-height:1.9">
        <div style="font-weight:700;font-size:13px">${proveedor?.nombre || '—'}</div>
        ${proveedor?.nit      ? `<div style="font-size:11px;color:#616161"><b>NIT:</b> ${proveedor.nit}</div>` : ''}
        ${proveedor?.contacto ? `<div style="font-size:11px;color:#616161"><b>Contacto:</b> ${proveedor.contacto}</div>` : ''}
        ${proveedor?.telefono ? `<div style="font-size:11px;color:#616161"><b>Tel:</b> ${proveedor.telefono}</div>` : ''}
      </div>
    </div>
    <div style="border:1px solid #BDBDBD;border-radius:4px;overflow:hidden">
      <div style="background:#EEEEEE;padding:5px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#616161">Período del Estado de Cuenta</div>
      <div style="padding:10px 12px;line-height:1.9">
        <div style="font-size:11px;color:#616161"><b>Desde:</b> ${desde ? fmtFL(desde) : 'Inicio de registros'}</div>
        <div style="font-size:11px;color:#616161"><b>Hasta:</b> ${hasta ? fmtFL(hasta) : hoy}</div>
        <div style="font-size:11px;color:#616161"><b>Movimientos:</b> ${movimientos.length}</div>
        <div style="font-size:11px;color:#616161"><b>Moneda:</b> Quetzales (GTQ)</div>
      </div>
    </div>
  </div>

  <!-- RESUMEN FINANCIERO -->
  <div style="border:1px solid #BDBDBD;border-radius:4px;overflow:hidden;margin-bottom:24px">
    <div style="background:#1B5E20;padding:6px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#fff">Resumen Financiero</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr)">
      <div style="padding:12px 14px;background:#E3F2FD;border-right:1px solid #BDBDBD;border-top:3px solid #90CAF9">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#616161;margin-bottom:4px">Total Comprado</div>
        <div style="font-size:15px;font-weight:800;color:#1565C0">${fmtQ(r.comprado)}</div>
      </div>
      <div style="padding:12px 14px;background:#FFEBEE;border-right:1px solid #BDBDBD;border-top:3px solid #EF9A9A">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#616161;margin-bottom:4px">Rechazos / Notas</div>
        <div style="font-size:15px;font-weight:800;color:#C62828">${fmtQ(r.rechazos)}</div>
      </div>
      <div style="padding:12px 14px;background:#E8F5E9;border-right:1px solid #BDBDBD;border-top:3px solid #A5D6A7">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#616161;margin-bottom:4px">Total Pagado</div>
        <div style="font-size:15px;font-weight:800;color:#1B5E20">${fmtQ(r.pagado)}</div>
      </div>
      <div style="padding:12px 14px;background:${saldoBg};border-top:3px solid ${saldoBd}">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#616161;margin-bottom:4px">Saldo Pendiente</div>
        <div style="font-size:15px;font-weight:800;color:${saldoColor}">${fmtQ(r.saldo)}</div>
      </div>
    </div>
  </div>

  <!-- TABLA -->
  <div style="border:1px solid #BDBDBD;border-radius:4px;overflow:hidden;margin-bottom:32px">
    <div style="background:#EEEEEE;padding:6px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#616161;display:flex;justify-content:space-between">
      <span>Detalle de Movimientos</span><span style="font-weight:400">Orden cronológico</span>
    </div>
    <table>
      <thead>
        <tr style="background:#F5F5F5;border-bottom:2px solid #1B5E20">
          <th style="padding:7px 8px;text-align:center;width:36px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#616161">No.</th>
          <th style="padding:7px 8px;text-align:left;width:80px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#616161">Fecha</th>
          <th style="padding:7px 8px;text-align:center;width:96px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#616161">Tipo</th>
          <th style="padding:7px 8px;text-align:left;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#616161">Descripción</th>
          <th style="padding:7px 8px;text-align:right;width:80px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#616161">Cant.</th>
          <th style="padding:7px 8px;text-align:right;width:90px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#616161">Cargo (Q)</th>
          <th style="padding:7px 8px;text-align:right;width:90px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#616161">Abono (Q)</th>
          <th style="padding:7px 8px;text-align:right;width:90px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#616161">Saldo (Q)</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
      <tfoot>
        <tr style="border-top:2px solid #1B5E20;background:#F5F5F5">
          <td colspan="5" style="padding:8px 10px;font-weight:700;font-size:11px">TOTALES DEL PERÍODO</td>
          <td style="padding:8px 8px;text-align:right;font-weight:800;color:#1565C0;font-size:12px">${fmtQ(totalCargo)}</td>
          <td style="padding:8px 8px;text-align:right;font-weight:800;color:#1B5E20;font-size:12px">${fmtQ(totalAbono)}</td>
          <td style="padding:8px 8px;text-align:right;font-weight:800;color:${saldoColor};font-size:12px">${fmtQ(r.saldo)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- NOTA SALDO -->
  <div style="border:1px solid ${saldoBd};border-left:4px solid ${saldoColor};border-radius:4px;padding:10px 16px;margin-bottom:40px;background:${saldoBg};display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:12px;color:#212121;max-width:60%">${saldoMsg}</div>
    <div style="text-align:right">
      <div style="font-size:10px;text-transform:uppercase;color:#616161;letter-spacing:.06em">Saldo al ${hoy}</div>
      <div style="font-size:18px;font-weight:900;color:${saldoColor}">${fmtQ(r.saldo)}</div>
    </div>
  </div>

  <!-- FIRMAS -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:56px;margin-bottom:32px">
    <div style="text-align:center">
      <div style="height:52px"></div>
      <div style="border-top:1.5px solid #212121;padding-top:8px">
        <div style="font-weight:700;font-size:11px">Autorizado por</div>
        <div style="font-size:10.5px;color:#616161;margin-top:2px">AGROINDUSTRIA AJÚA, S.A.</div>
      </div>
    </div>
    <div style="text-align:center">
      <div style="height:52px"></div>
      <div style="border-top:1.5px solid #212121;padding-top:8px">
        <div style="font-weight:700;font-size:11px">Recibido y Conforme</div>
        <div style="font-size:10.5px;color:#616161;margin-top:2px">${proveedor?.nombre || 'Proveedor'}</div>
      </div>
    </div>
  </div>

  <!-- PIE -->
  <div style="border-top:1px solid #EEEEEE;padding-top:10px;display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:9.5px;color:#616161">AGROINDUSTRIA AJÚA, S.A. · agroajua@gmail.com · Guatemala</div>
    <div style="font-size:9.5px;color:#616161">${docNum} · Emitido: ${hoy}</div>
    <div style="font-size:9.5px;color:#616161">Sistema AJÚA BPM</div>
  </div>

  <!-- BOTÓN IMPRIMIR (solo pantalla) -->
  <div class="no-print" style="margin-top:28px;text-align:center">
    <button onclick="window.print()" style="padding:10px 28px;border-radius:6px;border:none;background:#1B5E20;color:#fff;font-weight:700;font-size:13px;cursor:pointer;font-family:Arial,sans-serif">
      🖨️ Imprimir / Guardar PDF
    </button>
  </div>

</div>
</body>
</html>`;
}

/* ─── componente React ─── */
export default function EstadoCuenta({ proveedor, movimientos, desde, hasta, titulo, onClose }) {
  const hoy = fmtFL(hoyISO());
  const r   = calcResumen(movimientos);

  function abrirVentana() {
    const html = buildHTML({ proveedor, movimientos, desde, hasta, titulo });
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { alert('Permite ventanas emergentes para imprimir.'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 600);
  }

  /* preview en pantalla (no se usa para imprimir) */
  const saldoColor = r.saldo > 0 ? C.naranja : C.verde;

  return (
    <>
      {/* Backdrop */}
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 3000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '16px', overflowY: 'auto',
      }}>
        {/* Botones top */}
        <div style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 3200 }}>
          <button onClick={abrirVentana} style={{
            padding: '9px 20px', borderRadius: 6, border: 'none',
            background: C.verde, color: '#fff', fontWeight: 700,
            fontSize: '13px', cursor: 'pointer', fontFamily: 'Arial, sans-serif',
            boxShadow: '0 2px 8px rgba(0,0,0,.3)',
          }}>🖨️ Imprimir / PDF</button>
          <button onClick={onClose} style={{
            padding: '9px 16px', borderRadius: 6, border: '1.5px solid #ccc',
            background: '#fff', color: C.textoMid, fontWeight: 600,
            fontSize: '13px', cursor: 'pointer', fontFamily: 'Arial, sans-serif',
            boxShadow: '0 2px 8px rgba(0,0,0,.2)',
          }}>✕ Cerrar</button>
        </div>

        {/* Documento preview */}
        <div style={{
          background: '#fff', borderRadius: 6, width: '100%', maxWidth: 820,
          padding: '32px 40px 48px', fontFamily: 'Arial, sans-serif',
          color: C.texto, fontSize: '12px', lineHeight: 1.5, marginTop: 56,
          boxShadow: '0 8px 40px rgba(0,0,0,.3)',
        }}>

          {/* Encabezado */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: 4, color: C.verde, lineHeight: 1 }}>AJÚA</div>
              <div style={{ fontSize: '11px', color: C.textoMid, marginTop: 3, lineHeight: 1.7 }}>
                AGROINDUSTRIA AJÚA, S.A.<br />Guatemala, Guatemala<br />agroajua@gmail.com
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Estado de Cuenta</div>
              <div style={{ fontSize: '11px', color: C.textoMid, marginTop: 4, lineHeight: 1.9 }}>
                <b>Emisión:</b> {hoy}<br />
                {titulo && <><b style={{ color: C.naranja }}>Filtro:</b> {titulo}<br /></>}
              </div>
            </div>
          </div>
          <div style={{ height: 3, background: C.verde, margin: '12px 0 4px' }} />
          <div style={{ height: 1, background: C.gris2, marginBottom: 20 }} />

          {/* Proveedor + período */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div style={{ border: `1px solid ${C.borde}`, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ background: C.gris2, padding: '5px 12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: C.textoMid }}>Datos del Proveedor</div>
              <div style={{ padding: '10px 12px', lineHeight: 1.9 }}>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>{proveedor?.nombre || '—'}</div>
                {proveedor?.nit      && <div style={{ fontSize: '11px', color: C.textoMid }}><b>NIT:</b> {proveedor.nit}</div>}
                {proveedor?.contacto && <div style={{ fontSize: '11px', color: C.textoMid }}><b>Contacto:</b> {proveedor.contacto}</div>}
                {proveedor?.telefono && <div style={{ fontSize: '11px', color: C.textoMid }}><b>Tel:</b> {proveedor.telefono}</div>}
              </div>
            </div>
            <div style={{ border: `1px solid ${C.borde}`, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ background: C.gris2, padding: '5px 12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: C.textoMid }}>Período</div>
              <div style={{ padding: '10px 12px', lineHeight: 1.9 }}>
                <div style={{ fontSize: '11px', color: C.textoMid }}><b>Desde:</b> {desde ? fmtFL(desde) : 'Inicio de registros'}</div>
                <div style={{ fontSize: '11px', color: C.textoMid }}><b>Hasta:</b> {hasta ? fmtFL(hasta) : hoy}</div>
                <div style={{ fontSize: '11px', color: C.textoMid }}><b>Movimientos:</b> {movimientos.length} · <b>Moneda:</b> GTQ</div>
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { l: 'Total Comprado',  v: r.comprado,  bg: '#E3F2FD', fg: C.azul,    bd: '#90CAF9' },
              { l: 'Rechazos/Notas', v: r.rechazos,  bg: '#FFEBEE', fg: C.rojo,    bd: '#EF9A9A' },
              { l: 'Total Pagado',   v: r.pagado,    bg: C.verdeClaro, fg: C.verde, bd: '#A5D6A7' },
              { l: 'Saldo',          v: r.saldo,     bg: r.saldo > 0 ? '#FFF8E1' : C.verdeClaro, fg: saldoColor, bd: r.saldo > 0 ? '#FFCC80' : '#A5D6A7' },
            ].map(c => (
              <div key={c.l} style={{ border: `1px solid ${c.bd}`, borderTop: `3px solid ${c.bd}`, borderRadius: 4, padding: '10px 12px', background: c.bg }}>
                <div style={{ fontSize: '9px', textTransform: 'uppercase', color: C.textoMid, marginBottom: 4 }}>{c.l}</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: c.fg }}>{fmtQ(c.v)}</div>
              </div>
            ))}
          </div>

          {/* Tabla (preview simplificada) */}
          <div style={{ border: `1px solid ${C.borde}`, borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ background: C.verde, padding: '6px 12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#fff' }}>
              Detalle de Movimientos — {movimientos.length} registros
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: C.gris1, borderBottom: `2px solid ${C.verde}` }}>
                  {['Fecha','Tipo','Descripción','Cargo','Abono','Saldo'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: h==='Cargo'||h==='Abono'||h==='Saldo' ? 'right' : 'left', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', color: C.textoMid }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movimientos.slice(0, 8).map((m, i) => {
                  const desc = m.descripcion || (m.tipo==='recepcion' ? m.producto : m.tipo==='pago' ? m.metodoPago : m.resolucion) || '—';
                  return (
                    <tr key={m.id} style={{ borderBottom: `1px solid ${C.gris2}`, background: i%2===0?'#fff':C.gris1 }}>
                      <td style={{ padding: '5px 8px', color: C.textoMid, whiteSpace: 'nowrap' }}>{fmtF(m.fecha)}</td>
                      <td style={{ padding: '5px 8px' }}>
                        <span style={{ fontSize: '9.5px', fontWeight: 700, color: TIPO_FG[m.tipo] }}>{TIPO_LABEL[m.tipo]||m.tipo}</span>
                      </td>
                      <td style={{ padding: '5px 8px', color: C.texto }}>{desc}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: C.azul, fontWeight: m.cargo>0?700:400 }}>{m.cargo>0?fmtQ(m.cargo):'—'}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: C.verde, fontWeight: m.abono>0?700:400 }}>{m.abono>0?fmtQ(m.abono):'—'}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: (m.saldoAcum||0)>0?C.naranja:C.verde }}>{fmtQ(m.saldoAcum||0)}</td>
                    </tr>
                  );
                })}
                {movimientos.length > 8 && (
                  <tr><td colSpan={6} style={{ padding: '8px', textAlign: 'center', color: C.textoMid, fontStyle: 'italic', fontSize: '11px' }}>
                    ... y {movimientos.length - 8} movimientos más (ver documento completo)
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ textAlign: 'center', color: C.textoMid, fontSize: '11px', marginBottom: 20 }}>
            El documento completo con firmas y formato formal se abre al hacer clic en <b>Imprimir / PDF</b>
          </div>

          {/* Botones bottom */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={abrirVentana} style={{
              padding: '10px 28px', borderRadius: 6, border: 'none',
              background: C.verde, color: '#fff', fontWeight: 700,
              fontSize: '13px', cursor: 'pointer', fontFamily: 'Arial, sans-serif',
            }}>🖨️ Imprimir / Guardar PDF</button>
            <button onClick={onClose} style={{
              padding: '10px 20px', borderRadius: 6, border: `1.5px solid ${C.borde}`,
              background: '#fff', color: C.textoMid, fontWeight: 600,
              fontSize: '13px', cursor: 'pointer', fontFamily: 'Arial, sans-serif',
            }}>✕ Cerrar</button>
          </div>
        </div>
      </div>
    </>
  );
}
