import React, { useState } from 'react';
import { MessageSquare, Video, Settings, Trash2, AlertTriangle, X, Check, LogOut } from 'lucide-react';

interface ChatItem {
  id: string;
  title: string;
  videoName: string;
  createdAt?: any;
}

interface SidebarProps {
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  onOpenSettings: () => void;
  chats: ChatItem[];
  currentChatId?: string;
  userEmail?: string | null;
  onLogout: () => void;
  onDeleteChat: (chatId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  onNewChat, onSelectChat, onOpenSettings, 
  chats = [], currentChatId, userEmail, onLogout, onDeleteChat 
}) => {
  
  // Local state for the delete confirmation logic
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);

  const handleDeleteClick = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation(); // Prevent opening the chat when clicking delete
    setChatToDelete(chatId);
  };

  const confirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (chatToDelete) {
      onDeleteChat(chatToDelete);
      setChatToDelete(null);
    }
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setChatToDelete(null);
  };

  return (
    <div className="flex flex-col h-full p-4 pt-20 md:pt-4 relative">
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
                  group flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border relative
                  ${currentChatId === chat.id 
                    ? 'bg-[#282a2c] border-gray-600 text-white' 
                    : 'border-transparent text-gray-400 hover:bg-[#1e1f20] hover:text-gray-200'
                  }
                `}
              >
                {/* Icon */}
                <div className={`mt-1 ${currentChatId === chat.id ? 'text-blue-400' : 'text-gray-600 group-hover:text-gray-400'}`}>
                    <MessageSquare className="w-4 h-4" />
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0 pr-6"> {/* Added padding-right to avoid text hitting the button */}
                  <h3 className="text-sm font-medium truncate">
                    {chat.title || "Untitled Case"}
                  </h3>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-600 group-hover:text-gray-500">
                    <Video className="w-3 h-3" />
                    <span className="truncate">{chat.videoName}</span>
                  </div>
                </div>

                {/* DELETE BUTTON / CONFIRMATION OVERLAY */}
                {chatToDelete === chat.id ? (
                    // Confirmation State (Red Overlay)
                    <div className="absolute inset-0 bg-red-900/90 rounded-lg flex items-center justify-between px-3 animate-fade-in z-10" onClick={(e) => e.stopPropagation()}>
                        <span className="text-xs text-white font-medium flex items-center gap-2">
                            <AlertTriangle className="w-3 h-3 text-yellow-400" />
                            Delete?
                        </span>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={confirmDelete}
                                className="p-1 bg-red-600 hover:bg-red-500 text-white rounded shadow-sm transition-colors"
                            >
                                <Check className="w-3.5 h-3.5" />
                            </button>
                            <button 
                                onClick={cancelDelete}
                                className="p-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded shadow-sm transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                ) : (
                    // Default State (Trash Icon visible on hover)
                    <button
                        onClick={(e) => handleDeleteClick(e, chat.id)}
                        className={`
                            absolute right-2 top-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md
                            ${currentChatId === chat.id 
                                ? 'text-gray-400 hover:text-red-400 hover:bg-white/10' 
                                : 'text-gray-500 hover:text-red-400 hover:bg-black/20'
                            }
                        `}
                        title="Delete Case"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* User Footer (Keep same) */}
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
        <button onClick={onOpenSettings} className="flex items-center gap-2 w-full text-gray-400 hover:text-white hover:bg-[#282a2c] py-2 px-2 rounded-lg transition-all text-sm">
          <Settings className="w-4 h-4" /><span>Manage Account</span>
        </button>
        <button 
  onClick={onLogout} 
  className="flex items-center gap-2 w-full text-gray-400 hover:text-red-400 hover:bg-red-900/10 py-2 px-2 rounded-lg transition-all text-sm group"
>
  <LogOut className="w-4 h-4 group-hover:text-red-400" />
  <span className="group-hover:text-red-400">Sign Out</span>
</button>
      </div>
    </div>
  );
};

export default Sidebar;