import { useState, useRef } from 'react';
import { useFacturasFEL } from './useFinanzas';

const T = { primary:'#1B5E20', danger:'#C62828', warn:'#E65100', border:'#E0E0E0', mid:'#6B6B60', dark:'#1A1A18' };
const WHITE  = '#FFFFFF';
const LS_NIT = 'ajua_nit_empresa';
const fmtQ   = n => 'Q ' + Number(n||0).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2});

function attr(el, name) { return el?.getAttribute(name) || ''; }

function parseFEL(xmlText, nitEmpresa) {
  try {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const q   = (sel) => doc.querySelector(sel);

    // UUID — puede estar en SAT:TimbreFiscalDigital o dte:TimbreFiscalDigital
    const timbre = q('TimbreFiscalDigital') || q('[nodeName*="TimbreFiscalDigital"]');
    const uuid   = timbre ? (attr(timbre,'UUID')||attr(timbre,'uuid')) : '';

    // Fecha
    const datosEm = q('DatosEmision') || q('[FechaHoraEmision]');
    const fecha   = (attr(datosEm,'FechaHoraEmision')||'').slice(0,10);

    // Emisor / Receptor
    const emisor   = q('Emisor');
    const receptor = q('Receptor');
    const emisorNIT    = attr(emisor,'NITEmisor')   || attr(emisor,'Nit')   || attr(emisor,'NIT')   || '';
    const emisorNombre = attr(emisor,'NombreEmisor')|| attr(emisor,'Nombre')|| '';
    const receptorNIT  = attr(receptor,'IDReceptor')|| attr(receptor,'Nit') || '';
    const receptorNombre = attr(receptor,'NombreReceptor')||attr(receptor,'Nombre')||'';

    // Totales
    const totales   = q('Totales');
    const montoTotal = parseFloat(attr(totales,'GranTotal').replace(/,/g,''))||0;

    // IVA
    let iva = 0;
    doc.querySelectorAll('Impuesto').forEach(imp => {
      if (/IVA/i.test(attr(imp,'NombreCorto')) || /IVA/i.test(attr(imp,'Nombre'))) {
        iva = parseFloat(attr(imp,'MontoImpuesto').replace(/,/g,''))||0;
      }
    });
    if (!iva) iva = montoTotal / 1.12 * 0.12;

    // Tipo emitida/recibida
    const nitLimpio = (nitEmpresa||'').replace(/[^0-9]/g,'');
    const emisorNITLimpio = emisorNIT.replace(/[^0-9]/g,'');
    const tipoFEL = (nitLimpio && emisorNITLimpio === nitLimpio) ? 'emitida' : 'recibida';

    // IVA retenido: solo si Walmart y emitida
    const esWalmart    = /WALMART|WAL.MART/i.test(receptorNombre + emisorNombre);
    const ivaRetenido  = esWalmart ? iva * 0.80 : 0;
    const notaCredito  = 0; // se puede ajustar manualmente
    const montoNeto    = montoTotal - notaCredito - ivaRetenido;

    if (!uuid || !fecha || !montoTotal) return null;

    return { uuid, fecha, tipoFEL, emisorNIT, emisorNombre, receptorNIT, receptorNombre,
             descripcion: '', montoTotal, iva, ivaRetenido, notaCredito, montoNeto };
  } catch { return null; }
}

