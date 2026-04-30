const { initializeApp } = require('firebase-admin/app');
const { getFirestore }  = require('firebase-admin/firestore');
const { getMessaging }  = require('firebase-admin/messaging');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');

initializeApp();
const db = getFirestore();

// ── Helpers ────────────────────────────────────────────────────────────────

async function getAdminTokens() {
  const snap = await db.collection('fcmTokens').get();
  return snap.docs.map(d => d.data().token).filter(Boolean);
}

async function sendPush(tokens, notification, data = {}) {
  if (!tokens.length) return;
  const result = await getMessaging().sendEachForMulticast({
    tokens,
    notification,
    data,
    webpush: {
      fcmOptions: { link: data.url || 'https://app.agroajua.com' },
      notification: {
        icon:  '/favicon.svg',
        badge: '/favicon.svg',
        requireInteraction: false,
      },
    },
    android: { priority: 'high' },
  });
  console.log(`FCM: ${result.successCount} ok, ${result.failureCount} err`);
}

// ── Trigger: nuevo pedido en Tienda (t_ordenes) ───────────────────────────

exports.notificarNuevoPedidoTienda = onDocumentCreated(
  { document: 't_ordenes/{ordenId}', region: 'us-central1' },
  async (event) => {
    const orden = event.data.data();
    const cliente = orden.clienteNombre || orden.clienteEmail || 'Cliente';
    const total   = (orden.total || 0).toFixed(2);
    const tokens  = await getAdminTokens();

    await sendPush(
      tokens,
      { title: '🛒 Nuevo pedido — Tienda', body: `${cliente} · Q ${total}` },
      {
        tipo:    'pedido_tienda',
        ordenId: event.params.ordenId,
        url:     'https://tienda.agroajua.com/admin/ordenes',
      }
    );
  }
);

// ── Trigger: nuevo pedido Walmart (pedidosWalmart) ────────────────────────

exports.notificarNuevoPedidoWalmart = onDocumentCreated(
  { document: 'pedidosWalmart/{pedidoId}', region: 'us-central1' },
  async (event) => {
    const pedido = event.data.data();
    const desc   = pedido.descripcion || pedido.productos || 'Pedido nuevo';
    const cajas  = pedido.cajas || pedido.cantidad || 0;
    const tokens = await getAdminTokens();

    await sendPush(
      tokens,
      { title: '📦 Nuevo pedido Walmart', body: `${desc} · ${cajas} cajas` },
      {
        tipo:     'pedido_walmart',
        pedidoId: event.params.pedidoId,
        url:      'https://app.agroajua.com/walmart',
      }
    );
  }
);
