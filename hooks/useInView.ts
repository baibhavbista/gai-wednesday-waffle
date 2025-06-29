import { useState, useCallback } from 'react';

export const useInView = (threshold: number = 0) => {
  const [isInView, setIsInView] = useState(false);

  const onLayout = useCallback(() => {
    // For now, just set to true when layout happens
    // This is a simple lazy loading - component becomes "visible" once it's laid out
    setIsInView(true);
  }, []);

  return { isInView, onLayout };
}; 