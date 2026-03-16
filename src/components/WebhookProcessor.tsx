import { useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, addDoc, updateDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export function WebhookProcessor() {
  const { userProfile } = useAuth();

  useEffect(() => {
    console.log('WebhookProcessor: Checking user profile', userProfile);
    // Only run the processor if the user is an admin or agent
    if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'agent')) {
      console.log('WebhookProcessor: 🛑 Detenido. No hay usuario o no tiene rol permitido.', userProfile?.role);
      return;
    }

    console.log('WebhookProcessor: Starting to listen for events');
    const eventsRef = collection(db, 'webhook_events');
    const q = query(eventsRef, where('status', '==', 'pending'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      console.log('WebhookProcessor: Received snapshot with', snapshot.docChanges().length, 'changes');
      for (const change of snapshot.docChanges()) {
        if (change.type === 'added') {
          const eventDoc = change.doc;
          const eventData = eventDoc.data();
          const payload = eventData.payload;
          console.log('WebhookProcessor: Processing event', eventDoc.id);

          try {
            // Mark as processing to prevent duplicate processing
            const eventRef = doc(db, 'webhook_events', eventDoc.id);
            console.log('WebhookProcessor: Intentando marcar como procesando:', eventDoc.id);

            // Usamos setDoc con merge: true en lugar de updateDoc para evitar el error "No document to update"
            // y asegurar que el documento existe antes de intentar actualizarlo.
            await setDoc(eventRef, { status: 'processing' }, { merge: true });
            console.log('WebhookProcessor: Marcado como procesando ✅', eventDoc.id);

            if ((payload.event === 'messages.upsert' || payload.event === 'MESSAGES_UPSERT') && payload.data) {
              const messageData = payload.data.message || payload.data;

              // Ignore messages sent by ourselves
              if (messageData.key?.fromMe) {
                console.log('WebhookProcessor: Ignorando mensaje propio');
                await deleteDoc(eventRef);
                continue;
              }

              const remoteJid = messageData.key?.remoteJid;
              if (!remoteJid || remoteJid.includes('@g.us')) {
                console.log('WebhookProcessor: Ignorando mensaje de grupo o sin JID');
                await deleteDoc(eventRef);
                continue;
              }

              const phone = remoteJid.split('@')[0];
              const pushName = messageData.pushName || phone;

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

              console.log('WebhookProcessor: Procesando mensaje de:', pushName, 'Contenido:', content);

              // 1. Check if lead exists
              const leadsRef = collection(db, 'leads');
              const leadQuery = query(leadsRef, where('phone', '==', phone));
              const querySnapshot = await getDocs(leadQuery);

              let leadId = '';
              const now = new Date().toISOString();

              if (querySnapshot.empty) {
                console.log('WebhookProcessor: Creando nuevo lead');
                const newLead = {
                  name: pushName,
                  phone: phone,
                  source: 'whatsapp',
                  status: 'new',
                  createdAt: now,
                  updatedAt: now,
                  systemToken: 'claveai'
                };
                const docRef = await addDoc(leadsRef, newLead);
                leadId = docRef.id;
              } else {
                console.log('WebhookProcessor: Actualizando lead existente');
                const leadDoc = querySnapshot.docs[0];
                leadId = leadDoc.id;
                await updateDoc(doc(db, 'leads', leadId), {
                  updatedAt: now,
                  status: leadDoc.data().status === 'closed_won' || leadDoc.data().status === 'closed_lost' ? 'new' : leadDoc.data().status,
                  systemToken: 'claveai'
                });
              }

              // 2. Save the message
              console.log('WebhookProcessor: Guardando mensaje para lead:', leadId);
              const messagesRef = collection(db, 'messages');
              await addDoc(messagesRef, {
                leadId: leadId,
                senderId: 'client',
                content: content,
                timestamp: now,
                systemToken: 'claveai'
              });

              // 3. Delete the processed event
              console.log('WebhookProcessor: Borrando evento procesado ✅');
              await deleteDoc(eventRef);
            } else {
              // Not a message upsert, just delete it
              console.log('WebhookProcessor: Evento no reconocido, borrando');
              await deleteDoc(eventRef);
            }
          } catch (error) {
            console.error('WebhookProcessor: ❌ Error procesando evento:', error);
            // Mark as failed so we can inspect it later
            try {
              const eventRef = doc(db, 'webhook_events', eventDoc.id);
              await setDoc(eventRef, { status: 'failed', error: String(error) }, { merge: true });
            } catch (innerError) {
              console.error('WebhookProcessor: ❌ Error fatal al intentar marcar como fallido:', innerError);
            }
          }
        }
      }
    });

    return unsubscribe;
  }, [userProfile]);

  return null; // This component doesn't render anything
}
