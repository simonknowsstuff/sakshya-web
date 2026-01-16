import { useState, useEffect, useRef } from 'react';
import { Menu, Upload } from 'lucide-react';
import { onAuthStateChanged, User, signOut, applyActionCode, reload } from 'firebase/auth';
import { auth, storage } from './lib/firebase';
import { useChatHistory } from './hooks/useChatHistory';

import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import AnalysisView from './components/AnalysisView';
import Login from './components/Login';
import EmailVerification from './components/EmailVerification';
import AccountSettings from './components/AccountSettings'; 
import type { VideoSession, ChatMessage } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [verificationRefresh, setVerificationRefresh] = useState(false);
  const [showSettings, setShowSettings] = useState(false); 
  
  // --- GLOBAL DRAG & DROP STATE ---
  const [isDragging, setIsDragging] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const dragCounter = useRef(0);
  
  const [currentSession, setCurrentSession] = useState<VideoSession>({
    id: 'new-session', videoUrl: null, videoName: '', hash: null, status: 'idle', events: [], gcsUri: undefined, chatHistory: [] 
  });
  
  // Destructure deleteChat (Contributor's change)
  const { chats, createSession, saveMessage, loadMessages, saveSpecificEvent, deleteSavedEvent, fetchSaved, deleteChat } = useChatHistory();

  // --- GLOBAL DRAG HANDLERS ---
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      // Switch to Chat Interface immediately if dropping a new file
      if (currentSession.status !== 'idle') {
         setCurrentSession(prev => ({ ...prev, status: 'idle' }));
      }
      setDroppedFile(file);
    }
  };

  const extractHashFromUrl = (url: string | null) => {
    if (!url) return null;
    const match = url.match(/evidence%2F(.*?)\.mp4/);
    return match ? match[1] : null;
  };

  const handleNewChat = () => {
    setCurrentSession({
      id: 'new', videoUrl: null, videoName: '', hash: null, status: 'idle', events: [], chatHistory: [], gcsUri: undefined
    });
  };

  const handleSelectChat = async (chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      const finalHash = chat.videoHash || extractHashFromUrl(chat.previewUrl);
      let reconstructedGcsUri = undefined;
      if (finalHash) {
         const bucketName = storage.app.options.storageBucket;
         reconstructedGcsUri = `gs://${bucketName}/evidence/${finalHash}.mp4`;
      }
      setCurrentSession({
        id: chat.id,
        videoUrl: chat.previewUrl || null,
        videoName: chat.videoName || 'Evidence Video',
        hash: finalHash,
        status: 'idle',
        events: [], 
        chatHistory: [], 
        gcsUri: reconstructedGcsUri 
      });
      const rawMessages = await loadMessages(chatId);
      
      const formattedMessages: ChatMessage[] = rawMessages.map((msg: any) => {
        let role = msg.role;
        if (!role) {
            if (msg.events || msg.analysisData) role = 'ai';
            else role = 'user';
        }
        let content = msg.text || msg.prompt || msg.message || msg.content;
        if (!content && role === 'ai') {
            const eventCount = (msg.events || msg.analysisData?.events || []).length;
            content = msg.summary || msg.description || msg.analysisData?.summary || `Found ${eventCount} events.`;
        }
        return {
            id: msg.id || Math.random().toString(36).substr(2, 9),
            role: role as 'user' | 'ai',
            text: content || "", 
            timestamp: msg.createdAt?.toMillis ? msg.createdAt.toMillis() : (msg.timestamp || Date.now()),
            analysisData: msg.analysisData || (msg.events ? {
                events: msg.events,
                summary: msg.summary || "Analysis Results",
                confidence: 1.0
            } : undefined)
        };
      });

      setCurrentSession(prev => {
        if (prev.id === chatId) { return { ...prev, chatHistory: formattedMessages }; }
        return prev;
      });
    }
  };

  useEffect(() => {
    const handleEmailAction = async () => {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const oobCode = params.get('oobCode');
      if (mode === 'verifyEmail' && oobCode) {
        try {
          await applyActionCode(auth, oobCode);
          if (auth.currentUser) await reload(auth.currentUser);
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error: any) {}
      }
    };
    handleEmailAction();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    signOut(auth);
    handleNewChat();
  };

  if (authLoading) return <div className="h-screen w-full bg-[#131314] flex items-center justify-center"><div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" /></div>;

  if (!user) return <Login />;

  if (!user.emailVerified) {
    return (
      <EmailVerification 
        user={user}
        onVerified={() => setVerificationRefresh(!verificationRefresh)}
      />
    );
  }

  return (
    <div 
      // ATTACH GLOBAL DRAG LISTENERS
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex h-screen w-full bg-[#131314] text-gray-100 font-sans overflow-hidden relative"
    >
      
      {/* GLOBAL DRAG OVERLAY */}
      {isDragging && (
        <div className="absolute inset-0 z-[100] bg-blue-500/10 backdrop-blur-sm border-4 border-dashed border-blue-500 flex items-center justify-center animate-fade-in pointer-events-none">
          <div className="bg-[#1e1f20] px-8 py-4 rounded-full text-blue-400 font-bold text-xl shadow-2xl flex items-center gap-3 animate-bounce">
            <Upload className="w-8 h-8" />
            Drop Evidence Video Anywhere
          </div>
        </div>
      )}

      {showSettings && (
        <AccountSettings 
          user={user} 
          onClose={() => setShowSettings(false)} 
          onResetSession={handleNewChat} // Re-added Reset Session for safety
        />
      )}

      <div className="md:hidden fixed top-0 left-0 w-full h-14 bg-[#1e1f20] border-b border-gray-700 flex items-center justify-between px-4 z-50">
        <div className="flex items-center">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <Menu className="w-6 h-6 text-gray-300" />
          </button>
          <span className="ml-4 font-semibold text-lg tracking-tight">Sakshya AI</span>
        </div>
        <button onClick={() => setShowSettings(true)}></button>
      </div>

      <aside 
        className={`
          fixed md:relative z-40 h-full w-72 bg-[#1e1f20] border-r border-gray-700 transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          flex flex-col
        `}
      >
        <Sidebar 
          onNewChat={handleNewChat} 
          chats={chats}
          onSelectChat={handleSelectChat}
          onOpenSettings={() => setShowSettings(true)}
          currentChatId={currentSession.id}
          userEmail={user.email}
          onLogout={handleLogout}
          onDeleteChat={deleteChat} // Preserved Contributor's Delete Logic
        />
      </aside>

      <main className="flex-1 flex flex-col h-full relative pt-14 md:pt-0">
        {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} />}

        {currentSession.status === 'idle' ? (
          <ChatInterface 
            session={currentSession} 
            setSession={setCurrentSession}
            // PASS DROPPED FILE PROP
            droppedFile={droppedFile}
            onFileAck={() => setDroppedFile(null)}
            onSaveSession={async (prompt, events, downloadUrl, modelId, videoName, videoHash) => {
              let chatId = currentSession.id;
              if (chatId === 'new' || chatId === 'new-session') {
                chatId = await createSession({ ...currentSession, videoUrl: downloadUrl, videoName, hash: videoHash }, modelId);
                setCurrentSession(prev => ({ ...prev, id: chatId }));
              }
              await saveMessage(chatId, prompt, events);
            }}
          />
        ) : (
          <AnalysisView 
            session={currentSession} 
            setSession={setCurrentSession} 
            onBack={() => setCurrentSession(prev => ({ ...prev, status: 'idle' }))} 
            onSaveSingleEvent={async(event) => saveSpecificEvent(currentSession.id, event)}
            onDeleteSingleEvent={async(docId) => deleteSavedEvent(currentSession.id, docId)}
            onFetchSavedEvents={async() => fetchSaved(currentSession.id)}
            onSaveEvents={ async (prompt, newEvents) => {
              await saveMessage(currentSession.id, prompt, newEvents);
              setCurrentSession(prev => ({
                ...prev,
                chatHistory: [
                    ...(prev.chatHistory || []),
                    { id: Date.now().toString(), role: 'user', text: prompt, timestamp: Date.now() },
                    { 
                        id: (Date.now() + 1).toString(), 
                        role: 'ai', 
                        text: `Found ${newEvents.length} new events.`, 
                        timestamp: Date.now(),
                        analysisData: { events: newEvents, summary: 'Follow-up Analysis', confidence: 1.0 }
                    }
                ]
              }));
            }}
          />
        )}
      </main>
    </div>
  );
}

export default App;