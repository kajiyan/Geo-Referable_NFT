import { useEffect, useState, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { logger } from '@/lib/logger'

// Shared MediaStream to prevent multiple simultaneous camera streams
let sharedMediaStream: MediaStream | null = null
let sharedStreamRefCount = 0

const acquireStream = async (constraints: VideoConstraints): Promise<MediaStream> => {
  if (sharedMediaStream) {
    sharedStreamRefCount++
    return sharedMediaStream
  }
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    video: constraints,
    audio: false,
  })
  sharedMediaStream = mediaStream
  sharedStreamRefCount = 1
  return mediaStream
}

const releaseStream = (): void => {
  if (!sharedMediaStream) return
  sharedStreamRefCount--
  if (sharedStreamRefCount <= 0) {
    try { sharedMediaStream.getTracks().forEach(track => track.stop()) } catch {}
    sharedMediaStream = null
  }
}

interface VideoConstraints {
  facingMode?: string
  width?: { ideal?: number; max?: number }
  height?: { ideal?: number; max?: number }
  aspectRatio?: { ideal?: number }
}

interface UseVideoStreamOptions {
  constraints?: VideoConstraints
  autoStart?: boolean
}

interface UseVideoStreamReturn {
  video: HTMLVideoElement | null
  videoTexture: THREE.Texture | null
  stream: MediaStream | null
  isReady: boolean
  error: Error | null
  dimensions: { width: number; height: number } | null
  start: () => Promise<void>
  stop: () => void
  mute: () => void
  unmute: () => void
}

class VideoStreamError extends Error {
  public code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'VideoStreamError'
    this.code = code
  }
}

const VIDEO_CONSTRAINTS = {
  MOBILE: {
    facingMode: 'environment',
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    aspectRatio: { ideal: 16 / 9 }
  },
  DESKTOP: {
    facingMode: 'environment',
    width: { ideal: 640, max: 1280 },
    height: { ideal: 480, max: 720 }
  },
  FALLBACK: {
    width: { ideal: 640, max: 1280 },
    height: { ideal: 480, max: 720 }
  }
} as const

const ERROR_CODES = {
  VIDEO_LOAD: 'VIDEO_LOAD_ERROR',
  CAMERA_ACCESS: 'CAMERA_ACCESS_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
} as const

const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

const createVideoElement = (): HTMLVideoElement => {
  const video = document.createElement('video')
  // Attributes for broad mobile support (iOS Safari, Chrome Android)
  video.setAttribute('playsinline', 'true')
  video.setAttribute('webkit-playsinline', 'true')
  video.setAttribute('autoplay', 'true')
  video.setAttribute('muted', 'true')
  // Also set properties to satisfy autoplay policies
  ;(video as any).playsInline = true
  video.autoplay = true
  video.muted = true
  video.playsInline = true as any
  video.preload = 'auto'
  return video
}

const createVideoTexture = (video: HTMLVideoElement): THREE.VideoTexture => {
  const texture = new THREE.VideoTexture(video)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}


const waitForVideoMetadata = (video: HTMLVideoElement): Promise<void> => {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.onloadedmetadata = null
      video.onerror = null
      video.oncanplay = null
    }

    const tryPlay = () => {
      // Ensure properties are set before attempting to play
      video.muted = true
      ;(video as any).playsInline = true
      video.autoplay = true
      video
        .play()
        .then(() => {
          cleanup()
          resolve()
        })
        .catch((_err: unknown) => {
          // Retry once after forcing muted/inline for stricter browsers
          try {
            video.muted = true
            ;(video as any).playsInline = true
          } catch {}
          video.play().then(() => {
            cleanup()
            resolve()
          }).catch((finalErr) => {
            cleanup()
            reject(finalErr instanceof Error ? finalErr : new VideoStreamError('Failed to start video', ERROR_CODES.VIDEO_LOAD))
          })
        })
    }

    video.onloadedmetadata = () => {
      // Some browsers emit canplay later; attempt play on either
      tryPlay()
    }

    video.oncanplay = () => {
      tryPlay()
    }

    video.onerror = () => {
      cleanup()
      reject(new VideoStreamError('Failed to load video', ERROR_CODES.VIDEO_LOAD))
    }
  })
}

const getDefaultConstraints = (): VideoConstraints => {
  return isMobileDevice() ? VIDEO_CONSTRAINTS.MOBILE : VIDEO_CONSTRAINTS.DESKTOP
}

const getFallbackConstraints = (constraints: VideoConstraints): VideoConstraints => {
  return {
    ...constraints,
    ...VIDEO_CONSTRAINTS.FALLBACK
  }
}

