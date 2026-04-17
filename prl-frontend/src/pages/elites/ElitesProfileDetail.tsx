import { useParams, Link } from 'react-router-dom';
import { useEliteProfile, type CategoryBreakdown, type CategoryRanks, type RecentPost } from '../../hooks/useEliteProfile';
import { ELITE_CATEGORIES, PARTY_COLORS } from '../../config/elitesCategories';
import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { Tabs, TabPanel } from '../../components/Tabs';
import { USChoroplethChart } from '../../components/Charts/USChoroplethChart';
import { usePageTitle } from '../../hooks/usePageTitle';
import { CHAMBER_LABELS } from '../search/config';
import { getBioguideFromImageUrl, getCongressImageUrl, handleImageError } from './legislatorImage';

// ── Awards Pills ────────────────────────────────────────────────

interface Award {
  name: string;
  type: 'positive' | 'negative' | 'special';
  category: string;
  description: string;
}

let cachedAwards: Record<string, Award[]> | null = null;

function useAwards(sourceId: string | undefined) {
  const [awards, setAwards] = useState<Award[]>([]);

  useEffect(() => {
    if (!sourceId) return;
    let cancelled = false;

    async function load() {
      if (!cachedAwards) {
        try {
          const res = await fetch('/data/elite/awards.json');
          if (res.ok) cachedAwards = await res.json();
        } catch { /* ignore */ }
      }
      if (!cancelled && cachedAwards) {
        setAwards(cachedAwards[sourceId!] || []);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [sourceId]);

  return awards;
}

function RibbonSvg({ color, size = 30 }: { color: string; size?: number }) {
  const dark = color + 'cc';
  const highlight = color + '88';
  return (
    <svg width={size} height={size * 1.39} viewBox="0 0 64 90" fill="none" style={{ flexShrink: 0 }}>
      <path d="M18 52L18 86L25 78L32 86L32 52Z" fill={dark} opacity="0.85" />
      <path d="M32 52L32 86L39 78L46 86L46 52Z" fill={color} opacity="0.85" />
      <ellipse cx="32" cy="30" rx="24" ry="24" fill="none" stroke={color} strokeWidth="2.5" opacity="0.9" />
      {[0,30,60,90,120,150,180,210,240,270,300,330].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const cx = 32 + 24 * Math.cos(rad);
        const cy = 30 + 24 * Math.sin(rad);
        return <circle key={angle} cx={cx} cy={cy} r="3" fill={color} opacity="0.9" />;
      })}
      <circle cx="32" cy="30" r="17" fill={dark} stroke={highlight} strokeWidth="1" opacity="0.9" />
      <circle cx="32" cy="30" r="12" fill={color} />
      <polygon points="32,21 34.5,27 41,27.5 36,32 37.5,38.5 32,35 26.5,38.5 28,32 23,27.5 29.5,27" fill="#fff" opacity="0.85" />
    </svg>
  );
}

const AWARD_COLORS: Record<string, { ribbon: string; name: string }> = {
  positive: { ribbon: '#059669', name: '#059669' },
  negative: { ribbon: '#dc2626', name: '#dc2626' },
  special:  { ribbon: '#c9a84c', name: '#9a7b2d' },
};

function AwardCard({ award }: { award: Award }) {
  const colors = AWARD_COLORS[award.type] || AWARD_COLORS.positive;
  return (
    <div
      className="flex items-start gap-3 rounded-lg overflow-hidden"
      style={{ padding: '10px 12px', background: '#ffffff', border: '1px solid var(--border)', borderTop: `2px solid ${colors.ribbon}` }}
    >
      <RibbonSvg color={colors.ribbon} size={30} />
      <div style={{ minWidth: 0 }}>
        <div
          className="text-sm font-bold leading-tight"
          style={{ color: colors.name, fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          {award.name}
        </div>
        <div className="text-xs leading-snug mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {award.description}
        </div>
      </div>
    </div>
  );
}

function AwardsSection({ sourceId }: { sourceId: string }) {
  const awards = useAwards(sourceId);

  if (awards.length === 0) return null;

  return (
    <div
      className="mb-6 p-4 rounded-xl"
      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
    >
      <div className="text-[11px] font-semibold tracking-[0.1em] uppercase mb-2.5" style={{ color: 'var(--text-muted)' }}>
        Awards
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {awards.map((award, i) => (
          <AwardCard key={i} award={award} />
        ))}
      </div>
    </div>
  );
}

// Tab types
type SourceFilter = 'all' | 'congress' | 'tweets' | 'press';

// Source label mapping
const SOURCE_LABELS: Record<string, string> = {
  tweets: 'On X',
  press: 'Press Release',
  newsletter: 'Newsletter',
  congress: 'In Congress',
};

const SOURCE_FILTER_LABELS: Record<SourceFilter, string> = {
  all: 'Overall',
  congress: 'In Congress',
  tweets: 'On Twitter/X',
  press: 'Press Releases',
};

// State abbreviation to full name mapping
const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia', PR: 'Puerto Rico',
};

const PROFILE_TABS = [
  { key: 'communication', label: 'Communication Style' },
  { key: 'effectiveness', label: 'Legislative Effectiveness' },
  { key: 'finance', label: 'Campaign Fundraising' },
];

// Helper to format rank with ordinal suffix
function formatRank(rank: number | undefined): string {
  if (rank === undefined || rank === null) return '-';
  const r = Math.round(rank);
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = r % 100;
  return r + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format number with commas
function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(num));
}

// Category breakdown bar chart
function CategoryBreakdownChart({ categories }: { categories: CategoryBreakdown }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const categoryData = Object.entries(ELITE_CATEGORIES).map(([key, cat]) => ({
      name: cat.label,
      value: categories[key as keyof CategoryBreakdown] || 0,
      itemStyle: { color: cat.color },
    })).reverse(); // Reverse so chart matches Congressional Rankings order (top to bottom)

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const p = params as echarts.DefaultLabelFormatterCallbackParams[];
          if (p.length > 0) {
            return `${p[0].name}: ${(p[0].value as number).toFixed(1)}%`;
          }
          return '';
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        max: 100,
        axisLabel: {
          formatter: '{value}%',
        },
      },
      yAxis: {
        type: 'category',
        data: categoryData.map((d) => d.name),
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: categoryData.map((d) => ({
            value: d.value,
            itemStyle: d.itemStyle,
          })),
          barWidth: '60%',
          label: {
            show: true,
            position: 'right',
            formatter: (params) => `${(params.value as number).toFixed(1)}%`,
            color: '#000000',
          },
        },
      ],
    };

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [categories]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  return <div ref={chartRef} style={{ width: '100%', height: '280px' }} />;
}


