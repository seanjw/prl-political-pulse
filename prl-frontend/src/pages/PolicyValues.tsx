import { usePolicyValues, QUESTION_META, CATEGORIES, distributionToPercentages } from '../hooks/usePolicyValues';
import type { QuestionMeta } from '../hooks/usePolicyValues';
import { DistributionBarChart } from '../components/Charts/DistributionBarChart';
import { EChartsLineChart } from '../components/Charts/EChartsLineChart';
import { Tabs, TabPanel } from '../components/Tabs';
import { usePageTitle } from '../hooks/usePageTitle';

const CATEGORY_TABS = [
  { key: 'corporate', label: 'Politics in the Workplace', color: '#2563eb' },
  { key: 'immigration', label: 'Immigration', color: '#dc2626' },
  { key: 'economy', label: 'Economy', color: '#10b981' },
  { key: 'tariffs', label: 'Tariffs', color: '#f59e0b' },
  { key: 'freespeech', label: 'Free Speech', color: '#8b5cf6' },
];

// Build ordinal labels from question options (e.g., {1: 'Not at all', 2: 'A little', ...})
function buildOrdinalLabels(options: { [key: string]: string }): Record<number, string> {
  const labels: Record<number, string> = {};
  Object.entries(options).forEach(([key, value]) => {
    const numKey = parseInt(key, 10);
    if (!isNaN(numKey)) {
      labels[numKey] = value;
    }
  });
  return labels;
}

