import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useMovimientosBanco } from './useFinanzas';

const T = { primary:'#1B5E20', danger:'#C62828', warn:'#E65100', border:'#E0E0E0', mid:'#6B6B60', dark:'#1A1A18' };
const WHITE = '#FFFFFF';
const fmtQ  = n => 'Q ' + Number(n||0).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2});

const BANCOS = ['BAM','GYT','INDUSTRIAL'];

// Convierte DD/MM/YYYY, DD/MM/YY, MM/DD/YYYY o YYYY-MM-DD a ISO
function parseDate(raw) {
  const s = String(raw || '').trim();
  // ISO: 2026-04-29 o 2026-04-29 00:00:00
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DD/MM/YYYY o DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  }
  return '';
}

function parseMonto(raw) {
  return parseFloat(String(raw || '').replace(/[Q\s,]/g, '')) || 0;
}

// Filtra movimientos que son transferencias internas a cuenta propia AJÚA
// (BAM/GYT reciben abonos entre cuentas propias — no son gastos)
function esTransferenciaInterna(desc) {
  return /agr[oa][ -]?ind|ajua|ajúa/i.test(desc);
}

// Parser universal: busca fila de encabezados y extrae columnas por nombre
function parseUniversal(rows, banco) {
  // Buscar fila de encabezados buscando "fecha" o "date" en cualquier celda
  let hiIdx = rows.findIndex(r =>
    r.some(c => /^fecha$|^date$/i.test(String(c || '').trim()))
  );
  // Fallback: buscar fila que contenga "fecha" como substring
  if (hiIdx < 0) hiIdx = rows.findIndex(r =>
    r.some(c => /fecha/i.test(String(c || '')))
  );

  if (hiIdx < 0) {
    // Sin encabezado — asumir columnas fijas por banco
    return rows.map(r => ({
      fecha:       parseDate(r[0]),
      descripcion: String(r[1] || '').trim(),
      referencia:  String(r[2] || '').trim(),
      debito:      parseMonto(r[3]),
      credito:     parseMonto(r[4]),
      saldo:       parseMonto(r[5]),
    })).filter(r => r.fecha.match(/^\d{4}-\d{2}-\d{2}$/) && r.debito > 0 && !esTransferenciaInterna(r.descripcion));
  }

  const headers = rows[hiIdx].map(c => String(c || '').toLowerCase().trim());
  const idx = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));
  const fi = idx(['fecha','date']);
  const ni = idx(['desc','concepto','detalle','narr']);
  const ri = idx(['ref','doc','num']);
  const di = idx(['debe','deb','cargo','retiro','salida']);
  const ci = idx(['haber','cred','abono','entrada','deposito','depósito']);
  const si = idx(['saldo','balance']);

  return rows.slice(hiIdx + 1).map(r => ({
    fecha:       parseDate(r[fi > -1 ? fi : 0]),
    descripcion: String(r[ni > -1 ? ni : 1] || '').trim(),
    referencia:  ri > -1 ? String(r[ri] || '').trim() : '',
    debito:      parseMonto(r[di > -1 ? di : 2]),
    credito:     parseMonto(r[ci > -1 ? ci : 3]),
    saldo:       si > -1 ? parseMonto(r[si]) : 0,
  })).filter(r => r.fecha.match(/^\d{4}-\d{2}-\d{2}$/) && r.debito > 0 && !esTransferenciaInterna(r.descripcion));
}

function parseBAM(rows)          { return parseUniversal(rows, 'BAM'); }
function parseAutoDetect(rows)   { return parseUniversal(rows, 'AUTO'); }

// Parsea texto CSV a array de arrays (maneja comillas y comas dentro de campos)
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines.map(line => {
    const fields = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    fields.push(cur.trim());
    return fields;
  }).filter(r => r.some(c => c !== ''));
}

