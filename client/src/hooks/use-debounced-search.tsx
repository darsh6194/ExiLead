import { useState, useEffect } from 'react'

export function useDebouncedSearch(value: string, delay: number = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    // If value is empty, update immediately (for clearing)
    if (value === "") {
      setDebouncedValue("")
      return
    }
    
    // Otherwise, use debounced behavior
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
