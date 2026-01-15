import React from 'react';
import { MessageSquare, Video } from 'lucide-react';

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
  chats: ChatItem[];
  currentChatId?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ onNewChat, onSelectChat, chats = [], currentChatId }) => {
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
      <div className="flex-1 overflow-y-auto">
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

      {/* User Footer (Optional) */}
      <div className="mt-auto pt-4 border-t border-gray-800">
        <div className="text-xs text-gray-600 text-center">
            Secured by Firebase & Gemini
        </div>
      </div>
    </div>
  );
};

export default Sidebar;