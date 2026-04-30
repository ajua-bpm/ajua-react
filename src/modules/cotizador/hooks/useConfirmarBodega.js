import { useWrite } from '../../../hooks/useFirestore';
import { useToast } from '../../../components/Toast';

export function useConfirmarBodega() {
  const { add: addEntrada }  = useWrite('ientradas');
  const { update: updateCot } = useWrite('cotizaciones');
  const toast = useToast();

  const confirmar = async (cot, form) => {
    const { fecha, responsable, obs, cantidades } = form;
    const di = cot.ducaInfo || {};
    let n = 0;

    for (const p of (cot.productos || [])) {
      const c    = cantidades?.[p.id] || {};
      const kg   = parseFloat(c.kg)   || p.kgT || 0;
      const bultos = parseFloat(c.cant) || p.qty || 0;
      const lbs  = kg * 2.20462;
      await addEntrada({
        fecha,
        productoId:     p.productoId  || '',
        productoNombre: p.nom          || '',
        lbsTotal: lbs, kgTotal: kg, bultos,
        unidad: p.unit || 'bulto',
        costoTotal: p.costoTot || 0,
        costoLb: lbs > 0 ? (p.costoTot||0)/lbs : 0,
        source:        'cotizador',
        cotizacionId:  cot.id,
        cotizacionNom: cot.nombre || '',
        duca:           di.numeroDuca      || '',
        factProveedor:  di.factProveedor   || '',
        factProductor:  di.factProductor   || '',
        productorId:    di.productorId     || '',
        productorNombre:di.productorNombre || '',
        proveedorId:    di.proveedorId     || '',
        proveedorNombre:di.proveedorNombre || '',
        obs,
        creadoEn: new Date().toISOString(),
      });
      n++;
    }

    const bodegaInfo = {
      fecha, responsable, obs, cantidades,
      duca:           di.numeroDuca      || '',
      factProveedor:  di.factProveedor   || '',
      factProductor:  di.factProductor   || '',
      productorId:    di.productorId     || '',
      productorNombre:di.productorNombre || '',
      proveedorId:    di.proveedorId     || '',
      proveedorNombre:di.proveedorNombre || '',
      ts: new Date().toISOString(),
    };
    await updateCot(cot.id, { bodegaInfo, estado: 'bodega' });
    toast(`✅ ${n} entrada${n!==1?'s':''} creadas en inventario`);
    return n;
  };

  return { confirmar };
}
