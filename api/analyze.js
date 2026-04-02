// Vercel serverless function — Análisis financiero con Claude AI
// POST /api/analyze
// Body: { periodo, financiero, bpm, gastos }

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada en Vercel' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400 });
  }

  const { periodo, financiero, bpm, gastos } = body;

  const prompt = `Eres el asesor financiero y de operaciones de AGROINDUSTRIA AJÚA, empresa guatemalteca de importación y distribución de vegetales frescos.
Analiza el siguiente reporte del período ${periodo} y da un análisis ejecutivo con recomendaciones concretas.

## ESTADO FINANCIERO
- Ventas Walmart: Q ${financiero.ingWalmart}
- Ventas GT (Local): Q ${financiero.ingGT}
- TOTAL INGRESOS: Q ${financiero.totalIngresos}
- Costos Importación MX: Q ${financiero.costImport}
- Costo Producto: Q ${financiero.costProducto}
- TOTAL COSTOS DIRECTOS: Q ${financiero.totalCostos}
- UTILIDAD BRUTA: Q ${financiero.utilBruta} (${financiero.margenBruto}%)
- Total Gastos Operativos: Q ${financiero.totalGastos}
- UTILIDAD NETA: Q ${financiero.utilNeta} (${financiero.margenNeto}%)

## PRINCIPALES GASTOS OPERATIVOS
${gastos.map(([cat, monto]) => `- ${cat}: Q ${monto}`).join('\n')}

## CUMPLIMIENTO BPM (control de calidad y operaciones)
${bpm.map(m => `- ${m.label}: ${m.stats.pct !== null ? m.stats.pct + '%' : 'Sin datos'} (${m.stats.ok}/${m.stats.total} registros)`).join('\n')}

Proporciona:
1. **RESUMEN EJECUTIVO** (2-3 oraciones sobre el desempeño general)
2. **ANÁLISIS FINANCIERO** (puntos clave: márgenes, tendencias, alertas)
3. **ANÁLISIS BPM** (qué módulos preocupan, qué riesgos operativos hay)
4. **RECOMENDACIONES** (3-5 acciones concretas priorizadas por impacto)
5. **ALERTA PRIORITARIA** (el problema más urgente a atender)

Responde en español, de forma clara y directa. Usa Q para quetzales guatemaltecos.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    if (data.error) {
      return new Response(JSON.stringify({ error: data.error.message || 'Error Anthropic API' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    const text = data.content?.[0]?.text || '';
    return new Response(JSON.stringify({ analysis: text }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
