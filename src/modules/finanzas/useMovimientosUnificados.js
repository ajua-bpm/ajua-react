// useMovimientosUnificados.js
// Jala TODOS los movimientos de dinero de sus colecciones reales y los normaliza
// a un solo feed para la pantalla única de Finanzas. NO duplica: cada registro
// sigue viviendo en su estado de cuenta (cuentasProveedores, cuentasClientes,
// perAnticipo) — este hook solo los LEE y consolida para mostrar.
import { useMemo } from 'react';
import { useCollection } from '../../hooks/useFirestore';

// Forma normalizada de cada movimiento:
// { id, _col, _origen, fecha, flujo:'entra'|'sale', caja:bool, tipoLabel, entidad, concepto, monto, moneda, estado, _raw }
// caja = true → movió dinero real (cobro/pago/gasto/anticipo). caja = false → devengado (venta a crédito, aún no cobrada).

export function useMovimientosUnificados() {
  // limit alto a propósito: useCollection ya trae la colección entera (el limit es un slice
  // en cliente, no una query), así que un tope alto evita descartar meses viejos sin costo extra.
  // El día que estas colecciones sean enormes, migrar a queries por rango de fecha en Firestore.
  const { data: finanzas,    loading: lf } = useCollection('movimientos_finanzas', { orderField: 'fecha', orderDir: 'desc', limit: 100000 });
  const { data: cxProv,      loading: lp } = useCollection('cuentasProveedores',    { orderField: 'fecha', orderDir: 'desc', limit: 100000 });
  const { data: cxCli,       loading: lc } = useCollection('cuentasClientes',       { orderField: 'fecha', orderDir: 'desc', limit: 100000 });
  const { data: anticipos,   loading: la } = useCollection('perAnticipo',           { orderField: 'fecha', orderDir: 'desc', limit: 100000 });
  const { data: proveedores, loading: lpr } = useCollection('proveedores',          { orderField: 'nombre', limit: 100000 });
  const { data: clientes,    loading: lcl } = useCollection('clientes',             { orderField: 'nombre', limit: 100000 });

  const provMap = useMemo(() => Object.fromEntries((proveedores || []).map(p => [p.id, p.nombre])), [proveedores]);
  const cliMap  = useMemo(() => Object.fromEntries((clientes    || []).map(c => [c.id, c.nombre])), [clientes]);

  const movimientos = useMemo(() => {
    const out = [];

    // 1) Finanzas propio: gastos sueltos, gastos operativos, y cobros/pagos sin entidad
    for (const m of (finanzas || [])) {
      const esCobro = m.tipo === 'cobro';
      // caja = movió dinero real. Un gasto pendiente o pendiente_aprobacion aún NO es caja.
      const efectivo = m.estado !== 'pendiente' && m.estado !== 'pendiente_aprobacion';
      out.push({
        id: m.id, _col: 'movimientos_finanzas', _origen: 'finanzas',
        fecha: m.fecha || '', flujo: esCobro ? 'entra' : 'sale', caja: efectivo,
        tipoLabel: esCobro ? 'Cobro' : (m.tipo === 'gasto_op' ? 'Gasto operativo' : LABEL_CAT[m.categoria] || 'Gasto'),
        entidad: m.proveedor || m.cliente || '',
        concepto: m.concepto || '', monto: num(m.montoGTQ ?? m.monto), moneda: m.moneda || 'GTQ',
        estado: m.estado || 'pagado', _raw: m,
      });
    }

    // 2) Cuentas Proveedores: solo PAGOS (abonos). Las recepciones/compras son del flujo de inventario.
    for (const m of (cxProv || [])) {
      if (m.tipo !== 'pago') continue;
      out.push({
        id: m.id, _col: 'cuentasProveedores', _origen: 'proveedor',
        fecha: m.fecha || '', flujo: 'sale', caja: true, tipoLabel: 'Pago proveedor',
        entidad: provMap[m.proveedorId] || '—',
        concepto: m.descripcion || m.notas || '', monto: num(m.monto), moneda: 'GTQ',
        estado: 'pagado', _raw: m,
      });
    }

    // 3) Cuentas Clientes: despachos (ventas → CxC) y pagos (cobros)
    for (const m of (cxCli || [])) {
      if (m.tipo === 'despacho') {
        out.push({
          id: m.id, _col: 'cuentasClientes', _origen: 'cliente',
          fecha: m.fecha || '', flujo: 'entra', caja: false, tipoLabel: 'Venta',
          entidad: cliMap[m.clienteId] || '—',
          concepto: m.descripcion || m.concepto || '', monto: num(m.totalVenta), moneda: 'GTQ',
          estado: 'pendiente', _raw: m,
        });
      } else if (m.tipo === 'pago') {
        out.push({
          id: m.id, _col: 'cuentasClientes', _origen: 'cliente',
          fecha: m.fecha || '', flujo: 'entra', caja: true, tipoLabel: 'Cobro cliente',
          entidad: cliMap[m.clienteId] || '—',
          concepto: m.descripcion || m.notas || '', monto: num(m.monto), moneda: 'GTQ',
          estado: 'cobrado', _raw: m,
        });
      } else if (m.tipo === 'nota_credito') {
        // Nota de crédito: reduce lo que el cliente debe (devengado, no caja)
        out.push({
          id: m.id, _col: 'cuentasClientes', _origen: 'cliente',
          fecha: m.fecha || '', flujo: 'sale', caja: false, tipoLabel: 'Nota crédito',
          entidad: cliMap[m.clienteId] || '—',
          concepto: m.descripcion || m.notas || '', monto: num(m.valor), moneda: 'GTQ',
          estado: 'nota', _raw: m,
        });
      }
    }

    // 4) Anticipos a empleados
    for (const m of (anticipos || [])) {
      out.push({
        id: m.id, _col: 'perAnticipo', _origen: 'empleado',
        fecha: m.fecha || '', flujo: 'sale', caja: true, tipoLabel: 'Anticipo empleado',
        entidad: m.empleado || '—',
        concepto: m.concepto || 'Anticipo', monto: num(m.monto), moneda: 'GTQ',
        estado: m.estado === 'descontado' ? 'descontado' : 'pendiente', _raw: m,
      });
    }

    // Orden por fecha desc, y dentro de la fecha por creadoEn desc
    out.sort((a, b) => {
      const fa = a.fecha || '', fb = b.fecha || '';
      if (fa !== fb) return fa > fb ? -1 : 1;
      return (b._raw?.creadoEn || '') > (a._raw?.creadoEn || '') ? 1 : -1;
    });
    return out;
  }, [finanzas, cxProv, cxCli, anticipos, provMap, cliMap]);

  const loading = lf || lp || lc || la || lpr || lcl;
  return { movimientos, loading, proveedores: proveedores || [], clientes: clientes || [] };
}

const LABEL_CAT = {
  importacion: 'Importación MX', proveedor_local: 'Proveedor local', servicios: 'Servicio',
  rentas: 'Renta', sueldos: 'Sueldo', impuestos: 'Impuesto', otros: 'Otro',
};

function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }
