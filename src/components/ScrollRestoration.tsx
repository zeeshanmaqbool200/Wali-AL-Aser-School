import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const scrollPositions: { [key: string]: number } = {};

export function ScrollRestoration() {
  const { pathname, search } = useLocation();
  const key = `${pathname}${search}`;

  useEffect(() => {
    // Restore scroll position when entry is rendered
    if (scrollPositions[key] !== undefined) {
      window.scrollTo(0, scrollPositions[key]);
    } else {
      window.scrollTo(0, 0);
    }

    // Save scroll position on unmount
    return () => {
      scrollPositions[key] = window.scrollY;
    };
  }, [key]);

  return null;
}
