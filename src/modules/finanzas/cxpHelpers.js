// Helpers para Cuentas por Pagar consolidado.
// Replican (sin tocar) la lógica de:
//  - Personal.jsx (semana de nómina, match de empleado por nombre/alias)
//  - cuentasProveedores/useCuentaProveedor.js (saldo por proveedor)
// Se replica a propósito para NO acoplar ni arriesgar los módulos que ya funcionan.

// ── Nómina: semana (lunes→domingo) ──────────────────────────────────
export const weekOf = (d) => {
  const dt = new Date(d + 'T12:00:00');
  const day = dt.getDay();               // 0=domingo
  const diff = day === 0 ? -6 : 1 - day; // volver al lunes
  dt.setDate(dt.getDate() + diff);
  return dt.toISOString().slice(0, 10);
};
export const weekEnd = (lunes) => {
  const dt = new Date(lunes + 'T12:00:00');
  dt.setDate(dt.getDate() + 6);
  return dt.toISOString().slice(0, 10);
};

// ── Match de empleado por nombre + aliases (igual que Personal) ──────
export function nombresEmp(emp) {
  const base = (emp?.nombre || '').toLowerCase().trim();
  const als = (emp?.aliases || []).map(a => a.toLowerCase().trim()).filter(Boolean);
  return [base, ...als].filter(Boolean);
}
export function matchEmpNombre(registroNombre, emp) {
  const rn = (registroNombre || '').toLowerCase().trim();
  return nombresEmp(emp).includes(rn);
}

// Días presentes de un empleado en una semana (a partir de registros AL)
export function diasSemana(alData, emp, lunes) {
  const domingo = weekEnd(lunes);
  const set = new Set();
  let horasExtras = 0;
  for (const r of (alData || [])) {
    if (!(r.fecha >= lunes && r.fecha <= domingo)) continue;
    for (const ch of (r.checks || [])) {
      if (!matchEmpNombre(ch.nombre, emp)) continue;
      const tieneHoras = ch.horas && Object.values(ch.horas).some(v => v);
      if (tieneHoras) set.add(r.fecha);
      horasExtras += parseFloat(ch.horasExtras) || 0;
    }
  }
  return { dias: set.size, fechas: [...set].sort(), horasExtras };
}

// ── Saldo por proveedor (replica useCuentaProveedor.js) ──────────────
// movs = todos los movimientos de UN proveedor. Devuelve {comprado, rechazos, pagado, saldo}
export function saldoProveedor(movs) {
  // Rechazos vinculados a una recepción (hijos): ajustan el cargo de esa recepción
  const linkedRej = {};
  for (const m of movs) {
    if (m.tipo === 'rechazo' && m.recepcionId) {
      if (!linkedRej[m.recepcionId]) linkedRej[m.recepcionId] = { qty: 0, money: 0 };
      linkedRej[m.recepcionId].qty += Number(m.cantidadRechazada || 0);
      linkedRej[m.recepcionId].money += Number(m.valorRechazo || 0);
    }
  }
  let comprado = 0, rechazos = 0, pagado = 0;
  for (const m of movs) {
    if (m.tipo === 'recepcion') {
      let cargo;
      if (m.liquidacionId) {
        cargo = Number(m.totalBruto || 0);
      } else {
        const rej = linkedRej[m.id] || { qty: 0, money: 0 };
        const qty = Number(m.cantidad || 0);
        const bruto = Number(m.totalBruto || 0);
        const pu = Number(m.precioUnit || 0) || (qty > 0 ? bruto / qty : 0);
        const qtyNeta = Math.max(0, qty - rej.qty);
        const valorBase = pu > 0 ? qtyNeta * pu : bruto;
        cargo = Math.max(0, valorBase - rej.money);
      }
      comprado += cargo;
    } else if (m.tipo === 'pago') {
      pagado += Number(m.monto || 0);
    } else if (m.tipo === 'rechazo' && !m.recepcionId) {
      rechazos += Number(m.valorRechazo || 0);
    }
  }
  return { comprado, rechazos, pagado, saldo: comprado - rechazos - pagado };
}
