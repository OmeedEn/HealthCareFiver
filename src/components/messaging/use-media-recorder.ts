'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Kind = 'audio' | 'video'

const CANDIDATES: Record<Kind, string[]> = {
  audio: ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'],
  video: ['video/webm;codecs=vp8,opus', 'video/mp4', 'video/webm'],
}

// Keep recordings comfortably under the 50 MB upload limit.
const MAX_SECONDS: Record<Kind, number> = { audio: 10 * 60, video: 3 * 60 }

function pickMime(kind: Kind): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return CANDIDATES[kind].find((m) => MediaRecorder.isTypeSupported(m))
}

export function recordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  )
}

/**
 * Records audio or video from the device. `start()` asks for permission and
 * begins recording; `stop()` resolves with the finished File; `cancel()`
 * discards it. `stream` is exposed so a <video> can show the live preview.
 */
export function useMediaRecorder(kind: Kind) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const resolveRef = useRef<((f: File | null) => void) | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setStream(null)
  }, [])

  /** Open the mic/camera without recording (for a live preview). */
  const open = useCallback(async () => {
    setError(null)
    if (streamRef.current) return streamRef.current
    try {
      const s = await navigator.mediaDevices.getUserMedia(
        kind === 'audio'
          ? { audio: true }
          : { audio: true, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } }
      )
      streamRef.current = s
      setStream(s)
      return s
    } catch {
      setError(
        kind === 'audio'
          ? 'Microphone access was blocked. Allow it in your browser settings.'
          : 'Camera access was blocked. Allow it in your browser settings.'
      )
      return null
    }
  }, [kind])

  const start = useCallback(async () => {
    const s = await open()
    if (!s) return false
    const mimeType = pickMime(kind)
    const rec = new MediaRecorder(s, {
      ...(mimeType ? { mimeType } : {}),
      ...(kind === 'video' ? { videoBitsPerSecond: 1_500_000 } : { audioBitsPerSecond: 64_000 }),
    })
    chunksRef.current = []
    rec.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data)
    }
    rec.onstop = () => {
      const type = rec.mimeType || mimeType || `${kind}/webm`
      const blob = new Blob(chunksRef.current, { type })
      const ext = type.includes('mp4') ? (kind === 'audio' ? 'm4a' : 'mp4') : 'webm'
      const label = kind === 'audio' ? 'voice-message' : 'video'
      const file = blob.size ? new File([blob], `${label}.${ext}`, { type }) : null
      resolveRef.current?.(file)
      resolveRef.current = null
    }
    recorderRef.current = rec
    rec.start(1000)
    setSeconds(0)
    setRecording(true)
    return true
  }, [kind, open])

  const stop = useCallback((): Promise<File | null> => {
    const rec = recorderRef.current
    if (!rec || rec.state === 'inactive') return Promise.resolve(null)
    return new Promise((resolve) => {
      resolveRef.current = resolve
      rec.stop()
      setRecording(false)
      if (kind === 'audio') release()
    })
  }, [kind, release])

  const cancel = useCallback(() => {
    const rec = recorderRef.current
    resolveRef.current = null
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null
      rec.stop()
    }
    recorderRef.current = null
    setRecording(false)
    setSeconds(0)
    release()
  }, [release])

  // Recording timer.
  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [recording])

  // Always free the mic/camera on unmount.
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  return {
    stream,
    recording,
    seconds,
    maxSeconds: MAX_SECONDS[kind],
    /** Callers should stop() when this turns true. */
    limitReached: recording && seconds >= MAX_SECONDS[kind],
    error,
    open,
    start,
    stop,
    cancel,
    release,
  }
}

export function formatDuration(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
