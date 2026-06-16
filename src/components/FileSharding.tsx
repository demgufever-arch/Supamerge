import React, { useState, useRef } from 'react';
import { SupabaseNode, FileMetadata, FileChunk } from '../types';
import { getNodeForKey, buildHashRing } from '../utils/hash';
import { HardDrive, Upload, Download, Trash2, FileText, FileImage, FileCode, File, CheckCircle2, ShieldCheck, RefreshCw, Layers, X } from 'lucide-react';
import { useToast } from './Toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface FileShardingProps {
  nodes: SupabaseNode[];
  files: FileMetadata[];
  onUploadFile: (
    name: string,
    type: string,
    size: number,
    chunks: FileChunk[],
    nodeDistribution: { [chunkIndex: number]: string }
  ) => Promise<void>;
  onDownloadChunk: (chunkId: string, nodeId: string) => Promise<string | null>;
  onDeleteFile: (fileId: string) => Promise<void>;
  isSandbox: boolean;
}

export default function FileSharding({
  nodes,
  files,
  onUploadFile,
  onDownloadChunk,
  onDeleteFile,
  isSandbox,
}: FileShardingProps) {
  const { toast } = useToast();
  const [chunkSizeKb, setChunkSizeKb] = useState<number>(256); // Default 256KB chunks
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null); // File ID being downloaded
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [downloadDiagnostics, setDownloadDiagnostics] = useState<string[]>([]);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Formatting helpers
  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const getNodeColor = (nodeId: string) => {
    const colors: { [key: string]: string } = {
      'sb-node-us-east': 'bg-emerald-500 text-emerald-400 border-emerald-500/30',
      'sb-node-eu-west': 'bg-blue-500 text-blue-400 border-blue-500/30',
      'sb-node-ap-south': 'bg-purple-500 text-purple-400 border-purple-500/30',
    };
    return colors[nodeId] || 'bg-amber-500 text-amber-400 border-amber-500/30';
  };

  const getNodeName = (nodeId: string) => {
    return nodes.find((n) => n.id === nodeId)?.name || nodeId;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <FileImage className="h-6 w-6 text-blue-400" />;
    if (type.includes('json') || type.includes('javascript') || type.includes('html') || type.includes('css')) {
      return <FileCode className="h-6 w-6 text-amber-400" />;
    }
    if (type.includes('text/')) return <FileText className="h-6 w-6 text-emerald-400" />;
    return <File className="h-6 w-6 text-slate-400" />;
  };

  // Convert File to Base64 chunks
  const fileToChunks = (file: File, sizeKb: number): Promise<FileChunk[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result !== 'string') {
          reject(new Error('Failed to read file as base64'));
          return;
        }

        // Split the raw base64 string
        // base64 format: "data:image/png;base64,iVBORw0KGgo..."
        const commaIdx = result.indexOf(',');
        const metaPrefix = result.substring(0, commaIdx + 1);
        const base64Data = result.substring(commaIdx + 1);

        const chunkSize = sizeKb * 1024;
        const totalChunks = Math.ceil(base64Data.length / chunkSize);
        const chunks: FileChunk[] = [];

        for (let i = 0; i < totalChunks; i++) {
          const chunkData = base64Data.substring(i * chunkSize, (i + 1) * chunkSize);
          const chunkId = `${file.name.replace(/[^\w\.\-]/g, '_')}_${Date.now()}_chunk_${i}`;
          
          chunks.push({
            chunkId,
            fileName: file.name,
            fileType: file.type,
            chunkIndex: i,
            totalChunks,
            // Include prefix with the first chunk so we can reconstruct it easily, or prepend it during merge
            data: i === 0 ? metaPrefix + chunkData : chunkData,
            sizeBytes: chunkData.length,
          });
        }
        resolve(chunks);
      };
      reader.onerror = () => reject(new Error('File reading error'));
      reader.readAsDataURL(file);
    });
  };

  // Handle File Upload & Distribution
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(10);
    setUploadStatus('Reading and splitting file...');

    try {
      const chunks = await fileToChunks(file, chunkSizeKb);
      setUploadProgress(30);
      setUploadStatus(`Segmented into ${chunks.length} chunks. Computing hash routing...`);

      // Compute which nodes get which chunks
      const activeNodes = nodes.filter((n) => n.status === 'connected');
      if (activeNodes.length === 0) {
        throw new Error('No active database nodes available in the cluster!');
      }

      const ring = buildHashRing(activeNodes, 4);
      const nodeDistribution: { [chunkIndex: number]: string } = {};

      chunks.forEach((chunk) => {
        // Hashing the chunkId ensures even distribution across nodes!
        const routing = getNodeForKey(chunk.chunkId, ring);
        nodeDistribution[chunk.chunkIndex] = routing.nodeId;
      });

      await new Promise((r) => setTimeout(r, 600));
      setUploadProgress(50);
      setUploadStatus('Distributing chunks across Supabase cluster...');

      // Upload chunks in parallel/sequence and report progress
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const targetNodeId = nodeDistribution[chunk.chunkIndex];
        setUploadStatus(`Uploading Chunk ${i + 1}/${chunks.length} to [${getNodeName(targetNodeId)}]...`);
        
        // Simulating artificial delay for visual beauty
        await new Promise((r) => setTimeout(r, 400));
        setUploadProgress(50 + Math.round((i / chunks.length) * 40));
      }

      // Perform actual save
      await onUploadFile(file.name, file.type, file.size, chunks, nodeDistribution);

      setUploadProgress(100);
      setUploadStatus('File successfully sharded and replicated!');
      
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatus('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 1500);

    } catch (err) {
      toast(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
  };

  // Handle Parallel Chunk Download and Reassembly with Fault-Tolerance Failover
  const handleDownload = async (fileMeta: FileMetadata) => {
    setIsDownloading(fileMeta.id);
    setDownloadDiagnostics([]);
    setShowDiagnosticsModal(true);
    
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
      setDownloadDiagnostics([...logs]);
    };

    log(`Initializing download for: "${fileMeta.name}" (${formatBytes(fileMeta.size)})`);
    log(`File is split into ${fileMeta.totalChunks} chunks across the cluster.`);

    try {
      const chunkPromises = fileMeta.chunkIds.map(async (chunkId, index) => {
        const primaryNodeId = fileMeta.nodeDistribution[index];
        const primaryNode = nodes.find((n) => n.id === primaryNodeId);
        
        log(`Requesting Chunk #${index} (ID: ${chunkId.substring(0, 10)}...)`);

        // Check if primary node is online
        if (primaryNode && primaryNode.status === 'connected') {
          log(`Pulling Chunk #${index} from Primary Node: [${primaryNode.name}]`);
          const data = await onDownloadChunk(chunkId, primaryNodeId);
          if (data) {
            log(`✓ Chunk #${index} fetched successfully from [${primaryNode.name}]`);
            return { index, data };
          }
        }

        // FAILOVER PIPELINE: If primary is offline or fetch failed, try replica node!
        log(`⚠️ Primary Node [${getNodeName(primaryNodeId)}] is OFFLINE! Invoking failover...`);
        
        // Find replica node (next online node in the cluster)
        const activeNodes = nodes.filter((n) => n.status === 'connected');
        if (activeNodes.length === 0) {
          throw new Error('All nodes in the cluster are offline! Cannot retrieve data.');
        }

        const primaryIdxInActiveList = nodes.findIndex((n) => n.id === primaryNodeId);
        // Find next active node
        let replicaNode: SupabaseNode | null = null;
        for (let i = 1; i <= nodes.length; i++) {
          const nextNode = nodes[(primaryIdxInActiveList + i) % nodes.length];
          if (nextNode.status === 'connected') {
            replicaNode = nextNode;
            break;
          }
        }

        if (replicaNode) {
          log(`🛡️ Found Active Replica Node: [${replicaNode.name}]. Fetching backup copy...`);
          // In our double-replicated KV/Chunk system, the chunk was also saved to the replica
          const data = await onDownloadChunk(chunkId, replicaNode.id);
          if (data) {
            log(`✓ Success! Chunk #${index} recovered from Replica Node [${replicaNode.name}]`);
            return { index, data };
          }
        }

        throw new Error(`Critical Error: Chunk #${index} is completely unreachable!`);
      });

      // Fetch all chunks in parallel
      const fetchedChunks = await Promise.all(chunkPromises);
      log(`All ${fileMeta.totalChunks} chunks downloaded. Beginning stream assembly...`);

      // Sort chunks by index to guarantee correct order
      fetchedChunks.sort((a, b) => a.index - b.index);

      // Reassemble Base64 string
      let fullBase64 = '';
      fetchedChunks.forEach((chunk) => {
        fullBase64 += chunk.data;
      });

      log(`Assembly complete. Converting binary stream to Blob...`);
      await new Promise((r) => setTimeout(r, 400));

      // Trigger browser download
      const link = document.createElement('a');
      link.href = fullBase64;
      link.download = fileMeta.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      log(`✓ File download completed successfully!`);
      setTimeout(() => {
        setIsDownloading(null);
      }, 1000);

    } catch (err) {
      log(`❌ CRITICAL FAILURE: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            <Layers className="h-6 w-6 text-emerald-400" />
            Distributed File Sharding
            <span className="text-xs font-normal rounded-full bg-slate-800 text-slate-300 px-2.5 py-0.5 border border-slate-700">
              {isSandbox ? 'Sandbox' : 'Live'}
            </span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Bypass single-database storage limits by splitting large files into chunks and distributing them globally with 2x replication.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upload Panel */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/10 p-5 backdrop-blur-sm space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text)' }}>
            Shard New File
          </h3>

          <div className="space-y-4">
            {/* Chunk Size Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
                 Select Chunk Size
               </label>
              <div className="grid grid-cols-3 gap-2">
                {[64, 128, 256].map((size) => (
                  <Button
                    key={size}
                    type="button"
                    variant={chunkSizeKb === size ? 'default' : 'outline'}
                    size="sm"
                    disabled={isUploading}
                    onClick={() => setChunkSizeKb(size)}
                    className={`font-mono font-bold ${
                       chunkSizeKb === size
                         ? 'bg-emerald-600/10 text-emerald-400 border-emerald-500/45 hover:bg-emerald-600/15'
                         : 'bg-slate-950 hover:text-slate-200 border-slate-800'
                    }`}
                    style={{ color: chunkSizeKb === size ? '' : 'var(--color-text-muted)' }}
                  >
                    {size} KB
                  </Button>
                ))}
              </div>
               <span className="text-[10px] mt-1.5 block leading-normal" style={{ color: 'var(--color-text-muted)' }}>
                 Smaller chunks distribute data more evenly across nodes but generate more API requests.
               </span>
            </div>

            {/* Drag and Drop Box */}
            <div className="relative">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUpload}
                disabled={isUploading}
                className="hidden"
                id="file-upload-input"
              />
              <label
                htmlFor="file-upload-input"
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                  isUploading
                    ? 'border-emerald-500/20 bg-emerald-500/5 cursor-not-allowed'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-950/80'
                }`}
              >
                 <div className="rounded-full bg-slate-900 p-3 border border-slate-800 mb-3 group-hover:scale-110 transition" style={{ color: 'var(--color-text-muted)' }}>
                   <Upload className="h-6 w-6 text-emerald-400" />
                 </div>
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                  {isUploading ? 'Uploading Shards...' : 'Select File to Shard'}
                </span>
                 <span className="text-xs mt-1 max-w-[180px]" style={{ color: 'var(--color-text-muted)' }}>
                   Supports images, PDFs, text, and JSON files up to 5MB.
                 </span>
              </label>
            </div>

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="rounded-lg bg-slate-950 border border-slate-800 p-4 space-y-3">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    {uploadStatus}
                  </span>
                  <span className="text-slate-300">{uploadProgress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Distributed Files List */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/10 p-5 backdrop-blur-sm space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text)' }}>
            Distributed File System Explorer
          </h3>

          <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40">
            <div className="overflow-x-auto">
               <table className="w-full border-collapse text-left text-xs" style={{ color: 'var(--color-text-muted)' }}>
                 <thead className="border-b border-slate-800 bg-slate-900/30 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                   <tr>
                    <th className="px-4 py-3">File Details</th>
                    <th className="px-4 py-3 text-center">Chunks</th>
                    <th className="px-4 py-3">Global Node Distribution Map</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {files.length === 0 ? (
                    <tr>
                       <td colSpan={4} className="px-4 py-12 text-center font-sans" style={{ color: 'var(--color-text-muted)' }}>
                         <HardDrive className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                         No files currently sharded in the cluster.
                         <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Upload a file to see how it distributes across your Supabase databases!</p>
                       </td>
                    </tr>
                  ) : (
                    files.map((file) => (
                      <tr key={file.id} className="hover:bg-slate-900/40 transition">
                        <td className="px-4 py-3.5 flex items-center gap-3">
                          <div className="rounded-lg bg-slate-900 p-2 border border-slate-800">
                            {getFileIcon(file.type)}
                          </div>
                          <div className="min-w-0 max-w-[150px] sm:max-w-[200px]">
                            <span className="font-bold text-slate-200 block truncate" title={file.name}>
                              {file.name}
                            </span>
                             <span className="text-[10px] block font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                               {formatBytes(file.size)} • {file.type.split('/')[1]?.toUpperCase() || 'BIN'}
                             </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono font-bold" style={{ color: 'var(--color-text-muted)' }}>
                          {file.totalChunks}
                        </td>
                        <td className="px-4 py-3.5">
                          {/* Visual Chunk Grid Map */}
                          <div className="flex flex-wrap gap-1.5 max-w-[240px]">
                            {Array.from({ length: file.totalChunks }).map((_, idx) => {
                              const nodeId = file.nodeDistribution[idx];
                              const node = nodes.find((n) => n.id === nodeId);
                              const isOnline = node?.status === 'connected';

                              return (
                                <div
                                  key={idx}
                                  className={`group relative flex h-6 w-7 items-center justify-center rounded border font-mono text-[9px] font-bold transition ${
                                    isOnline
                                      ? 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-600'
                                      : 'bg-rose-950/40 text-rose-400 border-rose-900/60 hover:bg-rose-950/80 animate-pulse'
                                  }`}
                                >
                                  {/* Dot indicator matching node color */}
                                  <span
                                    className={`absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full ${
                                      isOnline ? getNodeColor(nodeId).split(' ')[0] : 'bg-rose-500'
                                    }`}
                                  />
                                  C{idx}
                                  
                                  {/* Tooltip */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-25 hidden group-hover:block w-40 rounded bg-slate-950 border border-slate-800 p-2 text-[10px] text-slate-300 font-sans shadow-xl">
                                    <div className="font-bold text-slate-200">Chunk {idx}</div>
                                    <div className="mt-1 flex justify-between">
                                      <span>Node:</span>
                                      <span className="font-mono text-emerald-400">{getNodeName(nodeId)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Status:</span>
                                      <span className={isOnline ? 'text-emerald-400' : 'text-rose-400'}>
                                        {isOnline ? 'Online' : 'OFFLINE'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleDownload(file)}
                              disabled={isDownloading !== null}
                              className="bg-emerald-600/10 hover:bg-emerald-600 border-emerald-500/25 hover:border-emerald-500 text-emerald-400 hover:text-white"
                              title="Download & Reassemble File"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => onDeleteFile(file.id)}
                              disabled={isDownloading !== null}
                               className="bg-slate-900 hover:bg-rose-500/10 border-slate-800 hover:border-rose-500/30 hover:text-rose-400" style={{ color: 'var(--color-text-muted)' }}
                              title="Delete File Shards"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnostics Logs Modal */}
      <Dialog open={showDiagnosticsModal} onOpenChange={(open) => { if (!isDownloading) setShowDiagnosticsModal(open); }}>
        <DialogContent className="max-w-lg border-slate-800 bg-slate-900 text-slate-200">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <DialogTitle className="text-sm font-bold text-slate-200 uppercase tracking-wide">
                Distributed Stream Diagnostics
              </DialogTitle>
            </div>
            <DialogDescription className="hidden" />
          </DialogHeader>

          <div className="bg-slate-950 rounded-lg p-4 font-mono text-[10px] text-slate-300 border border-slate-800 h-64 overflow-y-auto space-y-1.5">
            {downloadDiagnostics.map((line, idx) => (
              <div
                key={idx}
                className={`${
                   line.includes('✓')
                     ? 'text-emerald-400 font-semibold'
                     : line.includes('⚠️')
                     ? 'text-amber-400 font-semibold'
                     : line.includes('❌')
                     ? 'text-rose-400 font-bold'
                     : ''
                 }`} style={{ color: !line.includes('✓') && !line.includes('⚠️') && !line.includes('❌') ? 'var(--color-text-muted)' : undefined }}
              >
                {line}
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center text-xs pt-2">
             <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
               {isDownloading ? (
                 <>
                   <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                   <span>Assembling chunks in real-time...</span>
                 </>
               ) : (
                 <>
                   <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                   <span className="text-emerald-400 font-semibold">Download cycle completed.</span>
                 </>
               )}
             </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDiagnosticsModal(false)}
              disabled={isDownloading !== null}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
            >
              Close Logs
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
