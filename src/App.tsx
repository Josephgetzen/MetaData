import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FolderOpen, File as FileIcon, Image, Video, FileText, Trash2, 
  Settings, CheckCircle2, AlertCircle, MapPin, RotateCcw, 
  Layers, Download, Search, Plus, X, HardDrive, Info, 
  Calendar, User, Globe, Camera, Check, HelpCircle, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { MediaFile, MetadataTags, FileBackup, ValidationFeedback } from './types';
import { extractMetadata, stripAllMetadataBinary, stripLocationAndTimeMetadataBinary, applyMetadataEditsBinary } from './utils/metadataEngine';
import { validateMetadata } from './utils/validator';

export default function App() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [backups, setBackups] = useState<FileBackup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'images' | 'videos' | 'pdfs' | 'all-others'>('all');
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  
  // Tag editing state for the active file
  const [editTags, setEditTags] = useState<MetadataTags | null>(null);
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [customValueInput, setCustomValueInput] = useState('');
  
  // Real-time validation state
  const [validation, setValidation] = useState<ValidationFeedback>({ isValid: true, errors: {}, warnings: {} });

  // Bulk operation selections
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [bulkStatusMsg, setBulkStatusMsg] = useState('');
  
  // Feedback alerts
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // File Inputs references
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);

  const activeFile = files.find(f => f.id === activeFileId);

  // Auto-clear alert after 5s
  useEffect(() => {
    if (alertMsg) {
      const timer = setTimeout(() => setAlertMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [alertMsg]);

  // Handle active file change: load tags and execute validation
  useEffect(() => {
    if (activeFile) {
      setEditTags({ ...activeFile.tags });
    } else {
      setEditTags(null);
    }
  }, [activeFileId]);

  // Run real-time validation on typing
  useEffect(() => {
    if (editTags) {
      const feedback = validateMetadata(editTags);
      setValidation(feedback);
    }
  }, [editTags]);

  const triggerAlert = (type: 'success' | 'info' | 'error', text: string) => {
    setAlertMsg({ type, text });
  };

  // Process newly added file items
  const handleAddFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    
    const newFilesList: MediaFile[] = [];
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const name = file.name;
      const extension = name.substring(name.lastIndexOf('.') + 1).toLowerCase();
      const id = `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;
      
      const previewUrl = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension)
        ? URL.createObjectURL(file)
        : undefined;

      // Extract initial metadata tags from headers
      const initialTags = await extractMetadata(file, extension);

      newFilesList.push({
        id,
        name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        extension,
        file,
        previewUrl,
        status: 'Original',
        tags: initialTags,
        originalTags: JSON.parse(JSON.stringify(initialTags)),
        isBackedUp: false
      });
    }

    setFiles(prev => {
      const combined = [...prev, ...newFilesList];
      // Auto-focus first added file if none is active
      if (!activeFileId && combined.length > 0) {
        setActiveFileId(combined[0].id);
      }
      return combined;
    });

    triggerAlert('success', `Successfully imported ${fileList.length} files into workspace console.`);
  };

  // Drag and drop event handlers
  const [isDragging, setIsDragging] = useState(false);
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleAddFiles(e.dataTransfer.files);
  };

  // Select/Deselect all files for bulk actions
  const toggleSelectAll = () => {
    if (selectedFileIds.length === filteredFiles.length) {
      setSelectedFileIds([]);
    } else {
      setSelectedFileIds(filteredFiles.map(f => f.id));
    }
  };

  const toggleSelectFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFileIds(prev => 
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  // Search and filter logic
  const filteredFiles = files.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (typeFilter === 'all') return matchesSearch;
    if (typeFilter === 'images') return matchesSearch && ['jpg', 'jpeg', 'png', 'heic', 'webp'].includes(f.extension);
    if (typeFilter === 'videos') return matchesSearch && ['mp4', 'mkv', 'mov', 'avi'].includes(f.extension);
    if (typeFilter === 'pdfs') return matchesSearch && f.extension === 'pdf';
    return matchesSearch && !['jpg', 'jpeg', 'png', 'heic', 'webp', 'mp4', 'mkv', 'mov', 'avi', 'pdf'].includes(f.extension);
  });

  // Tag inputs modifying trigger
  const handleTagChange = (field: keyof MetadataTags, value: string) => {
    if (!editTags) return;
    setEditTags(prev => prev ? { ...prev, [field]: value } : null);
    
    // Update local files representation status
    setFiles(prev => prev.map(f => {
      if (f.id === activeFileId) {
        return {
          ...f,
          status: 'Modified',
          tags: { ...f.tags, [field]: value }
        };
      }
      return f;
    }));
  };

  // Add custom key-value tags
  const handleAddCustomTag = () => {
    if (!editTags || !customKeyInput.trim() || !customValueInput.trim()) return;
    const cleanKey = customKeyInput.trim().replace(/[^a-zA-Z0-9_\s]/g, '');
    const cleanValue = customValueInput.trim();

    const updatedCustom = { ...editTags.customTags, [cleanKey]: cleanValue };
    setEditTags(prev => prev ? { ...prev, customTags: updatedCustom } : null);

    setFiles(prev => prev.map(f => {
      if (f.id === activeFileId) {
        return {
          ...f,
          status: 'Modified',
          tags: { ...f.tags, customTags: updatedCustom }
        };
      }
      return f;
    }));

    setCustomKeyInput('');
    setCustomValueInput('');
    triggerAlert('success', `Added custom tag marker [${cleanKey}] to active file heap.`);
  };

  // Remove custom tag keyword
  const handleRemoveCustomTag = (key: string) => {
    if (!editTags) return;
    const { [key]: deleted, ...remaining } = editTags.customTags;
    setEditTags(prev => prev ? { ...prev, customTags: remaining } : null);

    setFiles(prev => prev.map(f => {
      if (f.id === activeFileId) {
        return {
          ...f,
          status: 'Modified',
          tags: { ...f.tags, customTags: remaining }
        };
      }
      return f;
    }));
  };

  // Automated item binary backup before changes are applied
  const createBackupForFile = async (item: MediaFile): Promise<string | null> => {
    try {
      const buffer = await item.file.arrayBuffer();
      const backupId = `bk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const backupItem: FileBackup = {
        id: backupId,
        fileId: item.id,
        name: item.name,
        timestamp: new Date().toLocaleTimeString(),
        size: item.size,
        data: buffer
      };
      
      setBackups(prev => [backupItem, ...prev]);
      
      // Update file backed up status pointer
      setFiles(prev => prev.map(f => {
        if (f.id === item.id) return { ...f, isBackedUp: true, backupId };
        return f;
      }));

      return backupId;
    } catch (e) {
      console.error('Backup creation failed:', e);
      return null;
    }
  };

  // Restore file back to original backup
  const handleRestoreBackup = (backup: FileBackup) => {
    const targetFile = files.find(f => f.id === backup.fileId);
    if (!targetFile) return;

    // Restore File object from buffer
    const restoredBlob = new Blob([backup.data], { type: targetFile.type });
    const restoredFile = new File([restoredBlob], targetFile.name, { type: targetFile.type });
    
    // Revoke previous blob url
    if (targetFile.previewUrl) {
      URL.revokeObjectURL(targetFile.previewUrl);
    }
    const newPreviewUrl = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(targetFile.extension)
      ? URL.createObjectURL(restoredFile)
      : undefined;

    setFiles(prev => prev.map(f => {
      if (f.id === targetFile.id) {
        return {
          ...f,
          file: restoredFile,
          previewUrl: newPreviewUrl,
          status: 'Original',
          tags: JSON.parse(JSON.stringify(f.originalTags)),
          isBackedUp: false,
          backupId: undefined
        };
      }
      return f;
    }));

    // Remove from backup store list
    setBackups(prev => prev.filter(b => b.id !== backup.id));

    if (activeFileId === targetFile.id) {
      setEditTags({ ...targetFile.originalTags });
    }

    triggerAlert('success', `Restored "${targetFile.name}" back to its original state.`);
  };

  // Save changes locally and download the resulting file
  const handleSaveActiveFile = async () => {
    if (!activeFile || !editTags) return;

    if (!validation.isValid) {
      triggerAlert('error', 'Please resolve coordinate errors before attempting to save.');
      return;
    }

    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, status: 'Processing' } : f));

    try {
      // 1. Auto-backup if toggled
      if (autoBackupEnabled && !activeFile.isBackedUp) {
        await createBackupForFile(activeFile);
      }

      // 2. Compute updated file buffer
      const newBuffer = await applyMetadataEditsBinary(activeFile.file, activeFile.extension, editTags);
      
      const updatedBlob = new Blob([newBuffer], { type: activeFile.type });
      const updatedFile = new File([updatedBlob], activeFile.name, { type: activeFile.type });

      // Trigger automatic local browser download
      triggerDownload(updatedFile);

      setFiles(prev => prev.map(f => {
        if (f.id === activeFileId) {
          return {
            ...f,
            file: updatedFile,
            status: 'Saved',
            previewUrl: f.previewUrl ? URL.createObjectURL(updatedFile) : undefined
          };
        }
        return f;
      }));

      triggerAlert('success', `Successfully saved & downloaded updated file: ${activeFile.name}`);
    } catch (err) {
      console.error(err);
      setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, status: 'Error', errorMessage: 'Save failed' } : f));
      triggerAlert('error', `Failed to apply metadata saves to: ${activeFile.name}`);
    }
  };

  const triggerDownload = (file: File) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edited_${file.name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Wipe All Metadata / Strip Location and Time inside selected queue items
  const handleBulkStrip = async (mode: 'all' | 'location-time') => {
    const targetIds = selectedFileIds.length > 0 
      ? selectedFileIds 
      : filteredFiles.map(f => f.id);

    if (targetIds.length === 0) {
      triggerAlert('info', 'No files matched filter criterion for bulk processing.');
      return;
    }

    setIsProcessingBulk(true);
    let successCount = 0;
    let byteSavings = 0;

    for (let id of targetIds) {
      const item = files.find(f => f.id === id);
      if (!item) continue;

      setBulkStatusMsg(`Processing file: ${item.name}`);
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'Processing' } : f));

      try {
        // Auto-backup before strip
        if (autoBackupEnabled && !item.isBackedUp) {
          await createBackupForFile(item);
        }

        let newBuffer: ArrayBuffer;
        if (mode === 'all') {
          newBuffer = await stripAllMetadataBinary(item.file, item.extension);
        } else {
          newBuffer = await stripLocationAndTimeMetadataBinary(item.file, item.extension);
        }

        const sizeDiff = item.size - newBuffer.byteLength;
        byteSavings += Math.max(0, sizeDiff);

        const updatedBlob = new Blob([newBuffer], { type: item.type });
        const updatedFile = new File([updatedBlob], item.name, { type: item.type });

        // Build blank/stripped representation
        const emptyTags: MetadataTags = mode === 'all' 
          ? { customTags: {} } 
          : { 
              ...item.tags, 
              latitude: '', 
              longitude: '', 
              dateCreated: '',
              customTags: {} 
            };

        // Automatically download single items
        triggerDownload(updatedFile);

        setFiles(prev => prev.map(f => {
          if (f.id === id) {
            return {
              ...f,
              file: updatedFile,
              tags: emptyTags,
              status: 'Saved',
              previewUrl: f.previewUrl ? URL.createObjectURL(updatedFile) : undefined
            };
          }
          return f;
        }));

        if (id === activeFileId) {
          setEditTags(emptyTags);
        }

        successCount++;
      } catch (err) {
        console.error(err);
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'Error', errorMessage: 'Wipe failed' } : f));
      }
    }

    setIsProcessingBulk(false);
    setBulkStatusMsg('');
    
    const formattedSavings = (byteSavings / 1024).toFixed(1);
    const modeLabel = mode === 'all' ? 'Entire Metadata' : 'Location & Time Parameters';
    triggerAlert('success', `Bulk Actions complete! ${successCount} files processed. Stripped ${modeLabel}. Total size reduced by ${formattedSavings} KB.`);
  };

  // Capture user real-time coordinates
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      triggerAlert('error', 'Your browser container sandbox does not support geolocation.');
      return;
    }

    triggerAlert('info', 'Contacting device geolocation receiver...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latVal = position.coords.latitude.toFixed(6);
        const lonVal = position.coords.longitude.toFixed(6);
        
        if (editTags) {
          setEditTags(prev => prev ? { ...prev, latitude: latVal, longitude: lonVal } : null);
          setFiles(prev => prev.map(f => {
            if (f.id === activeFileId) {
              return {
                ...f,
                status: 'Modified',
                tags: { ...f.tags, latitude: latVal, longitude: lonVal }
              };
            }
            return f;
          }));
          triggerAlert('success', `Loaded physical location coordinates: (${latVal}, ${lonVal})`);
        }
      },
      (error) => {
        triggerAlert('error', `Geolocation capture failed: ${error.message}`);
      }
    );
  };

  // File Removal
  const handleRemoveFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const fileToRemove = files.find(f => f.id === id);
    if (fileToRemove?.previewUrl) {
      URL.revokeObjectURL(fileToRemove.previewUrl);
    }
    
    setFiles(prev => prev.filter(f => f.id !== id));
    setSelectedFileIds(prev => prev.filter(fid => fid !== id));
    setBackups(prev => prev.filter(b => b.fileId !== id));

    if (activeFileId === id) {
      const nextActive = files.find(f => f.id !== id);
      setActiveFileId(nextActive ? nextActive.id : null);
    }
  };

  const clearWorkspace = () => {
    files.forEach(f => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setFiles([]);
    setActiveFileId(null);
    setBackups([]);
    setSelectedFileIds([]);
    triggerAlert('info', 'Workspace queue cleared safely.');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-indigo-600/30 selection:text-indigo-200 flex flex-col antialiased">
      
      {/* Header Navigation in Elegant Dark */}
      <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white">
            <Layers className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-zinc-100 tracking-tight flex items-center gap-2">
              <span>META//DATA ENGINEER</span>
              <span className="text-zinc-500 font-mono text-[10px] uppercase">v2.4.0</span>
            </h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Secure Client-Side Binary Processing Engine</p>
          </div>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => handleAddFiles(e.target.files)} 
            multiple 
            className="hidden" 
          />
          <input 
            type="file" 
            ref={dirInputRef} 
            onChange={(e) => handleAddFiles(e.target.files)} 
            webkitdirectory="" 
            directory="" 
            multiple 
            className="hidden" 
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-200 text-xs rounded border border-zinc-750 font-mono transition cursor-pointer flex items-center gap-1.5"
          >
            <Upload className="h-3.5 w-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Upload Files</span>
          </button>

          <button
            onClick={() => dirInputRef.current?.click()}
            className="px-3 py-1.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-200 text-xs rounded border border-zinc-750 font-mono transition cursor-pointer flex items-center gap-1.5"
          >
            <FolderOpen className="h-3.5 w-3.5 text-amber-500" />
            <span className="hidden sm:inline">Open Directory</span>
          </button>

          {files.length > 0 && (
            <button
              onClick={clearWorkspace}
              className="px-3 py-1.5 bg-rose-950/20 hover:bg-rose-900/40 text-rose-400 text-xs rounded border border-rose-900/30 font-mono transition cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              <span className="hidden sm:inline">Clear Workspace</span>
            </button>
          )}

          <div className="hidden lg:flex items-center gap-2 border-l border-zinc-800 pl-4 ml-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-mono text-emerald-500 tracking-wider">SYSTEM READY</span>
          </div>
        </div>
      </header>

      {/* Persistent Inline Notification Alerts */}
      <AnimatePresence>
        {alertMsg && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={`px-6 py-2.5 border-b text-xs font-mono flex items-center justify-between gap-4 z-40 relative ${
              alertMsg.type === 'success' 
                ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/30' 
                : alertMsg.type === 'error'
                ? 'bg-rose-950/30 text-rose-400 border-rose-900/30'
                : 'bg-indigo-950/30 text-indigo-400 border-indigo-900/30'
            }`}
          >
            <div className="flex items-center gap-2">
              {alertMsg.type === 'success' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <AlertCircle className="h-3.5 w-3.5" />}
              <span>{alertMsg.text}</span>
            </div>
            <button onClick={() => setAlertMsg(null)} className="text-zinc-500 hover:text-white transition">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {files.length === 0 ? (
        /* Empty Workspace Drag & Drop Launcher */
        <main 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex-1 flex flex-col items-center justify-center p-12 transition-colors duration-300 ${isDragging ? 'bg-indigo-950/10 border-2 border-dashed border-indigo-500/30' : 'bg-zinc-950'}`}
        >
          <div className="max-w-md text-center space-y-6">
            <div className="mx-auto w-14 h-14 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
              <Upload className="h-6 w-6 text-zinc-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-medium tracking-tight text-zinc-100 font-sans">
                Drag & drop files or directory payloads
              </h2>
              <p className="text-zinc-505 text-xs font-mono leading-relaxed text-zinc-500 max-w-sm mx-auto">
                Processes metadata locally inside your sandboxed browser. No remote servers, absolute data isolation. Supports MKV, MP4, MOV, HEIC, JPEG, PNG, and PDF payloads.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded font-medium shadow-lg transition cursor-pointer font-mono"
              >
                SELECT MEDIA FILES
              </button>
              <button 
                onClick={() => dirInputRef.current?.click()}
                className="w-full sm:w-auto px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-350 border border-zinc-800 text-xs rounded transition cursor-pointer font-mono"
              >
                DIRECTORY IMPORT
              </button>
            </div>
            <div className="pt-8 border-t border-zinc-900/60 flex items-center justify-center gap-6 text-[10px] font-mono text-zinc-500">
              <div className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-indigo-400" /> <span className="uppercase">EXIF Write</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-indigo-400" /> <span className="uppercase">Batch Scrub</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-indigo-400" /> <span className="uppercase">Safety Backups</span>
              </div>
            </div>
          </div>
        </main>
      ) : (
        /* Full Dynamic Columnar Workspace Layout */
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-zinc-950">
            
            {/* Sidebar: Source Directory Files Selector (3 Cols) */}
            <aside className="lg:col-span-3 border-r border-zinc-800 flex flex-col h-[calc(100vh-104px)] overflow-hidden bg-zinc-900/30">
              <div className="p-4 border-b border-zinc-800 bg-zinc-950/30 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-500 tracking-wider">SOURCE DIRECTORY</span>
                  <span className="text-[9px] font-mono text-zinc-650 font-medium px-1.5 py-0.5 bg-zinc-900 rounded border border-zinc-800">
                    {filteredFiles.length} FILES
                  </span>
                </div>
                
                {/* Search Text Field */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                  <input 
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-300 focus:outline-none focus:border-indigo-650 font-mono placeholder:text-zinc-600"
                  />
                </div>

                {/* Filter and Categories Selector */}
                <div className="flex gap-1 overflow-x-auto pb-1 custom-scrollbar">
                  {(['all', 'images', 'videos', 'pdfs', 'all-others'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setTypeFilter(cat)}
                      className={`px-2 py-0.5 text-[9px] font-mono rounded border capitalize flex-shrink-0 transition cursor-pointer ${
                        typeFilter === cat 
                          ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20' 
                          : 'bg-transparent text-zinc-500 border-transparent hover:text-zinc-350'
                      }`}
                    >
                      {cat === 'all-others' ? 'Others' : cat}
                    </button>
                  ))}
                </div>

                {/* Queue Select Controls */}
                <div className="flex justify-between items-center text-[10px] font-mono pt-1 border-t border-zinc-800/40 text-zinc-500">
                  <button 
                    onClick={toggleSelectAll} 
                    className="hover:text-zinc-300 transition cursor-pointer flex items-center gap-1"
                  >
                    {selectedFileIds.length === filteredFiles.length ? 'DESELECT ALL' : 'SELECT ALL'}
                  </button>
                  {selectedFileIds.length > 0 && (
                    <span className="text-indigo-400 font-medium">{selectedFileIds.length} SELECTED</span>
                  )}
                </div>
              </div>

              {/* Sidebar File Items Layout block */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                <AnimatePresence initial={false}>
                  {filteredFiles.map((f) => {
                    const isActive = f.id === activeFileId;
                    const isSelected = selectedFileIds.includes(f.id);
                    
                    // Format extension indicator colors to match Elegant Dark
                    let indicatorBg = 'bg-zinc-800 text-zinc-500';
                    if (isActive) {
                      indicatorBg = 'bg-indigo-900/50 text-indigo-400 font-bold';
                    }

                    return (
                      <motion.div
                        key={f.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 12 }}
                        onClick={() => setActiveFileId(f.id)}
                        className={`group p-2 rounded flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isActive 
                            ? 'bg-indigo-600/10 border border-indigo-500/30' 
                            : 'hover:bg-zinc-800/50 rounded border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                          {/* Multi Select Checkbox */}
                          <div 
                            onClick={(e) => toggleSelectFile(f.id, e)}
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                              isSelected 
                                ? 'bg-indigo-600 border-indigo-505 text-white' 
                                : 'border-zinc-700 bg-zinc-950 group-hover:border-zinc-550'
                            }`}
                          >
                            {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                          </div>

                          {/* Extension Icon block */}
                          <div className={`w-8 h-8 rounded flex items-center justify-center text-[9px] font-mono flex-shrink-0 ${indicatorBg}`}>
                            {f.extension.toUpperCase()}
                          </div>

                          {/* File naming info */}
                          <div className="overflow-hidden flex-1">
                            <p className="text-xs text-zinc-305 font-medium truncate group-hover:text-zinc-100 transition">
                              {f.name}
                            </p>
                            <p className="text-[9px] text-zinc-500 font-mono mt-0.5 truncate">
                              {(f.size / 1024 / 1024).toFixed(1)} MB • {f.status.toUpperCase()}
                            </p>
                          </div>
                        </div>

                        {/* Remove item button */}
                        <button
                          onClick={(e) => handleRemoveFile(f.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-550 hover:text-rose-400 transition"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </aside>

            {/* Main File Metadata Editor Grid Panel (6 Cols) */}
            <section className="lg:col-span-6 border-r border-zinc-800 flex flex-col h-[calc(100vh-104px)] overflow-hidden bg-zinc-950">
              {activeFile && editTags ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Top Header Information Indicator Bar */}
                  <div className="h-12 border-b border-zinc-900 flex items-center px-6 justify-between bg-zinc-900/20 flex-shrink-0">
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-mono text-zinc-500">FILE_ID: 0x{activeFile.id.substring(0,4).toUpperCase()}</span>
                      <span className="text-xs text-zinc-200 font-medium italic truncate max-w-xs">{activeFile.name}</span>
                    </div>
                    {activeFile.isBackedUp && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-emerald-950/30 text-emerald-400 rounded border border-emerald-555/20 font-mono">BACKED_UP</span>
                    )}
                  </div>

                  {/* Configured fields grid flow */}
                  <div className="flex-1 p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    
                    {/* Inline File Attribute Summary Card */}
                    <div className="p-3 bg-zinc-900/45 border border-zinc-800 rounded grid grid-cols-4 gap-4 items-center flex-shrink-0">
                      <div className="col-span-1 aspect-square rounded bg-zinc-950 border border-zinc-800 flex items-center justify-center overflow-hidden relative font-mono text-[9px]">
                        {activeFile.previewUrl ? (
                          <img 
                            src={activeFile.previewUrl} 
                            className="object-cover w-full h-full" 
                            alt="Visual graphic upload" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-zinc-600">{activeFile.extension.toUpperCase()}</span>
                        )}
                      </div>
                      <div className="col-span-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] tracking-wider uppercase bg-zinc-800 px-1 text-zinc-400 rounded border border-zinc-750 font-mono">
                            {activeFile.type || 'BINARY'}
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-zinc-200 truncate pr-3">{activeFile.name}</h4>
                        <div className="flex gap-4 text-[9px] font-mono text-zinc-500">
                          <span>{(activeFile.size / 1024 / 1024).toFixed(2)} MB</span>
                          <span>•</span>
                          <span>{activeFile.status.toUpperCase()} STATE</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      
                      {/* Sub-Section Block 1: Technical & Core Metadata */}
                      <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-zinc-500 tracking-wider uppercase flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full"></div> Core Attributes
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Title */}
                          <div className="bg-zinc-900/50 p-3 rounded border border-zinc-800 focus-within:border-indigo-650 transition-colors">
                            <label className="block text-[10px] text-zinc-500 mb-1 font-mono uppercase tracking-wider">Title / Label</label>
                            <input 
                              type="text" 
                              value={editTags.title || ''}
                              onChange={(e) => handleTagChange('title', e.target.value)}
                              placeholder="Untitled resource"
                              className="bg-transparent text-xs w-full outline-none text-zinc-200 placeholder-zinc-750"
                            />
                            {validation.warnings.title && (
                              <p className="text-[9px] font-mono text-amber-500 mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> {validation.warnings.title}
                              </p>
                            )}
                          </div>

                          {/* Publisher Creator */}
                          <div className="bg-zinc-900/50 p-3 rounded border border-zinc-800 focus-within:border-indigo-655 transition-colors">
                            <label className="block text-[10px] text-zinc-500 mb-1 font-mono uppercase tracking-wider">Software / Creator</label>
                            <input 
                              type="text" 
                              value={editTags.authorArtist || ''}
                              onChange={(e) => handleTagChange('authorArtist', e.target.value)}
                              placeholder="e.g. Creator Team Hub"
                              className="bg-transparent text-xs w-full outline-none text-zinc-200 placeholder-zinc-750"
                            />
                          </div>

                          {/* Original Timestamp */}
                          <div className="bg-zinc-900/50 p-3 rounded border border-zinc-800 focus-within:border-indigo-655 transition-colors">
                            <label className="block text-[10px] text-zinc-500 mb-1 font-mono uppercase tracking-wider">Original Timestamp</label>
                            <input 
                              type="text" 
                              value={editTags.dateCreated || ''}
                              onChange={(e) => handleTagChange('dateCreated', e.target.value)}
                              placeholder="e.g. 2026-05-24 18:02:51 UTC"
                              className="bg-transparent text-xs w-full outline-none font-mono text-zinc-200 placeholder-zinc-750"
                            />
                            {validation.warnings.dateCreated && (
                              <p className="text-[9px] font-mono text-amber-500 mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 flex-shrink-0" /> {validation.warnings.dateCreated}
                              </p>
                            )}
                          </div>

                          {/* Software Suite */}
                          <div className="bg-zinc-900/50 p-3 rounded border border-zinc-800 focus-within:border-indigo-655 transition-colors">
                            <label className="block text-[10px] text-zinc-500 mb-1 font-mono uppercase tracking-wider">Software Specification</label>
                            <input 
                              type="text" 
                              value={editTags.software || ''}
                              onChange={(e) => handleTagChange('software', e.target.value)}
                              placeholder="Photoshop, RAW Suite"
                              className="bg-transparent text-xs w-full outline-none text-zinc-200 placeholder-zinc-750"
                            />
                          </div>

                          {/* Optical Hardware camera model */}
                          <div className="bg-zinc-900/50 p-3 rounded border border-zinc-800 focus-within:border-indigo-655 transition-colors sm:col-span-2">
                            <label className="block text-[10px] text-zinc-500 mb-1 font-mono uppercase tracking-wider">Optics Make / Camera Model</label>
                            <input 
                              type="text" 
                              value={editTags.cameraModel || ''}
                              onChange={(e) => handleTagChange('cameraModel', e.target.value)}
                              placeholder="Canon, Sony SLR, iPhone"
                              className="bg-transparent text-xs w-full outline-none text-zinc-210 placeholder-zinc-750"
                            />
                          </div>

                          {/* Copyright */}
                          <div className="bg-zinc-900/50 p-3 rounded border border-zinc-800 focus-within:border-indigo-655 transition-colors sm:col-span-2">
                            <label className="block text-[10px] text-zinc-500 mb-1 font-mono uppercase tracking-wider">Copyright Banner</label>
                            <input 
                              type="text" 
                              value={editTags.copyright || ''}
                              onChange={(e) => handleTagChange('copyright', e.target.value)}
                              placeholder="© 2026. All rights reserved."
                              className="bg-transparent text-xs w-full outline-none text-zinc-200 placeholder-zinc-750"
                            />
                          </div>

                          {/* Longform Comment */}
                          <div className="bg-zinc-900/50 p-3 rounded border border-zinc-800 focus-within:border-indigo-655 transition-colors sm:col-span-2">
                            <label className="block text-[10px] text-zinc-500 mb-1 font-mono uppercase tracking-wider">Description Remarks</label>
                            <textarea 
                              rows={2}
                              value={editTags.description || ''}
                              onChange={(e) => handleTagChange('description', e.target.value)}
                              placeholder="Internal embedded summary annotations..."
                              className="bg-transparent text-xs w-full outline-none text-zinc-200 placeholder-zinc-750 resize-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Sub-Section Block 2: GPS Geotags & Map View */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-[10px] font-black text-zinc-500 tracking-wider uppercase flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div> Geo-Spatial Intel
                          </h3>
                          <button
                            type="button"
                            onClick={handleGetCurrentLocation}
                            className="text-[9px] font-mono text-cyan-400 hover:text-cyan-300 transition flex items-center gap-1 px-1.5 py-0.5 bg-cyan-950/20 rounded border border-cyan-550/25 cursor-pointer"
                          >
                            <Globe className="h-2.5 w-2.5" /> RE-CALIBRATE GPS
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Latitude */}
                          <div className="bg-zinc-900/50 p-3 rounded border border-zinc-800 focus-within:border-indigo-655 transition-colors">
                            <label className="block text-[10px] text-zinc-505 mb-1 font-mono uppercase tracking-wider flex justify-between">
                              <span>Latitude Coordinates</span>
                              <span className="text-[8px] text-zinc-600 font-mono">(-90 to +90)</span>
                            </label>
                            <input 
                              type="text" 
                              value={editTags.latitude || ''}
                              onChange={(e) => handleTagChange('latitude', e.target.value)}
                              placeholder="e.g. 40.712800"
                              className="bg-transparent text-xs w-full outline-none font-mono text-zinc-200 placeholder-zinc-750"
                            />
                            {validation.errors.latitude && (
                              <p className="text-[9px] font-mono text-rose-500 mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Latitude Bounds invalid
                              </p>
                            )}
                          </div>

                          {/* Longitude */}
                          <div className="bg-zinc-900/50 p-3 rounded border border-zinc-800 focus-within:border-indigo-655 transition-colors">
                            <label className="block text-[10px] text-zinc-505 mb-1 font-mono uppercase tracking-wider flex justify-between">
                              <span>Longitude Coordinates</span>
                              <span className="text-[8px] text-zinc-600 font-mono">(-180 to +180)</span>
                            </label>
                            <input 
                              type="text" 
                              value={editTags.longitude || ''}
                              onChange={(e) => handleTagChange('longitude', e.target.value)}
                              placeholder="e.g. -74.006000"
                              className="bg-transparent text-xs w-full outline-none font-mono text-zinc-200 placeholder-zinc-750"
                            />
                            {validation.errors.longitude && (
                              <p className="text-[9px] font-mono text-rose-500 mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Longitude Bounds invalid
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Maps representation block */}
                        {editTags.latitude && editTags.longitude && !validation.errors.latitude && !validation.errors.longitude && (
                          <div className="h-20 rounded bg-zinc-900/30 border border-zinc-805 relative overflow-hidden flex items-center justify-center font-mono">
                            <div className="absolute inset-0 bg-zinc-950/20 grid grid-cols-6 grid-rows-3 opacity-20">
                              {Array.from({ length: 18 }).map((_, i) => <div key={i} className="border border-zinc-800" />)}
                            </div>
                            <div className="z-10 text-center space-y-1">
                              <MapPin className="h-3.5 w-3.5 text-cyan-400 mx-auto animate-bounce" />
                              <p className="text-[10px] text-zinc-350">Grid Position: {parseFloat(editTags.latitude).toFixed(4)}°N, {parseFloat(editTags.longitude).toFixed(4)}°W</p>
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${editTags.latitude},${editTags.longitude}`}
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-[8px] text-cyan-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                              >
                                EXPLORE EARTH GRID MAP
                              </a>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Sub-Section Block 3: Custom Field Extensions */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-[10px] font-black text-zinc-500 tracking-wider uppercase flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div> Custom Fields Injection
                          </h3>
                        </div>

                        {/* Tags display list */}
                        {Object.keys(editTags.customTags).length > 0 ? (
                          <div className="space-y-1.5">
                            {Object.entries(editTags.customTags).map(([k, v]) => (
                              <div key={k} className="flex gap-2">
                                <div className="w-1/3 bg-zinc-900/50 p-2 rounded border border-zinc-800 text-[10px] text-zinc-500 font-mono truncate" title={k}>{k}</div>
                                <div className="w-2/3 bg-zinc-900/50 p-2 rounded border border-zinc-800 text-[10px] text-indigo-400 font-mono flex justify-between items-center overflow-hidden">
                                  <span className="truncate pr-2" title={v}>{v}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCustomTag(k)}
                                    className="text-zinc-600 hover:text-rose-455 transition flex-shrink-0"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-zinc-650 italic">No custom metadata tags declared for active item.</p>
                        )}

                        {/* Interactive injection inputs */}
                        <div className="bg-zinc-900/20 p-3 rounded border border-zinc-850/60 flex gap-2 items-center">
                          <input 
                            type="text" 
                            placeholder="ProjectKey"
                            value={customKeyInput}
                            onChange={(e) => setCustomKeyInput(e.target.value)}
                            className="w-1/3 bg-zinc-900/50 p-2 rounded border border-zinc-800 text-[10px] text-zinc-300 font-mono outline-none focus:border-indigo-600/60"
                          />
                          <input 
                            type="text" 
                            placeholder="Tag Parameter Value"
                            value={customValueInput}
                            onChange={(e) => setCustomValueInput(e.target.value)}
                            className="w-2/3 bg-zinc-900/50 p-2 rounded border border-zinc-800 text-[10px] text-zinc-300 font-mono outline-none focus:border-indigo-600/60"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddCustomTag}
                          disabled={!customKeyInput.trim() || !customValueInput.trim()}
                          className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 border border-zinc-700 text-zinc-300 text-[10px] font-mono rounded tracking-wider uppercase transition cursor-pointer"
                        >
                          + INJECT CUSTOM KEY
                        </button>
                      </div>

                    </div>
                  </div>

                  {/* Active Header Action Apply Save Bar */}
                  <div className="p-4 border-t border-zinc-900 bg-zinc-950 flex flex-col sm:flex-row justify-between items-center gap-4 flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={autoBackupEnabled}
                          onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                          className="sr-only peer" 
                        />
                        <div className="w-8 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-zinc-950 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 peer-checked:after:bg-zinc-950 after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        <span className="ml-2.5 text-[9px] font-mono text-zinc-500 uppercase tracking-widest leading-none">AUTO-BACKUP ON WRITE</span>
                      </label>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                      {activeFile.isBackedUp && activeFile.backupId && (
                        <button
                          type="button"
                          onClick={() => {
                            const bk = backups.find(b => b.id === activeFile.backupId);
                            if (bk) handleRestoreBackup(bk);
                          }}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono rounded border border-zinc-700 transition cursor-pointer flex items-center gap-1.5"
                        >
                          <RotateCcw className="h-3.5 w-3.5 text-indigo-400" />
                          <span>ROLLBACK</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleSaveActiveFile}
                        disabled={!validation.isValid}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded font-medium shadow-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>SAVE CHANGES</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-950 text-zinc-500 space-y-4">
                  <div className="w-10 h-10 rounded bg-zinc-900 flex items-center justify-center text-zinc-400 border border-zinc-800">
                    <FileIcon className="h-5 w-5 text-zinc-600" />
                  </div>
                  <div>
                    <h3 className="text-xs font-mono tracking-wider text-zinc-400 uppercase">No file selected</h3>
                    <p className="text-[10px] text-zinc-600 font-mono mt-1.5 max-w-xs mx-auto leading-normal">
                      SELECT AN ITEM FROM THE SOURCE DIRECTORY SIDEBAR CATALOG TO EDIT CORE OR GEOTAGGING PARAMETERS.
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* Sidebar Columns: Operations & Bulk Settings (3 Cols) */}
            <aside className="lg:col-span-3 bg-zinc-900/10 flex flex-col h-[calc(100vh-104px)] overflow-hidden">
              {/* Workspace statistics */}
              <div className="p-4 border-b border-zinc-800 bg-zinc-950/30">
                <span className="text-[10px] font-bold text-zinc-500 tracking-wider">WORKSPACE STATUS</span>
                
                <div className="mt-3 space-y-1.5 text-[11px] font-mono">
                  <div className="flex justify-between text-zinc-400">
                    <span>Total Files</span>
                    <span className="text-zinc-300 font-bold">{files.length}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Pending Edits</span>
                    <span className="text-amber-500">
                      {files.filter(f => f.status === 'Modified').length} Queue
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Saved Clean</span>
                    <span className="text-emerald-500 font-bold">
                      {files.filter(f => f.status === 'Saved').length} Clean
                    </span>
                  </div>
                </div>
              </div>

              {/* Bulk operations panel */}
              <div className="p-4 border-b border-zinc-800 bg-zinc-950/20 space-y-3">
                <span className="text-[10px] font-bold text-zinc-500 tracking-wider block">BULK PROCESS ACTIONS</span>
                <p className="text-[9px] text-zinc-600 leading-normal italic">
                  Mutates media headers in bulk inside the reactive browser sandbox.
                </p>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleBulkStrip('all')}
                    disabled={isProcessingBulk}
                    className="w-full py-2 bg-rose-950/20 hover:bg-rose-900/40 text-rose-455 border border-rose-900/30 rounded text-[10px] font-mono tracking-wide uppercase transition cursor-pointer disabled:opacity-40"
                  >
                    WIPE ALL METADATA
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleBulkStrip('location-time')}
                    disabled={isProcessingBulk}
                    className="w-full py-2 bg-amber-950/20 hover:bg-amber-900/40 text-amber-500 border border-amber-900/30 rounded text-[10px] font-mono tracking-wide uppercase transition cursor-pointer disabled:opacity-40"
                  >
                    STRIP GEO/TIME
                  </button>
                </div>
              </div>

              {/* Console logs */}
              {isProcessingBulk && (
                <div className="p-4 border-b border-zinc-800 bg-zinc-950/40 text-[10px] font-mono text-indigo-400 space-y-1 animate-pulse">
                  <div className="flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>MUTATING BUFFER...</span>
                  </div>
                  <div className="text-[9px] text-zinc-500 truncate">{bulkStatusMsg}</div>
                </div>
              )}

              {/* Safe checkpoints storage views */}
              <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950/10">
                <div className="p-4 border-b border-zinc-850 bg-zinc-950/15">
                  <span className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase block">Rollback Checkpoints</span>
                </div>
                
                <div className="flex-1 p-3 overflow-y-auto space-y-2 custom-scrollbar">
                  {backups.length > 0 ? (
                    backups.map((bk) => (
                      <div key={bk.id} className="p-2.5 bg-zinc-950 border border-zinc-850 rounded text-[9px] font-mono space-y-1">
                        <div className="flex justify-between items-start">
                          <span className="text-zinc-350 truncate max-w-[120px]" title={bk.name}>{bk.name}</span>
                          <span className="text-zinc-600 shrink-0 text-[8px]">{bk.timestamp}</span>
                        </div>
                        <div className="flex justify-between items-center text-[8px] pt-1.5 border-t border-zinc-900/60">
                          <span className="text-zinc-500 font-mono">{(bk.size/1024).toFixed(0)} KB</span>
                          <button
                            type="button"
                            onClick={() => handleRestoreBackup(bk)}
                            className="text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                          >
                            <RotateCcw className="h-2 w-2" /> ROLLBACK
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                      <HelpCircle className="h-6 w-6 text-zinc-800" />
                      <p className="text-[9px] text-zinc-605 italic mt-1.5 leading-normal">
                        Safety backups are created on-the-fly when saving.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </aside>

          </main>

          {/* Dynamic Footer Processing Status */}
          <footer className="h-10 border-t border-zinc-900 flex items-center px-6 justify-between bg-zinc-950 flex-shrink-0 z-10">
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-zinc-500 flex items-center gap-1.5 font-mono">
                <svg className="w-3 h-3 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
                BROWSER-SIDE SANDBOX ACTIVE
              </span>
              <div className="h-3 w-px bg-zinc-800"></div>
              <span className="text-[10px] text-zinc-500 font-mono">XMP_SIDE_LOADER: READY</span>
            </div>
            
            <div className="flex items-center gap-3">
               <div className="text-[10px] text-zinc-500 font-mono">
                 {files.filter(f => f.status === 'Modified').length} FILES QUEUED
               </div>
               <div className="w-24 h-1 bg-zinc-800 rounded-full overflow-hidden">
                 <div 
                   className="h-full bg-indigo-600 transition-all duration-300"
                   style={{ width: `${files.length > 0 ? (files.filter(f => f.status === 'Saved').length / files.length) * 100 : 0}%` }}
                 ></div>
               </div>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
