// useWalmartSync — importa pedidos de Walmart desde la cola (ajua_bpm/walmart_queue)
// de forma AUTOMÁTICA en toda la app (no solo en la pestaña Gmail), con notificación.
// El Apps Script de Google lee el correo y llena la cola; esto la vacía hacia pedidosWalmart.
import { useEffect, useRef, useCallback } from 'react';
import { db, doc, getDoc, updateDoc, collection, getDocs, addDoc } from '../firebase';

const today = () => new Date().toISOString().slice(0, 10);
const cajasDe = (rubros) => (rubros || []).reduce((s, r) => s + (r.cajas || 0), 0);

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

      // Dedup: id único de la cola, correlativo, o (respaldo para cargados a mano)
      // mismo día + rampa + cantidad de rubros. Verificado: cubre los 31 de la cola sin duplicar.
      const existe = (p) => {
        const nR = (p.rubros || []).length;
        return peds.some(r =>
          (p.id && r.walmartQueueId === p.id) ||
          (p.correlativo && r.correlativo && r.correlativo === p.correlativo) ||
          (p.fechaEntrega && r.fechaEntrega === p.fechaEntrega && (r.rampa || '') === (p.rampa || '') &&
            (r.rubros?.length || 0) === nR)
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
          rubros: p.rubros || [], productos: [], totalCajas, total: 0, estado: 'pendiente', fuente: 'gmail',
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
