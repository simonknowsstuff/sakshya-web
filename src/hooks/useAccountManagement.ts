import { useState, useRef } from 'react';
import { 
  sendSignInLinkToEmail, 
  isSignInWithEmailLink, 
  signInWithEmailLink, 
  deleteUser
} from 'firebase/auth';
import { 
  collection, getDocs, deleteDoc, doc, writeBatch 
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export const useAccountManagement = () => {
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  
  // FIX: Prevent React Strict Mode from running this twice and invalidating the code
  const hasRun = useRef(false);

  // --- 1. SEND VERIFICATION EMAIL ---
  const requestDeletion = async (type: 'data' | 'account') => {
    if (!auth.currentUser || !auth.currentUser.email) return;
    
    const email = auth.currentUser.email;
    
    // Construct the URL to come back to
    const returnUrl = `${window.location.origin}?mode=verify_delete&type=${type}`;
    console.log("Sending verification link to:", email, "Return URL:", returnUrl);

    const actionCodeSettings = {
      url: returnUrl,
      handleCodeInApp: true,
    };

    window.localStorage.setItem('deleteIntent', type);
    window.localStorage.setItem('deleteEmail', email);

    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      console.log("Email sent successfully");
    } catch (error) {
      console.error("Failed to send email:", error);
      throw error;
    }
  };

  // --- 2. EXECUTE DELETION (Recursive) ---
  const executeCleanup = async (userUid: string) => {
    console.log("Starting cleanup for user:", userUid);
    const batch = writeBatch(db);
    
    // 1. Get all chats
    const chatsRef = collection(db, `users/${userUid}/chats`);
    const chatsSnapshot = await getDocs(chatsRef);
    console.log(`Found ${chatsSnapshot.size} chats to delete.`);

    let opCount = 0;
    const commitIfFull = async () => {
      opCount++;
      if (opCount >= 450) {
        await batch.commit();
        opCount = 0;
      }
    };

    for (const chatDoc of chatsSnapshot.docs) {
      // Messages
      const msgsSnap = await getDocs(collection(db, `users/${userUid}/chats/${chatDoc.id}/messages`));
      for (const msg of msgsSnap.docs) {
        deleteDoc(msg.ref);
      }
      
      // Saved Events
      const savedSnap = await getDocs(collection(db, `users/${userUid}/chats/${chatDoc.id}/saved`));
      for (const saved of savedSnap.docs) {
        deleteDoc(saved.ref);
      }

      // Chat Doc
      deleteDoc(chatDoc.ref);
    }

    // User Doc
    deleteDoc(doc(db, `users/${userUid}`));
    console.log("Cleanup complete.");
  };

  // --- 3. VERIFY LINK & EXECUTE ---
  const checkDeletionVerify = async () => {
    // GUARD: If we already ran this logic on this page load, STOP.
    if (hasRun.current) {
        console.log("Verification logic already ran (Strict Mode skipped).");
        return;
    }

    if (isSignInWithEmailLink(auth, window.location.href)) {
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get('mode');
      const type = urlParams.get('type');

      console.log("Detected Email Link. Mode:", mode, "Type:", type);

      if (mode === 'verify_delete' && type) {
        // MARK AS RUNNING so we don't do it again
        hasRun.current = true;
        
        setProcessing(true);
        setStatus("Verifying security credentials...");
        
        let email = window.localStorage.getItem('deleteEmail');
        
        // If email is missing (e.g., different browser), ask for it
        if (!email) {
          email = window.prompt('Security Check: Please enter your email address to confirm deletion.');
        }

        if (email) {
          try {
            console.log("Attempting sign-in with email link...");
            const result = await signInWithEmailLink(auth, email, window.location.href);
            const user = result.user;
            console.log("Re-authentication successful:", user.uid);

            setStatus(type === 'account' ? "Deleting account..." : "Wiping data...");

            await executeCleanup(user.uid);

            if (type === 'account') {
              await deleteUser(user);
              setStatus("Account deleted.");
              window.localStorage.clear();
              // App.tsx auth listener handles redirect
            } else {
              setStatus("Data wiped successfully.");
              window.localStorage.removeItem('deleteIntent');
              window.localStorage.removeItem('deleteEmail');
              
              // Clean URL
              window.history.replaceState({}, '', window.location.pathname);
              
              // Reload to reset UI
              setTimeout(() => window.location.reload(), 1500);
            }

          } catch (error: any) {
            console.error("Verification Error:", error);
            setStatus(`Verification failed: ${error.message}`);
            // Don't hide status immediately so user can read error
          } finally {
            setProcessing(false);
          }
        } else {
            setStatus("Email verification cancelled.");
            setProcessing(false);
        }
      }
    }
  };

  return { requestDeletion, checkDeletionVerify, processing, status };
};