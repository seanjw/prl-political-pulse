import { useStatsContext } from '../../context/StatsContext';

export type StatsVariant = 'home' | 'citizens' | 'elites' | 'global';

interface StatsBarProps {
  variant?: StatsVariant;
}

export function StatsBar({ variant = 'home' }: StatsBarProps) {
  const { stats } = useStatsContext();

  // Define stats configurations for each variant
  const statsConfigs = {
    home: [
      { value: stats.globalRowcount, label: 'Survey Responses' },
      { value: stats.citizensNumWeeks, label: 'Weeks of Data' },
      { value: stats.eliteRowcount, label: 'Elite Data Points' },
      { value: stats.citizensUniquecount, label: 'Unique Respondents' },
      { value: '6', label: 'Countries Tracked' },
    ],
    citizens: [
      { value: stats.citizensRowcount, label: 'Survey Responses' },
      { value: stats.citizensNumWeeks, label: 'Weeks of Data' },
      { value: stats.citizensUniquecount, label: 'Unique Respondents' },
      { value: 'Sep 2022', label: 'Ongoing Since' },
    ],
    elites: [
      { value: stats.eliteRowcount, label: 'Data Points' },
      { value: '2014', label: 'Data Starting' },
      { value: '535', label: 'Members of Congress' },
      { value: '7.6K', label: 'State Officials' },
    ],
    global: [
      { value: stats.globalRowcount, label: 'Survey Responses' },
      { value: stats.globalNumWeeks, label: 'Survey Rounds' },
      { value: '6', label: 'Countries Tracked' },
      { value: '2B', label: 'Citizens' },
    ],
  };

  const currentStats = statsConfigs[variant];

  return (
    <div className="border-b" style={{ borderColor: '#444444', background: '#2d2d2d' }}>
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3 md:py-4">
        <div
          className="grid gap-4 md:gap-8"
          style={{
            gridTemplateColumns: `repeat(${Math.min(currentStats.length, 5)}, minmax(0, 1fr))`
          }}
        >
          {currentStats.map((stat, index) => (
            <div key={index} className={index >= 2 ? 'hidden sm:block' : ''}>
              <div className="text-xl md:text-2xl font-light" style={{ color: '#ffffff' }}>
                {stat.value}
              </div>
              <div className="text-[10px] md:text-xs font-medium uppercase tracking-wide" style={{ color: '#a3a3a3' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
