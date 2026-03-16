import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(configStr);

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function check() {
  const leadsSnapshot = await getDocs(collection(db, 'leads'));
  console.log('Total leads:', leadsSnapshot.size);
  leadsSnapshot.forEach(doc => {
    console.log('Lead:', doc.id, doc.data().name, doc.data().phone);
  });

  const messagesSnapshot = await getDocs(collection(db, 'messages'));
  console.log('Total messages:', messagesSnapshot.size);
  messagesSnapshot.forEach(doc => {
    console.log('Message:', doc.id, doc.data().content, doc.data().timestamp);
  });
}

check().catch(console.error);
