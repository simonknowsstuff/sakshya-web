import { useState } from 'react';
import { Menu, Plus } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import AnalysisView from './components/AnalysisView';
import type { VideoSession } from './types';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [currentSession, setCurrentSession] = useState<VideoSession>({
    id: 'new-session',
    videoUrl: null,
    videoName: '',
    hash: null,
    status: 'idle',
    events: []
  });

  const backToChat = () => {
    setCurrentSession(prev => ({
      ...prev,
      status: 'idle',      // <--- This is the magic switch
      videoUrl: null,      // Optional: clear video if you want a fresh start
      events: []           // Optional: clear old results
    }));
  };

  return (
    // 1. Main Container: Full screen, Dark Gemini-like background
    <div className="flex h-screen w-full bg-[#131314] text-gray-100 font-sans overflow-hidden">
      
      {/* 2. Mobile Header (Visible only on small screens) */}
      <div className="md:hidden fixed top-0 left-0 w-full h-14 bg-[#1e1f20] border-b border-gray-700 flex items-center px-4 z-50">
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          <Menu className="w-6 h-6 text-gray-300" />
        </button>
        <span className="ml-4 font-semibold text-lg tracking-tight">Sakshya AI</span>
      </div>

      {/* 3. Left Sidebar */}
      {/* On Desktop: Always visible (w-64) */}
      {/* On Mobile: Slides in based on isSidebarOpen state */}
      <aside 
        className={`
          fixed md:relative z-40 h-full w-72 bg-[#1e1f20] border-r border-gray-700 transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        <Sidebar 
          onNewChat={() => console.log("Reset session here")} 
        />
      </aside>

      {/* 4. Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative pt-14 md:pt-0">
        {/* Overlay for mobile when sidebar is open */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {currentSession.status==='idle'?(
          <ChatInterface session={currentSession} setSession={setCurrentSession}/>
        ):(
          <AnalysisView session={currentSession} setSession={setCurrentSession} onBack={backToChat}/>
        )}
      </main>
    </div>
  );
}

export default App;