// Renders a single subcomponent of a grid question
function SubQuestionContent({
  subData,
  meta
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subData: any;
  meta: QuestionMeta;
}) {
  const overall = subData?.overall;
  const overtime = subData?.overtime;

  if (!overall) return null;

  const demsDist = distributionToPercentages(overall.dems?.distribution || {}, meta.options);
  const repsDist = distributionToPercentages(overall.reps?.distribution || {}, meta.options);
  const indsDist = distributionToPercentages(overall.inds?.distribution || {}, meta.options);

  // Get overtime data - handle both ordinal (mean_score) and qualitative questions
  const demsOT = overtime?.dems?.overtime;
  const repsOT = overtime?.reps?.overtime;
  const allOT = overtime?.all?.overtime;

  let overtimeData = null;
  let overtimeLabel = "Mean Score";

  // Check for ordinal data (mean_score)
  if (demsOT?.response_means?.mean_score) {
    overtimeData = {
      dates: allOT?.dates || [],
      dems: demsOT.response_means.mean_score,
      reps: repsOT?.response_means?.mean_score || [],
    };
  }
  // Check for qualitative data - use first option from metadata (e.g., "Yes", "Good thing", "Increase")
  else if (demsOT?.response_means) {
    const firstOption = Object.values(meta.options)[0];
    if (demsOT.response_means[firstOption]) {
      overtimeData = {
        dates: allOT?.dates || [],
        dems: demsOT.response_means[firstOption],
        reps: repsOT?.response_means?.[firstOption] || [],
      };
      overtimeLabel = `% ${firstOption}`;
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
        <h4 className="font-bold mb-3" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>Response Distribution by Party</h4>
        <DistributionBarChart
          data={{
            categories: demsDist.categories,
            dems: demsDist.values,
            reps: repsDist.values,
            inds: indsDist.values,
          }}
          height={280}
        />
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          n = {overall.all?.n?.toLocaleString() || 'N/A'} respondents
        </p>
      </div>

      {overtimeData && overtimeData.dates.length > 0 ? (
        <div className="p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
          <h4 className="font-bold mb-3" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>Response Over Time</h4>
          <EChartsLineChart
            data={{
              dates: overtimeData.dates,
              dems: overtimeData.dems,
              reps: overtimeData.reps,
            }}
            height={280}
            yAxisName={overtimeLabel === "Mean Score" ? undefined : overtimeLabel}
            yAxisLabels={overtimeLabel === "Mean Score" ? buildOrdinalLabels(meta.options) : undefined}
            yAxisMin={overtimeLabel === "Mean Score" ? 1 : 0}
            yAxisMax={overtimeLabel === "Mean Score" ? Object.keys(meta.options).length : 100}
          />
        </div>
      ) : (
        <div className="p-4 flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
          <p style={{ color: 'var(--text-muted)' }}>Time series data not available for this question</p>
        </div>
      )}
    </div>
  );
}

// Renders a grid question with tabs for each subcomponent
function GridQuestionSection({ questionKey, questionData }: { questionKey: string; questionData: unknown }) {
  const meta = QUESTION_META[questionKey];
  if (!meta || !questionData || !meta.grid || !meta.subcomponents) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qData = questionData as any;
  const results = qData.results;

  if (!results) return null;

  // Build tabs from subcomponents
  const subTabs = Object.entries(meta.subcomponents).map(([subKey, label]) => ({
    key: subKey,
    label: label as string,
    color: '#6b7280'
  }));

  // Create a unique URL key for this question's sub-tabs
  const urlKey = questionKey.toLowerCase();

  return (
    <div className="mb-8 pb-8" style={{ borderBottom: '1px solid var(--border)' }}>
      <h3 className="font-bold mb-3" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>
        {meta.label}
      </h3>
      <div className="mb-4 py-2 px-4 flex items-center" style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', borderLeft: '4px solid #2563eb' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
          <strong>What we ask:</strong> {meta.question}
        </p>
      </div>

      <Tabs tabs={subTabs} urlKey={urlKey}>
        {subTabs.map((tab) => (
          <TabPanel key={tab.key}>
            <SubQuestionContent
              subData={results[tab.key]}
              meta={meta}
            />
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
}

// Renders a standard (non-grid) question
function StandardQuestionSection({ questionKey, questionData }: { questionKey: string; questionData: unknown }) {
  const meta = QUESTION_META[questionKey];
  if (!meta || !questionData) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qData = questionData as any;
  const overall = qData.results?.overall;
  const overtime = qData.results?.overtime;

  if (!overall) return null;

  // Get distribution data for each party
  const demsDist = distributionToPercentages(overall.dems?.distribution || {}, meta.options);
  const repsDist = distributionToPercentages(overall.reps?.distribution || {}, meta.options);
  const indsDist = distributionToPercentages(overall.inds?.distribution || {}, meta.options);

  // Get overtime data - handle both ordinal (mean_score) and qualitative questions
  const demsOT = overtime?.dems?.overtime;
  const repsOT = overtime?.reps?.overtime;
  const allOT = overtime?.all?.overtime;

  let overtimeData = null;
  let overtimeLabel = "Mean Score";

  // Check for ordinal data (mean_score)
  if (demsOT?.response_means?.mean_score) {
    overtimeData = {
      dates: allOT?.dates || [],
      dems: demsOT.response_means.mean_score,
      reps: repsOT?.response_means?.mean_score || [],
    };
  }
  // Check for qualitative data - use first option from metadata (e.g., "Yes", "Good thing", "Increase")
  else if (demsOT?.response_means) {
    const firstOption = Object.values(meta.options)[0];
    if (demsOT.response_means[firstOption]) {
      overtimeData = {
        dates: allOT?.dates || [],
        dems: demsOT.response_means[firstOption],
        reps: repsOT?.response_means?.[firstOption] || [],
      };
      overtimeLabel = `% ${firstOption}`;
    }
  }

  return (
    <div className="mb-8 pb-8" style={{ borderBottom: '1px solid var(--border)' }}>
      <h3 className="font-bold mb-3" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>
        {meta.label}
      </h3>
      <div className="mb-4 py-2 px-4 flex items-center" style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', borderLeft: '4px solid #2563eb' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
          <strong>What we ask:</strong> {meta.question}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
          <h4 className="font-bold mb-3" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>Response Distribution by Party</h4>
          <DistributionBarChart
            data={{
              categories: demsDist.categories,
              dems: demsDist.values,
              reps: repsDist.values,
              inds: indsDist.values,
            }}
            height={280}
          />
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            n = {overall.all?.n?.toLocaleString() || 'N/A'} respondents
          </p>
        </div>

        {overtimeData && overtimeData.dates.length > 0 ? (
          <div className="p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
            <h4 className="font-bold mb-3" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>Response Over Time</h4>
            <EChartsLineChart
              data={{
                dates: overtimeData.dates,
                dems: overtimeData.dems,
                reps: overtimeData.reps,
              }}
              height={280}
              yAxisName={overtimeLabel === "Mean Score" ? undefined : overtimeLabel}
              yAxisLabels={overtimeLabel === "Mean Score" ? buildOrdinalLabels(meta.options) : undefined}
              yAxisMin={overtimeLabel === "Mean Score" ? 1 : 0}
              yAxisMax={overtimeLabel === "Mean Score" ? Object.keys(meta.options).length : 100}
            />
          </div>
        ) : (
          <div className="p-4 flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
            <p style={{ color: 'var(--text-muted)' }}>Time series data not available for this question</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Main question section that delegates to grid or standard
function QuestionSection({ questionKey, questionData }: { questionKey: string; questionData: unknown }) {
  const meta = QUESTION_META[questionKey];
  if (!meta || !questionData) return null;

  if (meta.grid) {
    return <GridQuestionSection questionKey={questionKey} questionData={questionData} />;
  }

  return <StandardQuestionSection questionKey={questionKey} questionData={questionData} />;
}

export function PolicyValues() {
  usePageTitle('American Values');
  const { data, loading, error } = usePolicyValues();

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
      <div className="mb-8">
        <h1 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1.5rem' }}>
          American Values
        </h1>
        <p className="text-lg" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          Core American values are essential prerequisites for democracy, yet they face escalating challenges from across the political spectrum. Starting in February 2025, we monitor attitudes toward key values of the American political system.
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs tabs={CATEGORY_TABS} urlKey="topic">
        {CATEGORY_TABS.map((tab) => {
          const category = CATEGORIES[tab.key as keyof typeof CATEGORIES];
          return (
            <TabPanel key={tab.key}>
              <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1.25rem' }}>
                {category.label}
              </h2>
              <p className="mb-6" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                {category.description}
              </p>

              {category.questions.map((qKey) => (
                <QuestionSection
                  key={qKey}
                  questionKey={qKey}
                  questionData={data.questions[qKey]}
                />
              ))}
            </TabPanel>
          );
        })}
      </Tabs>
    </div>
  );
}
