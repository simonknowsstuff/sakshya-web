// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getFunctions } from 'firebase/functions';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from "firebase/auth";
import { 
  initializeAppCheck, 
  ReCaptchaV3Provider
} from 'firebase/app-check';

// 1. Your Firebase Config (Copy from Console)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// 2. Initialize App
const app = initializeApp(firebaseConfig);

// 3. Initialize Services
export const functions = getFunctions(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

// 4. Initialize App Check (The Security Layer)
// We only initialize this in the browser, not during build/SSR
if (typeof window !== 'undefined') {
  
  // Developer Mode: Allows localhost to work
  if (import.meta.env.DEV) {
    // @ts-ignore - Global variable needed for Firebase SDK debug mode
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN || true;
    console.log("Sakshya AI: Using Manual Debug Token");
    // connectFunctionsEmulator(functions, 'localhost', 5001);
    // connectFirestoreEmulator(db, 'localhost', 8080);
    // connectAuthEmulator(auth, 'http://localhost:9099');
  }

  try {
    initializeAppCheck(app, {
      // Replace with your actual reCAPTCHA v3 Site Key
      provider: new ReCaptchaV3Provider('6Ld1AkgsAAAAAG7NceW6CVzCL39cQxYHwypYkjJq'),
      
      // Auto-refresh tokens so long sessions don't get rejected
      isTokenAutoRefreshEnabled: true 
    });
    
    console.log("Sakshya AI: Security Shield Active");
  } catch (e) {
    console.error("App Check failed to load:", e);
  }
}