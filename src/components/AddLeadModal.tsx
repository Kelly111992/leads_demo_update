import React, { useState } from 'react';
import { X, User, Building2, Phone, Mail, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (leadData: { name: string; company: string; phone: string; email: string }) => Promise<void>;
}

export function AddLeadModal({ isOpen, onClose, onAdd }: AddLeadModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;
    
    setLoading(true);
    try {
      await onAdd(formData);
      setFormData({ name: '', company: '', phone: '', email: '' });
      onClose();
    } catch (error) {
      console.error("Error adding lead:", error);
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
            className="glass-panel max-w-md w-full p-8 rounded-2xl shadow-2xl border border-white/10 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#D9A21B]/5 to-[#7A2022]/5 pointer-events-none"></div>
            
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-gray-400 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-8">
              <h3 className="text-2xl font-bold text-white tracking-tight">Nuevo Prospecto</h3>
              <p className="text-sm text-gray-400 mt-1">Ingresa los detalles del nuevo contacto.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Nombre Completo *</label>
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
                    placeholder="Ej: Juan Pérez"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Empresa</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Building2 className="h-4 w-4 text-gray-500" />
                  </div>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl py-2.5 pl-10 pr-4 outline-none focus:ring-2 focus:ring-[#D9A21B]/50 transition-all placeholder-gray-600 text-sm"
                    placeholder="Nombre de la empresa"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Teléfono *</label>
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
                    placeholder="+52 123 456 7890"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Correo Electrónico</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-gray-500" />
                  </div>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl py-2.5 pl-10 pr-4 outline-none focus:ring-2 focus:ring-[#D9A21B]/50 transition-all placeholder-gray-600 text-sm"
                    placeholder="correo@ejemplo.com"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 transition-all text-sm font-medium border border-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#D9A21B] text-black hover:bg-[#C59B27] transition-all text-sm font-bold shadow-lg shadow-[#D9A21B]/20 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="h-4 w-4 border-2 border-black/30 border-t-black animate-spin rounded-full"></div>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Crear Prospecto
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
