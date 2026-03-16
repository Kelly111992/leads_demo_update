import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Filter, Building2, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'motion/react';

const STATUSES = ['new', 'assigned', 'in_progress', 'closed_won', 'closed_lost'];

export default function Leads() {
  const { userProfile } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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

  const handleAddLead = async () => {
    try {
      await addDoc(collection(db, 'leads'), {
        name: 'New Lead',
        phone: '+1234567890',
        source: 'whatsapp',
        status: 'new',
        assigneeId: userProfile?.uid,
        tags: [],
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error adding lead:", error);
    }
  };

  const filteredLeads = leads.filter(lead => 
    lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.phone.includes(searchTerm)
  );

  if (loading) return <div className="p-8 text-center text-gray-400">Loading leads...</div>;

  return (
    <div className="h-full flex flex-col p-8 overflow-hidden">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Leads Kanban</h2>
          <p className="mt-2 text-sm text-gray-400">Manage and track your WhatsApp leads.</p>
        </div>
        <button
          onClick={handleAddLead}
          className="inline-flex items-center px-5 py-2.5 border border-indigo-500/30 shadow-lg shadow-indigo-500/20 text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 transition-all duration-300 hover:-translate-y-0.5"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Add Lead
        </button>
      </div>

      <div className="mb-8 flex space-x-4">
        <div className="flex-1 relative rounded-xl shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent block w-full pl-11 sm:text-sm border-white/10 bg-white/5 text-white placeholder-gray-500 rounded-xl py-3 px-4 outline-none transition-all"
            placeholder="Search leads by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="inline-flex items-center px-5 py-3 border border-white/10 shadow-sm text-sm font-medium rounded-xl text-gray-300 bg-white/5 hover:bg-white/10 transition-all duration-300">
          <Filter className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
          Filters
        </button>
      </div>

      <div className="flex-1 overflow-x-auto flex space-x-6 pb-4">
        {STATUSES.map(status => (
          <div key={status} className="w-80 flex-shrink-0 flex flex-col glass-panel rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-black/20 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
                {status.replace('_', ' ')}
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
                    <div className="min-w-0 pr-2">
                      <h4 className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors truncate">{lead.name}</h4>
                      {lead.company && (
                        <p className="text-[11px] text-gray-400 flex items-center mt-0.5 truncate">
                          <Building2 className="h-3 w-3 mr-1 flex-shrink-0" />
                          {lead.company}
                        </p>
                      )}
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
                      <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex justify-between items-center mt-2 pt-4 border-t border-white/10">
                    <span className="text-[10px] text-gray-500">
                      {format(new Date(lead.updatedAt), 'MMM d, h:mm a')}
                    </span>
                    <select
                      className="text-xs bg-black/40 border border-white/10 text-gray-300 rounded-lg py-1 pl-2 pr-6 outline-none focus:ring-1 focus:ring-indigo-500 appearance-none hover:bg-black/60 transition-colors"
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                    >
                      {STATUSES.map(s => (
                        <option key={s} value={s} className="bg-[#1a1a24]">{s.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
