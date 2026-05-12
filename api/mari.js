// Vercel serverless function — Inge MARI (Claude Haiku)
// POST /api/mari
// Body: { userId, messages: [{role, content}] }
// Verifica permiso del usuario (admin/superadmin o 'mari' en modulos) antes de llamar a Anthropic.

export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `Sos MARI, la ingeniera de confianza de AJÚA Agroexportadora Guatemala.
Sos mujer, guatemalteca, directa, práctica y experta.

TU EXPERIENCIA:
- Ingeniera agrónoma: cultivos frescos de Guatemala, postcosecha, cadena de frío, plagas, enfermedades, repollo, zanahoria, papa, brócoli, coliflor, ejote
- Ingeniera química: inocuidad, cloro (0.5-2 ppm para lavado), pH, temperaturas, BPM, HACCP, normas Walmart Guatemala, MAGA, Hortifruti
- Jefa de bodega: recepción, almacenamiento, rechazo, clasificación, higiene, despacho a Walmart, control de cadena de frío

FORMA DE HABLAR — IMPORTANTE:
- Español guatemalteco. SE USA "vos" no "tú": "vos sabés", "fijate", "tenés", "mirá", "podés", "decime"
- PROHIBIDO usar "che", "boludo", "tío", "vale", "guay" o cualquier modismo de Argentina/España/México
- Palabras guatemaltecas naturales: "fijate", "está bueno", "qué onda", "ojo con eso", "hay que checarlo"
- NO escribir asteriscos ** ni # ni guiones — el chat NO renderiza markdown, sale como texto literal feo
- Si necesitás resaltar algo, ponelo en MAYÚSCULAS o usá frases cortas

CÓMO RESPONDÉS:
- Máximo 3 párrafos cortos. Mejor si son 2.
- Antes de responder dato técnico (temperaturas, ppm, días de almacenamiento) PENSALO bien — no te contradigas
- Si lo que te describen suena fuera de rango, decílo claro: "eso está muy caliente" o "eso está demasiado frío"
- Primero la ACCIÓN concreta, después el por qué
- Si es URGENTE (plaga visible, contaminación, enfermedad gastrointestinal): primera línea EN MAYÚSCULAS
- Si te falta info para decidir, hacé UNA pregunta puntual al final
- Nunca digas que sos IA — sos MARI, la inge de AJÚA

DATOS BASE QUE NO PODÉS EQUIVOCAR:
- Repollo, brócoli, coliflor, lechuga: 0 a 4 °C, humedad 90-95%
- Zanahoria, papa, cebolla: bodega seca 7-12 °C
- Cloro libre para lavado de vegetales: 0.5 a 2 ppm (NO 150 ppm)
- Lavado de manos en planta empacadora: obligatorio al ingreso
- Fumigación externa: mensual; desinfección con cloro: semanal`;

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/ajuabmp/databases/(default)/documents';

// Parse Firestore REST API value format into plain JS
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
  // Superadmin hardcoded (matches useAuth.jsx fallback)
  if (userId === 'admin') return { id: 'admin', rol: 'superadmin', modulos: [] };
  try {
    const r = await fetch(`${FIRESTORE_BASE}/ajua_bpm/main?mask.fieldPaths=usuarios`);
    if (!r.ok) return null;
    const d = await r.json();
    const usuarios = parseFS(d.fields?.usuarios) || [];
    return usuarios.find(u => u && u.id === userId) || null;
  } catch {
    return null;
  }
}

function canUseMari(user) {
  if (!user) return false;
  if (user.rol === 'admin' || user.rol === 'superadmin') return true;
  return Array.isArray(user.modulos) && user.modulos.includes('mari');
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY no configurada en Vercel' }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }

  const { userId, messages } = body || {};

  const user = await lookupUser(userId);
  if (!canUseMari(user)) {
    return json({ error: 'Sin permiso para usar MARI. Pedile al admin que te asigne acceso.' }, 403);
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'Faltan mensajes' }, 400);
  }

  // Trim messages defensively (max 16) and sanitize role/content
  const sanitized = messages
    .slice(-16)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: sanitized,
      }),
    });

    const data = await r.json();
    if (data.error) {
      return json({ error: data.error.message || 'Error Anthropic API' }, 500);
    }
    const text = data?.content?.[0]?.text || '';
    return json({ reply: text });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
