
import fetch from 'node-fetch';

const EVOLUTION_URL = 'https://link-inmobiliario-evolution-api.hfsosq.easypanel.host';
const INSTANCE = 'leads_test';
const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';

async function testConnection() {
  console.log('--- Testing Evolution API Connection ---');
  try {
    const response = await fetch(`${EVOLUTION_URL}/instance/connectionState/${INSTANCE}`, {
      method: 'GET',
      headers: {
        'apikey': API_KEY
      }
    });
    
    const data = await response.json() as any;
    console.log('Connection State Response:', JSON.stringify(data, null, 2));
    
    if (data.instance?.state === 'open') {
      console.log('✅ Instance is OPEN and connected.');
    } else {
      console.log('❌ Instance is NOT open. Current state:', data.instance?.state);
    }
  } catch (error) {
    console.error('❌ Error connecting to Evolution API:', error);
  }
}

async function testSendMessage() {
  console.log('\n--- Testing Send Message ---');
  // Sending to a test number or the user's number if I had it. 
  // I'll just try to send to a dummy number to see if the API accepts the request.
  const testPhone = '5213344151396'; // Using the number from the logs earlier
  
  try {
    const response = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY
      },
      body: JSON.stringify({
        number: testPhone,
        text: 'Test message from CRM agent at ' + new Date().toISOString(),
        options: {
          delay: 0,
          presence: "composing",
          linkPreview: false
        }
      })
    });
    
    const data = await response.json();
    console.log('Send Message Response:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('✅ Message sent successfully (API accepted it).');
    } else {
      console.log('❌ Failed to send message.');
    }
  } catch (error) {
    console.error('❌ Error sending message:', error);
  }
}

testConnection().then(() => testSendMessage());
