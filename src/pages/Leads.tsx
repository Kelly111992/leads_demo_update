import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Filter, Building2, DollarSign, Trash2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { AddLeadModal } from '../components/AddLeadModal';

const STATUSES = ['nuevo', 'asignado', 'en_progreso', 'cerrado_ganado', 'cerrado_perdido'];

export default function Leads() {
  const { userProfile } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, type: 'lead' | 'messages' | 'system' } | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    if (!userProfile) return;

    let q: any = collection(db, 'leads');
    if (userProfile.role === 'agent') {
      q = query(q, where('assigneeId', '==', userProfile.uid));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLeads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLeads(newLeads);
      setLoading(false);
    });

    return unsubscribe;
  }, [userProfile]);

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'leads', leadId), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleAddLead = async (leadData: { name: string; company: string; phone: string; email: string }) => {
    try {
      await addDoc(collection(db, 'leads'), {
        ...leadData,
        source: 'whatsapp',
        status: 'nuevo',
        assigneeId: userProfile?.uid,
        tags: [],
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error adding lead:", error);
      throw error;
    }
  };

  const handleDeleteLead = async (leadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete({ id: leadId, type: 'lead' });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    
    try {
      if (confirmDelete.type === 'lead') {
        await deleteDoc(doc(db, 'leads', confirmDelete.id));
      } else if (confirmDelete.type === 'messages') {
        const collectionsToClear = ['messages', 'webhook_events'];
        for (const colName of collectionsToClear) {
          const snapshot = await getDocs(collection(db, colName));
          const batch = writeBatch(db);
          snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }
      } else if (confirmDelete.type === 'system') {
        const collectionsToClear = ['leads', 'messages', 'webhook_events'];
        for (const colName of collectionsToClear) {
          const snapshot = await getDocs(collection(db, colName));
          const batch = writeBatch(db);
          snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }
      }
      setConfirmDelete(null);
    } catch (error) {
      console.error("Error in delete operation:", error);
      setConfirmDelete(null);
    }
  };

  const handleClearMessages = async () => {
    setConfirmDelete({ id: 'all', type: 'messages' });
  };

  const handleClearSystem = async () => {
    setConfirmDelete({ id: 'all', type: 'system' });
  };

  const filteredLeads = leads.filter(lead => 
    lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.phone.includes(searchTerm)
  );

  if (loading) return <div className="p-8 text-center text-gray-400">Cargando prospectos...</div>;

  return (
    <div className="h-full flex flex-col p-8 overflow-hidden">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Kanban de Prospectos</h2>
          <p className="mt-2 text-sm text-gray-400">Gestiona y rastrea tus prospectos de WhatsApp.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center px-5 py-2.5 border border-[#D9A21B]/30 shadow-lg shadow-[#D9A21B]/20 text-sm font-medium rounded-xl text-black bg-[#D9A21B] hover:bg-[#C59B27] transition-all duration-300 hover:-translate-y-0.5"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Añadir Prospecto
          </button>
        </div>
      </div>

      <div className="mb-8 flex space-x-4">
        <div className="flex-1 relative rounded-xl shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="focus:ring-2 focus:ring-[#D9A21B]/50 focus:border-transparent block w-full pl-11 sm:text-sm border-white/10 bg-white/5 text-white placeholder-gray-500 rounded-xl py-3 px-4 outline-none transition-all"
            placeholder="Buscar prospectos por nombre o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="inline-flex items-center px-5 py-3 border border-white/10 shadow-sm text-sm font-medium rounded-xl text-gray-300 bg-white/5 hover:bg-white/10 transition-all duration-300">
          <Filter className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
          Filtros
        </button>
      </div>

      <div className="flex-1 overflow-x-auto flex space-x-6 pb-4">
        {STATUSES.map(status => (
          <div key={status} className="w-80 flex-shrink-0 flex flex-col glass-panel rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-black/20 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
                {status === 'nuevo' ? 'Nuevo' : 
                 status === 'asignado' ? 'Asignado' : 
                 status === 'en_progreso' ? 'En Progreso' : 
                 status === 'cerrado_ganado' ? 'Ganado' : 
                 status === 'cerrado_perdido' ? 'Perdido' : 
                 status.replace('_', ' ')}
              </h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-gray-300 border border-white/5">
                {filteredLeads.filter(l => l.status === status).length}
              </span>
            </div>
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {filteredLeads.filter(l => l.status === status).map((lead, index) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  key={lead.id} 
                  className="bg-white/5 border border-white/10 p-5 rounded-xl shadow-sm hover:shadow-lg hover:bg-white/10 transition-all duration-300 cursor-pointer group"
                >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="min-w-0 pr-2">
                          <h4 className="text-sm font-medium text-white group-hover:text-[#D9A21B] transition-colors truncate">{lead.name}</h4>
                          {lead.company && (
                            <p className="text-[11px] text-gray-400 flex items-center mt-0.5 truncate">
                              <Building2 className="h-3 w-3 mr-1 flex-shrink-0" />
                              {lead.company}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium capitalize border flex-shrink-0
                        ${lead.source === 'whatsapp' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                          lead.source === 'facebook' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-pink-500/10 text-pink-400 border-pink-500/20'}`}>
                        {lead.source}
                      </span>
                    </div>
                  <p className="text-xs text-gray-500 mb-3">{lead.phone}</p>
                  
                  {lead.value && (
                    <div className="mb-3 flex items-center text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md w-fit">
                      <DollarSign className="h-3 w-3 mr-0.5" />
                      {lead.value.toLocaleString()}
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {lead.tags?.map((tag: string) => (
                      <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#D9A21B]/20 text-[#D9A21B] border border-[#D9A21B]/30">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex justify-between items-center mt-2 pt-4 border-t border-white/10">
                    <span className="text-[10px] text-gray-500">
                      {lead.updatedAt ? format(new Date(lead.updatedAt), "d 'de' MMM, h:mm a", { locale: es }) : 'Desconocido'}
                    </span>
                    <select
                      className="text-xs bg-black/40 border border-white/10 text-gray-300 rounded-lg py-1 pl-2 pr-6 outline-none focus:ring-1 focus:ring-[#D9A21B] appearance-none hover:bg-black/60 transition-colors"
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                    >
                      {STATUSES.map(s => (
                        <option key={s} value={s} className="bg-[#1a1a24]">
                          {s === 'nuevo' ? 'Nuevo' : 
                           s === 'asignado' ? 'Asignado' : 
                           s === 'en_progreso' ? 'En Progreso' : 
                           s === 'cerrado_ganado' ? 'Ganado' : 
                           s === 'cerrado_perdido' ? 'Perdido' : 
                           s.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel max-w-md w-full p-6 rounded-2xl shadow-2xl border border-white/10"
            >
              <div className="flex items-center gap-3 mb-4 text-red-400">
                <AlertCircle className="h-6 w-6" />
                <h3 className="text-xl font-bold text-white">Confirmar Eliminación</h3>
              </div>
              <p className="text-gray-300 mb-6">
                {confirmDelete.type === 'lead' ? '¿Estás seguro de que deseas eliminar este prospecto? Esta acción no se puede deshacer.' :
                 confirmDelete.type === 'messages' ? '¿Estás seguro de que deseas eliminar TODOS los mensajes y eventos? Los prospectos se mantendrán.' :
                 '¡ATENCIÓN! Esta acción eliminará TODOS los prospectos, mensajes y eventos del sistema. ¿Estás absolutamente seguro?'}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 transition-all text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all text-sm font-medium shadow-lg shadow-red-500/20"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AddLeadModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddLead}
      />
    </div>
  );
}
