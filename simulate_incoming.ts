import fetch from 'node-fetch';

async function simulateIncomingMessage() {
  const payload = {
    "event": "messages.upsert",
    "instance": "leads_test",
    "data": {
      "message": {
        "key": {
          "remoteJid": "5213344151396@s.whatsapp.net",
          "fromMe": false,
          "id": "3EB0A08A62E02C4513D075"
        },
        "pushName": "Test User",
        "message": {
          "conversation": "Hola, estoy interesado en una propiedad."
        },
        "messageType": "conversation",
        "messageTimestamp": 1773688316
      }
    }
  };

  const res = await fetch('http://localhost:3000/api/webhook/evolution', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  console.log(res.status);
  console.log(await res.text());
}

simulateIncomingMessage();
