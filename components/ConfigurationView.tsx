import React, { useState } from 'react';
import { User, Tab } from '../types';
import { addUser, updateUser, deleteUser } from '../firebase';
import { UserCircle, Trash2, Plus, ShieldCheck, UserX, Shield, Users, Edit2, X, CloudCheck } from 'lucide-react';

interface ConfigurationViewProps {
  users: User[];
  currentUser: User | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  setActiveTab: (tab: Tab) => void;
  requestConfirm: (message: string, onConfirm: () => void) => void;
}

export const ConfigurationView: React.FC<ConfigurationViewProps> = ({ 
  users, 
  currentUser, 
  setCurrentUser,
  requestConfirm
}) => {
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [newUserRole, setNewUserRole] = useState<'ADMIN' | 'USER'>('USER');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || newUserPin.length !== 4) return;

    if (editingUserId) {
      // UPDATE EXISTING USER
      await updateUser(editingUserId, {
        name: newUserName.trim(),
        role: newUserRole,
        pin: newUserPin
      });
      setEditingUserId(null);
    } else {
      // CREATE NEW USER
      await addUser({
        name: newUserName.trim(),
        role: newUserRole,
        pin: newUserPin
      });
    }
    
    // Reset Form
    resetForm();
  };

  const handleEditClick = (user: User) => {
    setNewUserName(user.name);
    setNewUserPin(user.pin);
    setNewUserRole(user.role);
    setEditingUserId(user.id);
  };

  const resetForm = () => {
    setNewUserName('');
    setNewUserPin('');
    setNewUserRole('USER');
    setEditingUserId(null);
  };

  const handleDeleteUser = (userId: string) => {
    // Prevent deleting the last Admin
    const admins = users.filter(u => u.role === 'ADMIN');
    const userToDelete = users.find(u => u.id === userId);
    
    if (userToDelete?.role === 'ADMIN' && admins.length <= 1) {
      alert("Cannot delete the last Administrator. Please assign another Admin first.");
      return;
    }

    requestConfirm("Are you sure? This will not delete their history logs, but the user will be removed from the system.", () => {
      deleteUser(userId);
      // If we deleted the user currently being edited, reset form
      if (editingUserId === userId) {
        resetForm();
      }
    });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-10">
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">System Configuration</h1>
        <p className="text-slate-500">Manage user access, roles, and system data.</p>
        <div className="mt-4 flex items-center gap-2 text-sm text-green-600 bg-green-50 w-fit px-3 py-1 rounded-full border border-green-200">
          <CloudCheck className="w-4 h-4" />
          System connected to Cloud Database
        </div>
      </div>

      {/* User Management Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT: Add/Edit User Form */}
        <div className={`bg-white rounded-xl shadow-sm border overflow-hidden h-fit transition-colors ${editingUserId ? 'border-orange-200 ring-4 ring-orange-50' : 'border-slate-200'}`}>
          <div className={`p-5 border-b flex justify-between items-center ${editingUserId ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-200'}`}>
             <h2 className={`font-bold flex items-center gap-2 ${editingUserId ? 'text-orange-800' : 'text-slate-800'}`}>
               {editingUserId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5 text-blue-600" />}
               {editingUserId ? 'Edit User' : 'Add New User'}
             </h2>
             {editingUserId && (
               <button onClick={resetForm} className="text-orange-600 hover:bg-orange-100 p-1 rounded-full transition-colors">
                 <X className="w-5 h-5" />
               </button>
             )}
          </div>
          <div className="p-6">
            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                />
              </div>
              
              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                 <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewUserRole('USER')}
                      className={`py-2 px-3 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 ${newUserRole === 'USER' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                    >
                      <Users className="w-4 h-4" /> Packer
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewUserRole('ADMIN')}
                      className={`py-2 px-3 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 ${newUserRole === 'ADMIN' ? 'bg-purple-50 border-purple-500 text-purple-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                    >
                      <Shield className="w-4 h-4" /> Admin
                    </button>
                 </div>
                 <p className="text-xs text-slate-400 mt-1">
                   {newUserRole === 'USER' ? 'Restricted to Tracker view only.' : 'Full access to Analytics and Config.'}
                 </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">4-Digit PIN</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="0000"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest"
                  value={newUserPin}
                  onChange={(e) => setNewUserPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
              </div>

              <button 
                type="submit"
                disabled={!newUserName.trim() || newUserPin.length !== 4}
                className={`w-full text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors mt-2 
                  ${editingUserId 
                    ? 'bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300' 
                    : 'bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300'}`}
              >
                {editingUserId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {editingUserId ? 'Update User' : 'Create User'}
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT: User List */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-slate-600" />
              Existing Users
            </h2>
            <span className="bg-slate-200 text-slate-600 px-2 py-1 rounded-full text-xs font-bold">
              {users.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">PIN</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                      <UserX className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      No users defined.
                    </td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr key={user.id} className={`hover:bg-slate-50 ${editingUserId === user.id ? 'bg-orange-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold 
                            ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-700">{user.name}</span>
                          {currentUser?.id === user.id && (
                             <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] uppercase font-bold tracking-wide">You</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.role === 'ADMIN' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                            <ShieldCheck className="w-3 h-3" /> Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            <Users className="w-3 h-3" /> Packer
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-slate-500">
                        {user.pin}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => handleEditClick(user)}
                          className="text-blue-600 hover:text-blue-900 mx-2 p-2 hover:bg-blue-50 rounded-md transition-colors"
                          title="Edit User"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-md transition-colors"
                          title="Remove User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};