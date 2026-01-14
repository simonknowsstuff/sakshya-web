import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, X, FileVideo, ArrowUp, Loader2, AlertCircle, 
  MessageSquare, User, Bot, PlayCircle, ChevronRight,
  Zap, Brain, ChevronUp 
} from 'lucide-react';
import type { VideoSession, ChatMessage } from '../types';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { functions, storage } from '../lib/firebase';
import { useFileHash } from '../hooks/useFileHash';

interface ChatInterfaceProps {
  session: VideoSession;
  setSession: React.Dispatch<React.SetStateAction<VideoSession>>;
  // FIX 1: Update interface to accept 6 arguments
  onSaveSession?: (
    prompt: string, 
    events: any[], 
    downloadUrl: string, 
    modelId: string, 
    videoName: string, 
    videoHash: string
  ) => void; 
}


// --- CONSTANTS ---
const MODELS = [
  { id: 'gemini-2.5-flash', name: 'Flash', description: 'Fast & Efficient', icon: Zap, color: 'text-yellow-400' },
  { id: 'gemini-2.5-pro', name: 'Pro', description: 'Complex Reasoning', icon: Brain, color: 'text-purple-400' },
];

const ChatInterface: React.FC<ChatInterfaceProps> = ({ session, setSession, onSaveSession }) => {
  // State
  const [prompt, setPrompt] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Model Selector State
  const [selectedModelId, setSelectedModelId] = useState(MODELS[0].id);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);

  // Refs & Hooks
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isHashing, generateHash } = useFileHash();

  const currentModel = MODELS.find(m => m.id === selectedModelId) || MODELS[0];

  // Scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session.chatHistory]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorMsg(null);
    }
  };

  const parseTimestampToSeconds = (timeStr: string | number): number => {
    if (typeof timeStr === 'number') return timeStr;
    if (!timeStr) return 0;
    const parts = timeStr.toString().split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt) return;
    
    // Check: Do we have a video? (Either currently selected OR previously uploaded)
    if (!selectedFile && !session.gcsUri) {
        setErrorMsg("Please upload a video to start the investigation.");
        return;
    }

    const userMsgId = Date.now().toString();
    const aiMsgId = (Date.now() + 1).toString();

    // 1. Optimistically Add User Message
    const newHistory: ChatMessage[] = [
        ...(session.chatHistory || []),
        { id: userMsgId, role: 'user', text: prompt, timestamp: Date.now() },
        { id: aiMsgId, role: 'ai', text: '', timestamp: Date.now(), isLoading: true }
    ];
    
    setSession(prev => ({ ...prev, chatHistory: newHistory }));
    setPrompt('');
    setIsProcessing(true);
    setErrorMsg(null);
    setIsModelMenuOpen(false);

    try {
        let currentGcsUri = session.gcsUri;
        let currentDownloadUrl = session.videoUrl;
        let currentVideoName = session.videoName;
        let currentHash = session.hash;

        // 2. Upload Video (ONLY if this is the first turn and file is selected)
        if (selectedFile && !currentGcsUri) {
            console.log("Hashing file...");
            currentHash = await generateHash(selectedFile);
            currentVideoName = selectedFile.name;
            
            const storageRef = ref(storage, `evidence/${currentHash}.mp4`);
            
            console.log("Uploading to Firebase...");
            await uploadBytes(storageRef, selectedFile);
            currentDownloadUrl = await getDownloadURL(storageRef);
            
            const bucketName = storageRef.bucket;
            currentGcsUri = `gs://${bucketName}/evidence/${currentHash}.mp4`;

            // Update session so we don't upload again
            setSession(prev => ({
                ...prev,
                videoUrl: currentDownloadUrl,
                videoName: currentVideoName,
                hash: currentHash,
                gcsUri: currentGcsUri
            }));
            
            setSelectedFile(null);
        }

        // 3. Call Gemini
        console.log(`Analyzing with prompt: "${prompt}" using ${selectedModelId}`);
        const getTimestamps = httpsCallable(functions, 'getTimestampsFromGemini');
        const response = await getTimestamps({ 
            storageUri: currentGcsUri, 
            userPrompt: prompt,
            model: selectedModelId 
        });

        const data = response.data as any;

        // 4. Process Response
        if (data.timestamps) {
            const formattedEvents = data.timestamps.map((t: any) => ({
                fromTimestamp: parseTimestampToSeconds(t.start || t.timestamp || t.from),
                toTimestamp: parseTimestampToSeconds(t.end || t.to),
                summary: t.description || t.summary || "Event Detected",
                confidence: t.confidence || 0.9
            }));

            // Update AI Message in history
            setSession(prev => ({
                ...prev,
                chatHistory: prev.chatHistory?.map(msg => 
                    msg.id === aiMsgId 
                        ? { 
                            ...msg, 
                            isLoading: false, 
                            text: data.description || `Found ${formattedEvents.length} relevant events.`,
                            analysisData: {
                                events: formattedEvents,
                                summary: data.description,
                                confidence: 0.9
                            }
                        }
                        : msg
                )
            }));
            
            // FIX 2: Pass all 6 arguments to the save function
            if (onSaveSession && currentDownloadUrl) {
                onSaveSession(
                    prompt, 
                    formattedEvents, 
                    currentDownloadUrl, 
                    selectedModelId,
                    currentVideoName,
                    currentHash || ""
                );
            }

        } else {
            throw new Error("AI returned invalid format");
        }

    } catch (err: any) {
        console.error(err);
        setSession(prev => ({
            ...prev,
            chatHistory: prev.chatHistory?.map(msg => 
                msg.id === aiMsgId 
                    ? { ...msg, isLoading: false, text: "Failed to analyze video. Please try again." }
                    : msg
            )
        }));
        setErrorMsg("Connection failed. See console.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleViewResults = (events: any[], description: string) => {
      setSession(prev => ({
          ...prev,
          status: 'ready',
          events: events,
          description: description
      }));
  };

  const hasActiveVideo = !!session.gcsUri;
  const history = session.chatHistory || [];
  console.log(session);
  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full px-4 relative">
      
      {/* 1. CHAT HISTORY AREA */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6 min-h-0 custom-scrollbar" ref={scrollRef}>
        
        {/* Empty State */}
        {history.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full space-y-6 opacity-60">
                <div className="w-20 h-20 rounded-3xl bg-blue-500/10 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]" />
                </div>
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-200">Sakshya AI</h2>
                    <p className="text-gray-500 mt-2">Upload footage. Start the investigation.</p>
                </div>
            </div>
        )}

        {/* Bubbles */}
        {history.map((msg, index) => (
            <div key={`${msg.id}-${index}`} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 
                    ${msg.role === 'user' ? 'bg-blue-600' : 'bg-green-600'}`}>
                    {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                </div>

                <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed 
                        ${msg.role === 'user' 
                            ? 'bg-blue-600/20 text-blue-100 rounded-tr-sm border border-blue-500/20' 
                            : 'bg-[#282a2c] text-gray-200 rounded-tl-sm border border-gray-700'
                        }`}>
                        
                        {msg.isLoading ? (
                            <div className="flex items-center gap-2 text-gray-400">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Analyzing evidence...</span>
                            </div>
                        ) : (
                            <p>{msg.text}</p>
                        )}
                    </div>

                    {/* Interactive Result Card */}
                    {msg.role === 'ai' && msg.analysisData && (
                        <div className="mt-2 w-full max-w-sm">
                            <button 
                                onClick={() => handleViewResults(msg.analysisData!.events, msg.analysisData!.summary)}
                                className="w-full flex items-center gap-3 p-3 bg-[#1e1f20] hover:bg-[#252628] border border-gray-700 hover:border-blue-500/50 rounded-xl transition-all group text-left"
                            >
                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                                    <PlayCircle className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-medium text-gray-200">View Timeline</h4>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {msg.analysisData.events.length} events found • {Math.round(msg.analysisData.confidence * 100)}% match
                                    </p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-blue-400" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        ))}
      </div>

      {/* 2. INPUT AREA */}
      <div className="pb-6 pt-4 bg-[#131314]">
        {errorMsg && (
            <div className="mb-3 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20 animate-fade-in">
                <AlertCircle className="w-4 h-4" />
                {errorMsg}
            </div>
        )}

        <form onSubmit={handleSubmit} className="relative bg-[#1e1f20] rounded-2xl border border-gray-700 focus-within:border-gray-600 transition-colors shadow-2xl">
          
          {/* Active Context Indicators */}
          {hasActiveVideo && !selectedFile && (
              <div className="absolute -top-10 left-0 flex items-center gap-2 bg-[#1e1f20] border border-green-500/30 text-xs text-green-400 px-3 py-1.5 rounded-full shadow-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Context Active: <span className="text-gray-300 max-w-[150px] truncate">{session.videoName}</span>
              </div>
          )}

          {selectedFile && (
            <div className="absolute -top-12 left-0 flex items-center gap-2 bg-[#282a2c] text-sm text-gray-200 px-3 py-2 rounded-lg border border-gray-700 shadow-sm animate-fade-in">
              <FileVideo className="w-4 h-4 text-blue-400" />
              <span className="truncate max-w-[200px]">{selectedFile.name}</span>
              <button 
                type="button" 
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
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
              placeholder={hasActiveVideo 
                  ? "Ask another question about this footage..." 
                  : "Describe the event (e.g., 'A white SUV arriving')..."}
              className="w-full bg-transparent text-gray-100 placeholder-gray-500 resize-none focus:outline-none h-12 min-h-[3rem] max-h-32"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            
            <div className="flex justify-between items-center mt-2 border-t border-gray-700/50 pt-3">
              <div className="flex items-center gap-2">
                  {/* Upload Button */}
                  {(!hasActiveVideo || selectedFile) && (
                     <>
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
                     </>
                  )}

                  {/* MODEL SELECTOR DROPDOWN */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                        className="flex items-center gap-2 bg-[#282a2c] hover:bg-[#323436] border border-gray-700 rounded-full py-1.5 pl-3 pr-3 transition-colors text-xs font-medium text-gray-300"
                    >
                        <currentModel.icon className={`w-3.5 h-3.5 ${currentModel.color}`} />
                        <span className="hidden sm:inline">{currentModel.name}</span>
                        <ChevronUp className={`w-3 h-3 text-gray-500 transition-transform ${isModelMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isModelMenuOpen && (
                        <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#282a2c] border border-gray-700 rounded-xl shadow-xl overflow-hidden z-20 animate-fade-in-up">
                            {MODELS.map((m) => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedModelId(m.id);
                                        setIsModelMenuOpen(false);
                                    }}
                                    className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[#323436] transition-colors
                                        ${selectedModelId === m.id ? 'bg-[#323436]' : ''}
                                    `}
                                >
                                    <div className={`p-1.5 rounded-lg bg-black/30 ${m.color}`}>
                                        <m.icon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className={`text-sm font-medium ${selectedModelId === m.id ? 'text-white' : 'text-gray-300'}`}>
                                            {m.name}
                                        </div>
                                        <div className="text-[10px] text-gray-500 leading-none mt-0.5">
                                            {m.description}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                  </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!prompt || isProcessing || (isHashing && !!selectedFile) || (!hasActiveVideo && !selectedFile)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium ${
                  prompt && !isProcessing && (hasActiveVideo || (selectedFile && !isHashing))
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20' 
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isProcessing || isHashing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                <span>{hasActiveVideo && !selectedFile ? 'Ask Gemini' : 'Analyze'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;