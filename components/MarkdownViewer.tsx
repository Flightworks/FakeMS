import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, Type, Code } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MarkdownViewerProps {
  filename: string | null;
  onClose: () => void;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ filename, onClose }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [renderMode, setRenderMode] = useState<'markdown' | 'raw'>('markdown');

  useEffect(() => {
    if (!filename) return;

    setLoading(true);
    setError(null);
    setContent('');

    // Fetch the file from the public directory
    fetch(`${import.meta.env.BASE_URL}${filename}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to load file: ${res.status} ${res.statusText}`);
        }
        return res.text();
      })
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [filename]);

  if (!filename) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="fixed top-24 left-1/2 -translate-x-1/2 w-[800px] max-w-[95vw] h-[70vh] max-h-[800px] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl flex flex-col z-[150] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-2 text-slate-200 font-mono text-sm">
            <span className="text-emerald-500 font-bold">{filename.toUpperCase()}</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Render Toggle */}
            <div className="flex bg-slate-950 rounded-md border border-slate-700 p-0.5">
              <button
                onClick={() => setRenderMode('markdown')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono transition-colors ${
                  renderMode === 'markdown' ? 'bg-emerald-900/50 text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                }`}
                title="Rendered Markdown"
              >
                <Type size={14} /> MD
              </button>
              <button
                onClick={() => setRenderMode('raw')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono transition-colors ${
                  renderMode === 'raw' ? 'bg-emerald-900/50 text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                }`}
                title="Raw Text"
              >
                <Code size={14} /> RAW
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-red-400 hover:bg-slate-800 p-1 rounded transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {loading && (
            <div className="flex items-center justify-center h-full text-emerald-500 animate-pulse font-mono text-sm">
              LOADING {filename}...
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full text-red-400 font-mono text-sm gap-2">
              <span className="text-3xl border border-red-500/30 p-2 rounded-full mb-2">⚠</span>
              ERROR: {error}
            </div>
          )}

          {!loading && !error && (
            <div className="text-slate-300">
              {renderMode === 'raw' ? (
                <pre className="font-mono text-sm whitespace-pre-wrap leading-relaxed text-slate-400">
                  {content}
                </pre>
              ) : (
                <div className="prose prose-invert prose-emerald max-w-none
                  prose-headings:text-slate-100 prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl
                  prose-p:text-slate-300 prose-p:leading-relaxed
                  prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline
                  prose-strong:text-slate-200
                  prose-ul:text-slate-300 prose-li:marker:text-emerald-500
                  prose-table:border-collapse prose-table:w-full prose-table:text-sm prose-table:border prose-table:border-slate-700
                  prose-th:border-slate-700 prose-th:bg-slate-800/80 prose-th:p-2 prose-th:text-left prose-th:text-slate-200
                  prose-td:border-slate-700 prose-td:p-2 prose-td:text-slate-300
                  prose-tr:border-b prose-tr:border-slate-700
                ">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
