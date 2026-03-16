const EVOLUTION_URL = 'https://evolutionapi-evolution-api.ckoomq.easypanel.host';
const INSTANCE = 'claveai';
const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';

async function check() {
  try {
    const res = await fetch(`${EVOLUTION_URL}/instance/connectionState/${INSTANCE}`, {
      headers: { 'apikey': API_KEY }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}
check();
