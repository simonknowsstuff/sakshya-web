export interface VideoSession {
    id: string;
    videoUrl: string | null;
    videoName: string;
    hash: string | null;
    status: 'idle' | 'uploading' | 'analyzing' | 'ready' | 'error';
    events: TimelineEvent[];
}

export interface TimelineEvent {
    fromTimestamp: number;
    toTimestamp: number;
    summary: string;
    confidence: number;
}
