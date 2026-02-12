import { useState, useEffect } from 'react';

/**
 * Custom hook for managing current time with automatic updates
 */
export const useCurrentTime = () => {
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return currentTime;
};

/**
 * Format date as "Thursday 19 June 2025 20:32:51"
 */
export const formatFullDateTime = (date: Date): string => {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return `${weekday} ${day} ${month} ${year} ${time}`;
};
