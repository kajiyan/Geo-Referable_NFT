import { useState, useEffect } from 'react'

interface GpsPosition {
  latitude: number
  longitude: number
}

/**
 * Pre-captures a map tile image when a dialog is open and GPS is available.
 * Returns mapDataUrl (base64 PNG) and isCapturing state.
 * Resets when dialogOpen becomes false.
 */
export function useMapPreCapture(dialogOpen: boolean, gpsPosition: GpsPosition | null) {
  const [mapDataUrl, setMapDataUrl] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)

  useEffect(() => {
    if (dialogOpen && gpsPosition && !mapDataUrl && !isCapturing) {
      setIsCapturing(true)
    }
    if (!dialogOpen) {
      setMapDataUrl(null)
      setIsCapturing(false)
    }
  }, [dialogOpen, gpsPosition, mapDataUrl, isCapturing])

  const handleCaptured = (dataUrl: string) => {
    setMapDataUrl(dataUrl)
    setIsCapturing(false)
  }

  const handleError = () => {
    setIsCapturing(false)
  }

  return { mapDataUrl, isCapturing, handleCaptured, handleError }
}
