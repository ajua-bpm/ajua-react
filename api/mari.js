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
- registrar_recepcion_proveedor — compra/recepción de producto a proveedor (cuentas por pagar)
- registrar_pago_proveedor — pago a proveedor

REGLAS DE TOOLS:
- Si te falta un dato OBLIGATORIO, NO llamés la tool — pediselo al usuario primero
- Si te falta un dato OPCIONAL, no preguntés — guardá sin ese campo
- Si el dato técnico está fuera de rango (ej: cloro 50 ppm), AVISÁ al usuario y preguntá si está seguro antes de guardar

REGLAS DE FECHA Y HORA — MUY IMPORTANTE:
- Cada tool acepta opcionalmente "fecha" (YYYY-MM-DD) y "hora" (HH:MM 24h)
- Si el usuario menciona una FECHA explícita ("ayer", "el 8", "el lunes pasado", "hace 3 días"), CALCULALA y pasala en el campo fecha. Hoy es referencia.
- Si el usuario menciona una HORA explícita ("a las 11am", "a las 7pm", "a las 3 de la tarde"), pasala en formato 24h: 11:00, 19:00, 15:00
- Si el usuario NO menciona fecha, NO pases fecha (la tool usa hoy automáticamente)
- Si el usuario NO menciona hora, NO pases hora (la tool usa la hora actual)
- Si el usuario menciona varias fechas ("días 8, 9 y 10"), llamá la tool UNA VEZ POR CADA FECHA — no la juntés