// Source filter button
function SourceFilterButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded border-2 transition-colors ${
        active
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'bg-white border-blue-600 text-blue-600 hover:bg-blue-50'
      }`}
    >
      {children}
    </button>
  );
}

// Communication Tab Content
function CommunicationTab({
  profile,
  sourceFilter,
  setSourceFilter
}: {
  profile: NonNullable<ReturnType<typeof useEliteProfile>['profile']>;
  sourceFilter: SourceFilter;
  setSourceFilter: (filter: SourceFilter) => void;
}) {
  // Get categories based on source filter
  const getFilteredCategories = (): CategoryBreakdown => {
    if (sourceFilter === 'all' || !profile.communicationBySource) {
      return profile.categories;
    }

    const sourceData = profile.communicationBySource[sourceFilter];
    if (!sourceData) {
      return profile.categories;
    }

    return {
      policy: sourceData['Policy Discussion'] || 0,
      attack_policy: sourceData['Policy Criticism'] || 0,
      attack_personal: sourceData['Personal Attacks'] || 0,
      outcome_creditclaiming: sourceData['Accomplishments'] || 0,
      outcome_bipartisanship: sourceData['Bipartisanship'] || 0,
    };
  };

  const filteredCategories = getFilteredCategories();

  return (
    <div className="space-y-6">
      {/* Side-by-side cards: Rhetorical Breakdown + Congressional Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div
          className="p-6 rounded-xl"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
        >
          <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            Communication Style
          </h3>
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
            How does this official's communication prioritize division or policy?
          </p>
          {/* Source Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Filter by:</span>
            {(Object.keys(SOURCE_FILTER_LABELS) as SourceFilter[]).map((filter) => (
              <SourceFilterButton
                key={filter}
                active={sourceFilter === filter}
                onClick={() => setSourceFilter(filter)}
              >
                {SOURCE_FILTER_LABELS[filter]}
              </SourceFilterButton>
            ))}
          </div>
          <CategoryBreakdownChart categories={filteredCategories} />
        </div>

        {/* Ranking Table with Definitions */}
        {profile.ranks && (
          <div
            className="p-6 rounded-xl"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
          >
            <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              Congressional Rankings
            </h3>
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
              How {profile.name} ranks among all members of Congress.
            </p>
            <div className="space-y-2">
              {Object.entries(ELITE_CATEGORIES).map(([key, cat]) => (
                <div
                  key={key}
                  className="p-2 rounded-lg"
                  style={{ background: 'var(--bg-secondary)', borderLeft: `3px solid ${cat.color}` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                      {cat.label}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                        {formatRank(profile.ranks?.[key as keyof CategoryRanks])}
                      </span>
                      <span className="font-bold text-base" style={{ color: cat.color }}>
                        {(profile.categories[key as keyof CategoryBreakdown] || 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
                    {cat.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent Statements */}
      {profile.posts && profile.posts.length > 0 && (
        <div
          className="p-6 rounded-xl"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
        >
          <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            Recent Statements
          </h3>
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
            Latest public communications from {profile.name}.
          </p>
          <div className="space-y-2">
            {profile.posts
              .filter(post => sourceFilter === 'all' || post.source === sourceFilter)
              .slice(0, 10)
              .map((post: RecentPost, index: number) => (
              <div
                key={index}
                className="p-3 rounded-lg"
                style={{ background: 'var(--bg-secondary)' }}
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                  >
                    {SOURCE_LABELS[post.source] || post.source}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  {/* Category tags */}
                  {post.attack_personal === 1 && (
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium text-white"
                      style={{ background: ELITE_CATEGORIES.attack_personal.color }}
                    >
                      Personal Attacks
                    </span>
                  )}
                  {post.attack_policy === 1 && (
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium text-white"
                      style={{ background: ELITE_CATEGORIES.attack_policy.color }}
                    >
                      Policy Criticism
                    </span>
                  )}
                  {post.policy === 1 && (
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium text-white"
                      style={{ background: ELITE_CATEGORIES.policy.color }}
                    >
                      Policy Discussion
                    </span>
                  )}
                  {post.outcome_creditclaiming === 1 && (
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium text-white"
                      style={{ background: ELITE_CATEGORIES.outcome_creditclaiming.color }}
                    >
                      Accomplishments
                    </span>
                  )}
                  {post.outcome_bipartisanship === 1 && (
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium text-white"
                      style={{ background: ELITE_CATEGORIES.outcome_bipartisanship.color }}
                    >
                      Bipartisanship
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)', marginBottom: 0 }}>
                  {post.text ? (post.text.length > 300 ? `${post.text.slice(0, 300)}...` : post.text) : ''}
                </p>
                {post.url && (
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
                    style={{ background: 'var(--bg-tertiary)' }}
                  >
                    View original
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                    </svg>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Single Bill Progress Card Component
function BillProgressCard({ title, data, color }: {
  title: string;
  data: {
    introduced: number; passedHouse: number; passedSenate: number; toPresident: number; signed: number;
    introducedAvg: number; passedHouseAvg: number; passedSenateAvg: number; toPresidentAvg: number; signedAvg: number;
  };
  color: string;
}) {
  const stages = [
    { label: 'Introduced', value: data.introduced, avg: data.introducedAvg },
    { label: 'Passed House', value: data.passedHouse, avg: data.passedHouseAvg },
    { label: 'Passed Senate', value: data.passedSenate, avg: data.passedSenateAvg },
    { label: 'To President', value: data.toPresident, avg: data.toPresidentAvg },
    { label: 'Enacted', value: data.signed, avg: data.signedAvg },
  ];

  const maxValue = Math.max(...stages.map(s => s.value), 1);

  return (
    <div
      className="p-4 rounded-xl"
      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
    >
      <h3 className="text-base font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h3>
      <div className="space-y-3">
        {stages.map((stage) => (
          <div key={stage.label}>
            <div className="flex justify-between text-sm mb-1">
              <span style={{ color: 'var(--text-primary)' }}>{stage.label}</span>
              <div className="flex gap-3">
                <span className="font-bold" style={{ color }}>{stage.value}</span>
                <span style={{ color: 'var(--text-muted)' }}>Average: {stage.avg}</span>
              </div>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(stage.value / maxValue) * 100}%`,
                  background: color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Effectiveness Tab Content