export default function ImportadorFEL({ onImportado }) {
  const [nit,      setNit]      = useState(localStorage.getItem(LS_NIT)||'');
  const [facturas, setFacturas] = useState([]);
  const [errores,  setErrores]  = useState([]);
  const [resultado,setResultado]= useState(null);
  const [loading,  setLoading]  = useState(false);
  const fileRef = useRef();
  const { importar } = useFacturasFEL();

  const handleNit = (v) => { setNit(v); localStorage.setItem(LS_NIT, v); };

  const handleFiles = (files) => {
    setResultado(null);
    const nuevas = []; const errs = [];
    Array.from(files).forEach(f => {
      const reader = new FileReader();
      reader.onload = e => {
        const fel = parseFEL(e.target.result, nit);
        if (fel) nuevas.push(fel);
        else errs.push(f.name);
        if (nuevas.length + errs.length === files.length) {
          setFacturas(prev => [...prev, ...nuevas]);
          setErrores(prev => [...prev, ...errs]);
        }
      };
      reader.readAsText(f, 'utf-8');
    });
  };

  const handleImportar = async () => {
    setLoading(true);
    try {
      const res = await importar(facturas);
      setResultado(res); setFacturas([]);
      onImportado?.();
    } catch(e) { alert('Error: ' + e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ marginTop:24 }}>
      <div style={{ background:WHITE, borderRadius:10, border:`1px solid ${T.border}`, padding:20, marginBottom:16 }}>
        <div style={{ fontWeight:700, fontSize:'.95rem', color:T.dark, marginBottom:14 }}>📄 Importar facturas FEL (XML)</div>

        {/* NIT empresa */}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:'.78rem', fontWeight:700, color:T.mid, marginBottom:4, textTransform:'uppercase', letterSpacing:'.05em' }}>NIT de tu empresa (para detectar emitidas)</label>
          <input value={nit} onChange={e=>handleNit(e.target.value)} placeholder="Ej: 12345678-9"
            style={{ padding:'8px 11px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.88rem', width:'100%', maxWidth:220, boxSizing:'border-box' }} />
          <div style={{ fontSize:'.74rem', color:T.mid, marginTop:3 }}>Se guarda localmente en este browser.</div>
        </div>

        {/* Drop zone */}
        <div
          onClick={()=>fileRef.current?.click()}
          onDragOver={e=>e.preventDefault()}
          onDrop={e=>{e.preventDefault();handleFiles(e.dataTransfer.files);}}
          style={{ border:`2px dashed ${T.border}`, borderRadius:10, padding:'28px 20px', textAlign:'center', cursor:'pointer', background:'#FAFAFA', marginBottom:12 }}>
          <div style={{ fontSize:'1.6rem', marginBottom:6 }}>📑</div>
          <div style={{ fontSize:'.86rem', color:T.mid }}>Arrastra uno o varios archivos XML aquí o <b>haz clic</b></div>
          <div style={{ fontSize:'.76rem', color:T.mid, marginTop:4 }}>Formato FEL Guatemala (.xml)</div>
          <input ref={fileRef} type="file" accept=".xml" multiple style={{ display:'none' }} onChange={e=>handleFiles(e.target.files)} />
        </div>

        {errores.length>0 && (
          <div style={{ padding:'8px 12px', background:'#FFF3E0', border:`1px solid #FFB74D`, borderRadius:8, fontSize:'.82rem', color:T.warn, marginBottom:10 }}>
            ⚠️ No se pudo parsear: {errores.join(', ')}
          </div>
        )}
        {resultado && (
          <div style={{ padding:'12px 16px', background:'#E8F5E9', border:`1px solid #A5D6A7`, borderRadius:8, fontSize:'.86rem', color:'#15803d', fontWeight:600 }}>
            ✅ {resultado.importadas} facturas importadas · {resultado.duplicadas} duplicadas omitidas
          </div>
        )}
      </div>

      {/* Preview */}
      {facturas.length > 0 && (
        <div style={{ background:WHITE, borderRadius:10, border:`1px solid ${T.border}`, padding:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontWeight:700, color:T.dark }}>{facturas.length} facturas listas para importar</div>
            <button onClick={handleImportar} disabled={loading}
              style={{ padding:'10px 22px', background:loading?'#ccc':T.primary, color:WHITE, border:'none', borderRadius:6, fontWeight:700, fontSize:'.88rem', cursor:loading?'not-allowed':'pointer', minHeight:44 }}>
              {loading ? 'Importando…' : `⬆️ Importar ${facturas.length}`}
            </button>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.80rem' }}>
              <thead><tr style={{ background:T.primary, color:WHITE }}>
                {['Tipo','Fecha','Emisor','Receptor','Total','IVA Ret.','Neto'].map(h=>(
                  <th key={h} style={{ padding:'7px 10px', textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{facturas.map((f,i)=>(
                <tr key={i} style={{ background:i%2===0?WHITE:'#F9F9F9' }}>
                  <td style={{ padding:'6px 10px' }}><span style={{ padding:'2px 8px', borderRadius:100, fontSize:'.72rem', fontWeight:700, background:f.tipoFEL==='emitida'?'#E8F5E9':'#EEF2FF', color:f.tipoFEL==='emitida'?'#15803d':'#3730a3' }}>{f.tipoFEL}</span></td>
                  <td style={{ padding:'6px 10px', whiteSpace:'nowrap' }}>{f.fecha}</td>
                  <td style={{ padding:'6px 10px', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.emisorNombre||f.emisorNIT}</td>
                  <td style={{ padding:'6px 10px', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.receptorNombre||f.receptorNIT}</td>
                  <td style={{ padding:'6px 10px', textAlign:'right' }}>{fmtQ(f.montoTotal)}</td>
                  <td style={{ padding:'6px 10px', textAlign:'right', color:T.danger }}>{f.ivaRetenido>0?fmtQ(f.ivaRetenido):''}</td>
                  <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:600 }}>{fmtQ(f.montoNeto)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
