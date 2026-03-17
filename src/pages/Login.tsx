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
    <div className="min-h-screen bg-[#0A0505] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#7A1619]/20 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#D9A21B]/10 blur-[120px] pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="h-24 w-24 bg-[#D9A21B] rounded-3xl flex items-center justify-center shadow-2xl shadow-[#D9A21B]/20 border border-white/10 overflow-hidden p-2">
            <img 
              src="https://raw.githubusercontent.com/Arkelly147/assets/main/altepsa-logo.png" 
              alt="ALTEPSA" 
              className="h-full w-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/altepsa/100/100';
              }}
            />
          </div>
        </div>
        <h2 className="mt-8 text-center text-4xl font-extrabold text-white tracking-tight">
          ALTEPSA CRM
        </h2>
        <p className="mt-3 text-center text-base text-gray-400">
          Alta Tecnología en Pastas y Ave.
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="glass-panel py-10 px-6 shadow-2xl sm:rounded-2xl sm:px-12 border border-white/10">
          <button
            onClick={signInWithGoogle}
            className="w-full flex justify-center py-3.5 px-4 border border-[#D9A21B]/30 rounded-xl shadow-lg shadow-[#D9A21B]/20 text-sm font-medium text-black bg-[#D9A21B] hover:bg-[#C59B27] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0A0505] focus:ring-[#D9A21B] transition-all duration-300 hover:-translate-y-0.5"
          >
            Iniciar sesión con Google
          </button>
        </div>
      </div>
    </div>
  );
}
