// EstadoCuenta.jsx — Estado de cuenta formal imprimible

const C = {
  verde:    '#1B5E20',
  verdeClaro: '#E8F5E9',
  azul:     '#1565C0',
  rojo:     '#C62828',
  naranja:  '#E65100',
  gris1:    '#F5F5F5',
  gris2:    '#EEEEEE',
  borde:    '#BDBDBD',
  texto:    '#212121',
  textoMid: '#616161',
  blanco:   '#FFFFFF',
};

const fmtQ = n => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtFecha = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtFechaLarga = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
const hoyISO = () => new Date().toISOString().split('T')[0];

const TIPO_LABEL = { recepcion: 'RECEPCIÓN', pago: 'PAGO', rechazo: 'RECHAZO' };
const TIPO_BG    = { recepcion: '#E3F2FD', pago: '#E8F5E9', rechazo: '#FFEBEE' };
const TIPO_COLOR = { recepcion: C.azul,    pago: C.verde,   rechazo: C.rojo    };

export default function EstadoCuenta({ proveedor, movimientos, desde, hasta, titulo, onClose }) {
  const hoy = fmtFechaLarga(hoyISO());
  const docNum = `EC-${Date.now().toString().slice(-6)}`;

  const r = movimientos.reduce((acc, m) => {
    if (m.tipo === 'recepcion') acc.comprado += Number(m.totalBruto   || 0);
    if (m.tipo === 'rechazo')   acc.rechazos += Number(m.valorRechazo || 0);
    if (m.tipo === 'pago')      acc.pagado   += Number(m.monto        || 0);
    return acc;
  }, { comprado: 0, rechazos: 0, pagado: 0 });
  r.saldo = r.comprado - r.rechazos - r.pagado;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-page {
            position: static !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            z-index: auto !important;
          }
          body { background: white !important; }
          @page { margin: 15mm 12mm; size: letter; }
        }
        .mov-row:hover { background: #F9FBE7 !important; }
      `}</style>

      {/* Backdrop */}
      <div className="no-print" style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 3000,
      }} />

      {/* Botones flotantes */}
      <div className="no-print" style={{
        position: 'fixed', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 3200,
      }}>
        <button onClick={() => window.print()} style={{
          padding: '9px 20px', borderRadius: 6, border: 'none',
          background: C.verde, color: '#fff', fontWeight: 700,
          fontSize: '13px', cursor: 'pointer', fontFamily: 'Arial, sans-serif',
          boxShadow: '0 2px 8px rgba(0,0,0,.3)',
        }}>
          🖨️ Imprimir / PDF
        </button>
        <button onClick={onClose} style={{
          padding: '9px 16px', borderRadius: 6, border: '1.5px solid #ccc',
          background: '#fff', color: C.textoMid, fontWeight: 600,
          fontSize: '13px', cursor: 'pointer', fontFamily: 'Arial, sans-serif',
          boxShadow: '0 2px 8px rgba(0,0,0,.2)',
        }}>
          ✕ Cerrar
        </button>
      </div>

      {/* Documento */}
      <div className="print-page" style={{
        position: 'fixed', inset: 0, background: '#fff', zIndex: 3100,
        overflowY: 'auto', fontFamily: 'Arial, sans-serif',
        color: C.texto, fontSize: '12px', lineHeight: 1.5,
      }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 40px 48px' }}>

          {/* ══════════ ENCABEZADO ══════════ */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 0 }}>

            {/* Logo + empresa */}
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: 4, color: C.verde, lineHeight: 1 }}>
                AJÚA
              </div>
              <div style={{ fontSize: '11px', color: C.textoMid, marginTop: 3, lineHeight: 1.6 }}>
                AGROINDUSTRIA AJÚA, S.A.<br />
                Guatemala, Guatemala<br />
                agroajua@gmail.com
              </div>
            </div>

            {/* Datos del documento */}
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: '18px', fontWeight: 800, color: C.texto,
                textTransform: 'uppercase', letterSpacing: 1,
              }}>
                Estado de Cuenta
              </div>
              <div style={{ fontSize: '11px', color: C.textoMid, marginTop: 4, lineHeight: 1.8 }}>
                <span style={{ fontWeight: 700 }}>No. </span>{docNum}<br />
                <span style={{ fontWeight: 700 }}>Fecha de emisión: </span>{hoy}<br />
                {titulo && <><span style={{ fontWeight: 700, color: C.naranja }}>Filtro: </span>{titulo}<br /></>}
              </div>
            </div>
          </div>

          {/* Línea verde gruesa */}
          <div style={{ height: 3, background: C.verde, margin: '12px 0' }} />
          <div style={{ height: 1, background: C.gris2, marginBottom: 20 }} />

          {/* ══════════ DATOS PROVEEDOR + PERÍODO ══════════ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

            {/* Proveedor */}
            <div style={{ border: `1px solid ${C.borde}`, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ background: C.gris2, padding: '5px 12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: C.textoMid }}>
                Datos del Proveedor
              </div>
              <div style={{ padding: '10px 12px', lineHeight: 1.8 }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: C.texto }}>{proveedor?.nombre || '—'}</div>
                {proveedor?.nit      && <div style={{ fontSize: '11px', color: C.textoMid }}><b>NIT:</b> {proveedor.nit}</div>}
                {proveedor?.contacto && <div style={{ fontSize: '11px', color: C.textoMid }}><b>Contacto:</b> {proveedor.contacto}</div>}
                {proveedor?.telefono && <div style={{ fontSize: '11px', color: C.textoMid }}><b>Tel:</b> {proveedor.telefono}</div>}
                {proveedor?.email    && <div style={{ fontSize: '11px', color: C.textoMid }}><b>Email:</b> {proveedor.email}</div>}
              </div>
            </div>

            {/* Período */}
            <div style={{ border: `1px solid ${C.borde}`, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ background: C.gris2, padding: '5px 12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: C.textoMid }}>
                Período del Estado de Cuenta
              </div>
              <div style={{ padding: '10px 12px', lineHeight: 1.8 }}>
                <div style={{ fontSize: '11px', color: C.textoMid }}>
                  <b>Desde:</b> {desde ? fmtFechaLarga(desde) : 'Inicio de registros'}
                </div>
                <div style={{ fontSize: '11px', color: C.textoMid }}>
                  <b>Hasta:</b> {hasta ? fmtFechaLarga(hasta) : hoy}
                </div>
                <div style={{ fontSize: '11px', color: C.textoMid, marginTop: 4 }}>
                  <b>Movimientos:</b> {movimientos.length}
                </div>
                <div style={{ fontSize: '11px', color: C.textoMid }}>
                  <b>Moneda:</b> Quetzales (GTQ)
                </div>
              </div>
            </div>
          </div>

          {/* ══════════ RESUMEN FINANCIERO ══════════ */}
          <div style={{ border: `1px solid ${C.borde}`, borderRadius: 4, overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ background: C.verde, padding: '6px 14px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#fff' }}>
              Resumen Financiero
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
              {[
                { label: 'Total Comprado',  val: r.comprado,  bg: '#E3F2FD', color: C.azul,    border: '#90CAF9' },
                { label: 'Notas de Crédito / Rechazos', val: r.rechazos, bg: '#FFEBEE', color: C.rojo, border: '#EF9A9A' },
                { label: 'Total Pagado',    val: r.pagado,    bg: C.verdeClaro, color: C.verde, border: '#A5D6A7' },
                { label: 'Saldo Pendiente', val: r.saldo,     bg: r.saldo > 0 ? '#FFF3E0' : C.verdeClaro, color: r.saldo > 0 ? C.naranja : C.verde, border: r.saldo > 0 ? '#FFCC80' : '#A5D6A7' },
              ].map((c, i) => (
                <div key={i} style={{
                  padding: '12px 14px', background: c.bg,
                  borderRight: i < 3 ? `1px solid ${C.borde}` : 'none',
                  borderTop: `3px solid ${c.border}`,
                }}>
                  <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '.08em', color: C.textoMid, marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: c.color }}>{fmtQ(c.val)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ══════════ TABLA DE MOVIMIENTOS ══════════ */}
          <div style={{ border: `1px solid ${C.borde}`, borderRadius: 4, overflow: 'hidden', marginBottom: 32 }}>
            <div style={{ background: C.gris2, padding: '6px 14px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: C.textoMid, display: 'flex', justifyContent: 'space-between' }}>
              <span>Detalle de Movimientos</span>
              <span style={{ fontWeight: 400 }}>Orden cronológico</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
              <thead>
                <tr style={{ background: C.gris1, borderBottom: `2px solid ${C.verde}` }}>
                  {[
                    { h: 'No.',          w: '36px',  align: 'center' },
                    { h: 'Fecha',        w: '80px',  align: 'left'   },
                    { h: 'Tipo',         w: '90px',  align: 'center' },
                    { h: 'Descripción',  w: 'auto',  align: 'left'   },
                    { h: 'Cant.',        w: '80px',  align: 'right'  },
                    { h: 'Cargo (Q)',    w: '90px',  align: 'right'  },
                    { h: 'Abono (Q)',    w: '90px',  align: 'right'  },
                    { h: 'Saldo (Q)',    w: '90px',  align: 'right'  },
                  ].map(col => (
                    <th key={col.h} style={{
                      padding: '7px 8px', textAlign: col.align, width: col.w,
                      fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '.06em', color: C.textoMid,
                    }}>{col.h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movimientos.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: C.textoMid, fontStyle: 'italic' }}>
                      Sin movimientos en el período seleccionado
                    </td>
                  </tr>
                ) : movimientos.map((m, i) => {
                  const desc = m.descripcion
                    || (m.tipo === 'recepcion' ? m.producto : null)
                    || (m.tipo === 'pago'      ? [m.metodoPago, m.referencia].filter(Boolean).join(' · ') : null)
                    || (m.tipo === 'rechazo'   ? (m.resolucion || m.motivo) : null)
                    || '—';

                  const cantStr = m.tipo === 'recepcion' && m.cantidad
                    ? `${Number(m.cantidad).toLocaleString('es-GT')} ${m.unidad || ''}`.trim()
                    : '—';

                  return (
                    <tr key={m.id} className="mov-row" style={{
                      borderBottom: `1px solid ${C.gris2}`,
                      background: i % 2 === 0 ? C.blanco : C.gris1,
                    }}>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: C.textoMid, fontSize: '10px' }}>
                        {i + 1}
                      </td>
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', color: C.textoMid }}>
                        {fmtFecha(m.fecha)}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 3,
                          fontSize: '9.5px', fontWeight: 700, letterSpacing: '.05em',
                          background: TIPO_BG[m.tipo] || C.gris1,
                          color: TIPO_COLOR[m.tipo] || C.texto,
                          border: `1px solid ${TIPO_COLOR[m.tipo] || C.borde}`,
                        }}>
                          {TIPO_LABEL[m.tipo] || m.tipo}
                        </span>
                      </td>
                      <td style={{ padding: '6px 8px', color: C.texto }}>
                        {desc}
                        {m.numFactura && <span style={{ marginLeft: 6, fontSize: '10px', color: C.textoMid }}>Fact. {m.numFactura}</span>}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: C.textoMid }}>
                        {cantStr}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: m.cargo > 0 ? 700 : 400, color: m.cargo > 0 ? C.azul : C.textoMid }}>
                        {m.cargo > 0 ? fmtQ(m.cargo) : '—'}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: m.abono > 0 ? 700 : 400, color: m.abono > 0 ? C.verde : C.textoMid }}>
                        {m.abono > 0 ? fmtQ(m.abono) : '—'}
                      </td>
                      <td style={{
                        padding: '6px 8px', textAlign: 'right', fontWeight: 700,
                        color: (m.saldoAcum || 0) > 0 ? C.naranja : C.verde,
                      }}>
                        {fmtQ(m.saldoAcum || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `2px solid ${C.verde}`, background: C.gris1 }}>
                  <td colSpan={5} style={{ padding: '8px 10px', fontWeight: 700, fontSize: '11px', color: C.texto }}>
                    TOTALES DEL PERÍODO
                  </td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 800, color: C.azul, fontSize: '12px' }}>
                    {fmtQ(r.comprado)}
                  </td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 800, color: C.verde, fontSize: '12px' }}>
                    {fmtQ(r.pagado + r.rechazos)}
                  </td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 800, color: r.saldo > 0 ? C.naranja : C.verde, fontSize: '12px' }}>
                    {fmtQ(r.saldo)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ══════════ NOTA DE SALDO ══════════ */}
          <div style={{
            border: `1px solid ${r.saldo > 0 ? '#FFCC80' : '#A5D6A7'}`,
            borderLeft: `4px solid ${r.saldo > 0 ? C.naranja : C.verde}`,
            borderRadius: 4, padding: '10px 16px', marginBottom: 40,
            background: r.saldo > 0 ? '#FFF8E1' : C.verdeClaro,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ fontSize: '12px', color: C.texto }}>
              {r.saldo > 0
                ? `Se adeuda al proveedor un saldo pendiente de pago correspondiente al período indicado.`
                : `La cuenta del proveedor se encuentra al día. No existe saldo pendiente.`}
            </div>
            <div style={{ textAlign: 'right', minWidth: 160 }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: C.textoMid, letterSpacing: '.06em' }}>Saldo al {hoy}</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: r.saldo > 0 ? C.naranja : C.verde }}>
                {fmtQ(r.saldo)}
              </div>
            </div>
          </div>

          {/* ══════════ FIRMAS ══════════ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, marginBottom: 32 }}>
            {[
              { label: 'Autorizado por', sub: 'AGROINDUSTRIA AJÚA, S.A.' },
              { label: 'Recibido y Conforme', sub: proveedor?.nombre || 'Proveedor' },
            ].map(f => (
              <div key={f.label} style={{ textAlign: 'center' }}>
                <div style={{ height: 48 }} /> {/* espacio firma */}
                <div style={{ borderTop: `1.5px solid ${C.texto}`, paddingTop: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: '11px', color: C.texto }}>{f.label}</div>
                  <div style={{ fontSize: '10.5px', color: C.textoMid, marginTop: 2 }}>{f.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ══════════ PIE DE PÁGINA ══════════ */}
          <div style={{ borderTop: `1px solid ${C.gris2}`, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '9.5px', color: C.textoMid }}>
              AGROINDUSTRIA AJÚA, S.A. · agroajua@gmail.com · Guatemala
            </div>
            <div style={{ fontSize: '9.5px', color: C.textoMid }}>
              {docNum} · Emitido: {hoy}
            </div>
            <div style={{ fontSize: '9.5px', color: C.textoMid }}>
              Documento generado por sistema interno AJÚA BPM
            </div>
          </div>

          {/* Botones no-print (dentro del doc) */}
          <div className="no-print" style={{ marginTop: 28, display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => window.print()} style={{
              padding: '10px 28px', borderRadius: 6, border: 'none',
              background: C.verde, color: '#fff', fontWeight: 700,
              fontSize: '13px', cursor: 'pointer', fontFamily: 'Arial, sans-serif',
            }}>
              🖨️ Imprimir / Guardar PDF
            </button>
            <button onClick={onClose} style={{
              padding: '10px 20px', borderRadius: 6, border: `1.5px solid ${C.borde}`,
              background: '#fff', color: C.textoMid, fontWeight: 600,
              fontSize: '13px', cursor: 'pointer', fontFamily: 'Arial, sans-serif',
            }}>
              ✕ Cerrar
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
