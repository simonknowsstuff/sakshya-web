import { useState, useEffect } from 'react';
import { 
  collection, query, orderBy, addDoc, onSnapshot, serverTimestamp, doc, setDoc, getDocs
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; 
import { db } from '../lib/firebase';
import { VideoSession } from '../types';

export const useChatHistory = () => {
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const chatsRef = collection(db, `users/${user.uid}/chats`);
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

        return () => unsubscribeFirestore();
      } else {
        setChats([]);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []); 

  // --- Helpers ---

  const createSession = async (sessionData: VideoSession, modelId: string = 'gemini-2.5-flash') => {
    const user = auth.currentUser;
    if (!user) throw new Error("Must be logged in to save history");

    const chatRef = await addDoc(collection(db, `users/${user.uid}/chats`), {
      videoName: sessionData.videoName,
      videoHash: sessionData.hash,
      previewUrl: sessionData.videoUrl,
      model: modelId,
      createdAt: serverTimestamp(),
      title: "New Investigation" 
    });

    return chatRef.id;
  };

  const saveMessage = async (chatId: string, prompt: string, aiEvents: any[]) => {
    const user = auth.currentUser;
    if (!user) return;

    const messagesRef = collection(db, `users/${user.uid}/chats/${chatId}/messages`);
    
    // 1. Save User Prompt
    await addDoc(messagesRef, {
      role: 'user',
      content: prompt,
      createdAt: serverTimestamp()
    });

    // 2. Save AI Response (The Events)
    await addDoc(messagesRef, {
      role: 'assistant',
      content: aiEvents, // This is an array of objects
      createdAt: serverTimestamp()
    });

    // Update Title
    const chatDocRef = doc(db, `users/${user.uid}/chats/${chatId}`);
    await setDoc(chatDocRef, { title: prompt }, { merge: true });
  };

  // --- THE FIX IS HERE ---
  const loadMessages = async (chatId: string) => {
    const user = auth.currentUser;
    if (!user) return [];

    try {
      const messagesRef = collection(db, `users/${user.uid}/chats/${chatId}/messages`);
      const q = query(messagesRef, orderBy('createdAt', 'asc'));
      const snapshot = await getDocs(q);


      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            // Convert 'assistant' -> 'ai' for the UI
            role: data.role === 'assistant' ? 'ai' : data.role,
            // If user, content is text. If AI, content is events data.
            text: data.role === 'user' ? data.content : undefined, 
            events: data.role === 'assistant' ? data.content : undefined,
            createdAt: data.createdAt
        };
      });

    } catch (error) {
      console.error("Failed to load messages:", error);
      return [];
    }
  };

  return { chats, loading, createSession, saveMessage, loadMessages };
};