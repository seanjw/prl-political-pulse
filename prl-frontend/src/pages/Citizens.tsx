import { useCitizensData } from '../hooks/useCitizensData';
import { GaugeChart } from '../components/Charts/GaugeChart';
import { EChartsLineChart } from '../components/Charts/EChartsLineChart';
import { USChoroplethChart } from '../components/Charts/USChoroplethChart';
import { Tabs, TabPanel } from '../components/Tabs';
import { usePageTitle } from '../hooks/usePageTitle';

const VIOLENCE_TYPES = [
  { key: 'violence1', label: 'Protesting without a Permit', color: '#dc2626', question: 'A person was convicted of protesting without a permit. He was arrested by police after leading a protest against your party on the grounds of the county courthouse.' },
  { key: 'violence2', label: 'Vandalism', color: '#dc2626', question: 'A person was convicted of vandalism. He was arrested by police after he vandalized several large signs expressing support for candidates of the other party.' },
  { key: 'violence3', label: 'Assault', color: '#dc2626', question: 'A person was convicted of assault. He was arrested by police for throwing rocks at peaceful protesters from the other party.' },
  { key: 'violence4', label: 'Arson', color: '#dc2626', question: 'A person was convicted of arson. He was arrested by police as he attempted to run from a fire he started at the local opposing party headquarters.' },
  { key: 'violence5', label: 'Use of Deadly Weapon', color: '#dc2626', question: 'A person was convicted of assault with a deadly weapon. He was arrested by police after driving his car into a crowd of protesters from the other party.' },
  { key: 'violence6', label: 'Murder', color: '#dc2626', question: 'A person was convicted of murder. He was arrested by police after surveillance footage showed him stabbing a prominent member of the other party to death.' },
];

const NORM_TYPES = [
  { key: 'norm_judges', label: 'Ignoring Court Decisions', color: '#8b5cf6', question: 'Do you agree: Your party\'s elected officials should sometimes consider ignoring court decisions when the judges were appointed by a president from the other party.' },
  { key: 'norm_polling', label: 'Reducing Polling Stations', color: '#8b5cf6', question: 'Do you agree: Your party should reduce the number of polling stations in areas that typically support the other party.' },
  { key: 'norm_executive', label: 'Use of Executive Orders', color: '#8b5cf6', question: 'Do you agree: If your party\'s president can\'t get cooperation from congress, they should issue executive orders on their own.' },
  { key: 'norm_censorship', label: 'Media Censorship', color: '#8b5cf6', question: 'Do you agree: The government should be able to censor media sources that spend more time attacking your party than the other party.' },
  { key: 'norm_loyalty', label: 'Party Loyalty', color: '#8b5cf6', question: 'Do you agree: When your party\'s candidate questions an election outcome, other members should be more loyal to your party than to election rules.' },
];

const MAIN_TABS = [
  { key: 'affpol', label: 'Partisan Hatred', color: '#2563eb' },
  { key: 'violence', label: 'Political Violence', color: '#dc2626' },
  { key: 'norms', label: 'Democratic Norms', color: '#8b5cf6' },
];

