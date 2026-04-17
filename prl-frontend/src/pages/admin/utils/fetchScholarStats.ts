// Fetch Google Scholar stats via CORS proxy

const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
];

export interface ScholarStats {
  citations: number;
  hIndex: number;
}

function parseScholarPage(html: string): ScholarStats {
  // Create a DOM parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Find citation stats - they're in a table with class gsc_rsb_std
  const citationElements = doc.querySelectorAll('.gsc_rsb_std');

  if (citationElements.length < 3) {
    throw new Error('Could not find citation elements on page');
  }

  const citations = parseInt(citationElements[0].textContent || '0', 10);
  const hIndex = parseInt(citationElements[2].textContent || '0', 10);

  if (isNaN(citations) || isNaN(hIndex)) {
    throw new Error('Failed to parse citation numbers');
  }

  return { citations, hIndex };
}

export async function fetchScholarStats(scholarUrl: string): Promise<ScholarStats> {
  let lastError: Error | null = null;

  for (const proxy of CORS_PROXIES) {
    try {
      const proxyUrl = proxy + encodeURIComponent(scholarUrl);

      const response = await fetch(proxyUrl, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Check if we got blocked or rate limited
      if (html.includes('unusual traffic') || html.includes('captcha')) {
        throw new Error('Google Scholar is showing a CAPTCHA - try again later');
      }

      return parseScholarPage(html);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Proxy ${proxy} failed:`, lastError.message);
      continue;
    }
  }

  throw lastError || new Error('All CORS proxies failed');
}
