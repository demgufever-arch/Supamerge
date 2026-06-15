import React, { useState, useEffect, useMemo } from 'react';
import { SupabaseNode, VectorMemory } from '../types';
import { generateMockEmbedding } from '../utils/embedding';
import { Brain, Search, Plus, Sparkles, Database, HelpCircle, User, Clock, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface VectorMemoryProps {
  nodes: SupabaseNode[];
  memories: VectorMemory[];
  onAddMemory: (content: string, category: string, agentName: string) => Promise<void>;
  onSearchMemories: (queryText: string, limit: number) => Promise<VectorMemory[]>;
  onDeleteMemory: (memoryId: string) => Promise<void>;
  isSandbox: boolean;
}

// Deterministic high-dimensional anchor vectors for 2D Projection
// Generated once using a simple pseudo-random algorithm so the projection is stable
const ANCHOR_X = new Array(384).fill(0).map((_, i) => Math.sin(i * 1.73));
const ANCHOR_Y = new Array(384).fill(0).map((_, i) => Math.cos(i * 2.89));

// Normalize anchor vectors
const normVector = (v: number[]) => {
  const mag = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
  return v.map(val => val / mag);
};
const NORM_ANCHOR_X = normVector(ANCHOR_X);
const NORM_ANCHOR_Y = normVector(ANCHOR_Y);

export default function VectorMemoryComponent({
  nodes,
  memories,
  onAddMemory,
  onSearchMemories,
  onDeleteMemory,
  isSandbox,
}: VectorMemoryProps) {
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('user_preferences');
  const [newAgentName, setNewAgentName] = useState('SupaBot-UX');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VectorMemory[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStats, setSearchStats] = useState<{
    totalSearched: number;
    nodesQueried: number;
    timeMs: number;
  } | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<'explore' | 'add'>('explore');
  const [hoveredMemory, setHoveredMemory] = useState<VectorMemory | null>(null);

  // Auto-search when query is cleared
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchStats(null);
    }
  }, [searchQuery]);

  // Handle Memory Creation
  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    setIsAdding(true);
    try {
      await onAddMemory(newContent.trim(), newCategory, newAgentName);
      setNewContent('');
      setActiveTab('explore');
      // If there's an active search, re-run it
      if (searchQuery.trim()) {
        handleSearch(new Event('submit') as any);
      }
    } catch (err) {
      alert(`Failed to add memory: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsAdding(false);
    }
  };

  // Handle Parallel Distributed Vector Search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    const start = performance.now();

    try {
      // Search all nodes in parallel (triggered via parent)
      const results = await onSearchMemories(searchQuery.trim(), 5);
      const end = performance.now();

      setSearchResults(results);
      setSearchStats({
        totalSearched: memories.length,
        nodesQueried: nodes.filter(n => n.status === 'connected').length,
        timeMs: Math.round(end - start),
      });
    } catch (err) {
      alert(`Search failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Project 384-dimensional vector into 2D coordinates for the canvas
  // We use dot products with two orthogonal anchor vectors to get x, y in range [-1, 1]
  const projectVector = (embedding: number[]) => {
    let x = 0;
    let y = 0;
    
    for (let i = 0; i < embedding.length; i++) {
      x += embedding[i] * NORM_ANCHOR_X[i];
      y += embedding[i] * NORM_ANCHOR_Y[i];
    }
    
    // Scale and shift to fit in a 0-100 percentage box
    // High-dimensional vectors projected tend to cluster near the center, so we apply a zoom multiplier
    const zoom = 4.5;
    const xPct = Math.max(5, Math.min(95, 50 + (x * 50 * zoom)));
    const yPct = Math.max(5, Math.min(95, 50 + (y * 50 * zoom)));
    
    return { x: xPct, y: yPct };
  };

  // Pre-calculate positions of all memories
  const projectedMemories = useMemo(() => {
    return memories.map((mem) => {
      const { x, y } = projectVector(mem.embedding);
      return {
        ...mem,
        x,
        y,
      };
    });
  }, [memories]);

  // Project the active search query if present
  const projectedQuery = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const queryEmbedding = generateMockEmbedding(searchQuery);
    const { x, y } = projectVector(queryEmbedding);
    return { x, y };
  }, [searchQuery]);

  // Node coloring helpers
  const getNodeColor = (nodeId: string) => {
    const colors: { [key: string]: string } = {
      'sb-node-us-east': '#10b981', // Emerald
      'sb-node-eu-west': '#3b82f6', // Blue
      'sb-node-ap-south': '#a855f7', // Purple
    };
    return colors[nodeId] || '#f59e0b';
  };

  const getNodeName = (nodeId: string) => {
    return nodes.find((n) => n.id === nodeId)?.name || nodeId;
  };

  const getCategoryColor = (cat: string) => {
    const colors: { [key: string]: string } = {
      user_preferences: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      infrastructure: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      branding: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      security: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      general: 'bg-slate-800 text-slate-400 border-slate-700',
    };
    return colors[cat] || colors.general;
  };

  const formatCategory = (cat: string) => {
    return cat.replace('_', ' ').toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Brain className="h-6 w-6 text-emerald-400" />
            Unified Vector Memory
            <span className="text-xs font-normal rounded-full bg-slate-800 text-slate-300 px-2.5 py-0.5 border border-slate-700">
              {isSandbox ? 'Sandbox' : 'Live'}
            </span>
          </h1>
          <p className="text-sm text-slate-400">
            A distributed semantic database storing high-dimensional embeddings. Queries all Supabase databases in parallel to retrieve AI agent long-term memory.
          </p>
        </div>

        <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 self-start sm:self-center">
          <Button
            variant={activeTab === 'explore' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('explore')}
            className={`rounded-md px-3 py-1.5 text-xs ${activeTab === 'explore' ? 'bg-slate-700 text-white' : ''}`}
          >
            Semantic Explorer
          </Button>
          <Button
            variant={activeTab === 'add' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('add')}
            className={`rounded-md px-3 py-1.5 text-xs ${activeTab === 'add' ? 'bg-slate-700 text-white' : ''}`}
          >
            Add Memory Chunk
          </Button>
        </div>
      </div>

      {activeTab === 'explore' && (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left/Middle Column: Search Panel and Results */}
          <div className="lg:col-span-3 space-y-4">
            {/* Search Input */}
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-500" />
                <Input
                  type="text"
                  placeholder="Ask a question or enter a semantic query..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 bg-slate-900/40 border-slate-800"
                />
              </div>
              <Button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {isSearching ? (
                  <>
                    <Clock className="h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Query
                  </>
                )}
              </Button>
            </form>

            {/* Parallel Search Diagnostics Banner */}
            {searchStats && (
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3 flex items-center justify-between text-xs text-emerald-400">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-emerald-400" />
                  <span>
                    Parallel Distributed Vector Search: Checked{' '}
                    <strong>{searchStats.totalSearched}</strong> vectors across{' '}
                    <strong>{searchStats.nodesQueried}</strong> active databases.
                  </span>
                </div>
                <span className="font-mono bg-emerald-500/10 px-2 py-0.5 rounded text-[10px]">
                  Merged in {searchStats.timeMs}ms
                </span>
              </div>
            )}

            {/* Results / All Memories Grid */}
            <div className="space-y-3">
              {searchQuery.trim() ? (
                // Search Results View
                <>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Semantic Matches (Cosine Similarity)
                  </h3>
                  {searchResults.length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/5 py-12 text-center text-slate-500 text-sm">
                      No matching memories found. Try adjusting your search query.
                    </div>
                  ) : (
                    searchResults.map((mem) => (
                      <div
                        key={mem.id}
                        onMouseEnter={() => setHoveredMemory(mem)}
                        onMouseLeave={() => setHoveredMemory(null)}
                        className="group relative rounded-xl border border-slate-800 bg-slate-900/10 p-4 hover:border-emerald-500/40 hover:bg-slate-900/35 transition duration-200"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <p className="text-sm text-slate-200 leading-relaxed">
                              {mem.content}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-[10px]">
                              <span className={`rounded px-1.5 py-0.5 font-semibold border ${getCategoryColor(mem.metadata.category)}`}>
                                {formatCategory(mem.metadata.category)}
                              </span>
                              <span className="text-slate-500 flex items-center gap-0.5 font-mono">
                                <User className="h-3 w-3 text-slate-600" />
                                {mem.metadata.agentName}
                              </span>
                              <span className="text-slate-500 flex items-center gap-0.5 font-mono">
                                <Clock className="h-3 w-3 text-slate-600" />
                                {new Date(mem.metadata.timestamp).toLocaleDateString()}
                              </span>
                              <span className="font-mono font-bold text-[10px]" style={{ color: getNodeColor(mem.nodeId) }}>
                                @{getNodeName(mem.nodeId)}
                              </span>
                            </div>
                          </div>

                          {/* Similarity Badge */}
                          {mem.similarity !== undefined && (
                            <div className="text-right shrink-0">
                              <span className="text-xs font-semibold text-slate-400 block">Match Score</span>
                              <span className="font-mono text-base font-extrabold text-emerald-400">
                                {Math.round(mem.similarity * 100)}%
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={() => onDeleteMemory(mem.id)}
                          className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 rounded bg-slate-950 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 p-1 text-slate-500 hover:text-rose-400 transition"
                          title="Delete Memory"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                      </div>
                    ))
                  )}
                </>
              ) : (
                // All Memories View
                <>
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      All Stored Memory Chunks ({memories.length})
                    </h3>
                  </div>
                  {memories.length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/5 py-12 text-center text-slate-500 text-sm">
                      Memory bank is empty. Write memories to populate the cluster.
                    </div>
                  ) : (
                    memories.map((mem) => (
                      <div
                        key={mem.id}
                        onMouseEnter={() => setHoveredMemory(mem)}
                        onMouseLeave={() => setHoveredMemory(null)}
                        className="group relative rounded-xl border border-slate-800 bg-slate-900/10 p-4 hover:border-slate-700 transition duration-200"
                      >
                        <div className="space-y-2">
                          <p className="text-sm text-slate-200 leading-relaxed">
                            {mem.content}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-[10px]">
                            <Badge className={`px-1.5 py-0.5 text-[10px] font-semibold border ${getCategoryColor(mem.metadata.category)}`}>
                              {formatCategory(mem.metadata.category)}
                            </Badge>
                            <span className="text-slate-500 flex items-center gap-0.5 font-mono">
                              <User className="h-3 w-3 text-slate-600" />
                              {mem.metadata.agentName}
                            </span>
                            <span className="text-slate-500 flex items-center gap-0.5 font-mono">
                              <Clock className="h-3 w-3 text-slate-600" />
                              {new Date(mem.metadata.timestamp).toLocaleDateString()}
                            </span>
                            <Badge
                              variant="outline"
                              className="font-mono font-bold text-[10px] px-1.5 py-0.5 border-slate-700"
                              style={{ color: getNodeColor(mem.nodeId), borderColor: `${getNodeColor(mem.nodeId)}40` }}
                            >
                              @{getNodeName(mem.nodeId)}
                            </Badge>
                          </div>
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={() => onDeleteMemory(mem.id)}
                          className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 rounded bg-slate-950 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 p-1.5 text-slate-500 hover:text-rose-400 transition"
                          title="Delete Memory"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right Column: 2D Vector Space Projection Map */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/10 p-5 backdrop-blur-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                  <BarChart2 className="h-4 w-4 text-emerald-400" />
                  2D Vector Space Map
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                  Mathematical 2D projection of 384-dimensional vector embeddings. Proximity indicates semantic similarity.
                </p>
              </div>

              {/* Vector Space Plotting Area */}
              <div className="relative aspect-square w-full rounded-xl border border-slate-800 bg-slate-950/85 overflow-hidden">
                {/* Grid Lines */}
                <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <React.Fragment key={i}>
                      <div className="border-r border-slate-900/60" style={{ gridColumnStart: i + 2 }} />
                      <div className="border-b border-slate-900/60" style={{ gridRowStart: i + 2 }} />
                    </React.Fragment>
                  ))}
                </div>

                {/* Draw Vector Nodes as dots */}
                {projectedMemories.map((mem) => {
                  const isHovered = hoveredMemory?.id === mem.id;
                  const isSearchResult = searchResults.some(r => r.id === mem.id);
                  const nodeColor = getNodeColor(mem.nodeId);

                  return (
                    <div
                      key={mem.id}
                      onMouseEnter={() => setHoveredMemory(mem)}
                      onMouseLeave={() => setHoveredMemory(null)}
                      className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 transition-all duration-300"
                      style={{
                        left: `${mem.x}%`,
                        top: `${mem.y}%`,
                      }}
                    >
                      {/* Pulsing ring around search results */}
                      {isSearchResult && (
                        <span
                          className="absolute -inset-2.5 rounded-full border border-emerald-400/80 animate-[ping_1.5s_infinite]"
                          style={{ borderColor: nodeColor }}
                        />
                      )}
                      {/* Highlighting hovered points */}
                      <span
                        className={`absolute rounded-full transition-all duration-200 ${
                          isHovered
                            ? 'h-4 w-4 -inset-0.5 opacity-40 animate-pulse'
                            : isSearchResult
                            ? 'h-3.5 w-3.5 -inset-0.25 opacity-20'
                            : 'h-0 w-0'
                        }`}
                        style={{ backgroundColor: nodeColor }}
                      />
                      {/* Main Dot */}
                      <span
                        className={`block rounded-full border border-slate-950 transition-all duration-200 ${
                          isHovered ? 'scale-150 h-3 w-3 shadow-lg shadow-black' : 'h-2 w-2'
                        }`}
                        style={{ backgroundColor: nodeColor }}
                      />
                    </div>
                  );
                })}

                {/* Draw Query Target Dot */}
                {projectedQuery && (
                  <div
                    className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
                    style={{
                      left: `${projectedQuery.x}%`,
                      top: `${projectedQuery.y}%`,
                    }}
                  >
                    <span className="absolute inset-0 rounded-full bg-rose-500/20 border-2 border-rose-500 animate-ping" />
                    <span className="absolute inset-1 rounded-full bg-rose-500 border border-white" />
                  </div>
                )}

                {/* Connection lines from query to search results */}
                {projectedQuery && searchResults.length > 0 && (
                  <svg className="absolute inset-0 h-full w-full pointer-events-none">
                    {searchResults.map((res) => {
                      const resProj = projectedMemories.find(p => p.id === res.id);
                      if (!resProj) return null;
                      return (
                        <line
                          key={res.id}
                          x1={`${projectedQuery.x}%`}
                          y1={`${projectedQuery.y}%`}
                          x2={`${resProj.x}%`}
                          y2={`${resProj.y}%`}
                          stroke="#ef4444"
                          strokeWidth="1"
                          strokeDasharray="2 2"
                          strokeOpacity="0.7"
                          className="animate-[dash_2s_linear_infinite]"
                        />
                      );
                    })}
                  </svg>
                )}

                {/* Empty State Instructions */}
                {memories.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-xs text-slate-500">
                    Write memories to populate the coordinate space map!
                  </div>
                )}
              </div>

              {/* Hover Legend Box */}
              <div className="rounded-lg bg-slate-950/40 border border-slate-800 p-3 min-h-[90px] flex flex-col justify-between">
                {hoveredMemory ? (
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] font-bold" style={{ color: getNodeColor(hoveredMemory.nodeId) }}>
                        @{getNodeName(hoveredMemory.nodeId)}
                      </span>
                      <span className="text-[9px] text-slate-500">
                        {formatCategory(hoveredMemory.metadata.category)}
                      </span>
                    </div>
                    <p className="text-slate-300 line-clamp-2 italic leading-relaxed">
                      "{hoveredMemory.content}"
                    </p>
                  </div>
                ) : (
                  <div className="text-slate-500 text-[11px] leading-normal flex items-center gap-2 py-2">
                    <HelpCircle className="h-4 w-4 shrink-0 text-slate-600" />
                    <span>Hover over any data node in the vector space to inspect its content and region index in real-time.</span>
                  </div>
                )}
              </div>
            </div>

            {/* AI Unified Memory Explanation */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/10 p-5 backdrop-blur-sm text-xs text-slate-400 space-y-2.5">
              <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                Why Unified Vector Memory?
              </h4>
              <p className="leading-relaxed">
                Modern AI agents rely on **Retrieval-Augmented Generation (RAG)**. They need high-capacity vector stores to remember long-term context.
              </p>
              <p className="leading-relaxed">
                Supabase Free Tier projects provide pgvector but limit database space. By combining multiple free-tier databases into a unified vector store, you get N times the memory capacity!
              </p>
              <p className="leading-relaxed">
                When an agent queries its memory, our system queries all databases in parallel and merges the results instantly, bypassing the single-instance resource constraints!
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'add' && (
        <div className="max-w-2xl mx-auto rounded-xl border border-slate-800 bg-slate-900/15 p-6 backdrop-blur-sm space-y-4">
          <h3 className="text-base font-bold text-slate-200 flex items-center gap-1.5">
            <Plus className="h-5 w-5 text-emerald-400" />
            Add Semantic Memory Chunk
          </h3>

          <form onSubmit={handleAddMemory} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Memory Content (AI Context)
              </label>
              <textarea
                required
                rows={4}
                placeholder="Type the context or facts you want the AI agent to remember (e.g., 'User likes their coffee black, prefers VS Code as their main IDE, and works in Eastern Standard Time')..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                disabled={isAdding}
                className="w-full text-sm rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:outline-none leading-relaxed"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Category
                </label>
                <Select value={newCategory} onValueChange={setNewCategory} disabled={isAdding}>
                  <SelectTrigger className="w-full text-xs border-slate-800 bg-slate-950 text-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-950 text-slate-300">
                    <SelectItem value="user_preferences">User Preferences</SelectItem>
                    <SelectItem value="infrastructure">Infrastructure & Ops</SelectItem>
                    <SelectItem value="branding">Design & Branding</SelectItem>
                    <SelectItem value="security">Security & Policies</SelectItem>
                    <SelectItem value="general">General Context</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Agent Name (Originator)
                </label>
                <Input
                  type="text"
                  required
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  disabled={isAdding}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isAdding || !newContent.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isAdding ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  Generating Embedding & Sharding...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" />
                  Commit Memory to Cluster
                </>
              )}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
