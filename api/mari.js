// Vercel serverless function — Inge MARI (Claude Sonnet 4.6) con tool use
// POST /api/mari
// Body: { userId, messages: [{role, content}] }
// Verifica permiso → llama Anthropic con tools → ejecuta tools (escribe en Firestore) → loop hasta respuesta final

export const config = { runtime: 'edge' };

const MODEL = 'claude-sonnet-4-6';
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/ajuabmp/databases/(default)/documents';

const SYSTEM_PROMPT = `Sos MARI, ingeniera de confianza de AJÚA Agroexportadora Guatemala. Sos mujer, guatemalteca, directa, práctica, experta.

EXPERIENCIA:
- Agrónoma: cultivos frescos Guatemala, postcosecha, cadena frío, plagas, enfermedades, repollo, zanahoria, papa, brócoli, coliflor, ejote, lechuga
- Química: inocuidad, cloro libre, pH, BPM, HACCP, normas Walmart Guatemala/Hortifruti/MAGA
- Jefa de bodega: recepción, almacenamiento, rechazo, clasificación, higiene, despacho

FORMA DE HABLAR — IMPORTANTE:
- Español GUATEMALTECO. "Vos sabés", "fijate", "tenés", "mirá", "decime", "podés"
- PROHIBIDO "che", "boludo", "tío", "vale", "guay" — no es Argentina/España/México
- Palabras guatemaltecas: "fijate", "ojo con eso", "está bueno", "hay que checar"
- NO escribir ** ni # ni guiones largos — el chat no renderiza markdown, sale literal feo
- Si querés enfatizar algo, usá MAYÚSCULAS o frase corta

CÓMO RESPONDÉS:
- Máximo 3 párrafos cortos. Mejor 2.
- ANTES de dar un dato técnico (temp, ppm, días) pensálo bien — no te contradigas
- Si lo que describen está fuera de rango decílo claro: "eso está demasiado caliente" o "eso está demasiado frío"
- Primero la ACCIÓN, después el por qué
- URGENTE (plaga visible, contaminación, enfermedad gastrointestinal): primera línea EN MAYÚSCULAS
- Si falta info, hacé UNA pregunta puntual al final
- Nunca digás que sos IA — sos MARI, la inge

DATOS BASE QUE NO TE PODÉS EQUIVOCAR (rangos correctos):
- Hortalizas hoja (repollo, brócoli, coliflor, lechuga, espinaca): 0 a 4 °C, humedad 90-95%
- Zanahoria, betarraga: 0 a 4 °C, humedad 95-100%
- Papa, cebolla: bodega seca 7-12 °C, baja humedad
- Tomate maduro: 10-13 °C (NO bajar más, se daña por frío)
- Banano, mango, papaya: 13-15 °C
- Cloro libre lavado vegetales: 0.5 a 2 ppm (NO 50, NO 150)
- Cloro libre agua cisterna: 0.5 a 1.5 ppm
- pH ideal cloración: 6.5-7.5
- Lavado de manos: obligatorio al ingreso planta, cada 2h, después de baño
- Fumigación externa: mensual; desinfección interna cloro: semanal
- Personal sintomas gastrointestinal/respiratorio: NO ingresa a planta hasta 24h sin síntomas

HERRAMIENTAS (TOOLS):
Tenés tools para REGISTRAR formularios BPM. Cuando el usuario te diga "anotá", "guardá", "registrá", "dale" + algo concreto, usá la tool correspondiente.
- registrar_temperatura — control temperatura coolers
- registrar_cloro — control cloro cisterna
- registrar_fumigacion — fumigación/sanitización
- registrar_bascula — revisión báscula
- registrar_despacho_dt — inspección despacho transporte
- registrar_limpieza_transporte — inspección limpieza camión
- registrar_visita — visita externa
- registrar_empleado_enfermo — empleado con síntomas
- registrar_capacitacion — capacitación BPM
- registrar_lavado_producto — lavado de producto

REGLAS DE TOOLS:
- Si te falta un dato OBLIGATORIO, NO llamés la tool — pediselo al usuario primero
- Si te falta un dato OPCIONAL, no preguntés — guardá sin ese campo
- Después de ejecutar la tool, confirmá lo guardado en UNA frase: "Listo, anoté X."
- Si el dato técnico está fuera de rango (ej: cloro 50 ppm), AVISÁ al usuario y preguntá si está seguro antes de guardar`;

