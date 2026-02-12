import React from 'react';
import { render, screen } from '@testing-library/react';
import { WeatherDisplay } from '../WeatherDisplay';

describe('WeatherDisplay', () => {
  describe('Basic rendering', () => {
    it('renders weather information correctly', () => {
      render(<WeatherDisplay weatherId={0} source="api" />);

      expect(screen.getByText('計算された天気')).toBeInTheDocument();
      expect(screen.getByText('快晴 (ID: 0)')).toBeInTheDocument();
      expect(screen.getByText('Clear sky')).toBeInTheDocument();
      expect(screen.getByText('リアルタイム')).toBeInTheDocument();
    });

    it('renders different weather types correctly', () => {
      const { rerender } = render(<WeatherDisplay weatherId={2} source="cache" />);

      expect(screen.getByText('曇り (ID: 2)')).toBeInTheDocument();
      expect(screen.getByText('Cloudy')).toBeInTheDocument();
      expect(screen.getByText('キャッシュ')).toBeInTheDocument();

      rerender(<WeatherDisplay weatherId={11} source="seasonal_default" />);

      expect(screen.getByText('雪 (ID: 11)')).toBeInTheDocument();
      expect(screen.getByText('Snow')).toBeInTheDocument();
      expect(screen.getByText('デフォルト')).toBeInTheDocument();
    });

    it('displays weather icons correctly', () => {
      render(<WeatherDisplay weatherId={0} source="api" />);

      expect(screen.getByRole('img', { name: '天気アイコン: 快晴' })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'データソース: リアルタイム' })).toBeInTheDocument();
    });
  });

  describe('Data source indicators', () => {
    it('displays API source with correct styling and aria label', () => {
      render(<WeatherDisplay weatherId={1} source="api" />);

      const sourceElement = screen.getByLabelText('リアルタイム天気データから取得');
      expect(sourceElement).toBeInTheDocument();
      expect(sourceElement).toHaveClass('text-green-600');
      expect(screen.getByText('リアルタイム')).toBeInTheDocument();
    });

    it('displays cache source with correct styling and aria label', () => {
      render(<WeatherDisplay weatherId={1} source="cache" />);

      const sourceElement = screen.getByLabelText('キャッシュされた天気データから取得');
      expect(sourceElement).toBeInTheDocument();
      expect(sourceElement).toHaveClass('text-blue-600');
      expect(screen.getByText('キャッシュ')).toBeInTheDocument();
    });

    it('displays seasonal default source with correct styling and aria label', () => {
      render(<WeatherDisplay weatherId={1} source="seasonal_default" />);

      const sourceElement = screen.getByLabelText('季節に基づくデフォルト天気データを使用');
      expect(sourceElement).toBeInTheDocument();
      expect(sourceElement).toHaveClass('text-orange-600');
      expect(screen.getByText('デフォルト')).toBeInTheDocument();
    });
  });

  describe('Accessibility features', () => {
    it('has proper ARIA structure', () => {
      render(<WeatherDisplay weatherId={5} source="api" />);

      expect(screen.getByRole('region')).toBeInTheDocument();
      expect(screen.getByLabelText(/リアルタイム天気データから取得/)).toBeInTheDocument();
      expect(screen.getByRole('note')).toBeInTheDocument();
    });

    it('has proper heading and description relationships', () => {
      render(<WeatherDisplay weatherId={3} source="cache" />);

      const region = screen.getByRole('region');
      expect(region).toHaveAttribute('aria-labelledby', 'weather-title');
      expect(region).toHaveAttribute('aria-describedby', 'weather-description weather-note');

      expect(screen.getByRole('heading', { level: 3, name: '計算された天気' })).toHaveAttribute('id', 'weather-title');
      expect(screen.getByText('霧 (ID: 3)')).toHaveAttribute('id', 'weather-description');
    });

    it('provides screen reader context for weather information', () => {
      render(<WeatherDisplay weatherId={8} source="api" />);

      expect(screen.getByText('現在の天気:')).toHaveClass('sr-only');
      expect(screen.getByRole('img', { name: '天気アイコン: 豪雨' })).toBeInTheDocument();
    });

    it('has proper language attributes for English descriptions', () => {
      render(<WeatherDisplay weatherId={7} source="api" />);

      const englishDescription = screen.getByText('Heavy rain');
      expect(englishDescription).toHaveAttribute('lang', 'en');
    });

    it('provides appropriate aria-label for explanatory note', () => {
      render(<WeatherDisplay weatherId={1} source="api" />);

      const noteElement = screen.getByRole('note');
      expect(noteElement).toHaveAttribute('aria-label', '天気データの使用についての説明');
      expect(noteElement).toHaveTextContent('この天気データは座標情報からNFTに自動的に含まれます');
    });
  });

  describe('Edge cases and error handling', () => {
    it('returns null for invalid weather ID', () => {
      const { container } = render(<WeatherDisplay weatherId={999 as never} source="api" />);
      expect(container.firstChild).toBeNull();
    });

    it('returns null for invalid source', () => {
      const { container } = render(<WeatherDisplay weatherId={1} source={"invalid" as never} />);
      expect(container.firstChild).toBeNull();
    });

    it('handles boundary weather IDs correctly', () => {
      const { rerender } = render(<WeatherDisplay weatherId={0} source="api" />);
      expect(screen.getByText('快晴 (ID: 0)')).toBeInTheDocument();

      rerender(<WeatherDisplay weatherId={13} source="api" />);
      expect(screen.getByText('雨 (ID: 13)')).toBeInTheDocument();
    });
  });

  describe('Dark mode support', () => {
    it('has appropriate dark mode classes', () => {
      render(<WeatherDisplay weatherId={2} source="cache" />);

      const container = screen.getByRole('region');
      expect(container).toHaveClass(
        'bg-blue-50', 
        'dark:bg-blue-900/20', 
        'border-blue-200', 
        'dark:border-blue-800'
      );
    });

    it('applies dark mode text colors correctly', () => {
      render(<WeatherDisplay weatherId={4} source="api" />);

      const title = screen.getByRole('heading');
      expect(title).toHaveClass('text-gray-700', 'dark:text-gray-300');

      const weatherName = screen.getByText('にわか雨 (ID: 4)');
      expect(weatherName).toHaveClass('text-gray-900', 'dark:text-gray-100');

      const description = screen.getByText('Light showers');
      expect(description).toHaveClass('text-gray-600', 'dark:text-gray-400');
    });
  });

  describe('Weather type coverage', () => {
    const weatherTypes = [
      { id: 0, name: '快晴', description: 'Clear sky' },
      { id: 1, name: '晴れ', description: 'Mostly clear' },
      { id: 2, name: '曇り', description: 'Cloudy' },
      { id: 3, name: '霧', description: 'Foggy' },
      { id: 4, name: 'にわか雨', description: 'Light showers' },
      { id: 5, name: '小雨', description: 'Light rain' },
      { id: 6, name: '雨', description: 'Rain' },
      { id: 7, name: '激しい雨', description: 'Heavy rain' },
      { id: 8, name: '豪雨', description: 'Extreme rain' },
      { id: 9, name: '弱い雷雨', description: 'Light thunderstorm' },
      { id: 10, name: '雷雨', description: 'Thunderstorm' },
      { id: 11, name: '雪', description: 'Snow' },
      { id: 12, name: '霞・煙', description: 'Haze/Smoke' },
      { id: 13, name: '雨', description: 'Rainy' },
    ];

    weatherTypes.forEach(({ id, name, description }) => {
      it(`renders weather type ${id} (${name}) correctly`, () => {
        render(<WeatherDisplay weatherId={id} source="api" />);

        expect(screen.getByText(`${name} (ID: ${id})`)).toBeInTheDocument();
        expect(screen.getByText(description)).toBeInTheDocument();
        expect(screen.getByRole('img', { name: `天気アイコン: ${name}` })).toBeInTheDocument();
      });
    });
  });

  describe('Source type coverage', () => {
    const sources: Array<'api' | 'cache' | 'seasonal_default'> = ['api', 'cache', 'seasonal_default'];

    sources.forEach((source) => {
      it(`renders ${source} source correctly`, () => {
        render(<WeatherDisplay weatherId={1} source={source} />);

        // Check that the appropriate source label is displayed
        const sourceLabels = {
          api: 'リアルタイム',
          cache: 'キャッシュ',
          seasonal_default: 'デフォルト'
        };

        expect(screen.getByText(sourceLabels[source])).toBeInTheDocument();
      });
    });
  });
});