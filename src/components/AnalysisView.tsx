import React, { useRef, useState, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { Loader2, Play, Pause, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import type { VideoSession, TimelineEvent } from '../types';

interface AnalysisViewProps {
  session: VideoSession;
  setSession: React.Dispatch<React.SetStateAction<VideoSession>>;
  onBack: () => void;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ session, setSession, onBack }) => {
  const Player =ReactPlayer as unknown as React.ComponentType<any>;
  const playerRef = useRef<any>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Mock processing effect
  useEffect(() => {
    if (session.status === 'analyzing') {
      const timer = setTimeout(() => {
        // Mock results
        const mockEvents: TimelineEvent[] = [
          { timestamp: 5, description: "Red car enters the frame from the left", confidence: 0.95 },
          { timestamp: 12, description: "Person detected walking near the entrance", confidence: 0.88 },
          { timestamp: 25, description: "Suspicious object left unattended", confidence: 0.75 },
          { timestamp: 40, description: "Vehicle departs the scene", confidence: 0.92 }
        ];

        setSession(prev => ({
          ...prev,
          status: 'ready',
          events: mockEvents
        }));
      }, 3000); // 3 seconds mock delay

      return () => clearTimeout(timer);
    }
  }, [session.status, setSession]);

  // In AnalysisView.tsx

  const handleSeek = (time: number) => {
    if (playerRef.current) {
      // DEBUG: Let's see what we actually have
      // console.log("Player Ref is:", playerRef.current); 

      // Scenario A: It's the ReactPlayer instance (Has .seekTo)
      if (typeof playerRef.current.seekTo === 'function') {
        playerRef.current.seekTo(time, 'seconds');
      } 
      // Scenario B: It's the raw HTML Video element (Has .currentTime)
      else if (playerRef.current.currentTime !== undefined) {
        playerRef.current.currentTime = time;
      }
      
      setPlaying(true);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
        <p className="mt-8 text-gray-500 text-sm max-w-md text-center">
          Sakshya AI is processing your video with Gemini 1.5 Pro to identify events matching your description.
        </p>
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

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 p-6 max-w-[1600px] mx-auto overflow-hidden">
      {/* Left Column: Video Player */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#000] rounded-2xl overflow-hidden border border-gray-800 shadow-2xl relative group">
        <div className="flex-1 relative">
            <Player
              ref={playerRef}
              url={session.videoUrl || ''}
              width="100%"
              height="100%"
              playing={playing}
              controls={true}
              onProgress={({ playedSeconds }:any) => setCurrentTime(playedSeconds)}
              onDuration={setDuration}
              style={{ position: 'absolute', top: 0, left: 0 }}
            />
        </div>
        
        {/* Helper overlay when paused/hover */}
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium text-white border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {session.videoName}
        </div>
      </div>

      {/* Right Column: Analysis Results */}
      <div className="w-full lg:w-96 flex flex-col gap-4 min-h-0">
        
        {/* Stats Card */}
        <div className="bg-[#1e1f20] border border-gray-700 p-4 rounded-xl shrink-0">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Detection Summary</h3>
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#282a2c] p-3 rounded-lg border border-gray-800">
                    <div className="text-2xl font-bold text-white">{session.events.length}</div>
                    <div className="text-xs text-gray-500">Events Found</div>
                </div>
                <div className="bg-[#282a2c] p-3 rounded-lg border border-gray-800">
                    <div className="text-2xl font-bold text-blue-400">{(session.events.reduce((acc, curr) => acc + curr.confidence, 0) / session.events.length * 100).toFixed(0)}%</div>
                    <div className="text-xs text-gray-500">Avg. Confidence</div>
                </div>
            </div>
        </div>

        {/* Timeline Events List */}
        <div className="flex-1 bg-[#1e1f20] border border-gray-700 rounded-xl overflow-hidden flex flex-col min-h-0">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-[#282a2c]">
            <h3 className="font-semibold text-gray-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Timeline
            </h3>
            <span className="text-xs text-gray-500">Click to seek</span>
          </div>

          <div className="overflow-y-auto flex-1 p-2 space-y-2 custom-scrollbar">
            {session.events.map((event, idx) => (
              <button
                key={idx}
                onClick={() => handleSeek(event.timestamp)}
                className={`w-full text-left p-3 rounded-lg border transition-all duration-200 group
                  ${Math.abs(currentTime - event.timestamp) < 2 
                    ? 'bg-blue-500/10 border-blue-500/50 hover:bg-blue-500/20' 
                    : 'bg-[#282a2c]/50 border-gray-800 hover:bg-[#282a2c] hover:border-gray-600'}
                `}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2 text-blue-400 font-mono text-sm font-medium bg-blue-500/10 px-2 py-0.5 rounded">
                    <Clock className="w-3 h-3" />
                    {formatTime(event.timestamp)}
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
                  {event.description}
                </p>
              </button>
            ))}
            
            {session.events.length === 0 && (
                <div className="text-center py-10 text-gray-500 text-sm">
                    No significant events detected matching your criteria.
                </div>
            )}
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
