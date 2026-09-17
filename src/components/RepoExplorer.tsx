import React, { useState } from 'react';
import { REPO_CORE_FILES, RepoFile } from '../data/repoCodeData';
import { FileCode, Folder, GitBranch, Search, AlertCircle, Copy, Check } from 'lucide-react';

export const RepoExplorer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<RepoFile>(REPO_CORE_FILES[0]);
  const [search, setSearch] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const filteredFiles = REPO_CORE_FILES.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.path.toLowerCase().includes(search.toLowerCase()) ||
      f.subsystem.toLowerCase().includes(search.toLowerCase())
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = selectedFile.content.split('\n');

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center">
                <GitBranch className="w-3 h-3 mr-1" />
                WORKSPACE CLONE
              </span>
              <span className="text-xs text-slate-500 font-mono">
                ./AgentiOS-OX-ALPHA/ (github.com/infohas-Rabat224/AgentiOS-OX-ALPHA)
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              AgenticOS Cloned Repository Source Explorer
            </h2>
            <p className="text-xs text-slate-600">
              Direct source inspection from the cloned repository. Highlighted lines mark exact concurrency hazards and CPU hotspots.
            </p>
          </div>

          <div className="w-full sm:w-64">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-md border border-slate-300 bg-slate-50 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main File Explorer Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: File Tree List */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2 max-h-[750px] overflow-y-auto">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center">
            <Folder className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Core Module Files
          </div>
          <div className="space-y-1">
            {filteredFiles.map((f) => {
              const isSelected = f.path === selectedFile.path;
              return (
                <button
                  key={f.path}
                  onClick={() => setSelectedFile(f)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white hover:bg-slate-50 border-slate-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <FileCode
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? 'text-emerald-400' : 'text-slate-400'
                      }`}
                    />
                    <div className="truncate text-xs font-semibold">{f.name}</div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] mt-1 pl-6">
                    <span className={isSelected ? 'text-slate-300' : 'text-slate-500'}>
                      {f.subsystem}
                    </span>
                    <span
                      className={`font-mono ${
                        isSelected ? 'text-emerald-300' : 'text-slate-400'
                      }`}
                    >
                      {(f.sizeBytes / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Code Viewer */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-xl shadow-md flex flex-col overflow-hidden">
          {/* File Toolbar */}
          <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-mono text-slate-200">
              <FileCode className="w-4 h-4 text-emerald-400" />
              <span>{selectedFile.path}</span>
            </div>
            <button
              onClick={handleCopy}
              className="text-xs text-slate-400 hover:text-white flex items-center space-x-1 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Source'}</span>
            </button>
          </div>

          {/* Code Listing with Line Numbers */}
          <div className="p-4 flex-1 overflow-x-auto bg-slate-950 font-mono text-xs leading-relaxed max-h-[680px]">
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((line, idx) => {
                  const lineNum = idx + 1;
                  const isHighlighted = selectedFile.highlightedLines.includes(lineNum);
                  return (
                    <tr
                      key={idx}
                      className={
                        isHighlighted
                          ? 'bg-rose-950/60 text-rose-200 border-l-2 border-rose-500'
                          : 'hover:bg-slate-900/50 text-slate-300'
                      }
                    >
                      <td className="w-10 select-none text-slate-600 text-right pr-4 align-top text-[11px]">
                        {lineNum}
                      </td>
                      <td className="whitespace-pre overflow-x-visible align-top">
                        {line}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer note */}
          <div className="bg-slate-900/80 px-4 py-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center space-x-2">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>
              Highlighted red rows represent lines evaluated as severe concurrency or CPU bottlenecks during the forensic audit.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
