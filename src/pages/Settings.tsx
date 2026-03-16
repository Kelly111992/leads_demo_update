import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Settings() {
  const { userProfile } = useAuth();

  return (
    <div className="space-y-8 p-8 h-full overflow-y-auto">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Settings</h2>
        <p className="mt-2 text-sm text-gray-400">Manage your account and preferences.</p>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="px-6 py-6 border-b border-white/10 bg-black/20">
          <h3 className="text-lg leading-6 font-medium text-white">Profile Information</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">Personal details and application settings.</p>
        </div>
        <div className="px-6 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-white/10">
            <div className="py-4 sm:py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 hover:bg-white/5 transition-colors">
              <dt className="text-sm font-medium text-gray-400">Full name</dt>
              <dd className="mt-1 text-sm text-white sm:mt-0 sm:col-span-2 font-medium">{userProfile?.name}</dd>
            </div>
            <div className="py-4 sm:py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 hover:bg-white/5 transition-colors">
              <dt className="text-sm font-medium text-gray-400">Email address</dt>
              <dd className="mt-1 text-sm text-white sm:mt-0 sm:col-span-2 font-medium">{userProfile?.email}</dd>
            </div>
            <div className="py-4 sm:py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 hover:bg-white/5 transition-colors">
              <dt className="text-sm font-medium text-gray-400">Role</dt>
              <dd className="mt-1 text-sm text-white sm:mt-0 sm:col-span-2 capitalize font-medium">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {userProfile?.role}
                </span>
              </dd>
            </div>
            <div className="py-4 sm:py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 hover:bg-white/5 transition-colors">
              <dt className="text-sm font-medium text-gray-400">Status</dt>
              <dd className="mt-1 text-sm text-white sm:mt-0 sm:col-span-2 capitalize font-medium">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${
                  userProfile?.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}>
                  {userProfile?.status}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
      
      <div className="glass-panel rounded-2xl overflow-hidden p-8 relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
        <h3 className="text-xl leading-6 font-semibold text-white mb-4">Evolution API Integration</h3>
        <p className="text-sm text-gray-400 mb-6">
          Configure your WhatsApp connection via Evolution API. <span className="text-indigo-400 font-medium">(Coming soon)</span>
        </p>
        <div className="space-y-5">
          <div>
            <label htmlFor="apiUrl" className="block text-sm font-medium text-gray-300 mb-1.5">API URL</label>
            <input type="text" id="apiUrl" disabled className="block w-full border border-white/10 rounded-xl shadow-sm py-2.5 px-4 sm:text-sm bg-white/5 text-gray-500 cursor-not-allowed" placeholder="https://api.evolution.com" />
          </div>
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-1.5">API Key</label>
            <input type="password" id="apiKey" disabled className="block w-full border border-white/10 rounded-xl shadow-sm py-2.5 px-4 sm:text-sm bg-white/5 text-gray-500 cursor-not-allowed" placeholder="••••••••••••••••" />
          </div>
          <button disabled className="bg-indigo-600/50 text-white/50 px-6 py-2.5 rounded-xl text-sm font-medium cursor-not-allowed border border-indigo-500/20 mt-2">
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
