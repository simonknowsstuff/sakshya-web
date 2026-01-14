export interface TimelineEvent {
  fromTimestamp: number;
  toTimestamp: number;
  summary: string;
  confidence: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: number;
  isLoading?: boolean;
  analysisData?: {
    events: TimelineEvent[];
    summary: string;
    confidence: number;
  };
}

export interface VideoSession {
  id: string;
  videoUrl: string | null;
  videoName: string;
  hash: string | null;
  status: 'idle' | 'uploading' | 'analyzing' | 'ready' | 'error';
  events: TimelineEvent[];
  gcsUri?: string;           
  chatHistory?: ChatMessage[];
  description?: string;      
}