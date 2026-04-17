import type { PoliticalViolenceEvent } from '../../types/event';

interface DetailPanelProps {
  event: PoliticalViolenceEvent | null;
  onClose: () => void;
}

export function DetailPanel({ event, onClose }: DetailPanelProps) {
  if (!event) return null;

  const formatDate = (year: number, month: number, day: number) => {
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div
      className="fixed inset-y-0 right-0 w-full max-w-lg z-50 overflow-y-auto violence-detail-panel violence-fade-in"
      style={{ background: 'var(--violence-bg-secondary)', borderLeft: '1px solid var(--violence-border)' }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-6 py-4 flex items-start justify-between"
        style={{ background: 'var(--violence-bg-secondary)', borderBottom: '1px solid var(--violence-border)' }}
      >
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--violence-text-muted)' }}>
            Incident Details
          </div>
          <h2 className="text-xl" style={{ color: 'var(--violence-text-primary)', fontFamily: 'Source Serif 4, serif' }}>
            {event.city}, {event.state}
          </h2>
          <div className="text-sm mt-1" style={{ color: 'var(--violence-text-muted)' }}>
            {formatDate(event.year, event.month, event.day)}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded hover:bg-[var(--violence-bg-tertiary)] transition-colors"
          style={{ color: 'var(--violence-text-muted)' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Key Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded" style={{ background: 'var(--violence-bg-tertiary)' }}>
            <div className="violence-stat-value text-2xl" style={{ color: 'var(--violence-accent)' }}>
              {event.total_killed}
            </div>
            <div className="violence-stat-label">Fatalities</div>
          </div>
          <div className="p-4 rounded" style={{ background: 'var(--violence-bg-tertiary)' }}>
            <div className="violence-stat-value text-2xl">
              {event.num_perps > 0 ? event.num_perps : '—'}
            </div>
            <div className="violence-stat-label">Perpetrators</div>
          </div>
        </div>

        {/* Classification */}
        <div>
          <div className="violence-section-header">Classification</div>
          <div className="space-y-2">
            <DetailRow label="Category" value={event.prl_meta || '—'} />
            <DetailRow label="Attack Type" value={event.attack_type || '—'} />
            <DetailRow label="Target" value={event.target || '—'} />
          </div>
        </div>

        {/* Summary */}
        <div>
          <div className="violence-section-header">Summary</div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--violence-text-secondary)' }}>
            {event.summary || 'No summary available.'}
          </p>
        </div>

        {/* Perpetrator Information */}
        <div>
          <div className="violence-section-header">Perpetrator Information</div>
          <div className="space-y-2">
            {event.sex && <DetailRow label="Sex" value={event.sex} />}
            {event.race && <DetailRow label="Race" value={event.race} />}
            <DetailRow label="Transgender" value={event.trans === 1 ? 'Yes' : 'No'} />
            {event.perps_killed > 0 && (
              <DetailRow label="Perpetrators Killed" value={event.perps_killed.toString()} />
            )}
          </div>
        </div>

        {/* Motive */}
        {event.motive && (
          <div>
            <div className="violence-section-header">Motive</div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--violence-text-secondary)' }}>
              {event.motive}
            </p>
          </div>
        )}

        {/* Location */}
        <div className="pt-4" style={{ borderTop: '1px solid var(--violence-border)' }}>
          <div className="text-xs" style={{ color: 'var(--violence-text-muted)' }}>
            Coordinates: {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1" style={{ borderBottom: '1px solid var(--violence-border)' }}>
      <span style={{ color: 'var(--violence-text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--violence-text-primary)' }}>{value}</span>
    </div>
  );
}