function EffectivenessTab({ profile }: { profile: NonNullable<ReturnType<typeof useEliteProfile>['profile']> }) {
  const effectiveness = profile.effectiveness;

  if (!effectiveness) {
    return (
      <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
        No effectiveness data available for this legislator.
      </div>
    );
  }

  // Get top 5 topics
  const topTopics = Object.entries(effectiveness.topics)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const totalTopics = Object.values(effectiveness.topics).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      {/* Top Row: Focus & Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          className="p-4 rounded-xl"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
        >
          <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            Legislative Focus
          </h3>
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
            When introducing legislation, {profile.name} focuses on:
          </p>
          <div className="space-y-1.5">
            {topTopics.map(([topic, count], index) => (
              <div key={topic} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </span>
                <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{topic}</span>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {totalTopics > 0 ? ((count / totalTopics) * 100).toFixed(0) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="p-4 rounded-xl"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
        >
          <h3 className="text-base font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Attendance
          </h3>
          <div className="space-y-3">
            {/* This Member */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: 'var(--text-primary)' }}>{profile.name.split(' ').pop()}</span>
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{effectiveness.attendanceRate.toFixed(0)}%</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${Math.min(effectiveness.attendanceRate, 100)}%` }}
                />
              </div>
            </div>
            {/* Congress Average */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: 'var(--text-muted)' }}>Congress Avg</span>
                <span className="font-bold" style={{ color: 'var(--text-muted)' }}>{effectiveness.avgAttendanceRate.toFixed(0)}%</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                <div
                  className="h-full rounded-full bg-gray-400"
                  style={{ width: `${Math.min(effectiveness.avgAttendanceRate, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bill Progress Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BillProgressCard
          title="Sponsored Bills"
          data={effectiveness.sponsored}
          color="#22c55e"
        />
        <BillProgressCard
          title="Co-sponsored Bills"
          data={effectiveness.cosponsored}
          color="#3b82f6"
        />
      </div>
    </div>
  );
}

