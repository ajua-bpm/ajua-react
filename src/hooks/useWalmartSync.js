// useWalmartSync — importa pedidos de Walmart desde la cola (ajua_bpm/walmart_queue)
// de forma AUTOMÁTICA en toda la app (no solo en la pestaña Gmail), con notificación.
// El Apps Script de Google lee el correo y llena la cola; esto la vacía hacia pedidosWalmart.
import { useEffect, useRef, useCallback } from 'react';
import { db, doc, getDoc, updateDoc, collection, getDocs, addDoc } from '../firebase';

const today = () => new Date().toISOString().slice(0, 10);
const cajasDe = (rubros) => (rubros || []).reduce((s, r) => s + (r.cajas || 0), 0);

// La cola de Gmail guarda los rubros con nombres cortos (desc/n/prodId); la app usa
// descripcion/item/productoId (como el alta manual). Se normaliza al importar para que
// los pedidos del correo se vean igual que los manuales.
const normRubros = (rubros) => (rubros || []).map(r => ({
  descripcion:     r.descripcion || r.desc || '',
  item:            r.item || r.n || '',
  productoId:      r.productoId || r.prodId || '',
  productoNombre:  r.productoNombre || '',
  cajas:           Number(r.cajas) || 0,
  estado:          r.estado || 'pendiente',
  cajasAceptadas:  r.cajasAceptadas ?? null,
  cajasRechazadas: r.cajasRechazadas ?? null,
}));

export function useWalmartSync({ enabled = true, intervalMs = 3 * 60 * 1000, onNuevo } = {}) {
  const running = useRef(false);

  const sync = useCallback(async (notify = true) => {
    if (running.current) return { nuevos: 0 };
    running.current = true;
    try {
      const qsnap = await getDoc(doc(db, 'ajua_bpm', 'walmart_queue'));
      if (!qsnap.exists()) return { nuevos: 0 };
      const queue = Array.isArray(qsnap.data().queue) ? qsnap.data().queue : [];
      const pendientes = queue.filter(p => !p._importado);
      if (!pendientes.length) return { nuevos: 0, total: queue.length };

      const peds = (await getDocs(collection(db, 'pedidosWalmart'))).docs.map(d => ({ id: d.id, ...d.data() }));

      // Dedup por CONTENIDO: mismo día + rampa + misma firma de productos (item+descripción+cajas).
      // Así un "agregado" (otro producto el mismo día/rampa) SÍ entra, y un reenvío idéntico se ignora.
      // NO se usa el correlativo: Walmart lo reutiliza entre pedidos distintos (mergearía pedidos reales).
      const firma = (rubros) => (rubros || [])
        .map(r => `${(r.item || r.n || '').toString().trim()}~${(r.descripcion || r.desc || '').toString().trim().toUpperCase()}~${Number(r.cajas) || 0}`)
        .sort().join('|');
      const existe = (p) => {
        if (p.id && peds.some(r => r.walmartQueueId === p.id)) return true;
        const fp = firma(p.rubros);
        if (!fp) return false; // sin productos: no se puede deduplicar con seguridad → importar
        return peds.some(r =>
          r.fechaEntrega === p.fechaEntrega && (r.rampa || '') === (p.rampa || '') && firma(r.rubros) === fp
        );
      };

      const queueUpd = [...queue];
      let nuevos = 0;
      for (const p of pendientes) {
        const idx = queueUpd.findIndex(q => q.id === p.id);
        if (existe(p)) { if (idx >= 0) queueUpd[idx] = { ...queueUpd[idx], _importado: true }; continue; }
        const totalCajas = cajasDe(p.rubros);
        await addDoc(collection(db, 'pedidosWalmart'), {
          fecha: p.fechaEntrega || today(), fechaEntrega: p.fechaEntrega || today(), cliente: 'Walmart',
          correlativo: p.correlativo || '', walmartQueueId: p.id || '', numOC: '', numAtlas: '',
          rampa: p.rampa || '', horaEntrega: p.horaEntrega || '16:00', descripcion: p.emailAsunto || p.nota || '',
          rubros: normRubros(p.rubros), productos: [], totalCajas, total: 0, estado: 'pendiente', fuente: 'gmail',
          solicitante: p.solicitante || '', numFel: '', montoFactura: 0, fechaFactura: '', estadoCobro: 'pendiente',
          gmailData: { subject: p.emailAsunto || '', from: p.solicitanteEmail || '', date: p.emailFecha || '' },
          obs: '', creadoEn: new Date().toISOString(),
        });
        if (idx >= 0) queueUpd[idx] = { ...queueUpd[idx], _importado: true };
        nuevos++;
      }

      // Marcar la cola (si el permiso lo bloquea no importa: el dedup evita duplicados igual)
      try {
        await updateDoc(doc(db, 'ajua_bpm', 'walmart_queue'), { queue: queueUpd, lastImported: new Date().toISOString() });
      } catch { /* sin permiso de escritura en la cola — no es crítico */ }

      if (nuevos > 0) {
        if (notify && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try { new Notification('AJÚA — Pedido Walmart', { body: `${nuevos} pedido${nuevos > 1 ? 's' : ''} nuevo${nuevos > 1 ? 's' : ''} de Walmart`, icon: '/favicon.ico' }); } catch { /* */ }
        }
        onNuevo?.(nuevos);
      }
      return { nuevos, total: queue.length };
    } catch (e) {
      return { nuevos: 0, error: e.message };
    } finally {
      running.current = false;
    }
  }, [onNuevo]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    sync(true);
    const id = setInterval(() => sync(true), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, sync]);

  return { sync };
}
