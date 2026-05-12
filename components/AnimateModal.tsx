/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, AlertCircle, Loader2, Download, Play, Video } from 'lucide-react';
import { Voice, VideoState } from '../types';
import { GoogleGenAI } from "@google/genai";

interface AnimateModalProps {
  voice: Voice;
  onClose: () => void;
}

const AnimateModal: React.FC<AnimateModalProps> = ({ voice, onClose }) => {
  const [prompt, setPrompt] = useState(`A cinematic video of ${voice.name}, ${voice.analysis.characteristics[0].toLowerCase()} character, speaking elegantly with subtle background animation.`);
  const [videoState, setVideoState] = useState<VideoState>({
    url: null,
    status: 'idle',
    prompt: ''
  });
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    const checkApiKey = async () => {
      // @ts-ignore
      if (window.aistudio?.hasSelectedApiKey) {
        // @ts-ignore
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } else {
        // Fallback for dev environment if aistudio global doesn't exist
        setHasApiKey(!!process.env.GEMINI_API_KEY);
      }
    };
    checkApiKey();
  }, []);

  const handleOpenSelectKey = async () => {
    // @ts-ignore
    if (window.aistudio?.openSelectKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        setHasApiKey(true);
    }
  };

  const generateVideo = async () => {
    if (!prompt.trim()) return;

    setVideoState({
        url: null,
        status: 'generating',
        prompt: prompt
    });

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY || '' });
        
        // Convert image to base64 if needed, but here we have a URL.
        // Veo-lite supports image bytes.
        // For simplicity, we'll fetch the image and convert it.
        const imageResp = await fetch(voice.imageUrl, { referrerPolicy: 'no-referrer' });
        const blob = await imageResp.blob();
        const base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(blob);
        });

        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-lite-generate-preview',
            prompt: prompt,
            image: {
                imageBytes: base64Data,
                mimeType: blob.type
            },
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        });

        // Poll for completion
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (downloadLink) {
            const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
            const videoResp = await fetch(downloadLink, {
                method: 'GET',
                headers: {
                    'x-goog-api-key': apiKey,
                },
            });
            const videoBlob = await videoResp.blob();
            const videoUrl = URL.createObjectURL(videoBlob);
            
            setVideoState(prev => ({
                ...prev,
                url: videoUrl,
                status: 'completed'
            }));
        } else {
            throw new Error("Failed to get video download link");
        }

    } catch (error: any) {
        console.error("Video generation error:", error);
        setVideoState(prev => ({
            ...prev,
            status: 'failed',
            error: error.message || "An unexpected error occurred during video generation."
        }));
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row max-h-[90vh]"
      >
        {/* Left Side: Preview area */}
        <div className="w-full md:w-1/2 bg-zinc-100 dark:bg-zinc-950 relative flex items-center justify-center min-h-[300px]">
           {videoState.status === 'completed' && videoState.url ? (
             <video 
                src={videoState.url} 
                className="w-full h-full object-cover"
                autoPlay 
                loop 
                controls
             />
           ) : (
             <div className="relative w-full h-full">
                <img 
                    src={voice.imageUrl} 
                    alt={voice.name} 
                    className={`w-full h-full object-cover transition-all duration-700 ${videoState.status === 'generating' ? 'scale-110 blur-sm brightness-50' : ''}`}
                    referrerPolicy="no-referrer"
                />
                
                {videoState.status === 'generating' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-8 text-center">
                        <Loader2 size={48} className="animate-spin mb-4 text-blue-400" />
                        <h4 className="text-xl font-medium mb-2">Generating Animation...</h4>
                        <p className="text-sm text-zinc-300">Veo is crafting your video. This usually takes 1-3 minutes.</p>
                        
                        <div className="mt-8 w-64 h-1.5 bg-white/20 rounded-full overflow-hidden">
                            <motion.div 
                                className="h-full bg-blue-500"
                                animate={{ x: ['-100%', '100%'] }}
                                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                            />
                        </div>
                    </div>
                )}

                {videoState.status === 'idle' && (
                     <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-bottom p-8">
                        <div className="mt-auto">
                            <span className="text-[10px] tracking-widest uppercase text-white/70 font-semibold mb-1 block">Starting Frame</span>
                            <h3 className="text-2xl font-serif text-white">{voice.name}</h3>
                        </div>
                     </div>
                )}
             </div>
           )}
        </div>

        {/* Right Side: Controls */}
        <div className="w-full md:w-1/2 p-8 flex flex-col">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                        <Video size={20} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-medium dark:text-white">Animate Image</h3>
                </div>
                <button 
                    onClick={onClose}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                >
                    <X size={20} className="text-zinc-500" />
                </button>
            </div>

            <div className="flex-1 space-y-6">
                <div>
                    <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                        Animation Description
                    </label>
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="w-full h-32 p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl resize-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white text-sm leading-relaxed"
                        placeholder="Describe how you want the image to move..."
                        disabled={videoState.status === 'generating'}
                    />
                    <p className="mt-2 text-[10px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                        <Sparkles size={10} />
                        Powered by Veo 3.1 Lite
                    </p>
                </div>

                {videoState.status === 'failed' && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex gap-3 text-red-600 dark:text-red-400">
                        <AlertCircle size={20} className="shrink-0" />
                        <div className="text-xs">
                            <p className="font-semibold mb-1">Generation Failed</p>
                            <p>{videoState.error}</p>
                        </div>
                    </div>
                )}

                {!hasApiKey && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-xl">
                         <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                            Video generation requires a paid Gemini API key. Please select one to continue.
                         </p>
                         <button 
                            onClick={handleOpenSelectKey}
                            className="w-full py-2 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-semibold hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                         >
                            Select Paid API Key
                         </button>
                         <a 
                            href="https://ai.google.dev/gemini-api/docs/billing" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block mt-2 text-[10px] text-zinc-400 hover:underline text-center"
                         >
                            Learn about Billing
                         </a>
                    </div>
                )}
            </div>

            <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex gap-3">
                {videoState.status === 'completed' ? (
                    <>
                        <button 
                            onClick={() => {
                                setVideoState({ url: null, status: 'idle', prompt: '' });
                                setPrompt(`A cinematic video of ${voice.name}, ${voice.analysis.characteristics[0].toLowerCase()} character, speaking elegantly.`);
                            }}
                            className="flex-1 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl text-sm font-semibold hover:opacity-90 transition-opacity"
                        >
                            Generate New
                        </button>
                        <a 
                            href={videoState.url || '#'} 
                            download={`${voice.name}-animated.mp4`}
                            className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                            <Download size={20} />
                        </a>
                    </>
                ) : (
                    <button 
                        disabled={videoState.status === 'generating' || !hasApiKey}
                        onClick={generateVideo}
                        className={`flex-1 py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                            videoState.status === 'generating' 
                                ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed dark:bg-zinc-800' 
                                : !hasApiKey
                                    ? 'bg-zinc-100 text-zinc-300 cursor-not-allowed dark:bg-zinc-800'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-[0.98]'
                        }`}
                    >
                        {videoState.status === 'generating' ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Sparkles size={18} />
                                Animate with Veo
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AnimateModal;
