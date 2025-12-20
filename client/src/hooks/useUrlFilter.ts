import { useState, useEffect, useRef } from 'react';

interface UseUrlFilterOptions {
  baseUrl: string;
  paramName?: string;
  initialValue?: string;
}

export function useUrlFilter({ baseUrl, paramName = 'filter', initialValue = '' }: UseUrlFilterOptions) {
  // Store current URL to prevent unnecessary updates
  const currentUrlRef = useRef<string>('');
  
  const [value, setValue] = useState<string>(() => {
    // Get initial value from URL on first render only
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search.split('?')[1] || '');
      const urlValue = urlParams.get(paramName);
      const finalValue = urlValue !== null ? urlValue : (initialValue || '');
      currentUrlRef.current = window.location.pathname + window.location.search;
      console.log(`[useUrlFilter] Initialized ${paramName} with value:`, finalValue);
      return finalValue;
    }
    return initialValue || '';
  });

  // Update URL when value changes
  useEffect(() => {
    const newParams = new URLSearchParams(window.location.search.split('?')[1] || '');
    
    // Only add parameter if value exists and is not the initial/default value
    if (value && value !== initialValue) {
      newParams.set(paramName, value);
    } else {
      newParams.delete(paramName);
    }
    
    const newUrl = `${baseUrl}${newParams.toString() ? `?${newParams.toString()}` : ''}`;
    
    // Only update if URL actually changed
    if (newUrl !== currentUrlRef.current) {
      console.log(`[useUrlFilter] Updating URL from ${currentUrlRef.current} to ${newUrl}`);
      currentUrlRef.current = newUrl;
      window.history.replaceState({}, '', newUrl);
    } else {
      console.log(`[useUrlFilter] URL unchanged, skipping update: ${newUrl}`);
    }
  }, [value, baseUrl, paramName, initialValue]);

  // Log hook usage for debugging
  console.log(`[useUrlFilter] Hook active for ${paramName}, current value: ${value}`);

  return {
    value,
    setValue,
    clearValue: () => setValue('')
  };
}
