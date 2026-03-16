const EVOLUTION_URL = 'https://link-inmobiliario-evolution-api.hfsosq.easypanel.host';
const INSTANCE = 'leads_test';
const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';

async function sendMessage() {
  try {
    const res = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY
      },
      body: JSON.stringify({
        number: '5213344151396',
        text: 'Hola! Este es un mensaje de prueba desde el sistema para verificar la conexión.'
      })
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}
sendMessage();
