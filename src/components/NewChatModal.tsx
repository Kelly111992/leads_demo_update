import React, { useState } from 'react';
import { X, User, Phone, MessageSquare, Plus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (data: { name: string; phone: string; message: string }) => Promise<void>;
}

export function NewChatModal({ isOpen, onClose, onSend }: NewChatModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.message) return;
    
    setLoading(true);
    try {
      await onSend(formData);
      setFormData({ name: '', phone: '', message: '' });
      onClose();
    } catch (error) {
      console.error("Error creating chat:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="glass-panel max-w-md w-full p-8 rounded-3xl shadow-2xl border border-white/10 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#D9A21B]/5 to-[#7A2022]/5 pointer-events-none"></div>
            
            <button 
              onClick={onClose}
              disabled={loading}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-gray-400 transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6">
              <h3 className="text-2xl font-bold text-white tracking-tight">Iniciar Conversación</h3>
              <p className="text-sm text-gray-400 mt-1">Registra al prospecto y envíale el primer mensaje por WhatsApp.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Nombre Completo *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-gray-500" />
                  </div>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl py-2.5 pl-10 pr-4 outline-none focus:ring-2 focus:ring-[#D9A21B]/50 transition-all placeholder-gray-600 text-sm"
                    placeholder="Ej: Carlos Ramírez"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Teléfono de WhatsApp *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4 text-gray-500" />
                  </div>
                  <input
                    required
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl py-2.5 pl-10 pr-4 outline-none focus:ring-2 focus:ring-[#D9A21B]/50 transition-all placeholder-gray-600 text-sm"
                    placeholder="Ej: +52 1 234 567 8900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Primer Mensaje *</label>
                <div className="relative">
                  <div className="absolute top-3 left-0 pl-3.5 flex items-start pointer-events-none">
                    <MessageSquare className="h-4 w-4 text-gray-500" />
                  </div>
                  <textarea
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-[#D9A21B]/50 transition-all placeholder-gray-600 text-sm min-h-[100px] resize-none"
                    placeholder="Hola Carlos, te contacto de Altepsa para..."
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-semibold text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !formData.name || !formData.phone || !formData.message}
                  className="inline-flex items-center justify-center px-6 py-2.5 bg-[#D9A21B] text-black text-sm font-bold rounded-xl hover:bg-[#D9A21B]/90 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar y Crear
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
