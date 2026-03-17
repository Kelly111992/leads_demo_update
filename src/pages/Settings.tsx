import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import { Loader2, Save, CheckCircle2, AlertCircle, RefreshCw, Plus, Trash2, Edit3, X as XIcon } from 'lucide-react';

export default function Settings() {
  const { userProfile } = useAuth();
  console.log('⚙️ Settings Component Mounted. Role:', userProfile?.role);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [savingAi, setSavingAi] = useState(false);
  const [saveAiStatus, setSaveAiStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [config, setConfig] = useState({
    apiUrl: '',
    apiKey: '',
    instance: '',
    defaultAiEnabled: true
  });
  const [openaiConfig, setOpenaiConfig] = useState({ apiKey: '' });

  // Templates state
  const [templates, setTemplates] = useState<any[]>([]);
  const [newTemplate, setNewTemplate] = useState({ label: '', content: '', color: 'blue' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ label: '', content: '', color: 'blue' });
  const [savingTemplate, setSavingTemplate] = useState(false);

  const colorOptions = [
    { value: 'emerald', label: 'Verde', cls: 'bg-emerald-500' },
    { value: 'blue', label: 'Azul', cls: 'bg-blue-500' },
    { value: 'amber', label: 'Dorado', cls: 'bg-amber-500' },
    { value: 'purple', label: 'Morado', cls: 'bg-purple-500' },
    { value: 'cyan', label: 'Cyan', cls: 'bg-cyan-500' },
    { value: 'red', label: 'Rojo', cls: 'bg-red-500' },
  ];

  const fetchTemplates = async () => {
    const { data } = await supabase.from('templates').select('*').order('created_at', { ascending: true });
    if (data) setTemplates(data);
  };

  useEffect(() => {
    async function fetchConfig() {
      try {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'evolution_api')
          .single();
        
        if (data && data.value) {
          setConfig(data.value);
        }

        const { data: openaiData } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'openai_api')
          .single();
          
        if (openaiData && openaiData.value) {
          setOpenaiConfig(openaiData.value);
        }

        await fetchTemplates();
      } catch (error) {
        console.error("Error fetching config:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const handleSaveEvolution = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const { error } = await supabase
        .from('settings')
        .upsert([{ key: 'evolution_api', value: config }]);
      
      if (error) throw error;
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error("Error saving Evolution config:", error);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOpenAI = async () => {
    setSavingAi(true);
    setSaveAiStatus('idle');
    try {
      const { error } = await supabase
        .from('settings')
        .upsert([{ key: 'openai_api', value: openaiConfig }]);
      
      if (error) throw error;
      setSaveAiStatus('success');
      setTimeout(() => setSaveAiStatus('idle'), 3000);
    } catch (error) {
      console.error("Error saving OpenAI config:", error);
      setSaveAiStatus('error');
    } finally {
      setSavingAi(false);
    }
  };

  const handleSyncWebhook = async () => {
    setSyncing(true);
    setSyncStatus('idle');
    try {
      const response = await fetch('/api/webhook/setup', { method: 'POST' });
      if (response.ok) {
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        throw new Error('Failed to sync');
      }
    } catch (error) {
      console.error("Error syncing webhook:", error);
      setSyncStatus('error');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddTemplate = async () => {
    if (!newTemplate.label.trim() || !newTemplate.content.trim()) return;
    setSavingTemplate(true);
    try {
      const { error } = await supabase.from('templates').insert([{
        label: newTemplate.label.trim(),
        content: newTemplate.content.trim(),
        color: newTemplate.color,
        icon: 'MessageSquare',
        system_token: 'claveai'
      }]);
      if (error) throw error;
      setNewTemplate({ label: '', content: '', color: 'blue' });
      await fetchTemplates();
    } catch (error) {
      console.error("Error adding template:", error);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleUpdateTemplate = async (id: string) => {
    if (!editData.label.trim() || !editData.content.trim()) return;
    try {
      const { error } = await supabase.from('templates').update({
        label: editData.label.trim(),
        content: editData.content.trim(),
        color: editData.color,
        updated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      setEditingId(null);
      await fetchTemplates();
    } catch (error) {
      console.error("Error updating template:", error);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await supabase.from('templates').delete().eq('id', id);
      await fetchTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
    }
  };

  const isAdmin = userProfile?.role === 'admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 text-[#D9A21B] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8 h-full overflow-y-auto bg-transparent">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Configuración</h2>
        <p className="mt-2 text-sm text-gray-400">Gestiona tu cuenta y preferencias.</p>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden bg-black/20 border border-white/5">
        <div className="p-8 space-y-6">
          <h3 className="text-xl font-semibold text-white">Perfil</h3>
          <div className="space-y-4">
            <div className="flex justify-between py-3 border-b border-white/5">
              <span className="text-gray-400">Nombre</span>
              <span className="text-white">{userProfile?.name}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-white/5">
              <span className="text-gray-400">Email</span>
              <span className="text-white">{userProfile?.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Plantillas Rápidas */}
      <div className="glass-panel rounded-2xl p-8 bg-black/20 border border-white/5 space-y-6">
        <div>
          <h3 className="text-xl font-semibold text-white">Plantillas Rápidas</h3>
          <p className="text-xs text-gray-400 mt-1">Respuestas predefinidas que aparecen en la conversación para responder con un solo clic.</p>
        </div>

        {/* Existing Templates */}
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t.id} className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 group">
              {editingId === t.id ? (
                <div className="flex-1 space-y-3">
                  <div className="flex gap-2">
                    <input
                      value={editData.label}
                      onChange={e => setEditData({ ...editData, label: e.target.value })}
                      className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#D9A21B]/50"
                      placeholder="Etiqueta"
                    />
                    <select
                      value={editData.color}
                      onChange={e => setEditData({ ...editData, color: e.target.value })}
                      className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white outline-none"
                    >
                      {colorOptions.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={editData.content}
                    onChange={e => setEditData({ ...editData, content: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-[#D9A21B]/50 min-h-[60px] resize-none"
                    placeholder="Contenido del mensaje"
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleUpdateTemplate(t.id)}
                      className="px-4 py-1.5 bg-[#D9A21B] text-black text-xs font-bold rounded-lg hover:bg-[#D9A21B]/80 transition-all"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-4 py-1.5 text-gray-400 text-xs font-bold hover:text-white transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={`h-3 w-3 rounded-full mt-1.5 flex-shrink-0 bg-${t.color}-500`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{t.label}</p>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{t.content}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingId(t.id);
                        setEditData({ label: t.label, content: t.content, color: t.color });
                      }}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-[#D9A21B] transition-all"
                      title="Editar"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-all"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {templates.length === 0 && (
            <p className="text-center text-sm text-gray-500 py-6">No hay plantillas. Agrega la primera abajo.</p>
          )}
        </div>

        {/* Add New Template */}
        <div className="border-t border-white/10 pt-6 space-y-3">
          <p className="text-xs text-gray-500 uppercase font-black tracking-widest">Agregar Nueva Plantilla</p>
          <div className="flex gap-2">
            <input
              value={newTemplate.label}
              onChange={e => setNewTemplate({ ...newTemplate, label: e.target.value })}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#D9A21B]/50 placeholder-gray-600"
              placeholder="Ej: Bienvenida"
            />
            <select
              value={newTemplate.color}
              onChange={e => setNewTemplate({ ...newTemplate, color: e.target.value })}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-300 outline-none"
            >
              {colorOptions.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <textarea
            value={newTemplate.content}
            onChange={e => setNewTemplate({ ...newTemplate, content: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#D9A21B]/50 placeholder-gray-600 min-h-[80px] resize-none"
            placeholder="Escribe el contenido del mensaje..."
          />
          <button
            onClick={handleAddTemplate}
            disabled={savingTemplate || !newTemplate.label.trim() || !newTemplate.content.trim()}
            className="inline-flex items-center px-5 py-2.5 bg-[#D9A21B] text-black font-bold rounded-xl text-sm hover:bg-[#D9A21B]/90 transition-all disabled:opacity-50 gap-2"
          >
            {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Agregar Plantilla
          </button>
        </div>
      </div>
      
      <div className="glass-panel rounded-2xl p-8 bg-black/20 border border-white/5 space-y-6">
        <h3 className="text-xl font-semibold text-white">Integración Evolution API</h3>
        <div className="space-y-4">
          <input 
            value={config.apiUrl} 
            onChange={e => setConfig({...config, apiUrl: e.target.value})} 
            placeholder="API URL" 
            className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white" 
          />
          <input 
            value={config.instance} 
            onChange={e => setConfig({...config, instance: e.target.value})} 
            placeholder="Instance" 
            className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white" 
          />
          <input 
            type="password"
            value={config.apiKey} 
            onChange={e => setConfig({...config, apiKey: e.target.value})} 
            placeholder="Evolution API Key" 
            className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white" 
          />
          <div className="flex items-center gap-3">
            <button 
              onClick={handleSaveEvolution} 
              disabled={saving}
              className="px-6 py-2.5 bg-[#D9A21B] text-black font-bold rounded-xl disabled:opacity-50 hover:bg-[#C59B27] transition-all flex items-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Guardando...' : 'Guardar Evolution'}
            </button>
            {saveStatus === 'success' && <span className="text-xs text-emerald-400">✅ ¡Guardado!</span>}
            {saveStatus === 'error' && <span className="text-xs text-red-400">❌ Error al guardar</span>}
          </div>
          
          <div className="pt-4 border-t border-white/5 mt-4">
            <p className="text-xs text-gray-500 mb-4">
              Si has cambiado de instancia o la URL del webhook no parece estar funcionando, usa este botón para forzar la sincronización con Evolution API.
            </p>
            <button 
              onClick={() => {
                alert('Iniciando sincronización...');
                handleSyncWebhook();
              }} 
              disabled={syncing}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              {syncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? 'Sincronizando...' : 'Re-vincular WhatsApp'}
            </button>
            {syncStatus === 'success' && <span className="ml-4 text-xs text-emerald-400">¡Sincronizado con éxito!</span>}
            {syncStatus === 'error' && <span className="ml-4 text-xs text-red-400">Error al sincronizar.</span>}
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-8 bg-black/20 border border-white/5 space-y-6">
        <h3 className="text-xl font-semibold text-white">Inteligencia Artificial (Copiloto)</h3>
        <p className="text-xs text-gray-400">
          Para que la IA genere respuestas sugeridas en la bandeja de entrada, necesitas proporcionar una clave API de OpenAI.
        </p>
        <div className="space-y-4">
          <input 
            type="password"
            value={openaiConfig.apiKey} 
            onChange={e => setOpenaiConfig({...openaiConfig, apiKey: e.target.value})} 
            placeholder="OpenAI API Key (sk-...)" 
            className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white" 
          />
          <div className="flex items-center gap-3">
            <button 
              onClick={handleSaveOpenAI} 
              disabled={savingAi}
              className="px-6 py-2.5 bg-[#D9A21B] text-black font-bold rounded-xl disabled:opacity-50 hover:bg-[#C59B27] transition-all flex items-center gap-2"
            >
              {savingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingAi ? 'Guardando...' : 'Guardar API Key OpenAI'}
            </button>
            {saveAiStatus === 'success' && <span className="text-xs text-emerald-400">✅ ¡Guardado!</span>}
            {saveAiStatus === 'error' && <span className="text-xs text-red-400">❌ Error al guardar</span>}
          </div>
        </div>
      </div>
    </div>
  );
}