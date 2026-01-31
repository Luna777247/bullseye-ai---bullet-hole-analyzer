
import React from 'react';
import { ProcessingStep } from '../types';
import { CheckCircle2, CircleDashed, Loader2 } from 'lucide-react';

interface ProcessingOverlayProps {
  steps: ProcessingStep[];
}

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({ steps }) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-xl">
      <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Loader2 className="animate-spin text-blue-500" />
          Running CV Pipeline...
        </h3>
        <div className="space-y-4">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center justify-between group">
              <div className="flex flex-col">
                <span className={`font-medium ${step.isDone ? 'text-blue-400' : 'text-slate-400'}`}>
                  {step.name}
                </span>
                <span className="text-xs text-slate-500">{step.description}</span>
              </div>
              {step.isDone ? (
                <CheckCircle2 className="text-emerald-500 w-5 h-5" />
              ) : (
                <CircleDashed className="text-slate-600 w-5 h-5 animate-pulse" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
