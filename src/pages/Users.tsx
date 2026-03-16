import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Shield, UserCheck, UserX } from 'lucide-react';
import { format } from 'date-fns';

export default function Users() {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.role !== 'admin') return;

    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const newUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(newUsers);
      setLoading(false);
    });

    return unsubscribe;
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
        // Generate a random ID to use as both document ID and uid
        const newId = 'mock_agent_' + Math.random().toString(36).substr(2, 9);
        await setDoc(doc(db, 'users', newId), {
          ...agent,
          uid: newId,
          createdAt: new Date().toISOString()
        });
      }
      alert('5 mock agents added successfully!');
    } catch (error) {
      console.error("Error adding mock agents:", error);
      alert('Failed to add mock agents. Check console for details.');
    }
  };

  if (userProfile?.role !== 'admin') {
    return <div className="p-8 text-center text-red-400 glass-panel m-8 rounded-2xl">Access Denied. Admins only.</div>;
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading users...</div>;

  return (
    <div className="space-y-8 p-8 h-full overflow-y-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">User Management</h2>
          <p className="mt-2 text-sm text-gray-400">Manage agents and administrators.</p>
        </div>
        <button
          onClick={handleGenerateMockAgents}
          className="inline-flex items-center px-4 py-2 border border-indigo-500/30 shadow-lg shadow-indigo-500/20 text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 transition-all duration-300 hover:-translate-y-0.5"
        >
          Generate 5 Mock Agents
        </button>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <ul className="divide-y divide-white/10">
          {users.map((user) => (
            <li key={user.id} className="hover:bg-white/5 transition-colors duration-200">
              <div className="px-6 py-5 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
                      {user.name?.charAt(0) || 'U'}
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
                      <Shield className="h-4 w-4 text-indigo-400" />
                      <select
                        className="text-sm bg-black/40 border border-white/10 text-gray-300 rounded-lg py-1.5 pl-3 pr-8 outline-none focus:ring-1 focus:ring-indigo-500 appearance-none hover:bg-black/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={user.email === 'arkelly147@gmail.com'}
                      >
                        <option value="agent" className="bg-[#1a1a24]">Agent</option>
                        <option value="admin" className="bg-[#1a1a24]">Admin</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {user.status === 'active' ? (
                        <UserCheck className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <UserX className="h-4 w-4 text-rose-400" />
                      )}
                      <select
                        className="text-sm bg-black/40 border border-white/10 text-gray-300 rounded-lg py-1.5 pl-3 pr-8 outline-none focus:ring-1 focus:ring-indigo-500 appearance-none hover:bg-black/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        value={user.status}
                        onChange={(e) => handleStatusChange(user.id, e.target.value)}
                        disabled={user.email === 'arkelly147@gmail.com'}
                      >
                        <option value="active" className="bg-[#1a1a24]">Active</option>
                        <option value="inactive" className="bg-[#1a1a24]">Inactive</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 hidden sm:block min-w-[120px] text-right">
                    Joined<br/>
                    {format(new Date(user.createdAt || Date.now()), 'MMM d, yyyy')}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
