importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyCbYbUyMgNxcmkawV3vtOieUT-Hdgr08iY",
  authDomain:        "ajuabmp.firebaseapp.com",
  projectId:         "ajuabmp",
  storageBucket:     "ajuabmp.firebasestorage.app",
  messagingSenderId: "681963417089",
  appId:             "1:681963417089:web:96b3b75e8d995b0e501a00",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title = 'AJÚA', body = '' } = payload.notification || {};
  const link = payload.data?.url || 'https://app.agroajua.com';

  self.registration.showNotification(title, {
    body,
    icon:  '/favicon.svg',
    badge: '/favicon.svg',
    data:  { url: link, ...payload.data },
    tag:   payload.data?.tipo || 'ajua',
    requireInteraction: false,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || 'https://app.agroajua.com';
  event.waitUntil(clients.openWindow(url));
});
