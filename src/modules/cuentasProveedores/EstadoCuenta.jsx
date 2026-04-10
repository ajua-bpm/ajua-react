// EstadoCuenta.jsx — Vista imprimible del estado de cuenta de un proveedor

const T = {
  primary: '#1B5E20', danger: '#C62828', warn: '#E65100',
  border: '#E0E0E0', textMid: '#6B6B60', textDark: '#1A1A18',
};

const fmtQ = n => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
const fmtFecha = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const TIPO_LABEL = {
  recepcion: 'Recepción',
  pago:      'Pago',
  rechazo:   'Rechazo',
};

const TIPO_COLOR = {
  recepcion: '#1565C0',
  pago:      '#2E7D32',
  rechazo:   '#C62828',
};

// titulo: descripción corta del filtro aplicado, ej. "REPOLLO · Recepciones" o undefined para total
export default function EstadoCuenta({ proveedor, movimientos, resumen, desde, hasta, titulo, onClose }) {
  const hoy = new Date().toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' });

  // Calcular resumen real a partir de los movimientos recibidos (pueden ser filtrados)
  const resumenReal = movimientos.reduce((acc, m) => {
    if (m.tipo === 'recepcion') acc.comprado  += Number(m.totalBruto   || 0);
    if (m.tipo === 'rechazo')   acc.rechazos  += Number(m.valorRechazo || 0);
    if (m.tipo === 'pago')      acc.pagado    += Number(m.monto        || 0);
    return acc;
  }, { comprado: 0, rechazos: 0, pagado: 0 });
  resumenReal.saldo = resumenReal.comprado - resumenReal.rechazos - resumenReal.pagado;

  return (
    <>
      {/* Estilos de impresión */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-page {
            position: static !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 20px 32px !important;
            box-shadow: none !important;
            z-index: auto !important;
          }
          body { background: white !important; }
        }
      `}</style>

      {/* Backdrop */}
      <div className="no-print" style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 3000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '16px', overflowY: 'auto',
      }}>
        {/* Botones de acción */}
        <div style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 10, zIndex: 3100 }}>
          <button
            onClick={() => window.print()}
            style={{
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: T.primary, color: '#fff', fontWeight: 700,
              fontSize: '.9rem', cursor: 'pointer', fontFamily: 'inherit',
            }}>
            🖨️ Imprimir / PDF
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '9px 16px', borderRadius: 8, border: `1.5px solid ${T.border}`,
              background: '#fff', color: T.textMid, fontWeight: 600,
              fontSize: '.9rem', cursor: 'pointer', fontFamily: 'inherit',
            }}>
            ✕ Cerrar
          </button>
        </div>
      </div>

      {/* Documento imprimible */}
      <div className="print-page" style={{
        position: 'fixed', inset: 0, background: '#fff', zIndex: 3050,
        overflowY: 'auto', padding: '40px 48px', fontFamily: 'Georgia, serif',
        color: T.textDark, fontSize: '13px', lineHeight: 1.6,
      }}>

        {/* Encabezado */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, borderBottom: `3px solid ${T.primary}`, paddingBottom: 16 }}>
          <div>
            <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '1.6rem', fontWeight: 900, letterSpacing: 3, color: T.primary }}>AJÚA</div>
            <div style={{ fontSize: '11px', color: T.textMid, marginTop: 2 }}>AGROINDUSTRIA AJÚA · Guatemala</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: T.textDark }}>
              {titulo ? 'ESTADO DE CUENTA — FILTRADO' : 'ESTADO DE CUENTA'}
            </div>
            {titulo && <div style={{ fontSize: '11px', color: T.warn, fontWeight: 700, marginTop: 2 }}>Filtro: {titulo}</div>}
            <div style={{ fontSize: '11px', color: T.textMid, marginTop: 2 }}>Emitido: {hoy}</div>
            {(desde || hasta) && (
              <div style={{ fontSize: '11px', color: T.textMid }}>
                Período: {desde || '—'} al {hasta || '—'}
              </div>
            )}
          </div>
        </div>

        {/* Datos del proveedor */}
        <div style={{ background: '#F9F9F7', border: `1px solid ${T.border}`, borderRadius: 6, padding: '12px 16px', marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
            <div><span style={{ fontWeight: 700, fontSize: '11px', color: T.textMid, textTransform: 'uppercase', letterSpacing: '.08em' }}>Proveedor: </span>{proveedor?.nombre || '—'}</div>
            {proveedor?.nit     && <div><span style={{ fontWeight: 700, fontSize: '11px', color: T.textMid, textTransform: 'uppercase', letterSpacing: '.08em' }}>NIT: </span>{proveedor.nit}</div>}
            {proveedor?.contacto && <div><span style={{ fontWeight: 700, fontSize: '11px', color: T.textMid, textTransform: 'uppercase', letterSpacing: '.08em' }}>Contacto: </span>{proveedor.contacto}</div>}
            {proveedor?.telefono && <div><span style={{ fontWeight: 700, fontSize: '11px', color: T.textMid, textTransform: 'uppercase', letterSpacing: '.08em' }}>Teléfono: </span>{proveedor.telefono}</div>}
          </div>
        </div>

        {/* Resumen */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Total Comprado',  value: resumenReal.comprado,  color: '#1565C0' },
            { label: 'Rechazos',        value: resumenReal.rechazos,  color: T.danger  },
            { label: 'Total Pagado',    value: resumenReal.pagado,    color: T.primary },
            { label: 'Saldo Pendiente', value: resumenReal.saldo,     color: resumenReal.saldo > 0 ? T.warn : T.primary, bold: true },
          ].map(c => (
            <div key={c.label} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.08em', color: T.textMid, marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontWeight: c.bold ? 800 : 700, fontSize: '1rem', color: c.color, fontFamily: 'Arial, sans-serif' }}>{fmtQ(c.value)}</div>
            </div>
          ))}
        </div>

        {/* Tabla de movimientos */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.1em', color: T.primary, marginBottom: 8 }}>
            Detalle de Movimientos
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#F5F5F5', borderBottom: `2px solid ${T.border}` }}>
                {['Fecha','Tipo','Descripción','Cantidad','Cargo','Abono','Saldo'].map(h => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: h === 'Cargo' || h === 'Abono' || h === 'Saldo' || h === 'Cantidad' ? 'right' : 'left',
                    fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: T.textMid }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movimientos.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: T.textMid }}>Sin movimientos en el período</td></tr>
              ) : movimientos.map((m, i) => {
                const cantStr = m.tipo === 'recepcion' && m.cantidad
                  ? `${m.cantidad} ${m.unidad || ''}`
                  : m.tipo === 'pago' && m.monto
                    ? fmtQ(m.monto)
                    : m.tipo === 'rechazo' && m.valorRechazo
                      ? fmtQ(m.valorRechazo)
                      : '—';
                return (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${T.border}`, background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                    <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{fmtFecha(m.fecha)}</td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ fontWeight: 700, color: TIPO_COLOR[m.tipo] || T.textDark }}>
                        {TIPO_LABEL[m.tipo] || m.tipo}
                      </span>
                    </td>
                    <td style={{ padding: '7px 10px', color: T.textMid }}>
                      {m.descripcion || (m.tipo === 'recepcion' ? m.producto : m.tipo === 'pago' ? `${m.metodoPago} ${m.referencia || ''}`.trim() : m.resolucion) || '—'}
                      {m.fotoUrl && (
                        <a href={m.fotoUrl} target="_blank" rel="noreferrer">
                          <img src={m.fotoUrl} alt="foto"
                            style={{ display: 'block', marginTop: 4, maxWidth: 80, maxHeight: 60,
                              objectFit: 'cover', borderRadius: 4, border: '1px solid #E0E0E0' }} />
                        </a>
                      )}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: T.textDark, fontSize: '11px' }}>
                      {cantStr}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#1565C0', fontWeight: m.cargo > 0 ? 700 : 400 }}>
                      {m.cargo > 0 ? fmtQ(m.cargo) : '—'}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: T.primary, fontWeight: m.abono > 0 ? 700 : 400 }}>
                      {m.abono > 0 ? fmtQ(m.abono) : '—'}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700,
                      color: m.saldoAcum > 0 ? T.warn : T.primary }}>
                      {fmtQ(m.saldoAcum)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${T.primary}`, background: '#F9F9F7' }}>
                <td colSpan={4} style={{ padding: '9px 10px', fontWeight: 700, fontSize: '12px' }}>TOTALES</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 800, color: '#1565C0' }}>{fmtQ(resumenReal.comprado)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 800, color: T.primary }}>{fmtQ(resumenReal.pagado + resumenReal.rechazos)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 800, color: resumenReal.saldo > 0 ? T.warn : T.primary }}>{fmtQ(resumenReal.saldo)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Firmas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, marginTop: 56 }}>
          {['Elaborado por / AJÚA', `Recibido / ${proveedor?.nombre || 'Proveedor'}`].map(label => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ borderTop: `1.5px solid ${T.textDark}`, paddingTop: 8, fontSize: '11px', color: T.textMid }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 40, borderTop: `1px solid ${T.border}`, paddingTop: 12, fontSize: '10px', color: T.textMid, textAlign: 'center' }}>
          AGROINDUSTRIA AJÚA · agroajua@gmail.com · Documento generado el {hoy}
        </div>

        {/* Botones no-print (copia dentro del doc para scroll) */}
        <div className="no-print" style={{ marginTop: 32, display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={() => window.print()} style={{
            padding: '10px 24px', borderRadius: 8, border: 'none',
            background: T.primary, color: '#fff', fontWeight: 700,
            fontSize: '.9rem', cursor: 'pointer', fontFamily: 'Arial, sans-serif',
          }}>
            🖨️ Imprimir / Guardar PDF
          </button>
          <button onClick={onClose} style={{
            padding: '10px 20px', borderRadius: 8, border: `1.5px solid ${T.border}`,
            background: '#fff', color: T.textMid, fontWeight: 600,
            fontSize: '.9rem', cursor: 'pointer', fontFamily: 'Arial, sans-serif',
          }}>
            ✕ Cerrar
          </button>
        </div>
      </div>
    </>
  );
}
