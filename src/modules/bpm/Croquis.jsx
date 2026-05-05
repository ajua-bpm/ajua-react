import { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { db, doc, getDoc, setDoc } from '../../firebase';
import { useToast } from '../../components/Toast';

const CW = 580;
const CH = 495;

const T = { primary:'#1B5E20', border:'#E0E0E0', textMid:'#6B6B60', textDark:'#1A1A18' };

const PALETTE = [
  '#FFCC80','#FFE082','#FFF176','#A5D6A7','#66BB6A','#80DEEA',
  '#90CAF9','#BBDEFB','#CE93D8','#F48FB1','#D7CCC8','#BDBDBD',
  '#CFD8DC','#B0BEC5','#9E9E9E','#EFEBE9',
];

const INITIAL_ZONES = [
  { id:'bodega',   label:'BODEGA',             sub:'almacén general',             color:'#FFCC80', x:5,   y:5,   w:210, h:100, notes:'' },
  { id:'banos',    label:'BAÑOS',              sub:'',                            color:'#D7CCC8', x:5,   y:107, w:145, h:85,  notes:'' },
  { id:'lavamanos',label:'LAVAMANOS',           sub:'',                            color:'#EFEBE9', x:152, y:107, w:64,  h:58,  notes:'' },
  { id:'oficina',  label:'OFICINA RSG',         sub:'registros',                   color:'#FFE082', x:5,   y:194, w:145, h:93,  notes:'' },
  { id:'gradas2',  label:'GRADAS',              sub:'2do nivel',                   color:'#BDBDBD', x:5,   y:289, w:145, h:65,  notes:'' },
  { id:'pasillo',  label:'PASILLO',             sub:'',                            color:'#9E9E9E', x:152, y:167, w:26,  h:292, notes:'' },
  { id:'cooler2',  label:'COOLER 2',            sub:'-18°C congelación',           color:'#80DEEA', x:223, y:5,   w:305, h:78,  notes:'' },
  { id:'cooler1',  label:'COOLER 1',            sub:'0-4°C refrigeración',         color:'#FFF176', x:310, y:85,  w:165, h:80,  notes:'' },
  { id:'acceso',   label:'acceso ext.',         sub:'',                            color:'#A5D6A7', x:477, y:85,  w:52,  h:80,  notes:'' },
  { id:'trabajo',  label:'TRABAJO / PRE-CARGA', sub:'cebolla y pepe',              color:'#90CAF9', x:223, y:167, w:254, h:145, notes:'' },
  { id:'parqueo',  label:'PARQUEO INTERIOR',    sub:'camiones yendo al portón 1',  color:'#BBDEFB', x:178, y:314, w:297, h:145, notes:'' },
  { id:'pallets',  label:'PALLETS',             sub:'tarimas',                     color:'#B0BEC5', x:477, y:314, w:78,  h:97,  notes:'' },
  { id:'gradas_p', label:'GRADAS',              sub:'PLANTA ELÉC.',                color:'#CFD8DC', x:477, y:413, w:78,  h:46,  notes:'' },
  { id:'porton',   label:'PORTÓN DE INGRESO',   sub:'',                            color:'#66BB6A', x:178, y:461, w:374, h:28,  notes:'' },
];

const INITIAL_TRAPS = [
  { id:'t1',  num:1,  label:'Portón izq.',       x:181, y:453 },
  { id:'t2',  num:2,  label:'Portón der.',        x:548, y:453 },
  { id:'t3',  num:3,  label:'Parqueo sup-izq',    x:181, y:306 },
  { id:'t4',  num:4,  label:'Parqueo sup-der',    x:470, y:406 },
  { id:'t5',  num:5,  label:'Pre-carga sup-izq',  x:225, y:159 },
  { id:'t6',  num:6,  label:'Pre-carga sup-der',  x:470, y:159 },
  { id:'t7',  num:7,  label:'Pre-carga inf-izq',  x:225, y:306 },
  { id:'t8',  num:8,  label:'Pre-carga inf-der',  x:470, y:306 },
  { id:'t9',  num:9,  label:'Bodega esq. sup',    x:220, y:3   },
  { id:'t10', num:10, label:'Bodega esq. inf',    x:152, y:159 },
  { id:'t11', num:11, label:'Zona pallets',        x:529, y:3   },
];

const PRESET_AREAS = [
  { label:'Área de zapatos',      color:'#FFE0B2' },
  { label:'Basureros',            color:'#EFEBE9' },
  { label:'Lavado de papas',      color:'#E0F2F1' },
  { label:'Guardado de cajillas', color:'#FFF9C4' },
];

const uid = () => Math.random().toString(36).slice(2, 9);
const sanitize = z => ({ sub:'', notes:'', ...z, x:Number(z.x)||0, y:Number(z.y)||0, w:Number(z.w)||100, h:Number(z.h)||60, color:z.color||'#F5F5F5' });

export default function Croquis() {
  const toast = useToast();
  const [zones,      setZones]      = useState(INITIAL_ZONES);
  const [traps,      setTraps]      = useState(INITIAL_TRAPS);
  const [selectedId, setSelectedId] = useState(null);
  const [mode,       setMode]       = useState('select');
  const [saving,     setSaving]     = useState(false);
  const [printing,   setPrinting]   = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [customArea, setCustomArea] = useState('');
  const dragRef   = useRef(null);
  const canvasRef = useRef(null);

  // ── Load ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'ajua_bpm', 'croquis_bodega'));
        if (snap.exists()) {
          const d = snap.data();
          if (d.zones?.length) setZones(d.zones.map(sanitize));
          if (d.traps?.length) setTraps(d.traps);
        }
      } catch(e) { console.warn('Croquis:', e.message); }
      setLoading(false);
    })();
  }, []);

  // ── Global drag listeners ─────────────────────────────────────
  useEffect(() => {
    const onMove = (e) => {
      const dr = dragRef.current;
      if (!dr) return;
      const dx = e.clientX - dr.startX;
      const dy = e.clientY - dr.startY;
      if (dr.type === 'zone') {
        setZones(prev => prev.map(z => z.id !== dr.id ? z : {
          ...z,
          x: Math.max(0, Math.min(CW - z.w, dr.origX + dx)),
          y: Math.max(0, Math.min(CH - z.h, dr.origY + dy)),
        }));
      } else {
        setTraps(prev => prev.map(t => t.id !== dr.id ? t : {
          ...t,
          x: Math.max(8, Math.min(CW - 8, dr.origX + dx)),
          y: Math.max(8, Math.min(CH - 8, dr.origY + dy)),
        }));
      }
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, []);

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'ajua_bpm', 'croquis_bodega'), { zones, traps, updatedAt: new Date().toISOString() });
      toast('✓ Croquis guardado');
    } catch(e) { toast('Error: ' + e.message, 'error'); }
    setSaving(false);
  };

  // ── Print — captura solo el canvas y lo imprime via CSS print ──
  const handlePrint = async () => {
    if (!canvasRef.current) return;
    setPrinting(true);
    try {
      const c = await html2canvas(canvasRef.current, { backgroundColor:'#EDE9E3', scale:2, useCORS:true });
      const imgSrc = c.toDataURL('image/png');

      // CSS: oculta toda la página, muestra solo la imagen del croquis
      const styleEl = document.createElement('style');
      styleEl.textContent = `@media print{body{visibility:hidden}#__cqp{visibility:visible;position:fixed;top:0;left:0;width:100%;height:auto}}`;
      document.head.appendChild(styleEl);

      const imgEl = document.createElement('img');
      imgEl.id = '__cqp';
      imgEl.src = imgSrc;
      document.body.appendChild(imgEl);

      window.print();

      setTimeout(() => { styleEl.remove(); imgEl.remove(); }, 2000);
    } catch(e) { toast('Error: ' + e.message, 'error'); }
    setPrinting(false);
  };

  const handleReset = () => {
    if (!window.confirm('¿Restaurar el plano original? Se perderán los cambios no guardados.')) return;
    setZones(INITIAL_ZONES); setTraps(INITIAL_TRAPS); setSelectedId(null);
  };

  // ── Mouse down on zone / trap ─────────────────────────────────
  const onZoneDown = (e, id) => {
    if (mode === 'traps') return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);
    const z = zones.find(z => z.id === id);
    dragRef.current = { type:'zone', id, startX:e.clientX, startY:e.clientY, origX:z.x, origY:z.y };
  };

  const onTrapDown = (e, id) => {
    if (mode !== 'traps') return;
    e.preventDefault();
    e.stopPropagation();
    const t = traps.find(t => t.id === id);
    dragRef.current = { type:'trap', id, startX:e.clientX, startY:e.clientY, origX:t.x, origY:t.y };
  };

  // ── Zone helpers ──────────────────────────────────────────────
  const updZ  = (field, val) => setZones(prev => prev.map(z => z.id !== selectedId ? z : { ...z, [field]: val }));
  const nudge = (field, d)   => setZones(prev => prev.map(z => z.id !== selectedId ? z : { ...z, [field]: Math.max(0, (z[field]||0)+d) }));
  const addArea = (label, color) => setZones(prev => [...prev, sanitize({ id:uid(), label, sub:'', color, x:CW/2-60, y:CH/2-30, w:120, h:60, notes:'' })]);
  const deleteZone = () => { if (!selectedId || !window.confirm('¿Eliminar zona?')) return; setZones(p=>p.filter(z=>z.id!==selectedId)); setSelectedId(null); };

  const sel = zones.find(z => z.id === selectedId);

  if (loading) return <div style={{ padding:60, textAlign:'center', color:T.textMid }}>Cargando…</div>;

  return (
    <div style={{ fontFamily:'inherit', display:'flex', gap:14, alignItems:'flex-start' }}>

      {/* ── LEFT PANEL ── */}
      <div style={{ width:168, flexShrink:0, display:'flex', flexDirection:'column', gap:11 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:'1.05rem', color:T.primary }}>Croquis de Bodega</div>
          <div style={{ fontSize:'.7rem', color:T.textMid, marginTop:2 }}>Editor visual interactivo</div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <button onClick={() => setMode(m => m==='traps'?'select':'traps')}
            style={{ ...btn, background:mode==='traps'?T.primary:'#F5F5F5', color:mode==='traps'?'#fff':'#333', border:`1.5px solid ${mode==='traps'?T.primary:'#ccc'}` }}>
            🎯 {mode==='traps' ? 'Modo trampas ON' : 'Mover trampas'}
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ ...btn, background:saving?'#ccc':T.primary, color:'#fff', border:'none' }}>
            {saving ? 'Guardando…' : '💾 Guardar'}
          </button>
          <button onClick={handlePrint} disabled={printing}
            style={{ ...btn, background:'#F5F5F5', color:'#333', border:'1.5px solid #ddd' }}>
            {printing ? 'Generando…' : '🖨️ Imprimir / PDF'}
          </button>
          <button onClick={handleReset}
            style={{ ...btn, background:'none', color:'#999', border:'1px solid #e0e0e0', fontSize:'.71rem' }}>
            ↩ Restaurar plano
          </button>
        </div>

        {/* Predefined areas */}
        <div>
          <div style={sectionTitle}>Áreas predefinidas</div>
          {PRESET_AREAS.map(p => (
            <button key={p.label} onClick={() => addArea(p.label, p.color)}
              style={{ display:'block', width:'100%', textAlign:'left', padding:'5px 8px', marginBottom:3,
                background:p.color, border:'1.5px solid rgba(0,0,0,.15)', borderRadius:5,
                fontSize:'.73rem', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
              + {p.label}
            </button>
          ))}
          <div style={{ display:'flex', gap:4, marginTop:4 }}>
            <input value={customArea} onChange={e=>setCustomArea(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter'&&customArea.trim()){ addArea(customArea.trim(),'#F5F5F5'); setCustomArea(''); }}}
              placeholder="Área personalizada…"
              style={{ flex:1, padding:'5px 7px', fontSize:'.72rem', border:'1.5px solid #ddd', borderRadius:5, outline:'none', fontFamily:'inherit' }}/>
            <button onClick={()=>{ if(customArea.trim()){ addArea(customArea.trim(),'#F5F5F5'); setCustomArea(''); }}}
              style={{ padding:'5px 9px', background:T.primary, color:'#fff', border:'none', borderRadius:5, cursor:'pointer', fontWeight:700 }}>+</button>
          </div>
        </div>

        {/* Traps list */}
        <div>
          <div style={sectionTitle}>Trampas ({traps.length})</div>
          <div style={{ maxHeight:190, overflowY:'auto' }}>
            {traps.map(t => (
              <div key={t.id} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                <div style={{ width:19, height:19, borderRadius:'50%', background:'#C62828', border:'2px solid #fff',
                  boxShadow:'0 1px 3px rgba(0,0,0,.35)', display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#fff', fontSize:'.59rem', fontWeight:900, flexShrink:0 }}>{t.num}</div>
                <span style={{ fontSize:'.72rem', color:T.textMid, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.label}</span>
              </div>
            ))}
          </div>
          {mode==='traps' && <div style={{ fontSize:'.67rem', color:T.primary, fontWeight:600, marginTop:4, lineHeight:1.4 }}>Arrastrá los círculos rojos en el plano.</div>}
        </div>
      </div>

      {/* ── CANVAS ── */}
      <div style={{ flexShrink:0 }}>
        <div ref={canvasRef}
          style={{ position:'relative', width:CW, height:CH, background:'#EDE9E3',
            border:'2px solid #aaa', overflow:'hidden', userSelect:'none',
            boxShadow:'0 2px 10px rgba(0,0,0,.18)', cursor:'default' }}
          onClick={e=>{ if(e.target===e.currentTarget) setSelectedId(null); }}>

          {zones.map(z => (
            <div key={z.id} onMouseDown={e=>onZoneDown(e,z.id)}
              style={{ position:'absolute', left:z.x, top:z.y, width:z.w, height:z.h,
                background:z.color,
                border:`2px solid ${z.id===selectedId?'#111':'rgba(0,0,0,.26)'}`,
                outline: z.id===selectedId?'2px solid rgba(0,0,0,.4)':undefined,
                borderRadius:3, boxSizing:'border-box', overflow:'hidden',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                padding:'3px 4px', cursor:mode==='traps'?'default':'move' }}>
              <div style={{ fontSize:'.64rem', fontWeight:800, textAlign:'center', lineHeight:1.2,
                color:'rgba(0,0,0,.75)', pointerEvents:'none', wordBreak:'break-word' }}>{z.label}</div>
              {z.sub && <div style={{ fontSize:'.52rem', textAlign:'center', color:'rgba(0,0,0,.5)',
                lineHeight:1.2, marginTop:1, pointerEvents:'none' }}>{z.sub}</div>}
            </div>
          ))}

          {traps.map(t => (
            <div key={t.id} onMouseDown={e=>onTrapDown(e,t.id)} title={`#${t.num} — ${t.label}`}
              style={{ position:'absolute', left:t.x-11, top:t.y-11, width:22, height:22,
                borderRadius:'50%', background:'#C62828', border:'2.5px solid #fff',
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'#fff', fontSize:'.6rem', fontWeight:900, zIndex:20,
                boxShadow:'0 1px 5px rgba(0,0,0,.5)',
                cursor:mode==='traps'?'grab':'default',
                pointerEvents:mode==='traps'?'auto':'none', userSelect:'none' }}>
              {t.num}
            </div>
          ))}
        </div>

        <div style={{ marginTop:6, fontSize:'.67rem', color:T.textMid }}>
          {mode==='traps'
            ? '🎯 Modo trampas — arrastrá los marcadores · Guardá al terminar'
            : 'Clic para seleccionar zona · Arrastrá para mover · Panel derecho para editar'}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{ width:215, flexShrink:0 }}>
        {sel ? (
          <div style={{ background:'#fff', border:'1.5px solid #e0e0e0', borderRadius:8, padding:14 }}>
            <div style={{ fontWeight:700, fontSize:'.78rem', color:T.primary, marginBottom:10, textTransform:'uppercase', letterSpacing:'.04em' }}>
              Propiedades
            </div>

            <label style={lbl}>Nombre
              <input value={sel.label} onChange={e=>updZ('label',e.target.value)} style={inp}/>
            </label>
            <label style={lbl}>Subtítulo
              <input value={sel.sub} onChange={e=>updZ('sub',e.target.value)} placeholder="Descripción…" style={inp}/>
            </label>

            <div style={{ fontSize:'.67rem', fontWeight:700, textTransform:'uppercase', color:T.textMid, marginBottom:5 }}>Color</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:3, marginBottom:10 }}>
              {PALETTE.map(c=>(
                <div key={c} onClick={()=>updZ('color',c)}
                  style={{ width:20, height:20, background:c, borderRadius:3, cursor:'pointer',
                    border:`2px solid ${c===sel.color?'#111':'rgba(0,0,0,.18)'}`, boxSizing:'border-box' }}/>
              ))}
            </div>

            <div style={{ fontSize:'.67rem', fontWeight:700, textTransform:'uppercase', color:T.textMid, marginBottom:6 }}>Tamaño y posición</div>
            {[['Ancho','w'],['Alto','h'],['Pos. X','x'],['Pos. Y','y']].map(([label,f])=>(
              <div key={f} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                <span style={{ fontSize:'.72rem', color:T.textMid, width:42 }}>{label}</span>
                <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                  <button onClick={()=>nudge(f,-5)} style={nBtn}>−</button>
                  <input type="number" value={sel[f]}
                    onChange={e=>updZ(f,Number(e.target.value))}
                    style={{ width:50, padding:'3px 5px', border:'1.5px solid #ddd', borderRadius:4, fontSize:'.76rem', textAlign:'center', outline:'none', fontFamily:'inherit' }}/>
                  <button onClick={()=>nudge(f,5)} style={nBtn}>+</button>
                  <span style={{ fontSize:'.65rem', color:T.textMid }}>px</span>
                </div>
              </div>
            ))}

            <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid #f0f0f0' }}>
              <div style={{ fontSize:'.67rem', fontWeight:700, textTransform:'uppercase', color:T.textMid, marginBottom:5 }}>📋 Notas BPM</div>
              <textarea value={sel.notes} onChange={e=>updZ('notes',e.target.value)}
                rows={3} placeholder="Instrucciones, controles…"
                style={{ width:'100%', padding:'6px 8px', border:'1.5px solid #ddd', borderRadius:5,
                  fontSize:'.75rem', fontFamily:'inherit', outline:'none', resize:'vertical', boxSizing:'border-box' }}/>
            </div>

            <button onClick={deleteZone}
              style={{ marginTop:10, width:'100%', padding:'7px', background:'none',
                border:'1.5px solid #C62828', color:'#C62828', borderRadius:5,
                cursor:'pointer', fontWeight:700, fontSize:'.75rem', fontFamily:'inherit' }}>
              🗑 Eliminar zona
            </button>
          </div>
        ) : (
          <div style={{ padding:16, background:'#fafafa', border:'1.5px solid #e0e0e0', borderRadius:8, fontSize:'.77rem', color:T.textMid, lineHeight:1.7 }}>
            <div style={{ fontWeight:700, color:T.primary, marginBottom:8 }}>Instrucciones</div>
            <p style={{ margin:'0 0 5px' }}>• <b>Clic</b> en zona para seleccionar.</p>
            <p style={{ margin:'0 0 5px' }}>• <b>Arrastrar</b> zona para moverla.</p>
            <p style={{ margin:'0 0 5px' }}>• <b>Mover trampas</b> para reubicar los marcadores rojos.</p>
            <p style={{ margin:'0 0 5px' }}>• Panel izquierdo para agregar nuevas áreas.</p>
            <p style={{ margin:0 }}>• <b>Guardar</b> persiste los cambios.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared micro-styles ───────────────────────────────────────────
const btn = { padding:'7px 10px', fontWeight:700, fontSize:'.75rem', cursor:'pointer', fontFamily:'inherit', borderRadius:6 };
const sectionTitle = { fontSize:'.67rem', fontWeight:700, textTransform:'uppercase', color:'#6B6B60', letterSpacing:'.06em', marginBottom:5 };
const lbl = { fontSize:'.67rem', fontWeight:700, textTransform:'uppercase', color:'#6B6B60', display:'flex', flexDirection:'column', gap:3, marginBottom:8 };
const inp = { padding:'6px 8px', border:'1.5px solid #ddd', borderRadius:5, fontSize:'.79rem', outline:'none', fontFamily:'inherit', color:'#1A1A18' };
const nBtn = { width:22, height:22, border:'1px solid #ddd', borderRadius:4, background:'#f5f5f5', cursor:'pointer', fontWeight:700, fontSize:'.82rem', padding:0 };
