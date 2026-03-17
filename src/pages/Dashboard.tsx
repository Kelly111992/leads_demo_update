import React, { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit, doc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Users, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  Phone, 
  Tag, 
  Trash2, 
  Eraser,
  UserPlus,
  MessageSquare,
  TrendingUp,
  User
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AddLeadModal } from '../components/AddLeadModal';
import { addDoc } from 'firebase/firestore';

export default function Dashboard() {
  const { userProfile } = useAuth();
  const [stats, setStats] = useState({ nuevo: 0, asignado: 0, en_progreso: 0, cerrado_ganado: 0, cerrado_perdido: 0 });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, type: 'lead' | 'messages' | 'system' } | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    if (!userProfile) {
      setLoading(false);
      return;
    }

    let q: any = collection(db, 'leads');
    if (userProfile.role === 'agent') {
      q = query(q, where('assigneeId', '==', userProfile.uid));
    }

    const unsubscribeStats = onSnapshot(q, (snapshot) => {
      const newStats = { nuevo: 0, asignado: 0, en_progreso: 0, cerrado_ganado: 0, cerrado_perdido: 0 };
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status in newStats) {
          newStats[data.status as keyof typeof newStats]++;
        }
      });
      setStats(newStats);
    }, (error) => {
      console.error("Error fetching stats:", error);
      setLoading(false);
    });

    let recentQ: any = collection(db, 'leads');
    if (userProfile.role === 'agent') {
      recentQ = query(recentQ, where('assigneeId', '==', userProfile.uid), orderBy('updatedAt', 'desc'), limit(10));
    } else {
      recentQ = query(recentQ, orderBy('updatedAt', 'desc'), limit(10));
    }

    const unsubscribeRecent = onSnapshot(recentQ, (snapshot) => {
      const leads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentLeads(leads);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching recent leads:", error);
      setLoading(false);
    });

    // Fetch agent performance (only for admins)
    let unsubscribeAgents: () => void = () => {};
    let unsubscribeAllLeads: () => void = () => {};
    
    if (userProfile.role === 'admin') {
      const agentsQ = collection(db, 'users');
      unsubscribeAgents = onSnapshot(agentsQ, (agentsSnapshot) => {
        const agents = agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        const activeAgents = agents.filter(a => a.role === 'agent' || a.role === 'admin');
        
        // Fetch all leads to calculate performance
        const allLeadsQ = collection(db, 'leads');
        if (unsubscribeAllLeads) unsubscribeAllLeads();
        unsubscribeAllLeads = onSnapshot(allLeadsQ, (leadsSnapshot) => {
          const allLeads = leadsSnapshot.docs.map(doc => doc.data());
          
          const performance = activeAgents.map(agent => {
            const agentLeads = allLeads.filter(l => l.assigneeId === agent.uid);
            const wonLeads = agentLeads.filter(l => l.status === 'cerrado_ganado');
            const conversionRate = agentLeads.length > 0 ? (wonLeads.length / agentLeads.length) * 100 : 0;
            
            return {
              id: agent.id,
              name: agent.name,
              photoURL: agent.photoURL,
              totalLeads: agentLeads.length,
              wonLeads: wonLeads.length,
              conversionRate: conversionRate.toFixed(1)
            };
          });
          
          performance.sort((a, b) => parseFloat(b.conversionRate) - parseFloat(a.conversionRate));
          setAgentPerformance(performance);
        });
      });
    }

    return () => {
      unsubscribeStats();
      unsubscribeRecent();
      unsubscribeAgents();
      if (unsubscribeAllLeads) unsubscribeAllLeads();
    };
  }, [userProfile]);

  const handleDeleteLead = async (leadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete({ id: leadId, type: 'lead' });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    
    try {
      if (confirmDelete.type === 'lead') {
        await deleteDoc(doc(db, 'leads', confirmDelete.id));
        if (carouselIndex >= recentLeads.length - 1 && recentLeads.length > 1) {
          setCarouselIndex(prev => prev - 1);
        }
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

  const nextSlide = () => {
    setCarouselIndex((prev) => (prev + 1 >= recentLeads.length ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCarouselIndex((prev) => (prev - 1 < 0 ? recentLeads.length - 1 : prev - 1));
  };

  const handleClearMessages = async () => {
    setConfirmDelete({ id: 'all', type: 'messages' });
  };

  const handleClearSystem = async () => {
    setConfirmDelete({ id: 'all', type: 'system' });
  };

  const statCards = [
    { name: 'Nuevos Prospectos', value: stats.nuevo, icon: AlertCircle, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { name: 'En Progreso', value: stats.en_progreso + stats.asignado, icon: Clock, color: 'text-[#D9A21B]', bg: 'bg-[#D9A21B]/10 border-[#D9A21B]/20' },
    { name: 'Cerrados Ganados', value: stats.cerrado_ganado, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { name: 'Total de Prospectos', value: Object.values(stats).reduce((a, b) => (a as number) + (b as number), 0), icon: Users, color: 'text-[#7A2022]', bg: 'bg-[#7A2022]/10 border-[#7A2022]/20' },
  ];

  const chartData = [
    { name: 'Nuevo', count: stats.nuevo },
    { name: 'Asignado', count: stats.asignado },
    { name: 'En Progreso', count: stats.en_progreso },
    { name: 'Ganado', count: stats.cerrado_ganado },
    { name: 'Perdido', count: stats.cerrado_perdido },
  ];

  if (loading) return <div className="p-8 text-center text-gray-400">Cargando panel...</div>;

  return (
    <div className="space-y-16 p-8 h-full overflow-y-auto bg-transparent">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-4xl font-bold text-white tracking-tight">Resumen del Panel</h2>
          <p className="mt-3 text-sm text-gray-400 tracking-wide max-w-2xl">
            Bienvenido de nuevo, <span className="text-[#D9A21B] font-semibold">{userProfile?.name}</span>. Esto es lo que está pasando con tus prospectos hoy.
          </p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center px-6 py-3 border border-[#D9A21B]/30 shadow-lg shadow-[#D9A21B]/20 text-sm font-bold rounded-xl text-black bg-[#D9A21B] hover:bg-[#C59B27] transition-all duration-300 hover:-translate-y-0.5 tracking-wide"
          >
            <UserPlus className="-ml-1 mr-2 h-5 w-5" />
            Añadir Prospecto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((item, index) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
            key={item.name} 
            className="glass-panel glass-panel-hover rounded-2xl overflow-hidden transition-all duration-500 transform hover:-translate-y-2 hover:shadow-[0_25px_60px_rgba(0,0,0,0.4)] border border-white/5 group"
          >
            <div className="p-8">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`rounded-2xl p-4 border shadow-lg transition-transform duration-500 group-hover:scale-110 ${item.bg}`}>
                    <item.icon className={`h-6 w-6 ${item.color}`} aria-hidden="true" />
                  </div>
                </div>
                <div className="ml-6 w-0 flex-1">
                  <dl>
                    <dt className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] truncate">{item.name}</dt>
                    <dd>
                      <div className="text-4xl font-bold text-white mt-2 tracking-tighter">{item.value}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
        className="glass-panel rounded-[2.5rem] p-10 lg:p-12 border border-white/5 shadow-2xl"
      >
        <div className="flex justify-between items-center mb-10">
          <h3 className="text-2xl font-bold text-white tracking-tight">Prospectos por Estado</h3>
          <div className="flex items-center gap-2 text-xs text-gray-400 font-medium tracking-widest uppercase">
            <TrendingUp className="h-4 w-4 text-[#D9A21B]" />
            Tendencia Actual
          </div>
        </div>
        <div className="h-[450px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.5)'}} axisLine={false} tickLine={false} />
              <YAxis stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.5)'}} axisLine={false} tickLine={false} />
              <Tooltip 
                cursor={{fill: 'rgba(255,255,255,0.05)'}}
                contentStyle={{ backgroundColor: 'rgba(10,10,15,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                itemStyle={{ color: '#D9A21B' }}
              />
              <Bar dataKey="count" fill="url(#colorCount)" radius={[6, 6, 0, 0]} />
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D9A21B" stopOpacity={1}/>
                  <stop offset="95%" stopColor="#7A2022" stopOpacity={0.8}/>
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Recent Leads Carousel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {recentLeads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
            className="glass-panel rounded-[2.5rem] p-10 lg:p-12 relative overflow-hidden border border-white/5 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-2xl font-bold text-white tracking-tight">Prospectos Recientes</h3>
              <div className="flex gap-3">
                <button onClick={prevSlide} className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all border border-white/10 hover:scale-110">
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button onClick={nextSlide} className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all border border-white/10 hover:scale-110">
                  <ChevronRight className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="relative h-56 overflow-hidden rounded-2xl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={carouselIndex}
                  initial={{ opacity: 0, x: 50, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -50, scale: 0.98 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  {recentLeads[carouselIndex] && (
                    <div className="w-full h-full bg-gradient-to-br from-[#D9A21B]/15 to-[#7A2022]/15 border border-white/10 rounded-2xl p-8 flex flex-col justify-between group relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <MessageSquare className="h-24 w-24 text-white" />
                      </div>
                      <div className="flex justify-between items-start relative z-10">
                        <div>
                          <h4 className="text-2xl font-bold text-white mb-2 tracking-tight">{recentLeads[carouselIndex].name}</h4>
                          <div className="flex items-center text-gray-300 text-sm font-medium">
                            <Phone className="h-4 w-4 mr-2 text-[#D9A21B]" />
                            {recentLeads[carouselIndex].phone}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border
                            ${recentLeads[carouselIndex].source === 'whatsapp' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 
                              recentLeads[carouselIndex].source === 'facebook' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-pink-500/20 text-pink-400 border-pink-500/30'}`}>
                            {recentLeads[carouselIndex].source}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-end relative z-10">
                        <div className="flex gap-2.5 flex-wrap">
                          {recentLeads[carouselIndex].tags?.slice(0, 3).map((tag: string) => (
                            <span key={tag} className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-[#D9A21B]/20 text-[#D9A21B] border border-[#D9A21B]/30">
                              <Tag className="h-3 w-3 mr-1.5" />
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="text-xs text-gray-400 font-medium">
                          {recentLeads[carouselIndex].createdAt ? format(new Date(recentLeads[carouselIndex].createdAt), "d 'de' MMM, yyyy h:mm a", { locale: es }) : 'Fecha desconocida'}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            
            <div className="flex justify-center mt-6 gap-2">
              {recentLeads.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCarouselIndex(idx)}
                  className={`h-2 rounded-full transition-all duration-500 ${idx === carouselIndex ? 'w-10 bg-[#D9A21B]' : 'w-2 bg-white/20 hover:bg-white/40'}`}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Agent Performance */}
        {userProfile.role === 'admin' && agentPerformance.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
            className="glass-panel rounded-[2.5rem] p-10 lg:p-12 border border-white/5 shadow-2xl"
          >
            <h3 className="text-2xl font-bold text-white mb-10 tracking-tight">Rendimiento de Agentes</h3>
            <div className="space-y-5">
              {agentPerformance.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 group">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#D9A21B] to-[#7A2022] flex items-center justify-center text-white font-bold overflow-hidden shadow-lg border border-white/10 group-hover:scale-105 transition-transform duration-300">
                      {agent.photoURL ? (
                        <img src={agent.photoURL} alt={agent.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        agent.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="text-base font-bold text-white tracking-tight">{agent.name}</p>
                      <p className="text-xs text-gray-400 mt-1 font-medium">{agent.totalLeads} prospectos asignados</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-[#D9A21B] tracking-tighter">{agent.conversionRate}%</p>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mt-1">Conversión</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
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
