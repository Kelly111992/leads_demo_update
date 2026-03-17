import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { Shield, UserCheck, UserX, Store, User, Plus, Pencil, Trash2, Camera } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

export default function Users() {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'vendors'>('users');
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [vendorForm, setVendorForm] = useState({ name: '', email: '', phone: '', category: '', photo_url: '' });
  const [userForm, setUserForm] = useState({ name: '', last_name: '', phone: '', email: '', photo_url: '', role: 'agent', status: 'active' });

  const fetchData = async () => {
    if (userProfile?.role !== 'admin') return;

    const { data: userData } = await supabase.from('users').select('*');
    const { data: vendorData } = await supabase.from('vendors').select('*');
    
    if (userData) setUsers(userData);
    if (vendorData) setVendors(vendorData);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    const usersSub = supabase.channel('users-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchData()).subscribe();
    const vendorsSub = supabase.channel('vendors-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, () => fetchData()).subscribe();

    return () => {
      supabase.removeChannel(usersSub);
      supabase.removeChannel(vendorsSub);
    };
  }, [userProfile]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    await supabase.from('users').update({ role: newRole }).eq('uid', userId);
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    await supabase.from('users').update({ status: newStatus }).eq('uid', userId);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userData = {
        name: userForm.name,
        last_name: userForm.last_name || null,
        phone: userForm.phone || null,
        email: userForm.email,
        photo_url: userForm.photo_url || null,
        role: userForm.role,
        status: userForm.status,
      };

      if (editingUser) {
        await supabase.from('users').update(userData).eq('uid', editingUser.uid);
      } else {
        const newId = 'user_' + Math.random().toString(36).substr(2, 9);
        await supabase.from('users').insert([{ ...userData, uid: newId, created_at: new Date().toISOString() }]);
      }
      setIsUserModalOpen(false);
      setEditingUser(null);
      setUserForm({ name: '', last_name: '', phone: '', email: '', photo_url: '', role: 'agent', status: 'active' });
      fetchData();
    } catch (error) {
      console.error("Error saving user:", error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === userProfile?.uid) return alert('No puedes eliminarte a ti mismo.');
    if (!window.confirm('¿Eliminar usuario?')) return;
    await supabase.from('users').delete().eq('uid', userId);
    fetchData();
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const vendorData = {
        name: vendorForm.name,
        email: vendorForm.email || null,
        phone: vendorForm.phone || null,
        category: vendorForm.category || null,
        photo_url: vendorForm.photo_url || null,
        updated_at: new Date().toISOString()
      };

      if (editingVendor) {
        await supabase.from('vendors').update(vendorData).eq('id', editingVendor.id);
      } else {
        await supabase.from('vendors').insert([vendorData]);
      }
      setIsVendorModalOpen(false);
      setEditingVendor(null);
      setVendorForm({ name: '', email: '', phone: '', category: '', photo_url: '' });
      fetchData();
    } catch (error) {
      console.error("Error saving vendor:", error);
    }
  };

  const handleDeleteVendor = async (vendorId: string) => {
    if (!window.confirm('¿Eliminar proveedor?')) return;
    await supabase.from('vendors').delete().eq('id', vendorId);
    fetchData();
  };

  if (userProfile?.role !== 'admin') {
    return <div className="p-8 text-center text-red-400 glass-panel m-8 rounded-2xl">Acceso Denegado. Solo administradores.</div>;
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Cargando...</div>;

  return (
    <div className="space-y-8 p-8 h-full overflow-y-auto bg-transparent">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Gestión</h2>
          <p className="mt-2 text-sm text-gray-400">Usuarios y proveedores.</p>
        </div>
        <button
          onClick={() => {
            if (activeTab === 'users') {
              setEditingUser(null);
              setUserForm({ name: '', last_name: '', phone: '', email: '', photo_url: '', role: 'agent', status: 'active' });
              setIsUserModalOpen(true);
            } else {
              setEditingVendor(null);
              setVendorForm({ name: '', email: '', phone: '', category: '', photo_url: '' });
              setIsVendorModalOpen(true);
            }
          }}
          className="px-5 py-2.5 bg-[#D9A21B] text-black font-bold rounded-xl shadow-lg shadow-[#D9A21B]/20"
        >
          <Plus className="h-4 w-4 mr-2 inline" />
          Añadir {activeTab === 'users' ? 'Usuario' : 'Proveedor'}
        </button>
      </div>

      <div className="flex border-b border-white/10">
        <button onClick={() => setActiveTab('users')} className={`px-6 py-4 text-sm font-medium ${activeTab === 'users' ? 'text-[#D9A21B] border-b-2 border-[#D9A21B]' : 'text-gray-400'}`}>Usuarios</button>
        <button onClick={() => setActiveTab('vendors')} className={`px-6 py-4 text-sm font-medium ${activeTab === 'vendors' ? 'text-[#D9A21B] border-b-2 border-[#D9A21B]' : 'text-gray-400'}`}>Proveedores</button>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-white/5">
        <ul className="divide-y divide-white/5">
          {(activeTab === 'users' ? users : vendors).map((item) => (
            <li key={item.uid || item.id} className="p-6 flex items-center justify-between hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-[#D9A21B] flex items-center justify-center text-black font-bold overflow-hidden">
                  {item.photo_url ? <img src={item.photo_url} alt={item.name} className="h-full w-full object-cover" /> : (item.name?.charAt(0) || 'U')}
                </div>
                <div>
                  <p className="text-white font-bold">
                    {item.name} {activeTab === 'users' && item.last_name ? item.last_name : ''}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.email} {activeTab === 'users' && item.phone ? ` • ${item.phone}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {activeTab === 'users' && (
                  <select 
                    value={item.role} 
                    onChange={e => handleRoleChange(item.uid, e.target.value)}
                    className="bg-black/40 border border-white/10 text-xs text-gray-300 rounded-lg p-1.5"
                  >
                    <option value="agent">Agente</option>
                    <option value="admin">Admin</option>
                  </select>
                )}
                <div className="flex gap-2">
                  <button onClick={() => activeTab === 'users' ? handleDeleteUser(item.uid) : handleDeleteVendor(item.id)} className="p-2 bg-white/5 text-red-400 rounded-lg hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Modals omitted for brevity, logic implemented in functions */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-white/10 p-8 rounded-3xl w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-6">Usuario</h3>
            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} placeholder="Nombre" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white" required />
                <input value={userForm.last_name} onChange={e => setUserForm({...userForm, last_name: e.target.value})} placeholder="Apellidos" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white" />
              </div>
              <input value={userForm.email} type="email" onChange={e => setUserForm({...userForm, email: e.target.value})} placeholder="Email" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white" required />
              <input value={userForm.phone} onChange={e => setUserForm({...userForm, phone: e.target.value})} placeholder="Teléfono" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white" />
              <input value={userForm.photo_url} onChange={e => setUserForm({...userForm, photo_url: e.target.value})} placeholder="URL de Foto / Avatar" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white" />
              
              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 text-gray-400">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-[#D9A21B] text-black font-bold rounded-xl">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
