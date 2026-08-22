const lineas = require('./data/lineas.json');
const browserClient = require('./browserClient');

const DIACRITICOS = new RegExp(String.fromCharCode(91, 92, 117, 48, 51, 48, 48, 45, 92, 117, 48, 51, 54, 102, 93), 'g');

function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .trim()
    .toUpperCase();
}

function buscarLinea(nombre) {
  const clave = normalizar(nombre);
  if (lineas[clave]) return { nombre: clave, ...lineas[clave] };
  return null;
}

function listarLineas() {
  return Object.keys(lineas).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
}

// Trae el trazado + paradas (con lat/lon) de una ruta puntual (un sentido).
async function getParadas(rutaId, cliente) {
  const data = await browserClient.postCmd('seleccionatraza', { ruta: rutaId, cliente });
  return data.paradas || [];
}

// Trae la posicion en vivo de TODOS los coches de una empresa (cliente),
// hay que filtrar despues por linea_id y sentido.
async function getCochesDeEmpresa(rutaId, cliente) {
  const data = await browserClient.postCmd('consultacocheporruta', { ruta_id: rutaId, cliente });
  return data.coches || [];
}

// Devuelve los coches en circulacion de una linea+sentido especificos.
async function getCochesDeLinea(linea, sentido) {
  const rutaIds = linea.rutas[sentido];
  if (!rutaIds || rutaIds.length === 0) return [];
  const primerRuta = rutaIds[0];
  const todos = await getCochesDeEmpresa(primerRuta, linea.cliente);
  return todos.filter((c) => c.linea === linea.linea_id && c.sentido === sentido);
}

function buscarParada(paradas, texto) {
  const buscado = normalizar(texto);
  return paradas.filter((p) => normalizar(p.parada_nombre).includes(buscado));
}

module.exports = {
  buscarLinea,
  listarLineas,
  getParadas,
  getCochesDeLinea,
  buscarParada,
  normalizar,
};