// Campaign Finance Tab Content
function CampaignFinanceTab({ profile }: { profile: NonNullable<ReturnType<typeof useEliteProfile>['profile']> }) {
  const finance = profile.campaignFinance;

  if (!finance) {
    return (
      <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
        No campaign finance data available for this legislator.
      </div>
    );
  }

  const instatePercent = finance.instateTotal + finance.outstateTotal > 0
    ? (finance.instateTotal / (finance.instateTotal + finance.outstateTotal)) * 100
    : 0;

  return (
    <div className="space-y-4">
      {/* Top Row: Amount Raised & Number of Donors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Amount Raised Card */}
        <div
          className="p-4 rounded-xl"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
        >
          <h3 className="text-base font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Amount Raised
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span style={{ color: 'var(--text-primary)' }}>{profile.name}</span>
              <span className="font-bold" style={{ fontSize: '1rem', color: '#22c55e' }}>{formatCurrency(finance.totalRaised)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span style={{ color: 'var(--text-muted)' }}>Congress Average</span>
              <span className="font-bold" style={{ color: 'var(--text-muted)' }}>{formatCurrency(finance.totalRaisedAvg)}</span>
            </div>
            <div className="flex justify-between items-center pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Rank in Congress</span>
              <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{formatRank(finance.totalRaisedRank)}</span>
            </div>
          </div>
        </div>

        {/* Number of Donors Card */}
        <div
          className="p-4 rounded-xl"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
        >
          <h3 className="text-base font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Number of Individual Donors
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span style={{ color: 'var(--text-primary)' }}>{profile.name}</span>
              <span className="font-bold" style={{ fontSize: '1rem', color: '#3b82f6' }}>{formatNumber(finance.totalDonors)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span style={{ color: 'var(--text-muted)' }}>Congress Average</span>
              <span className="font-bold" style={{ color: 'var(--text-muted)' }}>{formatNumber(finance.totalDonorsAvg)}</span>
            </div>
            <div className="flex justify-between items-center pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Rank in Congress</span>
              <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{formatRank(finance.totalDonorsRank)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Donation Sources */}
      <div
        className="p-4 rounded-xl"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      >
        <h3 className="text-base font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          Donation Sources
        </h3>
        <div className="flex h-6 rounded-full overflow-hidden mb-4">
          <div
            className="bg-blue-600 flex items-center justify-center text-white text-xs font-bold"
            style={{ width: `${instatePercent}%` }}
          >
            {instatePercent > 20 ? `${instatePercent.toFixed(0)}%` : ''}
          </div>
          <div
            className="bg-gray-400 flex items-center justify-center text-white text-xs font-bold"
            style={{ width: `${100 - instatePercent}%` }}
          >
            {100 - instatePercent > 20 ? `${(100 - instatePercent).toFixed(0)}%` : ''}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-600" />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>In-State</span>
            </div>
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(finance.instateTotal)}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Out-of-State</span>
            </div>
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(finance.outstateTotal)}</span>
          </div>
        </div>
      </div>

      {/* Donations by State Map */}
      {finance.stateMap && Object.keys(finance.stateMap).length > 0 && (
        <div
          className="p-4 rounded-xl"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
        >
          <h3 className="text-base font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Donations by State
          </h3>
          <USChoroplethChart
            data={Object.entries(finance.stateMap)
              .filter(([abbr]) => STATE_NAMES[abbr])
              .map(([abbr, value]) => ({
                name: STATE_NAMES[abbr],
                value: value as number
              }))}
            tooltipTitle="Donations"
          />
        </div>
      )}
    </div>
  );
}