export default function ImportadorBanco({ onImportado }) {
  const [banco,    setBanco]    = useState('BAM');
  const [preview,  setPreview]  = useState(null);  // { movs, archivo }
  const [resultado,setResultado]= useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const fileRef = useRef();
  const { importar } = useMovimientosBanco();

  const handleFile = (file) => {
    if (!file) return;
    setError(''); setResultado(null);

    const isCsv = file.name.toLowerCase().endsWith('.csv');

    const process = (rows) => {
      const movs = banco==='BAM' ? parseBAM(rows) : parseAutoDetect(rows);
      if (!movs.length) {
        const hiIdx = rows.findIndex(r => r.some(c => /fecha/i.test(String(c||''))));
        const sample = rows.slice(0, 10).map((r, i) =>
          `[${i}]${i===hiIdx?' ← HEADER':''} ${r.filter(c=>c!=null&&c!=='').join(' | ')}`
        ).join('\n');
        setError(`No se encontraron movimientos (header en fila ${hiIdx}).\n\n${sample}`);
        return;
      }
      setPreview({ movs: movs.slice(0,200), archivo: file.name });
    };

    const reader = new FileReader();
    if (isCsv) {
      reader.onload = (e) => {
        try {
          // Intentar UTF-8 primero; si hay caracteres raros, el usuario puede recargar
          const rows = parseCSV(e.target.result);
          process(rows);
        } catch(e) { setError('Error leyendo CSV: ' + e.message); }
      };
      reader.readAsText(file, 'latin1');
    } else {
      reader.onload = (e) => {
        try {
          const wb   = XLSX.read(e.target.result, { type:'array', cellDates:true });
          const ws   = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { header:1, raw:false, dateNF:'yyyy-mm-dd' });
          process(rows);
        } catch(e) { setError('Error leyendo el archivo: ' + e.message); }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleImportar = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const movConBanco = preview.movs.map(m => ({ ...m, banco }));
      const res = await importar(movConBanco);
      setResultado(res);
      setPreview(null);
      onImportado?.();
    } catch(e) { setError('Error importando: ' + e.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div style={{ background:'#FFFFFF', borderRadius:10, border:`1px solid ${T.border}`, padding:20, marginBottom:16 }}>
        <div style={{ fontWeight:700, fontSize:'.95rem', color:T.dark, marginBottom:14 }}>🏦 Importar extracto bancario (Excel)</div>

        {/* Selector banco */}
        <div style={{ display:'flex', gap:8, marginBottom:14 }}>
          {BANCOS.map(b => (
            <button key={b} onClick={()=>setBanco(b)}
              style={{ padding:'8px 18px', border:`1.5px solid ${banco===b?T.primary:T.border}`, borderRadius:6, background:banco===b?T.primary:WHITE, color:banco===b?WHITE:T.dark, fontWeight:600, fontSize:'.84rem', cursor:'pointer' }}>
              {b}
            </button>
          ))}
        </div>

        {/* Drop zone */}
        <div
          onClick={()=>fileRef.current?.click()}
          onDragOver={e=>{e.preventDefault();}}
          onDrop={e=>{e.preventDefault();handleFile(e.dataTransfer.files[0]);}}
          style={{ border:`2px dashed ${T.border}`, borderRadius:10, padding:'28px 20px', textAlign:'center', cursor:'pointer', background:'#FAFAFA', marginBottom:12 }}>
          <div style={{ fontSize:'1.6rem', marginBottom:6 }}>📂</div>
          <div style={{ fontSize:'.86rem', color:T.mid }}>Arrastra el archivo Excel aquí o <b>haz clic para seleccionar</b></div>
          <div style={{ fontSize:'.76rem', color:T.mid, marginTop:4 }}>Banco: <b>{banco}</b> · Formato .xlsx / .xls / .csv</div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={e=>handleFile(e.target.files[0])} />
        </div>

        {error && <div style={{ padding:'10px 14px', background:'#FFEBEE', border:`1px solid #FFCDD2`, borderRadius:8, color:T.danger, fontSize:'.82rem', marginBottom:12, whiteSpace:'pre-wrap', fontFamily:'monospace' }}>{error}</div>}

        {resultado && (
          <div style={{ padding:'12px 16px', background:'#E8F5E9', border:`1px solid #A5D6A7`, borderRadius:8, fontSize:'.86rem', color:'#15803d', fontWeight:600 }}>
            ✅ {resultado.importados} movimientos importados · {resultado.duplicados} duplicados omitidos
          </div>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <div style={{ background:WHITE, borderRadius:10, border:`1px solid ${T.border}`, padding:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div>
              <div style={{ fontWeight:700, color:T.dark }}>{preview.movs.length} movimientos detectados</div>
              <div style={{ fontSize:'.78rem', color:T.mid }}>{preview.archivo}</div>
            </div>
            <button onClick={handleImportar} disabled={loading}
              style={{ padding:'10px 22px', background:loading?'#ccc':T.primary, color:WHITE, border:'none', borderRadius:6, fontWeight:700, fontSize:'.88rem', cursor:loading?'not-allowed':'pointer', minHeight:44 }}>
              {loading ? 'Importando…' : `⬆️ Importar ${preview.movs.length} movimientos`}
            </button>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.80rem' }}>
              <thead><tr style={{ background:T.primary, color:WHITE }}>
                {['Fecha','Descripción','Ref.','Débito','Crédito'].map(h=>(
                  <th key={h} style={{ padding:'7px 10px', textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{preview.movs.slice(0,5).map((m,i)=>(
                <tr key={i} style={{ background:i%2===0?WHITE:'#F9F9F9' }}>
                  <td style={{ padding:'6px 10px', whiteSpace:'nowrap' }}>{m.fecha}</td>
                  <td style={{ padding:'6px 10px', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.descripcion}</td>
                  <td style={{ padding:'6px 10px', whiteSpace:'nowrap' }}>{m.referencia}</td>
                  <td style={{ padding:'6px 10px', color:T.danger, textAlign:'right' }}>{m.debito>0?fmtQ(m.debito):''}</td>
                  <td style={{ padding:'6px 10px', color:'#15803d', textAlign:'right' }}>{m.credito>0?fmtQ(m.credito):''}</td>
                </tr>
              ))}
              {preview.movs.length>5&&<tr><td colSpan={5} style={{padding:'6px 10px',color:T.mid,fontSize:'.76rem'}}>… y {preview.movs.length-5} más</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
