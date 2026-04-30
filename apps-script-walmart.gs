/**
 * AJÚA BPM — Apps Script para importar pedidos Walmart desde Gmail
 *
 * INSTRUCCIONES DE DEPLOY:
 * 1. Ir a https://script.google.com → Nuevo proyecto
 * 2. Pegar este código completo
 * 3. Guardar (Ctrl+S)
 * 4. Clic en "Desplegar" → "Nueva implementación"
 * 5. Tipo: "Aplicación web"
 * 6. Ejecutar como: "Yo (tu cuenta Gmail)"
 * 7. Quién tiene acceso: "Cualquier persona"
 * 8. Clic "Desplegar" → copiar la URL generada
 * 9. Pegar esa URL en Walmart → Tab Gmail → Configurar URL
 *
 * PERSONALIZACIÓN:
 * - Cambiar SENDER_FILTER para filtrar por remitente real de Walmart Guatemala
 * - Cambiar SUBJECT_FILTER para el asunto exacto de los correos
 * - Ajustar parseWalmartEmail() según el formato real del correo
 */

// ── Configuración ──────────────────────────────────────────────────
var SENDER_FILTER  = 'walmart';        // Parte del email del remitente
var SUBJECT_FILTER = 'orden de compra'; // Parte del asunto a buscar
var DAYS_BACK      = 30;               // Cuántos días atrás revisar
var MAX_EMAILS     = 20;               // Máximo de correos a procesar

// ── Handler principal ──────────────────────────────────────────────
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    var pedidos = fetchWalmartEmails();
    var output = ContentService.createTextOutput(JSON.stringify({
      ok: true,
      pedidos: pedidos,
      total: pedidos.length,
      timestamp: new Date().toISOString()
    }));
    output.setMimeType(ContentService.MimeType.JSON);
    // CORS headers
    return output;
  } catch (err) {
    var errOut = ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: err.message
    }));
    errOut.setMimeType(ContentService.MimeType.JSON);
    return errOut;
  }
}

// ── Leer correos de Gmail ──────────────────────────────────────────
function fetchWalmartEmails() {
  var since = new Date();
  since.setDate(since.getDate() - DAYS_BACK);
  var sinceStr = Utilities.formatDate(since, 'GMT-6', 'yyyy/MM/dd');

  // Búsqueda en Gmail
  var query = 'from:' + SENDER_FILTER + ' subject:' + SUBJECT_FILTER + ' after:' + sinceStr;
  var threads = GmailApp.search(query, 0, MAX_EMAILS);

  var pedidos = [];

  for (var i = 0; i < threads.length; i++) {
    var msgs = threads[i].getMessages();
    for (var j = 0; j < msgs.length; j++) {
      var msg = msgs[j];
      var parsed = parseWalmartEmail(msg);
      if (parsed) pedidos.push(parsed);
    }
  }

  return pedidos;
}

// ── Parser del correo ──────────────────────────────────────────────
// AJUSTA ESTA FUNCIÓN según el formato real de los correos de Walmart GT
function parseWalmartEmail(msg) {
  try {
    var subject = msg.getSubject();
    var body    = msg.getPlainBody();
    var from    = msg.getFrom();
    var date    = msg.getDate();

    var result = {
      asunto:       subject,
      from:         from,
      fechaEmail:   Utilities.formatDate(date, 'GMT-6', 'yyyy-MM-dd'),
      numOC:        '',
      fechaEntrega: '',
      totalCajas:   '',
      rampa:        '',
      horaEntrega:  '',
      descripcion:  subject.slice(0, 120),
      gmailId:      msg.getId()
    };

    // OC: busca "OC 12345" o "Orden de Compra 12345" o "#12345"
    var ocMatch = (subject + ' ' + body).match(/(?:OC|Orden(?:\s+de\s+Compra)?)[:\s#]*(\d{4,8})/i);
    if (ocMatch) result.numOC = ocMatch[1];

    // Fecha de entrega: dd/mm/yyyy o yyyy-mm-dd
    var dateMatch = body.match(/(?:entrega|deliver)[^:]*:\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i);
    if (!dateMatch) dateMatch = body.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dateMatch) {
      var a = dateMatch[1], b = dateMatch[2], c = dateMatch[3];
      if (c.length === 4) result.fechaEntrega = c + '-' + b.padStart(2,'0') + '-' + a.padStart(2,'0');
    }

    // Cajas
    var cajasMatch = body.match(/(\d+)\s*(?:cajas?|boxes?)/i);
    if (cajasMatch) result.totalCajas = cajasMatch[1];

    // Rampa
    var rampaMatch = body.match(/rampa[:\s]*(\w+)/i);
    if (rampaMatch) result.rampa = rampaMatch[1];

    // Hora de entrega
    var horaMatch = body.match(/hora[:\s]*(\d{1,2}:\d{2})/i);
    if (horaMatch) result.horaEntrega = horaMatch[1];

    return result;
  } catch (e) {
    return null;
  }
}
