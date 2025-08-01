import { useCallback } from 'react';

/**
 * Custom hook for auto-selecting text when input fields are focused
 * This provides a better UX by selecting all text when user clicks on a field
 */
export const useAutoSelect = () => {
  const handleFocus = useCallback((event) => {
    // Select all text when field is focused
    event.target.select();
  }, []);

  return { onFocus: handleFocus };
}; 