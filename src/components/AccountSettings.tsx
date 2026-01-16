import React, { useState } from 'react';
import { 
  X, Trash2, ShieldAlert, Lock, Loader2, 
  AlertTriangle, HardDrive, UserX 
} from 'lucide-react';
import { 
  deleteUser, reauthenticateWithCredential, 
  EmailAuthProvider, User, signOut 
} from 'firebase/auth';
import { 
  collection, getDocs, deleteDoc, doc, writeBatch 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

interface AccountSettingsProps {
  user: User;
  onClose: () => void;
  onResetSession: () => void;
}

const AccountSettings: React.FC<AccountSettingsProps> = ({ user, onClose, onResetSession }) => {
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'data' | 'account'>('data');
  const [progress, setProgress] = useState<string>('');

  const deleteUserData = async () => {
    if (!user) return;
    
    // GHOST FILE FIX: Reset UI session first
    onResetSession();
    
    setProgress('Scanning investigation files...');
    const batch = writeBatch(db);
    const chatsRef = collection(db, `users/${user.uid}/chats`);
    const chatsSnapshot = await getDocs(chatsRef);

    let opCount = 0;
    const MAX_BATCH_SIZE = 450; 

    const commitIfFull = async () => {
      opCount++;
      if (opCount >= MAX_BATCH_SIZE) {
        await batch.commit();
        opCount = 0;
      }
    };

    setProgress(`Found ${chatsSnapshot.size} cases. Cleaning up...`);

    for (const chatDoc of chatsSnapshot.docs) {
      const msgsRef = collection(db, `users/${user.uid}/chats/${chatDoc.id}/messages`);
      const msgsSnap = await getDocs(msgsRef);
      for (const msg of msgsSnap.docs) {
        deleteDoc(msg.ref);
      }

      const savedRef = collection(db, `users/${user.uid}/chats/${chatDoc.id}/saved`);
      const savedSnap = await getDocs(savedRef);
      for (const saved of savedSnap.docs) {
        deleteDoc(saved.ref);
      }

      deleteDoc(chatDoc.ref);
    }

    const userDocRef = doc(db, `users/${user.uid}`);
    deleteDoc(userDocRef);

    setProgress('Data cleanup complete.');
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Password is required.");
      return;
    }

    // WARNING POPUP
    const warningMessage = activeTab === 'account' 
      ? "Are you sure you wish to delete this account? This action is permanent." 
      : "Are you sure to confirm data wipe? You will be signed out.";
      
    if (!window.confirm(warningMessage)) {
      return;
    }
    
    setIsDeleting(true);
    setError(null);
    setProgress('Verifying password...');

    try {
      const credential = EmailAuthProvider.credential(user.email!, password);
      await reauthenticateWithCredential(user, credential);

      // SET REDIRECT FLAG FOR LOGIN.TSX
      localStorage.setItem('shouldShowSignup', 'true');

      if (activeTab === 'data') {
        // OPTION A: DATA WIPE
        await deleteUserData();
        setProgress('Signing out...');
        await signOut(auth);
        onClose();
        window.location.reload(); 
      } else {
        // OPTION B: DELETE ACCOUNT
        await deleteUserData();
        setProgress('Deleting account access...');
        await deleteUser(user);
      }

    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password') {
        setError("Incorrect password.");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Too many attempts. Please try again later.");
      } else {
        setError("Action failed: " + err.message);
      }
      // If failed, don't redirect
      localStorage.removeItem('shouldShowSignup');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1e1f20] w-full max-w-md rounded-2xl border border-red-500/20 shadow-2xl overflow-hidden flex flex-col">
        
        <div className="p-6 border-b border-gray-800 bg-[#282a2c] flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            Security & Data
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-gray-800">
          <button 
            onClick={() => { setActiveTab('data'); setError(null); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'data' ? 'bg-[#1e1f20] text-white border-b-2 border-blue-500' : 'bg-[#131314] text-gray-500 hover:text-gray-300'}`}
          >
            Clear Data
          </button>
          <button 
            onClick={() => { setActiveTab('account'); setError(null); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'account' ? 'bg-[#1e1f20] text-red-400 border-b-2 border-red-500' : 'bg-[#131314] text-gray-500 hover:text-gray-300'}`}
          >
            Delete Account
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className={`p-4 rounded-xl border ${activeTab === 'data' ? 'bg-blue-500/5 border-blue-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${activeTab === 'data' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-500'}`}>
                {activeTab === 'data' ? <HardDrive className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
              </div>
              <div>
                <h3 className={`font-medium ${activeTab === 'data' ? 'text-blue-100' : 'text-red-100'}`}>
                  {activeTab === 'data' ? 'Delete History Only' : 'Delete Everything'}
                </h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  {activeTab === 'data' 
                    ? "Permanently remove all chats. You will be signed out and redirected to registration." 
                    : "Permanently delete your account and all data. This cannot be undone."}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleAction} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500 uppercase">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#131314] border border-gray-700 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:border-red-500 focus:outline-none placeholder-gray-600"
                  placeholder="Enter your password"
                  disabled={isDeleting}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20 animate-fade-in">
                <AlertTriangle className="w-4 h-4" /> {error}
              </div>
            )}

            {isDeleting && (
              <div className="text-xs text-gray-400 text-center animate-pulse">
                {progress}
              </div>
            )}

            <button 
              type="submit" 
              disabled={!password || isDeleting}
              className={`w-full py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                activeTab === 'data' 
                  ? 'bg-[#282a2c] hover:bg-[#323436] text-white border border-gray-600 hover:border-gray-500'
                  : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {activeTab === 'data' ? 'Confirm Data Wipe' : 'Confirm Account Deletion'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;