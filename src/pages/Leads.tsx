import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Filter, MoreHorizontal, User, Mail, Phone, Calendar, Trash2, Edit2, LayoutGrid, CheckCircle2, XCircle, Clock, Sparkles } from 'lucide-react';
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
  const [agents, setAgents] = useState<any[]>([]);

  const fetchLeads = async () => {
    if (!userProfile) return;
    
    let query = supabase.from('leads').select('*');
    if (userProfile.role === 'agent') {
      query = query.eq('assignee_id', userProfile.uid);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      console.error("Error fetching leads:", error);
    } else {
      setLeads(data || []);
    }
    setLoading(false);
  };

  const fetchAgents = async () => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (!error) setAgents(data || []);
  };

  useEffect(() => {
    fetchLeads();
    fetchAgents();

    const channel = supabase
      .channel('public:leads:kanban')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        console.log('Realtime Leads Event (Kanban):', payload.eventType, payload.new);
        if (payload.eventType === 'INSERT') {
          setLeads(prev => [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setLeads(prev => prev.map(l => l.id === payload.new.id ? { ...l, ...payload.new } : l));
        } else if (payload.eventType === 'DELETE') {
          setLeads(prev => prev.filter(l => l.id === payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile]);

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleAddLead = async (leadData: { name: string; company: string; phone: string; email: string }) => {
    try {
      const { error } = await supabase
        .from('leads')
        .insert([{
          ...leadData,
          id: `wa_${leadData.phone}`,
          source: 'whatsapp',
          status: 'nuevo',
          assignee_id: userProfile?.uid,
          tags: [],
          notes: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          system_token: 'claveai'
        }]);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error adding lead:", error);
      throw error;
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    
    try {
      if (confirmDelete.type === 'lead') {
        const { error } = await supabase
          .from('leads')
          .delete()
          .eq('id', confirmDelete.id);
        if (error) throw error;
      } else if (confirmDelete.type === 'messages') {
        await supabase.from('messages').delete().eq('system_token', 'claveai');
      } else if (confirmDelete.type === 'system') {
        await supabase.from('leads').delete().eq('system_token', 'claveai');
        await supabase.from('messages').delete().eq('system_token', 'claveai');
      }
      setConfirmDelete(null);
      fetchLeads();
    } catch (error) {
      console.error("Error in delete operation:", error);
      setConfirmDelete(null);
    }
  };

  const filteredLeads = leads.filter(lead => 
    lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.phone?.includes(searchTerm)
  );

  if (loading) return <div className="p-8 text-center text-gray-400">Cargando prospectos...</div>;

  return (
    <div className="h-full flex flex-col p-8 overflow-hidden bg-transparent">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Kanban de Prospectos</h2>
          <p className="mt-2 text-sm text-gray-400">Gestiona y rastrea tus prospectos de WhatsApp.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center px-5 py-2.5 bg-[#D9A21B] text-black font-bold rounded-xl shadow-lg shadow-[#D9A21B]/20 transition-all hover:-translate-y-0.5"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Añadir Prospecto
          </button>
        </div>
      </div>

      <div className="mb-8 flex space-x-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="w-full pl-11 bg-white/5 border border-white/10 text-white rounded-xl py-3 outline-none focus:ring-2 focus:ring-[#D9A21B]/50 transition-all"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-x-auto flex space-x-6 pb-4">
        {STATUSES.map(status => (
          <div key={status} className="w-80 flex-shrink-0 flex flex-col glass-panel rounded-2xl overflow-hidden border border-white/5 bg-black/20">
            <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest">
                {status.replace('_', ' ')}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-gray-400">
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
                  className="bg-white/5 border border-white/10 p-5 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-sm font-bold text-white truncate">{lead.name}</h4>
                    <div className="flex items-center gap-1.5">
                      {lead.summary && <Sparkles className="h-3 w-3 text-[#D9A21B] animate-pulse" />}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#D9A21B]/10 text-[#D9A21B] border border-[#D9A21B]/20">
                        {lead.source}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{lead.phone}</p>
                  
                  {lead.assignee_id && (
                    <div className="flex items-center gap-2 mb-4 px-2 py-1.5 rounded-xl bg-white/5 border border-white/5 w-fit">
                      <div className="h-5 w-5 rounded-full bg-[#D9A21B] flex items-center justify-center text-[10px] font-black text-black overflow-hidden flex-shrink-0">
                        {agents.find(a => a.uid === lead.assignee_id)?.photo_url 
                          ? <img src={agents.find(a => a.uid === lead.assignee_id)?.photo_url} alt="A" className="h-full w-full object-cover" />
                          : (agents.find(a => a.uid === lead.assignee_id)?.name || 'V').charAt(0).toUpperCase()
                        }
                      </div>
                      <span className="text-[11px] text-gray-300 font-bold">
                        {agents.find(a => a.uid === lead.assignee_id)?.name || 'Vendedor'}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center pt-4 border-t border-white/5">
                    <span className="text-[10px] text-gray-500">
                      {lead.updated_at ? format(new Date(lead.updated_at), "d MMM, h:mm a", { locale: es }) : ''}
                    </span>
                    <select
                      className="text-[10px] bg-black/40 border border-white/10 text-gray-300 rounded p-1"
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="glass-panel p-8 rounded-3xl max-w-sm w-full border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">Confirmar</h3>
              <p className="text-gray-400 mb-8">¿Estás seguro de realizar esta acción?</p>
              <div className="flex justify-end gap-4">
                <button onClick={() => setConfirmDelete(null)} className="text-gray-500">Cancelar</button>
                <button onClick={handleConfirmDelete} className="bg-red-500 px-6 py-2 rounded-xl text-white font-bold">Eliminar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AddLeadModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onAdd={handleAddLead} />
    </div>
  );
}
