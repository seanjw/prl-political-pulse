import { useEffect, useRef, useCallback, useState } from 'react';
import * as echarts from 'echarts';
import { useInternationalData, COUNTRY_COLORS, getLatestValue } from '../hooks/useInternationalData';
import type { CountryData, CountryTimeSeriesPoint } from '../hooks/useInternationalData';
import { usePageTitle } from '../hooks/usePageTitle';
import { Tabs, TabPanel } from '../components/Tabs';
import { CountryQuestionsPanel } from '../components/International/CountryQuestionsPanel';
import { COUNTRY_TABS } from '../config/internationalQuestions';

interface MultiCountryChartProps {
  countries: CountryData[];
  metric: 'affpol' | 'violenceSupport' | 'normsSupport';
  height?: number;
  yAxisName?: string;
}

function MultiCountryChart({ countries, metric, height = 350, yAxisName }: MultiCountryChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const downloadCSV = useCallback(() => {
    if (!countries || countries.length === 0) return;

    // Get all unique dates
    const allDates = new Set<string>();
    countries.forEach(c => {
      const series = c[metric] as CountryTimeSeriesPoint[];
      series.forEach(p => allDates.add(p.date));
    });
    const dates = Array.from(allDates).sort();

    let csvContent = 'Date,' + countries.map(c => c.name).join(',') + '\n';
    dates.forEach(date => {
      const row = [date];
      countries.forEach(c => {
        const series = c[metric] as CountryTimeSeriesPoint[];
        const point = series.find(p => p.date === date);
        row.push(point ? point.value.toString() : '');
      });
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${metric}-comparison.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    setShowDropdown(false);
  }, [countries, metric]);

  const downloadPNG = useCallback(() => {
    if (!chartInstance.current) return;
    const url = chartInstance.current.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#fff'
    });
    const link = document.createElement('a');
    link.href = url;
    link.download = `${metric}-comparison.png`;
    link.click();
    setShowDropdown(false);
  }, [metric]);

  useEffect(() => {
    if (!chartRef.current || !countries || countries.length === 0) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    // Build series for each country
    const seriesData: echarts.SeriesOption[] = countries.map(country => {
      const series = country[metric] as CountryTimeSeriesPoint[];
      const isUS = country.name === 'United States';

      return {
        name: country.name,
        type: 'line',
        data: series.map(p => {
          // For non-US countries, append '-01' to make valid date
          const dateStr = p.date.length === 7 ? `${p.date}-01` : p.date;
          return [dateStr, p.value];
        }),
        itemStyle: {
          color: COUNTRY_COLORS[country.name] || '#6b7280',
        },
        lineStyle: {
          width: isUS ? 2 : 2,
          type: isUS ? 'dashed' : 'solid',
        },
        showSymbol: false,
        emphasis: { focus: 'series' },
      };
    });

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
      },
      legend: {
        bottom: 0,
        left: 'center',
      },
      grid: {
        containLabel: true,
        top: 20,
        bottom: 50,
        left: '5%',
        right: '5%',
      },
      xAxis: {
        type: 'time',
        min: '2024-01-01',
        axisLabel: {
          hideOverlap: true,
        },
      },
      yAxis: {
        type: 'value',
        name: yAxisName,
        nameLocation: 'middle',
        nameGap: 50,
        nameRotate: 90,
        nameTextStyle: {
          fontSize: 14,
          color: '#333',
        },
      },
      series: seriesData,
    };

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [countries, metric, yAxisName]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setShowDropdown(false);
    if (showDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDropdown]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 10 }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDropdown(!showDropdown);
          }}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            color: 'var(--text-secondary)'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Download
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {showDropdown && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              overflow: 'hidden',
              minWidth: '120px'
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadCSV();
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '13px',
                color: 'var(--text-primary)'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              Data (.csv)
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadPNG();
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '13px',
                color: 'var(--text-primary)'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              Plot (.png)
            </button>
          </div>
        )}
      </div>
      <div ref={chartRef} style={{ width: '100%', height }} />
    </div>
  );
}

