import React, { useRef, useState, useEffect } from 'react';
import { Loader2, CheckCircle2, Clock, Play, Pause, Maximize, Volume2, VolumeX, Send, MessageSquare, ArrowLeft, Bookmark, Check } from 'lucide-react'; 
import type { VideoSession } from '../types';
import { httpsCallable } from 'firebase/functions';
import { functions, storage } from '../lib/firebase';

interface AnalysisViewProps {
  session: VideoSession;
  setSession: React.Dispatch<React.SetStateAction<VideoSession>>;
  onBack: () => void;
  onSaveEvents: (prompt: string, newEvents: any[]) => Promise<void>;
  onSaveSingleEvent: (event: any) => Promise<string>;
  onDeleteSingleEvent: (docId: string) => Promise<void>;
  onFetchSavedEvents: () => Promise<any[]>; 
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ session, setSession, onBack, onSaveEvents, onSaveSingleEvent, onDeleteSingleEvent, onFetchSavedEvents }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  
  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  // Chat State
  const [followUpPrompt, setFollowUpPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [savedEventIds,setSavedEventIds]=useState<{[key: number]: string}>({});

  // ... (KEEP ALL PLAYER LOGIC EXACTLY THE SAME: togglePlay, handleSeek, useEffects, etc.) ...
  const togglePlay = () => { if (videoRef.current) { if (isPlaying) videoRef.current.pause(); else videoRef.current.play(); setIsPlaying(!isPlaying); } };
  const toggleMute = () => { if (videoRef.current) { videoRef.current.muted = !isMuted; setIsMuted(!isMuted); } };
  const toggleFullscreen = () => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen(); else document.exitFullscreen(); };
  const handleTimeUpdate = () => { if (videoRef.current && !isDragging) setCurrentTime(videoRef.current.currentTime); };
  const handleLoadedMetadata = () => { if (videoRef.current) setDuration(videoRef.current.duration); };
  const handleSeek = (time: number) => { if (videoRef.current && Number.isFinite(time)) { videoRef.current.currentTime = time; setCurrentTime(time); } };
  
  const calculateTimeFromMouseEvent = (e: MouseEvent | React.MouseEvent) => {
    if (progressBarRef.current && duration > 0) {
        const rect = progressBarRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        return Math.max(0, Math.min(1, clickX / width)) * duration;
    }
    return 0;
  };
  const handleMouseDown = (e: React.MouseEvent) => { setIsDragging(true); handleSeek(calculateTimeFromMouseEvent(e)); };
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => { if (isDragging) handleSeek(calculateTimeFromMouseEvent(e)); };
    const handleMouseUp = () => { setIsDragging(false); if (isPlaying && videoRef.current) videoRef.current.play(); };
    if (isDragging) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); }
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isDragging, duration, isPlaying]);

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const resetTimer = () => { setShowControls(true); clearTimeout(timeout); if (isPlaying && !isDragging) timeout = setTimeout(() => setShowControls(false), 3000); };
    window.addEventListener('mousemove', resetTimer);
    return () => { window.removeEventListener('mousemove', resetTimer); clearTimeout(timeout); };
  }, [isPlaying, isDragging]);


  useEffect(() => {
    const restoreSavedState = async () => {
      try {
        // 1. Get all saved items from DB
        const savedDocs = await onFetchSavedEvents();
        
        // 2. Build a map of what's saved
        const restoredMap: {[key: number]: string} = {};

        // 3. Check each event in the current timeline
        session.events.forEach((timelineEvent, index) => {
          // Find a match in the savedDocs based on content unique-ness
          // (Matching by timestamp AND summary is usually safe enough)
          const match = savedDocs.find(saved => 
            Math.abs(saved.fromTimestamp - timelineEvent.fromTimestamp) < 0.1 && // Tolerance for float math
            saved.summary === timelineEvent.summary
          );

          if (match) {
            restoredMap[index] = match.docId;
          }
        });

        setSavedEventIds(restoredMap);
      } catch (err) {
        console.error("Failed to restore saved events", err);
      }
    };

    restoreSavedState();
  }, [session.id, session.events]);


  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpPrompt.trim() || isAnalyzing) return;
    const promptText = followUpPrompt;
    setFollowUpPrompt(''); 
    setIsAnalyzing(true);
    try {
      const bucketName = storage.app.options.storageBucket; 
      const gcsUri = `gs://${bucketName}/evidence/${session.hash}.mp4`;
      const getTimestamps = httpsCallable(functions, 'getTimestampsFromGemini');
      const response = await getTimestamps({ storageUri: gcsUri, userPrompt: promptText });
      const data = response.data as any;
      if (data.timestamps) {
        const newEvents = data.timestamps.map((t: any) => ({
            fromTimestamp: typeof t.from === 'number' ? t.from : parseFloat(t.from) || 0,
            toTimestamp: typeof t.to === 'number' ? t.to : parseFloat(t.to) || 0,
            summary: t.summary || "Event Detected",
            confidence: t.confidence || 1.0
        }));
        setSession(prev => ({ ...prev, events: [...prev.events, ...newEvents] }));
        await onSaveEvents(promptText, newEvents);
      }
    } catch (error) {
      console.error("Follow-up failed:", error);
      alert("Failed to analyze.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- TOGGLE LOGIC: SAVE OR DELETE ---
  const handleToggleSave = async (event: any, index: number, e: React.MouseEvent) => {
      e.stopPropagation(); // Stop click from playing video
      
      const existingDocId = savedEventIds[index];

      try {
          if (existingDocId) {
              // 1. DELETE
              await onDeleteSingleEvent(existingDocId);
              // Remove from state
              setSavedEventIds(prev => {
                  const newState = { ...prev };
                  delete newState[index];
                  return newState;
              });
          } else {
              // 2. SAVE
              const newDocId = await onSaveSingleEvent(event);
              // Add to state
              setSavedEventIds(prev => ({
                  ...prev,
                  [index]: newDocId
              }));
          }
      } catch (err) {
          console.error("Failed to toggle save", err);
      }
  };

  // ... (Keep Loading states the same) ...
  if (session.status === 'uploading' || session.status === 'analyzing') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 animate-fade-in">
        <Loader2 className="w-16 h-16 animate-spin text-blue-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-200">Processing Footage...</h2>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col lg:flex-row gap-6 p-6 max-w-[1600px] mx-auto overflow-hidden">
      
      {/* --- Left Column: CUSTOM VIDEO PLAYER (Keep same) --- */}
      <div ref={containerRef} className="flex-1 relative min-w-0 bg-black rounded-2xl overflow-hidden border border-gray-800 shadow-2xl group">
        <div className="absolute inset-0 w-full h-full flex items-center justify-center cursor-pointer bg-black" onClick={togglePlay}>
            <video ref={videoRef} src={session.videoUrl || ''} className="w-full h-full object-contain" playsInline onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onEnded={() => setIsPlaying(false)} />
            {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px] transition-all">
                    <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-xl group-hover:scale-110 transition-transform"><Play className="w-8 h-8 text-white fill-white ml-1" /></div>
                </div>
            )}
        </div>
        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-4 pt-12 transition-opacity duration-300 z-10 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div ref={progressBarRef} className="relative w-full h-1.5 bg-gray-600/50 hover:h-2.5 transition-all cursor-pointer rounded-full mb-3 group/bar touch-none" onMouseDown={handleMouseDown}>
                <div className="absolute top-0 left-0 h-full bg-red-600 rounded-full z-10 pointer-events-none" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full shadow opacity-0 group-hover/bar:opacity-100 transition-opacity scale-150" />
                </div>
                {session.events.map((event, idx) => {
                    const startPct = (event.fromTimestamp / (duration || 1)) * 100;
                    const endPct = (event.toTimestamp / (duration || 1)) * 100;
                    return (<div key={idx} className="absolute top-0 h-full bg-blue-400/80 z-20" style={{ left: `${startPct}%`, width: `${Math.max(0.5, endPct - startPct)}%` }} />);
                })}
            </div>
            <div className="flex items-center justify-between text-white select-none">
                <div className="flex items-center gap-4">
                    <button onClick={togglePlay} className="hover:text-blue-400">{isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}</button>
                    <button onClick={toggleMute} className="hover:text-blue-400">{isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}</button>
                    <div className="text-xs font-mono text-gray-300">{formatTime(currentTime)} / {formatTime(duration)}</div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-400 hidden sm:block">{session.videoName}</span>
                    <button onClick={toggleFullscreen}><Maximize className="w-5 h-5" /></button>
                </div>
            </div>
        </div>
      </div>

      {/* --- Right Column: Analysis Results --- */}
      <div className="w-full lg:w-96 flex flex-col gap-4 min-h-0">
        
        {/* Stats */}
        <div className="bg-[#1e1f20] border border-gray-700 p-4 rounded-xl shrink-0">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Detection Summary</h3>
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#282a2c] p-3 rounded-lg border border-gray-800">
                    <div className="text-2xl font-bold text-white">{session.events.length}</div>
                    <div className="text-xs text-gray-500">Events Found</div>
                </div>
                <div className="bg-[#282a2c] p-3 rounded-lg border border-gray-800">
                    <div className="text-2xl font-bold text-blue-400">{session.events.length > 0 ? (session.events.reduce((acc, curr) => acc + curr.confidence, 0) / session.events.length * 100).toFixed(0) : 0}%</div>
                    <div className="text-xs text-gray-500">Avg. Confidence</div>
                </div>
            </div>
        </div>

        {/* Timeline List */}
        <div className="flex-1 bg-[#1e1f20] border border-gray-700 rounded-xl overflow-hidden flex flex-col min-h-0 relative">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-[#282a2c]">
            <h3 className="font-semibold text-gray-200 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" />Timeline</h3>
          </div>

          <div className="overflow-y-auto flex-1 p-2 space-y-2 custom-scrollbar relative">
             {isAnalyzing && (<div className="absolute inset-0 bg-black/50 z-30 flex items-center justify-center backdrop-blur-sm"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>)}

            {session.events.map((event, idx) => {
                const isActive = currentTime >= event.fromTimestamp && currentTime <= event.toTimestamp;
                const isSaved = !!savedEventIds[idx]; // Check if ID exists for this index

                return (
                  <div
                    key={idx}
                    className={`
                      w-full flex items-start p-3 rounded-lg border transition-all duration-200 group relative
                      ${isActive
                        ? 'bg-blue-500/10 border-blue-500/50 hover:bg-blue-500/20' 
                        : 'bg-[#282a2c]/50 border-gray-800 hover:bg-[#282a2c] hover:border-gray-600'}
                    `}
                  >
                    {/* Main Clickable Area */}
                    <button 
                        onClick={() => {
                            handleSeek(event.fromTimestamp);
                            if(!isPlaying) { videoRef.current?.play(); setIsPlaying(true); }
                        }}
                        className="flex-1 text-left min-w-0 outline-none"
                    >
                        <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-2 text-blue-400 font-mono text-sm font-medium bg-blue-500/10 px-2 py-0.5 rounded">
                                <Clock className="w-3 h-3" />
                                {formatTime(event.fromTimestamp)} - {formatTime(event.toTimestamp)}
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${event.confidence > 0.9 ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                                {Math.round(event.confidence * 100)}%
                            </span>
                        </div>
                        <p className="text-sm text-gray-300 group-hover:text-white transition-colors line-clamp-2">{event.summary}</p>
                    </button>

                    {/* UPDATED: Toggle Save Button */}
                    <button 
                        onClick={(e) => handleToggleSave(event, idx, e)}
                        className={`ml-3 p-2 rounded-lg transition-all border
                            ${isSaved 
                                ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30' // Hover turns red to indicate delete
                                : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-700 hover:text-gray-300'
                            }`}
                        title={isSaved ? "Click to unsave" : "Save Event"}
                    >
                        {isSaved ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                    </button>
                  </div>
                );
            })}
          </div>

          <div className="p-3 bg-[#282a2c] border-t border-gray-700">
            <form onSubmit={handleFollowUpSubmit} className="relative">
                <input type="text" value={followUpPrompt} onChange={(e) => setFollowUpPrompt(e.target.value)} placeholder="Ask another question..." disabled={isAnalyzing} className="w-full bg-[#1e1f20] text-sm text-gray-200 placeholder-gray-500 rounded-lg pl-4 pr-10 py-3 border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors" />
                <button type="submit" disabled={!followUpPrompt.trim() || isAnalyzing} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><Send className="w-4 h-4" /></button>
            </form>
          </div>
        </div>

        <button onClick={onBack} className="p-3 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600/20 hover:text-blue-300 transition-all text-sm font-medium flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            <span className="flex items-center gap-2">Return to Chat <MessageSquare className="w-3.5 h-3.5 opacity-60" /></span>
        </button>
      </div>
    </div>
  );
};

export default AnalysisView;