export function ElitesProfileDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile, loading, error } = useEliteProfile(id);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  // Set page title with legislator name when available
  usePageTitle(profile ? `${profile.name}` : 'Legislator Profile');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error || 'Profile not found'}</p>
        <Link
          to="/elites/profiles"
          className="text-blue-600 hover:underline"
        >
          Back to Profiles
        </Link>
      </div>
    );
  }

  const partyColor = PARTY_COLORS[profile.party as keyof typeof PARTY_COLORS] || PARTY_COLORS.Independent;
  const isNational = profile.source_id.startsWith('N');

  const bioguideId = getBioguideFromImageUrl(profile.image_url);
  const imageUrl = bioguideId ? getCongressImageUrl(bioguideId) : null;

  return (
    <div>
      {/* Back Link */}
      <Link
        to="/elites/profiles"
        className="inline-flex items-center gap-2 mb-6 text-sm"
        style={{ color: 'var(--text-secondary)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Profiles
      </Link>

      {/* Profile Header */}
      <div
        className="p-6 rounded-xl mb-6"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      >
        <div className="flex flex-col md:flex-row items-start gap-6">
          {/* Photo */}
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={profile.name}
              className="w-32 h-32 rounded-xl object-cover flex-shrink-0"
              style={{ border: `3px solid ${partyColor}` }}
              onError={handleImageError}
            />
          ) : null}
          <div
            className={`w-32 h-32 rounded-xl flex items-center justify-center text-4xl font-bold text-white flex-shrink-0 ${imageUrl ? 'hidden' : ''}`}
            style={{ background: partyColor }}
          >
            {profile.name.split(' ').pop()?.charAt(0) || profile.name.charAt(0)}
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="font-bold mb-2" style={{ color: 'var(--text-primary)', fontSize: '1.5rem' }}>
              {profile.name}
            </h1>
            <div className="flex flex-wrap gap-3 mb-4">
              <span
                className="px-3 py-1 rounded-full text-sm font-bold"
                style={{ background: partyColor, color: '#fff' }}
              >
                {profile.party}
              </span>
              <span
                className="px-3 py-1 rounded-full text-sm"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              >
                {profile.state}
              </span>
              <span
                className="px-3 py-1 rounded-full text-sm"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              >
                {CHAMBER_LABELS[profile.chamber] || profile.chamber}
              </span>
              <span
                className="px-3 py-1 rounded-full text-sm"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
              >
                {isNational ? 'U.S. Congress' : 'State Legislature'}
              </span>
            </div>
            {/* Additional info */}
            <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {profile.statement_count && (
                <span>
                  <strong>{profile.statement_count.toLocaleString()}</strong> statements analyzed
                </span>
              )}
              {profile.servingSince && (
                <span>
                  Serving since: <strong>{new Date(profile.servingSince).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>
                </span>
              )}
              {profile.nextElection && (
                <span>
                  Next election: <strong>{profile.nextElection}</strong>
                </span>
              )}
            </div>
            {/* External links */}
            <div className="flex gap-3 mt-4">
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600"
                  title="Official Website"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                  </svg>
                </a>
              )}
              {profile.twitter_id && (
                <a
                  href={`https://twitter.com/intent/user?user_id=${profile.twitter_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600"
                  title="Twitter/X"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              )}
              {profile.bioguide_id && (
                <a
                  href={`https://bioguide.congress.gov/search/bio/${profile.bioguide_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600"
                  title="Congress.gov Biography"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                  </svg>
                </a>
              )}
            </div>
          </div>

          {/* Ideology Summary */}
          {profile.ideology && (
            <div className="flex-shrink-0 w-full md:w-64 lg:w-72 p-2 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
              <h3 className="font-bold" style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '6px' }}>
                Partisan Extremity
              </h3>
              <div className="flex gap-2" style={{ marginBottom: '6px' }}>
                <div className="text-center flex-1">
                  <p className="font-bold leading-none" style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '5px' }}>
                    {formatRank(profile.ideology.rank)}
                  </p>
                  <p className="text-xs leading-none" style={{ color: 'var(--text-muted)', marginBottom: '5px' }}>
                    Most liberal
                  </p>
                </div>
                <div className="text-center flex-1">
                  <p className="font-bold leading-none" style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '5px' }}>
                    {Math.round(profile.ideology.percentile * 100)}%
                  </p>
                  <p className="text-xs leading-none" style={{ color: 'var(--text-muted)', marginBottom: '5px' }}>
                    Are more liberal
                  </p>
                </div>
              </div>
              {/* Ideology Spectrum */}
              <div>
                <div className="relative h-4 rounded-full overflow-hidden" style={{ background: 'linear-gradient(to right, #2563eb, #9333ea, #dc2626)' }}>
                  <div
                    className="absolute top-0 w-4 h-4 rounded-full bg-white border-2 border-gray-800 transform -translate-x-1/2 shadow"
                    style={{ left: `${profile.ideology.percentile * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>Liberal</span>
                  <span>Conservative</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Awards */}
      <AwardsSection sourceId={profile.source_id} />

      {/* Main Tabs */}
      <Tabs tabs={PROFILE_TABS} urlKey="tab">
        <TabPanel>
          <CommunicationTab
            profile={profile}
            sourceFilter={sourceFilter}
            setSourceFilter={setSourceFilter}
          />
        </TabPanel>

        <TabPanel>
          <EffectivenessTab profile={profile} />
        </TabPanel>

        <TabPanel>
          <CampaignFinanceTab profile={profile} />
        </TabPanel>
      </Tabs>
    </div>
  );
}
