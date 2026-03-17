import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
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
  const [vendorForm, setVendorForm] = useState({ name: '', email: '', phone: '', category: '', photoURL: '' });
  const [userForm, setUserForm] = useState({ name: '', email: '', photoURL: '', role: 'agent', status: 'active' });

  useEffect(() => {
    if (userProfile?.role !== 'admin') return;

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const newUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(newUsers);
    });

    const unsubscribeVendors = onSnapshot(collection(db, 'vendors'), (snapshot) => {
      const newVendors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVendors(newVendors);
      setLoading(false);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeVendors();
    };
  }, [userProfile]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
    } catch (error) {
      console.error("Error updating role:", error);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { status: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userData = {
        name: userForm.name,
        email: userForm.email,
        photoURL: userForm.photoURL || null,
        role: userForm.role,
        status: userForm.status,
        updatedAt: new Date().toISOString()
      };

      if (editingUser) {
        await updateDoc(doc(db, 'users', editingUser.id), userData);
      } else {
        const newId = 'user_' + Math.random().toString(36).substr(2, 9);
        await setDoc(doc(db, 'users', newId), {
          ...userData,
          uid: newId,
          createdAt: new Date().toISOString()
        });
      }
      setIsUserModalOpen(false);
      setEditingUser(null);
      setUserForm({ name: '', email: '', photoURL: '', role: 'agent', status: 'active' });
    } catch (error) {
      console.error("Error saving user:", error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === userProfile?.uid) {
      alert('No puedes eliminar tu propio usuario.');
      return;
    }
    if (!window.confirm('¿Estás seguro de que deseas eliminar este usuario?')) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const vendorData = {
        name: vendorForm.name,
        email: vendorForm.email || null,
        phone: vendorForm.phone || null,
        category: vendorForm.category || null,
        photoURL: vendorForm.photoURL || null,
        updatedAt: new Date().toISOString()
      };

      if (editingVendor) {
        await updateDoc(doc(db, 'vendors', editingVendor.id), vendorData);
      } else {
        await addDoc(collection(db, 'vendors'), {
          ...vendorData,
          createdAt: new Date().toISOString()
        });
      }
      setIsVendorModalOpen(false);
      setEditingVendor(null);
      setVendorForm({ name: '', email: '', phone: '', category: '', photoURL: '' });
    } catch (error) {
      console.error("Error saving vendor:", error);
    }
  };

  const handleDeleteVendor = async (vendorId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este proveedor?')) return;
    try {
      await deleteDoc(doc(db, 'vendors', vendorId));
    } catch (error) {
      console.error("Error deleting vendor:", error);
    }
  };

  const handleGenerateMockAgents = async () => {
    const mockAgents = [
      { name: 'Laura Martínez', email: 'laura.m@example.com', role: 'agent', status: 'active', photoURL: 'https://i.pravatar.cc/150?u=laura' },
      { name: 'Carlos Ruiz', email: 'carlos.r@example.com', role: 'agent', status: 'active', photoURL: 'https://i.pravatar.cc/150?u=carlos' },
      { name: 'Ana Gómez', email: 'ana.g@example.com', role: 'agent', status: 'active', photoURL: 'https://i.pravatar.cc/150?u=ana' },
      { name: 'David Silva', email: 'david.s@example.com', role: 'agent', status: 'active', photoURL: 'https://i.pravatar.cc/150?u=david' },
      { name: 'Elena Torres', email: 'elena.t@example.com', role: 'agent', status: 'active', photoURL: 'https://i.pravatar.cc/150?u=elena' }
    ];

    try {
      for (const agent of mockAgents) {
        const newId = 'mock_agent_' + Math.random().toString(36).substr(2, 9);
        await setDoc(doc(db, 'users', newId), {
          ...agent,
          uid: newId,
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Error adding mock agents:", error);
    }
  };

  if (userProfile?.role !== 'admin') {
    return <div className="p-8 text-center text-red-400 glass-panel m-8 rounded-2xl">Acceso Denegado. Solo administradores.</div>;
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Cargando...</div>;

  return (
    <div className="space-y-8 p-8 h-full overflow-y-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Gestión</h2>
          <p className="mt-2 text-sm text-gray-400">Gestiona usuarios y proveedores para tu organización.</p>
        </div>
        <div className="flex gap-3">
          {activeTab === 'users' ? (
            <div className="flex gap-2">
              <button
                onClick={handleGenerateMockAgents}
                className="inline-flex items-center px-4 py-2 border border-white/10 text-sm font-medium rounded-xl text-gray-300 bg-white/5 hover:bg-white/10 transition-all duration-300"
              >
                Generar Agentes
              </button>
              <button
                onClick={() => {
                  setEditingUser(null);
                  setUserForm({ name: '', email: '', photoURL: '', role: 'agent', status: 'active' });
                  setIsUserModalOpen(true);
                }}
                className="inline-flex items-center px-4 py-2 border border-[#D9A21B]/30 shadow-lg shadow-[#D9A21B]/20 text-sm font-medium rounded-xl text-black bg-[#D9A21B] hover:bg-[#C59B27] transition-all duration-300 hover:-translate-y-0.5"
              >
                <Plus className="h-4 w-4 mr-2" />
                Añadir Usuario
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditingVendor(null);
                setVendorForm({ name: '', email: '', phone: '', category: '', photoURL: '' });
                setIsVendorModalOpen(true);
              }}
              className="inline-flex items-center px-4 py-2 border border-[#D9A21B]/30 shadow-lg shadow-[#D9A21B]/20 text-sm font-medium rounded-xl text-black bg-[#D9A21B] hover:bg-[#C59B27] transition-all duration-300 hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4 mr-2" />
              Añadir Proveedor
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-6 py-4 text-sm font-medium transition-colors relative ${activeTab === 'users' ? 'text-[#D9A21B]' : 'text-gray-400 hover:text-gray-200'}`}
        >
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Usuarios
          </div>
          {activeTab === 'users' && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D9A21B]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('vendors')}
          className={`px-6 py-4 text-sm font-medium transition-colors relative ${activeTab === 'vendors' ? 'text-[#D9A21B]' : 'text-gray-400 hover:text-gray-200'}`}
        >
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            Proveedores
          </div>
          {activeTab === 'vendors' && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D9A21B]" />
          )}
        </button>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        {activeTab === 'users' ? (
          <ul className="divide-y divide-white/10">
            {users.map((user) => (
              <li key={user.id} className="hover:bg-white/5 transition-colors duration-200">
                <div className="px-6 py-5 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#D9A21B] to-[#7A2022] flex items-center justify-center text-white font-bold shadow-lg shadow-[#D9A21B]/20">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt={user.name} className="h-full w-full object-cover rounded-xl" referrerPolicy="no-referrer" />
                        ) : (
                          user.name?.charAt(0) || 'U'
                        )}
                      </div>
                    </div>
                    <div className="ml-5">
                      <div className="text-base font-medium text-white">{user.name}</div>
                      <div className="text-sm text-gray-400 mt-0.5">{user.email}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6">
                    <div className="flex flex-col items-end space-y-3">
                      <div className="flex items-center space-x-3">
                        <Shield className="h-4 w-4 text-[#D9A21B]" />
                        <select
                          className="text-sm bg-black/40 border border-white/10 text-gray-300 rounded-lg py-1.5 pl-3 pr-8 outline-none focus:ring-1 focus:ring-[#D9A21B] appearance-none hover:bg-black/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          disabled={user.email === 'arkelly147@gmail.com' || user.uid === userProfile?.uid}
                        >
                          <option value="agent" className="bg-[#1a1a24]">Agente</option>
                          <option value="admin" className="bg-[#1a1a24]">Administrador</option>
                        </select>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        {user.status === 'active' ? (
                          <UserCheck className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <UserX className="h-4 w-4 text-rose-400" />
                        )}
                        <select
                          className="text-sm bg-black/40 border border-white/10 text-gray-300 rounded-lg py-1.5 pl-3 pr-8 outline-none focus:ring-1 focus:ring-[#D9A21B] appearance-none hover:bg-black/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          value={user.status}
                          onChange={(e) => handleStatusChange(user.id, e.target.value)}
                          disabled={user.email === 'arkelly147@gmail.com' || user.uid === userProfile?.uid}
                        >
                          <option value="active" className="bg-[#1a1a24]">Activo</option>
                          <option value="inactive" className="bg-[#1a1a24]">Inactivo</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingUser(user);
                          setUserForm({ 
                            name: user.name, 
                            email: user.email || '', 
                            photoURL: user.photoURL || '',
                            role: user.role,
                            status: user.status
                          });
                          setIsUserModalOpen(true);
                        }}
                        className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-[#D9A21B] transition-all"
                        title="Editar Usuario"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-rose-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Eliminar Usuario"
                        disabled={user.email === 'arkelly147@gmail.com' || user.uid === userProfile?.uid}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-white/10">
            {vendors.length === 0 ? (
              <li className="p-12 text-center text-gray-500">No se encontraron proveedores. Añade tu primer proveedor para comenzar.</li>
            ) : (
              vendors.map((vendor) => (
                <li key={vendor.id} className="hover:bg-white/5 transition-colors duration-200">
                  <div className="px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#D9A21B] to-[#7A2022] flex items-center justify-center text-white font-bold shadow-lg shadow-[#D9A21B]/20">
                          {vendor.photoURL ? (
                            <img src={vendor.photoURL} alt={vendor.name} className="h-full w-full object-cover rounded-xl" referrerPolicy="no-referrer" />
                          ) : (
                            <Store className="h-6 w-6" />
                          )}
                        </div>
                      </div>
                      <div className="ml-5">
                        <div className="text-base font-medium text-white">{vendor.name}</div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                          {vendor.category && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D9A21B]/10 text-[#D9A21B] border border-[#D9A21B]/20">
                              {vendor.category}
                            </span>
                          )}
                          {vendor.email && <span className="text-[10px] text-gray-400">{vendor.email}</span>}
                          {vendor.phone && <span className="text-[10px] text-gray-400">{vendor.phone}</span>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-xs text-gray-500 hidden sm:block text-right">
                        Añadido el<br/>
                        {format(new Date(vendor.createdAt), 'd MMM, yyyy', { locale: es })}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingVendor(vendor);
                            setVendorForm({ 
                              name: vendor.name, 
                              email: vendor.email || '', 
                              phone: vendor.phone || '', 
                              category: vendor.category || '', 
                              photoURL: vendor.photoURL || '' 
                            });
                            setIsVendorModalOpen(true);
                          }}
                          className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-[#D9A21B] transition-all"
                          title="Editar Proveedor"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteVendor(vendor.id)}
                          className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-rose-400 transition-all"
                          title="Eliminar Proveedor"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {/* User Modal */}
      <AnimatePresence>
        {isUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            >
              <div className="p-6 border-b border-white/10">
                <h3 className="text-xl font-bold text-white">{editingUser ? 'Editar Usuario' : 'Añadir Nuevo Usuario'}</h3>
              </div>
              <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Nombre Completo</label>
                    <input
                      type="text"
                      required
                      value={userForm.name}
                      onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-[#D9A21B]/50 outline-none transition-all"
                      placeholder="Nombre del usuario"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Correo Electrónico</label>
                    <input
                      type="email"
                      required
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-[#D9A21B]/50 outline-none transition-all"
                      placeholder="usuario@ejemplo.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Rol</label>
                    <select
                      value={userForm.role}
                      onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-[#D9A21B]/50 outline-none transition-all"
                    >
                      <option value="agent" className="bg-[#1a1a24]">Agente</option>
                      <option value="admin" className="bg-[#1a1a24]">Administrador</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Estado</label>
                    <select
                      value={userForm.status}
                      onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-[#D9A21B]/50 outline-none transition-all"
                    >
                      <option value="active" className="bg-[#1a1a24]">Activo</option>
                      <option value="inactive" className="bg-[#1a1a24]">Inactivo</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-400 mb-2">URL de la Foto</label>
                    <div className="flex gap-4 items-start">
                      <div className="h-16 w-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {userForm.photoURL ? (
                          <img src={userForm.photoURL} alt="Preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Camera className="h-6 w-6 text-gray-600" />
                        )}
                      </div>
                      <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Camera className="h-4 w-4 text-gray-500" />
                        </div>
                        <input
                          type="url"
                          value={userForm.photoURL}
                          onChange={(e) => setUserForm({ ...userForm, photoURL: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-[#D9A21B]/50 outline-none transition-all text-sm"
                          placeholder="https://ejemplo.com/foto.jpg"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => setIsUserModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-[#D9A21B] text-black font-bold rounded-xl hover:bg-[#C59B27] transition-all shadow-lg shadow-[#D9A21B]/20"
                  >
                    {editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Vendor Modal */}
      <AnimatePresence>
        {isVendorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            >
              <div className="p-6 border-b border-white/10">
                <h3 className="text-xl font-bold text-white">{editingVendor ? 'Editar Proveedor' : 'Añadir Nuevo Proveedor'}</h3>
              </div>
              <form onSubmit={handleSaveVendor} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Nombre del Proveedor</label>
                    <input
                      type="text"
                      required
                      value={vendorForm.name}
                      onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-[#D9A21B]/50 outline-none transition-all"
                      placeholder="Introduce el nombre del proveedor"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Correo Electrónico</label>
                    <input
                      type="email"
                      value={vendorForm.email}
                      onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-[#D9A21B]/50 outline-none transition-all"
                      placeholder="proveedor@ejemplo.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Teléfono</label>
                    <input
                      type="tel"
                      value={vendorForm.phone}
                      onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-[#D9A21B]/50 outline-none transition-all"
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Categoría</label>
                    <input
                      type="text"
                      value={vendorForm.category}
                      onChange={(e) => setVendorForm({ ...vendorForm, category: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-[#D9A21B]/50 outline-none transition-all"
                      placeholder="ej. Logística, Materias Primas"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">URL de la Foto</label>
                    <div className="flex gap-4 items-start">
                      <div className="h-16 w-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {vendorForm.photoURL ? (
                          <img src={vendorForm.photoURL} alt="Preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Camera className="h-6 w-6 text-gray-600" />
                        )}
                      </div>
                      <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Camera className="h-4 w-4 text-gray-500" />
                        </div>
                        <input
                          type="url"
                          value={vendorForm.photoURL}
                          onChange={(e) => setVendorForm({ ...vendorForm, photoURL: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-[#D9A21B]/50 outline-none transition-all text-sm"
                          placeholder="https://ejemplo.com/foto.jpg"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => setIsVendorModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-[#D9A21B] text-black font-bold rounded-xl hover:bg-[#C59B27] transition-all shadow-lg shadow-[#D9A21B]/20"
                  >
                    {editingVendor ? 'Actualizar Proveedor' : 'Crear Proveedor'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
