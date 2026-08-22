const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { useMongoDBAuthState } = require('mongo-baileys');
const { MongoClient } = require('mongodb');

// En produccion (Render) el disco es efimero, asi que la sesion de WhatsApp
// se guarda en MongoDB Atlas (gratis) para sobrevivir a reinicios. En local,
// si no configuraste MONGODB_URI, se guarda en una carpeta (mas simple para
// probar en tu PC).
async function crearAuthState() {
  const mongoUri = process.env.MONGODB_URI;

  if (mongoUri) {
    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'tubondi_whatsapp');
    const collection = db.collection('sesion_whatsapp');
    const { state, saveCreds } = await useMongoDBAuthState(collection);
    return { state, saveCreds };
  }

  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  return { state, saveCreds };
}

module.exports = { crearAuthState };
