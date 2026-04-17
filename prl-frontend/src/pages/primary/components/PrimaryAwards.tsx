import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PRIMARY_CATEGORIES, PRIMARY_CATEGORY_KEYS } from '../../../config/primaryCategories';
import { getAwardConfig } from '../../../config/primaryAwards';
import type { PrimaryAward } from '../../../types/primary';

interface PrimaryAwardsProps {
  awards: PrimaryAward[];
}

export function PrimaryAwards({ awards }: PrimaryAwardsProps) {
  const [activeTab, setActiveTab] = useState(0);
  const activeKey = PRIMARY_CATEGORY_KEYS[activeTab];
  const activeCategory = PRIMARY_CATEGORIES[activeKey];

  const grouped = useMemo(() => {
    const result: Record<string, { top: PrimaryAward[]; bottom: PrimaryAward[]; zero_attacks: PrimaryAward[] }> = {};
    for (const key of PRIMARY_CATEGORY_KEYS) {
      result[key] = { top: [], bottom: [], zero_attacks: [] };
    }
    for (const award of awards) {
      const bucket = result[award.category];
      if (bucket) {
        bucket[award.type].push(award);
      }
    }
    // Sort top descending, bottom ascending by value
    for (const key of PRIMARY_CATEGORY_KEYS) {
      result[key].top.sort((a, b) => b.value - a.value);
      result[key].bottom.sort((a, b) => a.value - b.value);
      result[key].zero_attacks.sort((a, b) => a.name.localeCompare(b.name));
    }
    return result;
  }, [awards]);

  const group = grouped[activeKey];

  if (awards.length === 0) {
    return (
      <div className="text-center py-20 text-sm" style={{ color: 'var(--text-muted)' }}>
        No awards data available yet. Awards require candidates with 50+ tracked statements.
      </div>
    );
  }

  return (
    <section className="mb-10">
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h2
            className="text-xl font-bold leading-tight"
            style={{ color: 'var(--text-primary)', fontFamily: "'Source Serif 4', Georgia, serif" }}
          >
            Candidate Awards
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Recognizing candidates in the top and bottom 3% of each rhetoric category (50+ statements required)
          </p>
        </div>
      </div>

      {/* Category tabs */}
      <div
        className="flex flex-wrap gap-0"
        style={{ borderBottom: '2px solid var(--border)' }}
      >
        {PRIMARY_CATEGORY_KEYS.map((key, idx) => {
          const cat = PRIMARY_CATEGORIES[key];
          const isActive = idx === activeTab;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(idx)}
              className="px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors relative"
              style={{
                color: isActive ? cat.color : 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                marginBottom: '-2px',
              }}
            >
              {cat.label}
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-[2px]"
                  style={{ background: cat.color }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Description */}
      <div
        className="px-3.5 py-2 text-sm italic"
        style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
      >
        {activeCategory.description}
      </div>

      {/* Award sections */}
      <div
        className="rounded-b-lg overflow-hidden"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderTop: 'none' }}
      >
        {/* Top 3% */}
        <AwardSection
          title={activeKey === 'attack_personal' ? 'Least Civil Candidates (Top 3%)' : 'Top 3%'}
          awards={group?.top || []}
          categoryKey={activeKey}
          isPositive={activeKey !== 'attack_personal'}
        />

        {/* Bottom 3% */}
        <AwardSection
          title={activeKey === 'attack_personal' ? 'Most Civil (Bottom 3%)' : 'Bottom 3%'}
          awards={group?.bottom || []}
          categoryKey={activeKey}
          isPositive={activeKey === 'attack_personal'}
        />

        {/* Zero Personal Attacks */}
        {activeKey === 'attack_personal' && (group?.zero_attacks?.length ?? 0) > 0 && (
          <AwardSection
            title="Zero Personal Attacks"
            awards={group?.zero_attacks || []}
            categoryKey={activeKey}
            isPositive={true}
          />
        )}
      </div>
    </section>
  );
}

function AwardSection({
  title,
  awards,
  categoryKey,
  isPositive,
}: {
  title: string;
  awards: PrimaryAward[];
  categoryKey: string;
  isPositive: boolean;
}) {
  const accentColor = isPositive ? '#059669' : '#dc2626';

  return (
    <div>
      <div
        className="px-3.5 py-1.5 text-xs font-bold tracking-[0.15em] uppercase"
        style={{ color: accentColor, borderBottom: '1px solid var(--border)', background: `${accentColor}08` }}
      >
        {title}
      </div>
      {awards.length === 0 ? (
        <div className="px-3.5 py-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
          No candidates qualify
        </div>
      ) : (
        awards.map((award) => (
          <AwardRow key={`${award.candidate_id}-${award.type}`} award={award} categoryKey={categoryKey} isPositive={isPositive} />
        ))
      )}
    </div>
  );
}

function AwardRow({
  award,
  categoryKey,
  isPositive,
}: {
  award: PrimaryAward;
  categoryKey: string;
  isPositive: boolean;
}) {
  const pct = Math.round(award.value * 100);
  const config = getAwardConfig(award.category, award.type);
  const barColor = isPositive ? '#059669' : '#dc2626';
  const partyColor = award.party === 'Democrat' ? '#2563eb' : '#dc2626';

  return (
    <Link
      to={`/primary/candidate/${award.candidate_id}`}
      className="flex items-center gap-3 px-3.5 py-2.5 transition-colors"
      style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}
      onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
      onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Award badge */}
      <span
        className="px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
        style={{ background: `${barColor}15`, color: barColor }}
        title={config?.description}
      >
        {award.award_name}
      </span>

      {/* Candidate info */}
      <div className="flex-1 min-w-0">
        <div className="text-base font-medium truncate">{award.name}</div>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: partyColor }} />
          {award.state}{award.office === 'H' ? `-${award.district || 'AL'}` : ' Senate'}
          <span className="mx-1">&middot;</span>
          {award.statement_count.toLocaleString()} statements
        </div>
      </div>

      {/* Value bar */}
      <div className="w-20 flex items-center gap-1.5">
        <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(pct * 3, 100)}%`, background: PRIMARY_CATEGORIES[categoryKey]?.color || barColor }}
          />
        </div>
        <span className="text-xs font-mono tabular-nums w-7 text-right" style={{ color: PRIMARY_CATEGORIES[categoryKey]?.color || barColor, fontWeight: 600 }}>
          {pct}%
        </span>
      </div>
    </Link>
  );
}
