const EVOLUTION_URL = 'https://link-inmobiliario-evolution-api.hfsosq.easypanel.host';
const INSTANCE = 'leads_test';
const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const webhookUrl = 'https://ais-pre-2xtjywkq6xgncjind7ujf7-85412012081.us-east1.run.app/api/webhook/evolution';

async function setup() {
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
      const data = await response.json();
      console.log(JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.error('Failed to configure Evolution Webhook:', errorText);
    }
  } catch (error) {
    console.error('Error setting up Evolution Webhook:', error);
  }
}
setup();
