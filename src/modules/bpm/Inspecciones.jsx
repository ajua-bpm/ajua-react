import { useState, useMemo, Fragment } from 'react';
import { useEmpleados } from '../../hooks/useMainData';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

const T = {
  primary: '#1B5E20', secondary: '#2E7D32', accent: '#43A047',
  white: '#FFFFFF', bgLight: '#F5F5F5', border: '#E0E0E0',
  textDark: '#1A1A18', textMid: '#6B6B60',
  danger: '#C62828', warn: '#E65100', warnBg: '#FFF3E0',
  green2: '#E8F5E9', redBg: '#FFEBEE',
};

const SEV = {
  P:  { label: 'Prioritaria', color: T.danger, bg: T.redBg,  weight: 10 },
  MA: { label: 'Mayor',       color: T.warn,   bg: T.warnBg, weight: 5  },
  m:  { label: 'Menor',       color: T.textMid, bg: T.bgLight, weight: 1 },
};

const CHECKLIST = [
  { cat: 'General', items: [
    { txt: 'Un programa de Seguridad de los Alimentos basado en buenas prácticas agrícolas ha sido implementado en el sitio.', sev: 'm' },
    { txt: 'Su empresa cuenta con certificados o informes GFSI (Global GAP, Primus GFS) / Auditorías relacionadas a Buenas Prácticas Agrícolas. Describa el programa. ¿Qué tipo de auditoría tiene?', sev: 'MA' },
    { txt: 'La operación o planta ha designado alguien para implementar y mantener el programa de seguridad de los alimentos establecido.', sev: 'm' },
  ]},
  { cat: 'Seguridad de Empleados y Procedimientos de Visitas', items: [
    { txt: 'Hay un control de ingreso de visitas y el propósito de los visitantes es verificado antes de admitirlos en la instalación.', sev: 'MA' },
    { txt: 'Se cuenta con rotulación referente a las buenas Prácticas de acatamiento en las áreas de producción para visitantes.', sev: 'm' },
    { txt: 'Visitantes tienen prohibido acceso a bodegas y área de empaque sin la compañía de un colaborador de la empresa.', sev: 'm' },
    { txt: 'Perímetro de la empresa está delimitado correctamente para controlar ingresos.', sev: 'MA' },
  ]},
  { cat: 'Manejo Integrado de Plagas', items: [
    { txt: '¿La planta empacadora cuenta con trampeo interno (obligatorio) y externo (opcional) para el control de plagas? Rotulado y numerados.', sev: 'MA' },
    { txt: 'Se observa evidencias de actividad de plagas y roedores.', sev: 'P' },
    { txt: '¿Se evita el uso de cebos químicos dentro de la planta empacadora?', sev: 'MA' },
    { txt: '¿Se cuenta con un croquis del área de empaque, donde se ubique el trampeo de plagas numerado?', sev: 'm' },
    { txt: 'Se cuenta con un programa de Manejo Integrado de Plagas documentado y registros de actividad de plagas o roedores. ¿Se realizan fumigaciones a la planta de empaque de manera mensual?', sev: 'MA' },
  ]},
  { cat: 'Manejo de Aguas', items: [
    { txt: '¿Se cuenta con análisis microbiológicos para las aguas de lavado de frutas y vegetales y se encuentran libres de patógenos?', sev: 'P' },
    { txt: 'Se cuenta con sistema de cloración de agua, luz ultravioleta o sistema de desinfección por medio del ozono u otros. Se registra el control de concentración de cloro, funcionamiento de la lámpara o sistema de ozono en el agua.', sev: 'MA' },
    { txt: '¿Se cuentan con acciones correctivas en casos de desviaciones a los parámetros establecidos para cada una de las fuentes de agua?', sev: 'MA' },
    { txt: '¿La(s) fuente(s) de agua cuenta(n) con estructuras de protección (sello sanitario, plataforma, brocal, galera, caja de captación, etc.) según sea el caso?', sev: 'MA' },
    { txt: '¿Se restringe el ingreso de animales a la fuente de agua cuando la misma está en control de la finca?', sev: 'MA' },
    { txt: 'Si existen focos de riesgo de contaminación (letrinas, aguas grises, basureros, crianza de animales, etc.) ¿Se han implementado las medidas de mitigación pertinentes? No hay evidencia de goteos o fugas de aguas residuales generadas que sea un punto de contaminación cruzada.', sev: 'P' },
  ]},
  { cat: 'Almacenamiento', items: [
    { txt: '¿Tienen un área específica para almacenamiento del material de empaque de productos, limpio y seco?', sev: 'm' },
    { txt: '¿Las frutas, vegetales, cestas o sacos de Planta no están en contacto directo con el suelo?', sev: 'MA' },
    { txt: 'El producto que llega del campo se encuentra protegido de contaminación previo al empaque o proceso. Alrededores de la planta se encuentran limpios, sin basura ni desecho.', sev: 'MA' },
  ]},
  { cat: 'Trazabilidad y Registros', items: [
    { txt: 'Se cuenta con el plan de acción de la última auditoría, con las correcciones realizadas a las oportunidades de mejora encontradas.', sev: 'm' },
    { txt: '¿El productor ha implementado en forma efectiva las acciones correctivas pertinentes, resultado de las recomendaciones técnicas brindadas? Ver evidencia escrita. Bitácoras.', sev: 'm' },
    { txt: 'Se cuenta con registros de trazabilidad del producto enviado.', sev: 'm' },
  ]},
  { cat: 'Manejo adecuado de Desechos', items: [
    { txt: '¿Está la planta libre de basura domiciliaria? ¿Existen basureros en la planta para el manejo adecuado de la basura domiciliaria?', sev: 'm' },
  ]},
  { cat: 'BPM en Planta Empacadora', items: [
    { txt: 'Cuenta la instalación con lavamanos y sus dispositivos para adecuado lavado y desinfección de manos al ingreso del área de proceso.', sev: 'P' },
    { txt: 'Cuenta la planta de proceso con control de vidrio y plástico quebradizo.', sev: 'MA' },
    { txt: 'Registro de limpieza de planta de empaque, lavado y desinfección de producto, fumigación contra insectos de la empacadora.', sev: 'MA' },
    { txt: '¿Tienen los trabajadores disponibilidad de letrina o servicios sanitarios limpios en el área de empaque, adecuadamente equipados con papel higiénico y basurero con bolsa y tapa; además de un lavamanos con agua potable, jabón líquido antibacterial, alcohol en gel, dispositivo para el adecuado secado de manos?', sev: 'MA' },
    { txt: '¿Los servicios sanitarios se encuentran fuera de la planta empacadora? No se accesa al servicio sanitario desde la planta.', sev: 'MA' },
    { txt: '¿El personal de empaque está libre de enfermedad gastrointestinal y/o respiratoria? Visual y entrevista.', sev: 'MA' },
    { txt: 'Se cuenta con un procedimiento establecido para el control de eventos y manejo de personal enfermo.', sev: 'm' },
    { txt: '¿El personal de planta cumple con los hábitos de trabajo de un manipulador de alimentos: pantalón largo, camisa con manga, zapato cerrado con medias, redecilla, uñas cortas sin pintar, sin uñas o pestañas postizas, pelo corto o recogido y con protección, barba y bigote recortado, sin heridas abiertas, sin maquillaje y sin joyería ni artículos prohibidos (celular, audífonos, etc)?', sev: 'MA' },
    { txt: '¿El personal que manipula alimentos se lava las manos de forma eficiente? Visual y entrevista. Y se evidencia rotulación del procedimiento de lavado de manos.', sev: 'MA' },
    { txt: '¿El personal de empaque evita realizar prácticas indebidas como fumar, beber, comer, masticar chicle y/o escupir en el área de empaque?', sev: 'MA' },
  ]},
  { cat: 'Planta de Proceso', items: [
    { txt: 'Cuenta su instalación con puntos de control (incluidas las operaciones de refrigeración, desinfección, corte, empaques modificados) dentro de sus procesos para reducir el riesgo de seguridad alimentaria asociado con las materias primas que maneja.', sev: 'P' },
    { txt: '¿Alguno de los puntos enumerados está validado por su empresa? ¿Qué actividades de verificación están realizando para garantizar que los puntos funcionen continuamente según lo previsto?', sev: 'MA' },
    { txt: '¿Tienen un área específica para clasificación y empaque de productos, completamente cerrado que restrinja el acceso de personas ajenas, animales domésticos y plagas (principio de exclusión)?', sev: 'MA' },
    { txt: '¿La superficie que está en contacto con las frutas y/o vegetales es no porosa, fácil de limpiar? (mesas, tinas de lavado, utensilios, herramientas).', sev: 'MA' },
    { txt: '¿Se evidencia que todas las áreas del proceso y equipos se encuentren limpias y ordenadas? (Verificar estructuras aéreas).', sev: 'm' },
    { txt: 'Los desinfectantes utilizados para el lavado de producto en la postcosecha están aprobados para la industria de alimentos. Concentraciones aprobadas. Se mantienen registros.', sev: 'P' },
    { txt: '¿Estructuras de vidrio o lámparas dentro de la planta de empaque cuentan con película protectora?', sev: 'MA' },
    { txt: '¿Las cajas de empaque son exclusivamente usadas para dicho fin? ¿Se encuentran las cestas sobre tarima y separadas de cestas de campo?', sev: 'm' },
    { txt: 'Se tienen separadas y rotuladas las áreas en planta (producto conforme y no conforme).', sev: 'm' },
    { txt: 'El empaque es adecuado para el producto que se trabaja y concuerda con lo definido en la especificación del producto.', sev: 'm' },
    { txt: 'Se cuenta con calibración y verificación del equipo básico utilizado (registros y/o certificado de la empresa que lo realiza).', sev: 'MA' },
    { txt: 'Se tiene control de la temperatura en toda la cadena de producción cuando aplique.', sev: 'MA' },
    { txt: 'Se realizan acciones correctivas respecto a los rechazos de producto realizados por recepción del cliente. Se archivan las hojas de rechazo.', sev: 'MA' },
    { txt: '¿Existe algún tipo de riesgo de contaminación física, química y biológica en las instalaciones y proceso?', sev: 'MA' },
  ]},
  { cat: 'Producto', items: [
    { txt: '¿Se cuenta con análisis microbiológicos para frutas y vegetales y se encuentran libres de patógenos? Análisis o bitácora.', sev: 'MA' },
  ]},
  { cat: 'Transporte', items: [
    { txt: '¿La finca cuenta con registros actualizados (limpieza camión y fumigación) al momento de la inspección, que permitan demostrar el manejo del producto bajo el esquema de las BPMs? Limpieza en cada entrega y fumigación cada 30 días.', sev: 'm' },
  ]},
];

