/// <reference types="vite/client" />
import React, { useState, useEffect } from 'react';
import { X, FileText, Code } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DocumentViewerProps {
    filename: string;
    onClose: () => void;
    uiScale?: number;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ filename, onClose, uiScale = 1.0 }) => {
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRaw, setIsRaw] = useState(false);

    useEffect(() => {
        const fetchDoc = async () => {
            setLoading(true);
            try {
                // Map known files to their raw contents at build time
                const docImports: Record<string, () => Promise<any>> = {
                    'README.md': () => import('../README.md?raw'),
                    'CHANGELOG.md': () => import('../CHANGELOG.md?raw'),
                    'optask.md': () => import('../optask.md?raw')
                };

                if (docImports[filename]) {
                    const module = await docImports[filename]();
                    setContent(module.default);
                    setError(null);
                } else {
                    // Fallback to fetch with proper base URL
                    const baseUrl = import.meta.env.BASE_URL || '/';
                    const response = await fetch(`${baseUrl}${filename}`);
                    if (!response.ok) {
                        throw new Error('File not found or failed to load');
                    }
                    const text = await response.text();
                    setContent(text);
                    setError(null);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
                setContent('');
            } finally {
                setLoading(false);
            }
        };

        if (filename) {
            fetchDoc();
        }
    }, [filename]);

    // Handle escape key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6 pointer-events-none"
            style={{ transform: `scale(${uiScale})`, transformOrigin: 'center center' }}
        >
            {/* Removed the backdrop-blur and darkened semi-transparent background as requested */}
            <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />

            <div
                className="relative bg-[#0b1121] border border-emerald-500/30 rounded-xl shadow-2xl shadow-black/80 w-full max-w-4xl max-h-[90vh] flex flex-col pointer-events-auto animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-900/50 bg-[#0f172a]">
                    <div className="flex items-center gap-2 text-slate-100">
                        <FileText size={18} className="text-emerald-500" />
                        <span className="font-semibold tracking-wide">{filename}</span>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Toggle Raw/Rendered */}
                        <button
                            onClick={() => setIsRaw(!isRaw)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${isRaw
                                ? 'bg-slate-800 border-slate-700 text-slate-300'
                                : 'bg-emerald-950 border-emerald-800 text-emerald-400'
                                }`}
                        >
                            <Code size={14} />
                            {isRaw ? 'Raw View' : 'Rendered'}
                        </button>

                        <button
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-red-900/50 rounded-md transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth bg-[#0b1121]">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mr-3"></div>
                            Loading document...
                        </div>
                    ) : error ? (
                        <div className="text-red-400 p-4 border border-red-900/50 rounded-lg bg-red-950/20 font-mono">
                            Error: {error}
                        </div>
                    ) : isRaw ? (
                        <pre className="text-slate-300 font-mono text-sm whitespace-pre-wrap break-words p-4 rounded-lg bg-[#0f172a] border border-slate-800/50 shadow-inner">
                            {content}
                        </pre>
                    ) : (
                        <div className="max-w-none">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    h1: ({ node, ...props }) => <h1 className="text-2xl font-bold text-white mb-4 mt-8" {...props} />,
                                    h2: ({ node, ...props }) => <h2 className="text-xl font-bold text-white border-b border-emerald-900/50 pb-2 mt-8 mb-4 tracking-tight" {...props} />,
                                    h3: ({ node, ...props }) => <h3 className="text-lg font-bold text-slate-200 mt-6 mb-3" {...props} />,
                                    p: ({ node, ...props }) => <p className="text-slate-300 leading-relaxed mb-4" {...props} />,
                                    a: ({ node, ...props }) => <a className="text-emerald-400 hover:text-emerald-300 underline underline-offset-4 decoration-emerald-500/30 hover:decoration-emerald-400 transition-colors" {...props} />,
                                    ul: ({ node, ...props }) => <ul className="list-disc list-inside text-slate-300 mb-4 space-y-1 marker:text-emerald-500" {...props} />,
                                    ol: ({ node, ...props }) => <ol className="list-decimal list-inside text-slate-300 mb-4 space-y-1 marker:text-emerald-500" {...props} />,
                                    li: ({ node, ...props }) => <li className="text-slate-300" {...props} />,
                                    strong: ({ node, ...props }) => <strong className="font-semibold text-slate-100" {...props} />,
                                    code: ({ node, inline, className, children, ...props }: any) => {
                                        const match = /language-(\w+)/.exec(className || '');
                                        return inline ? (
                                            <code className="bg-emerald-950/40 border border-emerald-900/50 text-emerald-300 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                                                {children}
                                            </code>
                                        ) : (
                                            <pre className="bg-[#0f172a] border border-slate-800/80 p-4 rounded-lg overflow-x-auto text-slate-300 text-sm font-mono mb-4 shadow-inner">
                                                <code className={className} {...props}>
                                                    {children}
                                                </code>
                                            </pre>
                                        );
                                    },
                                    table: ({ node, ...props }) => <div className="overflow-x-auto mb-6 rounded-lg border border-slate-800/60 shadow-sm"><table className="w-full text-sm border-collapse" {...props} /></div>,
                                    thead: ({ node, ...props }) => <thead className="bg-[#0f172a] text-slate-200 text-left border-b border-emerald-900/40" {...props} />,
                                    th: ({ node, ...props }) => <th className="p-3 font-semibold whitespace-nowrap" {...props} />,
                                    tbody: ({ node, ...props }) => <tbody className="bg-slate-900/20 divide-y divide-slate-800/50" {...props} />,
                                    tr: ({ node, ...props }) => <tr className="hover:bg-slate-800/30 transition-colors" {...props} />,
                                    td: ({ node, ...props }) => <td className="p-3 text-slate-300" {...props} />,
                                    blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-emerald-500/50 pl-4 py-2 mt-4 mb-4 text-slate-400 italic bg-emerald-950/10 rounded-r shadow-sm" {...props} />,
                                    hr: ({ node, ...props }) => <hr className="border-slate-800/60 my-8" {...props} />
                                }}
                            >
                                {content}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-emerald-900/30 bg-[#0f172a] text-xs text-slate-500 flex justify-between font-mono">
                    <span>SCRATCHPAD VIEWER</span>
                    <span>PRESS ESC TO CLOSE</span>
                </div>
            </div>
        </div>
    );
};
