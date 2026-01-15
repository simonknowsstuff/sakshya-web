import { useState, useEffect } from 'react';
import { 
  collection, query, orderBy, addDoc, onSnapshot, serverTimestamp, doc, setDoc, getDocs,deleteDoc
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

  const fetchSaved=async(chatId:string)=>{
    const user = auth.currentUser;
    if (!user) return [];

    try {
      const savedRef = collection(db, `users/${user.uid}/chats/${chatId}/saved`);
      const snapshot = await getDocs(savedRef);
      
      // Return array of { id: docId, ...eventData }
      return snapshot.docs.map(doc => ({
        docId: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error("Error fetching saved events:", error);
      return [];
    }
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

    const chatDocRef = doc(db, `users/${user.uid}/chats/${chatId}`);
    await setDoc(chatDocRef, { title: prompt }, { merge: true });
  };

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
            role: data.role === 'assistant' ? 'ai' : data.role,
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

  const saveSpecificEvent = async (chatId: string, eventData: any) => {
    const user = auth.currentUser;
    if (!user) throw new Error("No user");

    const savedRef = collection(db, `users/${user.uid}/chats/${chatId}/saved`);
    const docRef = await addDoc(savedRef, {
        ...eventData,
        savedAt: serverTimestamp()
    });
    return docRef.id; // <--- Return the ID so UI can track it
  };

  const deleteSavedEvent = async (chatId: string, docId: string) => {
    const user = auth.currentUser;
    if (!user) return;

    const docRef = doc(db, `users/${user.uid}/chats/${chatId}/saved/${docId}`);
    await deleteDoc(docRef);
  };

  return { chats, loading, createSession, saveMessage, loadMessages, saveSpecificEvent,deleteSavedEvent,fetchSaved };
};