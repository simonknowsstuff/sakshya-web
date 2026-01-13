import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Lock, Mail, Loader2, ShieldCheck } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // No need to redirect manually; App.tsx will detect the state change
    } catch (err: any) {
      console.error(err);
      setError("Invalid credentials. Please contact your administrator.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#131314] flex flex-col items-center justify-center p-4">
      {/* Brand Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/10 mb-4 border border-blue-500/20">
          <ShieldCheck className="w-6 h-6 text-blue-500" />
        </div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Sakshya AI</h1>
        <p className="text-sm text-gray-500 mt-2">Forensic Evidence Retrieval System</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-[#1e1f20] border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <h2 className="text-lg font-medium text-gray-200 mb-6">Authorized Access</h2>
        
        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#131314] border border-gray-700 text-white text-sm rounded-lg pl-10 pr-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all placeholder-gray-600"
                placeholder="officer@department.gov"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#131314] border border-gray-700 text-white text-sm rounded-lg pl-10 pr-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all placeholder-gray-600"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-800 text-center">
          <p className="text-xs text-gray-600">
            Restricted System. All activities are monitored and logged.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;