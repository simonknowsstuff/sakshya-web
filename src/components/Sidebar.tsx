import React from 'react';
import { MessageSquare, Video, Settings } from 'lucide-react';

// Define what a "Chat" looks like for the UI
interface ChatItem {
  id: string;
  title: string;
  videoName: string;
  createdAt?: any;
}

interface SidebarProps {
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  onOpenSettings: () => void; // <--- NEW PROP
  chats: ChatItem[];
  currentChatId?: string;
  userEmail?: string | null;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  onNewChat, onSelectChat, onOpenSettings, 
  chats = [], currentChatId, userEmail, onLogout 
}) => {
  return (
    <div className="flex flex-col h-full p-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-blue-400 mb-1">Sakshya AI</h1>
        <p className="text-xs text-gray-500">Evidence Retrieval System</p>
      </div>
      
      {/* New Chat Button */}
      <button 
        onClick={onNewChat}
        className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-500 text-white py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-900/20 text-sm font-medium mb-8"
      >
        <span>+ New Investigation</span>
      </button>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 px-2">
          Recent Cases
        </p>
        
        <div className="space-y-2">
          {chats.length === 0 ? (
            <p className="text-sm text-gray-600 px-2 italic">No cases found.</p>
          ) : (
            chats.map((chat) => (
              <div 
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`
                  group flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border
                  ${currentChatId === chat.id 
                    ? 'bg-[#282a2c] border-gray-600 text-white' 
                    : 'border-transparent text-gray-400 hover:bg-[#1e1f20] hover:text-gray-200'
                  }
                `}
              >
                <div className={`mt-1 ${currentChatId === chat.id ? 'text-blue-400' : 'text-gray-600 group-hover:text-gray-400'}`}>
                    <MessageSquare className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium truncate">
                    {chat.title || "Untitled Case"}
                  </h3>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-600 group-hover:text-gray-500">
                    <Video className="w-3 h-3" />
                    <span className="truncate">{chat.videoName}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* User Footer */}
      <div className="mt-auto pt-4 border-t border-gray-800 space-y-2">
        <div className="flex items-center gap-3 px-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs border border-blue-500/30">
              {userEmail?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="text-xs overflow-hidden">
              <div className="text-white font-medium truncate w-40" title={userEmail || ''}>
                {userEmail}
              </div>
              <div className="text-gray-500">Investigator</div>
            </div>
        </div>

        {/* SETTINGS BUTTON */}
        <button 
          onClick={onOpenSettings}
          className="flex items-center gap-2 w-full text-gray-400 hover:text-white hover:bg-[#282a2c] py-2 px-2 rounded-lg transition-all text-sm"
        >
          <Settings className="w-4 h-4" />
          <span>Manage Account</span>
        </button>

        {/* LOGOUT BUTTON */}
        <button 
          onClick={onLogout}
          className="flex items-center gap-2 w-full text-gray-400 hover:text-red-400 hover:bg-red-900/10 py-2 px-2 rounded-lg transition-all text-sm group"
        >
          {/* Using a logout icon here or text */}
          <span className="group-hover:text-red-400">Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;