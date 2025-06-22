import { useState, useEffect } from 'react';

export const useTimeOfDay = () => {
  const [isDay, setIsDay] = useState<boolean>(true);
  
  useEffect(() => {
    const checkTimeOfDay = () => {
      const hours = new Date().getHours();
      setIsDay(hours >= 6 && hours < 19); // Day is between 6 AM and 7 PM
    };
    
    // Initial check
    checkTimeOfDay();
    
    // Set up interval to check every minute
    const interval = setInterval(checkTimeOfDay, 60000);
    
    return () => clearInterval(interval);
  }, []);
  
  return { isDay };
};