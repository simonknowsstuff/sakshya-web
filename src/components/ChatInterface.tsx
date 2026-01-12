import React, { useState, useRef } from 'react';
import { Upload, X, FileVideo, ArrowUp, Loader2 } from 'lucide-react';
import type { VideoSession } from '../types';
import { useFileHash } from '../hooks/useFileHash';

interface ChatInterfaceProps {
  session: VideoSession;
  setSession: React.Dispatch<React.SetStateAction<VideoSession>>;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ session, setSession }) => {
  const [prompt, setPrompt] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use our custom hook
  const { isHashing, generateHash } = useFileHash();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !prompt) return;

    try {
      // 1. Generate Hash (Client-side evidence locking)
      const hash = await generateHash(selectedFile);
      
      // 2. Create Object URL for immediate preview (Zero-copy feel)
      const objectUrl = URL.createObjectURL(selectedFile);

      // 3. Update Global State
      setSession(prev => ({
        ...prev,
        status: 'analyzing', // This triggers the UI switch (we'll build next)
        videoUrl: objectUrl,
        videoName: selectedFile.name,
        hash: hash,
        events: [] // Reset events
      }));

      // NOTE: Here is where you would normally trigger the Firebase Upload
      console.log(`Ready to upload. Hash: ${hash}, Prompt: ${prompt}`);

    } catch (err) {
      console.error("Error preparing session:", err);
    }
  };

  // If the session is already active (video loaded), we will show the Player later.
  // For now, let's handle the "Empty State" (Upload Screen).
  if (session.status !== 'idle') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" />
        <h2 className="text-xl text-gray-200">Analyzing Evidence...</h2>
        <p className="text-sm mt-2 font-mono text-gray-500">SHA-256: {session.hash || 'Calculating...'}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full px-4">
      {/* 1. Header Area */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
          </div>
          <h1 className="text-3xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
            Sakshya AI
          </h1>
          <p className="text-gray-400 text-lg">
            Upload CCTV footage. Describe the event. <br/> 
            <span className="text-gray-500 text-base">Instant retrieval powered by Gemini 1.5 Pro</span>
          </p>
        </div>
      </div>

      {/* 2. Input Area (Fixed at bottom) */}
      <div className="flex-none pb-8 pt-4">
        <form onSubmit={handleSubmit} className="relative bg-[#1e1f20] rounded-2xl border border-gray-700 focus-within:border-gray-600 transition-colors">
          
          {/* Selected File Preview Badge */}
          {selectedFile && (
            <div className="absolute -top-12 left-0 flex items-center gap-2 bg-[#282a2c] text-sm text-gray-200 px-3 py-2 rounded-lg border border-gray-700 shadow-sm animate-fade-in">
              <FileVideo className="w-4 h-4 text-blue-400" />
              <span className="truncate max-w-[200px]">{selectedFile.name}</span>
              <button 
                type="button" 
                onClick={() => setSelectedFile(null)}
                className="hover:text-red-400 ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex flex-col p-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the event (e.g., 'A white SUV arriving at the gate at night')..."
              className="w-full bg-transparent text-gray-100 placeholder-gray-500 resize-none focus:outline-none h-14"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            
            <div className="flex justify-between items-center mt-2">
              <input
                type="file"
                accept="video/*"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded-full transition-colors"
                title="Upload Video"
              >
                <Upload className="w-5 h-5" />
              </button>

              <button
                type="submit"
                disabled={!prompt || !selectedFile || isHashing}
                className={`p-2 rounded-lg transition-all ${
                  prompt && selectedFile && !isHashing
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20' 
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isHashing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUp className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </form>
        <p className="text-center text-xs text-gray-600 mt-3">
          Evidence is cryptographically hashed (SHA-256) locally before analysis.
        </p>
      </div>
    </div>
  );
};

export default ChatInterface;