const ITEM_FLAT = CHECKLIST.flatMap((c, ci) =>
  c.items.map((it, ii) => ({ id: `${ci}-${ii}`, cat: c.cat, ...it }))
);

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

const card = { background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 22, marginBottom: 20 };
const LS = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', color: T.textMid, letterSpacing: '.06em' };
const IS = { padding: '8px 10px', border: '1.5px solid #E0E0E0', borderRadius: 6, fontSize: '.85rem', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', marginTop: 2 };

const blankItemState = () => ({
  estado: null, // 'cumple' | 'nocumple' | 'na' | null
  queFalta: '', causaRaiz: '', accionCorrectiva: '', accionPreventiva: '',
  responsable: '', fechaObjetivo: '',
});
const blankState = () => Object.fromEntries(ITEM_FLAT.map(it => [it.id, blankItemState()]));

// ─── Main ────────────────────────────────────────────────────────────
export default function Inspecciones() {
  const toast = useToast();
  const { empleados, loading: empLoading } = useEmpleados();
  const [tab, setTab] = useState('inspeccion'); // 'inspeccion' | 'capa' | 'historial'

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 1100 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: T.primary, margin: 0 }}>
          Inspecciones BPM — Auditoría Walmart
        </h1>
        <p style={{ fontSize: '.83rem', color: T.textMid, marginTop: 4 }}>
          Checklist de planta + CAPA (Acciones Correctivas y Preventivas)
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `2px solid ${T.border}` }}>
        {[
          { k: 'inspeccion', label: '📋 Nueva Inspección' },
          { k: 'capa',       label: '⚡ CAPA Seguimiento' },
          { k: 'historial',  label: '🗂️ Historial' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            padding: '10px 18px', border: 'none', background: 'none',
            borderBottom: tab === t.k ? `3px solid ${T.primary}` : '3px solid transparent',
            color: tab === t.k ? T.primary : T.textMid, fontWeight: 700,
            fontSize: '.86rem', cursor: 'pointer', marginBottom: -2,
            fontFamily: 'inherit',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'inspeccion' && <Inspeccion empleados={empleados} empLoading={empLoading} toast={toast} />}
      {tab === 'capa'       && <CapaTab empleados={empleados} toast={toast} />}
      {tab === 'historial'  && <Historial />}
    </div>
  );
}

