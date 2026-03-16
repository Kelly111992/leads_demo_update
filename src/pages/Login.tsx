import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';

export default function Login() {
  const { currentUser, signInWithGoogle } = useAuth();

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px] pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="h-20 w-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/30 border border-white/10">
            <MessageSquare className="h-10 w-10 text-white" />
          </div>
        </div>
        <h2 className="mt-8 text-center text-4xl font-extrabold text-white tracking-tight">
          EvoLeads CRM
        </h2>
        <p className="mt-3 text-center text-base text-gray-400">
          Manage your WhatsApp leads from Facebook & Instagram
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="glass-panel py-10 px-6 shadow-2xl sm:rounded-2xl sm:px-12 border border-white/10">
          <button
            onClick={signInWithGoogle}
            className="w-full flex justify-center py-3.5 px-4 border border-indigo-500/30 rounded-xl shadow-lg shadow-indigo-500/20 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0a0f] focus:ring-indigo-500 transition-all duration-300 hover:-translate-y-0.5"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}
