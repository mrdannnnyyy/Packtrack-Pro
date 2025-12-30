
import React, { useState, useEffect } from 'react';
import { User, Tab, BoxType, CostSettings } from '../types';
import { addUser, updateUser, deleteUser } from '../firebase';
import { 
  UserCircle, Trash2, Plus, ShieldCheck, UserX, Shield, Users, 
  Edit2, X, CloudCheck, LifeBuoy, Key, DollarSign, Package, 
  Clock, Save, Loader2 
} from 'lucide-react';

const BACKEND_URL = "https://packtrack-ups-backend-214733779716.us-west1.run.app";

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
  const [newUserAuth, setNewUserAuth] = useState(''); 
  const [newUserRole, setNewUserRole] = useState<'ADMIN' | 'USER' | 'SUPPORT'>('USER');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Operational Costs State
  const [hourlyRate, setHourlyRate] = useState<number>(18.00);
  const [materialCost, setMaterialCost] = useState<number>(0.50);
  const [boxes, setBoxes] = useState<BoxType[]>([{ id: '1', name: 'Small Box', cost: 0.85 }]);
  const [isSavingCosts, setIsSavingCosts] = useState(false);

  useEffect(() => {
    const fetchCosts = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/settings/costs`);
        if (response.ok) {
          const data: CostSettings = await response.json();
          setHourlyRate(data.hourlyRate);
          setMaterialCost(data.materialCost);
          setBoxes(data.boxes || []);
        }
      } catch (error) {
        console.error("Failed to fetch cost settings", error);
      }
    };
    fetchCosts();
  }, []);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserAuth.trim()) return;

    const isPinUser = newUserRole === 'USER' || newUserRole === 'SUPPORT';
    const pinVal = isPinUser ? newUserAuth : '';
    const passVal = !isPinUser ? newUserAuth : '';

    if (isPinUser && pinVal.length !== 4) {
      alert("PIN must be exactly 4 digits.");
      return;
    }

    if (editingUserId) {
      await updateUser(editingUserId, {
        name: newUserName.trim(),
        role: newUserRole,
        pin: pinVal,
        password: passVal
      });
      setEditingUserId(null);
    } else {
      await addUser({
        name: newUserName.trim(),
        role: newUserRole,
        pin: pinVal,
        password: passVal
      });
    }
    resetForm();
  };

  const handleSaveCosts = async () => {
    setIsSavingCosts(true);
    try {
      const response = await fetch(`${BACKEND_URL}/settings/costs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hourlyRate, materialCost, boxes })
      });
      if (response.ok) {
        alert("Cost settings saved successfully.");
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      alert("Error saving costs. Please try again.");
    } finally {
      setIsSavingCosts(false);
    }
  };

  const addBox = () => {
    const id = Math.random().toString(36).substring(7);
    setBoxes([...boxes, { id, name: '', cost: 0 }]);
  };

  const updateBox = (id: string, field: 'name' | 'cost', value: string | number) => {
    setBoxes(boxes.map(box => box.id === id ? { ...box, [field]: value } : box));
  };

  const removeBox = (id: string) => {
    setBoxes(boxes.filter(box => box.id !== id));
  };

  const handleEditClick = (user: User) => {
    setNewUserName(user.name);
    if (user.role === 'USER' || user.role === 'SUPPORT') {
      setNewUserAuth(user.pin);
    } else {
      setNewUserAuth(user.password || ''); 
    }
    setNewUserRole(user.role);
    setEditingUserId(user.id);
  };

  const resetForm = () => {
    setNewUserName('');
    setNewUserAuth('');
    setNewUserRole('USER');
    setEditingUserId(null);
  };

  const handleDeleteUser = (userId: string) => {
    const admins = users.filter(u => u.role === 'ADMIN');
    const userToDelete = users.find(u => u.id === userId);
    
    if (userToDelete?.role === 'ADMIN' && admins.length <= 1) {
      alert("Cannot delete the last Administrator. Please assign another Admin first.");
      return;
    }

    requestConfirm("Are you sure? This will not delete their history logs, but the user will be removed from the system.", () => {
      deleteUser(userId);
      if (editingUserId === userId) resetForm();
    });
  };

  const isPinBasedRole = newUserRole === 'USER' || newUserRole === 'SUPPORT';

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-10">
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">System Configuration</h1>
        <p className="text-slate-500">Manage user access, roles, and system data.</p>
        <div className="mt-4 flex items-center gap-2 text-sm text-green-600 bg-green-50 w-fit px-3 py-1 rounded-full border border-green-200">
          <CloudCheck className="w-4 h-4" />
          System connected to Cloud Database
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* USER MANAGEMENT */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <UserCircle className="w-5 h-5 text-slate-600" />
                User Access Management
              </h2>
              <span className="bg-slate-200 text-slate-600 px-2 py-1 rounded-full text-xs font-bold">
                {users.length} Users
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Auth</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {users.map(user => (
                    <tr key={user.id} className={`hover:bg-slate-50 ${editingUserId === user.id ? 'bg-orange-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold 
                            ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-600' : user.role === 'SUPPORT' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-700">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          user.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-100' : 
                          user.role === 'SUPPORT' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                          'bg-slate-50 text-slate-600 border-slate-100'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-slate-500">
                        {user.role === 'ADMIN' ? 'Password' : `PIN: ${user.pin}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => handleEditClick(user)} className="text-blue-600 hover:text-blue-900 mx-2 p-2 rounded-md transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteUser(user.id)} className="text-red-400 hover:text-red-600 p-2 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* OPERATIONAL COSTS MANAGER */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Operational Costs & Financials
              </h2>
              <button 
                onClick={handleSaveCosts} 
                disabled={isSavingCosts}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isSavingCosts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Settings
              </button>
            </div>
            <div className="p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" /> Hourly Labor Rate ($/hr)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="w-full pl-7 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                      value={hourlyRate} 
                      onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                    <Package className="w-4 h-4 text-orange-500" /> Misc Material Cost ($/order)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="w-full pl-7 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                      value={materialCost} 
                      onChange={(e) => setMaterialCost(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800">Box Inventory & Costs</h3>
                  <button onClick={addBox} className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Box Type
                  </button>
                </div>
                <div className="space-y-3">
                  {boxes.map(box => (
                    <div key={box.id} className="flex gap-3 items-center animate-in fade-in slide-in-from-right-2">
                      <div className="flex-1">
                        <input 
                          type="text" 
                          placeholder="Box Name (e.g. Small)" 
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          value={box.name}
                          onChange={(e) => updateBox(box.id, 'name', e.target.value)}
                        />
                      </div>
                      <div className="w-32 relative">
                        <span className="absolute left-3 top-2 text-slate-400 font-bold text-sm">$</span>
                        <input 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00"
                          className="w-full pl-7 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          value={box.cost}
                          onChange={(e) => updateBox(box.id, 'cost', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <button onClick={() => removeBox(box.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {boxes.length === 0 && (
                    <div className="text-center py-6 bg-slate-50 border border-dashed rounded-lg text-slate-400 text-sm">
                      No box types configured. Add one to track packaging costs.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* USER FORM */}
        <div className="lg:col-span-1">
          <div className={`bg-white rounded-xl shadow-sm border overflow-hidden h-fit sticky top-24 transition-colors ${editingUserId ? 'border-orange-200 ring-4 ring-orange-50' : 'border-slate-200'}`}>
            <div className={`p-5 border-b flex justify-between items-center ${editingUserId ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-200'}`}>
               <h2 className={`font-bold flex items-center gap-2 ${editingUserId ? 'text-orange-800' : 'text-slate-800'}`}>
                 {editingUserId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5 text-blue-600" />}
                 {editingUserId ? 'Edit User' : 'Add New User'}
               </h2>
               {editingUserId && (
                 <button onClick={resetForm} className="text-orange-600 hover:bg-orange-100 p-1 rounded-full"><X className="w-5 h-5" /></button>
               )}
            </div>
            <div className="p-6">
              <form onSubmit={handleSaveUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <input type="text" placeholder="John Doe" className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                   <div className="grid grid-cols-3 gap-2">
                      <button type="button" onClick={() => setNewUserRole('USER')} className={`py-2 px-1 rounded-lg border text-xs font-medium flex flex-col items-center gap-1 ${newUserRole === 'USER' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-300'}`}><Users className="w-4 h-4" /> Packer</button>
                      <button type="button" onClick={() => setNewUserRole('SUPPORT')} className={`py-2 px-1 rounded-lg border text-xs font-medium flex flex-col items-center gap-1 ${newUserRole === 'SUPPORT' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-300'}`}><LifeBuoy className="w-4 h-4" /> Support</button>
                      <button type="button" onClick={() => setNewUserRole('ADMIN')} className={`py-2 px-1 rounded-lg border text-xs font-medium flex flex-col items-center gap-1 ${newUserRole === 'ADMIN' ? 'bg-purple-50 border-purple-500 text-purple-700' : 'bg-white border-slate-300'}`}><Shield className="w-4 h-4" /> Admin</button>
                   </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{isPinBasedRole ? '4-Digit PIN' : 'Password'}</label>
                  <input 
                    type={isPinBasedRole ? "text" : "password"}
                    maxLength={isPinBasedRole ? 4 : undefined}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none font-mono tracking-widest"
                    value={newUserAuth}
                    onChange={(e) => setNewUserAuth(isPinBasedRole ? e.target.value.replace(/\D/g, '').slice(0, 4) : e.target.value)}
                  />
                </div>
                <button type="submit" className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-medium hover:bg-slate-800 transition-colors">
                  {editingUserId ? 'Update User' : 'Create User'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
