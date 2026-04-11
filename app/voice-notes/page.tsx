'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Upload, Trash2, Play, Pause, Pencil, Check, X } from 'lucide-react'
import { db, type VoiceNote } from '@/lib/db'
import { useToastStore } from '@/lib/store'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils'

function formatDuration(seconds?: number) {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Audio Player ──────────────────────────────────────────────────────────────

function AudioPlayer({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause() } else { audio.play() }
    setPlaying((p) => !p)
  }

  return (
    <div className="flex items-center gap-2">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={() => {
          const audio = audioRef.current
          if (!audio || !audio.duration) return
          setProgress((audio.currentTime / audio.duration) * 100)
        }}
        onLoadedMetadata={() => {
          const audio = audioRef.current
          if (audio) setDuration(audio.duration)
        }}
        onEnded={() => { setPlaying(false); setProgress(0) }}
      />
      <button
        onClick={toggle}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90 transition-opacity"
      >
        {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 translate-x-0.5" />}
      </button>
      <div className="flex-1">
        <div className="h-1 rounded-full bg-[var(--border)] overflow-hidden">
          <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${progress}%` }} />
        </div>
        {duration > 0 && (
          <div className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">{formatDuration(Math.floor(duration))}</div>
        )}
      </div>
    </div>
  )
}

// ── Voice Note Card ────────────────────────────────────────────────────────────

function VoiceNoteCard({ note, onDelete, onRename }: {
  note: VoiceNote
  onDelete: (id: string, filePath: string) => void
  onRename: (id: string, title: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(note.title)
  const [deleting, setDeleting] = useState(false)

  const handleRename = async () => {
    if (title.trim() && title !== note.title) {
      await onRename(note.id, title.trim())
    }
    setEditing(false)
  }

  return (
    <motion.div
      layout
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4',
        'hover:border-[var(--border-strong)] transition-all group',
        deleting && 'opacity-50 pointer-events-none'
      )}
    >
      {/* Title */}
      <div className="mb-3 flex items-center gap-2">
        {editing ? (
          <div className="flex flex-1 items-center gap-1.5">
            <input
              value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setTitle(note.title); setEditing(false) } }}
              className="flex-1 rounded-[6px] border border-[var(--accent)] bg-[var(--surface-2)] px-2 py-1 text-[13px] text-[var(--text-primary)] focus:outline-none"
            />
            <button onClick={handleRename} className="rounded-[4px] p-1 text-green-400 hover:bg-green-500/10 transition-colors"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => { setTitle(note.title); setEditing(false) }} className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] transition-colors"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <>
            <Mic className="h-3.5 w-3.5 flex-shrink-0 text-[var(--accent)]" />
            <span className="flex-1 truncate text-[13px] font-medium text-[var(--text-primary)]">{note.title}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setEditing(true)} className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)] transition-colors"><Pencil className="h-3 w-3" /></button>
              <button onClick={() => { setDeleting(true); onDelete(note.id, note.filePath) }} className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-red-500/10 hover:text-red-400 transition-colors"><Trash2 className="h-3 w-3" /></button>
            </div>
          </>
        )}
      </div>

      {/* Player */}
      <AudioPlayer url={note.fileUrl} />

      {/* Meta */}
      <div className="mt-2 text-[11px] text-[var(--text-tertiary)]">
        {formatDate(note.createdAt)}
        {note.durationSeconds && ` · ${formatDuration(note.durationSeconds)}`}
      </div>
    </motion.div>
  )
}

// ── Upload Zone ───────────────────────────────────────────────────────────────

const ACCEPTED = ['.mp3', '.m4a', '.wav', '.ogg', '.webm', 'audio/*']

function UploadZone({ onUpload }: { onUpload: (file: File) => void }) {
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('audio/')) onUpload(file)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => fileRef.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[12px] border-2 border-dashed p-12 text-center transition-all',
        dragOver
          ? 'border-[var(--accent)] bg-[var(--accent-muted)]'
          : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)]'
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border)]">
        <Mic className="h-5 w-5 text-[var(--accent)]" />
      </div>
      <div>
        <p className="text-[14px] font-medium text-[var(--text-primary)]">Drop an audio file here</p>
        <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">MP3, M4A, WAV, OGG, WEBM · or click to browse</p>
      </div>
      <input
        ref={fileRef} type="file" accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f) }}
      />
    </div>
  )
}

// ── Upload Progress ───────────────────────────────────────────────────────────

function UploadProgress({ filename, progress }: { filename: string; progress: number }) {
  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="truncate text-[13px] text-[var(--text-primary)]">{filename}</span>
        <span className="text-[12px] text-[var(--text-tertiary)]">{progress}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
        <motion.div
          className="h-full bg-[var(--accent)]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VoiceNotesPage() {
  const [notes, setNotes] = useState<VoiceNote[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<{ name: string; progress: number } | null>(null)
  const { addToast } = useToastStore()

  const load = useCallback(async () => {
    try {
      const data = await db.voiceNotes.list()
      setNotes(data)
    } catch {
      addToast({ type: 'error', message: 'Failed to load voice notes' })
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { load() }, [load])

  const handleUpload = async (file: File) => {
    setUploading({ name: file.name, progress: 10 })
    try {
      const progressInterval = setInterval(() => {
        setUploading((prev) => prev ? { ...prev, progress: Math.min(prev.progress + 12, 75) } : null)
      }, 300)

      // Get audio duration client-side
      const duration = await new Promise<number>((resolve) => {
        const audio = new Audio()
        audio.onloadedmetadata = () => resolve(Math.floor(audio.duration))
        audio.src = URL.createObjectURL(file)
        setTimeout(() => resolve(0), 5000)
      })

      const { url, path } = await db.voiceNotes.upload(file)
      setUploading((prev) => prev ? { ...prev, progress: 85 } : null)

      // Transcribe via Groq Whisper (fire in parallel, don't block)
      let transcript: string | null = null
      try {
        const tForm = new FormData()
        tForm.append('file', file, file.name)
        const tRes = await fetch('/api/voice-notes/transcribe', { method: 'POST', body: tForm })
        const tJson = await tRes.json() as { transcript?: string | null }
        transcript = tJson.transcript ?? null
      } catch {
        // Transcription is optional — don't fail the upload
      }

      clearInterval(progressInterval)
      setUploading((prev) => prev ? { ...prev, progress: 100 } : null)

      const note = await db.voiceNotes.insert({
        title: transcript
          ? transcript.slice(0, 80).replace(/[^\w\s]/g, '').trim() || file.name.replace(/\.[^.]+$/, '')
          : file.name.replace(/\.[^.]+$/, ''),
        file_url: url,
        file_path: path,
        duration_seconds: duration || undefined,
      })

      setNotes((prev) => [note, ...prev])
      addToast({
        type: 'success',
        message: transcript ? 'Uploaded & transcribed' : 'Voice note uploaded',
      })
    } catch {
      addToast({ type: 'error', message: 'Upload failed' })
    } finally {
      setTimeout(() => setUploading(null), 500)
    }
  }

  const handleDelete = async (id: string, filePath: string) => {
    const note = notes.find((n) => n.id === id)
    setNotes((prev) => prev.filter((n) => n.id !== id))
    try {
      await db.voiceNotes.delete(id, filePath)
      addToast({ type: 'success', message: 'Voice note deleted' })
    } catch {
      if (note) setNotes((prev) => [note, ...prev])
      addToast({ type: 'error', message: 'Failed to delete voice note' })
    }
  }

  const handleRename = async (id: string, title: string) => {
    const note = notes.find((n) => n.id === id)
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, title } : n))
    try {
      await db.voiceNotes.update(id, { title })
    } catch {
      if (note) setNotes((prev) => prev.map((n) => n.id === id ? note : n))
      addToast({ type: 'error', message: 'Failed to rename' })
    }
  }

  return (
    <div className="min-h-full p-6">
      <PageHeader title="Voice Notes" description={`${notes.length} recording${notes.length !== 1 ? 's' : ''}`} />

      {/* Upload zone */}
      <div className="mb-6">
        <UploadZone onUpload={handleUpload} />
      </div>

      {/* Upload progress */}
      <AnimatePresence>
        {uploading && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4"
          >
            <UploadProgress filename={uploading.name} progress={uploading.progress} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-[10px] bg-[var(--surface-2)]" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={Mic}
          heading="No voice notes yet"
          subtext="Drop an audio file above to get started."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {notes.map((note) => (
              <VoiceNoteCard key={note.id} note={note} onDelete={handleDelete} onRename={handleRename} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
