import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Loader2, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { sendEmailVerification, reload, signOut } from 'firebase/auth';
import { User } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface EmailVerificationProps {
  user: User;
  onVerified?: () => void;
}

const EmailVerification = ({ user, onVerified }: EmailVerificationProps) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    const checkVerificationOnFocus = async () => {
      try {
        await user.reload(); // Force refresh from Firebase
        if (user.emailVerified) {
          setMessage('Email verified successfully!');
          setMessageType('success');
          // Short delay for user to read the success message
          setTimeout(() => onVerified?.(), 1000); 
        }
      } catch (error) {
        console.error("Auto-check failed", error);
      }
    };

    // Listen for when the tab becomes active again
    window.addEventListener('focus', checkVerificationOnFocus);
    return () => window.removeEventListener('focus', checkVerificationOnFocus);
  }, [user, onVerified]);

  const handleSendVerification = async () => {
    // 1. Client-side Throttle Prevention
    const lastSent = sessionStorage.getItem('email_last_sent');
    if (lastSent && Date.now() - parseInt(lastSent) < 60000) {
        setMessage('Please wait a minute before resending.');
        setMessageType('info');
        return;
    }

    setLoading(true);
    setMessage(null);

    try {
        await sendEmailVerification(user);
        
        // 2. Set Timestamp
        sessionStorage.setItem('email_last_sent', Date.now().toString());
        
        setMessage('Verification email sent! Check your inbox.');
        setMessageType('success');
        setResendCooldown(60);
    } catch (error: any) {
        console.error('Error sending verification:', error);
        // ... error handling
    } finally {
        setLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setLoading(true);
    setMessage(null);

    try {
      // Reload user to get the latest verification status
      await reload(user);
      if (user.emailVerified) {
        setMessage('Email verified successfully!');
        setMessageType('success');
        setTimeout(() => onVerified?.(), 1500);
      } else {
        setMessage('Email not yet verified. Please check your inbox.');
        setMessageType('info');
      }
    } catch (error: any) {
      console.error('Error checking verification:', error);
      setMessage('Failed to check verification status. Please try again.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#131314] flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-[#1e1f20] border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </button>

        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4 border border-amber-500/20 relative">
            <Mail className="w-8 h-8 text-amber-500" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full animate-pulse" />
          </div>
          <h1 className="text-2xl font-semibold text-white text-center">Verify Your Email</h1>
          <p className="text-sm text-gray-400 text-center mt-2">
            Almost there! We sent a verification link to
          </p>
          <p className="text-sm font-medium text-blue-400 text-center mt-1 break-all">
            {user.email}
          </p>
        </div>

        <div className="bg-blue-900/20 border border-blue-900/50 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-300 font-medium">What to do next</p>
              <ul className="text-xs text-blue-300/80 mt-2 space-y-1">
                <li>• Check your email inbox and spam folder</li>
                <li>• Click the verification link in the email</li>
                <li>• Return here and click "Verify My Email"</li>
              </ul>
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`p-3 rounded-lg text-sm text-center mb-6 flex items-center justify-center gap-2 ${
              messageType === 'success'
                ? 'bg-green-900/20 border border-green-900/50 text-green-400'
                : messageType === 'error'
                ? 'bg-red-900/20 border border-red-900/50 text-red-400'
                : 'bg-blue-900/20 border border-blue-900/50 text-blue-400'
            }`}
          >
            {messageType === 'success' && <CheckCircle className="w-4 h-4" />}
            {message}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleCheckVerification}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Verify My Email
          </button>

          <button
            onClick={handleSendVerification}
            disabled={loading || resendCooldown > 0}
            className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/50 disabled:cursor-not-allowed text-gray-300 hover:text-white font-medium py-2.5 rounded-lg transition-all text-sm"
          >
            {resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : 'Resend Verification Email'}
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-6">
          You must verify your email to access the chat interface.
        </p>
      </div>
    </div>
  );
};

export default EmailVerification;
