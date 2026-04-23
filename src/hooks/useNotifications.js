import { useState, useEffect } from 'react';

// Browser Notification API — sin FCM/VAPID
// Las notificaciones funcionan mientras la app esté abierta en el browser.

export function useNotifications() {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const supported = typeof Notification !== 'undefined' && 'serviceWorker' in navigator;

  useEffect(() => {
    if (supported) setPermission(Notification.permission);
  }, [supported]);

  const requestPermission = async () => {
    if (!supported) return false;
    const perm = await Notification.requestPermission();
    setPermission(perm);
    return perm === 'granted';
  };

  return { permission, supported, requestPermission };
}

// Mostrar notificación browser (llamar desde cualquier componente)
export function notificar(title, body, url = 'https://app.agroajua.com') {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const n = new Notification(title, {
    body,
    icon:  '/favicon.svg',
    badge: '/favicon.svg',
    tag:   title,
  });
  if (url) n.onclick = () => { window.focus(); n.close(); };
}
