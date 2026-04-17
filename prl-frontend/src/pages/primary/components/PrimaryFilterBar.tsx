import { US_STATES } from '../../../config/elitesCategories';
import type { PrimaryFilters } from '../../../types/primary';

interface PrimaryFilterBarProps {
  filters: PrimaryFilters;
  onFilterChange: (update: Partial<PrimaryFilters>) => void;
  onReset: () => void;
}

export function PrimaryFilterBar({ filters, onFilterChange, onReset }: PrimaryFilterBarProps) {
  const hasActiveFilters = filters.state || filters.chamber || filters.party || filters.incumbentStatus || filters.search;

  return (
    <div
      className="mb-6 rounded-lg px-3.5 py-2.5 flex flex-wrap items-center gap-2"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-1.5 shrink-0 mr-1">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Filter
        </span>
      </div>

      <div className="w-px h-4 hidden sm:block" style={{ background: 'var(--border)' }} />

      <FilterSelect
        value={filters.state}
        onChange={(v) => onFilterChange({ state: v })}
        placeholder="All States"
      >
        {US_STATES.map((s) => (
          <option key={s.code} value={s.code}>{s.name}</option>
        ))}
      </FilterSelect>

      <FilterSelect
        value={filters.chamber}
        onChange={(v) => onFilterChange({ chamber: v })}
        placeholder="Chamber"
      >
        <option value="senate">Senate</option>
        <option value="house">House</option>
      </FilterSelect>

      <FilterSelect
        value={filters.party}
        onChange={(v) => onFilterChange({ party: v })}
        placeholder="Party"
      >
        <option value="democrat">Democrat</option>
        <option value="republican">Republican</option>
      </FilterSelect>

      <FilterSelect
        value={filters.incumbentStatus}
        onChange={(v) => onFilterChange({ incumbentStatus: v })}
        placeholder="Status"
      >
        <option value="incumbent">Incumbents</option>
        <option value="challenger">Challengers</option>
        <option value="open">Open Seat</option>
      </FilterSelect>

      <div className="flex-1 min-w-[160px] relative">
        <svg
          className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ color: 'var(--text-muted)' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search candidates..."
          className="w-full rounded pl-7 pr-2 text-[13px]"
          style={{
            height: '2rem',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            outline: 'none',
            fontFamily: "'Source Sans 3', sans-serif",
          }}
          value={filters.search}
          onChange={(e) => onFilterChange({ search: e.target.value })}
        />
      </div>

      {hasActiveFilters && (
        <button
          onClick={onReset}
          className="text-[11px] font-semibold px-2 py-0.5 rounded transition-colors"
          style={{ color: 'var(--accent)', background: 'var(--accent-muted)' }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'var(--accent-muted)'; e.currentTarget.style.color = 'var(--accent)'; }}
        >
          Reset
        </button>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <select
      className="rounded px-2 text-[13px] appearance-none cursor-pointer min-w-[120px]"
      style={{
        height: '2rem',
        background: 'var(--bg-primary)',
        color: value ? 'var(--text-primary)' : 'var(--text-muted)',
        border: `1px solid ${value ? 'var(--accent)' : 'var(--border)'}`,
        paddingRight: '2.25rem',
        outline: 'none',
        fontFamily: "'Source Sans 3', sans-serif",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
      }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}
