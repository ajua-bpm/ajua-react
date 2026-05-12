import { useState, useRef, useCallback, useEffect } from 'react';

const SR = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

const hasTTS = typeof window !== 'undefined' && 'speechSynthesis' in window;

// Pick best Spanish female voice available (varies by OS/browser)
function pickVoice(lang) {
  if (!hasTTS) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  if (voices.length === 0) return null;
  const esVoices = voices.filter(v => v.lang?.startsWith('es'));
  return (
    esVoices.find(v => /female|mujer|paulina|monica|sabina|esperanza|lucia/i.test(v.name)) ||
    esVoices.find(v => v.lang === lang) ||
    esVoices[0] ||
    null
  );
}

export function useVoice({ onTranscript, lang = 'es-GT' } = {}) {
  const [listening, setListening] = useState(false);
  const [speaking,  setSpeaking]  = useState(false);
  const recogRef = useRef(null);
  const supported = !!SR;
  const ttsSupported = hasTTS;

  // Pre-load voices on browsers that defer the list (Chrome)
  useEffect(() => {
    if (!hasTTS) return;
    window.speechSynthesis.getVoices();
    const handler = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', handler);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', handler);
  }, []);

  const startListening = useCallback(() => {
    if (!SR) return;
    if (hasTTS) window.speechSynthesis.cancel();
    setSpeaking(false);

    try { recogRef.current?.stop(); } catch {}
    const r = new SR();
    r.lang = lang;
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;

    r.onstart = () => setListening(true);
    r.onend   = () => { setListening(false); recogRef.current = null; };
    r.onerror = () => { setListening(false); recogRef.current = null; };
    r.onresult = (e) => {
      const t = e.results?.[0]?.[0]?.transcript?.trim() || '';
      if (t && onTranscript) onTranscript(t);
    };

    try { r.start(); recogRef.current = r; } catch { setListening(false); }
  }, [lang, onTranscript]);

  const stopListening = useCallback(() => {
    try { recogRef.current?.stop(); } catch {}
    setListening(false);
  }, []);

  const speak = useCallback((text) => {
    if (!hasTTS || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate  = 1.05;
    u.pitch = 1.1;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.onstart = () => setSpeaking(true);
    u.onend   = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [lang]);

  const stopSpeaking = useCallback(() => {
    if (hasTTS) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  useEffect(() => () => {
    try { recogRef.current?.stop(); } catch {}
    if (hasTTS) window.speechSynthesis.cancel();
  }, []);

  return { listening, speaking, supported, ttsSupported, startListening, stopListening, speak, stopSpeaking };
}
