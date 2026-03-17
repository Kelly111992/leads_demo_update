import fetch from 'node-fetch';

const url = 'https://link-inmobiliario-evolution-api.hfsosq.easypanel.host';
const apikey = '429683C4C977415CAAFCCE10F7D57E11';
const instance = 'leads_test';
const webhookUrl = 'https://smee.io/leads-demo-unique-667788';

async function setWebhook() {
  console.log(`Setting webhook for ${instance} to ${webhookUrl}`);
  
  try {
    const payload = {
      webhook: {
        url: webhookUrl,
        enabled: true,
        webhookByEvents: false,
        events: [
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE",
          "SEND_MESSAGE",
          "CONNECTION_UPDATE"
        ]
      }
    };

    const response = await fetch(`${url}/webhook/set/${encodeURIComponent(instance)}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'apikey': apikey 
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

setWebhook();
