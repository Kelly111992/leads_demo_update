import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Send, MessageSquare, User, Bot, Loader2, PanelRightClose, PanelRightOpen, Trash2, Eraser, AlertCircle, ChevronDown, Sparkles, UserCheck, X as XIcon, Calendar, Clock, ClipboardCheck, Zap, Phone, Mail, Building2, History, DollarSign, TrendingUp, CheckCircle2, Award } from 'lucide-react';
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
  
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'notes'>('overview');
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isAiPopulated, setIsAiPopulated] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, type: 'lead' | 'message' | 'messages' | 'system' } | null>(null);

  useEffect(() => {
    setIsTyping(!!String(newMessage || '').trim());
  }, [newMessage]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (assignDropdownRef.current && !assignDropdownRef.current.contains(event.target as Node)) setIsAssignDropdownOpen(false);
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) setIsTagDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchLeads = async () => {
    if (!userProfile) return;
    let query = supabase.from('leads').select('*');
    if (userProfile.role === 'agent') query = query.eq('assignee_id', userProfile.uid);
    
    const { data, error } = await query.order('updated_at', { ascending: false });
    if (!error && data) {
      setLeads(data);
      if (data.length > 0 && !selectedLeadId) setSelectedLeadId(data[0].id);
    }
  };

  const fetchAgents = async () => {
    const { data, error } = await supabase.from('users').select('*').in('role', ['admin', 'agent']);
    if (!error && data) setAgents(data);
  };

  const fetchTags = async () => {
    const { data, error } = await supabase.from('tags').select('name');
    if (!error && data) setAvailableTags(data.map(t => t.name));
  };

  const fetchMessages = async (leadId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('timestamp', { ascending: true });
    
    if (!error && data) {
      setMessages(data);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      
      const currentLead = leads.find(l => l.id === leadId);
      if (currentLead?.ai_enabled && data.length > 0 && data[data.length - 1].sender_id === 'client') {
        generateAi(data, currentLead);
      }
    }
  };

  const generateAi = async (msgs: any[], lead: any) => {
    setIsGeneratingAi(true);
    try {
      const suggestions = await generateSuggestedReplies(msgs, lead);
      setAiSuggestions(suggestions);
    } catch (error) {
      console.error("Error fetching AI suggestions:", error);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Lead real-time subscription
  useEffect(() => {
    fetchLeads();
    fetchAgents();
    fetchTags();

    console.log('🔗 Suscribiendo a cambios en leads...');
    const leadsSub = supabase.channel('leads-global-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        const newData = payload.new as any;
        console.log('📝 Cambio en Leads detectado:', payload.eventType, newData?.name);
        
        if (payload.eventType === 'INSERT') {
          setLeads(prev => {
            if (prev.some(l => l.id === payload.new.id)) return prev;
            return [payload.new, ...prev].sort((a, b) => 
              new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
            );
          });
        } else if (payload.eventType === 'UPDATE') {
          setLeads(prev => {
            const updated = prev.map(l => l.id === payload.new.id ? { ...l, ...payload.new } : l);
            return [...updated].sort((a, b) => 
              new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
            );
          });
        } else if (payload.eventType === 'DELETE') {
          setLeads(prev => prev.filter(l => l.id === payload.old.id));
        }
      })
      .subscribe((status) => {
        console.log('📡 Estado subscripción Leads:', status);
      });

    return () => {
      console.log('📴 Cancelando subscripción Leads');
      supabase.removeChannel(leadsSub);
    };
  }, [userProfile]);

  // Message real-time subscription
  useEffect(() => {
    if (!selectedLeadId) return;
    fetchMessages(selectedLeadId);
    
    console.log(`🔗 Suscribiendo a mensajes del lead: ${selectedLeadId}`);
    
    // Using a broader channel for stability and filtering locally
    const msgSub = supabase.channel('messages-global-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        // Filter messages for the current lead ONLY
        if (payload.new.lead_id === selectedLeadId) {
          console.log('📩 Nuevo mensaje recibido para este lead:', payload.new.content);
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            const updated = [...prev, payload.new].sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
            
            // Auto-regenerar sugerencias IA si es un mensaje del CLIENTE y la IA está habilitada
            if (payload.new.sender_id === 'client') {
              const currentLead = leads.find(l => l.id === selectedLeadId);
              if (currentLead?.ai_enabled) {
                setAiSuggestions([]); // Limpiar viejas sugerencias
                setTimeout(() => generateAi(updated, currentLead), 300);
              }
            }
            
            return updated;
          });
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe((status) => {
        console.log(`📡 Estado subscripción Mensajes (${selectedLeadId}):`, status);
      });

    return () => {
      console.log(`📴 Cancelando subscripción Mensajes para ${selectedLeadId}`);
      supabase.removeChannel(msgSub);
    };
  }, [selectedLeadId]);

  useEffect(() => {
    const currentLead = leads.find(l => l.id === selectedLeadId);
    if (currentLead) setIsAiEnabled(currentLead.ai_enabled || false);
  }, [selectedLeadId, leads]);

  const handleUpdateLeadField = async (field: string, value: any) => {
    if (!selectedLeadId) return;
    try {
      const { error } = await supabase
        .from('leads')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', selectedLeadId);
      if (error) throw error;
    } catch (error) {
      console.error(`Error updating ${field}:`, error);
    }
  };

  const handleToggleAi = async () => {
    const newValue = !isAiEnabled;
    setIsAiEnabled(newValue);
    await handleUpdateLeadField('ai_enabled', newValue);
    // Automatically trigger AI if toggled on and there are messages
    if (newValue && messages.length > 0) {
      const currentLead = leads.find(l => l.id === selectedLeadId);
      if (currentLead) generateAi(messages, currentLead);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const msgText = String(newMessage || '').trim();
    if (!msgText || !selectedLeadId || !userProfile) return;
    setNewMessage('');
    setIsAiPopulated(false);
    
    const lead = leads.find(l => l.id === selectedLeadId);

    try {
      const now = new Date().toISOString();
      const messageId = `msg_${Date.now()}`;

      // Optimistic UI Update
      const tempMsg = {
        id: messageId,
        lead_id: selectedLeadId,
        sender_id: userProfile.uid,
        content: msgText,
        timestamp: now,
        system_token: 'claveai'
      };
      setMessages(prev => [...prev, tempMsg]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

      const { error: msgError } = await supabase.from('messages').insert([{
        id: messageId,
        lead_id: selectedLeadId,
        sender_id: userProfile.uid,
        content: msgText,
        timestamp: now,
        system_token: 'claveai'
      }]);

      if (msgError) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
        throw msgError;
      }

      await supabase.from('leads').update({
        updated_at: now,
        last_contact_at: now,
        status: 'en_progreso'
      }).eq('id', selectedLeadId);

      if (lead && lead.phone) {
        const cleanPhone = (lead.phone || '').replace(/\D/g, '');
        const response = await fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: cleanPhone, text: msgText })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.evolutionId) {
            await supabase.from('messages').update({ evolution_id: data.evolutionId }).eq('id', messageId);
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleAssignAgent = async (agentId: string) => {
    await handleUpdateLeadField('assignee_id', agentId);
  };

  const handleAddTag = async (tagName: string) => {
    if (!selectedLeadId || !tagName.trim()) return;
    const normalizedTag = tagName.trim().toLowerCase();
    const currentLead = leads.find(l => l.id === selectedLeadId);
    const updatedTags = Array.from(new Set([...(currentLead?.tags || []), normalizedTag]));

    try {
      const { error } = await supabase.from('leads').update({
        tags: updatedTags,
        updated_at: new Date().toISOString()
      }).eq('id', selectedLeadId);

      if (error) throw error;

      if (!availableTags.includes(normalizedTag)) {
        await supabase.from('tags').upsert([{ name: normalizedTag }]);
        fetchTags();
      }
      setTagInput('');
    } catch (error) {
      console.error("Error adding tag:", error);
    }
  };

  const handleRemoveTag = async (tagName: string) => {
    if (!selectedLeadId) return;
    const currentLead = leads.find(l => l.id === selectedLeadId);
    const updatedTags = (currentLead?.tags || []).filter((t: string) => t !== tagName);
    
    try {
      await supabase.from('leads').update({
        tags: updatedTags,
        updated_at: new Date().toISOString()
      }).eq('id', selectedLeadId);
    } catch (error) {
      console.error("Error removing tag:", error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.type === 'message') {
        await supabase.from('messages').delete().eq('id', confirmDelete.id);
      } else if (confirmDelete.type === 'lead') {
        await supabase.from('messages').delete().eq('lead_id', confirmDelete.id);
        await supabase.from('leads').delete().eq('id', confirmDelete.id);
        if (selectedLeadId === confirmDelete.id) setSelectedLeadId(null);
      } else if (confirmDelete.type === 'messages') {
        await supabase.from('messages').delete().eq('system_token', 'claveai');
        await supabase.from('webhook_events').delete().eq('system_token', 'claveai');
      } else if (confirmDelete.type === 'system') {
        await supabase.from('leads').delete().eq('system_token', 'claveai');
        await supabase.from('messages').delete().eq('system_token', 'claveai');
        await supabase.from('webhook_events').delete().eq('system_token', 'claveai');
      }
      setConfirmDelete(null);
    } catch (error) {
      console.error("Error in delete operation:", error);
      setConfirmDelete(null);
    }
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
              <button
                onClick={() => setConfirmDelete({ id: 'all', type: 'messages' })}
                className="inline-flex items-center px-3 py-1.5 rounded-xl bg-[#D9A21B]/10 text-[#D9A21B] border border-[#D9A21B]/20 hover:bg-[#D9A21B]/20 transition-all text-[10px] font-black uppercase tracking-[0.1em] gap-2 shadow-lg shadow-[#D9A21B]/5"
              >
                <Eraser className="h-3.5 w-3.5" />
                Limpiar
              </button>
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
              onClick={() => setSelectedLeadId(lead.id)}
              className={`p-4 border-b border-white/5 cursor-pointer transition-all duration-200 border-l-4 ${selectedLeadId === lead.id ? 'bg-[#D9A21B]/15 border-[#D9A21B]' : 'hover:bg-white/5 border-transparent'}`}
            >
              <div className="flex justify-between items-start mb-1">
                <h3 className={`font-medium text-sm truncate pr-2 ${selectedLeadId === lead.id ? 'text-[#D9A21B]' : 'text-gray-200'}`}>{lead.name}</h3>
                <span className="text-xs text-gray-500">{lead.updated_at ? format(new Date(lead.updated_at), 'HH:mm', { locale: es }) : ''}</span>
              </div>
              <p className="text-xs text-gray-400 truncate">{lead.phone}</p>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex gap-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {(lead.status || 'nuevo').replace('_', ' ')}
                  </span>
                </div>
                {lead.assignee_id && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                    <div className="h-4 w-4 rounded-full bg-[#D9A21B] flex items-center justify-center text-[8px] font-black text-black overflow-hidden flex-shrink-0">
                      {agents.find(a => a.uid === lead.assignee_id)?.photo_url 
                        ? <img src={agents.find(a => a.uid === lead.assignee_id)?.photo_url} alt="A" className="h-full w-full object-cover" />
                        : (agents.find(a => a.uid === lead.assignee_id)?.name || 'V').charAt(0).toUpperCase()
                      }
                    </div>
                    <span className="text-[10px] text-gray-400 font-semibold truncate max-w-[80px]">
                      {agents.find(a => a.uid === lead.assignee_id)?.name || 'Vendedor'}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Middle Panel: Chat Area */}
      <div className="flex-1 flex flex-col bg-transparent min-w-0 relative">
        {selectedLead ? (
          <>
            <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-white/5 backdrop-blur-md flex-shrink-0 z-10">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#D9A21B] to-[#7A2022] flex items-center justify-center text-white font-bold mr-3 flex-shrink-0">
                  {(selectedLead.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-white">{selectedLead.name}</h2>
                    {selectedLead.assignee_id && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-gray-300 border border-white/10 flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {agents.find(a => a.uid === selectedLead.assignee_id)?.name || 'Vendedor'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#D9A21B]/80">{selectedLead.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleToggleAi}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${isAiEnabled ? 'bg-[#D9A21B]/20 border-[#D9A21B]/30 text-[#D9A21B]' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                  title={isAiEnabled ? 'IA Copiloto activada. Generando sugerencias contextuales.' : 'Activar IA Copiloto'}
                >
                  <Bot className="h-4 w-4" />
                  <span className="text-xs font-medium">Copiloto IA</span>
                </button>
                <button 
                  onClick={() => setConfirmDelete({ id: selectedLead.id, type: 'lead' })}
                  className="flex items-center justify-center p-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                  title="Eliminar Conversación"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="flex items-center justify-center p-1.5 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 transition-all"
                  title={isSidebarOpen ? 'Ocultar panel' : 'Mostrar panel'}
                >
                  {isSidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map(msg => {
                const isClient = msg.sender_id === 'client';
                const assignee = agents.find(a => a.uid === selectedLead.assignee_id);
                
                return (
                  <div key={msg.id} className={`flex flex-col ${isClient ? 'items-start' : 'items-end'}`}>
                    {!isClient && assignee && (
                      <span className="text-[9px] text-gray-500 mb-1 mr-1 uppercase font-bold tracking-tighter">
                        {assignee.name}
                      </span>
                    )}
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${isClient ? 'bg-white/10 text-gray-200' : 'bg-gradient-to-br from-[#7A2022] to-[#8B1D1D] text-white'}`}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <div className="flex items-center justify-between gap-4 mt-1">
                        <span className="text-[10px] opacity-50">{msg.timestamp ? format(new Date(msg.timestamp), 'HH:mm', { locale: es }) : ''}</span>
                        {!isClient && <User className="h-2.5 w-2.5 opacity-30" />}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-black/20 border-t border-white/10">
              {isAiEnabled && isGeneratingAi && (
                <div className="text-xs text-[#D9A21B] flex items-center gap-2 mb-3">
                  <Loader2 className="h-3 w-3 animate-spin"/> Leyendo contexto de la conversación...
                </div>
              )}
              {isAiEnabled && !isGeneratingAi && aiSuggestions.length > 0 && (
                <div className="flex gap-2 overflow-x-auto mb-3 pb-1 no-scrollbar">
                  <div className="flex items-center gap-2 pr-2 border-r border-white/10">
                    <button 
                      type="button"
                      onClick={() => setNewMessage("Estimado cliente, le adjunto nuestro catálogo de cortes premium Altepsa para esta semana. ¿Gusta que le cotice algún peso específico?")}
                      className="px-3 py-1.5 rounded-lg text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap font-bold flex items-center gap-1 hover:bg-emerald-500/20 transition-all"
                    >
                      <Zap className="h-3 w-3" /> Catálogo
                    </button>
                    <button 
                      type="button"
                      onClick={() => setNewMessage("Hola, claro que sí. Para esta picaña/ribeye el precio por kilo hoy es de $... ¿Cuántos kilos desea apartar?")}
                      className="px-3 py-1.5 rounded-lg text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 whitespace-nowrap font-bold flex items-center gap-1 hover:bg-blue-500/20 transition-all"
                    >
                      <DollarSign className="h-3 w-3" /> Cotizar
                    </button>
                    <button 
                      type="button"
                      onClick={() => setNewMessage("Confirmamos su pedido para entrega el día de mañana. ¿Su dirección sigue siendo la misma?")}
                      className="px-3 py-1.5 rounded-lg text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 whitespace-nowrap font-bold flex items-center gap-1 hover:bg-purple-500/20 transition-all"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Entrega
                    </button>
                  </div>
                  {aiSuggestions.map((s, i) => (
                    <button key={i} onClick={() => setNewMessage(String(s || ''))} className="px-3 py-1.5 rounded-lg text-[10px] bg-[#D9A21B]/10 text-[#D9A21B] border border-[#D9A21B]/20 whitespace-nowrap hover:bg-[#D9A21B]/20 transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input 
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-[#D9A21B]/50"
                />
                <button type="submit" className="h-10 w-10 bg-[#D9A21B] rounded-xl flex items-center justify-center text-black">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
            <p>Selecciona una conversación</p>
          </div>
        )}
      </div>

      {/* Right Panel: Lead Info */}
      <AnimatePresence>
      {selectedLead && isSidebarOpen && (
        <motion.div 
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="border-l border-white/10 bg-black/20 flex flex-col overflow-hidden flex-shrink-0"
        >
          <div className="flex border-b border-white/10 flex-shrink-0 bg-white/5">
            <button onClick={() => setActiveTab('overview')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'text-[#D9A21B] border-b-2 border-[#D9A21B] bg-[#D9A21B]/5' : 'text-gray-500 hover:text-gray-300'}`}>Panel</button>
            <button onClick={() => setActiveTab('profile')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'profile' ? 'text-[#D9A21B] border-b-2 border-[#D9A21B] bg-[#D9A21B]/5' : 'text-gray-500 hover:text-gray-300'}`}>Seguimiento</button>
            <button onClick={() => setActiveTab('notes')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'notes' ? 'text-[#D9A21B] border-b-2 border-[#D9A21B] bg-[#D9A21B]/5' : 'text-gray-500 hover:text-gray-300'}`}>Notas</button>
          </div>
          <div className="p-5 space-y-5 overflow-y-auto flex-1" style={{ minWidth: 320 }}>
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* STATUS & SOURCE QUICK VIEW */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-[9px] text-gray-500 uppercase font-black mb-1">Estado</p>
                    <p className="text-xs text-[#D9A21B] font-bold">{(selectedLead.status || 'nuevo').replace('_', ' ')}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-[9px] text-gray-500 uppercase font-black mb-1">Fuente</p>
                    <p className="text-xs text-white font-bold">{selectedLead.source || 'WhatsApp'}</p>
                  </div>
                </div>

                {/* ETIQUETAS */}
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest mb-3">Etiquetas de Canal</label>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {selectedLead.tags?.map((t: string) => (
                      <span key={t} className="px-2.5 py-1 rounded-lg bg-white/5 text-gray-400 text-[10px] font-bold flex items-center gap-1.5 border border-white/10">
                        {t}
                        <button onClick={() => handleRemoveTag(t)} className="hover:text-red-400 transition-colors">
                          <XIcon className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <input 
                    placeholder="+ Añadir etiqueta..." 
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value;
                        handleAddTag(val);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                    className="w-full bg-transparent border-b border-white/10 py-2 text-[11px] text-white outline-none focus:border-[#D9A21B] transition-colors placeholder-gray-700"
                  />
                </div>

                {/* AGENTE ASIGNADO */}
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase font-black tracking-widest mb-3">Agente Responsable</label>
                  <div className="space-y-2">
                    {agents.map(a => {
                      const isAssigned = selectedLead.assignee_id === a.uid;
                      if (!isAssigned) return null;
                      return (
                        <div key={a.uid} className="flex items-center gap-3 p-3 rounded-2xl bg-[#D9A21B]/10 border border-[#D9A21B]/30">
                          <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-[#D9A21B]/30 bg-black/40">
                            {a.photo_url ? <img src={a.photo_url} alt={a.name} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center font-bold text-[#D9A21B]">{a.name.charAt(0)}</div>}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-white">{a.name} {a.last_name || ''}</p>
                            <p className="text-[10px] text-[#D9A21B]">Atendiendo ahora</p>
                          </div>
                          <button onClick={() => setIsAssignDropdownOpen(!isAssignDropdownOpen)} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400">
                             <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                    {!selectedLead.assignee_id && (
                      <button onClick={() => setIsAssignDropdownOpen(true)} className="w-full py-4 border-2 border-dashed border-white/5 rounded-2xl text-[11px] text-gray-500 font-bold hover:bg-white/5 hover:border-white/10 transition-all">
                        + Asignar a un Vendedor
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                   <h4 className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-4">Línea de Tiempo del Lead</h4>
                   <div className="space-y-4">
                      <div className="flex gap-3">
                         <div className="w-8 flex flex-col items-center">
                            <div className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                               <Calendar className="h-3 w-3 text-emerald-500" />
                            </div>
                            <div className="flex-1 w-0.5 bg-white/5 my-1" />
                         </div>
                         <div className="flex-1 pb-4">
                            <p className="text-[11px] text-gray-200 font-bold">Primer Contacto</p>
                            <p className="text-[10px] text-gray-500">{selectedLead.created_at ? format(new Date(selectedLead.created_at), "d 'de' MMMM, HH:mm", { locale: es }) : 'N/A'}</p>
                         </div>
                      </div>

                      <div className="flex gap-3">
                         <div className="w-8 flex flex-col items-center">
                            <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                               <History className="h-3 w-3 text-blue-500" />
                            </div>
                            <div className="flex-1 w-0.5 bg-white/5 my-1" />
                         </div>
                         <div className="flex-1 pb-4">
                            <p className="text-[11px] text-gray-200 font-bold">Último Mensaje Recibido</p>
                            <p className="text-[10px] text-gray-500">{selectedLead.updated_at ? format(new Date(selectedLead.updated_at), "d 'de' MMMM, HH:mm", { locale: es }) : 'No hay mensajes aún'}</p>
                         </div>
                      </div>

                      <div className="flex gap-3">
                         <div className="w-8 flex flex-col items-center">
                            <div className="h-6 w-6 rounded-full bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
                               <Phone className="h-3 w-3 text-orange-500" />
                            </div>
                         </div>
                         <div className="flex-1">
                            <p className="text-[11px] text-gray-200 font-bold">Contacto de Vendedor</p>
                            <p className="text-[10px] text-gray-500">{selectedLead.last_contact_at ? format(new Date(selectedLead.last_contact_at), "d 'de' MMMM, HH:mm", { locale: es }) : 'Aún no contactado por agente'}</p>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                   <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 font-bold uppercase">Nombre Completo</span>
                      <span className="text-xs text-white font-medium">{selectedLead.name}</span>
                   </div>
                   <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 font-bold uppercase">Teléfono</span>
                      <span className="text-xs text-white font-medium">{selectedLead.phone}</span>
                   </div>
                   {selectedLead.company && (
                     <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Empresa</span>
                        <span className="text-xs text-[#D9A21B] font-medium">{selectedLead.company}</span>
                     </div>
                   )}
                </div>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="h-full flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Bitácora de Notas</h4>
                  <div className="h-1.5 w-1.5 rounded-full bg-[#D9A21B] shadow-[0_0_10px_#D9A21B]" />
                </div>
                <textarea 
                  value={selectedLead.notes || ''}
                  onChange={(e) => handleUpdateLeadField('notes', e.target.value)}
                  placeholder="Añade detalles técnicos, pedidos especiales, quejas o cumplidos aquí..."
                  className="flex-1 w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-gray-200 outline-none focus:ring-1 focus:ring-[#D9A21B]/50 resize-none leading-relaxed font-mono"
                />
              </div>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* AGENT ASSIGNMENT OVERLAY */}
      <AnimatePresence>
        {isAssignDropdownOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <motion.div 
               initial={{ scale: 0.95, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.95, opacity: 0 }}
               className="bg-[#111118] border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
             >
                <div className="flex items-center justify-between mb-6">
                   <h3 className="text-lg font-bold text-white">Cambiar Vendedor</h3>
                   <button onClick={() => setIsAssignDropdownOpen(false)} className="text-gray-500 hover:text-white"><XIcon className="h-5 w-5" /></button>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {agents.map(a => {
                    const isAssigned = selectedLead.assignee_id === a.uid;
                    return (
                      <button
                        key={a.uid}
                        onClick={() => { handleAssignAgent(a.uid); setIsAssignDropdownOpen(false); }}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all ${isAssigned ? 'bg-[#D9A21B]/20 border-[#D9A21B]/40' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                      >
                         <div className="h-8 w-8 rounded-full overflow-hidden bg-black/40">
                           {a.photo_url ? <img src={a.photo_url} alt={a.name} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-xs font-bold text-[#D9A21B]">{a.name.charAt(0)}</div>}
                         </div>
                         <div className="flex-1 text-left">
                            <p className="text-xs font-bold text-white">{a.name} {a.last_name || ''}</p>
                            <p className="text-[10px] text-gray-500">{a.role}</p>
                         </div>
                         {isAssigned && <UserCheck className="h-4 w-4 text-[#D9A21B]" />}
                      </button>
                    )
                  })}
                  {selectedLead.assignee_id && (
                    <button onClick={() => { handleAssignAgent(''); setIsAssignDropdownOpen(false); }} className="w-full py-3 text-[10px] text-red-400 font-black uppercase tracking-widest hover:bg-red-500/10 rounded-xl transition-all mt-4 border border-red-500/10">Quitar Asignación</button>
                  )}
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a24] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4 text-red-400">
              <AlertCircle className="h-6 w-6" />
              <h3 className="text-lg font-bold">Confirmar</h3>
            </div>
            <p className="text-sm text-gray-400 mb-6">¿Estás seguro de realizar esta acción? No se puede deshacer.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-gray-400">Cancelar</button>
              <button onClick={handleConfirmDelete} className="px-4 py-2 text-sm bg-red-500 text-white rounded-xl">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

