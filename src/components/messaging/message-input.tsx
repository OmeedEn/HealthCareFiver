'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ATTACHMENT_ACCEPT,
  attachmentTypeFor,
  validateAttachment,
} from '@/lib/messaging/attachments'
import {
  formatDuration,
  recordingSupported,
  useMediaRecorder,
} from './use-media-recorder'
import {
  SendIcon,
  Loader2Icon,
  PaperclipIcon,
  MicIcon,
  VideoIcon,
  XIcon,
  SquareIcon,
  FileTextIcon,
  CircleIcon,
} from 'lucide-react'
import { toast } from 'sonner'

interface MessageInputProps {
  /** Throw to keep the draft in place (e.g. on a failed send). */
  onSend: (content: string, file: File | null) => Promise<void>
  /** Show the photo / voice / video controls. */
  allowAttachments?: boolean
  placeholder?: string
}

/** Blob URL for a local file, revoked when the file changes or on unmount. */
function useObjectUrl(file: File | null): string | null {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])
  return url
}

const noopSubscribe = () => () => {}

function PendingPreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const type = attachmentTypeFor(file.type)
  const url = useObjectUrl(file)

  return (
    <div className="flex items-center gap-3 border-t bg-[#f7f7f7] px-4 py-2">
      <div className="min-w-0 flex-1">
        {type === 'image' && url ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview
          <img src={url} alt="" className="h-16 rounded-md object-cover" />
        ) : type === 'video' && url ? (
          <video src={url} className="h-24 rounded-md bg-black" controls playsInline />
        ) : type === 'audio' && url ? (
          <audio src={url} controls className="w-64 max-w-full" />
        ) : (
          <span className="flex items-center gap-2 text-sm text-[#404145]">
            <FileTextIcon className="size-4" />
            <span className="truncate">{file.name}</span>
          </span>
        )}
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Remove attachment">
        <XIcon className="size-4" />
      </Button>
    </div>
  )
}

