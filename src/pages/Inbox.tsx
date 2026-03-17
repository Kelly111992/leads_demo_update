import React, { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc, arrayUnion, arrayRemove, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Send, MessageSquare, X, ChevronDown, User, Bot, Building2, Mail, DollarSign, Calendar, FileText, Sparkles, Loader2, PanelRightClose, PanelRightOpen, Trash2, Eraser, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { generateSuggestedReplies } from '../services/aiService';

export default function Inbox() {
  const { userProfile } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isAssignDropdownOpen, setIsAssignDropdownOpen] = useState(false);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const assignDropdownRef = useRef<HTMLDivElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  
  // New CRM States
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'notes'>('overview');
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isAiPopulated, setIsAiPopulated] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, type: 'lead' | 'message' | 'messages' | 'system' } | null>(null);

  useEffect(() => {
    if (newMessage.trim()) {
      setIsTyping(true);
    } else {
      setIsTyping(false);
    }
  }, [newMessage]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (assignDropdownRef.current && !assignDropdownRef.current.contains(event.target as Node)) {
        setIsAssignDropdownOpen(false);
      }
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setIsTagDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch available tags
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'tags'), (snapshot) => {
      setAvailableTags(snapshot.docs.map(doc => doc.data().name));
    });
    return unsubscribe;
  }, []);

  // Fetch leads
  useEffect(() => {
    if (!userProfile) {
      console.log('Inbox: No user profile yet');
      return;
    }
    console.log('Inbox: Fetching leads for role:', userProfile.role);
    let q: any = collection(db, 'leads');
    if (userProfile.role === 'agent') {
      q = query(q, where('assigneeId', '==', userProfile.uid));
    }
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLeads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('Inbox: Received', newLeads.length, 'leads');
      newLeads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      
      // Only update if leads have changed
      setLeads(prevLeads => {
        if (JSON.stringify(prevLeads) === JSON.stringify(newLeads)) return prevLeads;
        return newLeads;
      });
      
      // Auto-select first lead if none selected
      if (newLeads.length > 0 && !selectedLeadId) {
        setSelectedLeadId(newLeads[0].id);
      }
    }, (error) => {
      console.error("Error fetching leads:", error);
    });
    return unsubscribe;
  }, [userProfile]);

  // Fetch agents
  useEffect(() => {
    const q = collection(db, 'users');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setAgents(users.filter((u: any) => u.role === 'admin' || u.role === 'agent'));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const currentLead = leads.find(l => l.id === selectedLeadId);
    if (currentLead && currentLead.aiEnabled !== isAiEnabled) {
      setIsAiEnabled(currentLead.aiEnabled || false);
    }
  }, [selectedLeadId, leads]);

  useEffect(() => {
    console.log('Inbox: selectedLeadId changed to:', selectedLeadId);
    if (!selectedLeadId) {
      setMessages([]);
      return;
    }
    
    setIsAiPopulated(false);

    const q = query(collection(db, 'messages'), where('leadId', '==', selectedLeadId));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      console.log('Inbox: Received snapshot with', snapshot.docs.length, 'messages');
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      msgs.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      // Use functional update to avoid dependency on messages state
      setMessages(prevMsgs => {
        console.log('Inbox: Setting messages:', msgs.length);
        // Simple check to avoid unnecessary state updates if data hasn't changed
        // (Firestore onSnapshot usually handles this, but it's a good safeguard)
        if (JSON.stringify(prevMsgs) === JSON.stringify(msgs)) return prevMsgs;
        return msgs;
      });
      
      // Generate AI suggestions if enabled and there are messages
      const lastMsg = msgs[msgs.length - 1];
      const currentLead = leads.find(l => l.id === selectedLeadId);
      if (currentLead?.aiEnabled && msgs.length > 0 && lastMsg.senderId === 'client') {
        setIsGeneratingAi(true);
        try {
          const suggestions = await generateSuggestedReplies(msgs, currentLead);
          setAiSuggestions(suggestions);
        } catch (error) {
          console.error("Error fetching AI suggestions:", error);
        } finally {
          setIsGeneratingAi(false);
        }
      } else if (!currentLead?.aiEnabled) {
        setAiSuggestions([]);
      }

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });
    return unsubscribe;
  }, [selectedLeadId]);

  const handleUpdateLeadField = async (field: string, value: any) => {
    if (!selectedLeadId) return;
    try {
      await updateDoc(doc(db, 'leads', selectedLeadId), {
        [field]: value,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error updating ${field}:`, error);
    }
  };

  const handleToggleAi = async () => {
    const newValue = !isAiEnabled;
    setIsAiEnabled(newValue);
    await handleUpdateLeadField('aiEnabled', newValue);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedLeadId || !userProfile) return;

    const msgText = newMessage.trim();
    setNewMessage('');
    setIsAiPopulated(false);
    
    const lead = leads.find(l => l.id === selectedLeadId);

    try {
      // 1. Save to Firestore (Optimistic update)
      const now = new Date().toISOString();
      const docRef = await addDoc(collection(db, 'messages'), {
        leadId: selectedLeadId,
        senderId: userProfile.uid,
        content: msgText,
        timestamp: now
      });

      await updateDoc(doc(db, 'leads', selectedLeadId), {
        updatedAt: now,
        lastMessage: msgText,
        lastMessageAt: now,
        status: 'in_progress'
      });

      // 2. Send via Evolution API if lead has a phone number
      if (lead && lead.phone) {
        // Clean the phone number (remove +, spaces, etc)
        const cleanPhone = (lead.phone || '').replace(/\D/g, '');
        
        const response = await fetch('/api/messages/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            phone: cleanPhone,
            text: msgText
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.evolutionId) {
            await updateDoc(docRef, { evolutionId: data.evolutionId });
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleAssignAgent = async (agentId: string) => {
    if (!selectedLeadId) return;
    try {
      await updateDoc(doc(db, 'leads', selectedLeadId), {
        assigneeId: agentId,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error assigning agent:", error);
    }
  };

  const handleAddTag = async (tagName: string) => {
    if (!selectedLeadId || !tagName.trim()) return;
    const normalizedTag = tagName.trim().toLowerCase();

    try {
      await updateDoc(doc(db, 'leads', selectedLeadId), {
        tags: arrayUnion(normalizedTag),
        updatedAt: new Date().toISOString()
      });

      if (!availableTags.includes(normalizedTag)) {
        await addDoc(collection(db, 'tags'), { name: normalizedTag });
      }
      setTagInput('');
    } catch (error) {
      console.error("Error adding tag:", error);
    }
  };

  const handleRemoveTag = async (tagName: string) => {
    if (!selectedLeadId) return;
    try {
      await updateDoc(doc(db, 'leads', selectedLeadId), {
        tags: arrayRemove(tagName),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error removing tag:", error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    setConfirmDelete({ id: messageId, type: 'message' });
  };

  const handleDeleteLead = async (leadId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setConfirmDelete({ id: leadId, type: 'lead' });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    
    try {
      if (confirmDelete.type === 'message') {
        await deleteDoc(doc(db, 'messages', confirmDelete.id));
      } else if (confirmDelete.type === 'lead') {
        // Delete messages first
        const q = query(collection(db, 'messages'), where('leadId', '==', confirmDelete.id));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.docs.forEach((d) => {
          batch.delete(d.ref);
        });
        await batch.commit();
        
        await deleteDoc(doc(db, 'leads', confirmDelete.id));
        if (selectedLeadId === confirmDelete.id) {
          setSelectedLeadId(null);
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

  const handleClearMessages = async () => {
    setConfirmDelete({ id: 'all', type: 'messages' });
  };

  const handleClearSystem = async () => {
    setConfirmDelete({ id: 'all', type: 'system' });
  };

  const selectedLead = leads.find(l => l.id === selectedLeadId);
  const filteredLeads = leads.filter(l => 
    (l.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (l.phone || '').includes(searchTerm)
  );

  return (
    <div className="h-full flex bg-transparent overflow-hidden">
      {/* Left Panel: Leads List */}
      <div className="w-80 border-r border-white/10 flex flex-col bg-black/20 flex-shrink-0 backdrop-blur-md">
        <div className="p-4 border-b border-white/10 bg-white/5">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white tracking-tight">Bandeja de Entrada</h2>
            {userProfile?.role === 'admin' && (
              <div className="flex gap-2">
                <button
                  onClick={handleClearMessages}
                  className="inline-flex items-center px-3 py-1.5 rounded-xl bg-[#D9A21B]/10 text-[#D9A21B] border border-[#D9A21B]/20 hover:bg-[#D9A21B]/20 transition-all text-[10px] font-black uppercase tracking-[0.1em] gap-2 shadow-lg shadow-[#D9A21B]/5"
                  title="Limpiar solo mensajes"
                >
                  <Eraser className="h-3.5 w-3.5" />
                  Limpiar
                </button>
              </div>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar prospectos..." 
              className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:bg-white/10 focus:ring-2 focus:ring-[#D9A21B]/50 focus:border-transparent outline-none transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredLeads.map(lead => (
            <motion.div 
              key={lead.id}
              layout
              initial={false}
              animate={{
                backgroundColor: selectedLeadId === lead.id ? 'rgba(217, 162, 27, 0.15)' : 'rgba(255, 255, 255, 0)',
                borderLeftColor: selectedLeadId === lead.id ? '#D9A21B' : 'rgba(255, 255, 255, 0)'
              }}
              whileHover={{ backgroundColor: selectedLeadId === lead.id ? 'rgba(217, 162, 27, 0.2)' : 'rgba(255, 255, 255, 0.05)' }}
              onClick={() => setSelectedLeadId(lead.id)}
              className={`p-4 border-b border-white/5 cursor-pointer transition-all duration-200 border-l-4`}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <h3 className={`font-medium text-sm truncate pr-2 ${selectedLeadId === lead.id ? 'text-[#D9A21B]' : 'text-gray-200'}`}>{lead.name}</h3>
                  {userProfile?.role === 'admin' && (
                    <button 
                      onClick={(e) => handleDeleteLead(lead.id, e)}
                      className="p-1 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0">{lead.updatedAt ? format(new Date(lead.updatedAt), 'HH:mm', { locale: es }) : ''}</span>
              </div>
              <p className="text-xs text-gray-400 truncate">{lead.phone}</p>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex gap-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${lead.status === 'nuevo' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                    {(lead.status || 'nuevo').replace('_', ' ')}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    {lead.source || 'unknown'}
                  </span>
                </div>
                {lead.assigneeId && agents.find(a => a.id === lead.assigneeId) && (
                  <div className="flex items-center gap-1.5" title={`Assigned to ${agents.find(a => a.id === lead.assigneeId)?.name || 'Agent'}`}>
                    <div className="h-4 w-4 rounded-full bg-gradient-to-br from-[#D9A21B] to-[#7A2022] flex items-center justify-center text-[8px] text-white font-bold overflow-hidden shadow-sm">
                      {agents.find(a => a.id === lead.assigneeId)?.photoURL ? (
                        <img src={agents.find(a => a.id === lead.assigneeId)?.photoURL} alt={agents.find(a => a.id === lead.assigneeId)?.name || 'Agent'} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        (agents.find(a => a.id === lead.assigneeId)?.name || 'A').charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-gray-400 truncate max-w-[65px]">
                      {(agents.find(a => a.id === lead.assigneeId)?.name || 'Agent').split(' ')[0]}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {filteredLeads.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-500">
              No se encontraron conversaciones.
            </div>
          )}
        </div>
      </div>

      {/* Middle Panel: Chat Area */}
      <div className="flex-1 flex flex-col bg-transparent min-w-0 relative">
        {selectedLead ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-white/5 backdrop-blur-md flex-shrink-0 z-10">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#D9A21B] to-[#7A2022] flex items-center justify-center text-white font-bold mr-3 flex-shrink-0 shadow-lg shadow-[#D9A21B]/20">
                  {(selectedLead.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-white truncate flex items-center gap-2">
                    {selectedLead.name || 'Desconocido'}
                    {selectedLead.company && (
                      <span className="text-xs font-normal text-gray-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                        {selectedLead.company}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-[#D9A21B]/80 truncate">{selectedLead.phone}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Assigned Agent Display */}
                {agents.find(a => a.id === selectedLead.assigneeId) ? (
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10" title="Vendedor Asignado">
                    <div className="h-5 w-5 rounded-full bg-gradient-to-br from-[#D9A21B] to-[#7A2022] flex items-center justify-center text-[8px] text-white font-bold overflow-hidden shadow-sm">
                      {agents.find(a => a.id === selectedLead.assigneeId)?.photoURL ? (
                        <img src={agents.find(a => a.id === selectedLead.assigneeId)?.photoURL} alt={agents.find(a => a.id === selectedLead.assigneeId)?.name || 'Agente'} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        (agents.find(a => a.id === selectedLead.assigneeId)?.name || 'A').charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-300 truncate max-w-[100px]">{agents.find(a => a.id === selectedLead.assigneeId)?.name || 'Agente'}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 border-dashed" title="Sin vendedor asignado">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="text-xs font-medium text-gray-500">Sin asignar</span>
                  </div>
                )}
 
                {/* AI Copilot Toggle */}
                <div className="flex items-center gap-3 bg-black/20 px-3 py-1.5 rounded-xl border border-white/5">
                  <Bot className={`h-4 w-4 ${isAiEnabled ? 'text-indigo-400' : 'text-gray-500'}`} />
                  <span className="text-xs font-medium text-gray-300">Copiloto IA</span>
                  <button 
                    onClick={handleToggleAi}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isAiEnabled ? 'bg-[#D9A21B]' : 'bg-gray-600'}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isAiEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
 
                {/* Sidebar Toggle */}
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className={`p-2 rounded-xl border transition-all duration-300 ${isSidebarOpen ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                  title={isSidebarOpen ? "Ocultar Barra Lateral" : "Mostrar Barra Lateral"}
                >
                  {isSidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                </button>
              </div>
            </div>
 
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 bg-transparent space-y-4 relative z-0">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                  Aún no hay mensajes. Envía un mensaje para iniciar la conversación.
                </div>
              ) : (
                messages.map(msg => {
                  const isClient = msg.senderId === 'client';
                  return (
                    <motion.div 
                      key={msg.id} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className={`flex group ${isClient ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className={`relative max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-md backdrop-blur-sm ${isClient ? 'bg-white/10 border border-white/10 text-gray-200 rounded-tl-none' : 'bg-gradient-to-br from-[#7A2022] to-[#8B1D1D] text-white rounded-tr-none border border-[#7A2022]/30'}`}>
                        {userProfile?.role === 'admin' && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className={`absolute -top-2 ${isClient ? '-right-2' : '-left-2'} p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-red-600 z-10`}
                            title="Eliminar mensaje"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <span className={`text-[10px] mt-1 block text-right ${isClient ? 'text-gray-400' : 'text-red-200'}`}>
                          {msg.timestamp ? format(new Date(msg.timestamp), 'HH:mm', { locale: es }) : ''}
                        </span>
                      </div>
                    </motion.div>
                  );
                })
              )}
              
              {/* Typing Indicator */}
              <AnimatePresence>
                {(isTyping || isGeneratingAi) && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="flex justify-end"
                  >
                    <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2 flex items-center gap-1.5 shadow-sm">
                      <div className="flex gap-1">
                        <motion.span
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                          className="w-1.5 h-1.5 bg-indigo-400 rounded-full"
                        />
                        <motion.span
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                          className="w-1.5 h-1.5 bg-indigo-400 rounded-full"
                        />
                        <motion.span
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                          className="w-1.5 h-1.5 bg-indigo-400 rounded-full"
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 font-medium ml-1">
                        {isGeneratingAi ? 'La IA está pensando...' : 'Escribiendo...'}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-black/20 border-t border-white/10 flex-shrink-0 backdrop-blur-md z-10 flex flex-col gap-3">
              {/* AI Suggested Replies */}
              {isAiEnabled && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide min-h-[36px] items-center">
                  {isGeneratingAi ? (
                    <div className="flex items-center text-xs text-gray-500 gap-2 px-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Generando sugerencias...
                    </div>
                  ) : (
                    <>
                      {aiSuggestions.length > 0 ? (
                        aiSuggestions.map((suggestion, idx) => (
                          <button 
                            key={idx}
                            onClick={() => {
                              setNewMessage(suggestion);
                              setIsAiPopulated(true);
                            }} 
                            className="flex-shrink-0 inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-[#D9A21B]/10 text-[#D9A21B] border border-[#D9A21B]/20 hover:bg-[#D9A21B]/20 transition-colors"
                          >
                            <Sparkles className="h-3 w-3 mr-1.5" /> {suggestion}
                          </button>
                        ))
                      ) : (
                        <div className="text-[10px] text-gray-500 px-2 italic">
                          No hay sugerencias disponibles. Intenta enviar un mensaje.
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              
              <form onSubmit={handleSendMessage} className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-2xl p-2 shadow-inner">
                <textarea
                  value={newMessage}
                  onChange={e => {
                    setNewMessage(e.target.value);
                    setIsAiPopulated(false);
                  }}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 max-h-32 min-h-[40px] resize-none border-0 py-2 px-3 text-sm text-white placeholder-gray-500 focus:ring-0 outline-none bg-transparent"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                />
                <div className="flex items-center gap-2">
                  {isAiPopulated && (
                    <motion.button
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      type="submit"
                      className="h-10 px-4 flex-shrink-0 bg-gradient-to-r from-[#7A2022] to-[#8B1D1D] text-white rounded-xl flex items-center justify-center hover:from-[#6B1D1D] hover:to-[#7A2022] transition-all duration-300 shadow-lg shadow-[#7A2022]/30 text-xs font-semibold gap-2 border border-white/10"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      ¿Enviar respuesta de IA?
                    </motion.button>
                  )}
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="h-10 w-10 flex-shrink-0 bg-[#D9A21B] text-black rounded-xl flex items-center justify-center hover:bg-[#C59B27] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-[#D9A21B]/20"
                  >
                    <Send className="h-4 w-4 ml-0.5" />
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-transparent">
            <div className="h-24 w-24 bg-white/5 border border-white/10 rounded-full flex items-center justify-center shadow-lg mb-6 backdrop-blur-sm">
              <MessageSquare className="h-10 w-10 text-indigo-400/50" />
            </div>
            <p className="text-gray-400 font-medium text-lg">Selecciona una conversación</p>
            <p className="text-gray-500 text-sm mt-2">Elige un prospecto de la lista para empezar a mensajear</p>
          </div>
        )}
      </div>

      {/* Right Panel: Lead Details & Actions */}
      <AnimatePresence mode="wait">
        {selectedLead && isSidebarOpen && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="border-l border-white/10 bg-black/20 flex flex-col overflow-y-auto flex-shrink-0 backdrop-blur-md overflow-hidden"
          >
            <div className="flex border-b border-white/10 bg-white/5 min-w-[320px]">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-4 text-xs font-medium uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'overview' ? 'border-[#D9A21B] text-[#D9A21B]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              Resumen
            </button>
            <button 
              onClick={() => setActiveTab('profile')}
              className={`flex-1 py-4 text-xs font-medium uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'profile' ? 'border-[#D9A21B] text-[#D9A21B]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              Perfil
            </button>
            <button 
              onClick={() => setActiveTab('notes')}
              className={`flex-1 py-4 text-xs font-medium uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'notes' ? 'border-[#D9A21B] text-[#D9A21B]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              Notas
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="relative" ref={assignDropdownRef}>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Asignar a Vendedor</label>
                <button
                  type="button"
                  onClick={() => setIsAssignDropdownOpen(!isAssignDropdownOpen)}
                  className="w-full bg-white/5 text-left text-sm border border-white/10 rounded-xl shadow-sm focus:ring-2 focus:ring-[#D9A21B]/50 focus:border-transparent py-2.5 pl-3 pr-10 outline-none flex items-center justify-between transition-all hover:bg-white/10"
                >
                  <div className="flex items-center gap-2 truncate">
                    {agents.find(a => a.id === selectedLead.assigneeId) ? (
                      <>
                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#D9A21B] to-[#7A2022] flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0 overflow-hidden shadow-md">
                          {agents.find(a => a.id === selectedLead.assigneeId)?.photoURL ? (
                            <img src={agents.find(a => a.id === selectedLead.assigneeId)?.photoURL} alt={agents.find(a => a.id === selectedLead.assigneeId)?.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            agents.find(a => a.id === selectedLead.assigneeId)?.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="truncate text-gray-200">{agents.find(a => a.id === selectedLead.assigneeId)?.name}</span>
                      </>
                    ) : (
                      <>
                        <div className="h-6 w-6 rounded-full bg-white/10 text-gray-400 flex items-center justify-center flex-shrink-0">
                          <User className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-gray-400">Sin asignar</span>
                      </>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-400 absolute right-3" />
                </button>
 
                <AnimatePresence>
                  {isAssignDropdownOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="absolute z-20 mt-2 w-full bg-[#1a1a24] border border-white/10 shadow-2xl rounded-xl py-1 text-base overflow-auto focus:outline-none sm:text-sm backdrop-blur-xl"
                    >
                      <button
                        onClick={() => {
                          handleAssignAgent('');
                          setIsAssignDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-white/5 flex items-center gap-3 transition-colors"
                      >
                        <div className="h-7 w-7 rounded-full bg-white/5 text-gray-400 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                        <span className="text-gray-300">Sin asignar</span>
                      </button>
                      {agents.map(agent => (
                        <button
                          key={agent.id}
                          onClick={() => {
                            handleAssignAgent(agent.id);
                            setIsAssignDropdownOpen(false);
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-white/5 flex items-center gap-3 transition-colors"
                        >
                          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#D9A21B] to-[#7A2022] flex items-center justify-center text-xs text-white font-bold flex-shrink-0 overflow-hidden shadow-md">
                            {agent.photoURL ? (
                              <img src={agent.photoURL} alt={agent.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              agent.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <span className="text-gray-200 truncate">{agent.name}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
                <p className="mt-2 text-[10px] text-gray-500">Asigna esta conversación a un vendedor específico.</p>
              </div>
 
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Estado</label>
                <select
                  value={selectedLead.status}
                  onChange={(e) => updateDoc(doc(db, 'leads', selectedLead.id), { status: e.target.value, updatedAt: new Date().toISOString() })}
                  className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-xl shadow-sm focus:ring-2 focus:ring-[#D9A21B]/50 focus:border-transparent py-2.5 pl-3 pr-10 outline-none transition-all hover:bg-white/10 appearance-none"
                >
                  <option value="nuevo" className="bg-[#1a1a24]">Nuevo</option>
                  <option value="asignado" className="bg-[#1a1a24]">Asignado</option>
                  <option value="en_progreso" className="bg-[#1a1a24]">En Progreso</option>
                  <option value="cerrado_ganado" className="bg-[#1a1a24]">Cerrado Ganado</option>
                  <option value="cerrado_perdido" className="bg-[#1a1a24]">Cerrado Perdido</option>
                </select>
              </div>
 
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Nombre</label>
                <input
                  type="text"
                  value={selectedLead.name || ''}
                  onChange={(e) => updateDoc(doc(db, 'leads', selectedLead.id), { name: e.target.value, updatedAt: new Date().toISOString() })}
                  placeholder="Nombre del Prospecto"
                  className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-xl shadow-sm focus:ring-2 focus:ring-[#D9A21B]/50 focus:border-transparent py-2.5 px-3 outline-none transition-all hover:bg-white/10 placeholder-gray-600"
                />
              </div>
 
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Teléfono</label>
                <input
                  type="tel"
                  value={selectedLead.phone || ''}
                  onChange={(e) => updateDoc(doc(db, 'leads', selectedLead.id), { phone: e.target.value, updatedAt: new Date().toISOString() })}
                  placeholder="+1 234 567 8900"
                  className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-xl shadow-sm focus:ring-2 focus:ring-[#D9A21B]/50 focus:border-transparent py-2.5 px-3 outline-none transition-all hover:bg-white/10 placeholder-gray-600"
                />
              </div>
 
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Correo Electrónico</label>
                <input
                  type="email"
                  value={selectedLead.email || ''}
                  onChange={(e) => updateDoc(doc(db, 'leads', selectedLead.id), { email: e.target.value, updatedAt: new Date().toISOString() })}
                  placeholder="prospecto@ejemplo.com"
                  className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-xl shadow-sm focus:ring-2 focus:ring-[#D9A21B]/50 focus:border-transparent py-2.5 px-3 outline-none transition-all hover:bg-white/10 placeholder-gray-600"
                />
              </div>
 
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Empresa</label>
                <input
                  type="text"
                  value={selectedLead.company || ''}
                  onChange={(e) => updateDoc(doc(db, 'leads', selectedLead.id), { company: e.target.value, updatedAt: new Date().toISOString() })}
                  placeholder="Nombre de la Empresa"
                  className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-xl shadow-sm focus:ring-2 focus:ring-[#D9A21B]/50 focus:border-transparent py-2.5 px-3 outline-none transition-all hover:bg-white/10 placeholder-gray-600"
                />
              </div>
 
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Origen</label>
                  <div className="text-sm text-indigo-300 capitalize flex items-center bg-indigo-500/10 border border-indigo-500/20 px-3 py-2.5 rounded-xl">
                    {selectedLead.source}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Último Contacto</label>
                  <div className="text-sm text-gray-300 flex items-center bg-white/5 border border-white/10 px-3 py-2.5 rounded-xl truncate" title={selectedLead.updatedAt ? format(new Date(selectedLead.updatedAt), 'PPpp', { locale: es }) : 'N/A'}>
                    {selectedLead.updatedAt ? format(new Date(selectedLead.updatedAt), "d 'de' MMM, h:mm a", { locale: es }) : 'N/A'}
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <button
                  onClick={() => handleDeleteLead(selectedLead.id)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all text-sm font-medium"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar Prospecto
                </button>
              </div>
 
              {/* Tags Section */}
              <div className="pt-6 border-t border-white/10">
                <label className="block text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">Etiquetas</label>
                <div className="flex flex-wrap gap-2 mb-4">
                  <AnimatePresence mode="popLayout">
                    {selectedLead.tags?.map((tag: string) => (
                      <motion.span 
                        key={tag} 
                        layout
                        initial={{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}
                        transition={{ duration: 0.2 }}
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm"
                      >
                        {tag}
                        <button onClick={() => handleRemoveTag(tag)} className="ml-1.5 hover:text-purple-100 outline-none transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </motion.span>
                    ))}
                    {(!selectedLead.tags || selectedLead.tags.length === 0) && (
                      <motion.span 
                        key="no-tags"
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-xs text-gray-500 italic"
                      >
                        Sin etiquetas asignadas
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                
                <div className="relative" ref={tagDropdownRef}>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => {
                        setTagInput(e.target.value);
                        setIsTagDropdownOpen(true);
                      }}
                      onFocus={() => setIsTagDropdownOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag(tagInput);
                          setIsTagDropdownOpen(false);
                        }
                      }}
                      placeholder="Añadir etiqueta..."
                      className="flex-1 text-sm bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-xl shadow-sm focus:ring-2 focus:ring-[#D9A21B]/50 focus:border-transparent py-2 px-3 outline-none transition-all"
                    />
                    <button
                      onClick={() => {
                        handleAddTag(tagInput);
                        setIsTagDropdownOpen(false);
                      }}
                      disabled={!tagInput.trim()}
                      className="px-4 py-2 bg-[#D9A21B]/20 text-[#D9A21B] border border-[#D9A21B]/30 text-sm font-medium rounded-xl hover:bg-[#D9A21B]/30 hover:text-[#D9A21B] disabled:opacity-30 transition-all duration-300 shadow-sm"
                    >
                      Añadir
                    </button>
                  </div>

                  <AnimatePresence>
                    {isTagDropdownOpen && availableTags.filter(t => t.toLowerCase().includes(tagInput.toLowerCase()) && !selectedLead.tags?.includes(t)).length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute z-30 mt-2 w-full bg-[#1a1a24] border border-white/10 shadow-2xl rounded-xl py-1 max-h-48 overflow-y-auto backdrop-blur-xl"
                      >
                        {availableTags
                          .filter(t => t.toLowerCase().includes(tagInput.toLowerCase()) && !selectedLead.tags?.includes(t))
                          .map(tag => (
                            <button
                              key={tag}
                              onClick={() => {
                                handleAddTag(tag);
                                setIsTagDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 transition-colors flex items-center justify-between group"
                            >
                              <span>{tag}</span>
                              <Sparkles className="h-3 w-3 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5" /> Empresa
                  </label>
                  <input 
                    type="text" 
                    value={selectedLead.company || ''}
                    onChange={(e) => handleUpdateLeadField('company', e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full text-sm bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-xl py-2.5 px-3 outline-none focus:ring-2 focus:ring-[#D9A21B]/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" /> Correo Electrónico
                  </label>
                  <input 
                    type="email" 
                    value={selectedLead.email || ''}
                    onChange={(e) => handleUpdateLeadField('email', e.target.value)}
                    placeholder="cliente@ejemplo.com"
                    className="w-full text-sm bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-xl py-2.5 px-3 outline-none focus:ring-2 focus:ring-[#D9A21B]/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5" /> Valor Est.
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input 
                      type="number" 
                      value={selectedLead.value || ''}
                      onChange={(e) => handleUpdateLeadField('value', Number(e.target.value))}
                      placeholder="5000"
                      className="w-full text-sm bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-xl py-2.5 pl-7 pr-3 outline-none focus:ring-2 focus:ring-[#D9A21B]/50 transition-all"
                    />
                  </div>
                </div>
              </div>
            )}
 
            {activeTab === 'notes' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" /> Próximo Seguimiento
                  </label>
                  <input 
                    type="date" 
                    value={selectedLead.nextFollowUp || ''}
                    onChange={(e) => handleUpdateLeadField('nextFollowUp', e.target.value)}
                    className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-xl py-2.5 px-3 outline-none focus:ring-2 focus:ring-[#D9A21B]/50 transition-all [color-scheme:dark]"
                  />
                </div>
                
                <div className="pt-4 border-t border-white/10">
                  <label className="block text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" /> Notas Internas
                  </label>
                  <textarea
                    value={selectedLead.internalNotes || ''}
                    onChange={(e) => handleUpdateLeadField('internalNotes', e.target.value)}
                    placeholder="Añade notas sobre los requisitos de este cliente..."
                    rows={6}
                    className="w-full text-sm bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-xl py-3 px-3 outline-none focus:ring-2 focus:ring-[#D9A21B]/50 transition-all resize-none"
                  />
                  <p className="text-[10px] text-gray-500 mt-2">Las notas se guardan automáticamente y solo son visibles para tu equipo.</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>

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
                {confirmDelete.type === 'message' ? '¿Estás seguro de que deseas eliminar este mensaje?' :
                 confirmDelete.type === 'lead' ? '¿Estás seguro de que deseas eliminar este prospecto y toda su conversación? Esta acción no se puede deshacer.' :
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
    </div>
  );
}
