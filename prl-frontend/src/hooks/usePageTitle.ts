import { useEffect } from 'react';

export function usePageTitle(title: string) {
  useEffect(() => {
    const fullTitle = title
      ? `America's Political Pulse: ${title}`
      : "America's Political Pulse";
    document.title = fullTitle;

    // Reset to default on unmount
    return () => {
      document.title = "America's Political Pulse";
    };
  }, [title]);
}
