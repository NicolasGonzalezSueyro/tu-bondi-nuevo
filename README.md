# Tu Bondi Whatsapp

Bot de WhatsApp **personal** (uso propio, sin API oficial de Meta) para consultar el ETA en vivo de los colectivos de **Tu Bondi** (Cordoba capital). Te conectás escaneando un QR una sola vez, y despues le escribis a tu propio chat de WhatsApp ("Mensajes a mi mismo") con el comando:

```
/bondi A Mariano Fragueiro 4220
```

El bot **solo responde a ese comando**, y **solo en tu chat con vos mismo** — no contesta en grupos ni a otros contactos.

## Comandos

```
/bondi <linea> <parada>    -> ETA de los proximos colectivos en esa parada
/bondi lineas                -> lista todas las lineas disponibles
/bondi ayuda                  -> muestra la ayuda
```

## Advertencia sobre el ETA en vivo

Los endpoints de Tu Bondi que dan la posicion en tiempo real de los colectivos rechazan a cualquier cliente que no sea un navegador real, asi que el bot usa Chrome headless (Puppeteer) para esas dos llamadas puntuales. Es un comportamiento del servidor de Tu Bondi que **puede cambiar** — si un dia deja de funcionar, el bot va a avisarte con un mensaje en vez de romperse, y el resto (conexion a WhatsApp, etc.) sigue andando igual.

Ademas, como no es la API oficial de WhatsApp sino una conexion tipo "WhatsApp Web" (libreria Baileys), hay un riesgo minimo (aunque bajo para uso personal de bajo volumen) de que WhatsApp banee el numero si detecta actividad automatizada.

## Como se arma (gratis, sin tarjeta en ningun paso)

Necesitas crear 3 cuentas gratuitas. Ninguna pide tarjeta de credito.

### 1. MongoDB Atlas (guarda la sesion de WhatsApp)

Render (donde va a correr el bot) borra el disco cada vez que el servicio se reinicia, asi que la sesion de WhatsApp (las claves que te evitan tener que re-escanear el QR todo el tiempo) se guarda en una base de datos gratis en vez de en un archivo.

1. Anda a [mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register) y crea una cuenta gratis.
2. Crea un cluster **M0 (Free)**.
3. En **Database Access**, crea un usuario con contraseña.
4. En **Network Access**, agrega `0.0.0.0/0` (permitir desde cualquier IP) — es lo mas simple para este caso.
5. Anda a **Database > Connect > Drivers**, copia el **connection string** (algo como `mongodb+srv://usuario:contraseña@cluster0.xxxxx.mongodb.net/`).
6. Guarda ese string, lo vas a necesitar en el paso 3.

### 2. Subi el codigo a GitHub

1. Crea un repositorio **privado** en GitHub (para que nadie mas vea tu codigo).
2. Subi este proyecto (`git init`, `git add .`, `git commit`, `git push`).

### 3. Render (donde corre el bot)

1. Anda a [render.com](https://render.com) y crea cuenta gratis (no pide tarjeta).
2. **New > Web Service**, conecta tu repositorio de GitHub.
3. Render detecta el `Dockerfile` automaticamente.
4. Elegi el plan **Free**.
5. En **Environment**, agrega la variable:
   - `MONGODB_URI` = el connection string que copiaste en el paso 1 (agregale el nombre de la base al final, ej: `.../tubondi_whatsapp?retryWrites=true&w=majority`)
6. Deploy.
7. Cuando termine, andá a la pestaña **Logs** de Render: vas a ver el QR dibujado en texto. Si se ve mal en los logs, andá en el navegador a `https://tu-servicio.onrender.com/qr` — ahi lo ves como imagen.
8. **Escanealo con tu WhatsApp:** abrí WhatsApp en tu celular > Configuracion > Dispositivos vinculados > Vincular un dispositivo, y escaneá el QR.
9. Listo. Una vez conectado, `/qr` va a mostrar "Ya conectado ✅" y los logs van a decir "Conectado a WhatsApp como...".

### 4. UptimeRobot (evita que Render duerma el bot)

El plan Free de Render duerme el servicio despues de 15 minutos sin trafico HTTP. Como el bot no depende de HTTP para funcionar (WhatsApp le llega por otro lado), necesitamos que algo lo "moleste" cada tanto para que no se duerma.

1. Anda a [uptimerobot.com](https://uptimerobot.com) y crea cuenta gratis.
2. **Add New Monitor** > tipo **HTTP(s)**.
3. URL: `https://tu-servicio.onrender.com/health`
4. Intervalo: cada 5 minutos.
5. Guardar.

Con esto el bot queda corriendo 24/7 gratis, sin tarjeta en ningun paso, y respondiendote solo a vos por WhatsApp.

## Si perdes la sesion (hay que re-escanear)

Si ves en los logs "Sesion cerrada (logout)", volve a entrar a `/qr` y escaneá de nuevo. Esto no debería pasar seguido gracias a que la sesion esta guardada en MongoDB.

## Estructura del proyecto

```
src/
  whatsappBot.js     Conexion a WhatsApp (Baileys), QR, filtro de mensajes, servidor /health y /qr
  authStore.js         Guarda la sesion de WhatsApp en MongoDB (o en disco local si no hay MONGODB_URI)
  commands.js           Logica del comando /bondi
  tubondi.js             Cliente de la API de Tu Bondi (lineas, paradas, coches)
  browserClient.js        Chrome headless (Puppeteer) para las 2 llamadas "en vivo"
  eta.js                   Estimacion de minutos por distancia (linea recta)
  data/lineas.json          Dataset de lineas/rutas de Cordoba (fijo)
```

## Setup y prueba local (opcional)

Requisitos: Node.js 18+, Google Chrome instalado.

```
npm install
npm start
```

Sin `MONGODB_URI` configurada, la sesion se guarda en `./auth_info` (una carpeta local, ignorada por git). Escaneá el QR que aparece en la consola con tu WhatsApp y probá escribiendote a vos mismo `/bondi A Mariano Fragueiro 4220`.
