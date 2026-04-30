# AJÚA BPM — Configurar Notificaciones Push

## PASO 1 — Obtener VAPID Key (Firebase Console)

1. Ir a https://console.firebase.google.com → proyecto **ajuabmp**
2. Engranaje → **Project Settings** → pestaña **Cloud Messaging**
3. Bajar a **Web Push certificates**
4. Clic en **Generate key pair** (o usar existente)
5. Copiar la **Key pair** (clave pública, ~88 caracteres)

## PASO 2 — Agregar VAPID Key en Vercel

1. Ir a https://vercel.com → proyecto `ajua-react`
2. Settings → **Environment Variables**
3. Agregar:
   - **Name:** `VITE_VAPID_KEY`
   - **Value:** la clave pública copiada
   - **Environment:** Production + Preview
4. Clic **Save**
5. Re-deployar: `npx vercel deploy --prod --yes`

## PASO 3 — Activar en Chrome/Edge (Windows)

1. Abrir **Chrome** en https://app.agroajua.com
2. Hacer login
3. En el Dashboard aparece banner: **"🔔 Recibí alertas de pedidos nuevos"**
4. Clic en **Activar** → aceptar permiso en el navegador
5. Listo — este PC recibirá notificaciones aunque la app esté cerrada

## PASO 4 — Activar en Android (Chrome)

1. Abrir **Chrome** en https://app.agroajua.com
2. Menú (tres puntos) → **"Agregar a pantalla de inicio"**
3. Se instala como PWA
4. Abrirla → hacer login → clic **Activar** en el banner
5. Listo — recibirá notificaciones push nativas

## QUÉ DISPARA UNA NOTIFICACIÓN

| Evento | Notificación |
|--------|-------------|
| Nuevo pedido en tienda.agroajua.com | 🛒 Nuevo pedido — Tienda · Cliente · Q monto |
| Nuevo pedido Walmart en app | 📦 Nuevo pedido Walmart · descripción · X cajas |

## CÓMO FUNCIONA

- **Primer plano** (app abierta): notificación del sistema operativo via JS
- **Segundo plano** (app cerrada): Service Worker recibe push de Firebase, muestra notificación nativa
- **Al hacer clic** en la notificación: abre la URL correspondiente en Chrome

## TOKENS GUARDADOS

Los tokens FCM se guardan en Firestore:
```
fcmTokens/{uid} → { token, uid, nombre, dispositivo, fecha }
```
Cada dispositivo que activa notificaciones registra su token.
Las Cloud Functions leen todos los tokens y envían a cada dispositivo.
