'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  StickyNote, Plus, Trash2, Pin, Eye, Edit3,
  ChevronDown, ChevronUp, X, Clock, Type,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Note {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  lastEdited: string;
  createdAt: string;
}

interface ProjectNotesProps {
  projectId: string;
  projectName: string;
}

const STORAGE_PREFIX = 'git-atlas-notes-';

function getNotes(projectId: string): Note[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveNotes(projectId: string, notes: Note[]) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${projectId}`, JSON.stringify(notes));
  } catch { /* ignore */ }
}

function generateId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

export function ProjectNotes({ projectId, projectName }: ProjectNotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const { toast } = useToast();

  // Load notes from localStorage
  useEffect(() => {
    setNotes(getNotes(projectId));
  }, [projectId]);

  // Save notes to localStorage whenever they change
  useEffect(() => {
    if (notes.length >= 0) {
      saveNotes(projectId, notes);
    }
  }, [notes, projectId]);

  const handleCreateNote = useCallback(() => {
    const newNote: Note = {
      id: generateId(),
      title: '',
      content: '',
      pinned: false,
      lastEdited: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    setNotes(prev => [newNote, ...prev]);
    setEditingNoteId(newNote.id);
    setEditTitle('');
    setEditContent('');
    setPreviewMode(false);
    setIsCreating(true);
  }, []);

  const handleSaveNote = useCallback(() => {
    if (!editingNoteId) return;
    setNotes(prev => prev.map(n =>
      n.id === editingNoteId
        ? { ...n, title: editTitle || 'Untitled Note', content: editContent, lastEdited: new Date().toISOString() }
        : n
    ));
    setEditingNoteId(null);
    setIsCreating(false);
    toast({ title: 'Note saved', duration: 1500 });
  }, [editingNoteId, editTitle, editContent, toast]);

  const handleDeleteNote = useCallback((noteId: string) => {
    setNotes(prev => prev.filter(n => n.id !== noteId));
    if (editingNoteId === noteId) {
      setEditingNoteId(null);
      setIsCreating(false);
    }
    toast({ title: 'Note deleted', duration: 1500 });
  }, [editingNoteId, toast]);

  const handleTogglePin = useCallback((noteId: string) => {
    setNotes(prev => prev.map(n =>
      n.id === noteId ? { ...n, pinned: !n.pinned } : n
    ));
  }, []);

  const handleStartEdit = useCallback((note: Note) => {
    setEditingNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setPreviewMode(false);
    setIsCreating(true);
  }, []);

  const handleCancelEdit = useCallback(() => {
    // If it's a new empty note, remove it
    if (editingNoteId) {
      const note = notes.find(n => n.id === editingNoteId);
      if (note && !note.title && !note.content) {
        setNotes(prev => prev.filter(n => n.id !== editingNoteId));
      }
    }
    setEditingNoteId(null);
    setIsCreating(false);
  }, [editingNoteId, notes]);

  const charCount = editContent.length;

  // Sort: pinned first, then by lastEdited
  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime();
    });
  }, [notes]);

  // Pinned notes (for display at top of detail panel)
  const pinnedNotes = useMemo(() => notes.filter(n => n.pinned && n.content), [notes]);

  return (
    <div>
      {/* Pinned Notes Banner — shown at top of detail panel */}
      {pinnedNotes.length > 0 && !isCreating && (
        <div className="mb-3 space-y-1.5">
          {pinnedNotes.map(note => (
            <div
              key={note.id}
              className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15"
            >
              <Pin className="w-3 h-3 text-amber-400 shrink-0 mt-0.5 rotate-45" />
              <div className="flex-1 min-w-0">
                {note.title && (
                  <p className="text-[10px] font-medium text-amber-400/80 truncate">{note.title}</p>
                )}
                <p className="text-[10px] text-foreground/50 line-clamp-2">{note.content}</p>
              </div>
              <button
                onClick={() => handleStartEdit(note)}
                className="shrink-0 p-0.5 rounded text-muted-foreground/30 hover:text-foreground/50 transition-colors"
              >
                <Edit3 className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1">
          <StickyNote className="w-3 h-3" /> Project Notes
          {notes.length > 0 && (
            <span className="text-[9px] text-muted-foreground/30 normal-case ml-1">({notes.length})</span>
          )}
        </h4>
        <Button
          size="sm"
          variant="outline"
          className="h-5 gap-1 text-[9px] px-1.5 border-border/20"
          onClick={handleCreateNote}
        >
          <Plus className="w-2.5 h-2.5" /> New
        </Button>
      </div>

      {/* Edit/Create Form */}
      <AnimatePresence>
        {editingNoteId && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mb-3"
          >
            <div className="border border-border/20 rounded-lg bg-background/30 p-3 space-y-2">
              {/* Title input */}
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Note title..."
                className="w-full bg-transparent text-xs text-foreground/80 placeholder:text-muted-foreground/30 outline-none border-b border-border/10 pb-1.5"
              />

              {/* Edit/Preview toggle */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPreviewMode(false)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
                    !previewMode ? 'bg-emerald-500/10 text-emerald-400' : 'text-muted-foreground/40 hover:text-foreground/60'
                  }`}
                >
                  <Edit3 className="w-2.5 h-2.5" /> Edit
                </button>
                <button
                  onClick={() => setPreviewMode(true)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
                    previewMode ? 'bg-emerald-500/10 text-emerald-400' : 'text-muted-foreground/40 hover:text-foreground/60'
                  }`}
                >
                  <Eye className="w-2.5 h-2.5" /> Preview
                </button>
                <div className="flex-1" />
                <span className="text-[9px] text-muted-foreground/30 flex items-center gap-1">
                  <Type className="w-2.5 h-2.5" /> {charCount}
                </span>
              </div>

              {/* Content area */}
              {previewMode ? (
                <div className="min-h-[60px] max-h-48 overflow-y-auto custom-scrollbar text-xs text-foreground/70 bg-card/20 rounded p-2 prose prose-invert prose-xs max-w-none">
                  <ReactMarkdown>{editContent || '*No content yet...*'}</ReactMarkdown>
                </div>
              ) : (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Write your note here... (Markdown supported)"
                  className="w-full min-h-[80px] max-h-48 bg-card/20 rounded p-2 text-xs text-foreground/70 placeholder:text-muted-foreground/30 outline-none resize-y border border-border/10 focus:border-emerald-500/30 transition-colors custom-scrollbar"
                />
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-6 gap-1 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white"
                  onClick={handleSaveNote}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 text-[10px] text-muted-foreground/50"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes List */}
      {sortedNotes.length > 0 ? (
        <div className="space-y-1.5">
          {sortedNotes.map(note => (
            <div
              key={note.id}
              className={`group p-2.5 rounded-lg border transition-all ${
                note.pinned
                  ? 'bg-amber-500/5 border-amber-500/15'
                  : 'bg-background/20 border-border/10 hover:border-border/20'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {note.pinned && <Pin className="w-2.5 h-2.5 text-amber-400 rotate-45" />}
                    <span className="text-[10px] font-medium text-foreground/70 truncate">
                      {note.title || 'Untitled Note'}
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground/40 line-clamp-2">{note.content || 'Empty note'}</p>
                  <p className="text-[8px] text-muted-foreground/20 mt-1 flex items-center gap-1">
                    <Clock className="w-2 h-2" />
                    {formatDistanceToNow(new Date(note.lastEdited), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => handleTogglePin(note.id)}
                    className={`p-1 rounded transition-colors ${note.pinned ? 'text-amber-400' : 'text-muted-foreground/30 hover:text-amber-400/60'}`}
                    title={note.pinned ? 'Unpin note' : 'Pin note'}
                  >
                    <Pin className="w-2.5 h-2.5" style={{ transform: note.pinned ? 'rotate(45deg)' : 'none' }} />
                  </button>
                  <button
                    onClick={() => handleStartEdit(note)}
                    className="p-1 rounded text-muted-foreground/30 hover:text-foreground/60 transition-colors"
                    title="Edit note"
                  >
                    <Edit3 className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="p-1 rounded text-muted-foreground/30 hover:text-red-400/60 transition-colors"
                    title="Delete note"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 p-3 rounded-lg border border-dashed border-border/20 bg-background/10">
          <StickyNote className="w-4 h-4 text-muted-foreground/30" />
          <p className="text-[10px] text-muted-foreground/40">No notes yet for {projectName}</p>
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 text-[10px] border-border/20"
            onClick={handleCreateNote}
          >
            <Plus className="w-2.5 h-2.5" /> Add Note
          </Button>
        </div>
      )}
    </div>
  );
}
