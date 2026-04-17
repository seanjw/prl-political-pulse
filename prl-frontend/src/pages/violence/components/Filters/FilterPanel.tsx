import { useState, useMemo } from 'react';
import type { FilterState, PrlMeta, Sex, PoliticalViolenceEvent } from '../../types/event';
import { RangeSlider } from './RangeSlider';

interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  uniqueRaces: string[];
  uniqueAttackTypes: string[];
  uniqueTargets: string[];
  minYear: number;
  maxYear: number;
  events: PoliticalViolenceEvent[];
}

export function FilterPanel({ filters, onFiltersChange, uniqueRaces, uniqueAttackTypes, uniqueTargets, minYear, maxYear, events }: FilterPanelProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState({
    year: true,
    category: true,
    massCasualty: true,
    attackType: false,
    target: false,
    sex: false,
    trans: false,
    race: false
  });

  // Calculate counts for each filter option
  const counts = useMemo(() => {
    const prlMeta: Record<string, number> = {};
    const sex: Record<string, number> = {};
    const trans: { yes: number; no: number } = { yes: 0, no: 0 };
    const race: Record<string, number> = {};
    const massCasualty: { yes: number; no: number } = { yes: 0, no: 0 };
    const attackType: Record<string, number> = {};
    const target: Record<string, number> = {};

    events.forEach(e => {
      // prl_meta counts
      if (e.prl_meta) {
        prlMeta[e.prl_meta] = (prlMeta[e.prl_meta] || 0) + 1;
      }
      // sex counts
      if (e.sex) {
        sex[e.sex] = (sex[e.sex] || 0) + 1;
      }
      // trans counts
      if (e.trans === 1) {
        trans.yes++;
      } else {
        trans.no++;
      }
      // race counts
      if (e.race) {
        race[e.race] = (race[e.race] || 0) + 1;
      }
      // mass casualty counts (total_killed > 2)
      if (e.total_killed > 2) {
        massCasualty.yes++;
      } else {
        massCasualty.no++;
      }
      // attack type counts
      if (e.attack_type) {
        attackType[e.attack_type] = (attackType[e.attack_type] || 0) + 1;
      }
      // target counts (use first item if comma-separated)
      if (e.target) {
        const firstTarget = e.target.split(',')[0]?.trim();
        if (firstTarget) {
          target[firstTarget] = (target[firstTarget] || 0) + 1;
        }
      }
    });

    return { prlMeta, sex, trans, race, massCasualty, attackType, target };
  }, [events]);

  const prlMetaOptions: { value: PrlMeta; label: string }[] = [
    { value: 'Government Policy', label: `Government Policy (${counts.prlMeta['Government Policy'] || 0})` },
    { value: 'Politician/Party', label: `Politician/Party (${counts.prlMeta['Politician/Party'] || 0})` },
    { value: 'Institution', label: `Government Agency (${counts.prlMeta['Institution'] || 0})` },
    { value: 'Unclear', label: `Unclear (${counts.prlMeta['Unclear'] || 0})` },
  ];

  const sexOptions: { value: Sex; label: string }[] = [
    { value: 'Male', label: `Male (${counts.sex['Male'] || 0})` },
    { value: 'Female', label: `Female (${counts.sex['Female'] || 0})` },
    { value: 'Both', label: `Multiple Perpetrators (${counts.sex['Both'] || 0})` },
  ];

  const hasActiveFilters =
    filters.prl_meta.length > 0 ||
    filters.sex.length > 0 ||
    filters.trans !== null ||
    filters.race.length > 0 ||
    filters.yearRange[0] !== minYear ||
    filters.yearRange[1] !== maxYear ||
    filters.massCasualty !== null ||
    filters.attackType.length > 0 ||
    filters.target.length > 0;

  const clearAll = () => {
    onFiltersChange({
      prl_meta: [],
      sex: [],
      trans: null,
      race: [],
      yearRange: [minYear, maxYear],
      massCasualty: null,
      attackType: [],
      target: []
    });
  };

  const toggleFilter = <T extends string>(
    current: T[],
    value: T,
    setter: (arr: T[]) => void
  ) => {
    if (current.includes(value)) {
      setter(current.filter(v => v !== value));
    } else {
      setter([...current, value]);
    }
  };

  const activeFilterCount =
    (filters.prl_meta.length > 0 ? 1 : 0) +
    (filters.sex.length > 0 ? 1 : 0) +
    (filters.trans !== null ? 1 : 0) +
    (filters.race.length > 0 ? 1 : 0) +
    (filters.yearRange[0] !== minYear || filters.yearRange[1] !== maxYear ? 1 : 0) +
    (filters.massCasualty !== null ? 1 : 0) +
    (filters.attackType.length > 0 ? 1 : 0) +
    (filters.target.length > 0 ? 1 : 0);

  return (
    <div className="violence-card p-3 md:p-4 lg:sticky lg:top-4">
      {/* Mobile Header - Collapsible */}
      <button
        className="lg:hidden w-full flex items-center justify-between"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold" style={{ color: 'var(--violence-text-primary)', fontFamily: 'Source Serif 4, serif' }}>
            Filters
          </h2>
          {activeFilterCount > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'var(--violence-accent)', color: 'white' }}
            >
              {activeFilterCount}
            </span>
          )}
        </div>
        <svg
          className="w-5 h-5 transition-transform"
          style={{ color: 'var(--violence-text-muted)', transform: mobileOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Desktop Header */}
      <div className="hidden lg:flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold" style={{ color: 'var(--violence-text-primary)', fontFamily: 'Source Serif 4, serif' }}>
          Filters
        </h2>
        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="text-xs uppercase tracking-wide hover:underline"
            style={{ color: 'var(--violence-accent)' }}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Filter Content - Collapsible on mobile */}
      <div className={`${mobileOpen ? 'block' : 'hidden'} lg:block mt-4 lg:mt-0`}>
        {/* Mobile Clear All */}
        {hasActiveFilters && (
          <div className="lg:hidden flex justify-end mb-3">
            <button
              onClick={clearAll}
              className="text-xs uppercase tracking-wide hover:underline"
              style={{ color: 'var(--violence-accent)' }}
            >
              Clear All
            </button>
          </div>
        )}

      {/* Year Range Filter */}
      <FilterSection
        title="Time Period"
        expanded={expanded.year}
        onToggle={() => setExpanded(e => ({ ...e, year: !e.year }))}
        count={0}
      >
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span style={{ color: 'var(--violence-text-primary)' }}>{filters.yearRange[0]}</span>
            <span style={{ color: 'var(--violence-text-muted)' }}>–</span>
            <span style={{ color: 'var(--violence-text-primary)' }}>{filters.yearRange[1]}</span>
          </div>
          <RangeSlider
            min={minYear}
            max={maxYear}
            value={filters.yearRange}
            onChange={(newRange) => onFiltersChange({ ...filters, yearRange: newRange })}
          />
        </div>
      </FilterSection>

      {/* Motivation Filter */}
      <FilterSection
        title="Motivation for political violence"
        expanded={expanded.category}
        onToggle={() => setExpanded(e => ({ ...e, category: !e.category }))}
        count={filters.prl_meta.length}
      >
        {prlMetaOptions.map(opt => (
          <FilterCheckbox
            key={opt.value}
            label={opt.label}
            checked={filters.prl_meta.includes(opt.value)}
            onChange={() => toggleFilter(
              filters.prl_meta,
              opt.value,
              arr => onFiltersChange({ ...filters, prl_meta: arr as PrlMeta[] })
            )}
          />
        ))}
      </FilterSection>

      {/* Mass Casualty */}
      <FilterSection
        title="Mass Casualty"
        expanded={expanded.massCasualty}
        onToggle={() => setExpanded(e => ({ ...e, massCasualty: !e.massCasualty }))}
        count={filters.massCasualty !== null ? 1 : 0}
      >
        <div className="flex gap-4">
          <button
            onClick={() => onFiltersChange({ ...filters, massCasualty: filters.massCasualty === true ? null : true })}
            className="text-sm px-4 py-1.5 rounded transition-colors"
            style={{
              background: filters.massCasualty === true ? 'var(--violence-accent)' : 'var(--violence-bg-tertiary)',
              color: filters.massCasualty === true ? 'white' : 'var(--violence-text-muted)',
              border: '1px solid ' + (filters.massCasualty === true ? 'var(--violence-accent)' : 'var(--violence-border)')
            }}
          >
            Yes ({counts.massCasualty.yes})
          </button>
          <button
            onClick={() => onFiltersChange({ ...filters, massCasualty: filters.massCasualty === false ? null : false })}
            className="text-sm px-4 py-1.5 rounded transition-colors"
            style={{
              background: filters.massCasualty === false ? 'var(--violence-accent)' : 'var(--violence-bg-tertiary)',
              color: filters.massCasualty === false ? 'white' : 'var(--violence-text-muted)',
              border: '1px solid ' + (filters.massCasualty === false ? 'var(--violence-accent)' : 'var(--violence-border)')
            }}
          >
            No ({counts.massCasualty.no})
          </button>
        </div>
      </FilterSection>

      {/* Attack Type */}
      <FilterSection
        title="Attack Type"
        expanded={expanded.attackType}
        onToggle={() => setExpanded(e => ({ ...e, attackType: !e.attackType }))}
        count={filters.attackType.length}
      >
        {uniqueAttackTypes.filter(t => t).map(attackType => (
          <FilterCheckbox
            key={attackType}
            label={`${attackType} (${counts.attackType[attackType] || 0})`}
            checked={filters.attackType.includes(attackType)}
            onChange={() => toggleFilter(
              filters.attackType,
              attackType,
              arr => onFiltersChange({ ...filters, attackType: arr })
            )}
          />
        ))}
      </FilterSection>

      {/* Target */}
      <FilterSection
        title="Target"
        expanded={expanded.target}
        onToggle={() => setExpanded(e => ({ ...e, target: !e.target }))}
        count={filters.target.length}
      >
        {uniqueTargets.filter(t => t).map(target => (
          <FilterCheckbox
            key={target}
            label={`${target} (${counts.target[target] || 0})`}
            checked={filters.target.includes(target)}
            onChange={() => toggleFilter(
              filters.target,
              target,
              arr => onFiltersChange({ ...filters, target: arr })
            )}
          />
        ))}
      </FilterSection>

      {/* Perpetrator Sex */}
      <FilterSection
        title="Perpetrator Sex"
        expanded={expanded.sex}
        onToggle={() => setExpanded(e => ({ ...e, sex: !e.sex }))}
        count={filters.sex.length}
      >
        {sexOptions.map(opt => (
          <FilterCheckbox
            key={opt.value}
            label={opt.label}
            checked={filters.sex.includes(opt.value)}
            onChange={() => toggleFilter(
              filters.sex,
              opt.value,
              arr => onFiltersChange({ ...filters, sex: arr as Sex[] })
            )}
          />
        ))}
      </FilterSection>

      {/* Trans */}
      <FilterSection
        title="Trans Perpetrator"
        expanded={expanded.trans}
        onToggle={() => setExpanded(e => ({ ...e, trans: !e.trans }))}
        count={filters.trans !== null ? 1 : 0}
      >
        <div className="flex gap-4">
          <button
            onClick={() => onFiltersChange({ ...filters, trans: filters.trans === true ? null : true })}
            className="text-sm px-4 py-1.5 rounded transition-colors"
            style={{
              background: filters.trans === true ? 'var(--violence-accent)' : 'var(--violence-bg-tertiary)',
              color: filters.trans === true ? 'white' : 'var(--violence-text-muted)',
              border: '1px solid ' + (filters.trans === true ? 'var(--violence-accent)' : 'var(--violence-border)')
            }}
          >
            Yes ({counts.trans.yes})
          </button>
          <button
            onClick={() => onFiltersChange({ ...filters, trans: filters.trans === false ? null : false })}
            className="text-sm px-4 py-1.5 rounded transition-colors"
            style={{
              background: filters.trans === false ? 'var(--violence-accent)' : 'var(--violence-bg-tertiary)',
              color: filters.trans === false ? 'white' : 'var(--violence-text-muted)',
              border: '1px solid ' + (filters.trans === false ? 'var(--violence-accent)' : 'var(--violence-border)')
            }}
          >
            No ({counts.trans.no})
          </button>
        </div>
      </FilterSection>

      {/* Race */}
      <FilterSection
        title="Perpetrator Race"
        expanded={expanded.race}
        onToggle={() => setExpanded(e => ({ ...e, race: !e.race }))}
        count={filters.race.length}
      >
        {uniqueRaces.filter(r => r).map(race => (
          <FilterCheckbox
            key={race}
            label={`${race === 'Not White' ? 'Other (non-white)' : race} (${counts.race[race] || 0})`}
            checked={filters.race.includes(race)}
            onChange={() => toggleFilter(
              filters.race,
              race,
              arr => onFiltersChange({ ...filters, race: arr })
            )}
          />
        ))}
      </FilterSection>
      </div>
    </div>
  );
}

function FilterSection({
  title,
  expanded,
  onToggle,
  count,
  children
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="py-2.5" style={{ borderBottom: '1px solid var(--violence-border)' }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="violence-filter-label flex items-center gap-2">
          {title}
          {count > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'var(--violence-accent-muted)', color: 'var(--violence-accent)' }}
            >
              {count}
            </span>
          )}
        </span>
        <svg
          className="w-4 h-4 transition-transform"
          style={{
            color: 'var(--violence-text-muted)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {children}
        </div>
      )}
    </div>
  );
}

function FilterCheckbox({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex items-center gap-3 cursor-pointer group w-full text-left"
    >
      <div
        className="w-4 h-4 rounded flex items-center justify-center transition-colors flex-shrink-0"
        style={{
          background: checked ? 'var(--violence-accent)' : 'transparent',
          border: '1px solid ' + (checked ? 'var(--violence-accent)' : 'var(--violence-border-light)')
        }}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className="violence-filter-option group-hover:text-[var(--violence-text-primary)]">
        {label}
      </span>
    </button>
  );
}
