import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
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
        const docRef = doc(db, 'settings', 'evolution_api');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConfig(docSnap.data() as any);
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
      await setDoc(doc(db, 'settings', 'evolution_api'), config);
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
    <div className="space-y-8 p-8 h-full overflow-y-auto">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Configuración</h2>
        <p className="mt-2 text-sm text-gray-400">Gestiona tu cuenta y preferencias.</p>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="px-6 py-6 border-b border-white/10 bg-black/20">
          <h3 className="text-lg leading-6 font-medium text-white">Información del Perfil</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">Detalles personales y ajustes de la aplicación.</p>
        </div>
        <div className="px-6 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-white/10">
            <div className="py-4 sm:py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 hover:bg-white/5 transition-colors">
              <dt className="text-sm font-medium text-gray-400">Nombre completo</dt>
              <dd className="mt-1 text-sm text-white sm:mt-0 sm:col-span-2 font-medium">{userProfile?.name}</dd>
            </div>
            <div className="py-4 sm:py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 hover:bg-white/5 transition-colors">
              <dt className="text-sm font-medium text-gray-400">Correo electrónico</dt>
              <dd className="mt-1 text-sm text-white sm:mt-0 sm:col-span-2 font-medium">{userProfile?.email}</dd>
            </div>
            <div className="py-4 sm:py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 hover:bg-white/5 transition-colors">
              <dt className="text-sm font-medium text-gray-400">Rol</dt>
              <dd className="mt-1 text-sm text-white sm:mt-0 sm:col-span-2 capitalize font-medium">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#D9A21B]/20 text-[#D9A21B] border border-[#D9A21B]/30">
                  {userProfile?.role === 'admin' ? 'administrador' : 'agente'}
                </span>
              </dd>
            </div>
            <div className="py-4 sm:py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 hover:bg-white/5 transition-colors">
              <dt className="text-sm font-medium text-gray-400">Estado</dt>
              <dd className="mt-1 text-sm text-white sm:mt-0 sm:col-span-2 capitalize font-medium">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${
                  userProfile?.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}>
                  {userProfile?.status === 'active' ? 'activo' : 'inactivo'}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
      
      <div className="glass-panel rounded-2xl overflow-hidden p-8 relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-[#D9A21B]/5 to-[#7A2022]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
        <h3 className="text-xl leading-6 font-semibold text-white mb-4">Integración de Evolution API</h3>
        <p className="text-sm text-gray-400 mb-6">
          Configura tu conexión de WhatsApp a través de Evolution API.
          {!isAdmin && <span className="text-amber-400 ml-2">(Se requiere acceso de administrador)</span>}
        </p>
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="apiUrl" className="block text-sm font-medium text-gray-300 mb-1.5">URL de la API</label>
              <input 
                type="text" 
                id="apiUrl" 
                value={config.apiUrl}
                onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
                disabled={!isAdmin}
                className={`block w-full border border-white/10 rounded-xl shadow-sm py-2.5 px-4 sm:text-sm bg-white/5 text-white focus:ring-2 focus:ring-[#D9A21B] focus:border-transparent transition-all ${!isAdmin ? 'cursor-not-allowed opacity-50' : ''}`} 
                placeholder="https://api.evolution.com" 
              />
            </div>
            <div>
              <label htmlFor="instance" className="block text-sm font-medium text-gray-300 mb-1.5">Nombre de la Instancia</label>
              <input 
                type="text" 
                id="instance" 
                value={config.instance}
                onChange={(e) => setConfig({ ...config, instance: e.target.value })}
                disabled={!isAdmin}
                className={`block w-full border border-white/10 rounded-xl shadow-sm py-2.5 px-4 sm:text-sm bg-white/5 text-white focus:ring-2 focus:ring-[#D9A21B] focus:border-transparent transition-all ${!isAdmin ? 'cursor-not-allowed opacity-50' : ''}`} 
                placeholder="mi-instancia-whatsapp" 
              />
            </div>
          </div>
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-1.5">Clave de la API</label>
            <input 
              type="password" 
              id="apiKey" 
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              disabled={!isAdmin}
              className={`block w-full border border-white/10 rounded-xl shadow-sm py-2.5 px-4 sm:text-sm bg-white/5 text-white focus:ring-2 focus:ring-[#D9A21B] focus:border-transparent transition-all ${!isAdmin ? 'cursor-not-allowed opacity-50' : ''}`} 
              placeholder="••••••••••••••••" 
            />
          </div>

          <div className="flex items-center gap-3 py-2">
            <button
              onClick={() => isAdmin && setConfig({ ...config, defaultAiEnabled: !config.defaultAiEnabled })}
              disabled={!isAdmin}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                config.defaultAiEnabled ? 'bg-[#D9A21B]' : 'bg-white/10'
              } ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  config.defaultAiEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-sm text-gray-300">Habilitar sugerencias de IA por defecto para nuevos prospectos</span>
          </div>
          
          <div className="flex items-center gap-4 mt-2">
            <button 
              onClick={handleSave}
              disabled={!isAdmin || saving}
              className={`inline-flex items-center px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                !isAdmin || saving 
                  ? 'bg-[#D9A21B]/30 text-black/40 cursor-not-allowed border border-white/5' 
                  : 'bg-[#D9A21B] text-black hover:bg-[#C59B27] shadow-lg shadow-[#D9A21B]/20 border border-[#D9A21B]/30 hover:-translate-y-0.5'
              }`}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Configuración
                </>
              )}
            </button>

            <button 
              onClick={handleSyncWebhook}
              disabled={!isAdmin || syncing}
              className={`inline-flex items-center px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                !isAdmin || syncing 
                  ? 'bg-white/5 text-white/40 cursor-not-allowed border border-white/5' 
                  : 'bg-white/10 text-white hover:bg-white/20 border border-white/10 hover:-translate-y-0.5'
              }`}
            >
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-vincular WhatsApp
                </>
              )}
            </button>

            {saveStatus === 'success' && (
              <div className="flex items-center text-emerald-400 text-sm animate-in fade-in slide-in-from-left-2">
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Configuración guardada con éxito
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center text-rose-400 text-sm animate-in fade-in slide-in-from-left-2">
                <AlertCircle className="h-4 w-4 mr-1.5" />
                Error al guardar la configuración
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
