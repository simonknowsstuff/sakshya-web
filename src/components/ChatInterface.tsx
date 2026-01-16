import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, X, FileVideo, ArrowUp, Loader2, AlertCircle, 
   User, Bot, PlayCircle, ChevronRight,
  Zap, Brain, ChevronUp, FileText, Trash2, Shield, ClipboardList
} from 'lucide-react';
import type { VideoSession, ChatMessage, TimelineEvent } from '../types';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { functions, storage } from '../lib/firebase';
import { useFileHash } from '../hooks/useFileHash';
import { useChatHistory } from '../hooks/useChatHistory'; 
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Fix TS Interface for Saved Events
interface SavedEvent extends TimelineEvent {
  docId: string;
}

interface ChatInterfaceProps {
  session: VideoSession;
  setSession: React.Dispatch<React.SetStateAction<VideoSession>>;
  onSaveSession?: (prompt: string, events: any[], downloadUrl: string, modelId: string, videoName: string, videoHash: string) => void; 
}

const MODELS = [
  { id: 'gemini-2.5-flash', name: 'Flash', description: 'Fast & Efficient', icon: Zap, color: 'text-yellow-400' },
  { id: 'gemini-2.5-pro', name: 'Pro', description: 'Complex Reasoning', icon: Brain, color: 'text-purple-400' },
];

