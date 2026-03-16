import React, { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Send, MessageSquare, X, ChevronDown, User, Bot, Building2, Mail, DollarSign, Calendar, FileText, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

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
  const assignDropdownRef = useRef<HTMLDivElement>(null);
  
  // New CRM States
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'notes'>('overview');
  const [isAiEnabled, setIsAiEnabled] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (assignDropdownRef.current && !assignDropdownRef.current.contains(event.target as Node)) {
        setIsAssignDropdownOpen(false);
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
    if (!userProfile) return;
    let q: any = collection(db, 'leads');
    if (userProfile.role === 'agent') {
      q = query(q, where('assigneeId', '==', userProfile.uid));
    }
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLeads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      newLeads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setLeads(newLeads);
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

  // Fetch messages
  useEffect(() => {
    if (!selectedLeadId) {
      setMessages([]);
      return;
    }
    
    // Reset AI toggle state when changing leads
    const lead = leads.find(l => l.id === selectedLeadId);
    setIsAiEnabled(lead?.aiEnabled || false);

    const q = query(collection(db, 'messages'), where('leadId', '==', selectedLeadId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      msgs.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });
    return unsubscribe;
  }, [selectedLeadId, leads]);

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
    
    const lead = leads.find(l => l.id === selectedLeadId);

    try {
      // 1. Save to Firestore
      await addDoc(collection(db, 'messages'), {
        leadId: selectedLeadId,
        senderId: userProfile.uid,
        content: msgText,
        timestamp: new Date().toISOString()
      });

      await updateDoc(doc(db, 'leads', selectedLeadId), {
        updatedAt: new Date().toISOString(),
        status: 'in_progress'
      });

      // 2. Send via Evolution API if lead has a phone number
      if (lead && lead.phone) {
        // Clean the phone number (remove +, spaces, etc)
        const cleanPhone = lead.phone.replace(/\D/g, '');
        
        await fetch('/api/messages/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            phone: cleanPhone,
            text: msgText
          })
        });
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

  const selectedLead = leads.find(l => l.id === selectedLeadId);
  const filteredLeads = leads.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.phone.includes(searchTerm)
  );

  return (
    <div className="h-full flex bg-transparent overflow-hidden">
      {/* Left Panel: Leads List */}
      <div className="w-80 border-r border-white/10 flex flex-col bg-black/20 flex-shrink-0 backdrop-blur-md">
        <div className="p-4 border-b border-white/10 bg-white/5">
          <h2 className="text-lg font-semibold text-white mb-4">Inbox</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search leads..." 
              className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:bg-white/10 focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent outline-none transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredLeads.map(lead => (
            <div 
              key={lead.id}
              onClick={() => setSelectedLeadId(lead.id)}
              className={`p-4 border-b border-white/5 cursor-pointer transition-all duration-200 ${selectedLeadId === lead.id ? 'bg-indigo-500/20 border-l-4 border-l-indigo-400' : 'hover:bg-white/5 border-l-4 border-l-transparent'}`}
            >
              <div className="flex justify-between items-start mb-1">
                <h3 className={`font-medium text-sm truncate pr-2 ${selectedLeadId === lead.id ? 'text-indigo-300' : 'text-gray-200'}`}>{lead.name}</h3>
                <span className="text-xs text-gray-500 flex-shrink-0">{format(new Date(lead.updatedAt), 'HH:mm')}</span>
              </div>
              <p className="text-xs text-gray-400 truncate">{lead.phone}</p>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex gap-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${lead.status === 'new' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                    {lead.status.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    {lead.source}
                  </span>
                </div>
                {lead.assigneeId && agents.find(a => a.id === lead.assigneeId) && (
                  <div className="flex items-center gap-1.5" title={`Assigned to ${agents.find(a => a.id === lead.assigneeId)?.name}`}>
                    <div className="h-4 w-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[8px] text-white font-bold overflow-hidden shadow-sm">
                      {agents.find(a => a.id === lead.assigneeId)?.photoURL ? (
                        <img src={agents.find(a => a.id === lead.assigneeId)?.photoURL} alt={agents.find(a => a.id === lead.assigneeId)?.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        agents.find(a => a.id === lead.assigneeId)?.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-gray-400 truncate max-w-[65px]">
                      {agents.find(a => a.id === lead.assigneeId)?.name.split(' ')[0]}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {filteredLeads.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-500">
              No conversations found.
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
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold mr-3 flex-shrink-0 shadow-lg shadow-indigo-500/20">
                  {selectedLead.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-white truncate flex items-center gap-2">
                    {selectedLead.name}
                    {selectedLead.company && (
                      <span className="text-xs font-normal text-gray-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                        {selectedLead.company}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-indigo-300/80 truncate">{selectedLead.phone}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Assigned Agent Display */}
                {agents.find(a => a.id === selectedLead.assigneeId) ? (
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10" title="Assigned Seller">
                    <div className="h-5 w-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[8px] text-white font-bold overflow-hidden shadow-sm">
                      {agents.find(a => a.id === selectedLead.assigneeId)?.photoURL ? (
                        <img src={agents.find(a => a.id === selectedLead.assigneeId)?.photoURL} alt={agents.find(a => a.id === selectedLead.assigneeId)?.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        agents.find(a => a.id === selectedLead.assigneeId)?.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-300 truncate max-w-[100px]">{agents.find(a => a.id === selectedLead.assigneeId)?.name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 border-dashed" title="No seller assigned">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="text-xs font-medium text-gray-500">Unassigned</span>
                  </div>
                )}

                {/* AI Copilot Toggle */}
                <div className="flex items-center gap-3 bg-black/20 px-3 py-1.5 rounded-xl border border-white/5">
                  <Bot className={`h-4 w-4 ${isAiEnabled ? 'text-indigo-400' : 'text-gray-500'}`} />
                  <span className="text-xs font-medium text-gray-300">AI Copilot</span>
                  <button 
                    onClick={handleToggleAi}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isAiEnabled ? 'bg-indigo-500' : 'bg-gray-600'}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isAiEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 bg-transparent space-y-4 relative z-0">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                  No messages yet. Send a message to start the conversation.
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
                      className={`flex ${isClient ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-md backdrop-blur-sm ${isClient ? 'bg-white/10 border border-white/10 text-gray-200 rounded-tl-none' : 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-tr-none border border-indigo-500/30'}`}>
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <span className={`text-[10px] mt-1 block text-right ${isClient ? 'text-gray-400' : 'text-indigo-200'}`}>
                          {format(new Date(msg.timestamp), 'HH:mm')}
                        </span>
                      </div>
                    </motion.div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-black/20 border-t border-white/10 flex-shrink-0 backdrop-blur-md z-10 flex flex-col gap-3">
              {/* AI Suggested Replies */}
              {isAiEnabled && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  <button onClick={() => setNewMessage("Hi! How can I help you with our pricing today?")} className="flex-shrink-0 inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors">
                    <Sparkles className="h-3 w-3 mr-1.5" /> Send Pricing Info
                  </button>
                  <button onClick={() => setNewMessage("Would you like to schedule a quick demo call?")} className="flex-shrink-0 inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20 hover:bg-purple-500/20 transition-colors">
                    <Sparkles className="h-3 w-3 mr-1.5" /> Propose Demo
                  </button>
                  <button onClick={() => setNewMessage("I'll follow up with you next week. Have a great day!")} className="flex-shrink-0 inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
                    <Sparkles className="h-3 w-3 mr-1.5" /> Close Conversation
                  </button>
                </div>
              )}
              
              <form onSubmit={handleSendMessage} className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-2xl p-2 shadow-inner">
                <textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 max-h-32 min-h-[40px] resize-none border-0 py-2 px-3 text-sm text-white placeholder-gray-500 focus:ring-0 outline-none bg-transparent"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="h-10 w-10 flex-shrink-0 bg-indigo-500 text-white rounded-xl flex items-center justify-center hover:bg-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-indigo-500/20"
                >
                  <Send className="h-4 w-4 ml-0.5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-transparent">
            <div className="h-24 w-24 bg-white/5 border border-white/10 rounded-full flex items-center justify-center shadow-lg mb-6 backdrop-blur-sm">
              <MessageSquare className="h-10 w-10 text-indigo-400/50" />
            </div>
            <p className="text-gray-400 font-medium text-lg">Select a conversation</p>
            <p className="text-gray-500 text-sm mt-2">Choose a lead from the list to start messaging</p>
          </div>
        )}
      </div>

      {/* Right Panel: Lead Details & Actions */}
      {selectedLead && (
        <div className="w-80 border-l border-white/10 bg-black/20 flex flex-col overflow-y-auto flex-shrink-0 backdrop-blur-md">
          <div className="flex border-b border-white/10 bg-white/5">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-4 text-xs font-medium uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'overview' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              Overview
            </button>
            <button 
              onClick={() => setActiveTab('profile')}
              className={`flex-1 py-4 text-xs font-medium uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'profile' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              Profile
            </button>
            <button 
              onClick={() => setActiveTab('notes')}
              className={`flex-1 py-4 text-xs font-medium uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'notes' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              Notes
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="relative" ref={assignDropdownRef}>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Assign To Seller</label>
                <button
                  type="button"
                  onClick={() => setIsAssignDropdownOpen(!isAssignDropdownOpen)}
                  className="w-full bg-white/5 text-left text-sm border border-white/10 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent py-2.5 pl-3 pr-10 outline-none flex items-center justify-between transition-all hover:bg-white/10"
                >
                  <div className="flex items-center gap-2 truncate">
                    {agents.find(a => a.id === selectedLead.assigneeId) ? (
                      <>
                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0 overflow-hidden shadow-md">
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
                        <span className="text-gray-400">Unassigned</span>
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
                        <span className="text-gray-300">Unassigned</span>
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
                          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs text-white font-bold flex-shrink-0 overflow-hidden shadow-md">
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
                <p className="mt-2 text-[10px] text-gray-500">Assign this conversation to a specific seller.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Status</label>
                <select
                  value={selectedLead.status}
                  onChange={(e) => updateDoc(doc(db, 'leads', selectedLead.id), { status: e.target.value, updatedAt: new Date().toISOString() })}
                  className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent py-2.5 pl-3 pr-10 outline-none transition-all hover:bg-white/10 appearance-none"
                >
                  <option value="new" className="bg-[#1a1a24]">New</option>
                  <option value="assigned" className="bg-[#1a1a24]">Assigned</option>
                  <option value="in_progress" className="bg-[#1a1a24]">In Progress</option>
                  <option value="closed_won" className="bg-[#1a1a24]">Closed Won</option>
                  <option value="closed_lost" className="bg-[#1a1a24]">Closed Lost</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Name</label>
                <input
                  type="text"
                  value={selectedLead.name || ''}
                  onChange={(e) => updateDoc(doc(db, 'leads', selectedLead.id), { name: e.target.value, updatedAt: new Date().toISOString() })}
                  placeholder="Lead Name"
                  className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent py-2.5 px-3 outline-none transition-all hover:bg-white/10 placeholder-gray-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Phone</label>
                <input
                  type="tel"
                  value={selectedLead.phone || ''}
                  onChange={(e) => updateDoc(doc(db, 'leads', selectedLead.id), { phone: e.target.value, updatedAt: new Date().toISOString() })}
                  placeholder="+1 234 567 8900"
                  className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent py-2.5 px-3 outline-none transition-all hover:bg-white/10 placeholder-gray-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={selectedLead.email || ''}
                  onChange={(e) => updateDoc(doc(db, 'leads', selectedLead.id), { email: e.target.value, updatedAt: new Date().toISOString() })}
                  placeholder="lead@example.com"
                  className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent py-2.5 px-3 outline-none transition-all hover:bg-white/10 placeholder-gray-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Company</label>
                <input
                  type="text"
                  value={selectedLead.company || ''}
                  onChange={(e) => updateDoc(doc(db, 'leads', selectedLead.id), { company: e.target.value, updatedAt: new Date().toISOString() })}
                  placeholder="Company Name"
                  className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent py-2.5 px-3 outline-none transition-all hover:bg-white/10 placeholder-gray-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Source</label>
                  <div className="text-sm text-indigo-300 capitalize flex items-center bg-indigo-500/10 border border-indigo-500/20 px-3 py-2.5 rounded-xl">
                    {selectedLead.source}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Last Contacted</label>
                  <div className="text-sm text-gray-300 flex items-center bg-white/5 border border-white/10 px-3 py-2.5 rounded-xl truncate" title={selectedLead.updatedAt ? format(new Date(selectedLead.updatedAt), 'PPpp') : 'N/A'}>
                    {selectedLead.updatedAt ? format(new Date(selectedLead.updatedAt), 'MMM d, h:mm a') : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Tags Section */}
              <div className="pt-6 border-t border-white/10">
                <label className="block text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">Tags</label>
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
                        No tags assigned
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag(tagInput);
                      }
                    }}
                    placeholder="Add a tag..."
                    className="flex-1 text-sm bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent py-2 px-3 outline-none transition-all"
                    list="available-tags"
                  />
                  <datalist id="available-tags">
                    {availableTags.map(tag => (
                      <option key={tag} value={tag} />
                    ))}
                  </datalist>
                  <button
                    onClick={() => handleAddTag(tagInput)}
                    disabled={!tagInput.trim()}
                    className="px-4 py-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-sm font-medium rounded-xl hover:bg-indigo-500/30 hover:text-indigo-200 disabled:opacity-30 transition-all duration-300 shadow-sm"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5" /> Company
                  </label>
                  <input 
                    type="text" 
                    value={selectedLead.company || ''}
                    onChange={(e) => handleUpdateLeadField('company', e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full text-sm bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-xl py-2.5 px-3 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </label>
                  <input 
                    type="email" 
                    value={selectedLead.email || ''}
                    onChange={(e) => handleUpdateLeadField('email', e.target.value)}
                    placeholder="client@example.com"
                    className="w-full text-sm bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-xl py-2.5 px-3 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5" /> Est. Value
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input 
                      type="number" 
                      value={selectedLead.value || ''}
                      onChange={(e) => handleUpdateLeadField('value', Number(e.target.value))}
                      placeholder="5000"
                      className="w-full text-sm bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-xl py-2.5 pl-7 pr-3 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" /> Next Follow-up
                  </label>
                  <input 
                    type="date" 
                    value={selectedLead.nextFollowUp || ''}
                    onChange={(e) => handleUpdateLeadField('nextFollowUp', e.target.value)}
                    className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-xl py-2.5 px-3 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all [color-scheme:dark]"
                  />
                </div>
                
                <div className="pt-4 border-t border-white/10">
                  <label className="block text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" /> Internal Notes
                  </label>
                  <textarea
                    value={selectedLead.internalNotes || ''}
                    onChange={(e) => handleUpdateLeadField('internalNotes', e.target.value)}
                    placeholder="Add notes about this client's requirements..."
                    rows={6}
                    className="w-full text-sm bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-xl py-3 px-3 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none"
                  />
                  <p className="text-[10px] text-gray-500 mt-2">Notes are automatically saved and only visible to your team.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
