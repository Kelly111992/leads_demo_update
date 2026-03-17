import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import { Loader2, Save, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function Settings() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [config, setConfig] = useState({
    apiUrl: '',
    apiKey: '',
    instance: '',
    defaultAiEnabled: true
  });

  useEffect(() => {
    async function fetchConfig() {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'evolution_api')
          .single();
        
        if (data && data.value) {
          setConfig(data.value);
        }
      } catch (error) {
        console.error("Error fetching config:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const handleSave = async () => {
    if (userProfile?.role !== 'admin') return;
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
      console.error("Error saving config:", error);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncWebhook = async () => {
    if (userProfile?.role !== 'admin') return;
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
            disabled={!isAdmin}
          />
          <input 
            value={config.instance} 
            onChange={e => setConfig({...config, instance: e.target.value})} 
            placeholder="Instance" 
            className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white" 
            disabled={!isAdmin}
          />
          <input 
            type="password"
            value={config.apiKey} 
            onChange={e => setConfig({...config, apiKey: e.target.value})} 
            placeholder="API Key" 
            className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white" 
            disabled={!isAdmin}
          />
          <button onClick={handleSave} className="px-6 py-2.5 bg-[#D9A21B] text-black font-bold rounded-xl disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={handleSyncWebhook} className="px-6 py-2.5 bg-white/5 text-white rounded-xl ml-4">
            Re-vincular WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
