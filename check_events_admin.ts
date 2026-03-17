import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccountStr = fs.readFileSync('service-account.json', 'utf8');
const serviceAccount = JSON.parse(serviceAccountStr);

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(configStr);

initializeApp({
  credential: cert(serviceAccount),
  projectId: config.projectId
});

const db = getFirestore(config.firestoreDatabaseId);

async function check() {
  const snapshot = await db.collection('webhook_events').get();
  console.log('Total events:', snapshot.size);
  snapshot.forEach(doc => {
    console.log(doc.id, doc.data().status, doc.data().createdAt);
  });
}

check().catch(console.error);
