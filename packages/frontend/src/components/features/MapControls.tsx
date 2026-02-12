'use client'

import React from 'react'

interface MapControlsProps {
  nftMapLoading: boolean
  nftMapError: string | null
  isNight?: boolean
}

export default function MapControls({
  nftMapLoading,
  nftMapError,
  isNight
}: MapControlsProps) {
  if (!nftMapLoading && !nftMapError) return null

  const spinnerColor = isNight ? '#fff' : '#0C0A09'

  return (
    <>
      {/* Centered loading spinner */}
      {nftMapLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            className="animate-spin"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke={spinnerColor}
              strokeOpacity={0.2}
              strokeWidth="3"
            />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              stroke={spinnerColor}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}

      {/* Error indicator */}
      {nftMapError && (
        <div className="absolute top-2 left-2 z-50 bg-red-100 border border-red-300 rounded px-2 py-1 text-xs font-medium text-red-600 shadow-sm">
          NFT読み込みエラー: {nftMapError}
        </div>
      )}
    </>
  )
}
