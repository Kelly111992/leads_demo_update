import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function injectTestEvent() {
    const event = {
        payload: {
            event: 'messages.upsert',
            data: {
                key: {
                    remoteJid: '5211234567890@s.whatsapp.net',
                    fromMe: false,
                    id: 'MANUAL_TEST_' + Date.now()
                },
                pushName: 'Usuario de Prueba',
                message: {
                    conversation: 'Mensaje de prueba inyectado manualmente ' + new Date().toLocaleTimeString()
                },
                messageType: 'conversation'
            }
        },
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    try {
        const docRef = await addDoc(collection(db, 'webhook_events'), event);
        console.log('✅ Evento de prueba inyectado con ID:', docRef.id);
        console.log('Revisa ahora tu dashboard en localhost:3000 para ver si aparece el lead "Usuario de Prueba".');
    } catch (error) {
        console.error('❌ Error inyectando evento:', error);
    }
}

injectTestEvent();