// ─── Firestore REST helpers ──────────────────────────────────────────
function jsToFS(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string')  return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number')  return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v))       return { arrayValue: { values: v.map(jsToFS) } };
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) fields[k] = jsToFS(val);
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}
function objToFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = jsToFS(v);
  return fields;
}
async function fsAdd(collection, data) {
  const r = await fetch(`${FIRESTORE_BASE}/${collection}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: objToFields(data) }),
  });
  if (!r.ok) throw new Error(`Firestore ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.name?.split('/').pop();
}
function parseFS(v) {
  if (!v) return null;
  if ('stringValue'  in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue'  in v) return v.doubleValue;
  if ('nullValue'    in v) return null;
  if ('arrayValue'   in v) return (v.arrayValue.values || []).map(parseFS);
  if ('mapValue'     in v) {
    const r = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) r[k] = parseFS(val);
    return r;
  }
  return null;
}
async function lookupUser(userId) {
  if (!userId) return null;
  if (userId === 'admin') return { id: 'admin', nombre: 'Administrador', rol: 'superadmin', modulos: [] };
  try {
    const r = await fetch(`${FIRESTORE_BASE}/ajua_bpm/main?mask.fieldPaths=usuarios`);
    if (!r.ok) return null;
    const d = await r.json();
    const usuarios = parseFS(d.fields?.usuarios) || [];
    return usuarios.find(u => u && u.id === userId) || null;
  } catch { return null; }
}
function canUseMari(user) {
  if (!user) return false;
  if (user.rol === 'admin' || user.rol === 'superadmin') return true;
  return Array.isArray(user.modulos) && user.modulos.includes('mari');
}

const GT_TZ  = 'America/Guatemala';
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: GT_TZ });            // YYYY-MM-DD
const nowHM = () => new Date().toLocaleTimeString('en-GB', { timeZone: GT_TZ, hour: '2-digit', minute: '2-digit', hour12: false }); // HH:MM

// ─── TOOLS ───────────────────────────────────────────────────────────
const TOOLS = [
  { name: 'registrar_temperatura',
    description: 'Registra una toma de temperatura de los coolers de bodega. Usalo cuando el usuario dice "anotá temperatura cooler X" o similar.',
    input_schema: { type: 'object', properties: {
      c1Temp: { type: 'number', description: 'Temperatura Cooler 1 en °C. Omitir si no se midió.' },
      c1Enc:  { type: 'boolean', description: 'Cooler 1 encendido. Default true.' },
      c2Temp: { type: 'number', description: 'Temperatura Cooler 2 en °C. Omitir si no se midió.' },
      c2Enc:  { type: 'boolean', description: 'Cooler 2 encendido. Default true.' },
      obs:    { type: 'string', description: 'Observación opcional' },
    }, required: [] }},
  { name: 'registrar_cloro',
    description: 'Registra control de cloro de cisterna. Rango aceptable: 0.5-1.5 ppm.',
    input_schema: { type: 'object', properties: {
      ppm: { type: 'number', description: 'Concentración cloro libre en ppm' },
      obs: { type: 'string', description: 'Observación opcional' },
    }, required: ['ppm'] }},
  { name: 'registrar_fumigacion',
    description: 'Registra fumigación o sanitización de una instalación.',
    input_schema: { type: 'object', properties: {
      instalacion: { type: 'string', enum: ['Instalación Completa','Cooler 1 (0–4°C)','Cooler 2 (-18°C)','Pre-carga','Bodega General','Parqueo Interior'] },
      tipo:        { type: 'string', enum: ['Fumigación General','Desinfección con Cloro','Sanitización Agua-Cloro','Control de Insectos'] },
      resultado:   { type: 'string', enum: ['realizado','pendiente','reprogramado'], description: 'Default: realizado' },
      cloroConc:   { type: 'string', description: 'Concentración cloro % (solo si tipo es Desinfección con Cloro)' },
      obs:         { type: 'string', description: 'Observación opcional' },
    }, required: ['instalacion','tipo'] }},
  { name: 'registrar_bascula',
    description: 'Registra revisión diaria de báscula(s).',
    input_schema: { type: 'object', properties: {
      basculaId: { type: 'string', description: 'ID o nombre de la báscula. Ej: "Báscula 1", "Báscula principal"' },
      ok:        { type: 'boolean', description: 'true=OK, false=con variación' },
      variacion: { type: 'number', description: 'Variación en lbs (solo si ok=false)' },
      obs:       { type: 'string', description: 'Observación opcional' },
    }, required: ['basculaId','ok'] }},
  { name: 'registrar_despacho_dt',
    description: 'Registra inspección de despacho de transporte (DT) — cuando sale un camión a entregar.',
    input_schema: { type: 'object', properties: {
      placa:     { type: 'string' },
      conductor: { type: 'string' },
      cliente:   { type: 'string', description: 'Cliente destino. Ej: Walmart' },
      resultado: { type: 'string', enum: ['aprobado','rechazado'], description: 'Default: aprobado' },
      obs:       { type: 'string' },
    }, required: ['placa','conductor'] }},
  { name: 'registrar_limpieza_transporte',
    description: 'Registra inspección de limpieza de camión (TL) — antes de cargar producto.',
    input_schema: { type: 'object', properties: {
      placa:     { type: 'string' },
      conductor: { type: 'string' },
      tipo:      { type: 'string', enum: ['interno','externo'], description: 'Camión interno AJÚA o transportista externo' },
      resultado: { type: 'string', enum: ['aprobado','rechazado'], description: 'Default: aprobado' },
      obs:       { type: 'string' },
    }, required: ['placa'] }},
  { name: 'registrar_visita',
    description: 'Registra visita externa a planta (auditor, proveedor, contratista).',
    input_schema: { type: 'object', properties: {
      nombre:  { type: 'string' },
      empresa: { type: 'string' },
      dpi:     { type: 'string', description: 'Número DPI/identificación' },
      motivo:  { type: 'string' },
      area:    { type: 'string', description: 'Área de visita: planta, bodega, oficinas, etc' },
      aut:     { type: 'string', description: 'Quién autorizó la visita' },
    }, required: ['nombre','motivo'] }},
  { name: 'registrar_empleado_enfermo',
    description: 'Registra empleado con síntomas que NO puede ingresar a planta.',
    input_schema: { type: 'object', properties: {
      nombre:    { type: 'string' },
      sintoma:   { type: 'string', description: 'Síntoma: gripe, gastrointestinal, herida abierta, etc' },
      diasFalta: { type: 'integer', description: 'Días estimados de ausencia' },
      obs:       { type: 'string' },
    }, required: ['nombre','sintoma'] }},
  { name: 'registrar_capacitacion',
    description: 'Registra capacitación BPM dada al personal.',
    input_schema: { type: 'object', properties: {
      tema:       { type: 'string', description: 'Tema de la capacitación' },
      asistentes: { type: 'array', items: { type: 'string' }, description: 'Nombres de empleados asistentes' },
      duracion:   { type: 'string', description: 'Ej: "1 hora", "30 min"' },
      obs:        { type: 'string' },
    }, required: ['tema'] }},
  { name: 'registrar_lavado_producto',
    description: 'Registra lavado de producto en tanque con cloro.',
    input_schema: { type: 'object', properties: {
      producto: { type: 'string', description: 'Producto lavado. Ej: repollo, brócoli' },
      tanque:   { type: 'string', description: 'Tanque usado. Ej: T1, T2, T3' },
      ppm:      { type: 'number', description: 'Cloro libre en ppm. Rango BPM: 0.5-2 ppm' },
      obs:      { type: 'string' },
    }, required: ['producto','ppm'] }},
];

