import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import SmeeClient from 'smee-client';

// Configuración de Evolution API (Valores por defecto)
let EVOLUTION_URL = 'https://link-inmobiliario-evolution-api.hfsosq.easypanel.host';
let INSTANCE = 'leads_test';
let API_KEY = '429683C4C977415CAAFCCE10F7D57E11';

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL || 'https://rlgjxxjfxirbyhfsztzr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_e_Hu4ROvwlGJJs4EhTMYiQ_Vw8g5wAd';
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🚀 Supabase cliente inicializado:', supabaseUrl);

async function fetchEvolutionConfig() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'evolution_api')
      .single();

    if (error) {
      if (error.code !== 'PGRST116') console.error('Error fetching Evolution API config:', error);
      return;
    }

    if (data && data.value) {
      const config = data.value;
      if (config.apiUrl) EVOLUTION_URL = config.apiUrl;
      if (config.instance) INSTANCE = config.instance;
      if (config.apiKey) API_KEY = config.apiKey;
      console.log('Loaded Evolution API config from Supabase');
    }
  } catch (error) {
    console.error('Error fetching Evolution API config:', error);
  }
}

async function setupEvolutionWebhook() {
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

            const leadId = `wa_${phone}`;
            const messageId = `msg_${Date.now()}`;

            try {
              // 1. Upsert Lead (Supabase style)
              const { data: leadExists } = await supabase
                .from('leads')
                .select('created_at')
                .eq('id', leadId)
                .single();

              const leadData = {
                id: leadId,
                name: pushName,
                phone: phone,
                source: 'whatsapp',
                status: 'new',
                updated_at: new Date().toISOString(),
                created_at: leadExists ? leadExists.created_at : new Date().toISOString(),
                system_token: 'claveai'
              };

              console.log(`💾 Guardando lead ${leadId} (${pushName})...`);
              await supabase.from('leads').upsert([leadData]);
              
              // 2. Insert Message
              console.log(`✉️ Guardando mensaje para el lead ${leadId}...`);
              await supabase.from('messages').insert([{
                id: messageId,
                lead_id: leadId,
                sender_id: 'client',
                content: content,
                timestamp: new Date().toISOString(),
                system_token: 'claveai'
              }]);

              // 3. Mark event as processed
              const eventId = payload.data.key?.id || `evt_${Date.now()}`;
              await supabase.from('webhook_events').upsert([{
                id: eventId,
                payload: payload,
                processed: true,
                processed_at: new Date().toISOString(),
                status: 'processed',
                system_token: 'claveai'
              }]);
              
              recentWebhooks[0].supabaseStatus = 'success';
            } catch (sbError: any) {
              console.error('❌ Error de Supabase:', sbError.message);
              recentWebhooks[0].supabaseStatus = 'error';
              recentWebhooks[0].supabaseError = sbError.message;
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
