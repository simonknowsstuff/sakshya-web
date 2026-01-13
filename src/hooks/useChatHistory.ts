import { useState, useEffect } from 'react';
import { 
  collection, query, orderBy, addDoc, onSnapshot, serverTimestamp, doc, setDoc, getDocs
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; // Import onAuthStateChanged
import { db } from '../lib/firebase';
import { VideoSession } from '../types';

export const useChatHistory = () => {
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    // 1. Listen for AUTH changes (Login/Logout)
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // 2. User is logged in -> Listen to FIRESTORE
        const chatsRef = collection(db, `users/${user.uid}/chats`);
        // We order by 'createdAt' descending so newest chats appear at the top
        const q = query(chatsRef, orderBy('createdAt', 'desc'));

        const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
          const chatList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setChats(chatList);
          setLoading(false);
        }, (error) => {
           console.error("Firestore Error:", error);
           setLoading(false);
        });

        // Cleanup the Firestore listener when the user logs out or component unmounts
        return () => unsubscribeFirestore();
      } else {
        // User logged out -> Clear list
        setChats([]);
        setLoading(false);
      }
    });

    // Cleanup the Auth listener
    return () => unsubscribeAuth();
  }, []); // Empty dependency array = run once on mount

  // --- Helpers (Keep these the same) ---

  const createSession = async (sessionData: VideoSession) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Must be logged in to save history");

    // Important: Use the passed sessionData.videoUrl (which should be the downloadUrl)
    const chatRef = await addDoc(collection(db, `users/${user.uid}/chats`), {
      videoName: sessionData.videoName,
      videoHash: sessionData.hash,
      previewUrl: sessionData.videoUrl, 
      createdAt: serverTimestamp(),
      title: "New Investigation" 
    });

    return chatRef.id;
  };

  const saveMessage = async (chatId: string, prompt: string, aiEvents: any[]) => {
    const user = auth.currentUser;
    if (!user) return;

    const messagesRef = collection(db, `users/${user.uid}/chats/${chatId}/messages`);
    
    await addDoc(messagesRef, {
      role: 'user',
      content: prompt,
      createdAt: serverTimestamp()
    });

    await addDoc(messagesRef, {
      role: 'assistant',
      content: aiEvents,
      createdAt: serverTimestamp()
    });

    // Update the title to match the prompt
    const chatDocRef = doc(db, `users/${user.uid}/chats/${chatId}`);
    await setDoc(chatDocRef, { title: prompt }, { merge: true });
  };

  const loadMessages = async (chatId: string) => {
    const user = auth.currentUser;
    if (!user) return [];

    try {
      const messagesRef = collection(db, `users/${user.uid}/chats/${chatId}/messages`);
      // Get messages in order: Question 1, Answer 1, Question 2, Answer 2...
      const q = query(messagesRef, orderBy('createdAt', 'asc'));
      const snapshot = await getDocs(q);

      let allEvents: any[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        // If it's an AI response, it contains the 'content' array with our events
        if (data.role === 'assistant' && Array.isArray(data.content)) {
          allEvents = [...allEvents, ...data.content];
        }
      });

      return allEvents;
    } catch (error) {
      console.error("Failed to load messages:", error);
      return [];
    }
  };

  return { chats, loading, createSession, saveMessage, loadMessages };
};