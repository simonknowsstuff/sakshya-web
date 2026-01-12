export interface VideoSession {
    id: string;
    videoUrl: string | null;
    videoName: string;
    hash: string | null;
    status: 'idle' | 'uploading' | 'analyzing' | 'ready' | 'error';
    events: TimelineEvent[];
}

export interface TimelineEvent {
    timestamp: number;
    description: string;
    confidence: number;
}