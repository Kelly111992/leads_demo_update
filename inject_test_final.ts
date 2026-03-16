import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function injectTestEvent() {
    const event = {
        payload: {
            event: 'messages.upsert',
            data: {
                key: {
                    remoteJid: '5219998887776@s.whatsapp.net',
                    fromMe: false,
                    id: 'FINAL_DEBUG_' + Date.now()
                },
                pushName: 'LEAD_DEFINITIVO_123',
                message: {
                    conversation: 'Si ves esto, el sistema funciona. ' + new Date().toLocaleTimeString()
                },
                messageType: 'conversation'
            }
        },
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    try {
        const docRef = await addDoc(collection(db, 'webhook_events'), event);
        console.log('✅ Evento inyectado con ID:', docRef.id);
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

injectTestEvent();
