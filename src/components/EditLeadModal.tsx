import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Phone, Mail, Building, Tag, FileText, Save, Loader2, CheckCircle2, ChevronRight, UserPlus, Sparkles } from 'lucide-react';
import { supabase } from '../supabase';

interface EditLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
  onUpdate: (updatedLead: any) => void;
  agents: any[];
}

export function EditLeadModal({ isOpen, onClose, lead, onUpdate, agents }: EditLeadModalProps) {
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'notes'>('info');

  useEffect(() => {
    if (lead) {
      setFormData({
        name: lead.name || '',
        phone: lead.phone || '',
        email: lead.email || '',
        company: lead.company || '',
        status: lead.status || 'nuevo',
        source: lead.source || 'whatsapp',
        assignee_id: lead.assignee_id || '',
        summary: lead.summary || '',
        notes: lead.notes || ''
      });
    }
  }, [lead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .update({
          ...formData,
          updated_at: new Date().toISOString()
        })
        .eq('id', lead.id)
        .select()
        .single();

      if (error) throw error;
      onUpdate(data);
      onClose();
    } catch (error) {
      console.error("Error updating lead:", error);
      alert("Error al actualizar el prospecto");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative w-full max-w-2xl bg-[#0F0F0F] rounded-[2.5rem] border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden glass-panel"
      >
        {/* Header */}
        <div className="p-8 border-b border-white/5 bg-white/5 flex justify-between items-center">
          <div className="flex items-center gap-4 text-[#D9A21B]">
            <div className="h-12 w-12 rounded-2xl bg-[#D9A21B]/10 flex items-center justify-center border border-[#D9A21B]/20">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Editar Prospecto</h3>
              <p className="text-xs text-gray-500 font-medium">Actualiza la información detallada del lead.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl text-gray-400 hover:text-white transition-all hover:bg-white/10 border border-white/10 shadow-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-8 border-b border-white/5">
          <button 
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'info' ? 'text-[#D9A21B] border-b-2 border-[#D9A21B]' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Información
          </button>
          <button 
            onClick={() => setActiveTab('notes')}
            className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'notes' ? 'text-[#D9A21B] border-b-2 border-[#D9A21B]' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Resumen y Notas
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {activeTab === 'info' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-2">
                    <User className="h-3 w-3" /> Nombre Completo
                  </label>
                  <input
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#D9A21B]/50 transition-all placeholder:text-gray-600"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-2">
                    <Phone className="h-3 w-3" /> WhatsApp / Teléfono
                  </label>
                  <input
                    required
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#D9A21B]/50 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-2">
                    <Mail className="h-3 w-3" /> Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#D9A21B]/50 transition-all shadow-inner"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-2">
                    <Building className="h-3 w-3" /> Empresa / Categoría
                  </label>
                  <input
                    value={formData.company}
                    onChange={e => setFormData({ ...formData, company: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#D9A21B]/50 transition-all shadow-inner"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3" /> Estado del Lead
                  </label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#D9A21B]/50 transition-all appearance-none"
                  >
                    <option value="nuevo">Nuevo Prospecto</option>
                    <option value="asignado">Asignado</option>
                    <option value="en_progreso">En Progreso</option>
                    <option value="cerrado_ganado">Venta Cerrada</option>
                    <option value="cerrado_perdido">Perdido</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-2">
                    <UserPlus className="h-3 w-3" /> Asignar a Vendedor
                  </label>
                  <select
                    value={formData.assignee_id}
                    onChange={e => setFormData({ ...formData, assignee_id: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#D9A21B]/50 transition-all appearance-none"
                  >
                    <option value="">Sin asignar</option>
                    {agents.map(agent => (
                      <option key={agent.uid} value={agent.uid}>{agent.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-2">
                    <Sparkles className="h-3 w-3 text-[#D9A21B]" /> Resumen de IA (Conversación)
                  </label>
                  <textarea
                    value={formData.summary}
                    onChange={e => setFormData({ ...formData, summary: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-3xl px-6 py-4 text-xs text-gray-300 outline-none focus:ring-2 focus:ring-[#D9A21B]/50 min-h-[120px] resize-none leading-relaxed"
                    placeholder="Resumen automático o manual de los intereses del cliente..."
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-2">
                    <FileText className="h-3 w-3" /> Notas de Seguimiento Internas
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-3xl px-6 py-4 text-xs text-gray-300 outline-none focus:ring-2 focus:ring-[#D9A21B]/50 min-h-[120px] resize-none leading-relaxed"
                    placeholder="Añade detalles relevantes para tu equipo de ventas..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-8 border-t border-white/5 bg-white/5 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
            >
              Descartar Cambios
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[1.5] inline-flex items-center justify-center gap-3 px-8 py-4 bg-[#D9A21B] text-black font-black uppercase text-[11px] tracking-widest rounded-3xl shadow-[0_12px_24px_-8px_rgba(217,162,27,0.3)] hover:shadow-[0_12px_32px_-8px_rgba(217,162,27,0.5)] transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
