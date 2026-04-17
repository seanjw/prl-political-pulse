import { useState, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import { usePageTitle } from '../hooks/usePageTitle';
import type { MediaMention, ResearcherTag } from '../types/admin';
import { RESEARCHER_TAGS } from '../types/admin';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getYear(dateStr: string): string {
  return dateStr.split('-')[0];
}

export function AboutNews() {
  usePageTitle('In the News');
  const { isDarkMode } = useTheme();
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<ResearcherTag | 'all'>('all');
  const [mediaMentions, setMediaMentions] = useState<MediaMention[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMentions() {
      try {
        const res = await fetch('/data/mediaMentions.json');
        const data: MediaMention[] = await res.json();
        setMediaMentions(data);
      } catch (error) {
        console.error('Error loading media mentions:', error);
      } finally {
        setLoading(false);
      }
    }
    loadMentions();
  }, []);

  // Get unique years
  const years = [...new Set(mediaMentions.map((m) => getYear(m.date)))].sort((a, b) => b.localeCompare(a));

  // Filter by year and tag
  const filteredMentions = mediaMentions.filter((m) => {
    const yearMatch = selectedYear === 'all' || getYear(m.date) === selectedYear;
    const tagMatch = selectedTag === 'all' || (m.tags && m.tags.includes(selectedTag));
    return yearMatch && tagMatch;
  });

  // Group by year for display
  const groupedByYear = filteredMentions.reduce(
    (acc, mention) => {
      const year = getYear(mention.date);
      if (!acc[year]) acc[year] = [];
      acc[year].push(mention);
      return acc;
    },
    {} as Record<string, MediaMention[]>
  );

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-12">
        <div className="animate-pulse">
          <div className="h-8 w-48 rounded mb-4" style={{ background: 'var(--bg-secondary)' }} />
          <div className="h-4 w-96 rounded mb-8" style={{ background: 'var(--bg-secondary)' }} />
          <div className="flex gap-2 mb-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 w-20 rounded-lg" style={{ background: 'var(--bg-secondary)' }} />
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 rounded-lg" style={{ background: 'var(--bg-secondary)' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-12">
      <div className="mb-8">
        <h1 className="font-bold mb-2" style={{ color: 'var(--text-primary)', fontSize: '1.5rem' }}>
          In the News
        </h1>
        <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
          Media coverage of the Polarization Research Lab and our research.
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
          {mediaMentions.length} articles from {years[years.length - 1]} to {years[0]}
        </p>
      </div>

      {/* Year filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setSelectedYear('all')}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: selectedYear === 'all' ? 'var(--accent)' : isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
            color: selectedYear === 'all' ? '#fff' : 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}
        >
          All Years
        </button>
        {years.map((year) => (
          <button
            key={year}
            onClick={() => setSelectedYear(year)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: selectedYear === year ? 'var(--accent)' : isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
              color: selectedYear === year ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            {year}
          </button>
        ))}
      </div>

      {/* Researcher filter */}
      <div className="flex gap-2 mb-8 flex-wrap items-center">
        <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>About:</span>
        <button
          onClick={() => setSelectedTag('all')}
          className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
          style={{
            background: selectedTag === 'all' ? 'var(--accent)' : isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
            color: selectedTag === 'all' ? '#fff' : 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}
        >
          All
        </button>
        {RESEARCHER_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => setSelectedTag(tag)}
            className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
            style={{
              background: selectedTag === tag ? 'var(--accent)' : isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
              color: selectedTag === tag ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Media mentions grouped by year */}
      {Object.entries(groupedByYear)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([year, mentions]) => (
          <div key={year} className="mb-10">
            <h2
              className="font-bold mb-4 pb-2 border-b"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
            >
              {year}
              <span className="text-sm font-normal ml-2" style={{ color: 'var(--text-tertiary)' }}>
                ({mentions.length} articles)
              </span>
            </h2>
            <div className="space-y-3">
              {mentions.map((mention, idx) => (
                <a
                  key={mention.id || `${mention.publication}-${idx}`}
                  href={mention.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg p-4 transition-all hover:scale-[1.01]"
                  style={{
                    background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    textDecoration: 'none',
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <span
                        className="text-xs font-bold uppercase tracking-wider"
                        style={{ color: 'var(--accent)' }}
                      >
                        {mention.publication}
                      </span>
                      <h3
                        className="font-medium mt-1"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {mention.title}
                      </h3>
                      {mention.tags && mention.tags.length > 0 && (
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          {mention.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                background: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span
                      className="text-sm whitespace-nowrap"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {formatDate(mention.date)}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
