import React, { useState, useRef } from 'react';
import { Upload, X, FileVideo, ArrowUp, Loader2, AlertCircle } from 'lucide-react';
import type { VideoSession } from '../types';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes } from 'firebase/storage';
import { functions, storage } from '../lib/firebase'; // Import from your centralized file
import { useFileHash } from '../hooks/useFileHash';

interface ChatInterfaceProps {
  session: VideoSession;
  setSession: React.Dispatch<React.SetStateAction<VideoSession>>;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ session, setSession }) => {
  const [prompt, setPrompt] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { isHashing, generateHash } = useFileHash();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorMsg(null);
    }
  };

  const parseTimestampToSeconds = (timeStr: string | number): number => {
    if (typeof timeStr === 'number') return timeStr;
    if (!timeStr) return 0;
    
    // Handle "MM:SS" or "HH:MM:SS"
    const parts = timeStr.toString().split(':').map(Number);
    if (parts.some(isNaN)) return 0; // Safety check

    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
    if (parts.length === 2) return parts[0] * 60 + parts[1]; // MM:SS
    return parts[0]; // Just seconds
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !prompt) return;

    try {
      setErrorMsg(null);

      // 1. Generate Hash
      const hash = await generateHash(selectedFile);
      const objectUrl = URL.createObjectURL(selectedFile);

      // Update State: UPLOADING
      setSession(prev => ({
        ...prev,
        status: 'uploading', 
        videoUrl: objectUrl,
        videoName: selectedFile.name,
        hash: hash,
        events: []
      }));

      // 2. Upload to Firebase Storage
      // Naming convention: evidence/{hash}.mp4 (Prevents duplicates)
      const storageRef = ref(storage, `evidence/${hash}.mp4`);
      
      console.log("Step 1: Uploading to Storage...");
      await uploadBytes(storageRef, selectedFile);
      
      // 3. Construct gs:// URI
      // This is the Zero-Copy link for Vertex AI
      const bucketName = storageRef.bucket; 
      const gcsUri = `gs://${bucketName}/evidence/${hash}.mp4`;

      // Update State: ANALYZING
      setSession(prev => ({ ...prev, status: 'analyzing' }));
      console.log("Step 2: Calling Gemini...");

      // 4. Call Cloud Function
      const getTimestamps = httpsCallable(functions, 'getTimestampsFromGemini');
      const response = await getTimestamps({ 
        storageUri: gcsUri, 
        userPrompt: prompt 
      });

      // 5. Handle Results
      const data = response.data as any; // Type assertion since we know the schema
      
      if (data.timestamps) {
        setSession(prev => ({
          ...prev,
          status: 'ready',
          events: data.timestamps.map((t: any) => ({
            // Normalize the data for our frontend types
            timestamp: parseTimestampToSeconds(t.start || t.timestamp || t.from),
            description: t.description || "Event Detected",
            confidence: 1.0 // Default since Flash doesn't always return confidence
          }))
        }));
      } else {
        throw new Error("Invalid response format from AI");
      }

    } catch (err: any) {
      console.error("Analysis failed:", err);
      setErrorMsg(err.message || "Failed to analyze video");
      setSession(prev => ({ ...prev, status: 'idle' }));
    }
  };

  // If the session is already active (video loaded), we will show the Player later.
  // For now, let's handle the "Empty State" (Upload Screen).
  // MOVED: The Loading state and Player view are now handled by AnalysisView.tsx in App.tsx
  if (session.status !== 'idle') {
    return null; // Should be handled by parent
  }

  // --- VIEW 3: EMPTY STATE (Upload Form) ---
  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full px-4">
      {/* Header Area */}
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

      {/* Input Area */}
      <div className="flex-none pb-8 pt-4">
        {errorMsg && (
            <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4" />
                {errorMsg}
            </div>
        )}

        <form onSubmit={handleSubmit} className="relative bg-[#1e1f20] rounded-2xl border border-gray-700 focus-within:border-gray-600 transition-colors">
          
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