export function International() {
  usePageTitle('Global Democracy');
  const { data, loading, error } = useInternationalData();

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-12">
        <div className="text-center text-red-600">
          <p>Error loading data: {error}</p>
        </div>
      </div>
    );
  }

  // Sort countries to put US last (as reference)
  const sortedCountries = [...data.countries].sort((a, b) => {
    if (a.name === 'United States') return 1;
    if (b.name === 'United States') return -1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
      {/* Header Section */}
      <div className="mb-10">
        <h1 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1.5rem' }}>
          Global Context for Partisan Animosity
        </h1>
        <p className="text-lg mb-4" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          We track democratic health across diverse nations, each experiencing varying degrees of backsliding, to discern international patterns and pinpoint shared threats to democratic resilience and stability.
        </p>
        <p className="flex items-center gap-2" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Ongoing since <strong>Feb 2023</strong></span>
        </p>
      </div>

      {/* Country Legend */}
      <div className="mb-8 p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
        <h3 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Countries Surveyed</h3>
        <div className="flex flex-wrap gap-4">
          {sortedCountries.map(country => (
            <div key={country.name} className="flex items-center gap-2">
              <div
                style={{
                  width: '16px',
                  height: '4px',
                  background: COUNTRY_COLORS[country.name] || '#6b7280',
                  borderRadius: '2px',
                  border: country.name === 'United States' ? '1px dashed #666' : 'none',
                }}
              />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {country.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Affective Polarization Section */}
      <section className="mb-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div>
            <h2 className="font-bold mb-3" style={{ color: 'var(--text-primary)', fontSize: '1.25rem' }}>
              Affective Polarization
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
              We ask citizens around the world to rate their own party, as well as the other major parties in their nations.
            </p>
            <p className="mt-3" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
              Here we operationalize affective polarization as the difference between their own party rating, and the average of how they rate competing parties.
            </p>
          </div>
          <div className="lg:col-span-2 p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
            <MultiCountryChart
              countries={sortedCountries}
              metric="affpol"
              yAxisName="Affective Polarization"
              height={350}
            />
          </div>
          {/* Latest values summary - vertical card */}
          <div className="p-4 flex flex-col gap-2" style={{ background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
            <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--text-muted)' }}>Latest Results</h4>
            {(() => {
              const ranked = [...sortedCountries]
                .map(c => ({ ...c, val: getLatestValue(c.affpol) }))
                .sort((a, b) => (b.val || 0) - (a.val || 0));
              const getOrdinal = (n: number) => {
                const s = ['th', 'st', 'nd', 'rd'];
                const v = n % 100;
                return n + (s[(v - 20) % 10] || s[v] || s[0]);
              };
              return ranked.map((country, idx) => (
                <div key={country.name} className="flex items-center justify-between p-2" style={{ background: 'var(--bg-secondary)', borderRadius: '6px', borderLeft: `4px solid ${COUNTRY_COLORS[country.name]}` }}>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{country.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      {country.val?.toFixed(1) || 'N/A'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({getOrdinal(idx + 1)})</span>
                  </span>
                </div>
              ));
            })()}
          </div>
        </div>
      </section>

      <hr style={{ borderColor: 'var(--border)', margin: '2rem 0' }} />

      {/* Political Violence Section */}
      <section className="mb-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div>
            <h2 className="font-bold mb-3" style={{ color: 'var(--text-primary)', fontSize: '1.25rem' }}>
              Political Violence
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
              We assess support for two nonviolent crimes and four violent crimes motivated by partisanship.
            </p>
            <p className="mt-3" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
              The chart shows the average number of violent acts supported by respondents in each country.
            </p>
          </div>
          <div className="lg:col-span-2 p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
            <MultiCountryChart
              countries={sortedCountries}
              metric="violenceSupport"
              yAxisName="Number of Violent Acts Supported"
              height={350}
            />
          </div>
          {/* Latest values summary - vertical card */}
          <div className="p-4 flex flex-col gap-2" style={{ background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
            <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--text-muted)' }}>Latest Results</h4>
            {(() => {
              const ranked = [...sortedCountries]
                .map(c => ({ ...c, val: getLatestValue(c.violenceSupport) }))
                .sort((a, b) => (b.val || 0) - (a.val || 0));
              const getOrdinal = (n: number) => {
                const s = ['th', 'st', 'nd', 'rd'];
                const v = n % 100;
                return n + (s[(v - 20) % 10] || s[v] || s[0]);
              };
              return ranked.map((country, idx) => (
                <div key={country.name} className="flex items-center justify-between p-2" style={{ background: 'var(--bg-secondary)', borderRadius: '6px', borderLeft: `4px solid ${COUNTRY_COLORS[country.name]}` }}>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{country.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      {country.val?.toFixed(1) || 'N/A'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({getOrdinal(idx + 1)})</span>
                  </span>
                </div>
              ));
            })()}
          </div>
        </div>
      </section>

      <hr style={{ borderColor: 'var(--border)', margin: '2rem 0' }} />

      {/* Democratic Norms Section */}
      <section className="mb-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div>
            <h2 className="font-bold mb-3" style={{ color: 'var(--text-primary)', fontSize: '1.25rem' }}>
              Support for Democratic Norm Violations
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
              In consultation with experts from each nation, we identified the most significant threats to their respective democracies and measured public support for each of these challenges.
            </p>
            <p className="mt-3" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
              The chart shows the average number of norm violations supported by respondents.
            </p>
          </div>
          <div className="lg:col-span-2 p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
            <MultiCountryChart
              countries={sortedCountries}
              metric="normsSupport"
              yAxisName="Number of Norm Violations Supported"
              height={350}
            />
          </div>
          {/* Latest values summary - vertical card */}
          <div className="p-4 flex flex-col gap-2" style={{ background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
            <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--text-muted)' }}>Latest Results</h4>
            {(() => {
              const ranked = [...sortedCountries]
                .map(c => ({ ...c, val: getLatestValue(c.normsSupport) }))
                .sort((a, b) => (b.val || 0) - (a.val || 0));
              const getOrdinal = (n: number) => {
                const s = ['th', 'st', 'nd', 'rd'];
                const v = n % 100;
                return n + (s[(v - 20) % 10] || s[v] || s[0]);
              };
              return ranked.map((country, idx) => (
                <div key={country.name} className="flex items-center justify-between p-2" style={{ background: 'var(--bg-secondary)', borderRadius: '6px', borderLeft: `4px solid ${COUNTRY_COLORS[country.name]}` }}>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{country.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      {country.val?.toFixed(1) || 'N/A'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({getOrdinal(idx + 1)})</span>
                  </span>
                </div>
              ));
            })()}
          </div>
        </div>
      </section>

      <hr style={{ borderColor: 'var(--border)', margin: '3rem 0' }} />

      {/* Country-Specific Questions Section */}
      <section className="mb-12">
        <div className="mb-8">
          <h2 className="font-bold mb-3" style={{ color: 'var(--text-primary)', fontSize: '1.25rem' }}>
            Country-Specific Survey Questions
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
            Each country faces unique democratic challenges. In consultation with local experts, we developed country-specific questions to measure support for political violence and democratic norm violations relevant to each nation's political context.
          </p>
        </div>

        <Tabs tabs={COUNTRY_TABS} urlKey="country">
          {COUNTRY_TABS.map(tab => (
            <TabPanel key={tab.key}>
              <CountryQuestionsPanel countryTabKey={tab.key} />
            </TabPanel>
          ))}
        </Tabs>
      </section>
    </div>
  );
}
