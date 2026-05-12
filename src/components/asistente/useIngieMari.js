import { useState, useCallback } from 'react';

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

const MAX_HISTORY = 16;
const trimHistory = (msgs) =>
  msgs.length > MAX_HISTORY ? msgs.slice(msgs.length - MAX_HISTORY) : msgs;

export function useIngieMari() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState(null);

  const sendMessage = useCallback(async (text) => {
    const t = (text || '').trim();
    if (!t || loading) return;

    const userMsg = { role: 'user', content: t };
    const nextHist = trimHistory([...messages, userMsg]);
    setMessages(nextHist);
    setLoading(true);
    setError(null);

    try {
      const apiKey = import.meta.env.VITE_ANTHROPIC_KEY;
      if (!apiKey) throw new Error('Falta VITE_ANTHROPIC_KEY en .env');

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          system: SYSTEM_PROMPT,
          messages: nextHist.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Error API ${res.status}`);
      }

      const data = await res.json();
      const reply = data?.content?.[0]?.text || '(respuesta vacía)';
      setMessages(prev => trimHistory([...prev, { role: 'assistant', content: reply }]));
    } catch (e) {
      setError(e.message);
      setMessages(prev => trimHistory([...prev, { role: 'assistant', content: `⚠ ${e.message}` }]));
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, sendMessage, clearHistory, loading, error };
}
