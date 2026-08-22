const RADIO_TIERRA_KM = 6371;
// Velocidad promedio de un colectivo urbano en Cordoba (con paradas y trafico).
const VELOCIDAD_PROMEDIO_KMH = 18;

function toRad(grados) {
  return (grados * Math.PI) / 180;
}

function distanciaKm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return RADIO_TIERRA_KM * c;
}

// Estima minutos hasta que un coche llegue a una parada, en linea recta
// (aproximacion: no sigue el trazado calle por calle). Sirve como referencia,
// no reemplaza el calculo oficial de la app (que usa el recorrido real).
function estimarMinutos(coche, parada) {
  const km = distanciaKm(
    coche.lat,
    coche.lon,
    parseFloat(parada.lat),
    parseFloat(parada.lon)
  );
  const horas = km / VELOCIDAD_PROMEDIO_KMH;
  return Math.max(1, Math.round(horas * 60));
}

module.exports = { distanciaKm, estimarMinutos };
