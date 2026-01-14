import React, { useRef, useState, useEffect } from 'react';
import { Loader2, AlertCircle, CheckCircle2, Clock, Play, Pause, Maximize, Volume2, VolumeX } from 'lucide-react';
import type { VideoSession } from '../types';

interface AnalysisViewProps {
  session: VideoSession;
  setSession: React.Dispatch<React.SetStateAction<VideoSession>>;
  onBack: () => void;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ session, setSession, onBack }) => {
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

  // --- CONTROLS LOGIC ---

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isDragging) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };

  const handleSeek = (time: number) => {
    if (videoRef.current && Number.isFinite(time)) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // --- DRAG / SCRUB HANDLERS ---
  const calculateTimeFromMouseEvent = (e: MouseEvent | React.MouseEvent) => {
    if (progressBarRef.current && duration > 0) {
        const rect = progressBarRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        const percentage = Math.max(0, Math.min(1, clickX / width));
        return percentage * duration;
    }
    return 0;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const newTime = calculateTimeFromMouseEvent(e);
    handleSeek(newTime); 
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newTime = calculateTimeFromMouseEvent(e);
        handleSeek(newTime);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (isPlaying && videoRef.current) {
         videoRef.current.play();
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, duration, isPlaying]);

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      setShowControls(true);
      clearTimeout(timeout);
      if (isPlaying && !isDragging) { 
        timeout = setTimeout(() => setShowControls(false), 3000);
      }
    };
    window.addEventListener('mousemove', resetTimer);
    return () => {
      window.removeEventListener('mousemove', resetTimer);
      clearTimeout(timeout);
    };
  }, [isPlaying, isDragging]);


  // --- LOADING STATES ---

  if (session.status === 'uploading') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full animate-pulse" />
          <Loader2 className="w-16 h-16 animate-spin relative z-10 text-blue-500" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-200 mt-8 mb-2">Uploading Footage</h2>
        <div className="flex items-center space-x-2 text-sm font-mono text-gray-500 bg-[#282a2c] px-4 py-2 rounded-full border border-gray-800">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>SHA-256: {session.hash?.substring(0, 16)}...</span>
        </div>
      </div>
    );
  }

  if (session.status === 'analyzing') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full animate-pulse" />
          <Loader2 className="w-16 h-16 animate-spin relative z-10 text-blue-500" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-200 mt-8 mb-2">Analyzing Footage</h2>
        <div className="flex items-center space-x-2 text-sm font-mono text-gray-500 bg-[#282a2c] px-4 py-2 rounded-full border border-gray-800">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>SHA-256: {session.hash?.substring(0, 16)}...</span>
        </div>
      </div>
    );
  }

  if (session.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-400">
        <AlertCircle className="w-12 h-12 mb-4" />
        <h2 className="text-xl">Analysis Failed</h2>
        <button onClick={onBack} className="mt-4 text-blue-400 hover:underline">Try Again</button>
      </div>
    );
  }

  // --- MAIN RENDER ---

  return (
    <div className="w-full h-full flex flex-col lg:flex-row gap-6 p-6 max-w-[1600px] mx-auto overflow-hidden">
      
      {/* --- Left Column: CUSTOM VIDEO PLAYER --- */}
      
      <div 
        ref={containerRef} 
        className="flex-1 relative min-w-0 bg-black rounded-2xl overflow-hidden border border-gray-800 shadow-2xl group"
      >
        
        <div 
            className="absolute inset-0 w-full h-full flex items-center justify-center cursor-pointer bg-black"
            onClick={togglePlay}
        >
            <video
              ref={videoRef}
              src={session.videoUrl || ''}
              className="w-full h-full object-contain"
              playsInline
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
            />
            
            {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px] transition-all">
                    <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-xl group-hover:scale-110 transition-transform">
                        <Play className="w-8 h-8 text-white fill-white ml-1" />
                    </div>
                </div>
            )}
        </div>

        {/* Control Bar - also absolute to sit on top */}
        <div className={`
            absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-4 pt-12 transition-opacity duration-300 z-10
            ${showControls ? 'opacity-100' : 'opacity-0'}
        `}>
            {/* Progress Bar */}
            <div 
                ref={progressBarRef}
                className="relative w-full h-1.5 bg-gray-600/50 hover:h-2.5 transition-all cursor-pointer rounded-full mb-3 group/bar touch-none"
                onMouseDown={handleMouseDown}
            >
                <div 
                    className="absolute top-0 left-0 h-full bg-red-600 rounded-full z-10 pointer-events-none"
                    style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full shadow opacity-0 group-hover/bar:opacity-100 transition-opacity scale-150" />
                </div>
                {/* Event Markers on Timeline */}
                {session.events.map((event, idx) => {
                    const startPct = (event.fromTimestamp / (duration || 1)) * 100;
                    const endPct = (event.toTimestamp / (duration || 1)) * 100;
                    const widthPct = Math.max(0.5, endPct - startPct)
                    return (
                        <div
                            key={idx}
                            className="absolute top-0 h-full bg-blue-400/80 z-20 hover:bg-blue-300 transition-colors"
                            style={{ 
                                left: `${startPct}%`,
                                width: `${widthPct}%` 
                            }}
                            title={`${formatTime(event.fromTimestamp)} - ${formatTime(event.toTimestamp)}: ${event.summary}`}/>
                    );
                })}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between text-white select-none">
                <div className="flex items-center gap-4">
                    <button onClick={togglePlay} className="hover:text-blue-400 transition-colors p-1">
                        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                    </button>
                    <button onClick={toggleMute} className="hover:text-blue-400 transition-colors p-1">
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <div className="text-xs font-mono text-gray-300">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-400 hidden sm:block">
                        {session.videoName}
                    </span>
                    <button onClick={toggleFullscreen} className="hover:text-blue-400 transition-colors p-1">
                        <Maximize className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* --- Right Column: Analysis Results --- */}
      <div className="w-full lg:w-96 flex flex-col gap-4 min-h-0">
        
        {/* 1. Detection Stats */}
        <div className="bg-[#1e1f20] border border-gray-700 p-4 rounded-xl shrink-0">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Detection Summary</h3>
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#282a2c] p-3 rounded-lg border border-gray-800">
                    <div className="text-2xl font-bold text-white">{session.events.length}</div>
                    <div className="text-xs text-gray-500">Events Found</div>
                </div>
                <div className="bg-[#282a2c] p-3 rounded-lg border border-gray-800">
                    <div className="text-2xl font-bold text-blue-400">
                        {session.events.length > 0 
                          ? (session.events.reduce((acc, curr) => acc + curr.confidence, 0) / session.events.length * 100).toFixed(0) 
                          : 0}%
                    </div>
                    <div className="text-xs text-gray-500">Avg. Confidence</div>
                </div>
            </div>
        </div>

        {/* 2. Timeline List */}
        <div className="flex-1 bg-[#1e1f20] border border-gray-700 rounded-xl overflow-hidden flex flex-col min-h-0">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-[#282a2c]">
            <h3 className="font-semibold text-gray-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Timeline
            </h3>
          </div>

          <div className="overflow-y-auto flex-1 p-2 space-y-2 custom-scrollbar">
            {session.events.map((event, idx) => {
                const isActive = currentTime >= event.fromTimestamp && currentTime <= event.toTimestamp;

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      handleSeek(event.fromTimestamp); // Seek to start of event
                      if(!isPlaying) {
                        videoRef.current?.play();
                        setIsPlaying(true);
                      }
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-all duration-200 group
                      ${isActive
                        ? 'bg-blue-500/10 border-blue-500/50 hover:bg-blue-500/20' 
                        : 'bg-[#282a2c]/50 border-gray-800 hover:bg-[#282a2c] hover:border-gray-600'}
                    `}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2 text-blue-400 font-mono text-sm font-medium bg-blue-500/10 px-2 py-0.5 rounded">
                        <Clock className="w-3 h-3" />
                        {formatTime(event.fromTimestamp)} - {formatTime(event.toTimestamp)}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border
                        ${event.confidence > 0.9 
                          ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                          : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}
                      `}>
                        {Math.round(event.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 group-hover:text-white transition-colors line-clamp-2">
                      {event.summary}
                    </p>
                  </button>
                );
            })}
          </div>
        </div>

        <button 
            onClick={onBack}
            className="p-3 rounded-xl bg-[#282a2c] border border-gray-700 text-gray-400 hover:text-white hover:bg-[#323436] transition-all text-sm font-medium"
        >
            Start New Session
        </button>
      </div>
    </div>
  );
};

export default AnalysisView;