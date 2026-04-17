import { Tabs, TabPanel } from '../Tabs';
import { EChartsLineChart } from '../Charts/EChartsLineChart';
import { PartyBarChart } from '../Charts/PartyBarChart';
import { useInternationalCountryData } from '../../hooks/useInternationalCountryData';
import { INTERNATIONAL_QUESTIONS, TAB_KEY_TO_COUNTRY } from '../../config/internationalQuestions';
import type { CountryQuestionConfig } from '../../config/internationalQuestions';

interface CountryQuestionsPanelProps {
  countryTabKey: string;
}

export function CountryQuestionsPanel({ countryTabKey }: CountryQuestionsPanelProps) {
  const countryName = TAB_KEY_TO_COUNTRY[countryTabKey];
  const countryConfig: CountryQuestionConfig | undefined = countryName ? INTERNATIONAL_QUESTIONS[countryName] : undefined;
  const { data, loading, notAvailable } = useInternationalCountryData(countryConfig?.code || null);

  if (!countryConfig) {
    return (
      <div className="p-6 text-center" style={{ color: 'var(--text-secondary)' }}>
        Country configuration not found.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Check if we have any data available
  const hasViolenceData = Object.keys(data.violence).length > 0;
  const hasNormsData = Object.keys(data.norms).length > 0;
  const hasPartyData = data.parties.length > 0;

  return (
    <div className="space-y-8">
      {/* Violence Section */}
      <section>
        <h3 className="font-bold mb-3" style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>
          Support for Political Violence in {countryConfig.name}
        </h3>
        <p className="mb-4" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          We assess support for partisan-motivated unlawful actions specific to {countryConfig.name}'s political context.
        </p>

        <Tabs tabs={countryConfig.violenceQuestions} size="small" urlKey={`${countryTabKey}-violence`}>
          {countryConfig.violenceQuestions.map((question) => (
            <TabPanel key={question.key}>
              {/* Question Box */}
              <div
                className="mb-4 py-2 px-4 flex items-center"
                style={{
                  background: 'var(--bg-tertiary)',
                  borderRadius: '8px',
                  borderLeft: '4px solid #dc2626'
                }}
              >
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
                  <strong>What we ask:</strong> {question.question}
                </p>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Overall Trend Chart */}
                <div className="p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: '16px' }}>
                  {hasViolenceData && data.violence[question.key] ? (
                    <>
                      <h4 className="font-bold mb-3 text-center" style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                        Overall Support
                      </h4>
                      <EChartsLineChart
                        data={{
                          dates: data.violence[question.key].dates,
                          values: data.violence[question.key].values,
                        }}
                        height={280}
                        yAxisName="% Supporting"
                        yAxisMin={0}
                        yAxisMax={100}
                        singleLine
                        singleLineColor={countryConfig.color}
                        singleLineName={`${countryConfig.name}`}
                      />
                    </>
                  ) : (
                    <DataComingSoon notAvailable={notAvailable} />
                  )}
                </div>

                {/* By Party Chart */}
                <div className="p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: '16px' }}>
                  {hasPartyData && data.violenceOverallByParty[question.key] ? (
                    <>
                      <h4 className="font-bold mb-3 text-center" style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                        Support by Party (Overall)
                      </h4>
                      <PartyBarChart
                        parties={data.violenceOverallByParty[question.key].parties}
                        values={data.violenceOverallByParty[question.key].values}
                        partyColors={data.partyColors}
                        height={280}
                        xAxisName="% Supporting"
                        xAxisMax={100}
                        title={`${countryConfig.name}-${question.label}-by-party`}
                      />
                    </>
                  ) : (
                    <DataComingSoon notAvailable={notAvailable} />
                  )}
                </div>
              </div>
            </TabPanel>
          ))}
        </Tabs>
      </section>

      {/* Norms Section */}
      <section>
        <h3 className="font-bold mb-3" style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>
          Support for Democratic Norm Violations in {countryConfig.name}
        </h3>
        <p className="mb-4" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          We track support for actions that threaten democratic norms specific to {countryConfig.name}'s political challenges.
        </p>

        <Tabs tabs={countryConfig.normQuestions} size="small" urlKey={`${countryTabKey}-norm`}>
          {countryConfig.normQuestions.map((question) => (
            <TabPanel key={question.key}>
              {/* Question Box */}
              <div
                className="mb-4 py-2 px-4 flex items-center"
                style={{
                  background: 'var(--bg-tertiary)',
                  borderRadius: '8px',
                  borderLeft: '4px solid #8b5cf6'
                }}
              >
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
                  <strong>What we ask:</strong> {question.question}
                </p>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Overall Trend Chart */}
                <div className="p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: '16px' }}>
                  {hasNormsData && data.norms[question.key] ? (
                    <>
                      <h4 className="font-bold mb-3 text-center" style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                        Overall Agreement
                      </h4>
                      <EChartsLineChart
                        data={{
                          dates: data.norms[question.key].dates,
                          values: data.norms[question.key].values,
                        }}
                        height={280}
                        yAxisName="% Agreeing"
                        yAxisMin={0}
                        yAxisMax={100}
                        singleLine
                        singleLineColor={countryConfig.color}
                        singleLineName={`${countryConfig.name}`}
                      />
                    </>
                  ) : (
                    <DataComingSoon notAvailable={notAvailable} />
                  )}
                </div>

                {/* By Party Chart */}
                <div className="p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: '16px' }}>
                  {hasPartyData && data.normsOverallByParty[question.key] ? (
                    <>
                      <h4 className="font-bold mb-3 text-center" style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                        Agreement by Party (Overall)
                      </h4>
                      <PartyBarChart
                        parties={data.normsOverallByParty[question.key].parties}
                        values={data.normsOverallByParty[question.key].values}
                        partyColors={data.partyColors}
                        height={280}
                        xAxisName="% Agreeing"
                        xAxisMax={100}
                        title={`${countryConfig.name}-${question.label}-by-party`}
                      />
                    </>
                  ) : (
                    <DataComingSoon notAvailable={notAvailable} />
                  )}
                </div>
              </div>
            </TabPanel>
          ))}
        </Tabs>
      </section>
    </div>
  );
}

// Component to show when data is not yet available
function DataComingSoon({ notAvailable }: { notAvailable: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <svg
        className="w-12 h-12 mb-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        style={{ color: 'var(--text-muted)' }}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
      <h4 className="font-bold mb-1" style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
        {notAvailable ? 'Data Coming Soon' : 'No Data'}
      </h4>
      <p className="text-center max-w-xs" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
        {notAvailable
          ? 'Data is being processed.'
          : 'Data not available.'}
      </p>
    </div>
  );
}
