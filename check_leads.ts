import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

// We don't have the service account key in firebase-applet-config.json, it's just the client config.
// So we can't use firebase-admin easily without the service account key.
