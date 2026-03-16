import express from 'express';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import SmeeClient from 'smee-client';

// Load Firebase config
const firebaseConfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function setupEvolutionWebhook() {
  const EVOLUTION_URL = 'https://link-inmobiliario-evolution-api.hfsosq.easypanel.host';
  const INSTANCE = 'leads_test';
  const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
  // Use APP_URL if available, otherwise fallback to the dev URL
  const APP_URL = process.env.APP_URL || 'https://ais-pre-2xtjywkq6xgncjind7ujf7-85412012081.us-east1.run.app';
  const webhookUrl = process.env.NODE_ENV !== "production"
    ? 'https://smee.io/link-inmobiliario-dev-webhook'
    : `${APP_URL}/api/webhook/evolution`;

  console.log(`Configuring Evolution API Webhook to point to: ${webhookUrl}`);

  try {
    const response = await fetch(`${EVOLUTION_URL}/webhook/set/${INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY
      },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: false,
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "SEND_MESSAGE",
            "CONNECTION_UPDATE"
          ]
        }
      })
    });

    if (response.ok) {
      console.log('Evolution Webhook successfully configured!');
    } else {
      const errorText = await response.text();
      console.error('Failed to configure Evolution Webhook:', errorText);
    }
  } catch (error) {
    console.error('Error setting up Evolution Webhook:', error);
  }
}

async function startServer() {
  const server = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  server.use(express.json());

  // Store recent webhooks for debugging
  const recentWebhooks: any[] = [];
  server.get('/api/webhook/debug', (req, res) => {
    res.json(recentWebhooks);
  });

  // Endpoint to manually trigger webhook setup
  server.post('/api/webhook/setup', async (req, res) => {
    await setupEvolutionWebhook();
    res.json({ success: true, message: 'Webhook setup triggered' });
  });

  // Evolution API Webhook Endpoint
  server.all('/api/webhook/evolution', async (req, res) => {
    try {
      const payload = req.body || req.query;
      console.log(`Received webhook (${req.method}) from Evolution API:`, JSON.stringify(payload, null, 2));

      recentWebhooks.unshift({ method: req.method, payload });
      if (recentWebhooks.length > 20) recentWebhooks.pop();

      // Check if it's a message upsert event
      if ((payload.event === 'messages.upsert' || payload.event === 'MESSAGES_UPSERT') && payload.data) {
        const messageData = payload.data.message || payload.data;

        // Process message logic directly on server
        if (!messageData.key?.fromMe) {
          const remoteJid = messageData.key?.remoteJid;
          if (remoteJid && !remoteJid.includes('@g.us')) {
            const phone = remoteJid.split('@')[0];
            const pushName = messageData.pushName || phone;

            let content = '';
            if (messageData.message?.conversation) {
              content = messageData.message.conversation;
            } else if (messageData.message?.extendedTextMessage?.text) {
              content = messageData.message.extendedTextMessage.text;
            } else if (messageData.messageType === 'conversation' || messageData.messageType === 'extendedTextMessage') {
              content = messageData.message?.text || messageData.text || '[Text Message]';
            } else {
              content = `[${messageData.messageType || 'Media/Unsupported Message'}]`;
            }

            console.log(`Processing message from ${pushName}: ${content}`);

            // 1. Check if lead exists
            const leadsRef = collection(db, 'leads');
            const leadQuery = query(leadsRef, where('phone', '==', phone));
            const querySnapshot = await getDocs(leadQuery);

            let leadId = '';
            const now = new Date().toISOString();

            if (querySnapshot.empty) {
              const newLead = {
                name: pushName,
                phone: phone,
                source: 'whatsapp',
                status: 'new',
                createdAt: now,
                updatedAt: now,
                systemToken: 'claveai'
              };
              const docRef = await addDoc(leadsRef, newLead);
              leadId = docRef.id;
              console.log(`Created new lead: ${leadId}`);
            } else {
              const leadDoc = querySnapshot.docs[0];
              leadId = leadDoc.id;
              await updateDoc(doc(db, 'leads', leadId), {
                updatedAt: now,
                status: leadDoc.data().status === 'closed_won' || leadDoc.data().status === 'closed_lost' ? 'new' : leadDoc.data().status,
                systemToken: 'claveai'
              });
              console.log(`Updated existing lead: ${leadId}`);
            }

            // 2. Save the message
            const messagesRef = collection(db, 'messages');
            await addDoc(messagesRef, {
              leadId: leadId,
              senderId: 'client',
              content: content,
              timestamp: now,
              systemToken: 'claveai'
            });
            console.log(`Saved message for lead: ${leadId}`);
          }
        }

        const eventsRef = collection(db, 'webhook_events');
        await addDoc(eventsRef, {
          payload: payload,
          createdAt: new Date().toISOString(),
          status: 'processed'
        });
        console.log('✅ Webhook procesado y guardado en Firestore');
      }

      res.status(200).json({ status: 'success' });
    } catch (error) {
      console.error('❌ Error procesando webhook:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Evolution API Send Message Endpoint
  server.post('/api/messages/send', async (req, res) => {
    try {
      const { phone, text } = req.body;

      if (!phone || !text) {
        return res.status(400).json({ error: 'Phone and text are required' });
      }

      const EVOLUTION_URL = 'https://link-inmobiliario-evolution-api.hfsosq.easypanel.host';
      const INSTANCE = 'leads_test';
      const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';

      const response = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_KEY
        },
        body: JSON.stringify({
          number: phone,
          options: {
            delay: 0,
            presence: "composing"
          },
          textMessage: {
            text: text
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Evolution API Error:', errorData);
        return res.status(response.status).json({ error: 'Failed to send message via Evolution API' });
      }

      res.status(200).json({ status: 'success' });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    server.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    server.use(express.static(distPath));
    server.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on http://localhost:${PORT}`);

    // Automatically configure the webhook on startup
    await setupEvolutionWebhook();

    // Start Smee client in development mode
    if (process.env.NODE_ENV !== "production") {
      console.log('Starting Smee client for local webhook forwarding...');
      const smee = new SmeeClient({
        source: 'https://smee.io/link-inmobiliario-dev-webhook',
        target: `http://localhost:${PORT}/api/webhook/evolution`,
        logger: console
      });
      smee.start();
    }
  });
}

startServer();
