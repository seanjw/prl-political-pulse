import { Link, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useTheme } from '../hooks/useTheme';
import { usePageTitle } from '../hooks/usePageTitle';
import type { ProfileData, MediaMention, Publication, TeachingEvaluation } from '../types/admin';

// Helper function to bold Westwood in author strings
function formatAuthors(authors: string): ReactNode {
  const parts = authors.split(/(Westwood, S\.J\.|Westwood, S\.J)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.includes('Westwood') ? <strong key={i}>{part}</strong> : part
      )}
    </>
  );
}

type TabId = 'overview' | 'publications' | 'inprogress' | 'media' | 'grants' | 'talks' | 'service' | 'teaching';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'publications', label: 'Publications' },
  { id: 'inprogress', label: 'Under Review' },
  { id: 'media', label: 'Media' },
  { id: 'grants', label: 'Grants & Awards' },
  { id: 'talks', label: 'Talks' },
  { id: 'service', label: 'Service' },
  { id: 'teaching', label: 'Teaching Evaluations' },
];

export function ProfileWestwood() {
  usePageTitle('Sean J. Westwood');
  const { isDarkMode } = useTheme();
  const [data, setData] = useState<ProfileData | null>(null);
  const [mediaMentions, setMediaMentions] = useState<MediaMention[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();

  const validTabs = TABS.map(t => t.id);
  const tabParam = searchParams.get('tab') as TabId | null;
  const activeTab: TabId = tabParam && validTabs.includes(tabParam) ? tabParam : 'overview';
  const setActiveTab = useCallback((tab: TabId) => {
    if (tab === 'overview') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab }, { replace: true });
    }
  }, [setSearchParams]);

  useEffect(() => {
    fetch('/data/westwood-publications.json')
      .then(res => res.json())
      .then(setData)
      .catch(console.error);

    fetch('/data/mediaMentions.json')
      .then(res => res.json())
      .then(setMediaMentions)
      .catch(console.error);
  }, []);

  // Helper to group items by year and count
  const groupByYearWithCounts = <T extends { year: number | string | undefined }>(
    items: T[],
    nameKey: keyof T
  ): Map<number, Map<string, number>> => {
    const yearGroups = new Map<number, Map<string, number>>();
    items.forEach(item => {
      const year = typeof item.year === 'number' ? item.year : parseInt(String(item.year)) || 0;
      if (!yearGroups.has(year)) {
        yearGroups.set(year, new Map());
      }
      const name = String(item[nameKey]);
      const nameGroup = yearGroups.get(year)!;
      nameGroup.set(name, (nameGroup.get(name) || 0) + 1);
    });
    return yearGroups;
  };

  // Render function for publications with enumeration and student badge
  const renderPublicationWithNumber = (pub: Publication, number: number) => (
    <div
      key={number}
      className="px-3 py-2 rounded-lg [&>p]:m-0"
      style={{
        background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex-shrink-0 font-medium text-sm mt-0.5"
          style={{ color: 'var(--text-tertiary)', minWidth: '24px' }}
        >
          {number}.
        </span>
        <div className="flex-1">
          <p className="text-tight font-medium leading-snug">
            {renderTitle(pub.title, pub.url)}
            {pub.withStudent && (
              <span
                className="ml-2 px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  background: 'var(--accent)',
                  color: '#ffffff',
                }}
              >
                Written with a student
              </span>
            )}
          </p>
          <p className="text-tight text-sm leading-snug" style={{ color: 'var(--text-secondary)' }}>
            {formatAuthors(pub.authors)}
          </p>
          <p className="text-tight text-sm leading-snug" style={{ color: 'var(--text-tertiary)' }}>
            <em>{pub.journal}</em>
            {pub.volume && `, ${pub.volume}`}
            {pub.pages && `, ${pub.pages}`}
            {pub.year && ` (${pub.year})`}
          </p>
          {pub.mediaCoverage && (
            <p className="text-tight text-sm leading-snug mt-1" style={{ color: 'var(--text-tertiary)' }}>
              <strong>Covered in:</strong> {pub.mediaCoverage}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const renderTitle = (title: string, url?: string) => {
    if (url) {
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          {title}
        </a>
      );
    }
    return <span style={{ color: 'var(--text-primary)' }}>{title}</span>;
  };

  if (!data) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-12">
        <div className="animate-pulse">
          <div className="h-8 w-32 rounded mb-8" style={{ background: 'var(--bg-secondary)' }} />
          <div className="flex gap-8">
            <div className="w-64 h-64 rounded-xl" style={{ background: 'var(--bg-secondary)' }} />
            <div className="flex-1 space-y-4">
              <div className="h-10 w-64 rounded" style={{ background: 'var(--bg-secondary)' }} />
              <div className="h-6 w-48 rounded" style={{ background: 'var(--bg-secondary)' }} />
              <div className="h-6 w-32 rounded" style={{ background: 'var(--bg-secondary)' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { profile } = data;

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-12">
      {/* Back link */}
      <Link
        to="/about"
        className="inline-flex items-center gap-2 mb-8 text-sm hover:underline"
        style={{ color: 'var(--accent)' }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Team
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-8 mb-12">
        <div className="flex-shrink-0">
          <img
            src={profile.photo}
            alt={profile.name}
            className="w-48 h-48 md:w-64 md:h-64 rounded-xl object-cover"
          />
        </div>
        <div className="flex-1 flex flex-col justify-between" style={{ minHeight: '256px' }}>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {profile.name}
            </h1>
            <p className="text-lg mt-1" style={{ color: 'var(--text-secondary)' }}>
              {profile.title}, {profile.institution}
              <br />
              <span style={{ color: 'var(--accent)' }}>{profile.role}</span>
            </p>
          </div>

          <div>
            {/* Google Scholar Stats */}
            {(profile.googleCitations || profile.hIndex) && (
              <div className="flex gap-6 mb-4">
                {profile.googleCitations && (
                  <div>
                    <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      {profile.googleCitations.toLocaleString()}
                    </p>
                    <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                      Citations
                    </p>
                  </div>
                )}
                {profile.hIndex && (
                  <div>
                    <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      {profile.hIndex}
                    </p>
                    <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                      H-Index
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Contact links */}
            <div className="flex flex-wrap gap-3">
              <a
                href={`mailto:${profile.email}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
                style={{
                  background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email
              </a>
              <a
                href={profile.googleScholar}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
                style={{
                  background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 24a7 7 0 110-14 7 7 0 010 14zm0-24L0 9.5l4.838 3.94A8 8 0 0112 9a8 8 0 017.162 4.44L24 9.5 12 0z" />
                </svg>
                Google Scholar
              </a>
              <a
                href={profile.cvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
                style={{
                  background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CV
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8 border-b" style={{ borderColor: 'var(--border)' }}>
        <nav className="flex gap-1 overflow-x-auto pb-px -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id ? 'border-current' : 'border-transparent hover:border-gray-300'
              }`}
              style={{
                color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Bio */}
          <section className="mb-12">
            <h2
              className="font-bold mb-4 pb-2 border-b"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
            >
              Biography
            </h2>
        <div className="space-y-4" style={{ color: 'var(--text-secondary)' }}>
          {profile.bio.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </section>

      {/* Research Interests */}
      <section className="mb-12">
        <h2
          className="font-bold mb-4 pb-2 border-b"
          style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
        >
          Research Interests
        </h2>
        <div className="flex flex-wrap gap-2">
          {profile.researchInterests.map((interest) => (
            <span
              key={interest}
              className="px-3 py-1 rounded-full text-sm"
              style={{
                background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              {interest}
            </span>
          ))}
          </div>
        </section>
        </>
      )}

      {/* Media Tab */}
      {activeTab === 'media' && mediaMentions.length > 0 && (
        <section className="mb-12">
          <h2
            className="font-bold mb-4 pb-2 border-b"
            style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
          >
            News Coverage
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {mediaMentions.slice(0, 12).map((mention) => (
              <a
                key={mention.id}
                href={mention.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-3 py-2 rounded-lg transition-colors hover:opacity-80"
                style={{
                  background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <p className="text-tight text-sm font-medium leading-snug line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                  {mention.title}
                </p>
                <p className="text-tight text-xs leading-snug mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  {mention.publication} · {new Date(mention.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                </p>
              </a>
            ))}
          </div>
          {mediaMentions.length > 12 && (
            <Link
              to="/about/news"
              className="inline-flex items-center gap-2 mt-4 text-sm hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              View all {mediaMentions.length} news mentions
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </section>
      )}

      {/* Publications Tab */}
      {activeTab === 'publications' && (
        <>
          {/* Books */}
          {data.books && data.books.length > 0 && (
        <section className="mb-12">
          <h2
            className="font-bold mb-4 pb-2 border-b"
            style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
          >
            {data.books.length === 1 ? 'Book' : 'Books'}
          </h2>
          <div className="space-y-3">
            {data.books.map((book, index) => (
              <div
                key={index}
                className="px-3 py-2 rounded-lg [&>p]:m-0"
                style={{
                  background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <p className="text-tight leading-snug" style={{ color: 'var(--text-primary)' }}>
                  {book.url ? (
                    <a href={book.url} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--accent)' }}>
                      <strong>{book.title}</strong>
                    </a>
                  ) : (
                    <strong>{book.title}</strong>
                  )}
                </p>
                <p className="text-tight text-sm leading-snug" style={{ color: 'var(--text-secondary)' }}>
                  {book.authors} ({book.year})
                </p>
                <p className="text-tight text-sm leading-snug" style={{ color: 'var(--text-tertiary)' }}>
                  {book.publisher}
                </p>
                {book.reviewedIn && (
                  <p className="text-tight text-sm leading-snug mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    <strong>Reviewed in:</strong> {book.reviewedIn}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Publications */}
      {data?.publications && (
        <section className="mb-12">
          <h2
            className="font-bold mb-4 pb-2 border-b"
            style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
          >
            Peer Reviewed Publications
          </h2>
          <div className="space-y-3">
            {data.publications.map((pub, index) =>
              renderPublicationWithNumber(pub, data.publications.length - index)
            )}
          </div>
        </section>
      )}

      {/* Publications in Other Fields */}
      {data?.otherFieldPublications && data.otherFieldPublications.length > 0 && (
        <section className="mb-12">
          <h2
            className="font-bold mb-4 pb-2 border-b"
            style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
          >
            Peer Reviewed Publications in other Fields
          </h2>
          <div className="space-y-3">
            {data.otherFieldPublications.map((pub, index) =>
              renderPublicationWithNumber(pub, data.otherFieldPublications.length - index)
            )}
          </div>
        </section>
      )}

      {/* Datasets */}
      {data?.datasets && data.datasets.length > 0 && (
        <section className="mb-12">
          <h2
            className="font-bold mb-4 pb-2 border-b"
            style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
          >
            Datasets
          </h2>
          <div className="space-y-3">
            {data.datasets.map((item, index) => (
              <div
                key={index}
                className="px-3 py-2 rounded-lg [&>p]:m-0"
                style={{
                  background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <p className="text-tight font-medium leading-snug">
                  {renderTitle(item.title, item.url)}
                </p>
                <p className="text-tight text-sm leading-snug" style={{ color: 'var(--text-secondary)' }}>
                  {formatAuthors(item.authors)}
                </p>
                <p className="text-tight text-sm leading-snug" style={{ color: 'var(--text-tertiary)' }}>
                  ({item.year})
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Technical Reports */}
      {data?.technicalReports && data.technicalReports.length > 0 && (
        <section className="mb-12">
          <h2
            className="font-bold mb-4 pb-2 border-b"
            style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
          >
            Technical Reports
          </h2>
          <div className="space-y-3">
            {data.technicalReports.map((report, index) => (
              <div
                key={index}
                className="px-3 py-2 rounded-lg [&>p]:m-0"
                style={{
                  background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <p className="text-tight font-medium leading-snug">
                  {renderTitle(report.title, report.url)}
                </p>
                <p className="text-tight text-sm leading-snug" style={{ color: 'var(--text-secondary)' }}>
                  {formatAuthors(report.authors)}
                </p>
                <p className="text-tight text-sm leading-snug" style={{ color: 'var(--text-tertiary)' }}>
                  ({report.year})
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Book Chapters */}
      {data?.chapters && data.chapters.length > 0 && (
        <section className="mb-12">
          <h2
            className="font-bold mb-4 pb-2 border-b"
            style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
          >
            {data.chapters.length === 1 ? 'Chapter' : 'Chapters'}
          </h2>
          <div className="space-y-3">
            {data.chapters.map((chapter, index) => (
              <div
                key={index}
                className="px-3 py-2 rounded-lg [&>p]:m-0"
                style={{
                  background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <p className="text-tight font-medium leading-snug">
                  {renderTitle(chapter.title, chapter.url)}
                </p>
                <p className="text-tight text-sm leading-snug" style={{ color: 'var(--text-secondary)' }}>
                  {formatAuthors(chapter.authors)}
                </p>
                <p className="text-tight text-sm leading-snug" style={{ color: 'var(--text-tertiary)' }}>
                  in <em>{chapter.book}</em>{chapter.editors && `, edited by ${chapter.editors}`}, {chapter.publisher} ({chapter.year})
                </p>
              </div>
            ))}
          </div>
          </section>
          )}
        </>
      )}

      {/* Under Review / In Progress Tab */}
      {activeTab === 'inprogress' && (
        <>
          {/* Under Review */}
          {data?.underReview && data.underReview.length > 0 && (
            <section className="mb-12">
              <h2
                className="font-bold mb-4 pb-2 border-b"
                style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
              >
                Under Review
              </h2>
              <div className="space-y-3">
                {data.underReview.map((pub, index) => (
                  <div
                    key={index}
                    className="px-3 py-2 rounded-lg [&>p]:m-0"
                    style={{
                      background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-tight font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                        {pub.title}
                      </p>
                      {pub.status === 'R&R' && (
                        <span
                          className="flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            background: 'var(--accent)',
                            color: '#ffffff',
                          }}
                        >
                          R&R
                        </span>
                      )}
                    </div>
                    <p className="text-tight text-sm leading-snug" style={{ color: 'var(--text-secondary)' }}>
                      {formatAuthors(pub.authors)}
                    </p>
                    {pub.journal && (
                      <p className="text-tight text-sm leading-snug" style={{ color: 'var(--text-tertiary)' }}>
                        <em>{pub.journal}</em>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Works in Progress */}
          {data?.worksInProgress && data.worksInProgress.length > 0 && (
            <section className="mb-12">
              <h2
                className="font-bold mb-4 pb-2 border-b"
                style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
              >
                Works in Progress
              </h2>
              <div className="space-y-3">
                {data.worksInProgress.map((pub, index) => (
                  <div
                    key={index}
                    className="px-3 py-2 rounded-lg [&>p]:m-0"
                    style={{
                      background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <p className="text-tight font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                      {pub.title}
                    </p>
                    <p className="text-tight text-sm leading-snug" style={{ color: 'var(--text-secondary)' }}>
                      {formatAuthors(pub.authors)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Grants & Awards Tab */}
      {activeTab === 'grants' && (
        <>
          {/* Awards */}
          {data?.awards && data.awards.length > 0 && (
        <section className="mb-12">
          <h2
            className="font-bold mb-4 pb-2 border-b"
            style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
          >
            Awards & Honors
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.awards.map((award) => (
              <div
                key={award.name}
                className="px-3 py-2 rounded-lg [&>p]:m-0"
                style={{
                  background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <p className="text-tight font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                  {award.name}
                </p>
                <p className="text-tight text-sm leading-snug" style={{ color: 'var(--text-tertiary)' }}>
                  {award.year} &middot; {award.institution}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Grants */}
      {data?.grants && data.grants.length > 0 && (
        <section className="mb-12">
          <h2
            className="font-bold mb-4 pb-2 border-b"
            style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
          >
            Grants
          </h2>
          <div className="space-y-3">
            {data.grants.map((grant, index) => (
              <div
                key={index}
                className="px-3 py-2 rounded-lg [&>p]:m-0"
                style={{
                  background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <p className="text-tight font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                  {grant.title}
                </p>
                <p className="text-tight text-sm leading-snug" style={{ color: 'var(--text-secondary)' }}>
                  {grant.funder}
                </p>
                <p className="text-tight text-sm leading-snug" style={{ color: 'var(--text-tertiary)' }}>
                  {grant.role}{grant.amount && ` · ${grant.amount}`}{grant.year && ` · ${grant.year}`}
                </p>
              </div>
            ))}
          </div>
          </section>
          )}
        </>
      )}

      {/* Service Tab */}
      {activeTab === 'service' && data?.service && data.service.length > 0 && (
        <section className="mb-12">
          <h2
            className="font-bold mb-4 pb-2 border-b"
            style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
          >
            Service
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.service.map((item, index) => (
              <div
                key={index}
                className="px-3 py-2 rounded-lg [&>p]:m-0"
                style={{
                  background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <p className="text-tight font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                  {item.role}
                </p>
                {item.year && (
                  <p className="text-tight text-sm leading-snug" style={{ color: 'var(--text-tertiary)' }}>
                    {item.year}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Talks Tab */}
      {activeTab === 'talks' && (
        <>
          {/* Invited Talks */}
          {data?.invitedTalks && data.invitedTalks.length > 0 && (() => {
        // Group talks by year, keeping duplicates
        const talksByYear = new Map<number, string[]>();
        data.invitedTalks.forEach(talk => {
          const year = typeof talk.year === 'number' ? talk.year : parseInt(String(talk.year)) || 0;
          if (!talksByYear.has(year)) {
            talksByYear.set(year, []);
          }
          talksByYear.get(year)!.push(talk.institution);
        });
        const sortedYears = Array.from(talksByYear.keys()).sort((a, b) => b - a);
        return (
          <section className="mb-12">
            <h2
              className="font-bold mb-4 pb-2 border-b"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
            >
              Invited Talks
            </h2>
            <div className="space-y-4">
              {sortedYears.map(year => {
                const institutions = talksByYear.get(year)!;
                return (
                  <div key={year}>
                    <p
                      className="font-medium mb-1"
                      style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}
                    >
                      {year || 'Other'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {institutions.map((institution, index) => (
                        <span
                          key={`${institution}-${index}`}
                          className="px-3 py-1 rounded-full text-sm"
                          style={{
                            background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {institution}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* Conference Presentations */}
      {data?.conferencePresentations && data.conferencePresentations.length > 0 && (() => {
        const presentationsByYear = groupByYearWithCounts(data.conferencePresentations, 'conference');
        const sortedYears = Array.from(presentationsByYear.keys()).sort((a, b) => b - a);
        return (
          <section className="mb-12">
            <h2
              className="font-bold mb-4 pb-2 border-b"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
            >
              Conference Presentations
            </h2>
            <div className="space-y-4">
              {sortedYears.map(year => {
                const conferences = presentationsByYear.get(year)!;
                return (
                  <div key={year}>
                    <p
                      className="font-medium mb-1"
                      style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}
                    >
                      {year}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(conferences.entries()).map(([conference, count]) => (
                        <span
                          key={conference}
                          className="px-3 py-1 rounded-full text-sm"
                          style={{
                            background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {conference}{count > 1 ? ` (${count})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}
        </>
      )}

      {/* Teaching Tab */}
      {activeTab === 'teaching' && (() => {
        const evals = data.teachingEvaluations || [];
        if (evals.length === 0) {
          return (
            <section className="mb-12">
              <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
                No teaching evaluations available yet.
              </p>
            </section>
          );
        }
        const byYear = new Map<number, TeachingEvaluation[]>();
        evals.forEach(ev => {
          if (!byYear.has(ev.year)) byYear.set(ev.year, []);
          byYear.get(ev.year)!.push(ev);
        });
        const sortedYears = Array.from(byYear.keys()).sort((a, b) => b - a);
        return (
          <section className="mb-12">
            <h2
              className="font-bold mb-4 pb-2 border-b"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
            >
              Teaching Evaluations
            </h2>
            <div className="space-y-6">
              {sortedYears.map(year => (
                <div key={year}>
                  <p
                    className="font-medium mb-2"
                    style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}
                  >
                    {year}
                  </p>
                  <div className="space-y-3">
                    {byYear.get(year)!.map((ev, i) => (
                      <div
                        key={i}
                        className="rounded-lg overflow-hidden"
                        style={{
                          background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between px-3 py-2">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {ev.course}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              {ev.term} {ev.year}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {ev.courseQualityMean != null && (
                              <div className="text-center">
                                <p className="text-base font-bold" style={{ color: 'var(--accent)' }}>{ev.courseQualityMean.toFixed(2)}</p>
                                <p className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Course</p>
                              </div>
                            )}
                            {ev.teachingEffectivenessMean != null && (
                              <div className="text-center">
                                <p className="text-base font-bold" style={{ color: 'var(--accent)' }}>{ev.teachingEffectivenessMean.toFixed(2)}</p>
                                <p className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Teaching</p>
                              </div>
                            )}
                            <a
                              href={ev.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors hover:opacity-80"
                              style={{
                                color: 'var(--accent)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              PDF
                            </a>
                          </div>
                        </div>
                        {(ev.courseQualityMean != null || ev.teachingEffectivenessMean != null) && (
                          <p className="px-3 pb-1 text-[10px] italic text-right" style={{ color: 'var(--text-muted)' }}>
                            Scale: 1 = Excellent, 5 = Poor
                          </p>
                        )}
                        {/* Comments */}
                        {ev.positiveComments && ev.positiveComments.length > 0 && (
                          <div
                            className="px-3 py-2"
                            style={{ borderTop: '1px solid var(--border)' }}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                              Student Feedback
                            </p>
                            <div className="space-y-1.5">
                              {ev.positiveComments.map((comment, ci) => (
                                <p
                                  key={ci}
                                  className="text-[13px] leading-snug pl-2.5"
                                  style={{
                                    color: 'var(--text-secondary)',
                                    borderLeft: '2px solid var(--accent)',
                                  }}
                                >
                                  {comment}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })()}
    </div>
  );
}
