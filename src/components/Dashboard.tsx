import React, { useState, useEffect } from 'react';
import { SupabaseNode, ClusterMetrics } from '../types';
import { buildHashRing, getNodeForKey, HashRingNode } from '../utils/hash';
import { Database, HardDrive, Cpu, Activity, Signal, RefreshCw, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface DashboardProps {
  nodes: SupabaseNode[];
}

export default function Dashboard({
  nodes,
}: DashboardProps) {
  const [traceKey, setTraceKey] = useState('');
  const [traceResult, setTraceResult] = useState<{
    nodeId: string;
    keyHash: number;
    keyAngle: number;
    targetVNode: HashRingNode | null;
  } | null>(null);
  const [isTracing, setIsTracing] = useState(false);
  const [hashRing, setHashRing] = useState<HashRingNode[]>([]);

  // Build hash ring from active nodes
  useEffect(() => {
    const activeNodes = nodes.filter((n) => n.status === 'connected');
    setHashRing(buildHashRing(activeNodes, 4)); // 4 virtual nodes per physical node
  }, [nodes]);

  // Handle trace animation
  const handleTrace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!traceKey.trim()) return;

    setIsTracing(true);
    const result = getNodeForKey(traceKey, hashRing);
    
    // Simulate tracing animation delay
    setTimeout(() => {
      setTraceResult(result);
      setIsTracing(false);
    }, 600);
  };

  // Quick trace examples
  const handleQuickTrace = (key: string) => {
    setTraceKey(key);
    setIsTracing(true);
    const result = getNodeForKey(key, hashRing);
    setTimeout(() => {
      setTraceResult(result);
      setIsTracing(false);
    }, 500);
  };

  // Calculate cluster metrics
  const activeNodes = nodes.filter((n) => n.status === 'connected');
  const metrics: ClusterMetrics = {
    totalNodes: nodes.length,
    activeNodes: activeNodes.length,
    totalDbCapacityBytes: nodes.reduce((sum, n) => sum + n.dbLimitBytes, 0),
    usedDbBytes: nodes.reduce((sum, n) => sum + (n.status === 'connected' ? n.dbUsageBytes : 0), 0),
    totalStorageCapacityBytes: nodes.reduce((sum, n) => sum + n.storageLimitBytes, 0),
    usedStorageBytes: nodes.reduce((sum, n) => sum + (n.status === 'connected' ? n.storageUsageBytes : 0), 0),
    averageLatencyMs: activeNodes.length
      ? Math.round(activeNodes.reduce((sum, n) => sum + (n.latency || 0), 0) / activeNodes.length)
      : 0,
  };

  // Format bytes helper
  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const dbPercentage = metrics.totalDbCapacityBytes
    ? (metrics.usedDbBytes / metrics.totalDbCapacityBytes) * 100
    : 0;

  const storagePercentage = metrics.totalStorageCapacityBytes
    ? (metrics.usedStorageBytes / metrics.totalStorageCapacityBytes) * 100
    : 0;

  // Node colors for mapping in the hash ring
  const getNodeColor = (nodeId: string) => {
    const colors: { [key: string]: string } = {
      'sb-node-us-east': '#10b981', // Emerald
      'sb-node-eu-west': '#3b82f6', // Blue
      'sb-node-ap-south': '#a855f7', // Purple
    };
    
    // Fallback for custom nodes
    if (!colors[nodeId]) {
      const hash = nodeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const customColors = ['#f59e0b', '#ec4899', '#14b8a6', '#f43f5e', '#06b6d4'];
      return customColors[hash % customColors.length];
    }
    return colors[nodeId];
  };

  const getNodeColorClass = (nodeId: string) => {
    const colors: { [key: string]: string } = {
      'sb-node-us-east': 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      'sb-node-eu-west': 'text-blue-400 border-blue-500/30 bg-blue-500/10',
      'sb-node-ap-south': 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    };
    return colors[nodeId] || 'text-amber-400 border-amber-500/30 bg-amber-500/10';
  };

  return (
    <div className="space-y-6">
      {/* Cluster Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-xl">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                Live Multi-Tenant Active
              </span>
              <span className="text-xs text-slate-400">• Distributed Storage Broker</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
              Unified Supabase Memory
            </h1>
            <p className="mt-1.5 text-sm text-slate-400 max-w-xl">
              Pooling independent free-tier projects into a single virtual data layer. Real-time consistent hashing distributes workloads across global regions dynamically.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-center min-w-[90px]">
              <div className="text-xs text-slate-500">Status</div>
              <div className="mt-1 flex items-center justify-center gap-1.5 font-semibold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Online
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-center min-w-[90px]">
              <div className="text-xs text-slate-500">Nodes</div>
              <div className="mt-1 text-lg font-bold text-slate-200">
                {metrics.activeNodes} / {metrics.totalNodes}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-center min-w-[90px]">
              <div className="text-xs text-slate-500">Avg Latency</div>
              <div className="mt-1 text-lg font-bold text-emerald-400">
                {metrics.averageLatencyMs}ms
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* Cluster Metrics Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* DB Capacity Card */}
        <Card size="sm" className="border-slate-800 bg-slate-900/20 card-lift">
          <CardContent className="space-y-0">
            <div className="flex items-start justify-between">
              <div>
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Pooled PostgreSQL Space
                </CardDescription>
                <CardTitle className="mt-1 text-2xl font-bold text-slate-100 font-sans">
                  {formatBytes(metrics.usedDbBytes)}
                </CardTitle>
                <p className="mt-0.5 text-xs text-slate-400">
                  of {formatBytes(metrics.totalDbCapacityBytes)} combined limit
                </p>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-400 border border-emerald-500/25">
                <Database className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, dbPercentage)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-400">
                <span>{dbPercentage.toFixed(1)}% Allocated</span>
                <span>{formatBytes(metrics.totalDbCapacityBytes - metrics.usedDbBytes)} Free</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* File Storage Card */}
        <Card size="sm" className="border-slate-800 bg-slate-900/20 card-lift">
          <CardContent className="space-y-0">
            <div className="flex items-start justify-between">
              <div>
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Pooled Storage Capacity
                </CardDescription>
                <CardTitle className="mt-1 text-2xl font-bold text-slate-100 font-sans">
                  {formatBytes(metrics.usedStorageBytes)}
                </CardTitle>
                <p className="mt-0.5 text-xs text-slate-400">
                  of {formatBytes(metrics.totalStorageCapacityBytes)} combined limit
                </p>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-2.5 text-blue-400 border border-blue-500/25">
                <HardDrive className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, storagePercentage)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-400">
                <span>{storagePercentage.toFixed(1)}% Allocated</span>
                <span>{formatBytes(metrics.totalStorageCapacityBytes - metrics.usedStorageBytes)} Free</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* High-Availability Metrics */}
        <Card size="sm" className="border-slate-800 bg-slate-900/20 card-lift sm:col-span-2 lg:col-span-1">
          <CardContent className="space-y-0">
            <div className="flex items-start justify-between">
              <div>
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Cluster High-Availability
                </CardDescription>
                <CardTitle className="mt-1 text-2xl font-bold text-slate-100 font-sans">
                  {metrics.activeNodes > 1 ? 'High (2x Redundancy)' : 'No Redundancy'}
                </CardTitle>
                <p className="mt-0.5 text-xs text-slate-400">
                  Active Replication Factor: <span className="text-emerald-400 font-semibold">2x</span>
                </p>
              </div>
              <div className="rounded-lg bg-purple-500/10 p-2.5 text-purple-400 border border-purple-500/25">
                <Cpu className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-slate-950/40 p-2 border border-slate-800/60">
                <span className="block text-slate-500">Read Quorum</span>
                <span className="font-semibold text-slate-300">1 Node (Fastest)</span>
              </div>
              <div className="rounded bg-slate-950/40 p-2 border border-slate-800/60">
                <span className="block text-slate-500">Write Quorum</span>
                <span className="font-semibold text-slate-300">2 Nodes (Sync)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Topology and Hash Ring Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Interactive Hash Ring Visualization */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/10 p-5 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                Consistent Hashing Ring Topology
              </h3>
              <p className="text-xs text-slate-400">
                Keys hash to a 32-bit ring. They travel clockwise to find the nearest virtual node.
              </p>
            </div>
            {/* Trace key form */}
            <form onSubmit={handleTrace} className="flex gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={traceKey}
                onChange={(e) => setTraceKey(e.target.value)}
                placeholder="Enter key to trace..."
                className="flex-1 sm:w-44 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1 text-xs text-slate-300 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isTracing || !traceKey}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-xs font-semibold text-white transition disabled:opacity-50"
              >
                {isTracing ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
                Route
              </button>
            </form>
          </div>

          <div className="grid md:grid-cols-5 gap-6 items-center">
            {/* SVG Ring Column */}
            <div className="md:col-span-3 flex justify-center py-4 relative">
              <svg width="280" height="280" className="overflow-visible">
                {/* Outer Ring Track */}
                <circle
                  cx="140"
                  cy="140"
                  r="100"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="6"
                />
                
                {/* Animated Ring Track for Tracing */}
                <circle
                  cx="140"
                  cy="140"
                  r="100"
                  fill="none"
                  stroke="url(#ring-gradient)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  className="animate-[spin_100s_linear_infinite]"
                />

                <defs>
                  <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                    <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.2" />
                  </linearGradient>
                </defs>

                {/* Center Cluster Core */}
                <circle
                  cx="140"
                  cy="140"
                  r="35"
                  fill="#020617"
                  stroke="#334155"
                  strokeWidth="1.5"
                />
                <text
                  x="140"
                  y="138"
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="10"
                  fontWeight="bold"
                >
                  OMNI
                </text>
                <text
                  x="140"
                  y="148"
                  textAnchor="middle"
                  fill="#10b981"
                  fontSize="8"
                  fontWeight="bold"
                >
                  SHARD
                </text>

                {/* Draw Virtual Nodes on the Ring */}
                {hashRing.map((vnode) => {
                  const rad = (vnode.angle - 90) * (Math.PI / 180); // Offset by -90deg so 0 is at the top
                  const x = 140 + 100 * Math.cos(rad);
                  const y = 140 + 100 * Math.sin(rad);
                  const nodeColor = getNodeColor(vnode.nodeId);
                  const isTarget = traceResult?.targetVNode?.hash === vnode.hash;

                  return (
                    <g key={vnode.hash} className="group cursor-help">
                      {/* Highlight target node */}
                      {isTarget && (
                        <circle
                          cx={x}
                          cy={y}
                          r="12"
                          fill="none"
                          stroke={nodeColor}
                          strokeWidth="1.5"
                          className="animate-ping"
                        />
                      )}
                      {/* Connection line to center */}
                      <line
                        x1="140"
                        y1="140"
                        x2={x}
                        y2={y}
                        stroke={nodeColor}
                        strokeWidth="0.5"
                        strokeOpacity={isTarget ? 0.6 : 0.15}
                        strokeDasharray={isTarget ? '0' : '2 2'}
                      />
                      {/* Outer VNode Dot */}
                      <circle
                        cx={x}
                        cy={y}
                        r={isTarget ? 7 : 5}
                        fill={nodeColor}
                        stroke="#0f172a"
                        strokeWidth="1.5"
                        className="transition-all duration-300 group-hover:scale-125"
                      />
                      {/* Tooltip on hover */}
                      <title>{`${vnode.label}\nHash: 0x${vnode.hash.toString(16).toUpperCase()}\nAngle: ${Math.round(vnode.angle)}°`}</title>
                    </g>
                  );
                })}

                {/* Key Hash Marker (Rendered when trace is complete) */}
                {traceResult && (
                  (() => {
                    const rad = (traceResult.keyAngle - 90) * (Math.PI / 180);
                    const x = 140 + 100 * Math.cos(rad);
                    const y = 140 + 100 * Math.sin(rad);

                    // Find coordinate of target virtual node to draw path
                    const targetAngle = traceResult.targetVNode ? traceResult.targetVNode.angle : 0;
                    const targetRad = (targetAngle - 90) * (Math.PI / 180);
                    const targetX = 140 + 100 * Math.cos(targetRad);
                    const targetY = 140 + 100 * Math.sin(targetRad);

                    return (
                      <g>
                        {/* Curved sweep indicator showing routing path */}
                        <path
                          d={`M ${x} ${y} A 100 100 0 ${
                            (targetAngle - traceResult.keyAngle + 360) % 360 > 180 ? 1 : 0
                          } 1 ${targetX} ${targetY}`}
                          fill="none"
                          stroke="#e11d48"
                          strokeWidth="2"
                          strokeDasharray="4 2"
                          className="animate-[pulse_1.5s_infinite]"
                        />

                        {/* Pulsing Key Dot */}
                        <circle
                          cx={x}
                          cy={y}
                          r="6"
                          fill="#e11d48"
                          stroke="#fff"
                          strokeWidth="1.5"
                          className="animate-pulse"
                        />
                        
                        {/* Label */}
                        <g transform={`translate(${x > 140 ? x + 8 : x - 75}, ${y > 140 ? y + 12 : y - 8})`}>
                          <rect
                            width="68"
                            height="16"
                            rx="3"
                            fill="#e11d48"
                            opacity="0.9"
                          />
                          <text
                            x="34"
                            y="11"
                            textAnchor="middle"
                            fill="#fff"
                            fontSize="8"
                            fontWeight="bold"
                          >
                            KEY HASH
                          </text>
                        </g>
                      </g>
                    );
                  })()
                )}
              </svg>

              {/* Legend overlay */}
              <div className="absolute bottom-1 flex gap-4 text-[10px]">
                {nodes.map((node) => (
                  <div key={node.id} className="flex items-center gap-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: getNodeColor(node.id) }}
                    />
                    <span className="text-slate-400 font-mono text-[9px]">{node.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trace Info Column */}
            <div className="md:col-span-2 space-y-4">
              <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 p-4 space-y-3">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                  Routing Console
                </h4>
                
                {traceResult ? (
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">Analyzed Key</span>
                      <span className="font-mono font-bold text-slate-200 block truncate bg-slate-900 px-2 py-1 rounded border border-slate-800 mt-1">
                        "{traceKey}"
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-500 block">32-Bit Hash</span>
                        <span className="font-mono text-slate-300 block font-semibold">
                          0x{traceResult.keyHash.toString(16).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Ring Angle</span>
                        <span className="font-mono text-slate-300 block font-semibold">
                          {Math.round(traceResult.keyAngle)}°
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-slate-800 pt-2.5">
                      <span className="text-slate-500 block">Routed Target Node</span>
                      <div className="mt-1 flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono font-bold ${getNodeColorClass(traceResult.nodeId)}`}>
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: getNodeColor(traceResult.nodeId) }}
                          />
                          {nodes.find(n => n.id === traceResult.nodeId)?.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          via vnode {traceResult.targetVNode?.label.split('(V-')[1]?.charAt(0)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-500 space-y-2">
                    <Zap className="h-6 w-6 text-slate-600 mx-auto" />
                    <p className="text-xs">
                      Submit a database key to visualize how consistent hashing computes coordinates and routes data.
                    </p>
                  </div>
                )}
              </div>

              {/* Quick try options */}
              <div>
                <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Quick-Test Keys
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['user:profile:john', 'analytics:daily', 'session:token_901', 'app:config:features'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleQuickTrace(k)}
                      className="rounded bg-slate-900 hover:bg-slate-800 border border-slate-800/80 px-2 py-0.5 font-mono text-[10px] text-slate-400 hover:text-emerald-400 transition"
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Distributed Resilience Guide */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/10 p-5 backdrop-blur-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Signal className="h-4 w-4 text-emerald-400" />
              Unified Replication Info
            </h3>
            
            <div className="space-y-2.5 text-xs text-slate-400">
              <p>
                In a standard cluster, node failures cause data loss. SupaMerge overcomes this with a **Replication Factor (RF) of 2x**.
              </p>
              
              <div className="rounded-lg bg-slate-950/40 border border-slate-800/80 p-3 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  Primary Node (Hash Routing)
                </div>
                <p className="text-[11px] text-slate-500 leading-normal pl-3">
                  Keys are hashed and saved to the primary node on the consistent hash ring.
                </p>
                
                <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                  <div className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                  Secondary Replica Node
                </div>
                <p className="text-[11px] text-slate-500 leading-normal pl-3">
                  The data is instantly duplicated on the *next active neighbor node* in clockwise order.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
            <span className="text-slate-500">Hash Algorithm</span>
            <span className="font-mono bg-slate-900 px-1.5 py-0.5 rounded text-slate-300 border border-slate-800 text-[10px]">
              FNV-1a 32-bit
            </span>
          </div>
        </div>
      </div>

      {/* Nodes Status Grid */}
      <div>
        <h3 className="text-base font-bold text-slate-200 mb-4 flex items-center gap-2">
          <Database className="h-4 w-4 text-emerald-400" />
          Physical Nodes (Connected Supabase Projects)
        </h3>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {nodes.map((node) => {
            const nodeColor = getNodeColor(node.id);
            const isOnline = node.status === 'connected';
            const dbPercent = (node.dbUsageBytes / node.dbLimitBytes) * 100;
            const storagePercent = (node.storageUsageBytes / node.storageLimitBytes) * 100;
            
            return (
              <Card
                size="sm"
                className={`relative overflow-hidden border transition-all duration-300 card-lift ${
                  isOnline
                    ? 'border-slate-800 bg-slate-900/15 hover:border-slate-700'
                    : 'border-rose-950/50 bg-rose-950/5 opacity-70'
                }`}
              >
                {/* Glow Accent */}
                {isOnline && (
                  <div
                    className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{ backgroundColor: nodeColor }}
                  />
                )}

                <CardContent className="space-y-4 p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-100 font-mono text-sm">
                          {node.name}
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        {node.region}
                      </span>
                    </div>

                    <div className="flex flex-col items-end">
                      <Badge
                        variant={isOnline ? 'default' : 'destructive'}
                        className={`gap-1.5 px-2 py-0.5 text-xs font-semibold ${
                          isOnline ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15' : ''
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                          }`}
                        />
                        {isOnline ? 'Online' : 'Offline'}
                      </Badge>
                      {isOnline && (
                        <span className="text-[10px] text-slate-400 mt-1 font-mono">
                          {node.latency}ms
                        </span>
                      )}
                    </div>
                  </div>

                  {/* API Details */}
                  <div className="text-[11px] text-slate-500 font-mono rounded bg-slate-950/40 p-2 border border-slate-900 space-y-0.5">
                    <div className="flex justify-between">
                      <span>URL:</span>
                      <span className="text-slate-400 truncate max-w-[150px]">{node.url}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>KEY:</span>
                      <span className="text-slate-400">{node.anonKey.substring(0, 15)}...</span>
                    </div>
                  </div>

                  {/* Resource Usage */}
                  {isOnline ? (
                    <div className="space-y-2.5">
                      {/* Database Progress */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">Database Space</span>
                          <span className="text-slate-300 font-semibold font-mono">
                            {formatBytes(node.dbUsageBytes)} / {formatBytes(node.dbLimitBytes, 0)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${dbPercent}%`,
                              backgroundColor: nodeColor,
                            }}
                          />
                        </div>
                      </div>

                      {/* Storage Progress */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">Storage Buckets</span>
                          <span className="text-slate-300 font-semibold font-mono">
                            {formatBytes(node.storageUsageBytes)} / {formatBytes(node.storageLimitBytes, 0)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${storagePercent}%`,
                              backgroundColor: nodeColor,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-rose-500/5 border border-rose-500/10 p-3 text-center text-xs text-rose-300">
                      This node is offline. Hash routing will automatically bypass it and route requests to the next clockwise neighbor.
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
