import React, { useState } from 'react';
import { SupabaseNode, KVRecord } from '../types';
import { getNodeForKey, buildHashRing } from '../utils/hash';
import { Search, Database, RefreshCw, Plus, Edit2, Trash2, Key, HelpCircle, Eye, ShieldAlert, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface KVStoreProps {
  nodes: SupabaseNode[];
  records: KVRecord[];
  onAddRecord: (key: string, value: unknown, tags: string[]) => Promise<{ primary: string; replica: string }>;
  onDeleteRecord: (key: string) => Promise<void>;
  isSandbox: boolean;
}

export default function KVStore({
  nodes,
  records,
  onAddRecord,
  onDeleteRecord,
  isSandbox,
}: KVStoreProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('{\n  "status": "active",\n  "count": 1\n}');
  const [newTags, setNewTags] = useState('');
  
  const [isWriting, setIsWriting] = useState(false);
  const [writeLogs, setWriteLogs] = useState<string[]>([]);
  const [writeVisual, setWriteVisual] = useState<{
    key: string;
    hash: number;
    primaryNode: string;
    replicaNode: string;
  } | null>(null);

  const [selectedRecord, setSelectedRecord] = useState<KVRecord | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'explore' | 'write'>('explore');

  // Node coloring helpers
  const getNodeColorClass = (nodeId: string) => {
    const colors: { [key: string]: string } = {
      'sb-node-us-east': 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      'sb-node-eu-west': 'text-blue-400 border-blue-500/30 bg-blue-500/10',
      'sb-node-ap-south': 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    };
    return colors[nodeId] || 'text-amber-400 border-amber-500/30 bg-amber-500/10';
  };

  const getNodeName = (nodeId: string) => {
    return nodes.find((n) => n.id === nodeId)?.name || nodeId;
  };

  // Validate JSON on change
  const handleJsonChange = (val: string) => {
    setNewValue(val);
    try {
      if (!val.trim()) {
        setJsonError('Value cannot be empty');
        return;
      }
      JSON.parse(val);
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  // Handle Write operation
  const handleWrite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || jsonError) return;

    let parsedValue;
    try {
      parsedValue = JSON.parse(newValue);
    } catch (e) {
      setJsonError('Invalid JSON');
      return;
    }

    setIsWriting(true);
    setWriteLogs([]);
    setActiveTab('write');

    const key = newKey.trim();
    const tags = newTags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    // Build hash ring to show the hashing calculation in the UI logs
    const activeNodes = nodes.filter((n) => n.status === 'connected');
    const ring = buildHashRing(activeNodes, 4);
    const routing = getNodeForKey(key, ring);

    // Logs for visual appeal and education
    setWriteLogs((prev) => [...prev, `[1/4] Intercepting write request for key: "${key}"`]);
    
    await new Promise((r) => setTimeout(r, 400));
    setWriteLogs((prev) => [
      ...prev,
      `[2/4] FNV-1a Hash: 0x${routing.keyHash.toString(16).toUpperCase()} | Ring Coordinate: ${Math.round(routing.keyAngle)}°`,
    ]);

    // Calculate replica
    let replicaId = '';
    if (activeNodes.length > 1) {
      const primaryIndex = activeNodes.findIndex((n) => n.id === routing.nodeId);
      const replicaNode = activeNodes[(primaryIndex + 1) % activeNodes.length];
      replicaId = replicaNode.id;
    }

    await new Promise((r) => setTimeout(r, 400));
    setWriteLogs((prev) => [
      ...prev,
      `[3/4] Routing primary write to node: "${getNodeName(routing.nodeId)}"`,
    ]);
    if (replicaId) {
      setWriteLogs((prev) => [
        ...prev,
        `[3.5/4] Routing backup replica write to node: "${getNodeName(replicaId)}" (Replication Factor 2x)`,
      ]);
    }

    setWriteVisual({
      key,
      hash: routing.keyHash,
      primaryNode: routing.nodeId,
      replicaNode: replicaId,
    });

    try {
      // Trigger actual add
      await onAddRecord(key, parsedValue, tags);
      
      await new Promise((r) => setTimeout(r, 500));
      setWriteLogs((prev) => [...prev, `[4/4] Write SUCCESS! Confirmed sync across cluster.`]);
      
      // Reset form
      setNewKey('');
      setNewTags('');
      
      setTimeout(() => {
        setIsWriting(false);
        setWriteVisual(null);
        setActiveTab('explore');
      }, 1500);
    } catch (err) {
      setWriteLogs((prev) => [...prev, `[ERROR] Write failed: ${err instanceof Error ? err.message : 'Unknown error'}`]);
      setIsWriting(false);
    }
  };

  // Filter records
  const filteredRecords = records.filter((rec) => {
    const keyMatch = rec.key.toLowerCase().includes(searchQuery.toLowerCase());
    const tagMatch = rec.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return keyMatch || tagMatch;
  });

  // Calculate approximate byte size of record
  const getRecordSize = (rec: KVRecord) => {
    const str = JSON.stringify(rec.value) + rec.key + rec.tags.join('');
    return str.length;
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            <Key className="h-6 w-6 text-emerald-400" />
            Sharded Key-Value Store
            <span className="text-xs font-normal rounded-full px-2.5 py-0.5 border" style={{ backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}>
              {isSandbox ? 'Sandbox' : 'Live'}
            </span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Store and retrieve arbitrary JSON structures distributed across your Supabase databases.
          </p>
        </div>

        <div className="flex rounded-lg border p-0.5 self-start sm:self-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-alt)' }}>
          <Button
            variant={activeTab === 'explore' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('explore')}
            className={`rounded-md px-3 py-1.5 text-xs ${activeTab === 'explore' ? 'text-white' : ''}`}
            style={activeTab === 'explore' ? { backgroundColor: 'var(--color-surface-alt)' } : {}}
          >
            Explore Records ({filteredRecords.length})
          </Button>
          <Button
            variant={activeTab === 'write' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('write')}
            className={`rounded-md px-3 py-1.5 text-xs ${activeTab === 'write' ? 'text-white' : ''}`}
            style={activeTab === 'write' ? { backgroundColor: 'var(--color-surface-alt)' } : {}}
          >
            Write New Key
          </Button>
        </div>
      </div>

      {activeTab === 'explore' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Grid: Explorer List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
              <Input
                type="text"
                placeholder="Search by key name or tag (e.g., 'user', 'config')..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10" style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)' }}
              />
            </div>

            {/* KV List Table */}
            <div className="overflow-hidden rounded-xl backdrop-blur-sm" style={{ borderColor: 'var(--color-border)', border: '1px solid', backgroundColor: 'rgba(var(--color-surface-alt-rgb, 240 249 255), 0.1)' }}>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent" style={{ borderColor: 'var(--color-border)' }}>
                   <TableHead className="text-xs font-semibold uppercase tracking-wider px-4 py-3" style={{ color: 'var(--color-text-muted)' }}>Key Name</TableHead>
                   <TableHead className="text-xs font-semibold uppercase tracking-wider px-4 py-3" style={{ color: 'var(--color-text-muted)' }}>Primary Node</TableHead>
                   <TableHead className="text-xs font-semibold uppercase tracking-wider px-4 py-3" style={{ color: 'var(--color-text-muted)' }}>Replica Node</TableHead>
                   <TableHead className="text-xs font-semibold uppercase tracking-wider px-4 py-3 text-right" style={{ color: 'var(--color-text-muted)' }}>Size</TableHead>
                   <TableHead className="text-xs font-semibold uppercase tracking-wider px-4 py-3 text-right" style={{ color: 'var(--color-text-muted)' }}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.length === 0 ? (
                    <TableRow className="hover:bg-transparent" style={{ borderColor: 'var(--color-border)' }}>
                       <TableCell colSpan={5} className="px-4 py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
                          <Database className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
                         No records found matching your search.
                       </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecords.map((rec) => {
                      const primaryNode = nodes.find((n) => n.id === rec.nodeId);
                      const replicaNode = rec.replicaNodeId ? nodes.find((n) => n.id === rec.replicaNodeId) : null;
                      
                      const isPrimaryOnline = primaryNode?.status === 'connected';
                      const isReplicaOnline = replicaNode ? replicaNode.status === 'connected' : false;
                      const sizeBytes = getRecordSize(rec);

                      return (
                        <TableRow
                          key={rec.key}
                           className={`font-mono text-xs ${
                             selectedRecord?.key === rec.key ? '' : ''
                           }`}
                           style={{
                             borderColor: 'var(--color-border)',
                             ...(selectedRecord?.key === rec.key ? { backgroundColor: 'var(--color-surface-alt)' } : {})
                           }}
                        >
                          <TableCell className="px-4 py-3.5 font-bold select-all max-w-[180px] truncate" style={{ color: 'var(--color-text)' }}>
                            {rec.key}
                            <div className="mt-1 flex flex-wrap gap-1">
                              {rec.tags.map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                    className="text-[9px] font-sans px-1.5 py-0.5 h-auto" style={{ backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3.5">
                            <Badge
                              variant={isPrimaryOnline ? 'default' : 'destructive'}
                              className={`gap-1 px-2 py-0.5 font-bold ${
                                isPrimaryOnline
                                  ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15'
                                  : ''
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${isPrimaryOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                              {getNodeName(rec.nodeId)}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-3.5">
                            {rec.replicaNodeId ? (
                              <Badge
                                variant={isReplicaOnline ? 'default' : 'destructive'}
                                className={`gap-1 px-2 py-0.5 font-bold ${
                                  isReplicaOnline
                                    ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15'
                                    : ''
                                }`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${isReplicaOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                {getNodeName(rec.replicaNodeId)}
                              </Badge>
                            ) : (
                               <span className="italic" style={{ color: 'var(--color-text-muted)' }}>None</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3.5 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                            {sizeBytes} B
                          </TableCell>
                          <TableCell className="px-4 py-3.5 text-right">
                            <div className="flex justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedRecord(rec)}
                                 className="hover:text-emerald-400 hover:bg-emerald-500/10" style={{ color: 'var(--color-text-muted)' }}
                                title="Inspect JSON"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setNewKey(rec.key);
                                  setNewValue(JSON.stringify(rec.value, null, 2));
                                  setNewTags(rec.tags.join(', '));
                                  setActiveTab('write');
                                }}
                                 className="hover:text-blue-400 hover:bg-blue-500/10" style={{ color: 'var(--color-text-muted)' }}
                                title="Edit Value"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onDeleteRecord(rec.key)}
                                 className="hover:text-rose-400 hover:bg-rose-500/10" style={{ color: 'var(--color-text-muted)' }}
                                title="Delete Record"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Sidebar: Inspect View & Failover Diagnostics */}
          <div className="space-y-4">
            {/* Record Inspector */}
            <div className="rounded-xl backdrop-blur-sm p-5" style={{ borderColor: 'var(--color-border)', border: '1px solid', backgroundColor: 'rgba(var(--color-surface-alt-rgb, 240 249 255), 0.1)' }}>
              <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                <Eye className="h-4 w-4 text-emerald-400" />
                Record Inspector
              </h3>

              {selectedRecord ? (
                <div className="space-y-4">
                  {/* Status Indicator in case of Node Failover */}
                  {(() => {
                    const primaryNode = nodes.find((n) => n.id === selectedRecord.nodeId);
                    const replicaNode = selectedRecord.replicaNodeId
                      ? nodes.find((n) => n.id === selectedRecord.replicaNodeId)
                      : null;

                    if (primaryNode && primaryNode.status === 'disconnected') {
                      return (
                        <div className="rounded-lg bg-rose-500/5 border border-rose-500/15 p-3 text-xs text-rose-300 space-y-1">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
                            FAILOVER ACTIVE
                          </div>
                          <p className="text-[11px] text-rose-400/80 leading-relaxed">
                            Primary custodian <strong>{primaryNode.name}</strong> is offline. Shard broker automatically redirected read request to replica <strong>{replicaNode?.name || 'Unknown'}</strong>.
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-3 text-xs text-emerald-300 flex items-center gap-1.5">
                        <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                        <span>Served directly from primary node.</span>
                      </div>
                    );
                  })()}

                  <div className="space-y-2">
                     <span className="text-[10px] uppercase tracking-wider block" style={{ color: 'var(--color-text-muted)' }}>
                       Key Name
                     </span>
                     <span className="font-mono text-xs font-bold px-2.5 py-1 rounded block truncate" style={{ color: 'var(--color-text)', backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', border: '1px solid' }}>
                      {selectedRecord.key}
                    </span>
                  </div>

                  <div className="space-y-2">
                     <span className="text-[10px] uppercase tracking-wider block" style={{ color: 'var(--color-text-muted)' }}>
                       JSON Value
                     </span>
                     <pre className="font-mono text-[11px] p-3 rounded-lg overflow-auto max-h-[220px] leading-relaxed" style={{ color: 'var(--color-text)', backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', border: '1px solid' }}>
                      {JSON.stringify(selectedRecord.value, null, 2)}
                    </pre>
                  </div>

                    <div className="flex justify-between text-[11px] pt-2 font-sans" style={{ borderColor: 'var(--color-border)', borderTop: '1px solid', color: 'var(--color-text-muted)' }}>
                     <span>Updated</span>
                     <span>{new Date(selectedRecord.updatedAt).toLocaleString()}</span>
                   </div>
                </div>
              ) : (
                 <div className="text-center py-12 text-xs space-y-2" style={{ color: 'var(--color-text-muted)' }}>
                    <HelpCircle className="h-6 w-6 mx-auto" style={{ color: 'var(--color-text-muted)' }} />
                   <p>Click the eye icon next to any record in the table to inspect its contents and trace its health.</p>
                 </div>
              )}
            </div>

            {/* Educational Sharding Info */}
            <div className="rounded-xl backdrop-blur-sm p-5 text-xs space-y-2.5" style={{ borderColor: 'var(--color-border)', border: '1px solid', backgroundColor: 'rgba(var(--color-surface-alt-rgb, 240 249 255), 0.1)', color: 'var(--color-text-muted)' }}>
              <h4 className="font-bold uppercase tracking-wider text-[10px]" style={{ color: 'var(--color-text)' }}>
                How KV Sharding Works
              </h4>
              <p className="leading-relaxed">
                When you write a key, its character bytes are converted into a unique 32-bit integer. This integer is matched to a virtual coordinate on the hash ring.
              </p>
              <p className="leading-relaxed">
                We write the data to the matching Supabase database. If that database goes down, our client-side SDK automatically recovers the record from the backup node, guaranteeing zero downtime.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'write' && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Form Column */}
          <div className="rounded-xl backdrop-blur-sm p-6" style={{ borderColor: 'var(--color-border)', border: '1px solid', backgroundColor: 'rgba(var(--color-surface-alt-rgb, 240 249 255), 0.15)' }}>
            <h3 className="text-base font-bold mb-4 flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
              <Plus className="h-5 w-5 text-emerald-400" />
              Store Key-Value Pair
            </h3>

            <form onSubmit={handleWrite} className="space-y-4">
              <div>
                 <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
                   Key (Namespace identifier)
                 </label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. user:profile:1001"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  disabled={isWriting}
                />
                 <span className="text-[10px] mt-1 block" style={{ color: 'var(--color-text-muted)' }}>
                   Spaces are not recommended. Use colons `:` to create logical namespaces.
                 </span>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                   <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                     JSON Value
                   </label>
                  {jsonError && (
                    <span className="text-[10px] font-semibold text-rose-400 font-sans truncate max-w-[200px]">
                      {jsonError}
                    </span>
                  )}
                </div>
                <textarea
                  required
                  rows={5}
                  placeholder='{ "status": "active", "count": 1 }'
                  value={newValue}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  disabled={isWriting}
                   className={`w-full font-mono text-xs rounded-lg border px-3 py-2 focus:outline-none ${
                     jsonError ? 'border-rose-800 focus:border-rose-500' : 'focus:border-emerald-500'
                   }`}
                   style={{
                     backgroundColor: 'var(--color-surface-alt)',
                     color: 'var(--color-text)',
                     borderColor: 'var(--color-border)',
                     ...(!jsonError ? { '--color-placeholder': 'var(--color-text-muted)' } : {})
                   }}
                />
              </div>

              <div>
                 <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
                   Tags (Comma separated)
                 </label>
                <Input
                  type="text"
                  placeholder="e.g. config, staging, v1"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  disabled={isWriting}
                />
              </div>

              <Button
                type="submit"
                disabled={isWriting || !!jsonError || !newKey.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {isWriting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Hashing & Writing...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4" />
                    Write to Unified Cluster
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Sharding Log Column */}
           <div className="rounded-xl p-6 flex flex-col justify-between" style={{ borderColor: 'var(--color-border)', border: '1px solid', backgroundColor: 'rgba(var(--color-surface-alt-rgb, 240 249 255), 0.6)' }}>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text)' }}>
                Distributed Consensus Log
              </h3>
              
              <div className="space-y-2 font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
                 {writeLogs.length === 0 ? (
                    <div className="text-center py-12 font-sans italic" style={{ color: 'var(--color-text-muted)' }}>
                     Fill out the form and submit to view the real-time sharding logs.
                   </div>
                ) : (
                  writeLogs.map((log, i) => (
                    <div
                      key={i}
                       className={`py-1 leading-relaxed ${
                         log.startsWith('[ERROR]')
                           ? 'text-rose-400'
                           : log.includes('SUCCESS')
                           ? 'text-emerald-400 font-bold'
                           : ''
                       }`}
                       style={{
                         borderColor: 'var(--color-border)',
                         borderBottom: '1px solid',
                         color: log.includes('SUCCESS') ? '#10b981' : log.startsWith('[ERROR]') ? '#f87171' : 'var(--color-text-muted)'
                       }}
                    >
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Hashing Animation Visualizer */}
            {writeVisual && (
              <div className="mt-6 pt-4 space-y-3" style={{ borderColor: 'var(--color-border)', borderTop: '1px solid' }}>
                 <span className="block text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                   Visual Topology Route
                 </span>
                
                 <div className="flex items-center justify-between gap-2 rounded-lg p-3" style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', border: '1px solid' }}>
                   {/* Key */}
                    <div className="text-center px-2 py-1 rounded max-w-[100px] truncate" style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', border: '1px solid' }}>
                      <span className="text-[10px] block" style={{ color: 'var(--color-text-muted)' }}>Key</span>
                      <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--color-text)' }}>"{writeVisual.key}"</span>
                   </div>
                  
                  {/* arrow */}
                  <div className="flex-1 flex flex-col items-center">
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1 rounded border border-emerald-500/20 mb-1">
                      Hash Module
                    </span>
                    <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500 to-blue-500 relative">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                    </div>
                  </div>

                   {/* Primary Node */}
                    <div className="text-center px-2 py-1 rounded max-w-[100px] truncate" style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', border: '1px solid' }}>
                     <span className="text-[10px] block" style={{ color: 'var(--color-text-muted)' }}>Primary</span>
                     <span className={`font-mono text-[10px] font-bold ${getNodeColorClass(writeVisual.primaryNode)}`}>
                       {getNodeName(writeVisual.primaryNode)}
                     </span>
                   </div>

                  {/* Backup Node */}
                  {writeVisual.replicaNode && (
                    <>
                      <div className="h-0.5 w-6" style={{ backgroundColor: 'var(--color-border)' }} />
                       <div className="text-center px-2 py-1 rounded max-w-[100px] truncate" style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', border: '1px solid' }}>
                         <span className="text-[10px] block" style={{ color: 'var(--color-text-muted)' }}>Replica</span>
                         <span className={`font-mono text-[10px] font-bold ${getNodeColorClass(writeVisual.replicaNode)}`}>
                           {getNodeName(writeVisual.replicaNode)}
                         </span>
                       </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
