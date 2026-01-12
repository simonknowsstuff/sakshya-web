import React from 'react';

const Sidebar = ({ onNewChat }: { onNewChat: () => void }) => {
  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-blue-400 mb-1">Sakshya AI</h1>
        <p className="text-xs text-gray-500">Evidence Retrieval System</p>
      </div>
      
      <button 
        onClick={onNewChat}
        className="flex items-center gap-2 w-full bg-[#282a2c] hover:bg-[#37393b] text-gray-200 py-3 px-4 rounded-full transition-colors text-sm font-medium border border-gray-700"
      >
        <span>+ New Investigation</span>
      </button>

      <div className="mt-8">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Cases</p>
        {/* We will map history items here later */}
        <div className="text-sm text-gray-400 hover:text-white cursor-pointer py-2">
           Case #2024-001 (CCTV)
        </div>
      </div>
    </div>
  );
};

export default Sidebar;