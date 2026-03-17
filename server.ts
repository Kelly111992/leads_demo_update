import express from 'express';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import SmeeClient from 'smee-client';

// Load Firebase config
let firebaseConfig: any;
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('Firebase config loaded successfully');
  } else {
    console.error('CRITICAL: firebase-applet-config.json not found at', configPath);
    // Fallback or exit? If it's critical, we might want to exit, 
    // but let's try to continue to at least serve the static files if possible
  }
} catch (error) {
  console.error('Error loading Firebase config:', error);
}

const firebaseApp = firebaseConfig ? initializeApp(firebaseConfig) : null;
const db = firebaseApp ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId) : null;

// Default Evolution API Config
let EVOLUTION_URL = 'https://link-inmobiliario-evolution-api.hfsosq.easypanel.host';
let INSTANCE = 'leads_test';
let API_KEY = '429683C4C977415CAAFCCE10F7D57E11';

async function fetchEvolutionConfig() {
  if (!db) return;
  try {
    const docRef = doc(db, 'settings', 'evolution_api');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
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
  if (!firebaseConfig) {
    console.error('Skipping webhook setup: No Firebase config');
    return;
  }
  await fetchEvolutionConfig();
  
  // Use Smee.io for more reliable webhook delivery in dev environment
  const webhookUrl = 'https://smee.io/link-inmobiliario-dev-webhook';

  console.log(`[DEBUG] process.env.APP_URL: ${process.env.APP_URL}`);
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
        try {
          if (!db) {
            throw new Error('Firestore database not initialized');
          }
          const eventsRef = collection(db, 'webhook_events');
          await addDoc(eventsRef, {
            payload: payload,
            createdAt: new Date().toISOString(),
            status: 'pending'
          });
          console.log('Saved webhook event for processing');
          recentWebhooks[0].firestoreStatus = 'success';
        } catch (fsError: any) {
          console.error('Firestore Save Error:', fsError);
          recentWebhooks[0].firestoreStatus = 'error';
          recentWebhooks[0].firestoreError = fsError.message;
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

      const data = await response.json();
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
    console.log('Serving static files from:', distPath);
    
    if (fs.existsSync(distPath)) {
      console.log('Dist folder exists');
      const indexHtml = path.join(distPath, 'index.html');
      if (fs.existsSync(indexHtml)) {
        console.log('index.html found');
      } else {
        console.error('CRITICAL: index.html NOT found in dist folder');
      }
    } else {
      console.error('CRITICAL: dist folder NOT found. Did you run npm run build?');
    }

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
