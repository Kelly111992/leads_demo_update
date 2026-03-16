import React, { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Users, CheckCircle, Clock, AlertCircle, ChevronLeft, ChevronRight, Phone, Tag } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

export default function Dashboard() {
  const { userProfile } = useAuth();
  const [stats, setStats] = useState({ new: 0, assigned: 0, in_progress: 0, closed_won: 0, closed_lost: 0 });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    if (!userProfile) return;

    let q: any = collection(db, 'leads');
    if (userProfile.role === 'agent') {
      q = query(q, where('assigneeId', '==', userProfile.uid));
    }

    const unsubscribeStats = onSnapshot(q, (snapshot) => {
      const newStats = { new: 0, assigned: 0, in_progress: 0, closed_won: 0, closed_lost: 0 };
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status in newStats) {
          newStats[data.status as keyof typeof newStats]++;
        }
      });
      setStats(newStats);
    });

    let recentQ: any = collection(db, 'leads');
    if (userProfile.role === 'agent') {
      recentQ = query(recentQ, where('assigneeId', '==', userProfile.uid), orderBy('createdAt', 'desc'), limit(10));
    } else {
      recentQ = query(recentQ, orderBy('createdAt', 'desc'), limit(10));
    }

    const unsubscribeRecent = onSnapshot(recentQ, (snapshot) => {
      const leads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentLeads(leads);
      setLoading(false);
    });

    return () => {
      unsubscribeStats();
      unsubscribeRecent();
    };
  }, [userProfile]);

  const nextSlide = () => {
    setCarouselIndex((prev) => (prev + 1 >= recentLeads.length ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCarouselIndex((prev) => (prev - 1 < 0 ? recentLeads.length - 1 : prev - 1));
  };

  const statCards = [
    { name: 'New Leads', value: stats.new, icon: AlertCircle, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { name: 'In Progress', value: stats.in_progress + stats.assigned, icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
    { name: 'Closed Won', value: stats.closed_won, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { name: 'Total Leads', value: Object.values(stats).reduce((a, b) => (a as number) + (b as number), 0), icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  ];

  const chartData = [
    { name: 'New', count: stats.new },
    { name: 'Assigned', count: stats.assigned },
    { name: 'In Progress', count: stats.in_progress },
    { name: 'Won', count: stats.closed_won },
    { name: 'Lost', count: stats.closed_lost },
  ];

  if (loading) return <div className="p-8 text-center text-gray-400">Loading dashboard...</div>;

  return (
    <div className="space-y-8 p-8 h-full overflow-y-auto">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Dashboard Overview</h2>
        <p className="mt-2 text-sm text-gray-400">
          Welcome back, <span className="text-indigo-400 font-medium">{userProfile?.name}</span>. Here's what's happening with your leads today.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((item, index) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1, ease: "easeOut" }}
            key={item.name} 
            className="glass-panel glass-panel-hover rounded-2xl overflow-hidden transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
          >
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`rounded-xl p-3 border ${item.bg}`}>
                    <item.icon className={`h-6 w-6 ${item.color}`} aria-hidden="true" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-400 truncate">{item.name}</dt>
                    <dd>
                      <div className="text-2xl font-bold text-white mt-1">{item.value}</div>
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
        transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" }}
        className="glass-panel rounded-2xl p-6 lg:p-8"
      >
        <h3 className="text-lg font-medium text-white mb-6">Leads by Status</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.5)'}} axisLine={false} tickLine={false} />
              <YAxis stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.5)'}} axisLine={false} tickLine={false} />
              <Tooltip 
                cursor={{fill: 'rgba(255,255,255,0.05)'}}
                contentStyle={{ backgroundColor: 'rgba(10,10,15,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                itemStyle={{ color: '#818cf8' }}
              />
              <Bar dataKey="count" fill="url(#colorCount)" radius={[6, 6, 0, 0]} />
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={1}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.8}/>
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Recent Leads Carousel */}
      {recentLeads.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }}
          className="glass-panel rounded-2xl p-6 lg:p-8 relative overflow-hidden"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-white">Recent Leads</h3>
            <div className="flex gap-2">
              <button onClick={prevSlide} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={nextSlide} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="relative h-48 overflow-hidden rounded-xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={carouselIndex}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                {recentLeads[carouselIndex] && (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/10 rounded-xl p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xl font-bold text-white mb-1">{recentLeads[carouselIndex].name}</h4>
                        <div className="flex items-center text-gray-400 text-sm">
                          <Phone className="h-3.5 w-3.5 mr-1.5" />
                          {recentLeads[carouselIndex].phone}
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium capitalize border
                        ${recentLeads[carouselIndex].source === 'whatsapp' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                          recentLeads[carouselIndex].source === 'facebook' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-pink-500/10 text-pink-400 border-pink-500/20'}`}>
                        {recentLeads[carouselIndex].source}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-end">
                      <div className="flex gap-2 flex-wrap">
                        {recentLeads[carouselIndex].tags?.slice(0, 3).map((tag: string) => (
                          <span key={tag} className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500">
                        {format(new Date(recentLeads[carouselIndex].createdAt), 'MMM d, yyyy h:mm a')}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          
          <div className="flex justify-center mt-4 gap-1.5">
            {recentLeads.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCarouselIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${idx === carouselIndex ? 'w-6 bg-indigo-500' : 'w-1.5 bg-white/20 hover:bg-white/40'}`}
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
