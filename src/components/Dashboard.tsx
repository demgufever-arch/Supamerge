import React, { useState, useEffect, useMemo } from 'react';
import { SupabaseNode, ClusterMetrics } from '../types';
import { buildHashRing, getNodeForKey, HashRingNode } from '../utils/hash';
import { Database, HardDrive, Cpu, Activity, Signal, RefreshCw, Zap, Plus, Terminal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import WorldMap from '@/components/ui/world-map';

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

  const connected = useMemo(() => nodes.filter(n => n.status === 'connected'), [nodes]);

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
      'sb-node-us-east': '#10b981',
      'sb-node-eu-west': '#14b8a6',
      'sb-node-ap-south': '#a855f7',
    };

    // Fallback for custom nodes
    if (!colors[nodeId]) {
      const hash = nodeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const customColors = ['#f59e0b', '#ec4899', '#14b8a6', '#f43f5e', '#10b981'];
      return customColors[hash % customColors.length];
    }
    return colors[nodeId];
  };

  const getNodeColorClass = (nodeId: string) => {
    const colors: { [key: string]: string } = {
      'sb-node-us-east': 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      'sb-node-eu-west': 'text-teal-400 border-teal-500/30 bg-teal-500/10',
      'sb-node-ap-south': 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    };
    return colors[nodeId] || 'text-amber-400 border-amber-500/30 bg-amber-500/10';
  };

  const regionCoords: Record<string, [number, number]> = {
    'us-east': [37, -78],
    'us-east-1': [37, -78],
    'us-east-2': [37, -78],
    'useast': [37, -78],
    'us-west': [37, -122],
    'us-west-1': [37, -122],
    'us-west-2': [37, -122],
    'uswest': [37, -122],
    'eu-west': [51, -0.1],
    'eu-west-1': [51, -0.1],
    'eu-west-2': [51, -0.1],
    'eu-west-3': [51, -0.1],
    'euwest': [51, -0.1],
    'eu-central': [50, 8],
    'eu-central-1': [50, 8],
    'eu-central-2': [50, 8],
    'eucentral': [50, 8],
    'eu-north': [59, 18],
    'eu-north-1': [59, 18],
    'eunorth': [59, 18],
    'ap-southeast': [-33, 151],
    'ap-southeast-1': [-33, 151],
    'ap-southeast-2': [-33, 151],
    'apsoutheast': [-33, 151],
    'ap-northeast': [35, 139],
    'ap-northeast-1': [35, 139],
    'ap-northeast-2': [35, 139],
    'apnortheast': [35, 139],
    'ap-south': [19, 73],
    'ap-south-1': [19, 73],
    'ap-south-2': [19, 73],
    'apsouth': [19, 73],
    'sa-east': [-23, -47],
    'sa-east-1': [-23, -47],
    'saeast': [-23, -47],
    'ca-central': [45, -75],
    'ca-central-1': [45, -75],
    'cacentral': [45, -75],
    'me-central': [25, 55],
    'me-central-1': [25, 55],
    'mecentral': [25, 55],
    'af-south': [-34, 18],
    'af-south-1': [-34, 18],
    'afsouth': [-34, 18],
  };

  const getRegionCoords = (region: string): [number, number] => {
    const key = region.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (regionCoords[key]) return regionCoords[key];
    for (const [rk, coords] of Object.entries(regionCoords)) {
      if (key.includes(rk) || rk.includes(key)) return coords;
    }
    return [0, 0];
  };

  const mapDots = useMemo(() => {
    const dots: { start: { lat: number; lng: number }; end: { lat: number; lng: number } }[] = [];
    for (let i = 0; i < connected.length; i++) {
      for (let j = i + 1; j < connected.length; j++) {
        const [sLat, sLng] = getRegionCoords(connected[i].region);
        const [eLat, eLng] = getRegionCoords(connected[j].region);
        if (sLat !== 0 || sLng !== 0 || eLat !== 0 || eLng !== 0) {
          dots.push({ start: { lat: sLat, lng: sLng }, end: { lat: eLat, lng: eLng } });
        }
      }
    }
    if (dots.length === 0) {
      return [];
    }
    return dots;
  }, [nodes]);

  return (
    <div className="space-y-6">
      {/* Cluster Banner */}
      <div className="relative overflow-hidden rounded-2xl p-6 backdrop-blur-xl" style={{ borderColor: 'var(--color-border)', border: '1px solid', backgroundColor: 'rgba(var(--color-surface-alt-rgb, 228 228 231), 0.5)' }}>
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-teal-500/10 blur-3xl" />

        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                Live Multi-Tenant Active
              </span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>• Distributed Storage Broker</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl" style={{ color: 'var(--color-text)' }}>
              Unified Supabase Memory
            </h1>
            <p className="mt-1.5 text-sm max-w-xl" style={{ color: 'var(--color-text-muted)' }}>
              Unifying Supabase databases into a single virtual data layer. Real-time consistent hashing distributes workloads across global regions dynamically.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-lg p-3 text-center min-w-[90px]" style={{ borderColor: 'var(--color-border)', border: '1px solid', backgroundColor: 'var(--color-surface-alt)' }}>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Status</div>
              <div className="mt-1 flex items-center justify-center gap-1.5 font-semibold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Online
              </div>
            </div>
            <div className="rounded-lg p-3 text-center min-w-[90px]" style={{ borderColor: 'var(--color-border)', border: '1px solid', backgroundColor: 'var(--color-surface-alt)' }}>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Nodes</div>
              <div className="mt-1 text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                {metrics.activeNodes} / {metrics.totalNodes}
              </div>
            </div>
            <div className="rounded-lg p-3 text-center min-w-[90px]" style={{ borderColor: 'var(--color-border)', border: '1px solid', backgroundColor: 'var(--color-surface-alt)' }}>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Avg Latency</div>
              <div className="mt-1 text-lg font-bold text-emerald-400">
                {metrics.averageLatencyMs}ms
              </div>
            </div>
          </div>
        </div>
      </div>

      {connected.length === 0 && (
        <div className="rounded-xl border backdrop-blur-sm p-8 text-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <Database className="h-7 w-7 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
            Get Started — Connect Your First Supabase Project
          </h2>
          <p className="mt-2 text-sm max-w-lg mx-auto leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            Add your Supabase project URL and anon key in the Cluster Console to start sharding data across databases.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-3 max-w-2xl mx-auto text-left">
            <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', border: '1px solid' }}>
              <div className="rounded-lg bg-emerald-500/10 w-8 h-8 flex items-center justify-center mb-3">
                <Terminal className="h-4 w-4 text-emerald-400" />
              </div>
              <h4 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>1. Add Project</h4>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                Go to Cluster Console and enter your Supabase project URL and anon key.
              </p>
            </div>
            <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', border: '1px solid' }}>
              <div className="rounded-lg bg-emerald-500/10 w-8 h-8 flex items-center justify-center mb-3">
                <Database className="h-4 w-4 text-emerald-400" />
              </div>
              <h4 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>2. Connect</h4>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                The app pings your project, creates tables, and pulls live metrics automatically.
              </p>
            </div>
            <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', border: '1px solid' }}>
              <div className="rounded-lg bg-emerald-500/10 w-8 h-8 flex items-center justify-center mb-3">
                <Zap className="h-4 w-4 text-emerald-400" />
              </div>
              <h4 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>3. Start Sharding</h4>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                Write KV records, upload files, or add vector memories. Everything replicates automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cluster Metrics Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* DB Capacity Card */}
        <Card size="sm" className="card-lift" style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(var(--color-surface-alt-rgb, 228 228 231), 0.2)' }}>
          <CardContent className="space-y-0">
            <div className="flex items-start justify-between">
              <div>
                 <CardDescription className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                   Pooled PostgreSQL Space
                 </CardDescription>
                <CardTitle className="mt-1 text-2xl font-bold font-sans" style={{ color: 'var(--color-text)' }}>
                  {formatBytes(metrics.usedDbBytes)}
                </CardTitle>
                 <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                   of {formatBytes(metrics.totalDbCapacityBytes)} combined limit
                 </p>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-400 border border-emerald-500/25">
                <Database className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, dbPercentage)}%` }}
                />
              </div>
               <div className="mt-2 flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
                 <span>{dbPercentage.toFixed(1)}% Allocated</span>
                 <span>{formatBytes(metrics.totalDbCapacityBytes - metrics.usedDbBytes)} Free</span>
               </div>
            </div>
          </CardContent>
        </Card>

        {/* File Storage Card */}
        <Card size="sm" className="card-lift" style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(var(--color-surface-alt-rgb, 228 228 231), 0.2)' }}>
          <CardContent className="space-y-0">
            <div className="flex items-start justify-between">
              <div>
                 <CardDescription className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                   Pooled Storage Capacity
                 </CardDescription>
                <CardTitle className="mt-1 text-2xl font-bold font-sans" style={{ color: 'var(--color-text)' }}>
                  {formatBytes(metrics.usedStorageBytes)}
                </CardTitle>
                 <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                   of {formatBytes(metrics.totalStorageCapacityBytes)} combined limit
                 </p>
              </div>
              <div className="rounded-lg bg-teal-500/10 p-2.5 text-teal-400 border border-teal-500/25">
                <HardDrive className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, storagePercentage)}%` }}
                />
              </div>
               <div className="mt-2 flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
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
                 <CardDescription className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                   Cluster High-Availability
                 </CardDescription>
                <CardTitle className="mt-1 text-2xl font-bold font-sans" style={{ color: 'var(--color-text)' }}>
                  {metrics.activeNodes > 1 ? 'High (2x Redundancy)' : 'No Redundancy'}
                </CardTitle>
                 <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                   Active Replication Factor: <span className="text-emerald-400 font-semibold">2x</span>
                 </p>
              </div>
              <div className="rounded-lg bg-purple-500/10 p-2.5 text-purple-400 border border-purple-500/25">
                <Cpu className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
               <div className="rounded p-2" style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', border: '1px solid', color: 'var(--color-text-muted)' }}>
                 <span className="block" style={{ color: 'var(--color-text-muted)' }}>Read Quorum</span>
                 <span className="font-semibold" style={{ color: 'var(--color-text)' }}>1 Node (Fastest)</span>
              </div>
               <div className="rounded p-2" style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', border: '1px solid', color: 'var(--color-text-muted)' }}>
                 <span className="block" style={{ color: 'var(--color-text-muted)' }}>Write Quorum</span>
                 <span className="font-semibold" style={{ color: 'var(--color-text)' }}>2 Nodes (Sync)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Node Latency Overview */}
      {connected.length > 0 && (
        <div className="rounded-xl backdrop-blur-sm p-5" style={{ borderColor: 'var(--color-border)', border: '1px solid', backgroundColor: 'rgba(var(--color-surface-alt-rgb, 228 228 231), 0.1)' }}>
          <h3 className="text-sm font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--color-text)' }}>
            <Signal className="h-4 w-4 text-emerald-400" />
            Node Latency Overview
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {connected.map((node) => {
              const lat = node.latency || 0;
              const barWidth = Math.min(100, (lat / 500) * 100);
              const isHigh = lat > 300;
              const isMedium = lat > 100;
              return (
                <div key={node.id} className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', border: '1px solid' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold font-mono" style={{ color: 'var(--color-text)' }}>{node.name}</span>
                    <span className={`text-[10px] font-mono font-bold ${isHigh ? 'text-rose-400' : isMedium ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {lat}ms
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${barWidth}%`,
                        background: isHigh
                          ? 'linear-gradient(90deg, #f43f5e, #e11d48)'
                          : isMedium
                          ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                          : 'linear-gradient(90deg, #10b981, #059669)',
                      }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
                    <span>{node.region}</span>
                    <span>{isHigh ? 'Degraded' : isMedium ? 'Elevated' : 'Optimal'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* World Map */}
      <WorldMap dots={mapDots} />

      {/* Topology and Hash Ring Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Interactive Hash Ring Visualization */}
        <div className="lg:col-span-2 rounded-xl backdrop-blur-sm p-5" style={{ borderColor: 'var(--color-border)', border: '1px solid', backgroundColor: 'rgba(var(--color-surface-alt-rgb, 228 228 231), 0.1)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                <Activity className="h-4 w-4 text-emerald-400" />
                Consistent Hashing Ring Topology
              </h3>
               <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
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
                className="flex-1 sm:w-44 rounded-lg px-3 py-1 text-xs focus:border-emerald-500 focus:outline-none" style={{ borderColor: 'var(--color-border)', border: '1px solid', backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text)' }}
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
                    <stop offset="50%" stopColor="#14b8a6" stopOpacity="0.5" />
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
                     <span className="font-mono text-[9px]" style={{ color: 'var(--color-text-muted)' }}>{node.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trace Info Column */}
            <div className="md:col-span-2 space-y-4">
              <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: 'rgba(var(--color-surface-alt-rgb, 228 228 231), 0.6)', borderColor: 'var(--color-border)', border: '1px solid' }}>
                <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text)' }}>
                  Routing Console
                </h4>
                
                {traceResult ? (
                  <div className="space-y-3 text-xs">
                     <div>
                       <span className="block" style={{ color: 'var(--color-text-muted)' }}>Analyzed Key</span>
                        <span className="font-mono font-bold block truncate px-2 py-1 rounded mt-1" style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', border: '1px solid', color: 'var(--color-text)' }}>
                         "{traceKey}"
                       </span>
                     </div>

                    <div className="grid grid-cols-2 gap-2">
                       <div>
                         <span className="block" style={{ color: 'var(--color-text-muted)' }}>32-Bit Hash</span>
                         <span className="font-mono block font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                           0x{traceResult.keyHash.toString(16).toUpperCase()}
                         </span>
                       </div>
                       <div>
                         <span className="block" style={{ color: 'var(--color-text-muted)' }}>Ring Angle</span>
                         <span className="font-mono block font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                           {Math.round(traceResult.keyAngle)}°
                         </span>
                       </div>
                    </div>

                      <div className="pt-2.5" style={{ borderColor: 'var(--color-border)', borderTop: '1px solid' }}>
                       <span className="block" style={{ color: 'var(--color-text-muted)' }}>Routed Target Node</span>
                      <div className="mt-1 flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono font-bold ${getNodeColorClass(traceResult.nodeId)}`}>
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: getNodeColor(traceResult.nodeId) }}
                          />
                          {nodes.find(n => n.id === traceResult.nodeId)?.name}
                        </span>
                         <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                           via vnode {traceResult.targetVNode?.label.split('(V-')[1]?.charAt(0)}
                         </span>
                      </div>
                    </div>
                  </div>
                ) : (
                   <div className="text-center py-6 space-y-2" style={{ color: 'var(--color-text-muted)' }}>
                     <Zap className="h-6 w-6 text-slate-600 mx-auto" />
                    <p className="text-xs">
                      Submit a database key to visualize how consistent hashing computes coordinates and routes data.
                    </p>
                  </div>
                )}
              </div>

              {/* Quick try options */}
              <div>
                 <span className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                   Quick-Test Keys
                 </span>
                <div className="flex flex-wrap gap-1.5">
                  {['user:profile:john', 'analytics:daily', 'session:token_901', 'app:config:features'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleQuickTrace(k)}
                        className="rounded px-2 py-0.5 font-mono text-[10px] hover:text-emerald-400 transition" style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', border: '1px solid', color: 'var(--color-text-muted)' }}
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
        <div className="rounded-xl backdrop-blur-sm p-5 flex flex-col justify-between space-y-4" style={{ borderColor: 'var(--color-border)', border: '1px solid', backgroundColor: 'rgba(var(--color-surface-alt-rgb, 228 228 231), 0.1)' }}>
          <div className="space-y-3">
            <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <Signal className="h-4 w-4 text-emerald-400" />
              Unified Replication Info
            </h3>
            
             <div className="space-y-2.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
               <p>
                 In a standard cluster, node failures cause data loss. SupaMerge overcomes this with a **Replication Factor (RF) of 2x**.
               </p>
              
               <div className="rounded-lg p-3 space-y-2" style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', border: '1px solid' }}>
                <div className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--color-text)' }}>
                  <div className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                  Primary Node (Hash Routing)
                </div>
                 <p className="text-[11px] leading-normal pl-3" style={{ color: 'var(--color-text-muted)' }}>
                   Keys are hashed and saved to the primary node on the consistent hash ring.
                 </p>
                
                <div className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--color-text)' }}>
                  <div className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                  Secondary Replica Node
                </div>
                 <p className="text-[11px] leading-normal pl-3" style={{ color: 'var(--color-text-muted)' }}>
                   The data is instantly duplicated on the *next active neighbor node* in clockwise order.
                 </p>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Hash Algorithm</span>
             <span className="font-mono bg-slate-900 px-1.5 py-0.5 rounded text-slate-300 border border-slate-800 text-[10px]">
              FNV-1a 32-bit
            </span>
          </div>
        </div>
      </div>

      {/* Nodes Status Grid */}
      <div>
        <h3 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
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
                          <h4 className="font-bold font-mono text-sm" style={{ color: 'var(--color-text)' }}>
                          {node.name}
                        </h4>
                      </div>
                       <span className="text-[11px] block mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
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
                         <span className="text-[10px] mt-1 font-mono" style={{ color: 'var(--color-text-muted)' }}>
                           {node.latency}ms
                         </span>
                      )}
                    </div>
                  </div>

                   {/* API Details */}
                   <div className="text-[11px] font-mono rounded bg-slate-950/40 p-2 border border-slate-900 space-y-0.5" style={{ color: 'var(--color-text-muted)' }}>
                     <div className="flex justify-between">
                       <span>URL:</span>
                       <span className="truncate max-w-[150px]">{node.url}</span>
                    </div>
                     <div className="flex justify-between">
                       <span>KEY:</span>
                       <span>{node.anonKey.substring(0, 15)}...</span>
                    </div>
                  </div>

                  {/* Resource Usage */}
                  {isOnline ? (
                    <div className="space-y-2.5">
                      {/* Database Progress */}
                      <div>
                         <div className="flex justify-between text-xs mb-1">
                           <span style={{ color: 'var(--color-text-muted)' }}>Database Space</span>
                           <span className="font-semibold font-mono" style={{ color: 'var(--color-text-muted)' }}>
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
                           <span style={{ color: 'var(--color-text-muted)' }}>Storage Buckets</span>
                           <span className="font-semibold font-mono" style={{ color: 'var(--color-text-muted)' }}>
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