PROHIBIDO — NO MENTIR:
- NUNCA confirmés que guardaste algo en una fecha si NO pasaste esa fecha al tool
- Después de la tool, leé lo que devolvió y confirmá lo que el sistema EFECTIVAMENTE guardó
- Si pasaste fecha=2026-05-08, podés decir "guardé para 8 de mayo". Si no pasaste fecha, decí "guardé para hoy".`;

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
// Todas las tools aceptan fecha (YYYY-MM-DD) y hora (HH:MM) opcionales para backfill histórico.
const dateTimeProps = {
  fecha: { type: 'string', description: 'Fecha YYYY-MM-DD. Solo si el usuario menciona fecha pasada explícita.' },
  hora:  { type: 'string', description: 'Hora HH:MM (24h). Solo si el usuario menciona hora explícita.' },
};

const TOOLS = [
  { name: 'registrar_temperatura',
    description: 'Registra una toma de temperatura de los coolers de bodega. Usalo cuando el usuario dice "anotá temperatura cooler X" o similar.',
    input_schema: { type: 'object', properties: {
      ...dateTimeProps,
      c1Temp: { type: 'number', description: 'Temperatura Cooler 1 en °C. Omitir si no se midió.' },
      c1Enc:  { type: 'boolean', description: 'Cooler 1 encendido. Default true.' },
      c2Temp: { type: 'number', description: 'Temperatura Cooler 2 en °C. Omitir si no se midió.' },
      c2Enc:  { type: 'boolean', description: 'Cooler 2 encendido. Default true.' },
      obs:    { type: 'string', description: 'Observación opcional' },
    }, required: [] }},
  { name: 'registrar_cloro',
    description: 'Registra control de cloro de cisterna. Rango aceptable: 0.5-1.5 ppm.',
    input_schema: { type: 'object', properties: {
      ...dateTimeProps,
      ppm: { type: 'number', description: 'Concentración cloro libre en ppm' },
      obs: { type: 'string', description: 'Observación opcional' },
    }, required: ['ppm'] }},
  { name: 'registrar_fumigacion',
    description: 'Registra fumigación o sanitización de una instalación.',
    input_schema: { type: 'object', properties: {
      ...dateTimeProps,
      instalacion: { type: 'string', enum: ['Instalación Completa','Cooler 1 (0–4°C)','Cooler 2 (-18°C)','Pre-carga','Bodega General','Parqueo Interior'] },
      tipo:        { type: 'string', enum: ['Fumigación General','Desinfección con Cloro','Sanitización Agua-Cloro','Control de Insectos'] },
      resultado:   { type: 'string', enum: ['realizado','pendiente','reprogramado'], description: 'Default: realizado' },
      cloroConc:   { type: 'string', description: 'Concentración cloro % (solo si tipo es Desinfección con Cloro)' },
      obs:         { type: 'string', description: 'Observación opcional' },
    }, required: ['instalacion','tipo'] }},
  { name: 'registrar_bascula',
    description: 'Registra revisión diaria de báscula(s).',
    input_schema: { type: 'object', properties: {
      ...dateTimeProps,
      basculaId: { type: 'string', description: 'ID o nombre de la báscula. Ej: "Báscula 1", "Báscula principal"' },
      ok:        { type: 'boolean', description: 'true=OK, false=con variación' },
      variacion: { type: 'number', description: 'Variación en lbs (solo si ok=false)' },
      obs:       { type: 'string', description: 'Observación opcional' },
    }, required: ['basculaId','ok'] }},
  { name: 'registrar_despacho_dt',
    description: 'Registra inspección de despacho de transporte (DT) — cuando sale un camión a entregar.',
    input_schema: { type: 'object', properties: {
      ...dateTimeProps,
      placa:     { type: 'string' },
      conductor: { type: 'string' },
      cliente:   { type: 'string', description: 'Cliente destino. Ej: Walmart' },
      resultado: { type: 'string', enum: ['aprobado','rechazado'], description: 'Default: aprobado' },
      obs:       { type: 'string' },
    }, required: ['placa','conductor'] }},
  { name: 'registrar_limpieza_transporte',
    description: 'Registra inspección de limpieza de camión (TL) — antes de cargar producto.',
    input_schema: { type: 'object', properties: {
      ...dateTimeProps,
      placa:     { type: 'string' },
      conductor: { type: 'string' },
      tipo:      { type: 'string', enum: ['interno','externo'], description: 'Camión interno AJÚA o transportista externo' },
      resultado: { type: 'string', enum: ['aprobado','rechazado'], description: 'Default: aprobado' },
      obs:       { type: 'string' },
    }, required: ['placa'] }},
  { name: 'registrar_visita',
    description: 'Registra visita externa a planta (auditor, proveedor, contratista).',
    input_schema: { type: 'object', properties: {
      ...dateTimeProps,
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
      ...dateTimeProps,
      nombre:    { type: 'string' },
      sintoma:   { type: 'string', description: 'Síntoma: gripe, gastrointestinal, herida abierta, etc' },
      diasFalta: { type: 'integer', description: 'Días estimados de ausencia' },
      obs:       { type: 'string' },
    }, required: ['nombre','sintoma'] }},
  { name: 'registrar_capacitacion',
    description: 'Registra capacitación BPM dada al personal.',
    input_schema: { type: 'object', properties: {
      ...dateTimeProps,
      tema:       { type: 'string', description: 'Tema de la capacitación' },
      asistentes: { type: 'array', items: { type: 'string' }, description: 'Nombres de empleados asistentes' },
      duracion:   { type: 'string', description: 'Ej: "1 hora", "30 min"' },
      obs:        { type: 'string' },
    }, required: ['tema'] }},
  { name: 'registrar_lavado_producto',
    description: 'Registra lavado de producto en tanque con cloro.',
    input_schema: { type: 'object', properties: {
      ...dateTimeProps,
      producto: { type: 'string', description: 'Producto lavado. Ej: repollo, brócoli' },
      tanque:   { type: 'string', description: 'Tanque usado. Ej: T1, T2, T3' },
      ppm:      { type: 'number', description: 'Cloro libre en ppm. Rango BPM: 0.5-2 ppm' },
      obs:      { type: 'string' },
    }, required: ['producto','ppm'] }},
  { name: 'registrar_recepcion_proveedor',
    description: 'Registra una recepción de producto comprado a un proveedor (entra a cuentas proveedores). Usalo cuando dicen "compré X libras de Y a Z quetzales al proveedor W", "recibí producto de X", "anotá compra de X".',
    input_schema: { type: 'object', properties: {
      ...dateTimeProps,
      proveedor:  { type: 'string', description: 'Nombre del proveedor (parcial OK). Ej: "Colo", "Sergio Colo", "Juan"' },
      producto:   { type: 'string', description: 'Producto recibido. Ej: repollo, brócoli, zanahoria' },
      cantidad:   { type: 'number', description: 'Cantidad recibida' },
      unidad:     { type: 'string', enum: ['lb','kg','qq','caja','bulto','unidad'], description: 'Unidad. Default lb.' },
      precioUnit: { type: 'number', description: 'Precio unitario en Q. Si dan total y cantidad, dividilo.' },
      factura:    { type: 'string', description: 'Número de factura (opcional)' },
      notas:      { type: 'string', description: 'Notas internas (opcional)' },
    }, required: ['proveedor','producto','cantidad','precioUnit'] }},
  { name: 'registrar_pago_proveedor',
    description: 'Registra un pago hecho a un proveedor.',
    input_schema: { type: 'object', properties: {
      ...dateTimeProps,
      proveedor:  { type: 'string', description: 'Nombre del proveedor (parcial OK)' },
      monto:      { type: 'number', description: 'Monto pagado en Q' },
      metodoPago: { type: 'string', enum: ['transferencia','cheque','efectivo','débito'] },
      referencia: { type: 'string', description: 'Número de transferencia/cheque (opcional)' },
      notas:      { type: 'string' },
    }, required: ['proveedor','monto'] }},
];

// Buscar proveedor por nombre (parcial, case-insensitive)
async function findProveedor(nombre) {
  const r = await fetch(`${FIRESTORE_BASE}/proveedores?pageSize=200`);
  if (!r.ok) return null;
  const d = await r.json();
  const docs = d.documents || [];
  const term = nombre.toLowerCase().trim();
  const matches = docs.filter(doc => {
    const n = doc.fields?.nombre?.stringValue?.toLowerCase() || '';
    return n.includes(term) || term.includes(n);
  }).map(doc => ({
    id: doc.name.split('/').pop(),
    nombre: doc.fields?.nombre?.stringValue || '',
  }));
  return matches;
}

async function execTool(name, input, userName) {
  const fecha = input.fecha || today();
  const hora  = input.hora  || nowHM();
  const base = { fecha, hora, responsable: userName, resp: userName, creadoEn: new Date().toISOString() };
  switch (name) {
    case 'registrar_temperatura': {
      const id = await fsAdd('controlTemp', { ...base,
        c1Temp: input.c1Temp ?? null, c1Enc: input.c1Enc ?? true, c1Obs: '',
        c2Temp: input.c2Temp ?? null, c2Enc: input.c2Enc ?? true, c2Obs: input.obs || '',
      });
      return `OK guardado en controlTemp/${id}. fecha=${fecha}, hora=${hora}, Cooler1=${input.c1Temp ?? '—'}°C, Cooler2=${input.c2Temp ?? '—'}°C, responsable=${userName}.`;
    }
    case 'registrar_cloro': {
      const estado = input.ppm >= 0.5 && input.ppm <= 1.5 ? '✓ En rango' : input.ppm < 0.5 ? '⚠ Bajo' : '⚠ Alto';
      const id = await fsAdd('controlCloro', { ...base, ppm: input.ppm, obs: input.obs || '', estado });
      return `OK guardado en controlCloro/${id}. fecha=${fecha}, hora=${hora}, ${input.ppm} ppm — ${estado}, responsable=${userName}.`;
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
      const id = await fsAdd('vis', { fecha,
        nombre: input.nombre, empresa: input.empresa || '', dpi: input.dpi || '',
        motivo: input.motivo, area: input.area || '', aut: input.aut || userName,
        he: hora, hs: '', obs: '', estado: 'adentro',
      });
      return `OK guardado en vis/${id}. Visita ${input.nombre} (${input.empresa || 's/empresa'}) — fecha real escrita en DB: ${fecha} ${hora}.`;
    }
    case 'registrar_empleado_enfermo': {
      const id = await fsAdd('ee', { fecha, creadoEn: new Date().toISOString(),
        nombre: input.nombre, sintoma: input.sintoma, diasFalta: input.diasFalta || 0,
        obs: input.obs || '', estado: 'ausente', responsable: userName,
      });
      return `OK guardado en ee/${id}. ${input.nombre} con ${input.sintoma}, fecha real escrita: ${fecha}.`;
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
    case 'registrar_recepcion_proveedor': {
      const matches = await findProveedor(input.proveedor);
      if (!matches || matches.length === 0) {
        return `ERROR: no encontré proveedor que coincida con "${input.proveedor}". Pediselo al usuario que confirme el nombre exacto.`;
      }
      if (matches.length > 1) {
        return `AMBIGUO: hay ${matches.length} proveedores que coinciden con "${input.proveedor}": ${matches.map(m => m.nombre).join(', ')}. Preguntale al usuario cuál es.`;
      }
      const prov = matches[0];
      const totalBruto = Number((input.cantidad * input.precioUnit).toFixed(2));
      const id = await fsAdd('cuentasProveedores', {
        fecha, creadoEn: new Date().toISOString(),
        proveedorId: prov.id, proveedorNombre: prov.nombre,
        tipo: 'recepcion',
        producto: input.producto, cantidad: input.cantidad,
        unidad: input.unidad || 'lb', precioUnit: input.precioUnit, totalBruto,
        factura: input.factura || '', descripcion: '', notas: input.notas || '',
        creadoPor: userName,
      });
      return `OK guardado en cuentasProveedores/${id}. Recepción ${prov.nombre}: ${input.cantidad} ${input.unidad || 'lb'} ${input.producto} × Q${input.precioUnit} = Q${totalBruto.toLocaleString('es-GT', { minimumFractionDigits: 2 })}. Fecha: ${fecha}.`;
    }
    case 'registrar_pago_proveedor': {
      const matches = await findProveedor(input.proveedor);
      if (!matches || matches.length === 0) {
        return `ERROR: no encontré proveedor "${input.proveedor}".`;
      }
      if (matches.length > 1) {
        return `AMBIGUO: ${matches.map(m => m.nombre).join(', ')}. Preguntá cuál.`;
      }
      const prov = matches[0];
      const id = await fsAdd('cuentasProveedores', {
        fecha, creadoEn: new Date().toISOString(),
        proveedorId: prov.id, proveedorNombre: prov.nombre,
        tipo: 'pago',
        monto: input.monto,
        metodoPago: input.metodoPago || 'transferencia',
        referencia: input.referencia || '',
        descripcion: '', notas: input.notas || '',
        creadoPor: userName,
      });
      return `OK guardado en cuentasProveedores/${id}. Pago a ${prov.nombre}: Q${input.monto.toLocaleString('es-GT', { minimumFractionDigits: 2 })} vía ${input.metodoPago || 'transferencia'}. Fecha: ${fecha}.`;
    }
    default:
      return `Tool ${name} no implementada.`;
  }
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

function buildSystemPrompt() {
  const hoy = today();
  const ahora = nowHM();
  const fechaLarga = new Date().toLocaleDateString('es-GT', { timeZone: GT_TZ, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return `${SYSTEM_PROMPT}\n\nCONTEXTO DE TIEMPO:\nHoy es ${fechaLarga} (${hoy}). Hora actual Guatemala: ${ahora}.\n\nCalcula fechas relativas desde HOY=${hoy}:\n- "ayer" = ${addDays(hoy,-1)}\n- "anteayer" = ${addDays(hoy,-2)}\n- "hace 3 días" = ${addDays(hoy,-3)}\n- "el 8" del mes en curso = ${hoy.slice(0,8)}08\n- Si solo dicen un día (ej "el lunes"), elegí la fecha más reciente que NO sea futura.`;
}
function addDays(yyyymmdd, n) {
  const d = new Date(yyyymmdd + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function callAnthropic(apiKey, messages) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: buildSystemPrompt(), tools: TOOLS, messages }),
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