export function Citizens() {
  usePageTitle('American Views on Democracy');
  const { data, loading, error } = useCitizensData();

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

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row gap-6 mb-12 items-stretch">
        {/* Intro Sidebar */}
        <div className="lg:w-[320px] flex-shrink-0" style={{ background: 'var(--bg-tertiary)', borderRadius: '16px', padding: '1.5rem' }}>
          <h2 className="font-bold mb-3" style={{ color: 'var(--text-primary)', fontSize: '1.25rem' }}>
            Trends in American Partisan Conflict
          </h2>
          <p className="mb-4" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
            Each month, we ask a thousand Americans a series of questions designed to shed light on partisan hatred, respect for democracy, and support for political violence.
          </p>
        </div>

        {/* Key Findings Gauges */}
        <div className="flex-1">
          <h1 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1.5rem' }}>Changes from last month</h1>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="p-4 flex-1" style={{ background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <GaugeChart
                value={data.introGauges?.affpol?.val || 0}
                label="hate the other side"
                change={data.introGauges?.affpol?.val_change}
                color="#2563eb"
                size="large"
                invertChangeColor
                horizontal
              />
            </div>
            <div className="p-4 flex-1" style={{ background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <GaugeChart
                value={data.introGauges?.violence?.val || 0}
                label="support partisan violence"
                change={data.introGauges?.violence?.val_change}
                color="#dc2626"
                size="large"
                invertChangeColor
                horizontal
              />
            </div>
            <div className="p-4 flex-1" style={{ background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <GaugeChart
                value={data.introGauges?.norms?.val || 0}
                label="support at least one norm violation"
                change={data.introGauges?.norms?.val_change}
                color="#8b5cf6"
                size="large"
                invertChangeColor
                horizontal
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs tabs={MAIN_TABS} urlKey="section">
        {/* Partisan Hatred Tab */}
        <TabPanel>
          <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1.25rem' }}>Partisan Hatred</h2>
          <p className="mb-6" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
            Affective polarization is when people from different political parties strongly dislike and distrust each other—not just because they disagree on issues, but because they feel anger, resentment, or suspicion toward the other side as people.
          </p>
          <div className="mb-6 py-2 px-4 flex items-center" style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', borderLeft: '4px solid #2563eb' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
              <strong>What we ask:</strong> For example: "How would you rate your feeling towards Democrats? Zero means very unfavorable and 100 means very favorable. Fifty means you do not feel favorable or unfavorable."
            </p>
          </div>

          {/* Progress bars for party feelings */}
          {data.affpol.demThermOvertime && data.affpol.repThermOvertime && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <h4 className="font-bold mb-3" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>Democratic Assessments</h4>
                <div className="mb-3">
                  <p className="mb-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Towards Democrats: <strong>{data.affpol.demThermOvertime.dems[data.affpol.demThermOvertime.dems.length - 1].toFixed(1)}</strong>
                  </p>
                  <div style={{ background: 'var(--border)', borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
                    <div
                      style={{
                        background: '#1874CD',
                        height: '100%',
                        width: `${data.affpol.demThermOvertime.dems[data.affpol.demThermOvertime.dems.length - 1]}%`,
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Towards Republicans: <strong>{data.affpol.repThermOvertime.dems[data.affpol.repThermOvertime.dems.length - 1].toFixed(1)}</strong>
                  </p>
                  <div style={{ background: 'var(--border)', borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
                    <div
                      style={{
                        background: '#CD2626',
                        height: '100%',
                        width: `${data.affpol.repThermOvertime.dems[data.affpol.repThermOvertime.dems.length - 1]}%`,
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <h4 className="font-bold mb-3" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>Republican Assessments</h4>
                <div className="mb-3">
                  <p className="mb-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Towards Republicans: <strong>{data.affpol.repThermOvertime.reps[data.affpol.repThermOvertime.reps.length - 1].toFixed(1)}</strong>
                  </p>
                  <div style={{ background: 'var(--border)', borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
                    <div
                      style={{
                        background: '#CD2626',
                        height: '100%',
                        width: `${data.affpol.repThermOvertime.reps[data.affpol.repThermOvertime.reps.length - 1]}%`,
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Towards Democrats: <strong>{data.affpol.demThermOvertime.reps[data.affpol.demThermOvertime.reps.length - 1].toFixed(1)}</strong>
                  </p>
                  <div style={{ background: 'var(--border)', borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
                    <div
                      style={{
                        background: '#1874CD',
                        height: '100%',
                        width: `${data.affpol.demThermOvertime.reps[data.affpol.demThermOvertime.reps.length - 1]}%`,
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6" style={{ background: 'var(--bg-tertiary)', borderRadius: '16px' }}>
              <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>How Democrats Assess the Parties</h3>
              {data.affpol.demThermOvertime && data.affpol.repThermOvertime && (
                <EChartsLineChart
                  data={{
                    dates: data.affpol.demThermOvertime.dates,
                    dems: data.affpol.demThermOvertime.dems,
                    reps: data.affpol.repThermOvertime.dems
                  }}
                  height={250}
                  yAxisName="Feeling (0-100)"
                />
              )}
              <h3 className="font-bold mb-4 mt-6" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>How Republicans Assess the Parties</h3>
              {data.affpol.demThermOvertime && data.affpol.repThermOvertime && (
                <EChartsLineChart
                  data={{
                    dates: data.affpol.repThermOvertime.dates,
                    dems: data.affpol.demThermOvertime.reps,
                    reps: data.affpol.repThermOvertime.reps
                  }}
                  height={250}
                  yAxisName="Feeling (0-100)"
                />
              )}
            </div>

            <div className="p-6" style={{ background: 'var(--bg-tertiary)', borderRadius: '16px' }}>
              <h3 className="font-bold mb-4 text-center" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>Partisan Hatred Across the US</h3>
              {data.affpol.byState && data.affpol.byState.length > 0 && (
                <USChoroplethChart
                  data={data.affpol.byState}
                  height={400}
                  tooltipTitle="Avg Level of Polarization"
                />
              )}
            </div>
          </div>
        </TabPanel>

        {/* Political Violence Tab */}
        <TabPanel>
          <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1.25rem' }}>Support for Political Violence</h2>
          <p className="mb-6" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
            We track Americans' stated support for a small set of unlawful political actions, including two nonviolent crimes and four violent crimes motivated by partisanship. Overall support is low—but it is not zero, and even small minorities can matter for public safety, democratic stability, and the tone of political life. Tracking these views over time helps distinguish durable attitudes from short-term reactions to events, identify which actions draw the most approval, and detect early warning signs of normalization or escalation.
          </p>

          {/* Violence Sub-Tabs */}
          <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>Support by Type of Crime</h3>
          <Tabs tabs={VIOLENCE_TYPES} size="small" urlKey="crime">
            {VIOLENCE_TYPES.map((type) => (
              <TabPanel key={type.key}>
                <div className="mb-4 py-2 px-4 flex items-center" style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', borderLeft: '4px solid #dc2626' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
                    <strong>What we ask:</strong> {type.question}
                  </p>
                </div>

                {/* Progress bars */}
                {data.violence.supportByParty && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                      <p className="mb-2" style={{ color: 'var(--text-primary)' }}>
                        <strong>Percent of Democrats who support:</strong> {data.violence.supportByParty.dems[type.key]}%
                      </p>
                      <div style={{ background: 'var(--border)', borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
                        <div
                          style={{
                            background: '#1874CD',
                            height: '100%',
                            width: `${data.violence.supportByParty.dems[type.key]}%`,
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </div>
                    </div>
                    <div className="p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                      <p className="mb-2" style={{ color: 'var(--text-primary)' }}>
                        <strong>Percent of Republicans who support:</strong> {data.violence.supportByParty.reps[type.key]}%
                      </p>
                      <div style={{ background: 'var(--border)', borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
                        <div
                          style={{
                            background: '#CD2626',
                            height: '100%',
                            width: `${data.violence.supportByParty.reps[type.key]}%`,
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="p-6" style={{ background: 'var(--bg-tertiary)', borderRadius: '16px' }}>
                    <h3 className="font-bold mb-4 text-center" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>Support by Party Over Time</h3>
                    {(() => {
                      const timeData = data.violence.supportByPartyOverTime[type.key];
                      return timeData ? (
                        <EChartsLineChart
                          data={{
                            dates: timeData.dates,
                            dems: timeData.dem,
                            reps: timeData.rep,
                          }}
                          height={300}
                          yAxisName="% Supporting"
                          yAxisMin={0}
                          yAxisMax={50}
                        />
                      ) : null;
                    })()}
                  </div>

                  <div className="p-6" style={{ background: 'var(--bg-tertiary)', borderRadius: '16px' }}>
                    <h3 className="font-bold mb-4 text-center" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>Support by State: {type.label}</h3>
                    {(() => {
                      const stateData = data.violence.countByStatePerType[type.key];
                      return stateData && stateData.length > 0 ? (
                        <USChoroplethChart
                          data={stateData}
                          height={300}
                          tooltipTitle="% Supporting"
                        />
                      ) : null;
                    })()}
                  </div>
                </div>
              </TabPanel>
            ))}
          </Tabs>
        </TabPanel>

        {/* Democratic Norms Tab */}
        <TabPanel>
          <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1.25rem' }}>Support for Democratic Norm Violations</h2>
          <p className="mb-6" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
            Respondents evaluate a series of actions that violate core democratic norms. For each action, we ask whether they support or oppose it. Overall support tends to be low, but it is not zero, and small shifts can signal growing tolerance for norm-breaking. Tracking these views over time helps identify which norms are most vulnerable, whether acceptance is spreading, and when new events may be eroding expectations about democratic restraint.
          </p>

          {/* Norms Sub-Tabs */}
          <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>Support by Type of Norm Violation</h3>
          <Tabs tabs={NORM_TYPES} size="small" urlKey="norm">
            {NORM_TYPES.map((type) => (
              <TabPanel key={type.key}>
                <div className="mb-4 py-2 px-4 flex items-center" style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', borderLeft: '4px solid #8b5cf6' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
                    <strong>What we ask:</strong> {type.question}
                  </p>
                </div>

                {/* Progress bars */}
                {data.norms.supportByParty && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                      <p className="mb-2" style={{ color: 'var(--text-primary)' }}>
                        <strong>Percent of Democrats who agree:</strong> {data.norms.supportByParty.dems[type.key]}%
                      </p>
                      <div style={{ background: 'var(--border)', borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
                        <div
                          style={{
                            background: '#1874CD',
                            height: '100%',
                            width: `${data.norms.supportByParty.dems[type.key]}%`,
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </div>
                    </div>
                    <div className="p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                      <p className="mb-2" style={{ color: 'var(--text-primary)' }}>
                        <strong>Percent of Republicans who agree:</strong> {data.norms.supportByParty.reps[type.key]}%
                      </p>
                      <div style={{ background: 'var(--border)', borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
                        <div
                          style={{
                            background: '#CD2626',
                            height: '100%',
                            width: `${data.norms.supportByParty.reps[type.key]}%`,
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="p-6" style={{ background: 'var(--bg-tertiary)', borderRadius: '16px' }}>
                    <h3 className="font-bold mb-4 text-center" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>Endorsement by Party Over Time</h3>
                    {(() => {
                      const timeData = data.norms.supportByPartyOverTime[type.key];
                      return timeData ? (
                        <EChartsLineChart
                          data={{
                            dates: timeData.dates,
                            dems: timeData.dem,
                            reps: timeData.rep,
                          }}
                          height={300}
                          yAxisName="% Endorsing"
                          yAxisMin={0}
                          yAxisMax={60}
                        />
                      ) : null;
                    })()}
                  </div>

                  <div className="p-6" style={{ background: 'var(--bg-tertiary)', borderRadius: '16px' }}>
                    <h3 className="font-bold mb-4 text-center" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>Support by State: {type.label}</h3>
                    {(() => {
                      const stateData = data.norms.byStatePerType[type.key];
                      return stateData && stateData.length > 0 ? (
                        <USChoroplethChart
                          data={stateData}
                          height={300}
                          tooltipTitle="% Supporting"
                        />
                      ) : null;
                    })()}
                  </div>
                </div>
              </TabPanel>
            ))}
          </Tabs>
        </TabPanel>
      </Tabs>
    </div>
  );
}
