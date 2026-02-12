'use client'

import React from 'react'
import { useCurrentTime, formatFullDateTime } from './hooks'
import { useWeatherData } from '@/hooks/useWeather'
import { WeatherIcon } from '@/components/ui/WeatherIcon'
import type { WeatherCondition } from '@/lib/weatherTokens'
import { cn } from '@/lib/cn'

interface DateTimeStripProps {
  className?: string
}

export const DateTimeStrip: React.FC<DateTimeStripProps> = React.memo(({ className }) => {
  const currentTime = useCurrentTime()
  const { colorIndex, hasWeatherData } = useWeatherData()

  return (
    <div
      className={cn(
        'pointer-events-none bg-white py-2 text-stone-600 flex flex-col items-center gap-2',
        className
      )}
    >
      {hasWeatherData && colorIndex !== null && colorIndex >= 0 && colorIndex <= 12 && (
        <WeatherIcon weatherId={colorIndex as WeatherCondition} />
      )}
      <span
        className="writing-vertical font-datetime text-xs tracking-[0.005em]"
        suppressHydrationWarning
      >
        {formatFullDateTime(currentTime)}
      </span>
    </div>
  )
})

DateTimeStrip.displayName = 'DateTimeStrip'
