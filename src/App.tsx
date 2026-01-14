import { useState, useEffect } from 'react';
import { Menu, LogOut } from 'lucide-react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth } from './lib/firebase';
import { useChatHistory } from './hooks/useChatHistory';

import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import AnalysisView from './components/AnalysisView';
import Login from './components/Login';
import type { VideoSession } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [currentSession, setCurrentSession] = useState<VideoSession>({
    id: 'new', 
    videoUrl: null, 
    videoName: '', 
    hash: null, 
    status: 'idle', 
    events: []
  });

  const { chats, createSession, saveMessage, loadMessages } = useChatHistory();

  const handleNewChat = () => {
    setCurrentSession({
      id: 'new',
      videoUrl: null,
      videoName: '',
      hash: null,
      status: 'idle',
      events: []
    });
  };

  const handleSelectChat = async (chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      setCurrentSession({
        id: chat.id,
        videoUrl: chat.previewUrl || null,
        videoName: chat.videoName || '',
        hash: chat.videoHash || null,
        status: 'ready',
        events: []
      });

      const historyEvents = await loadMessages(chatId);
      setCurrentSession(prev => {
        if (prev.id === chatId) {
          return { ...prev, events: historyEvents };
        }
        return prev;
      });
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    signOut(auth);
    // Reset app state
    setCurrentSession(prev => ({ 
      ...prev, 
      status: 'idle', 
      videoUrl: null, 
      events: [] 
    }));
  };

  // --- VIEW 1: LOADING ---
  if (authLoading) {
    return (
      <div className="h-screen w-full bg-[#131314] flex items-center justify-center">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
      </div>
    );
  }

  // --- VIEW 2: LOGIN ---
  if (!user) {
    return <Login />;
  }

  // --- VIEW 3: MAIN APP (No Verification Block) ---
  return (
    <div className="flex h-screen w-full bg-[#131314] text-gray-100 font-sans overflow-hidden">
      
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 w-full h-14 bg-[#1e1f20] border-b border-gray-700 flex items-center justify-between px-4 z-50">
        <div className="flex items-center">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <Menu className="w-6 h-6 text-gray-300" />
          </button>
          <span className="ml-4 font-semibold text-lg tracking-tight">Sakshya AI</span>
        </div>
        <button onClick={handleLogout}>
          <LogOut className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Sidebar */}
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
          currentChatId={currentSession.id}
        />
        
        {/* User Profile Footer */}
        <div className="p-4 border-t border-gray-800 mt-auto bg-[#1e1f20]">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs border border-blue-500/30">
              {user.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="text-xs overflow-hidden">
              <div className="text-white font-medium truncate w-40" title={user.email || ''}>
                {user.email}
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <span>Investigator</span>
                {/* Optional: Small badge just to let them know */}
                {!user.emailVerified && (
                  <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-1.5 rounded border border-yellow-500/20" title="Email not verified">
                    Unverified
                  </span>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 w-full text-gray-400 hover:text-red-400 hover:bg-red-900/10 py-2 px-2 rounded-lg transition-all text-sm group"
          >
            <LogOut className="w-4 h-4 group-hover:text-red-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative pt-14 md:pt-0">
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {currentSession.status === 'idle' ? (
          <ChatInterface 
            session={currentSession} 
            setSession={setCurrentSession}
            onSaveSession={async (prompt, events, downloadUrl) => {
              let chatId = currentSession.id;
              if (chatId === 'new') {
                chatId = await createSession({ ...currentSession, videoUrl: downloadUrl });
                setCurrentSession(prev => ({ ...prev, id: chatId }));
              }
              await saveMessage(chatId, prompt, events);
            }}
          />
        ) : (
          <AnalysisView session={currentSession} setSession={setCurrentSession} onBack={handleNewChat}/>
        )}
      </main>
    </div>
  );
}

export default App;