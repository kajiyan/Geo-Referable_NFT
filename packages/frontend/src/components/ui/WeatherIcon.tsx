import React from 'react';
import { cn } from '@/lib/cn';
import type { WeatherCondition } from '@/lib/weatherTokens';

interface WeatherIconProps {
  weatherId?: WeatherCondition;
  className?: string;
}

/**
 * Weather condition to Norosi icon font Unicode mapping
 * Icons are assigned to Unicode range U+E900 ~ U+E90C (13 icons)
 */
const WEATHER_ICON_MAP: Record<WeatherCondition, string> = {
  0: '\uE900',  // Clear (晴れ)
  1: '\uE901',  // Partly Cloudy (やや曇り)
  2: '\uE902',  // Cloudy (曇り)
  3: '\uE903',  // Overcast (どんより曇り)
  4: '\uE904',  // Light Drizzle (霧雨)
  5: '\uE905',  // Light Rain (小雨)
  6: '\uE906',  // Moderate Rain (雨)
  7: '\uE907',  // Rain (雨)
  8: '\uE908',  // Heavy Rain (大雨)
  9: '\uE909',  // Thunder (雷雨)
  10: '\uE90A', // Heavy Thunder (激しい雷雨)
  11: '\uE90B', // Snow (雪)
  12: '\uE90C', // Fog (霧)
} as const;

/**
 * Get accessible label for weather condition
 */
const getWeatherLabel = (weatherId: WeatherCondition): string => {
  const labels: Record<WeatherCondition, string> = {
    0: 'Clear',
    1: 'Partly Cloudy',
    2: 'Cloudy',
    3: 'Overcast',
    4: 'Light Drizzle',
    5: 'Light Rain',
    6: 'Moderate Rain',
    7: 'Rain',
    8: 'Heavy Rain',
    9: 'Thunder',
    10: 'Heavy Thunder',
    11: 'Snow',
    12: 'Fog',
  };
  return labels[weatherId];
};

/**
 * Weather icon component using Norosi icon font
 *
 * @example
 * ```tsx
 * <WeatherIcon weatherId={0} /> // Clear/Sunny
 * <WeatherIcon weatherId={7} className="text-blue-500" /> // Rain with custom color
 * ```
 */
export const WeatherIcon: React.FC<WeatherIconProps> = React.memo(({
  weatherId = 0,
  className
}) => {
  const icon = WEATHER_ICON_MAP[weatherId] || WEATHER_ICON_MAP[0];
  const label = getWeatherLabel(weatherId);

  return (
    <span
      className={cn('font-norosi text-[1.5rem] leading-none inline-block -translate-y-[0.075em]', className)}
      aria-label={label}
      role="img"
    >
      {icon}
    </span>
  );
});

WeatherIcon.displayName = 'WeatherIcon';