export const useVideoStream = (options: UseVideoStreamOptions = {}): UseVideoStreamReturn => {
  const {
    constraints = getDefaultConstraints(),
    autoStart = true
  } = options

  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const [videoTexture, setVideoTexture] = useState<THREE.Texture | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const textureRef = useRef<THREE.Texture | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Mute video stream (disable tracks without releasing the stream)
  // Camera LED indicator turns off, but stream remains active for instant resume
  const mute = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => {
        track.enabled = false
      })
    }
    if (videoRef.current) {
      videoRef.current.pause()
    }
  }, [])

  // Unmute video stream (re-enable tracks)
  const unmute = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => {
        track.enabled = true
      })
    }
    if (videoRef.current) {
      videoRef.current.play().catch(() => {})
    }
  }, [])

  const stop = useCallback(() => {
    if (streamRef.current) {
      // Release shared media stream
      try { releaseStream() } catch {}
      streamRef.current = null
      setStream(null)
    }

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
      videoRef.current.src = ''
      videoRef.current = null
      setVideo(null)
    }

    if (textureRef.current) {
      textureRef.current.dispose()
      textureRef.current = null
      setVideoTexture(null)
    }

    setIsReady(false)
    setDimensions(null)
  }, [])

  const startWithConstraints = useCallback(async (videoConstraints: VideoConstraints): Promise<void> => {
    const videoElement = createVideoElement()
    videoRef.current = videoElement

    let acquired = false
    try {
      const mediaStream = await acquireStream(videoConstraints)
      acquired = true

      streamRef.current = mediaStream
      videoElement.srcObject = mediaStream

      await waitForVideoMetadata(videoElement)

      console.log(`Video connection successful - resolution: ${videoElement.videoWidth}x${videoElement.videoHeight}`)

      // Use VideoTexture directly (GPU→GPU, zero-copy)
      // This avoids the GPU→CPU→GPU roundtrip that CanvasTexture would cause
      const tex = createVideoTexture(videoElement)
      textureRef.current = tex

      setVideo(videoElement)
      setVideoTexture(tex)
      setStream(mediaStream)
      setDimensions({
        width: videoElement.videoWidth,
        height: videoElement.videoHeight
      })
      setIsReady(true)
      setError(null)
    } catch (err) {
      if (acquired) {
        try { releaseStream() } catch {}
      }
      if (err instanceof Error) {
        throw new VideoStreamError(`Camera access error: ${err.message}`, ERROR_CODES.CAMERA_ACCESS)
      }
      throw new VideoStreamError('Failed to access camera', ERROR_CODES.UNKNOWN)
    }
  }, [])

  const start = useCallback(async () => {
    try {
      stop()
      await startWithConstraints(constraints)
    } catch (err) {
      logger.error('useVideoStream', 'Camera access error', err)

      if (constraints.width?.ideal && constraints.width.ideal > 640) {
        logger.warn('useVideoStream', 'High resolution failed, retry with fallback')
        try {
          const fallbackConstraints = getFallbackConstraints(constraints)
          await startWithConstraints(fallbackConstraints)
          logger.info('useVideoStream', 'Fallback connection successful')
        } catch (fallbackErr) {
          const error = fallbackErr instanceof VideoStreamError ? fallbackErr : new VideoStreamError('Failed to access camera', ERROR_CODES.UNKNOWN)
          setError(error)
          setIsReady(false)
        }
      } else {
        const error = err instanceof VideoStreamError ? err : new VideoStreamError('Failed to access camera', ERROR_CODES.UNKNOWN)
        setError(error)
        setIsReady(false)
      }
    }
  }, [constraints, stop, startWithConstraints])

  useEffect(() => {
    if (autoStart) {
      start()
    }

    return () => {
      stop()
    }
  }, [autoStart, start, stop])

  // Handle page lifecycle events
  // - pagehide: Complete stop to avoid resource leaks across navigations
  // - visibilitychange: Mute/unmute for instant resume on tab switch
  useEffect(() => {
    const handlePageHide = () => {
      try { stop() } catch {}
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Tab hidden: mute only (keep stream for instant resume)
        mute()
      } else if (document.visibilityState === 'visible') {
        // Tab visible: unmute to resume camera
        unmute()
      }
    }

    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [stop, mute, unmute])

  return {
    video,
    videoTexture,
    stream,
    isReady,
    error,
    dimensions,
    start,
    stop,
    mute,
    unmute,
  }
}