const ChatInterface: React.FC<ChatInterfaceProps> = ({ session, setSession, onSaveSession }) => {
  const [prompt, setPrompt] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState(MODELS[0].id);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  
  // --- DRAG AND DROP STATE ---
  const [isDragging, setIsDragging] = useState(false);
  
  // --- MEMO REPORT STATE ---
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [savedEvents, setSavedEvents] = useState<SavedEvent[]>([]);
  const [reportData, setReportData] = useState({
      caseId: '', 
      ioName: '', 
      stationName: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { isHashing, generateHash } = useFileHash();
  const { fetchSaved, deleteSavedEvent } = useChatHistory();

  const currentModel = MODELS.find(m => m.id === selectedModelId) || MODELS[0];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [session.chatHistory]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- REPORT LOGIC (Keep existing) ---
  useEffect(() => {
      if (isReportModalOpen && session.id) {
          const loadSaved = async () => {
              const events = await fetchSaved(session.id) as SavedEvent[];
              setSavedEvents(events.sort((a, b) => a.fromTimestamp - b.fromTimestamp));
          };
          loadSaved();
      }
  }, [isReportModalOpen, session.id]);

  const handleUnsave = async (docId: string) => {
      await deleteSavedEvent(session.id, docId);
      setSavedEvents(prev => prev.filter(e => e.docId !== docId));
  };

  const generateNarrative = () => {
      let narrative = `I have viewed the digital video record marked "${session.videoName || 'Evidence File'}". An automated screening tool was used to locate relevant segments. Upon review of the flagged segments, the following observations were noted: `;
      savedEvents.forEach(event => {
          const timeStr = new Date(event.fromTimestamp * 1000).toISOString().substr(14, 5);
          narrative += `At ${timeStr}, observations consistent with "${event.summary}" were noted. `;
      });
      narrative += "These segments have been isolated for further manual verification and inclusion in the investigation file.";
      return narrative;
  };

  const generateInvestigativeMemo = () => {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const margin = 20;
      let y = 20;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("INTERNAL INVESTIGATIVE NOTE (Not for Court Submission)", pageWidth / 2, y, { align: "center" });
      y += 10;

      doc.setTextColor(0);
      doc.setFontSize(14);
      doc.text(`SUBJECT: Automated Video Pre-Screening Memo`, margin, y);
      y += 8;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Case Ref: ${reportData.caseId}`, margin, y);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - margin, y, { align: "right" });
      y += 6;
      doc.text(`Investigating Officer: ${reportData.ioName}`, margin, y);
      y += 15;

      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y, pageWidth - (margin * 2), 20, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("OBJECT IDENTIFICATION", margin + 5, y + 6);
      
      doc.setFont("helvetica", "normal");
      const hashShort = session.hash ? session.hash : "Pending";
      doc.text(`File: ${session.videoName} \nDigital Fingerprint: ${hashShort}`, margin + 5, y + 14);
      y += 30;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("SUGGESTED CASE DIARY NARRATIVE", margin, y);
      y += 6;

      doc.setFont("times", "italic");
      doc.setFontSize(10);
      doc.setTextColor(60);
      const narrativeText = generateNarrative();
      const splitNarrative = doc.splitTextToSize(narrativeText, pageWidth - (margin * 2));
      doc.text(splitNarrative, margin, y);
      y += (splitNarrative.length * 5) + 15;

      doc.setFont("helvetica", "bold");
      doc.setTextColor(0);
      doc.setFontSize(11);
      doc.text("DETAILED OBSERVATION LOG", margin, y);
      y += 5;

      const findingsData = savedEvents.map(e => {
          let clarity = "Low / Obstructed";
          if (e.confidence > 0.9) clarity = "High Clarity";
          else if (e.confidence > 0.7) clarity = "Moderate Visibility";

          return [
              new Date(e.fromTimestamp * 1000).toISOString().substr(14, 5), 
              e.summary,
              clarity
          ];
      });

      autoTable(doc, {
          startY: y,
          head: [['Time Code', 'Visual Observation', 'Visual Clarity']],
          body: findingsData,
          theme: 'grid',
          headStyles: { fillColor: [50, 50, 50], textColor: 255 },
          styles: { fontSize: 9, cellPadding: 3 },
          columnStyles: { 
              0: { cellWidth: 25, fontStyle: 'bold' },
              2: { cellWidth: 35, fontStyle: 'italic' }
          }
      });

      y = (doc as any).lastAutoTable.finalY + 15;

      doc.setDrawColor(200, 0, 0); 
      doc.setLineWidth(0.5);
      doc.rect(margin, y, pageWidth - (margin * 2), 25);
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(200, 0, 0); 
      doc.setFontSize(9);
      doc.text("LIMITATIONS & DISCLAIMER", margin + 5, y + 6);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50);
      doc.setFontSize(8);
      const disclaimer = "Note: This summary is generated by Sakshya AI to prioritize manual review. It is NOT a forensic report. Factors such as lighting, angle, and compression may alter visibility. The Investigating Officer must personally verify all cited timestamps before relying on them for further action.";
      const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - (margin * 2) - 10);
      doc.text(splitDisclaimer, margin + 5, y + 11);

      doc.save(`Investigation_Memo_${reportData.caseId || 'Draft'}.pdf`);
      setIsReportModalOpen(false);
  };

  // --- FILE HANDLING WITH DRAG & DROP ---

  const validateAndSetFile = (file: File) => {
      // SIZE LIMIT: 700 MB
      const maxSize = 700 * 1024 * 1024;

      if (file.size > maxSize) {
        // EMOJI REMOVED
        setErrorMsg("File size exceeds 700MB. Please upload a smaller video.");
        if (fileInputRef.current) fileInputRef.current.value = ''; 
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file); 
      setErrorMsg(null); 
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { 
    if (e.target.files && e.target.files[0]) { 
      validateAndSetFile(e.target.files[0]);
    } 
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        validateAndSetFile(file);
      } else {
        // EMOJI REMOVED
        setErrorMsg("Please upload a valid video file.");
      }
    }
  };

  const parseTimestampToSeconds = (timeStr: string | number): number => { if (typeof timeStr === 'number') return timeStr; if (!timeStr) return 0; const parts = timeStr.toString().split(':').map(Number); if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]; if (parts.length === 2) return parts[0] * 60 + parts[1]; return parts[0]; };
  
  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt) return;
      if (!selectedFile && !session.gcsUri) { setErrorMsg("Please upload a video."); return; }
      
      const userMsgId = Date.now().toString();
      const aiMsgId = (Date.now() + 1).toString();
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
          
          if (selectedFile && !currentGcsUri) {
              currentHash = await generateHash(selectedFile);
              currentVideoName = selectedFile.name;
              const storageRef = ref(storage, `evidence/${currentHash}.mp4`);
              await uploadBytes(storageRef, selectedFile);
              currentDownloadUrl = await getDownloadURL(storageRef);
              const bucketName = storageRef.bucket;
              currentGcsUri = `gs://${bucketName}/evidence/${currentHash}.mp4`;
              setSession(prev => ({ ...prev, videoUrl: currentDownloadUrl, videoName: currentVideoName, hash: currentHash, gcsUri: currentGcsUri }));
              setSelectedFile(null);
          }
          
          const getTimestamps = httpsCallable(functions, 'getTimestampsFromGemini');
          const response = await getTimestamps({ storageUri: currentGcsUri, userPrompt: prompt, model: selectedModelId });
          const data = response.data as any;
          
          if (data.timestamps) {
              const formattedEvents = data.timestamps.map((t: any) => ({ 
                  fromTimestamp: parseTimestampToSeconds(t.start || t.timestamp || t.from), 
                  toTimestamp: parseTimestampToSeconds(t.end || t.to), 
                  summary: t.description || t.summary || "Event Detected", 
                  confidence: t.confidence || 0.95 
              }));

              const avgConfidence = formattedEvents.length > 0
                  ? formattedEvents.reduce((sum: number, e: any) => sum + (e.confidence || 0), 0) / formattedEvents.length
                  : 1.0;

              setSession(prev => ({ 
                  ...prev, 
                  chatHistory: prev.chatHistory?.map(msg => msg.id === aiMsgId ? { 
                      ...msg, 
                      isLoading: false, 
                      text: data.description || `Found ${formattedEvents.length} relevant events.`, 
                      analysisData: { 
                          events: formattedEvents, 
                          summary: data.description, 
                          confidence: avgConfidence 
                      } 
                  } : msg ) 
              }));
              
              if (onSaveSession && currentDownloadUrl) { 
                  onSaveSession(prompt, formattedEvents, currentDownloadUrl, selectedModelId, currentVideoName, currentHash || ""); 
              }
          }
      } catch (err: any) {
          console.error(err);
          setSession(prev => ({ ...prev, chatHistory: prev.chatHistory?.map(msg => msg.id === aiMsgId ? { ...msg, isLoading: false, text: "Failed to analyze video." } : msg ) }));
          setErrorMsg("Connection failed.");
      } finally { setIsProcessing(false); }
  };

  const handleViewResults = (events: any[], description: string) => { setSession(prev => ({ ...prev, status: 'ready', events: events, description: description })); };
  const hasActiveVideo = !!session.gcsUri;
  const history = session.chatHistory || [];

  return (
    <div 
        className="flex flex-col h-full max-w-4xl mx-auto w-full px-4 relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
      
      {/* 1. HEADER */}
      {hasActiveVideo && (
          <div className="flex justify-end pt-4 pb-2">
              <button 
                  onClick={() => setIsReportModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#282a2c] hover:bg-[#323436] border border-gray-700 rounded-lg text-xs font-medium text-blue-400 transition-colors"
              >
                  <ClipboardList className="w-3.5 h-3.5" />
                  Create Case Diary Memo
              </button>
          </div>
      )}

      {/* 2. MEMO GENERATION MODAL (Keep Existing) */}
      {isReportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-[#1e1f20] w-full max-w-2xl rounded-2xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-gray-700 flex justify-between items-start bg-[#282a2c]">
                      <div>
                          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                              <Shield className="w-5 h-5 text-blue-500" />
                              Investigative Memo
                          </h2>
                          <p className="text-sm text-gray-400 mt-1">Drafting tool for Case Diary Entries</p>
                      </div>
                      <button onClick={() => setIsReportModalOpen(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="overflow-y-auto p-6 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                              <label className="text-xs font-medium text-gray-400 uppercase">Case ID</label>
                              <input type="text" value={reportData.caseId} onChange={(e) => setReportData({...reportData, caseId: e.target.value})} placeholder="e.g. FIR-2026-001" className="w-full bg-[#131314] border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none" />
                          </div>
                          <div className="space-y-2">
                              <label className="text-xs font-medium text-gray-400 uppercase">Investigating Officer</label>
                              <input type="text" value={reportData.ioName} onChange={(e) => setReportData({...reportData, ioName: e.target.value})} placeholder="IO Name" className="w-full bg-[#131314] border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none" />
                          </div>
                      </div>
                      <div>
                          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center justify-between"><span>Findings to Include ({savedEvents.length})</span></h3>
                          <div className="bg-[#131314] rounded-xl border border-gray-800 overflow-hidden max-h-48 overflow-y-auto">
                              {savedEvents.length === 0 ? <div className="p-4 text-center text-sm text-gray-500 italic">No events saved yet. Go to the timeline to bookmark findings.</div> : savedEvents.map((event) => (<div key={event.docId} className="flex items-center gap-3 p-3 border-b border-gray-800 last:border-0 hover:bg-[#1e1f20]"><div className="font-mono text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded">{new Date(event.fromTimestamp * 1000).toISOString().substr(14, 5)}</div><div className="flex-1 text-sm text-gray-300 truncate">{event.summary}</div><button onClick={() => handleUnsave(event.docId)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors" title="Remove from Report"><Trash2 className="w-4 h-4" /></button></div>))}
                          </div>
                      </div>
                  </div>
                  <div className="p-4 border-t border-gray-700 bg-[#282a2c] flex justify-end gap-3">
                      <button onClick={() => setIsReportModalOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                      <button onClick={generateInvestigativeMemo} disabled={!reportData.caseId || !reportData.ioName} className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-900/20"><FileText className="w-4 h-4" />Generate Memo PDF</button>
                  </div>
              </div>
          </div>
      )}

      {/* 3. CHAT HISTORY (Keep Same) */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6 min-h-0 custom-scrollbar" ref={scrollRef}>
        {history.length === 0 && (
            <div className={`flex flex-col items-center justify-center h-full space-y-6 transition-all duration-300 ${isDragging ? 'opacity-40 scale-95' : 'opacity-60'}`}>
                <div className="w-20 h-20 rounded-3xl bg-blue-500/10 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]" />
                </div>
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-200">Sakshya AI</h2>
                    <p className="text-gray-500 mt-2">
                        {isDragging ? "Drop video to upload" : "Upload footage. Start the investigation."}
                    </p>
                </div>
            </div>
        )}
        {history.map((msg, index) => (
            <div key={`${msg.id}-${index}`} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-green-600'}`}>{msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}</div>
                <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-blue-600/20 text-blue-100 rounded-tr-sm border border-blue-500/20' : 'bg-[#282a2c] text-gray-200 rounded-tl-sm border border-gray-700'}`}>{msg.isLoading ? (<div className="flex items-center gap-2 text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /><span>Analyzing evidence...</span></div>) : (<p>{msg.text}</p>)}</div>
                    {msg.role === 'ai' && msg.analysisData && (<div className="mt-2 w-full max-w-sm"><button onClick={() => handleViewResults(msg.analysisData!.events, msg.analysisData!.summary)} className="w-full flex items-center gap-3 p-3 bg-[#1e1f20] hover:bg-[#252628] border border-gray-700 hover:border-blue-500/50 rounded-xl transition-all group text-left"><div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform"><PlayCircle className="w-5 h-5" /></div><div className="flex-1 min-w-0"><h4 className="text-sm font-medium text-gray-200">View Timeline</h4><p className="text-xs text-gray-500 mt-0.5">{msg.analysisData.events.length} events found • {Math.round(msg.analysisData.confidence * 100)}% match</p></div><ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-blue-400" /></button></div>)}
                </div>
            </div>
        ))}
      </div>

      {/* 4. INPUT AREA (Modified for Drag) */}
      <div className="pb-6 pt-4 bg-[#131314]">
        {errorMsg && (<div className="mb-3 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20 animate-fade-in"><AlertCircle className="w-4 h-4" />{errorMsg}</div>)}
        
        {/* Drag Overlay */}
        {isDragging && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-sm border-2 border-dashed border-blue-500 rounded-2xl mx-4 mb-6">
                <div className="bg-[#1e1f20] px-6 py-3 rounded-full text-blue-400 font-medium shadow-xl flex items-center gap-2 animate-bounce">
                    <Upload className="w-5 h-5" />
                    Drop Video Here
                </div>
            </div>
        )}

        <form onSubmit={handleSubmit} className={`relative bg-[#1e1f20] rounded-2xl border transition-all shadow-2xl ${isDragging ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-700 focus-within:border-gray-600'}`}>
          {hasActiveVideo && !selectedFile && !errorMsg && (<div className="absolute -top-10 left-0 flex items-center gap-2 bg-[#1e1f20] border border-green-500/30 text-xs text-green-400 px-3 py-1.5 rounded-full shadow-sm max-w-[90vw]"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" /><div className="flex items-center gap-2 min-w-0"><span className="text-gray-300 truncate font-medium max-w-[150px]" title={session.videoName}>{session.videoName}</span>{session.hash && (<span className="text-gray-500 font-mono border-l border-gray-700 pl-2 truncate cursor-help" title={`SHA-256: ${session.hash}`}>{session.hash.substring(0, 12)}...</span>)}</div></div>)}
          {selectedFile && (<div className="absolute -top-12 left-0 flex items-center gap-2 bg-[#282a2c] text-sm text-gray-200 px-3 py-2 rounded-lg border border-gray-700 shadow-sm animate-fade-in"><FileVideo className="w-4 h-4 text-blue-400" /><span className="truncate max-w-[200px]">{selectedFile.name}</span><button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="hover:text-red-400 ml-1"><X className="w-4 h-4" /></button></div>)}
          
          <div className="flex flex-col p-4">
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={hasActiveVideo ? "Ask another question about this footage..." : "Drag & Drop video here, or type to describe..."} className="w-full bg-transparent text-gray-100 placeholder-gray-500 resize-none focus:outline-none h-12 min-h-[3rem] max-h-32" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }} />
            <div className="flex justify-between items-center mt-2 border-t border-gray-700/50 pt-3">
              <div className="flex items-center gap-2">
                  {(!hasActiveVideo || selectedFile) && (<><input type="file" accept="video/*" ref={fileInputRef} onChange={handleFileSelect} className="hidden" /><button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded-full transition-colors" title="Upload Video"><Upload className="w-5 h-5" /></button></>)}
                  <div className="relative" ref={dropdownRef}>
                    <button type="button" onClick={() => setIsModelMenuOpen(!isModelMenuOpen)} className="flex items-center gap-2 bg-[#282a2c] hover:bg-[#323436] border border-gray-700 rounded-full py-1.5 pl-3 pr-3 transition-colors text-xs font-medium text-gray-300">
                        <currentModel.icon className={`w-3.5 h-3.5 ${currentModel.color}`} /><span className="hidden sm:inline">{currentModel.name}</span><ChevronUp className={`w-3 h-3 text-gray-500 transition-transform ${isModelMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isModelMenuOpen && (<div className="absolute bottom-full left-0 mb-2 w-48 bg-[#282a2c] border border-gray-700 rounded-xl shadow-xl overflow-hidden z-20 animate-fade-in-up">{MODELS.map((m) => (<button key={m.id} type="button" onClick={() => { setSelectedModelId(m.id); setIsModelMenuOpen(false); }} className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[#323436] transition-colors ${selectedModelId === m.id ? 'bg-[#323436]' : ''}`}><div className={`p-1.5 rounded-lg bg-black/30 ${m.color}`}><m.icon className="w-4 h-4" /></div><div><div className={`text-sm font-medium ${selectedModelId === m.id ? 'text-white' : 'text-gray-300'}`}>{m.name}</div><div className="text-[10px] text-gray-500 leading-none mt-0.5">{m.description}</div></div></button>))}</div>)}
                  </div>
              </div>
              <button type="submit" disabled={!prompt || isProcessing || (isHashing && !!selectedFile) || (!hasActiveVideo && !selectedFile)} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium ${prompt && !isProcessing && (hasActiveVideo || (selectedFile && !isHashing)) ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>{isProcessing || isHashing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}<span>{hasActiveVideo && !selectedFile ? 'Ask Gemini' : 'Analyze'}</span></button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;