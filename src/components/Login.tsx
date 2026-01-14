import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { 
  Lock, Mail, Loader2, ShieldCheck, 
  ArrowRight, Eye, EyeOff 
} from 'lucide-react';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Passwords match check
    if (!isLogin && password !== confirmPass) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        // --- LOGIN ---
        // We just log them in. App.tsx will check if they are verified.
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // --- SIGN UP ---
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        // We do NOT sign them out. 
        // App.tsx will detect the new user, see they are unverified, and show the proper screen.
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError("This email is already registered. Please login.");
      } else if (err.code === 'auth/weak-password') {
        setError("Password should be at least 6 characters.");
      } else if (err.code === 'auth/invalid-credential') {
        setError("Invalid email or password.");
      } else {
        setError("Authentication failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#131314] flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-[#1e1f20] border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 border border-blue-500/20">
            <ShieldCheck className="w-6 h-6 text-blue-500" />
          </div>
          <h1 className="text-xl font-semibold text-white">Sakshya AI</h1>
          <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">
            {isLogin ? "Authorized Personnel Only" : "New Investigator Registration"}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-sm text-red-400 text-center animate-fade-in">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#131314] border border-gray-700 text-white text-sm rounded-lg pl-10 pr-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors placeholder-gray-600"
                placeholder="officer@agency.gov"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#131314] border border-gray-700 text-white text-sm rounded-lg pl-10 pr-10 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors placeholder-gray-600"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div className="space-y-1 animate-fade-in">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                <input 
                  type={showConfirmPass ? "text" : "password"} 
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  className="w-full bg-[#131314] border border-gray-700 text-white text-sm rounded-lg pl-10 pr-10 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors placeholder-gray-600"
                  placeholder="Re-type password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="absolute right-3 top-3 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 mt-6"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {isLogin ? "Authenticate" : "Create Account"}
                {!isLogin && <ArrowRight className="w-4 h-4" />}
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-800 text-center">
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
              setConfirmPass('');
            }}
            className="text-sm text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            {isLogin ? (
              <>Don't have an ID? <span className="text-blue-400">Request Access</span></>
            ) : (
              <>Already registered? <span className="text-blue-400">Login here</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;