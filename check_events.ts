import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(configStr);

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function check() {
  const snapshot = await getDocs(collection(db, 'webhook_events'));
  console.log('Total events:', snapshot.size);
  snapshot.forEach(doc => {
    console.log(doc.id, doc.data().status, doc.data().createdAt);
  });
}

check().catch(console.error);
