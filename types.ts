
export interface Shot {
  id: number;
  x: number;
  y: number;
  confidence: number;
  isOverlapping: boolean;
}

export interface AnalysisResult {
  totalShots: number;
  shots: Shot[];
  processingTimeMs: number;
  summary: string;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface ProcessingStep {
  name: string;
  description: string;
  isDone: boolean;
}
