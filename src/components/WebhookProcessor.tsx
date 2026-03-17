import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, getDocs, addDoc, updateDoc, doc, deleteDoc, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function WebhookProcessor() {
  const { userProfile } = useAuth();
  const [defaultAiEnabled, setDefaultAiEnabled] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'evolution_api'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          if (data.defaultAiEnabled !== undefined) {
            setDefaultAiEnabled(data.defaultAiEnabled);
          }
        }
      } catch (error) {
        console.error('WebhookProcessor: Error fetching settings:', error);
      }
    }
    fetchSettings();
  }, []);

  useEffect(() => {
    console.log('WebhookProcessor: Checking user profile', userProfile);
    // Only run the processor if the user is an admin or agent
    if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'agent')) {
      return;
    }

    console.log('WebhookProcessor: Starting to listen for events');
    const eventsRef = collection(db, 'webhook_events');
    const q = query(eventsRef, where('status', '==', 'pending'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      console.log('WebhookProcessor: Received snapshot with', snapshot.docs.length, 'pending events');
      for (const docChange of snapshot.docChanges()) {
        if (docChange.type === 'added') {
          const eventDoc = docChange.doc;
          const eventData = eventDoc.data();
          const payload = eventData.payload;
          console.log('WebhookProcessor: Processing event', eventDoc.id, payload.event);

          try {
            // Mark as processing to prevent duplicate processing using a transaction
            const isClaimed = await runTransaction(db, async (transaction) => {
              const eventSnap = await transaction.get(doc(db, 'webhook_events', eventDoc.id));
              if (!eventSnap.exists() || eventSnap.data().status !== 'pending') {
                return false;
              }
              transaction.update(doc(db, 'webhook_events', eventDoc.id), { 
                status: 'processing',
                processedBy: userProfile.uid,
                processingAt: new Date().toISOString()
              });
              return true;
            });

            if (!isClaimed) {
              console.log('WebhookProcessor: Event already being processed or finished by another instance');
              continue;
            }

            if ((payload.event === 'messages.upsert' || payload.event === 'MESSAGES_UPSERT') && payload.data) {
              // Evolution API sometimes nests the data under payload.data.message, and sometimes it's directly under payload.data
              // It can also be an array of messages
              const data = payload.data;
              const messageData = Array.isArray(data) ? data[0] : (data.messages ? data.messages[0] : (data.key ? data : (data.message || data)));
              
              if (!messageData || !messageData.key) {
                console.log('WebhookProcessor: Invalid message data structure:', messageData);
                await deleteDoc(doc(db, 'webhook_events', eventDoc.id));
                continue;
              }

              console.log('WebhookProcessor: Message data:', messageData);
              
              // Ignore messages sent by ourselves
              if (messageData.key?.fromMe) {
                console.log('WebhookProcessor: Skipping fromMe message');
                await deleteDoc(doc(db, 'webhook_events', eventDoc.id));
                continue;
              }

              const remoteJid = messageData.key?.remoteJid;
              if (!remoteJid || remoteJid.includes('@g.us')) {
                console.log('WebhookProcessor: Skipping group or invalid JID:', remoteJid);
                await deleteDoc(doc(db, 'webhook_events', eventDoc.id));
                continue;
              }

              // Handle remoteJid with suffix like 5213318213624:91@s.whatsapp.net
              const rawPhone = remoteJid.split('@')[0].split(':')[0];
              console.log('WebhookProcessor: Extracted phone:', rawPhone);

              // 1. Idempotency check: check if this message ID already exists BEFORE doing anything else
              const evolutionId = messageData.key?.id;
              if (evolutionId) {
                const messagesRef = collection(db, 'messages');
                const existingQuery = query(messagesRef, where('evolutionId', '==', evolutionId));
                const existingSnap = await getDocs(existingQuery);
                if (!existingSnap.empty) {
                  console.log('WebhookProcessor: Message already exists in Firestore, skipping everything');
                  await deleteDoc(doc(db, 'webhook_events', eventDoc.id));
                  continue;
                }
              }

              const pushName = messageData.pushName || rawPhone;
              
              let content = '';
              if (messageData.message?.conversation) {
                content = messageData.message.conversation;
              } else if (messageData.message?.extendedTextMessage?.text) {
                content = messageData.message.extendedTextMessage.text;
              } else if (messageData.messageType === 'conversation' || messageData.messageType === 'extendedTextMessage') {
                content = messageData.message?.text || messageData.text || '[Text Message]';
              } else {
                content = `[${messageData.messageType || 'Media/Unsupported Message'}]`;
              }

              // 2. Normalize phone and check if lead exists
              const normalize = (p: string) => p.replace(/\D/g, '');
              let normalizedPhone = normalize(rawPhone);
              
              // Mexican numbers: remove the '1' after '52' if it has 13 digits
              if (normalizedPhone.startsWith('521') && normalizedPhone.length === 13) {
                normalizedPhone = '52' + normalizedPhone.substring(3);
              }
              
              const leadsRef = collection(db, 'leads');
              let leadId = '';
              let existingLeadData = null;
              const now = new Date().toISOString();

              // Try to find existing lead by phone variations
              const allLeadsSnap = await getDocs(leadsRef);
              const existingLead = allLeadsSnap.docs.find(doc => {
                const p = normalize(doc.data().phone || '');
                // Check against both normalized and raw phone
                return p === normalizedPhone || p === normalize(rawPhone);
              });

              if (existingLead) {
                leadId = existingLead.id;
                existingLeadData = existingLead.data();
              }

              if (!leadId) {
                console.log('WebhookProcessor: Creating new lead for:', normalizedPhone);
                const newLead = {
                  name: pushName,
                  phone: normalizedPhone,
                  source: 'whatsapp',
                  status: 'nuevo',
                  createdAt: now,
                  updatedAt: now,
                  aiEnabled: defaultAiEnabled,
                  systemToken: 'claveai'
                };
                // Use normalizedPhone as ID to prevent race conditions across multiple clients
                // This ensures that even if multiple events for the same new phone arrive, 
                // they result in the same lead document.
                await setDoc(doc(db, 'leads', normalizedPhone), newLead, { merge: true });
                leadId = normalizedPhone;
              } else {
                console.log('WebhookProcessor: Updating existing lead:', leadId);
                await updateDoc(doc(db, 'leads', leadId), {
                  updatedAt: now,
                  status: existingLeadData.status === 'cerrado_ganado' || existingLeadData.status === 'cerrado_perdido' ? 'nuevo' : existingLeadData.status,
                  systemToken: 'claveai'
                });
              }

              // 3. Save the message
              console.log('WebhookProcessor: Saving message for lead:', leadId);
              const messagesRef = collection(db, 'messages');
              
              await addDoc(messagesRef, {
                leadId: leadId,
                senderId: 'client',
                content: content,
                timestamp: now,
                evolutionId: evolutionId || null,
                systemToken: 'claveai'
              });

              // Update lead with last message info
              console.log('WebhookProcessor: Updating lead last message info');
              await updateDoc(doc(db, 'leads', leadId), {
                lastMessage: content,
                lastMessageAt: now,
                updatedAt: now
              });

              // 4. Delete the processed event
              await deleteDoc(doc(db, 'webhook_events', eventDoc.id));
            } else {
              // Not a message upsert, just delete it
              await deleteDoc(doc(db, 'webhook_events', eventDoc.id));
            }
          } catch (error) {
            console.error('WebhookProcessor: Error processing event:', error);
            handleFirestoreError(error, OperationType.UPDATE, 'webhook_events/' + eventDoc.id);
          }
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'webhook_events');
    });

    return unsubscribe;
  }, [userProfile]);

  return null; // This component doesn't render anything
}
