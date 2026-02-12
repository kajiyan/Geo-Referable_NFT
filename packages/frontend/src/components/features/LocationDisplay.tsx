import type { GpsPosition } from '@/lib/slices/sensorSlice'

interface LocationDisplayProps {
  position: GpsPosition | null
}

export function LocationDisplay({ position }: LocationDisplayProps) {
  if (!position) return null

  return (
    <div className="mt-3 text-sm text-gray-600 dark:text-gray-400 space-y-1">
      <p>
        <span className="font-medium">📍 Latitude:</span> {position.latitude.toFixed(6)}°
      </p>
      <p>
        <span className="font-medium">📍 Longitude:</span> {position.longitude.toFixed(6)}°
      </p>
      {position.altitude !== undefined && (
        <p>
          <span className="font-medium">⛰️ Altitude:</span> {position.altitude.toFixed(1)}m
        </p>
      )}
      {position.accuracy && (
        <p className="text-xs">
          <span className="font-medium">Accuracy:</span> ±{position.accuracy.toFixed(0)}m
        </p>
      )}
    </div>
  )
}
