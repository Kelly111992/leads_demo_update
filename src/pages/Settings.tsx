import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import { Loader2, Save, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

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
      } catch (error) {
        console.error("Error fetching config:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  // Guardar SOLO la configuración de Evolution API
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

  // Guardar SOLO la configuración de OpenAI
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