/** Mounted only while open, so each opening starts fresh. */
function VideoRecorderDialog({
  onClose,
  onDone,
}: {
  onClose: () => void
  onDone: (file: File) => void
}) {
  const rec = useMediaRecorder('video')
  const liveRef = useRef<HTMLVideoElement>(null)
  const [result, setResult] = useState<File | null>(null)
  const resultUrl = useObjectUrl(result)
  const { open: openCamera, cancel, stop, limitReached } = rec

  useEffect(() => {
    openCamera()
    return cancel
  }, [openCamera, cancel])

  useEffect(() => {
    if (liveRef.current) liveRef.current.srcObject = rec.stream
  }, [rec.stream, result])

  async function handleStop() {
    const file = await stop()
    setResult(file)
  }

  useEffect(() => {
    if (limitReached) {
      stop().then(setResult)
    }
  }, [limitReached, stop])

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="font-sans sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#404145]">Record a video</DialogTitle>
        </DialogHeader>
        {rec.error ? (
          <p className="text-sm text-red-600">{rec.error}</p>
        ) : result && resultUrl ? (
          <video src={resultUrl} controls playsInline className="w-full rounded-lg bg-black" />
        ) : (
          <div className="relative">
            {!rec.stream && (
              <p className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-sm text-white">
                {rec.requesting
                  ? 'Allow camera and microphone access in the prompt near your address bar.'
                  : 'Starting camera…'}
              </p>
            )}
            <video
              ref={liveRef}
              autoPlay
              muted
              playsInline
              className="w-full -scale-x-100 rounded-lg bg-black"
            />
            {rec.recording && (
              <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
                <CircleIcon className="size-2 animate-pulse fill-red-500 text-red-500" />
                {formatDuration(rec.seconds)} / {formatDuration(rec.maxSeconds)}
              </span>
            )}
          </div>
        )}
        <DialogFooter>
          {result ? (
            <>
              <Button variant="outline" onClick={() => setResult(null)}>
                Record again
              </Button>
              <Button
                className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
                onClick={() => {
                  onDone(result)
                  onClose()
                }}
              >
                Use video
              </Button>
            </>
          ) : rec.recording ? (
            <Button variant="destructive" onClick={handleStop}>
              <SquareIcon className="size-4" data-icon="inline-start" />
              Stop
            </Button>
          ) : (
            <Button
              className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
              disabled={!rec.stream}
              onClick={() => rec.start()}
            >
              <CircleIcon className="size-4 fill-current" data-icon="inline-start" />
              Start recording
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function MessageInput({
  onSend,
  allowAttachments = false,
  placeholder = 'Type a message...',
}: MessageInputProps) {
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)
  // false during SSR, real answer in the browser.
  const canRecord = useSyncExternalStore(noopSubscribe, recordingSupported, () => false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const voice = useMediaRecorder('audio')
  const { stop: stopVoice, limitReached: voiceLimit } = voice

  useEffect(() => {
    if (voice.error) toast.error(voice.error)
  }, [voice.error])

  useEffect(() => {
    if (voiceLimit) stopVoice().then((f) => f && setFile(f))
  }, [voiceLimit, stopVoice])

  const pickFile = (f: File | undefined | null) => {
    if (!f) return
    const problem = validateAttachment(f)
    if (problem) {
      toast.error(problem)
      return
    }
    setFile(f)
  }

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if ((!trimmed && !file) || sending) return

    setSending(true)
    try {
      await onSend(trimmed, file)
      setContent('')
      setFile(null)
      textareaRef.current?.focus()
    } catch {
      // Parent shows the error; keep the draft.
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  async function toggleVoice() {
    if (voice.recording) {
      const f = await voice.stop()
      if (f) setFile(f)
    } else {
      setFile(null)
      await voice.start()
    }
  }

  return (
    <div className="bg-background">
      {file && !voice.recording && (
        <PendingPreview file={file} onRemove={() => setFile(null)} />
      )}
      <div className="flex items-end gap-2 border-t p-4">
        {allowAttachments && (
          <div className="flex shrink-0 items-center gap-0.5 pb-1">
            <input
              ref={fileRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Attach a photo, video or file"
              title="Attach a photo, video or file"
              disabled={sending || voice.recording}
              onClick={() => fileRef.current?.click()}
            >
              <PaperclipIcon className="size-4" />
            </Button>
            {canRecord && (
              <>
                <Button
                  variant={voice.recording ? 'destructive' : 'ghost'}
                  size="icon-sm"
                  aria-label={voice.recording ? 'Stop recording' : 'Record a voice message'}
                  title={voice.recording ? 'Stop recording' : 'Record a voice message'}
                  disabled={sending || voice.requesting}
                  onClick={toggleVoice}
                >
                  {voice.recording ? <SquareIcon className="size-4" /> : <MicIcon className="size-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Record a video"
                  title="Record a video"
                  disabled={sending || voice.recording}
                  onClick={() => setVideoOpen(true)}
                >
                  <VideoIcon className="size-4" />
                </Button>
              </>
            )}
          </div>
        )}
        {voice.requesting ? (
          <div className="flex min-h-10 flex-1 items-center gap-2 rounded-md border px-3 text-sm text-[#62646a]">
            <Loader2Icon className="size-4 animate-spin" />
            Allow microphone access in the prompt near your address bar.
          </div>
        ) : voice.recording ? (
          <div className="flex min-h-10 flex-1 items-center gap-2 rounded-md border px-3 text-sm text-[#404145]">
            <CircleIcon className="size-2.5 animate-pulse fill-red-500 text-red-500" />
            Recording {formatDuration(voice.seconds)}
            <Button variant="ghost" size="xs" className="ml-auto" onClick={voice.cancel}>
              Cancel
            </Button>
          </div>
        ) : (
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={(e) => {
              if (!allowAttachments) return
              const pasted = e.clipboardData.files?.[0]
              if (pasted) {
                e.preventDefault()
                pickFile(pasted)
              }
            }}
            placeholder={placeholder}
            className="min-h-10 max-h-32 resize-none"
            rows={1}
            disabled={sending}
          />
        )}
        <Button
          size="icon"
          aria-label="Send"
          onClick={handleSubmit}
          disabled={(!content.trim() && !file) || sending || voice.recording}
        >
          {sending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <SendIcon className="size-4" />
          )}
        </Button>
      </div>
      {allowAttachments && videoOpen && (
        <VideoRecorderDialog onClose={() => setVideoOpen(false)} onDone={(f) => pickFile(f)} />
      )}
    </div>
  )
}
