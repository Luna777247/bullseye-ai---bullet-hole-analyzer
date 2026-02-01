
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Upload, 
  Target, 
  RefreshCcw, 
  ShieldCheck, 
  Zap, 
  Layers, 
  AlertCircle,
  BarChart3,
  Crosshair
} from 'lucide-react';
import { analyzeBulletHoles } from './services/bulletHoleService';
import { AnalysisResult, ProcessingStatus, ProcessingStep, Shot } from './types';
import { ProcessingOverlay } from './components/ProcessingOverlay';

const PIPELINE_STEPS: ProcessingStep[] = [
  { name: 'Image Acquisition', description: 'Loading and pre-processing buffer', isDone: false },
  { name: 'Grayscale & Threshold', description: 'Isolating high-contrast impact zones', isDone: false },
  { name: 'Distance Transform', description: 'Calculating Euclidean distance to centers', isDone: false },
  { name: 'Watershed Segmentation', description: 'Isolating overlapping centroids', isDone: false },
  { name: 'Final Validation', description: 'C++ OpenCV processing complete', isDone: false },
];

const App: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [steps, setSteps] = useState<ProcessingStep[]>(PIPELINE_STEPS);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImage(e.target?.result as string);
        setStatus(ProcessingStatus.IDLE);
        setResult(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const runAnalysis = async () => {
    if (!image) return;

    setStatus(ProcessingStatus.PROCESSING);
    setSteps(PIPELINE_STEPS.map(s => ({ ...s, isDone: false })));
    setError(null);

    try {
      // Simulate visual pipeline progress
      for (let i = 0; i < PIPELINE_STEPS.length - 1; i++) {
        await new Promise(r => setTimeout(r, 400));
        setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, isDone: true } : s));
      }

      const analysisResult = await analyzeBulletHoles(image);
      
      // Final step complete
      setSteps(prev => prev.map((s, idx) => idx === PIPELINE_STEPS.length - 1 ? { ...s, isDone: true } : s));
      setResult(analysisResult);
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Analysis failed. Make sure the C++ server is running on localhost:8080";
      setError(message);
      setStatus(ProcessingStatus.ERROR);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setStatus(ProcessingStatus.IDLE);
    setSteps(PIPELINE_STEPS);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Crosshair className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              BULLSEYE <span className="text-blue-500">AI</span>
            </h1>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> C++ OpenCV Engine</span>
            <span className="flex items-center gap-1.5"><Zap className="w-4 h-4" /> Real-time CV Processing</span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Input & Preview */}
          <div className="lg:col-span-8 space-y-6">
            <div className="relative group bg-slate-900 border-2 border-dashed border-slate-700 rounded-2xl overflow-hidden transition-all hover:border-blue-500/50">
              {!image ? (
                <div 
                  className="flex flex-col items-center justify-center h-[500px] cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="bg-slate-800 p-6 rounded-full mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="w-10 h-10 text-blue-500" />
                  </div>
                  <p className="text-lg font-medium text-slate-300">Upload Target Image</p>
                  <p className="text-slate-500 mt-2 text-sm">PNG, JPG up to 10MB</p>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    accept="image/*"
                  />
                </div>
              ) : (
                <div className="relative h-[600px] bg-black flex items-center justify-center p-4">
                  {status === ProcessingStatus.PROCESSING && <ProcessingOverlay steps={steps} />}
                  <img 
                    src={image} 
                    alt="Target Preview" 
                    className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" 
                  />
                  
                  {/* Result Markers - Draw circles with actual radius from API */}
                  {status === ProcessingStatus.COMPLETED && result && (
                    <div className="absolute inset-0 m-4 pointer-events-none">
                      <div className="relative w-full h-full">
                        {result.shots.map((shot) => {
                          // Calculate circle size based on radius from API
                          const circleSize = Math.max(20, Math.min(80, shot.radius || 30));
                          return (
                            <div 
                              key={shot.id}
                              className="absolute -translate-x-1/2 -translate-y-1/2"
                              style={{ left: `${shot.x}%`, top: `${shot.y}%` }}
                            >
                              {/* Outer circle representing detected hole */}
                              <div 
                                className={`rounded-full border-2 flex items-center justify-center ${shot.isOverlapping ? 'border-amber-500 bg-amber-500/10 animate-pulse' : 'border-cyan-400 bg-cyan-400/10'}`}
                                style={{ width: `${circleSize}px`, height: `${circleSize}px` }}
                              >
                                {/* Center marker */}
                                <div className="w-2 h-2 bg-red-500 rounded-full shadow-lg shadow-red-500/50"></div>
                              </div>
                              {/* Label */}
                              <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/90 text-[10px] px-2 py-0.5 rounded font-bold text-cyan-400 border border-cyan-500/30">
                                #{shot.id}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {image && status === ProcessingStatus.IDLE && (
              <button 
                onClick={runAnalysis}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-3"
              >
                <Target className="w-6 h-6" />
                START ANALYSIS PIPELINE
              </button>
            )}

            {image && (status === ProcessingStatus.COMPLETED || status === ProcessingStatus.ERROR) && (
              <button 
                onClick={reset}
                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all flex items-center justify-center gap-3"
              >
                <RefreshCcw className="w-6 h-6" />
                PROCESS NEW TARGET
              </button>
            )}
          </div>

          {/* Right Column: Results & Info */}
          <div className="lg:col-span-4 space-y-6">
            {/* Stats Card */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 className="text-blue-500 w-5 h-5" />
                <h2 className="text-lg font-bold">Analysis Stats</h2>
              </div>

              {result ? (
                <div className="space-y-6">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-slate-500 text-sm uppercase tracking-widest">Detected Holes</p>
                      <p className="text-5xl font-black text-cyan-400">{result.totalShots}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-sm uppercase tracking-widest">Algorithm</p>
                      <p className="text-xs font-bold text-emerald-500">Distance<br/>Transform</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                      <p className="text-slate-500 text-xs mb-1">Large Holes</p>
                      <p className="text-xl font-bold text-amber-500">
                        {result.shots.filter(s => s.isOverlapping).length}
                      </p>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                      <p className="text-slate-500 text-xs mb-1">Image Size</p>
                      <p className="text-xs font-bold text-slate-300 pt-1">
                        {result.technicalDetails?.imageSize || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800">
                    <p className="text-slate-400 text-xs leading-relaxed">
                      <span className="font-semibold text-cyan-400">Algorithm:</span> {result.technicalDetails?.algorithm || 'OpenCV'}<br/>
                      <span className="font-semibold text-cyan-400">Area Filter:</span> {result.technicalDetails?.areaThresholds || 'Adaptive'}<br/>
                      <span className="font-semibold text-cyan-400">Processing:</span> {result.technicalDetails?.processingTime || 'Fast'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                  <Target className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">No analysis performed yet</p>
                </div>
              )}
            </div>

            {/* Tech Specs */}
            <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Pipeline Technology</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 bg-slate-800 p-1.5 rounded">
                    <Layers className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Watershed Segmentation</p>
                    <p className="text-xs text-slate-500 mt-0.5">Handles overlapping regions by simulating topographical flooding from distance transform markers.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 bg-slate-800 p-1.5 rounded">
                    <Target className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Distance Transform</p>
                    <p className="text-xs text-slate-500 mt-0.5">Converts binary image into intensity map based on Euclidean distance to nearest boundary pixel.</p>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-500/50 rounded-2xl p-4 flex items-start gap-3 text-red-400">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-slate-800 py-10">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-sm">
            Powered by C++ OpenCV • Distance Transform • Watershed Segmentation
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
