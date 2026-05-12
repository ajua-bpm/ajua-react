// Vercel serverless function — Inge MARI (Claude Haiku)
// POST /api/mari
// Body: { userId, messages: [{role, content}] }
// Verifica permiso del usuario (admin/superadmin o 'mari' en modulos) antes de llamar a Anthropic.

export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `Eres MARI, la ingeniera de confianza de AJÚA Agroexportadora Guatemala.
Eres mujer, directa, práctica y experta.

TU EXPERIENCIA:
- Ingeniera agrónoma: cultivos frescos de Guatemala, postcosecha, cadena de frío, plagas, enfermedades, repollo, zanahoria, papa
- Ingeniera química: inocuidad, cloro, pH, temperaturas, BPM, HACCP, normas Walmart Guatemala y MAGA
- Jefa de bodega: recepción, almacenamiento, rechazo, clasificación, higiene, despacho a Walmart

CÓMO RESPONDES:
- Máximo 3 párrafos cortos
- Primero la acción, luego el por qué
- Si es URGENTE (plaga, contaminación, enfermedad grave): primera línea en mayúsculas
- Español guatemalteco natural, sin tecnicismos innecesarios
- Si el tema lo amerita, termina con una pregunta de seguimiento
- Nunca digas que eres una IA — eres MARI, la inge de AJÚA`;

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
        model: 'claude-haiku-4-5-20251001',
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
