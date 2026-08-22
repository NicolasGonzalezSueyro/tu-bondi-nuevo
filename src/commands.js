const tubondi = require('./tubondi');
const { estimarMinutos } = require('./eta');

const MENSAJE_AYUDA =
  'Bot de Tu Bondi Cordoba.\n\n' +
  'Uso: /bondi <linea> <parada>\n' +
  'Ej: /bondi A Mariano Fragueiro 4220\n\n' +
  'Otros:\n' +
  '  /bondi lineas -> lista todas las lineas disponibles\n' +
  '  /bondi ayuda -> muestra este mensaje\n\n' +
  '_El ETA es una estimacion en linea recta, puede diferir un poco del real._';

const SENTIDOS = ['I', 'V'];
const MAX_COCHES_MOSTRADOS = 2;
const DEMORA_INVALIDA = 9999;

function formatearListaLineas() {
  const lineas = tubondi.listarLineas();
  return `Lineas disponibles:\n${lineas.join(', ')}`;
}

async function buscarParadasDeLinea(linea) {
  const resultados = [];
  for (const sentido of SENTIDOS) {
    const rutaIds = linea.rutas[sentido];
    if (!rutaIds || rutaIds.length === 0) continue;
    const paradas = await tubondi.getParadas(rutaIds[0], linea.cliente);
    for (const p of paradas) {
      resultados.push({ ...p, sentido });
    }
  }
  return resultados;
}

function formatearCoche(coche, minutos) {
  const rampa = coche.rampa === '1' ? ' (con rampa)' : '';
  return `  - coche ${coche.coche}${rampa}: aprox. ${minutos} min`;
}

async function responderLineaYParada(linea, textoParada) {
  const todasParadas = await buscarParadasDeLinea(linea);
  const coincidencias = tubondi.buscarParada(todasParadas, textoParada);

  if (coincidencias.length === 0) {
    return `No encontre ninguna parada de la linea ${linea.nombre} que coincida con "${textoParada}". Revisa el nombre de la calle e intenta de nuevo.`;
  }

  // Nos quedamos con la primera coincidencia por cada sentido distinto.
  const porSentido = new Map();
  for (const p of coincidencias) {
    if (!porSentido.has(p.sentido)) porSentido.set(p.sentido, p);
  }

  const bloques = [];
  for (const [sentido, parada] of porSentido) {
    const coches = (await tubondi.getCochesDeLinea(linea, sentido)).filter(
      (c) => (c.demora_minutos ?? 0) < DEMORA_INVALIDA
    );

    if (coches.length === 0) {
      bloques.push(
        `*${linea.nombre}* (sentido ${sentido}) - ${parada.parada_nombre}\nNo hay unidades circulando en este momento.`
      );
      continue;
    }

    const conEta = coches
      .map((c) => ({ coche: c, minutos: estimarMinutos(c, parada) }))
      .sort((a, b) => a.minutos - b.minutos)
      .slice(0, MAX_COCHES_MOSTRADOS);

    const lineasTexto = conEta.map((c) => formatearCoche(c.coche, c.minutos)).join('\n');
    bloques.push(`*${linea.nombre}* (sentido ${sentido}) - ${parada.parada_nombre}\n${lineasTexto}`);
  }

  return bloques.join('\n\n');
}

// argsTexto es todo lo que sigue despues de "/bondi " (ya sin el prefijo).
async function procesarComandoBondi(argsTexto) {
  const texto = argsTexto.trim();
  const normalizado = tubondi.normalizar(texto);

  if (normalizado === '' || normalizado === 'AYUDA') {
    return MENSAJE_AYUDA;
  }

  if (normalizado === 'LINEAS') {
    return formatearListaLineas();
  }

  const espacio = texto.indexOf(' ');
  if (espacio === -1) {
    const linea = tubondi.buscarLinea(texto);
    if (!linea) return MENSAJE_AYUDA;
    return `Decime tambien el nombre de la parada de la linea ${linea.nombre}. Ej: /bondi ${linea.nombre} Mariano Fragueiro 4220`;
  }

  const posibleLinea = texto.slice(0, espacio);
  const textoParada = texto.slice(espacio + 1);
  const linea = tubondi.buscarLinea(posibleLinea);
  if (!linea) {
    return `No reconozco la linea "${posibleLinea}". Mandame "/bondi lineas" para ver todas las disponibles.`;
  }

  try {
    return await responderLineaYParada(linea, textoParada);
  } catch (err) {
    console.error('Error consultando Tu Bondi:', err);
    return 'Tuve un problema consultando la posicion de los colectivos. Intenta de nuevo en un minuto.';
  }
}

module.exports = { procesarComandoBondi };
