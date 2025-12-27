
import React, { useState } from 'react';
import { User } from '../types';
import { addUser } from '../firebase';
import { ShieldCheck, User as UserIcon, Delete, ArrowRight, Lock, Key } from 'lucide-react';

interface LoginViewProps {
  users: User[];
  onLogin: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ users, onLogin }) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // First Run State (Create Admin)
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  // --- LOGIC: CREATE FIRST ADMIN ---
  if (users.length === 0) {
    const handleCreateAdmin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newAdminName.trim() || !newAdminPassword.trim()) return;
      
      const adminData = {
        name: newAdminName,
        role: 'ADMIN' as const,
        pin: '', // No PIN for Admin
        password: newAdminPassword
      };
      
      // Add to Firestore
      await addUser(adminData);
      
      // Note: We don't auto-login here immediately because we wait for 
      // the Firestore subscription in App.tsx to update the `users` prop 
      // which will then render the Login screen properly.
    };

    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Welcome to PackTrack</h1>
            <p className="text-slate-500 mt-2">No users found in the database. Please create a System Administrator account to get started.</p>
          </div>

          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Admin Name</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. Supervisor"
                value={newAdminName}
                onChange={e => setNewAdminName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Create Password</label>
              <input 
                type="password" 
                required
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Secure Password"
                value={newAdminPassword}
                onChange={e => setNewAdminPassword(e.target.value)}
              />
            </div>
            <button 
              type="submit"
              disabled={!newAdminName || !newAdminPassword}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Setup System <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- LOGIC: LOGIN SCREEN ---

  const handleNumPadClick = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handlePinSubmit = () => {
    if (!selectedUser) return;
    if (selectedUser.pin === pin) {
      onLogin(selectedUser);
    } else {
      setError('Incorrect PIN');
      setPin('');
    }
  };

  // If PIN reaches 4 digits, auto-submit
  if ((selectedUser?.role === 'USER' || selectedUser?.role === 'SUPPORT') && pin.length === 4 && !error) {
     setTimeout(() => handlePinSubmit(), 200);
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    // Check against password field OR fallback to PIN field (for legacy admins)
    const validPassword = selectedUser.password || selectedUser.pin;
    
    if (password === validPassword) {
      onLogin(selectedUser);
    } else {
      setError('Incorrect Password');
      setPassword('');
    }
  };

  const selectUser = (user: User) => {
    setSelectedUser(user);
    setPin('');
    setPassword('');
    setError('');
  };

  const isPinUser = selectedUser?.role === 'USER' || selectedUser?.role === 'SUPPORT';

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white max-w-5xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        
        {/* Left Side: User Selection */}
        <div className="w-full md:w-1/2 p-6 md:p-8 bg-slate-50 border-r border-slate-200 flex flex-col">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <UserIcon className="w-6 h-6 text-blue-600" />
            Select User
          </h2>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {users.map(user => (
              <button
                key={user.id}
                onClick={() => selectUser(user)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left group
                  ${selectedUser?.id === user.id 
                    ? 'border-blue-500 bg-white shadow-md ring-2 ring-blue-100' 
                    : 'border-transparent bg-white hover:bg-slate-100 shadow-sm'
                  }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-colors
                  ${selectedUser?.id === user.id ? 'bg-blue-600 text-white' : 
                    user.role === 'ADMIN' ? 'bg-purple-200 text-purple-600' : 
                    user.role === 'SUPPORT' ? 'bg-emerald-200 text-emerald-600' : 'bg-slate-200 text-slate-500 group-hover:bg-slate-300'}`}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className={`font-bold text-lg ${selectedUser?.id === user.id ? 'text-slate-800' : 'text-slate-600'}`}>
                    {user.name}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium 
                    ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 
                      user.role === 'SUPPORT' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {user.role}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Auth Pad */}
        <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col items-center justify-center bg-white relative">
          
          {!selectedUser ? (
             <div className="text-center text-slate-400">
               <Lock className="w-16 h-16 mx-auto mb-4 opacity-20" />
               <p>Select a user from the list to login</p>
             </div>
          ) : (
            <div className="w-full max-w-xs space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center space-y-2">
                 <h3 className="text-xl font-medium text-slate-600">
                   {isPinUser ? 'Enter PIN' : 'Enter Password'} for <span className="text-slate-900 font-bold">{selectedUser.name}</span>
                 </h3>
                 <div className="h-6 flex items-center justify-center">
                    {error && <p className="text-red-500 text-sm font-medium animate-pulse">{error}</p>}
                 </div>
              </div>

              {/* RENDER BASED ON ROLE */}
              {isPinUser ? (
                <>
                  {/* PIN DISPLAY */}
                  <div className="flex justify-center gap-4 items-center mb-6">
                    {[0, 1, 2, 3].map(i => (
                      <div 
                        key={i}
                        className={`w-14 h-16 rounded-xl flex items-center justify-center text-3xl font-bold border-2 transition-all duration-150
                          ${i < pin.length 
                            ? 'border-blue-500 bg-blue-50 text-blue-600' 
                            : 'border-slate-200 bg-white text-slate-300'}
                          ${error ? 'border-red-400 bg-red-50 text-red-500' : ''}
                        `}
                      >
                        {pin[i] || <div className="w-2 h-2 rounded-full bg-slate-300"></div>}
                      </div>
                    ))}
                  </div>

                  {/* NUM PAD */}
                  <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                      <button
                        key={num}
                        onClick={() => handleNumPadClick(num.toString())}
                        className="h-16 w-full rounded-2xl bg-slate-50 hover:bg-slate-100 text-2xl font-semibold text-slate-700 shadow-sm border border-slate-200 active:scale-95 transition-all"
                      >
                        {num}
                      </button>
                    ))}
                    <div className="flex items-center justify-center"></div>
                    <button
                      onClick={() => handleNumPadClick('0')}
                      className="h-16 w-full rounded-2xl bg-slate-50 hover:bg-slate-100 text-2xl font-semibold text-slate-700 shadow-sm border border-slate-200 active:scale-95 transition-all"
                    >
                      0
                    </button>
                    <button
                      onClick={handleBackspace}
                      className="h-16 w-full rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 shadow-sm border border-red-100 flex items-center justify-center active:scale-95 transition-all"
                    >
                      <Delete className="w-6 h-6" />
                    </button>
                  </div>
                </>
              ) : (
                /* PASSWORD INPUT FOR ADMIN */
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div className="relative">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <Key className="h-5 w-5 text-slate-400" />
                     </div>
                     <input
                       type="password"
                       autoFocus
                       className="block w-full pl-10 pr-3 py-4 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                       placeholder="Password"
                       value={password}
                       onChange={(e) => {
                         setPassword(e.target.value);
                         setError('');
                       }}
                     />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                  >
                    Login <ArrowRight className="w-5 h-5" />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="fixed bottom-4 text-slate-400 text-xs text-center w-full">
        PackTrack Pro v1.4 &bull; Secure Access
      </div>
    </div>
  );
};
