const EVOLUTION_URL = 'https://link-inmobiliario-evolution-api.hfsosq.easypanel.host';
const INSTANCE = 'leads_test';
const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';

async function checkWebhook() {
  try {
    const response = await fetch(`${EVOLUTION_URL}/webhook/find/${INSTANCE}`, {
      headers: { 'apikey': API_KEY }
    });
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}
checkWebhook();
