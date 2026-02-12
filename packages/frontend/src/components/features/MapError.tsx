'use client'

import React from 'react'

interface MapErrorProps {
  error: string
}

export default function MapError({ error }: MapErrorProps) {
  return (
    <div className="w-full h-64 md:h-96 lg:h-[28rem] border border-red-200 rounded-lg overflow-hidden bg-red-50 flex items-center justify-center">
      <div className="text-center p-4">
        <p className="text-red-600 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          ページを再読み込み
        </button>
      </div>
    </div>
  )
}