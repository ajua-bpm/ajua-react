import { useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';

const MAX_HISTORY = 16;
const trimHistory = (msgs) =>
  msgs.length > MAX_HISTORY ? msgs.slice(msgs.length - MAX_HISTORY) : msgs;

export function useIngieMari() {
  const { user } = useAuth();
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
      const res = await fetch('/api/mari', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          messages: nextHist.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);

      const reply = data?.reply || '(respuesta vacía)';
      setMessages(prev => trimHistory([...prev, { role: 'assistant', content: reply }]));
    } catch (e) {
      setError(e.message);
      setMessages(prev => trimHistory([...prev, { role: 'assistant', content: `⚠ ${e.message}` }]));
    } finally {
      setLoading(false);
    }
  }, [messages, loading, user]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, sendMessage, clearHistory, loading, error };
}
