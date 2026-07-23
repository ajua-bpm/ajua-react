// Parser de facturas FEL Guatemala (XML). Extraído para reuso entre
// ImportadorFEL (viejo) y FinanzasVentas (hub nuevo). Misma lógica.

function attr(el, name) { return el?.getAttribute(name) || ''; }

export function parseFEL(xmlText, nitEmpresa) {
  try {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const q = (sel) => doc.querySelector(sel);

    const timbre = q('TimbreFiscalDigital') || q('[nodeName*="TimbreFiscalDigital"]');
    const uuid = timbre ? (attr(timbre, 'UUID') || attr(timbre, 'uuid')) : '';

    const datosEm = q('DatosEmision') || q('[FechaHoraEmision]');
    const fecha = (attr(datosEm, 'FechaHoraEmision') || '').slice(0, 10);

    const emisor = q('Emisor');
    const receptor = q('Receptor');
    const emisorNIT = attr(emisor, 'NITEmisor') || attr(emisor, 'Nit') || attr(emisor, 'NIT') || '';
    const emisorNombre = attr(emisor, 'NombreEmisor') || attr(emisor, 'Nombre') || '';
    const receptorNIT = attr(receptor, 'IDReceptor') || attr(receptor, 'Nit') || '';
    const receptorNombre = attr(receptor, 'NombreReceptor') || attr(receptor, 'Nombre') || '';

    const totales = q('Totales');
    const montoTotal = parseFloat(attr(totales, 'GranTotal').replace(/,/g, '')) || 0;

    let iva = 0;
    doc.querySelectorAll('Impuesto').forEach(imp => {
      if (/IVA/i.test(attr(imp, 'NombreCorto')) || /IVA/i.test(attr(imp, 'Nombre'))) {
        iva = parseFloat(attr(imp, 'MontoImpuesto').replace(/,/g, '')) || 0;
      }
    });
    if (!iva) iva = montoTotal / 1.12 * 0.12;

    const nitLimpio = (nitEmpresa || '').replace(/[^0-9]/g, '');
    const emisorNITLimpio = emisorNIT.replace(/[^0-9]/g, '');
    const tipoFEL = (nitLimpio && emisorNITLimpio === nitLimpio) ? 'emitida' : 'recibida';

    const esWalmart = /WALMART|WAL.MART/i.test(receptorNombre + emisorNombre);
    const ivaRetenido = esWalmart ? iva * 0.80 : 0;
    const montoNeto = montoTotal - ivaRetenido;

    if (!uuid || !fecha || !montoTotal) return null;

    return {
      uuid, fecha, tipoFEL, emisorNIT, emisorNombre, receptorNIT, receptorNombre,
      montoTotal, iva, ivaRetenido, montoNeto,
    };
  } catch { return null; }
}

// Normaliza un NIT/RTU a solo dígitos para comparar
export function nitDigits(v) { return (v || '').replace(/[^0-9]/g, ''); }
