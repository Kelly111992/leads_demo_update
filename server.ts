import express from 'express';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import SmeeClient from 'smee-client';

// Configuración de Evolution API (Valores por defecto)
let EVOLUTION_URL = 'https://link-inmobiliario-evolution-api.hfsosq.easypanel.host';
let INSTANCE = 'leads_test';
let API_KEY = '429683C4C977415CAAFCCE10F7D57E11';

// Load Firebase config
let firebaseConfig: any;
let db: any;

try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
  
  if (fs.existsSync(configPath) && fs.existsSync(serviceAccountPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: firebaseConfig.projectId
      });
    }

    db = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId);
    console.log('🚀 Firebase ADMIN inicializado para el proyecto:', firebaseConfig.projectId);
    console.log('✅ Conectado a base de datos:', firebaseConfig.firestoreDatabaseId || '(default)');
  } else {
    console.error('CRITICAL: Firebase configuration files missing!');
  }
} catch (error) {
  console.error('Error initializing Firebase Admin:', error);
}

async function fetchEvolutionConfig() {
  if (!db) return;
  try {
    const docRef = db.collection('settings').doc('evolution_api');
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data.apiUrl) EVOLUTION_URL = data.apiUrl;
      if (data.instance) INSTANCE = data.instance;
      if (data.apiKey) API_KEY = data.apiKey;
      console.log('Loaded Evolution API config from Firestore');
    }
  } catch (error) {
    console.error('Error fetching Evolution API config:', error);
  }
}

async function setupEvolutionWebhook() {
  if (!db) {
    console.error('Skipping webhook setup: No Firestore DB');
    return;
  }
  await fetchEvolutionConfig();
  
  // Use Smee.io for development environment, or app URL for production
  let webhookUrl = 'https://smee.io/link-inmobiliario-dev-webhook';
  if (process.env.APP_URL) {
    webhookUrl = `${process.env.APP_URL}/api/webhook/evolution`;
  }

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
  const PORT = Number(process.env.PORT) || 3000;

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
      
      recentWebhooks.unshift({ method: req.method, payload, timestamp: new Date().toISOString() });
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

            // 1. Identify Lead ID (based on phone)
            const leadId = `wa_${phone}`;

            // 2. Prepare Message Data
            const messageId = `msg_${Date.now()}`;
            const messageDataLocal = {
              leadId,
              senderId: 'client',
              content: content,
              timestamp: new Date().toISOString(),
              systemToken: 'claveai'
            };

            try {
              if (db) {
                // Get existing lead to preserve createdAt
                const leadDoc = await db.collection('leads').doc(leadId).get();
                const createdAt = leadDoc.exists ? leadDoc.data().createdAt : new Date().toISOString();

                const leadData = {
                  name: pushName,
                  phone: phone,
                  source: 'whatsapp',
                  status: 'new',
                  updatedAt: new Date().toISOString(),
                  createdAt: createdAt,
                  systemToken: 'claveai'
                };

                console.log(`💾 Guardando lead ${leadId} (${pushName})...`);
                await db.collection('leads').doc(leadId).set(leadData, { merge: true });
                
                console.log(`✉️ Guardando mensaje para el lead ${leadId}...`);
                await db.collection('messages').doc(messageId).set(messageDataLocal);

                // Mark event as processed
                const eventId = payload.data.key?.id || `evt_${Date.now()}`;
                await db.collection('webhook_events').doc(eventId).set({
                  payload: payload,
                  processed: true,
                  processedAt: new Date().toISOString(),
                  status: 'processed',
                  systemToken: 'claveai'
                }, { merge: true });
                
                recentWebhooks[0].firestoreStatus = 'success';
              }
            } catch (fsError: any) {
              console.error('❌ Error de Firestore:', fsError.message);
              recentWebhooks[0].firestoreStatus = 'error';
              recentWebhooks[0].firestoreError = fsError.message;
            }
          }
        }
      }

      res.status(200).json({ status: 'success' });
    } catch (error) {
      console.error('Error processing webhook:', error);
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

      await fetchEvolutionConfig();

      const response = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_KEY
        },
        body: JSON.stringify({
          number: phone,
          text: text,
          options: {
            delay: 0,
            presence: "composing",
            linkPreview: false
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Evolution API Error:', errorData);
        return res.status(response.status).json({ error: 'Failed to send message via Evolution API' });
      }

      const data = (await response.json()) as any;
      res.status(200).json({ 
        status: 'success', 
        evolutionId: data.key?.id || data.id || (data.message && data.message.key && data.message.key.id)
      });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log('Starting in DEVELOPMENT mode');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    server.use(vite.middlewares);
  } else {
    console.log('Starting in PRODUCTION mode');
    const distPath = path.join(process.cwd(), 'dist');
    server.use(express.static(distPath));
    server.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on port ${PORT}`);
    
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
