interface WeatherDisplayProps {
  weatherId: number;
  source: 'api' | 'cache' | 'seasonal_default';
}

const WEATHER_DESCRIPTIONS = {
  0: { name: '快晴', icon: '☀️', description: 'Clear sky' },
  1: { name: '晴れ', icon: '🌤️', description: 'Mostly clear' },
  2: { name: '曇り', icon: '☁️', description: 'Cloudy' },
  3: { name: '霧', icon: '🌫️', description: 'Foggy' },
  4: { name: 'にわか雨', icon: '🌦️', description: 'Light showers' },
  5: { name: '小雨', icon: '🌧️', description: 'Light rain' },
  6: { name: '雨', icon: '🌧️', description: 'Rain' },
  7: { name: '激しい雨', icon: '⛈️', description: 'Heavy rain' },
  8: { name: '豪雨', icon: '⛈️', description: 'Extreme rain' },
  9: { name: '弱い雷雨', icon: '🌩️', description: 'Light thunderstorm' },
  10: { name: '雷雨', icon: '⛈️', description: 'Thunderstorm' },
  11: { name: '雪', icon: '🌨️', description: 'Snow' },
  12: { name: '霞・煙', icon: '🌫️', description: 'Haze/Smoke' },
  13: { name: '雨', icon: '🌧️', description: 'Rainy' },
} as const;

const SOURCE_LABELS = {
  api: { 
    label: 'リアルタイム', 
    color: 'text-green-600', 
    icon: '🌐',
    ariaLabel: 'リアルタイム天気データから取得',
    description: '最新の天気情報'
  },
  cache: { 
    label: 'キャッシュ', 
    color: 'text-blue-600', 
    icon: '💾',
    ariaLabel: 'キャッシュされた天気データから取得',
    description: '最近取得した天気情報'
  },
  seasonal_default: { 
    label: 'デフォルト', 
    color: 'text-orange-600', 
    icon: '📅',
    ariaLabel: '季節に基づくデフォルト天気データを使用',
    description: '季節の平均的な天気情報'
  }
} as const;

export function WeatherDisplay({ weatherId, source }: WeatherDisplayProps) {
  const weather = WEATHER_DESCRIPTIONS[weatherId as keyof typeof WEATHER_DESCRIPTIONS];
  const sourceInfo = SOURCE_LABELS[source];

  if (!weather || !sourceInfo) {
    return null;
  }

  return (
    <section 
      className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800"
      role="region"
      aria-labelledby="weather-title"
      aria-describedby="weather-description weather-note"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 
          id="weather-title"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          計算された天気
        </h3>
        <div 
          className={`flex items-center gap-1 text-xs ${sourceInfo.color}`}
          aria-label={sourceInfo.ariaLabel}
          title={sourceInfo.description}
        >
          <span 
            role="img" 
            aria-label={`データソース: ${sourceInfo.label}`}
          >
            {sourceInfo.icon}
          </span>
          <span className="font-medium">{sourceInfo.label}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div 
          className="text-2xl" 
          role="img" 
          aria-label={`天気アイコン: ${weather.name}`}
        >
          {weather.icon}
        </div>
        <div>
          <div 
            id="weather-description"
            className="font-medium text-gray-900 dark:text-gray-100"
          >
            <span className="sr-only">現在の天気: </span>
            {weather.name} (ID: {weatherId})
          </div>
          <div 
            className="text-xs text-gray-600 dark:text-gray-400"
            lang="en"
          >
            {weather.description}
          </div>
        </div>
      </div>
      
      <div 
        id="weather-note"
        className="mt-2 text-xs text-gray-500 dark:text-gray-400"
        role="note"
        aria-label="天気データの使用についての説明"
      >
        この天気データは座標情報からNFTに自動的に含まれます
      </div>
    </section>
  );
}