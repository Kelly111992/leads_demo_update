import fetch from 'node-fetch';

const url = 'https://link-inmobiliario-evolution-api.hfsosq.easypanel.host';
const apikey = '429683C4C977415CAAFCCE10F7D57E11';
const instance = 'leads_test';

async function checkInstance() {
  console.log(`Checking instance: ${instance}`);
  
  try {
    // 1. Check Connection State
    const connRes = await fetch(`${url}/instance/connectionState/${instance}`, {
      headers: { 'apikey': apikey }
    });
    const connData = await connRes.json();
    console.log('Connection State:', JSON.stringify(connData, null, 2));

    // 2. Check Webhook Config
    const webhookRes = await fetch(`${url}/webhook/find/${instance}`, {
      headers: { 'apikey': apikey }
    });
    const webhookData = await webhookRes.json();
    console.log('Webhook Config:', JSON.stringify(webhookData, null, 2));

  } catch (error) {
    console.error('Error checking instance:', error.message);
  }
}

checkInstance();