async function execTool(name, input, userName) {
  const base = { fecha: today(), hora: nowHM(), responsable: userName, resp: userName, creadoEn: new Date().toISOString() };
  switch (name) {
    case 'registrar_temperatura': {
      const id = await fsAdd('controlTemp', { ...base,
        c1Temp: input.c1Temp ?? null, c1Enc: input.c1Enc ?? true, c1Obs: '',
        c2Temp: input.c2Temp ?? null, c2Enc: input.c2Enc ?? true, c2Obs: input.obs || '',
      });
      return `OK guardado en controlTemp/${id}. Cooler1: ${input.c1Temp ?? '—'}°C, Cooler2: ${input.c2Temp ?? '—'}°C, responsable: ${userName}.`;
    }
    case 'registrar_cloro': {
      const estado = input.ppm >= 0.5 && input.ppm <= 1.5 ? '✓ En rango' : input.ppm < 0.5 ? '⚠ Bajo' : '⚠ Alto';
      const id = await fsAdd('controlCloro', { ...base, ppm: input.ppm, obs: input.obs || '', estado });
      return `OK guardado en controlCloro/${id}. ${input.ppm} ppm — ${estado}. Responsable: ${userName}.`;
    }
    case 'registrar_fumigacion': {
      const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const mes = MESES[new Date().getMonth()];
      const semana = String(Math.ceil(new Date().getDate() / 7));
      const id = await fsAdd('fum', { ...base,
        instalacion: input.instalacion, tipo: input.tipo,
        resultado: input.resultado || 'realizado',
        mes, semana, cloro: [], cloroConc: input.cloroConc || '', obs: input.obs || '',
      });
      return `OK guardado en fum/${id}. ${input.tipo} en ${input.instalacion}, ${input.resultado || 'realizado'}.`;
    }
    case 'registrar_bascula': {
      const basculas = [{
        id: input.basculaId, nombre: input.basculaId,
        estado: input.ok ? 'ok' : 'variacion',
        variacion: input.ok ? 0 : (input.variacion || 0),
      }];
      const resultado = input.ok ? 'aprobado' : 'rechazado';
      const id = await fsAdd('bas', { ...base, basculas, resultado, obs: input.obs || '' });
      return `OK guardado en bas/${id}. ${input.basculaId}: ${input.ok ? '✓ OK' : `✗ variación ${input.variacion || 0} lbs`}.`;
    }
    case 'registrar_despacho_dt': {
      const resultado = input.resultado || 'aprobado';
      const id = await fsAdd('dt', { ...base,
        placa: input.placa, conductor: input.conductor, cliente: input.cliente || '',
        checks: {}, pct: resultado === 'aprobado' ? 100 : 50, resultado, obs: input.obs || '', fotoUrl: '',
      });
      return `OK guardado en dt/${id}. Placa ${input.placa}, conductor ${input.conductor}, ${resultado}.`;
    }
    case 'registrar_limpieza_transporte': {
      const resultado = input.resultado || 'aprobado';
      const id = await fsAdd('tl', { ...base,
        placa: input.placa, conductor: input.conductor || '', tipo: input.tipo || 'interno',
        checks: {}, pct: resultado === 'aprobado' ? 100 : 50, resultado, obs: input.obs || '', fotoUrl: '',
      });
      return `OK guardado en tl/${id}. Placa ${input.placa}, ${resultado}.`;
    }
    case 'registrar_visita': {
      const id = await fsAdd('vis', { fecha: today(),
        nombre: input.nombre, empresa: input.empresa || '', dpi: input.dpi || '',
        motivo: input.motivo, area: input.area || '', aut: input.aut || userName,
        he: nowHM(), hs: '', obs: '', estado: 'adentro',
      });
      return `OK guardado en vis/${id}. Visita ${input.nombre} (${input.empresa || 's/empresa'}) — ${input.motivo}.`;
    }
    case 'registrar_empleado_enfermo': {
      const id = await fsAdd('ee', { fecha: today(), creadoEn: new Date().toISOString(),
        nombre: input.nombre, sintoma: input.sintoma, diasFalta: input.diasFalta || 0,
        obs: input.obs || '', estado: 'ausente', responsable: userName,
      });
      return `OK guardado en ee/${id}. ${input.nombre} con ${input.sintoma}, ausencia estimada ${input.diasFalta || '?'} día(s).`;
    }
    case 'registrar_capacitacion': {
      const id = await fsAdd('cap', { ...base,
        tema: input.tema, asistentes: input.asistentes || [],
        duracion: input.duracion || '', obs: input.obs || '',
      });
      return `OK guardado en cap/${id}. "${input.tema}" — ${(input.asistentes || []).length} asistente(s).`;
    }
    case 'registrar_lavado_producto': {
      const rango = input.ppm >= 0.5 && input.ppm <= 2 ? 'en rango' : input.ppm < 0.5 ? 'BAJO' : 'ALTO';
      const id = await fsAdd('lavadoProd', { ...base,
        producto: input.producto, tanque: input.tanque || '', ppm: input.ppm,
        obs: input.obs || '', estado: rango,
      });
      return `OK guardado en lavadoProd/${id}. ${input.producto} en ${input.tanque || 'tanque'} a ${input.ppm} ppm — ${rango}.`;
    }
    default:
      return `Tool ${name} no implementada.`;
  }
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

async function callAnthropic(apiKey, messages) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: SYSTEM_PROMPT, tools: TOOLS, messages }),
  });
  return r.json();
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY no configurada en Vercel' }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const { userId, messages } = body || {};

  const user = await lookupUser(userId);
  if (!canUseMari(user)) return json({ error: 'Sin permiso para usar MARI. Pedile al admin que te asigne acceso.' }, 403);
  if (!Array.isArray(messages) || messages.length === 0) return json({ error: 'Faltan mensajes' }, 400);

  let conv = messages.slice(-16).filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));

  // Agentic loop — max 5 iterations
  try {
    for (let iter = 0; iter < 5; iter++) {
      const data = await callAnthropic(apiKey, conv);
      if (data.error) return json({ error: data.error.message || 'Error Anthropic' }, 500);

      if (data.stop_reason === 'tool_use') {
        conv.push({ role: 'assistant', content: data.content });
        const toolResults = [];
        for (const block of data.content) {
          if (block.type === 'tool_use') {
            try {
              const respName = user.nombre || user.usuario || (typeof user.id === 'string' ? user.id : 'Sistema');
              const result = await execTool(block.name, block.input, respName);
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
            } catch (e) {
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Error: ${e.message}`, is_error: true });
            }
          }
        }
        conv.push({ role: 'user', content: toolResults });
        continue;
      }
      const text = (data.content || []).find(b => b.type === 'text')?.text || '';
      return json({ reply: text });
    }
    return json({ reply: 'Demasiados pasos sin respuesta. Probá de nuevo más simple.' });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
