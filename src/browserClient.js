const fs = require('fs');
const puppeteer = require('puppeteer-core');

const ORIGEN_URL = 'https://micronauta4.dnsalias.net/web/urbano/sw.js?conf=cbaciudad';
const BASE_URL = 'https://micronauta4.dnsalias.net/usuario/urbano2_cmd.php';

// Los endpoints de datos en vivo de Tu Bondi devuelven 408 a cualquier
// cliente que no sea un Chrome real (headless o no da igual), asi que estas
// llamadas se hacen dentro de una pestana de Chrome controlada por Puppeteer
// en vez de un fetch de Node comun. No hay garantia de que esto funcione en
// todos los entornos: si Tu Bondi endurece la deteccion, este cliente
// empezara a fallar y el bot lo va a reportar con un mensaje claro.
let browserPromise = null;
let pagePromise = null;

function rutasPosiblesDeChrome() {
  return [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
}

function resolverExecutablePath() {
  for (const ruta of rutasPosiblesDeChrome()) {
    if (fs.existsSync(ruta)) return ruta;
  }
  throw new Error(
    'No encontre un Chrome/Chromium instalado. Configura la variable de entorno PUPPETEER_EXECUTABLE_PATH.'
  );
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      executablePath: resolverExecutablePath(),
      headless: true,
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
      ],
    });
  }
  return browserPromise;
}

async function crearPagina() {
  const browser = await getBrowser();
  const page = await browser.newPage();
  // El modo headless expone "HeadlessChrome" en el User-Agent.
  const uaReal = (await browser.userAgent()).replace('HeadlessChrome', 'Chrome');
  await page.setUserAgent(uaReal);
  await page.goto(ORIGEN_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  return page;
}

async function getPage() {
  if (!pagePromise) {
    pagePromise = crearPagina();
  }
  return pagePromise;
}

async function reiniciarPagina() {
  pagePromise = null;
  browserPromise = null;
}

async function fetchEnPagina(page, url, body) {
  return page.evaluate(
    async (url, body) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      return res.json();
    },
    url,
    body
  );
}

async function postCmd(cmd, params) {
  const url = `${BASE_URL}?cmd=${cmd}`;
  const body = new URLSearchParams(params).toString();

  try {
    const page = await getPage();
    return await fetchEnPagina(page, url, body);
  } catch (err) {
    // La pestana pudo haberse cerrado o el proceso de Chrome haberse caido; reintentamos una vez.
    await reiniciarPagina();
    const page = await getPage();
    return fetchEnPagina(page, url, body);
  }
}

async function cerrar() {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close().catch(() => {});
    browserPromise = null;
    pagePromise = null;
  }
}

module.exports = { postCmd, cerrar };