// ─── Tab: Nueva Inspección ───────────────────────────────────────────
function Inspeccion({ empleados, empLoading, toast }) {
  const { add, saving } = useWrite('inspecciones');
  const { add: addCapa } = useWrite('capas');

  const [fecha, setFecha]   = useState(today());
  const [resp,  setResp]    = useState('');
  const [tipo,  setTipo]    = useState('planta');
  const [obs,   setObs]     = useState('');
  const [items, setItems]   = useState(blankState);
  const [openCat, setOpenCat] = useState(CHECKLIST[0].cat);

  const setItem = (id, patch) => setItems(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const stats = useMemo(() => {
    let cumple = 0, nocumple = 0, na = 0, pendiente = 0;
    let totalW = 0, achievedW = 0;
    const noCumpleBySev = { P: 0, MA: 0, m: 0 };
    ITEM_FLAT.forEach(it => {
      const e = items[it.id]?.estado;
      if (e === 'cumple') { cumple++; totalW += SEV[it.sev].weight; achievedW += SEV[it.sev].weight; }
      else if (e === 'nocumple') { nocumple++; totalW += SEV[it.sev].weight; noCumpleBySev[it.sev]++; }
      else if (e === 'na') na++;
      else pendiente++;
    });
    const score = totalW > 0 ? Math.round((achievedW / totalW) * 100) : 0;
    return { cumple, nocumple, na, pendiente, score, noCumpleBySev };
  }, [items]);

  const aprobado = stats.noCumpleBySev.P === 0 && stats.score >= 85;

  const handleSave = async () => {
    if (!fecha || !resp) { toast('Complete fecha y responsable', 'error'); return; }
    if (stats.pendiente > 0) { toast(`Faltan ${stats.pendiente} ítems por evaluar`, 'error'); return; }

    // Validate that every "nocumple" has at least queFalta + responsable + fechaObjetivo
    const invalidos = ITEM_FLAT.filter(it => {
      const i = items[it.id];
      return i.estado === 'nocumple' && (!i.queFalta || !i.responsable || !i.fechaObjetivo);
    });
    if (invalidos.length > 0) {
      toast(`${invalidos.length} CAPA incompleto(s) — falta qué falta, responsable o fecha objetivo`, 'error');
      return;
    }

    try {
      const insp = await add({
        fecha, resp, tipo, obs,
        score: stats.score,
        resultado: aprobado ? 'APROBADO' : 'NO APROBADO',
        cumple: stats.cumple, nocumple: stats.nocumple, na: stats.na,
        items: ITEM_FLAT.map(it => ({
          id: it.id, cat: it.cat, txt: it.txt, sev: it.sev,
          estado: items[it.id].estado,
          queFalta: items[it.id].queFalta,
        })),
        creadoEn: new Date().toISOString(),
      });

      // Generate CAPA records
      const nocumples = ITEM_FLAT.filter(it => items[it.id].estado === 'nocumple');
      for (const it of nocumples) {
        const i = items[it.id];
        await addCapa({
          inspeccionId: insp?.id || null,
          fechaInsp: fecha,
          categoria: it.cat,
          item: it.txt,
          severidad: it.sev,
          queFalta: i.queFalta,
          causaRaiz: i.causaRaiz,
          accionCorrectiva: i.accionCorrectiva,
          accionPreventiva: i.accionPreventiva,
          responsable: i.responsable,
          fechaObjetivo: i.fechaObjetivo,
          estado: 'abierto',
          fechaCierre: null,
          verificadoPor: '',
          evidencia: '',
          creadoEn: new Date().toISOString(),
        });
      }

      toast(`Inspección guardada · ${nocumples.length} CAPA generado(s)`);
      setItems(blankState());
      setObs('');
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    }
  };

  return (
    <>
      {/* Header form */}
      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 12 }}>
          <label style={LS}>Fecha
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={IS} />
          </label>
          <label style={LS}>Responsable
            {empLoading ? <Skeleton height={36} /> : (
              <select value={resp} onChange={e => setResp(e.target.value)} style={{ ...IS, cursor: 'pointer' }}>
                <option value="">— Seleccionar —</option>
                {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}{e.cargo ? ' · ' + e.cargo : ''}</option>)}
              </select>
            )}
          </label>
          <label style={LS}>Tipo
            <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ ...IS, cursor: 'pointer' }}>
              <option value="planta">Planta Empacadora</option>
              <option value="agricultor" disabled>Agricultor (Fase 2)</option>
            </select>
          </label>
        </div>

        {/* Score banner */}
        <ScoreBanner stats={stats} aprobado={aprobado} total={ITEM_FLAT.length} />
      </div>

      {/* Checklist categorized */}
      {CHECKLIST.map(cat => {
        const isOpen = openCat === cat.cat;
        const catItems = cat.items.map((_, ii) => ITEM_FLAT.find(x => x.id === `${CHECKLIST.indexOf(cat)}-${ii}`));
        const catDone = catItems.filter(it => items[it.id]?.estado).length;
        const catNo   = catItems.filter(it => items[it.id]?.estado === 'nocumple').length;
        return (
          <div key={cat.cat} style={{ ...card, padding: 0, marginBottom: 14 }}>
            <button onClick={() => setOpenCat(isOpen ? null : cat.cat)} style={{
              width: '100%', padding: '14px 22px', border: 'none', background: isOpen ? T.green2 : '#fff',
              borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            }}>
              <span style={{ fontWeight: 700, fontSize: '.95rem', color: T.primary }}>
                {cat.cat}
                <span style={{ fontSize: '.72rem', fontWeight: 600, color: T.textMid, marginLeft: 10 }}>
                  ({catDone}/{catItems.length})
                  {catNo > 0 && <span style={{ color: T.danger, marginLeft: 6 }}>· {catNo} no cumple</span>}
                </span>
              </span>
              <span style={{ color: T.secondary, fontWeight: 700 }}>{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && (
              <div style={{ padding: '4px 22px 18px', borderTop: `1px solid ${T.border}` }}>
                {catItems.map(it => (
                  <ItemRow key={it.id} it={it} state={items[it.id]} setItem={setItem} empleados={empleados} fecha={fecha} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Observaciones */}
      <div style={card}>
        <label style={LS}>Observaciones generales
          <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
            placeholder="Notas adicionales de la inspección..."
            style={{ ...IS, resize: 'vertical' }} />
        </label>
        <button onClick={handleSave} disabled={saving} style={{
          marginTop: 14, padding: '11px 24px', background: saving ? '#BDBDBD' : T.primary,
          color: T.white, border: 'none', borderRadius: 6, fontWeight: 700,
          fontSize: '.9rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        }}>
          {saving ? 'Guardando...' : `Guardar Inspección${stats.nocumple > 0 ? ` + ${stats.nocumple} CAPA` : ''}`}
        </button>
      </div>
    </>
  );
}

function ScoreBanner({ stats, aprobado, total }) {
  const { score, cumple, nocumple, na, pendiente, noCumpleBySev } = stats;
  const evaluados = total - pendiente;
  return (
    <div style={{
      padding: 14, borderRadius: 8,
      background: pendiente === total ? T.bgLight : aprobado ? T.green2 : T.redBg,
      border: `1.5px solid ${pendiente === total ? T.border : aprobado ? T.secondary : T.danger}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: aprobado ? T.secondary : T.danger }}>
          {evaluados > 0 ? `${score}%` : '—'}
        </div>
        <div style={{ flex: 1, minWidth: 200, fontSize: '.83rem', color: T.textMid }}>
          <div style={{ fontWeight: 700, color: aprobado ? T.secondary : nocumple > 0 ? T.danger : T.textMid, marginBottom: 4 }}>
            {pendiente === total ? '⏳ Sin evaluar' : aprobado ? '✅ APROBADO' : '❌ NO APROBADO'}
            {noCumpleBySev.P > 0 && <span style={{ marginLeft: 8, fontSize: '.72rem' }}>· {noCumpleBySev.P} Prioritaria(s) no cumplida(s)</span>}
          </div>
          <div>
            <b style={{ color: T.secondary }}>{cumple}</b> cumplen ·
            {' '}<b style={{ color: T.danger }}>{nocumple}</b> no cumplen ·
            {' '}{na} N/A ·
            {' '}{pendiente} pendientes
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemRow({ it, state, setItem, empleados, fecha }) {
  const sev = SEV[it.sev];
  const isNo = state.estado === 'nocumple';
  return (
    <div style={{
      padding: '10px 0', borderBottom: `1px solid ${T.border}`,
      display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start',
    }}>
      <div style={{ flex: '1 1 360px', minWidth: 240 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ padding: '1px 8px', borderRadius: 100, fontSize: '.64rem', fontWeight: 800,
            background: sev.bg, color: sev.color, letterSpacing: '.05em' }}>
            {sev.label.toUpperCase()}
          </span>
        </div>
        <div style={{ fontSize: '.84rem', color: T.textDark, lineHeight: 1.4 }}>{it.txt}</div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {[
          { v: 'cumple',   txt: '✓ Cumple',     col: T.secondary },
          { v: 'nocumple', txt: '✗ No cumple', col: T.danger },
          { v: 'na',       txt: 'N/A',          col: T.textMid },
        ].map(b => (
          <button key={b.v} onClick={() => setItem(it.id, { estado: state.estado === b.v ? null : b.v })}
            style={{
              padding: '5px 12px', borderRadius: 5, border: '1.5px solid',
              cursor: 'pointer', fontWeight: 700, fontSize: '.74rem', fontFamily: 'inherit',
              background: state.estado === b.v ? b.col : '#fff',
              borderColor: state.estado === b.v ? b.col : T.border,
              color: state.estado === b.v ? '#fff' : T.textMid,
            }}>
            {b.txt}
          </button>
        ))}
      </div>

      {/* CAPA inline when "no cumple" */}
      {isNo && (
        <div style={{ flex: '1 1 100%', padding: 12, marginTop: 4, background: '#FFF8F8',
          border: `1.5px dashed ${T.danger}`, borderRadius: 8 }}>
          <div style={{ fontSize: '.7rem', fontWeight: 800, color: T.danger, marginBottom: 8, letterSpacing: '.05em' }}>
            ⚡ CAPA — ACCIÓN CORRECTIVA Y PREVENTIVA
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
            <label style={LS}>Qué falta / hallazgo *
              <textarea value={state.queFalta} onChange={e => setItem(it.id, { queFalta: e.target.value })}
                rows={2} placeholder="Describir el incumplimiento..."
                style={{ ...IS, resize: 'vertical' }} />
            </label>
            <label style={LS}>Causa raíz
              <textarea value={state.causaRaiz} onChange={e => setItem(it.id, { causaRaiz: e.target.value })}
                rows={2} placeholder="¿Por qué ocurrió?"
                style={{ ...IS, resize: 'vertical' }} />
            </label>
            <label style={LS}>Acción correctiva
              <textarea value={state.accionCorrectiva} onChange={e => setItem(it.id, { accionCorrectiva: e.target.value })}
                rows={2} placeholder="Acción inmediata"
                style={{ ...IS, resize: 'vertical' }} />
            </label>
            <label style={LS}>Acción preventiva
              <textarea value={state.accionPreventiva} onChange={e => setItem(it.id, { accionPreventiva: e.target.value })}
                rows={2} placeholder="Prevenir reincidencia"
                style={{ ...IS, resize: 'vertical' }} />
            </label>
            <label style={LS}>Responsable *
              <select value={state.responsable} onChange={e => setItem(it.id, { responsable: e.target.value })}
                style={{ ...IS, cursor: 'pointer' }}>
                <option value="">— Seleccionar —</option>
                {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
              </select>
            </label>
            <label style={LS}>Fecha objetivo *
              <input type="date" value={state.fechaObjetivo}
                min={fecha}
                onChange={e => setItem(it.id, { fechaObjetivo: e.target.value })}
                style={IS} />
              <button onClick={() => setItem(it.id, { fechaObjetivo: addDays(fecha, 30) })}
                style={{ marginTop: 4, background: 'none', border: `1px solid ${T.border}`,
                  borderRadius: 4, padding: '3px 8px', fontSize: '.7rem',
                  color: T.textMid, cursor: 'pointer', fontFamily: 'inherit' }}>
                +30 días
              </button>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: CAPA Seguimiento ───────────────────────────────────────────
function CapaTab({ empleados, toast }) {
  const { data: capas, loading } = useCollection('capas', { orderField: 'fechaObjetivo', orderDir: 'asc', limit: 500 });
  const { update, remove } = useWrite('capas');
  const [filter, setFilter] = useState('abierto');

  const stats = useMemo(() => {
    const lista = capas || [];
    const hoy = today();
    return {
      total: lista.length,
      abierto: lista.filter(c => c.estado === 'abierto').length,
      enproceso: lista.filter(c => c.estado === 'en_proceso').length,
      cerrado: lista.filter(c => c.estado === 'cerrado').length,
      vencidos: lista.filter(c => c.estado !== 'cerrado' && c.fechaObjetivo && c.fechaObjetivo < hoy).length,
    };
  }, [capas]);

  const filtered = useMemo(() => {
    const lista = capas || [];
    if (filter === 'todos') return lista;
    if (filter === 'vencidos') {
      const hoy = today();
      return lista.filter(c => c.estado !== 'cerrado' && c.fechaObjetivo && c.fechaObjetivo < hoy);
    }
    return lista.filter(c => c.estado === filter);
  }, [capas, filter]);

  const handleCerrar = async (capa) => {
    const ver = window.prompt('Verificado por (nombre):');
    if (!ver) return;
    const evi = window.prompt('Evidencia / notas de cierre:') || '';
    await update(capa.id, { estado: 'cerrado', fechaCierre: today(), verificadoPor: ver, evidencia: evi });
    toast('CAPA cerrado');
  };

  const handleEnProceso = async (capa) => {
    await update(capa.id, { estado: 'en_proceso' });
    toast('CAPA en proceso');
  };

  const handleReabrir = async (capa) => {
    await update(capa.id, { estado: 'abierto', fechaCierre: null, verificadoPor: '', evidencia: '' });
    toast('CAPA reabierto');
  };

  return (
    <>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Abiertos',    val: stats.abierto,   col: T.danger,    k: 'abierto' },
          { label: 'En proceso',  val: stats.enproceso, col: T.warn,      k: 'en_proceso' },
          { label: 'Cerrados',    val: stats.cerrado,   col: T.secondary, k: 'cerrado' },
          { label: 'Vencidos',    val: stats.vencidos,  col: T.danger,    k: 'vencidos' },
          { label: 'Total',       val: stats.total,     col: T.textMid,   k: 'todos' },
        ].map(s => (
          <button key={s.k} onClick={() => setFilter(s.k)} style={{
            padding: 12, borderRadius: 8, cursor: 'pointer',
            background: filter === s.k ? s.col : '#fff',
            color: filter === s.k ? '#fff' : s.col,
            border: `2px solid ${s.col}`, fontFamily: 'inherit',
            textAlign: 'left',
          }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{s.val}</div>
            <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              {s.label}
            </div>
          </button>
        ))}
      </div>

      <div style={card}>
        {loading ? <Skeleton rows={5} /> : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: T.textMid, fontSize: '.85rem' }}>
            Sin CAPA en esta categoría
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(c => <CapaCard key={c.id} capa={c} onCerrar={handleCerrar} onEnProceso={handleEnProceso} onReabrir={handleReabrir} onRemove={() => remove(c.id)} />)}
          </div>
        )}
      </div>
    </>
  );
}

function CapaCard({ capa, onCerrar, onEnProceso, onReabrir, onRemove }) {
  const sev = SEV[capa.severidad] || SEV.m;
  const vencido = capa.estado !== 'cerrado' && capa.fechaObjetivo && capa.fechaObjetivo < today();
  const diasAtraso = vencido ? Math.floor((new Date(today()) - new Date(capa.fechaObjetivo)) / 86400000) : 0;
  const estadoCol = capa.estado === 'cerrado' ? T.secondary : capa.estado === 'en_proceso' ? T.warn : T.danger;
  const estadoLbl = capa.estado === 'cerrado' ? '✅ CERRADO' : capa.estado === 'en_proceso' ? '🔄 EN PROCESO' : '🔴 ABIERTO';
  return (
    <div style={{
      padding: 14, borderRadius: 8,
      background: capa.estado === 'cerrado' ? T.green2 : vencido ? T.redBg : '#fff',
      border: `1.5px solid ${vencido ? T.danger : T.border}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ padding: '2px 10px', borderRadius: 100, fontSize: '.66rem', fontWeight: 800,
            background: sev.bg, color: sev.color }}>{sev.label.toUpperCase()}</span>
          <span style={{ padding: '2px 10px', borderRadius: 100, fontSize: '.66rem', fontWeight: 800,
            background: estadoCol, color: '#fff' }}>{estadoLbl}</span>
          {vencido && (
            <span style={{ padding: '2px 10px', borderRadius: 100, fontSize: '.66rem', fontWeight: 800,
              background: T.danger, color: '#fff' }}>⚠ VENCIDO {diasAtraso}d</span>
          )}
          <span style={{ padding: '2px 10px', borderRadius: 100, fontSize: '.66rem', fontWeight: 600,
            background: '#F5F5F5', color: T.textMid }}>{capa.categoria}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {capa.estado === 'abierto' && (
            <button onClick={() => onEnProceso(capa)} style={btnSm(T.warn)}>En proceso</button>
          )}
          {capa.estado !== 'cerrado' && (
            <button onClick={() => onCerrar(capa)} style={btnSm(T.secondary)}>✓ Cerrar</button>
          )}
          {capa.estado === 'cerrado' && (
            <button onClick={() => onReabrir(capa)} style={btnSm(T.warn)}>Reabrir</button>
          )}
          <button onClick={onRemove} style={btnSm(T.textMid, true)}>✕</button>
        </div>
      </div>

      <div style={{ fontSize: '.86rem', fontWeight: 600, color: T.textDark, marginBottom: 8 }}>
        {capa.item}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10, fontSize: '.78rem' }}>
        <Field label="Qué falta" value={capa.queFalta} />
        <Field label="Causa raíz" value={capa.causaRaiz} />
        <Field label="Acción correctiva" value={capa.accionCorrectiva} />
        <Field label="Acción preventiva" value={capa.accionPreventiva} />
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '.74rem', color: T.textMid, flexWrap: 'wrap' }}>
        <span>📅 Inspección: <b>{capa.fechaInsp}</b></span>
        <span>👤 Resp: <b>{capa.responsable}</b></span>
        <span>🎯 Objetivo: <b style={{ color: vencido ? T.danger : T.textMid }}>{capa.fechaObjetivo}</b></span>
        {capa.estado === 'cerrado' && (
          <>
            <span>✅ Cerrado: <b>{capa.fechaCierre}</b></span>
            <span>🔍 Verificó: <b>{capa.verificadoPor}</b></span>
          </>
        )}
      </div>
      {capa.evidencia && (
        <div style={{ marginTop: 6, padding: 8, background: T.bgLight, borderRadius: 4, fontSize: '.76rem', color: T.textMid }}>
          📎 {capa.evidencia}
        </div>
      )}
    </div>
  );
}

const Field = ({ label, value }) => value ? (
  <div>
    <div style={{ fontSize: '.66rem', fontWeight: 700, color: T.textMid, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
    <div style={{ color: T.textDark }}>{value}</div>
  </div>
) : null;

const btnSm = (col, isDelete) => ({
  padding: '4px 10px', borderRadius: 4, border: `1px solid ${col}`,
  background: isDelete ? 'none' : col, color: isDelete ? col : '#fff',
  fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
});

// ─── Tab: Historial ──────────────────────────────────────────────────
function Historial() {
  const { data: insps, loading } = useCollection('inspecciones', { orderField: 'fecha', orderDir: 'desc', limit: 100 });
  const { remove } = useWrite('inspecciones');
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div style={card}>
      {loading ? <Skeleton rows={5} /> : (insps || []).length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: T.textMid, fontSize: '.85rem' }}>Sin inspecciones registradas</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: T.primary }}>
                {['Fecha', 'Tipo', 'Responsable', 'Score', 'Cumple', 'No cumple', 'Resultado', '', ''].map(h => (
                  <th key={h} style={{ padding: '9px 12px', color: '#fff', fontSize: '.7rem', fontWeight: 700,
                    textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(insps || []).map((r, i) => {
                const ok = r.resultado === 'APROBADO';
                const isExp = expandedId === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr style={{ background: isExp ? '#F1F8E9' : i % 2 === 0 ? '#fff' : '#F9FBF9', cursor: 'pointer' }}
                      onClick={() => setExpandedId(prev => prev === r.id ? null : r.id)}>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 600 }}>{r.fecha}</td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0' }}>{r.tipo || 'planta'}</td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0' }}>{r.resp}</td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 800,
                        color: r.score >= 85 ? T.secondary : r.score >= 60 ? T.warn : T.danger }}>{r.score}%</td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', color: T.secondary, fontWeight: 700 }}>{r.cumple}</td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', color: T.danger, fontWeight: 700 }}>{r.nocumple}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 20, fontSize: '.68rem', fontWeight: 700,
                          background: ok ? T.green2 : T.redBg, color: ok ? T.secondary : T.danger,
                        }}>{ok ? '✅ APROBADO' : '❌ NO APROBADO'}</span>
                      </td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0', color: T.secondary, fontWeight: 700 }}>
                        {isExp ? '▲' : '▼'}
                      </td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => remove(r.id)} style={{
                          background: 'none', border: `1px solid ${T.border}`, borderRadius: 4,
                          padding: '3px 8px', cursor: 'pointer', fontSize: '.72rem', color: T.textMid,
                        }}>✕</button>
                      </td>
                    </tr>
                    {isExp && (
                      <tr>
                        <td colSpan={9} style={{ padding: 0, borderBottom: '2px solid #A5D6A7' }}>
                          <div style={{ padding: '14px 18px', background: '#F9FEF9', borderLeft: '4px solid #2E7D32' }}>
                            <div style={{ fontWeight: 700, fontSize: '.72rem', color: T.secondary, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
                              Detalle de inspección
                            </div>
                            {CHECKLIST.map((cat, ci) => {
                              const catItems = (r.items || []).filter(it => it.cat === cat.cat);
                              const catNo = catItems.filter(it => it.estado === 'nocumple');
                              if (catItems.length === 0) return null;
                              return (
                                <div key={cat.cat} style={{ marginBottom: 10 }}>
                                  <div style={{ fontSize: '.78rem', fontWeight: 700, color: T.primary, marginBottom: 4 }}>
                                    {cat.cat} {catNo.length > 0 && <span style={{ color: T.danger, fontSize: '.7rem' }}>· {catNo.length} no cumplen</span>}
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {catItems.map(it => (
                                      <span key={it.id} title={it.txt} style={{
                                        padding: '2px 8px', borderRadius: 4, fontSize: '.7rem', fontWeight: 700,
                                        background: it.estado === 'cumple' ? T.green2 : it.estado === 'nocumple' ? T.redBg : T.bgLight,
                                        color: it.estado === 'cumple' ? T.secondary : it.estado === 'nocumple' ? T.danger : T.textMid,
                                      }}>
                                        {it.estado === 'cumple' ? '✓' : it.estado === 'nocumple' ? '✗' : '—'} {SEV[it.sev].label[0]}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                            {r.obs && (
                              <div style={{ marginTop: 8, fontSize: '.78rem', color: T.textMid }}>
                                📝 {r.obs}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
