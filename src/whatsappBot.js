require('dotenv').config();
const express = require('express');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const pino = require('pino');
const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
} = require('@whiskeysockets/baileys');

const { crearAuthState } = require('./authStore');
const { procesarComandoBondi } = require('./commands');
const browserClient = require('./browserClient');

const PREFIJO = '/bondi';
let ultimoQR = null;
let estadoConexion = 'iniciando';

function extraerTexto(mensaje) {
  return (
    mensaje.message?.conversation ||
    mensaje.message?.extendedTextMessage?.text ||
    ''
  );
}

async function iniciarBot() {
  const { state, saveCreds } = await crearAuthState();
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      ultimoQR = qr;
      estadoConexion = 'esperando-qr';
      console.log('Escaneá el QR (tambien disponible en /qr):');
      qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === 'open') {
      ultimoQR = null;
      estadoConexion = 'conectado';
      console.log('Conectado a WhatsApp como', jidNormalizedUser(sock.user.id));
    }

    if (connection === 'close') {
      estadoConexion = 'desconectado';
      const codigo = lastDisconnect?.error?.output?.statusCode;
      const debeReconectar = codigo !== DisconnectReason.loggedOut;
      console.log('Conexion cerrada.', codigo, 'Reconectar:', debeReconectar);
      if (debeReconectar) {
        iniciarBot();
      } else {
        console.log('Sesion cerrada (logout). Borra la sesion guardada y volve a escanear el QR para reconectar.');
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        await manejarMensaje(sock, msg);
      } catch (err) {
        console.error('Error manejando mensaje:', err);
      }
    }
  });

  return sock;
}

async function manejarMensaje(sock, msg) {
  if (!msg.message) return;

  const propioJid = jidNormalizedUser(sock.user.id);
  const remitenteJid = jidNormalizedUser(msg.key.remoteJid);

  // Solo respondemos en el chat "Mensajes a mi mismo" (vos hablandote a vos).
  // Cualquier otro chat (grupos, otros contactos) se ignora por completo.
  if (remitenteJid !== propioJid) return;

  const texto = extraerTexto(msg).trim();
  if (!texto.toLowerCase().startsWith(PREFIJO)) return;

  const argsTexto = texto.slice(PREFIJO.length).trim();
  const respuesta = await procesarComandoBondi(argsTexto);

  await sock.sendMessage(remitenteJid, { text: respuesta });
}

// --- Servidor HTTP minimo: health-check (para el ping externo que evita que
// Render duerma el servicio) y una pagina para ver el QR sin mirar los logs. ---
const app = express();

app.get('/health', (req, res) => {
  res.json({ estado: estadoConexion });
});

app.get('/qr', async (req, res) => {
  if (estadoConexion === 'conectado') {
    return res.send('<h1>Ya conectado ✅</h1>');
  }
  if (!ultimoQR) {
    return res.send('<h1>Generando QR, recarga en unos segundos...</h1>');
  }
  const dataUrl = await qrcode.toDataURL(ultimoQR);
  res.send(`<h1>Escanea este QR con WhatsApp</h1><img src="${dataUrl}" />`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor HTTP (health/QR) escuchando en el puerto ${PORT}`);
});

iniciarBot().catch((err) => {
  console.error('Error iniciando el bot:', err);
  process.exit(1);
});

async function apagar() {
  await browserClient.cerrar();
  process.exit(0);
}
process.on('SIGTERM', apagar);
process.on('SIGINT', apagar);
