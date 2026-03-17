import React from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Users, MessageSquare, LogOut, Settings, Inbox as InboxIcon, Kanban } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  const { currentUser, userProfile, signOut } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const navigation = [
    { name: 'Bandeja de Entrada', href: '/', icon: InboxIcon },
    { name: 'Kanban', href: '/leads', icon: Kanban },
    { name: 'Métricas', href: '/metrics', icon: LayoutDashboard },
    ...(userProfile?.role === 'admin' ? [{ name: 'Usuarios', href: '/users', icon: Users }] : []),
    { name: 'Configuración', href: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-transparent text-white overflow-hidden relative">
      {/* Sidebar */}
      <div className="w-64 glass-panel flex flex-col z-10 border-r-0 border-y-0 border-l-0 border-r border-white/10">
        <div className="h-24 flex items-center px-6 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-[#D9A21B] p-1 shadow-lg shadow-[#D9A21B]/20 flex items-center justify-center overflow-hidden">
              <img 
                src="https://raw.githubusercontent.com/Arkelly147/assets/main/altepsa-logo.png" 
                alt="ALTEPSA" 
                className="h-full w-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/altepsa/100/100';
                }}
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#D9A21B] tracking-[0.05em] leading-none">ALTEPSA</h1>
              <p className="text-[9px] text-gray-400 mt-1.5 uppercase tracking-[0.25em] font-semibold opacity-80">CRM Premium</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 px-6 py-12 space-y-5 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  isActive
                    ? 'bg-[#D9A21B]/20 text-[#D9A21B] border border-[#D9A21B]/40 shadow-[0_0_30px_rgba(217,162,27,0.2)]'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent',
                  'group flex items-center px-6 py-4 text-sm font-black rounded-[1.25rem] transition-all duration-500 ease-out tracking-[0.15em] uppercase text-[10px]'
                )}
              >
                <item.icon
                  className={cn(
                    isActive ? 'text-[#D9A21B] scale-125' : 'text-gray-500 group-hover:text-gray-300 group-hover:scale-110',
                    'mr-6 flex-shrink-0 h-5 w-5 transition-all duration-500'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-white/10 bg-black/40">
          <div className="flex items-center mb-6 p-3 rounded-2xl bg-white/5 border border-white/10 shadow-inner">
            <div className="h-11 w-11 rounded-full bg-gradient-to-br from-[#D9A21B] to-[#7A2022] flex items-center justify-center text-white font-bold shadow-lg shadow-[#D9A21B]/20 border border-white/10">
              {userProfile?.name?.charAt(0) || 'U'}
            </div>
            <div className="ml-3.5 overflow-hidden">
              <p className="text-sm font-bold text-gray-100 truncate tracking-tight">{userProfile?.name}</p>
              <p className="text-[10px] text-[#D9A21B] font-bold uppercase tracking-[0.15em] mt-0.5">
                {userProfile?.role === 'admin' ? 'administrador' : 'agente'}
              </p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center px-4 py-3 text-sm font-semibold text-red-400 rounded-xl hover:bg-red-500/10 hover:text-red-300 transition-all duration-300 border border-transparent hover:border-red-500/20 tracking-wide"
          >
            <LogOut className="mr-4 h-5 w-5" />
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-0">
        <main className="flex-1 overflow-y-auto bg-transparent p-4 md:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-2xl overflow-hidden glass-panel shadow-2xl pointer-events-auto"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
