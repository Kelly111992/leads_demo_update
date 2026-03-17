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
// IMPORTANT: Server must use service_role_key to bypass RLS and write leads/messages
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsZ2p4eGpmeGlyYnloZnN6dHpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzcxNTg3OSwiZXhwIjoyMDg5MjkxODc5fQ.H3JcLmIyqh3eWzWA1LOQ8LVcR5LSH9_wc4TogiAQMc8';
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
  
  // Prioritize Smee.io if we are in development mode to allow local testing
  let webhookUrl = 'https://smee.io/leads-demo-unique-667788';
  
  if (process.env.NODE_ENV === "production" && process.env.APP_URL) {
    webhookUrl = `${process.env.APP_URL}/api/webhook/evolution`;
  }

  console.log(`[DEBUG] Chosen Webhook URL: ${webhookUrl} (NODE_ENV: ${process.env.NODE_ENV})`);
  console.log(`Configuring Evolution API Webhook to point to: ${webhookUrl}`);

  try {
    const response = await fetch(`${EVOLUTION_URL}/webhook/set/${encodeURIComponent(INSTANCE)}`, {
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
      console.log(`\n🔔 Received webhook (${req.method}) from Evolution API, event: ${payload?.event}`);
      
      const webhookEntry = { method: req.method, event: payload?.event, timestamp: new Date().toISOString(), supabaseStatus: 'pending' };
      recentWebhooks.unshift(webhookEntry);
      if (recentWebhooks.length > 20) recentWebhooks.pop();

      // Check if it's a message upsert event
      if ((payload.event === 'messages.upsert' || payload.event === 'MESSAGES_UPSERT') && payload.data) {
        const msg = payload.data;
        
        // Evitar procesar mensajes propios
        if (msg.key?.fromMe) {
          console.log('⏭️ Skipping message from me');
          return res.status(200).send('OK');
        }

        const remoteJid = msg.key?.remoteJid;
        if (remoteJid && !remoteJid.includes('@g.us')) {
          const phone = remoteJid.split('@')[0];
          const pushName = msg.pushName || phone;

          let content = '';
          const messageContent = msg.message;

          if (messageContent?.conversation) {
            content = messageContent.conversation;
          } else if (messageContent?.extendedTextMessage?.text) {
            content = messageContent.extendedTextMessage.text;
          } else if (msg.messageType === 'conversation' || msg.messageType === 'extendedTextMessage') {
            content = msg.message?.text || msg.text || '[Texto]';
          } else {
            content = `[Mensaje de tipo ${msg.messageType || 'desconocido'}]`;
          }

          console.log(`📩 Nuevo mensaje de ${pushName} (${phone}): ${content}`);

          const leadId = `wa_${phone}`;
          const messageId = `msg_${Date.now()}`;
          const now = new Date().toISOString();

          try {
            // 1. Upsert Lead
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
              status: 'nuevo',
              updated_at: now,
              created_at: leadExists ? leadExists.created_at : now,
              system_token: 'claveai'
            };

            const { error: leadError } = await supabase.from('leads').upsert([leadData]);
            if (leadError) {
              console.error('❌ Error upserting lead:', leadError.message, leadError.details);
            } else {
              console.log(`✅ Lead upserted: ${leadId} (${pushName})`);
            }
            
            // 2. Insert Message
            const { error: msgError } = await supabase.from('messages').insert([{
              id: messageId,
              lead_id: leadId,
              sender_id: 'client',
              content: content,
              timestamp: now,
              system_token: 'claveai'
            }]);

            if (msgError) {
              console.error('❌ Error inserting message:', msgError.message, msgError.details);
            } else {
              console.log(`✅ Message saved: ${messageId} -> "${content.substring(0, 50)}"`);
            }

            webhookEntry.supabaseStatus = (leadError || msgError) ? 'error' : 'success';
          } catch (sbError: any) {
            console.error('❌ Error de Supabase (exception):', sbError.message);
            webhookEntry.supabaseStatus = 'error';
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
      if (!phone || !text) return res.status(400).json({ error: 'Phone and text are required' });

      await fetchEvolutionConfig();

      const response = await fetch(`${EVOLUTION_URL}/message/sendText/${encodeURIComponent(INSTANCE)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_KEY
        },
        body: JSON.stringify({
          number: phone,
          text: text,
          options: { delay: 0, presence: "composing", linkPreview: false }
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Evolution API Error:', errorData);
        return res.status(response.status).json({ error: 'Failed' });
      }

      const data = await response.json() as any;
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
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    server.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    server.use(express.static(distPath));
    server.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  server.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on port ${PORT}`);
    await setupEvolutionWebhook();

    if (process.env.NODE_ENV !== "production") {
      const smee = new SmeeClient({
        source: 'https://smee.io/leads-demo-unique-667788',
        target: `http://localhost:${PORT}/api/webhook/evolution`,
        logger: console
      });
      smee.start();
    }
  });
}

startServer();
