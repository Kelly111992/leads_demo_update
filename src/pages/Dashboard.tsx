import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
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
  UserPlus,
  MessageSquare,
  TrendingUp
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AddLeadModal } from '../components/AddLeadModal';

export default function Dashboard() {
  const { userProfile } = useAuth();
  const [stats, setStats] = useState({ nuevo: 0, asignado: 0, en_progreso: 0, cerrado_ganado: 0, cerrado_perdido: 0 });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, type: 'lead' | 'messages' | 'system' } | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchData = async () => {
    if (!userProfile) return;

    try {
      let leadsQuery = supabase.from('leads').select('*');
      if (userProfile.role === 'agent') {
        leadsQuery = leadsQuery.eq('assignee_id', userProfile.uid);
      }
      
      const { data: allLeads, error } = await leadsQuery;
      if (error) throw error;

      if (allLeads) {
        // Calculate Stats
        const newStats = { nuevo: 0, asignado: 0, en_progreso: 0, cerrado_ganado: 0, cerrado_perdido: 0 };
        allLeads.forEach((lead) => {
          if (lead.status in newStats) {
            newStats[lead.status as keyof typeof newStats]++;
          }
        });
        setStats(newStats);

        // Recent Leads
        const sortedLeads = [...allLeads].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        setRecentLeads(sortedLeads.slice(0, 10));

        // Agent Performance
        if (userProfile.role === 'admin') {
          const { data: users } = await supabase.from('users').select('*').in('role', ['admin', 'agent']);
          if (users) {
            const performance = users.map(agent => {
              const agentLeads = allLeads.filter(l => l.assignee_id === agent.uid);
              const wonLeads = agentLeads.filter(l => l.status === 'cerrado_ganado');
              const conversionRate = agentLeads.length > 0 ? (wonLeads.length / agentLeads.length) * 100 : 0;
              return {
                id: agent.uid,
                name: agent.name,
                photoURL: agent.photo_url,
                totalLeads: agentLeads.length,
                wonLeads: wonLeads.length,
                conversionRate: conversionRate.toFixed(1)
              };
            });
            performance.sort((a, b) => parseFloat(b.conversionRate) - parseFloat(a.conversionRate));
            setAgentPerformance(performance);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase.channel('dashboard-refresher')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userProfile]);

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.type === 'lead') {
        await supabase.from('leads').delete().eq('id', confirmDelete.id);
      } else if (confirmDelete.type === 'messages') {
        await supabase.from('messages').delete().eq('system_token', 'claveai');
      } else if (confirmDelete.type === 'system') {
        await supabase.from('leads').delete().eq('system_token', 'claveai');
        await supabase.from('messages').delete().eq('system_token', 'claveai');
      }
      setConfirmDelete(null);
      fetchData();
    } catch (error) {
      console.error("Error in delete:", error);
    }
  };

  const handleAddLead = async (leadData: { name: string; company: string; phone: string; email: string }) => {
    try {
      const { error } = await supabase.from('leads').insert([{
        id: `wa_${leadData.phone}`,
        ...leadData,
        source: 'whatsapp',
        status: 'nuevo',
        assignee_id: userProfile?.uid,
        system_token: 'claveai'
      }]);
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error("Error adding lead:", error);
      throw error;
    }
  };

  const statCards = [
    { name: 'Nuevos Prospectos', value: stats.nuevo, icon: AlertCircle, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { name: 'En Progreso', value: stats.en_progreso + stats.asignado, icon: Clock, color: 'text-[#D9A21B]', bg: 'bg-[#D9A21B]/10' },
    { name: 'Ganados', value: stats.cerrado_ganado, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { name: 'Total', value: Object.values(stats).reduce((a, b) => a + b, 0), icon: Users, color: 'text-red-400', bg: 'bg-red-500/10' },
  ];

  const chartData = [
    { name: 'Nuevo', count: stats.nuevo },
    { name: 'Asignado', count: stats.asignado },
    { name: 'Progreso', count: stats.en_progreso },
    { name: 'Ganado', count: stats.cerrado_ganado },
    { name: 'Perdido', count: stats.cerrado_perdido },
  ];

  if (loading) return <div className="p-8 text-center text-gray-400">Cargando panel...</div>;

  return (
    <div className="space-y-12 p-8 h-full overflow-y-auto bg-transparent">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-white">Resumen del Panel</h2>
          <p className="text-gray-400 mt-1">Hola <span className="text-[#D9A21B]">{userProfile?.name}</span>, estas son tus métricas.</p>
        </div>
        <button onClick={() => setIsAddModalOpen(true)} className="px-5 py-2.5 bg-[#D9A21B] text-black rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-[#D9A21B]/20">
          <UserPlus className="h-4 w-4" /> Nuevo Prospecto
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((item, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-panel p-6 border border-white/5 rounded-2xl flex items-center gap-4">
            <div className={`p-3 rounded-lg ${item.bg}`}>
              <item.icon className={`h-6 w-6 ${item.color}`} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{item.name}</p>
              <p className="text-2xl font-bold text-white">{item.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-panel p-8 rounded-3xl border border-white/5">
          <h3 className="text-xl font-bold text-white mb-6">Embudo de Ventas</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#555" tick={{fill: '#555'}} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ background: '#111', border: 'none', borderRadius: '8px' }} />
                <Bar dataKey="count" fill="#D9A21B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-8 rounded-3xl border border-white/5 overflow-hidden">
          <h3 className="text-xl font-bold text-white mb-6">Recientes</h3>
          <div className="space-y-4">
            {recentLeads.slice(0, 5).map((lead, i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{lead.name}</p>
                  <p className="text-[10px] text-gray-500">{lead.phone}</p>
                </div>
                <span className="text-[10px] px-2 py-1 rounded bg-[#D9A21B]/10 text-[#D9A21B] border border-[#D9A21B]/20 uppercase">
                  {lead.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AddLeadModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onAdd={handleAddLead} />

      {/* Delete confirmation modal omitted for brevity or handled via Leads page mainly */}
    </div>
  );
}
