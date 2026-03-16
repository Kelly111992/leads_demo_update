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
    { name: 'Inbox', href: '/', icon: InboxIcon },
    { name: 'Kanban', href: '/leads', icon: Kanban },
    { name: 'Metrics', href: '/metrics', icon: LayoutDashboard },
    ...(userProfile?.role === 'admin' ? [{ name: 'Users', href: '/users', icon: Users }] : []),
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-transparent text-white overflow-hidden relative">
      {/* Sidebar */}
      <div className="w-64 glass-panel flex flex-col z-10 border-r-0 border-y-0 border-l-0 border-r border-white/10">
        <div className="h-20 flex items-center px-6 border-b border-white/10">
          <h1 className="text-2xl font-bold text-gradient tracking-tight">EvoLeads</h1>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  isActive
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent',
                  'group flex items-center px-3 py-3 text-sm font-medium rounded-xl transition-all duration-300 ease-out'
                )}
              >
                <item.icon
                  className={cn(
                    isActive ? 'text-indigo-400' : 'text-gray-500 group-hover:text-gray-300',
                    'mr-3 flex-shrink-0 h-5 w-5 transition-colors duration-300'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 bg-black/20">
          <div className="flex items-center mb-4 p-2 rounded-xl bg-white/5 border border-white/5">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
              {userProfile?.name?.charAt(0) || 'U'}
            </div>
            <div className="ml-3">
              <p className="text-sm font-semibold text-gray-200 truncate w-36">{userProfile?.name}</p>
              <p className="text-xs text-indigo-300/80 capitalize tracking-wider">{userProfile?.role}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center px-3 py-2.5 text-sm font-medium text-red-400 rounded-xl hover:bg-red-500/10 hover:text-red-300 transition-colors duration-300 border border-transparent hover:border-red-500/20"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sign out
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
              className="h-full rounded-2xl overflow-hidden glass-panel shadow-2xl"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
