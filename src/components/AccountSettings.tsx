import React, { useState } from 'react';
import { 
  X, ShieldAlert, Mail, Loader2, 
  AlertTriangle, HardDrive, UserX, CheckCircle2 
} from 'lucide-react';
import { User } from 'firebase/auth';
import { useAccountManagement } from '../hooks/useAccountManagement';

interface AccountSettingsProps {
  user: User;
  onClose: () => void;
}

const AccountSettings: React.FC<AccountSettingsProps> = ({ user, onClose }) => {
  const [activeTab, setActiveTab] = useState<'data' | 'account'>('data');
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { requestDeletion } = useAccountManagement();
  const [isLoading, setIsLoading] = useState(false);

  const handleSendLink = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await requestDeletion(activeTab);
      setEmailSent(true);
    } catch (err) {
      setError("Failed to send email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1e1f20] w-full max-w-md rounded-2xl border border-gray-800 shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-800 bg-[#282a2c] flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-blue-500" />
            Security & Data
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        {!emailSent && (
          <div className="flex border-b border-gray-800">
            <button 
              onClick={() => setActiveTab('data')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'data' ? 'bg-[#1e1f20] text-white border-b-2 border-blue-500' : 'bg-[#131314] text-gray-500 hover:text-gray-300'}`}
            >
              Clear Data
            </button>
            <button 
              onClick={() => setActiveTab('account')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'account' ? 'bg-[#1e1f20] text-red-400 border-b-2 border-red-500' : 'bg-[#131314] text-gray-500 hover:text-gray-300'}`}
            >
              Delete Account
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {emailSent ? (
            <div className="text-center py-4 animate-fade-in">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
                <Mail className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Check your Email</h3>
              <p className="text-gray-400 text-sm mb-6">
                We've sent a secure verification link to <strong>{user.email}</strong>. 
                Clicking the link will confirm your identity and immediately execute the 
                <strong> {activeTab === 'account' ? 'Account Deletion' : 'Data Wipe'}</strong>.
              </p>
              <button onClick={onClose} className="w-full bg-[#282a2c] hover:bg-[#323436] text-white py-3 rounded-lg text-sm font-medium border border-gray-700">
                Close
              </button>
            </div>
          ) : (
            <>
              <div className={`p-4 rounded-xl border ${activeTab === 'data' ? 'bg-blue-500/5 border-blue-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${activeTab === 'data' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-500'}`}>
                    {activeTab === 'data' ? <HardDrive className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className={`font-medium ${activeTab === 'data' ? 'text-blue-100' : 'text-red-100'}`}>
                      {activeTab === 'data' ? 'Delete History Only' : 'Delete Account Forever'}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      {activeTab === 'data' 
                        ? "Permanently remove all investigations. Account remains active." 
                        : "Permanently delete your account and all data. This is irreversible."}
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                  <AlertTriangle className="w-4 h-4" /> {error}
                </div>
              )}

              <div className="space-y-3">
                <p className="text-xs text-gray-500 text-center">
                  For security, we must verify your email before proceeding.
                </p>
                <button 
                  onClick={handleSendLink} 
                  disabled={isLoading}
                  className={`w-full py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                    activeTab === 'data' 
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
                      : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20'
                  }`}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Send Verification Email
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;