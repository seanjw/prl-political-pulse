import { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';

// Question metadata
export interface QuestionMeta {
  label: string;
  question: string;
  options: { [key: string]: string };
  grid?: boolean;
  subcomponents?: { [key: string]: string };
}

export const QUESTION_META: { [key: string]: QuestionMeta } = {
  CPA1: {
    label: 'Avoiding Help Due to Politics',
    question: 'Have you ever avoided asking for help at work because you thought the person might disagree with your political views?',
    options: { '1': 'Never', '2': 'Rarely', '3': 'Sometimes', '4': 'Often', '5': 'Always' }
  },
  CPA2: {
    label: 'Political Disagreement & Job Satisfaction',
    question: 'To what extent does political disagreement at work affect your job satisfaction?',
    options: { '1': 'Not at all', '2': 'A little', '3': 'Somewhat', '4': 'Quite a bit', '5': 'A great deal' }
  },
  CPA3: {
    label: 'Public Statements from the Private Sector',
    question: 'Do you agree or disagree: Companies should take public positions on social issues.',
    options: { '1': 'Strongly agree', '2': 'Agree', '3': 'Neither agree nor disagree', '4': 'Disagree', '5': 'Strongly disagree' }
  },
  CPA4: {
    label: 'Public Statements By Issue',
    question: 'Do you think businesses should or should not take a public stance on these topics?',
    options: { '1': 'Yes', '2': 'No', '3': "Don't know" },
    grid: true,
    subcomponents: {
      'CPA4_a': 'Climate change',
      'CPA4_b': 'Mental health',
      'CPA4_c': 'Racial issues',
      'CPA4_d': 'Gun laws',
      'CPA4_e': 'LGBTQ+ issues',
      'CPA4_f': 'Immigration policy',
      'CPA4_g': 'International conflicts',
      'CPA4_h': 'Abortion',
      'CPA4_i': 'Political candidates'
    }
  },
  CPA5: {
    label: 'Business Impact on Society',
    question: 'Which of the following best describes the impact businesses have on people\'s lives?',
    options: { '1': 'Extremely positive', '2': 'Positive', '3': 'Neither positive nor negative', '4': 'Negative', '5': 'Extremely negative' }
  },
  CPA6: {
    label: 'Job Consideration Factors',
    question: 'When considering a new job, how important would each of the following factors be in deciding which company or workplace to apply to?',
    options: { '1': 'Very unimportant', '2': 'Unimportant', '3': 'Neither important nor unimportant', '4': 'Important', '5': 'Very important' },
    grid: true,
    subcomponents: {
      'CPA6_a': 'Fair wages',
      'CPA6_b': 'Healthcare benefits',
      'CPA6_c': 'Close to home',
      'CPA6_d': 'Promotion opportunities',
      'CPA6_e': 'Remote work options',
      'CPA6_f': 'DEI commitment'
    }
  },
  immigration1: {
    label: 'Immigration: Good or Bad?',
    question: 'On the whole, do you think immigration is a good thing or a bad thing for America today?',
    options: { '1': 'Good thing', '2': 'Bad thing', '3': "Don't know" }
  },
  immigration2: {
    label: 'Support for Deportation of Undocumented Immigrants',
    question: 'Do you agree or disagree: immigrants currently living in the United States illegally should be deported.',
    options: { '1': 'Strongly agree', '2': 'Somewhat agree', '3': 'Neither agree nor disagree', '4': 'Somewhat disagree', '5': 'Strongly disagree' }
  },
  immigration3: {
    label: 'Support for Amnesty for Undocumented Immigrants',
    question: 'Do you agree or disagree: undocumented immigrants currently living in the United States should be granted amnesty.',
    options: { '1': 'Strongly agree', '2': 'Somewhat agree', '3': 'Neither agree nor disagree', '4': 'Somewhat disagree', '5': 'Strongly disagree' }
  },
  economy1: {
    label: 'Economic Expectations (Next 6 Months)',
    question: 'How do you expect the economy to perform in the next 6 months?',
    options: { '1': 'Very good', '2': 'Somewhat good', '3': 'Neither good nor bad', '4': 'Somewhat bad', '5': 'Very bad' }
  },
  economy2: {
    label: 'Economic Performance (Past 6 Months)',
    question: 'How do you think the economy performed in the previous 6 months?',
    options: { '1': 'Very good', '2': 'Somewhat good', '3': 'Neither good nor bad', '4': 'Somewhat bad', '5': 'Very bad' }
  },
  tariffs1: {
    label: 'Manufacturing Jobs in America',
    question: 'Do you agree or disagree: America would be better off if more Americans worked in manufacturing than they do today.',
    options: { '1': 'Strongly agree', '2': 'Somewhat agree', '3': 'Neither agree nor disagree', '4': 'Somewhat disagree', '5': 'Strongly disagree' }
  },
  tariffs2a: {
    label: 'Support for New Tariffs',
    question: 'Would you support or oppose the US government putting new tariffs on things made in other countries?',
    options: { '1': 'Strongly support', '2': 'Somewhat support', '3': 'Neither support nor oppose', '4': 'Somewhat oppose', '5': 'Strongly oppose' }
  },
  tariffs2b: {
    label: 'Tariffs & Price Increases',
    question: 'Would you support or oppose the US government putting new tariffs on things made in other countries even if it increased the price of things you buy at the store?',
    options: { '1': 'Strongly support', '2': 'Somewhat support', '3': 'Neither support nor oppose', '4': 'Somewhat oppose', '5': 'Strongly oppose' }
  },
  tariffs3: {
    label: 'Effects of Free Trade Agreements',
    question: "Do you think free trade agreements with other countries generally increase or decrease each of the following, or don't make much difference either way?",
    options: { '1': 'Increase', '2': 'Decrease', '3': 'No difference' },
    grid: true,
    subcomponents: {
      'tariffs3_a': 'Product variety',
      'tariffs3_b': 'Prices',
      'tariffs3_c': 'Number of jobs',
      'tariffs3_d': 'Wages'
    }
  },
  freespeech: {
    label: 'Security of Free Speech in America',
    question: 'How secure do you think the right to freedom of speech is in America today?',
    options: { '1': 'Not at all secure', '2': 'Somewhat secure', '3': 'Very secure', '4': 'Completely secure' }
  }
};

export const CATEGORIES = {
  corporate: {
    label: 'Politics in the Workplace',
    questions: ['CPA1', 'CPA2', 'CPA3', 'CPA4', 'CPA5', 'CPA6'],
    description: 'This section explores how politics influences workplace dynamics, including job satisfaction, company policies, and employee considerations when choosing a job.'
  },
  immigration: {
    label: 'Immigration Attitudes',
    questions: ['immigration1', 'immigration2', 'immigration3'],
    description: 'Public opinion on immigration remains a central topic in American politics. This section examines views on immigration\'s impact and policies regarding undocumented immigrants.'
  },
  economy: {
    label: 'The Economy',
    questions: ['economy1', 'economy2'],
    description: 'The economy plays a crucial role in shaping political opinions. This section assesses how people perceive past and future economic performance.'
  },
  tariffs: {
    label: 'Tariffs',
    questions: ['tariffs1', 'tariffs2a', 'tariffs2b', 'tariffs3'],
    description: 'Trade policies, including tariffs and manufacturing jobs, have been contentious political issues. This section evaluates public opinion on government intervention in trade.'
  },
  freespeech: {
    label: 'Free Speech',
    questions: ['freespeech'],
    description: 'This section gauges Americans\' perceptions of free speech protections and whether they believe these rights are at risk.'
  }
};

export interface Distribution {
  [key: string]: number;
}

export interface GroupResults {
  n: number;
  distribution: Distribution;
}

export interface OvertimeData {
  dates: string[];
  response_means?: {
    mean_score: number[];
  };
}

export interface PolicyResults {
  all: GroupResults;
  dems: GroupResults;
  inds: GroupResults;
  reps: GroupResults;
}

export interface PolicyQuestion {
  results: {
    overall: PolicyResults;
    overtime?: {
      all?: { overtime: OvertimeData };
      dems?: { overtime: OvertimeData };
      reps?: { overtime: OvertimeData };
      inds?: { overtime: OvertimeData };
    };
  };
}

export interface PolicyValuesData {
  questions: {
    [key: string]: PolicyQuestion;
  };
}

const defaultData: PolicyValuesData = {
  questions: {},
};

export function usePolicyValues() {
  const [data, setData] = useState<PolicyValuesData>(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`${API_BASE}/data/citizens/policy-values`);
        const json = await response.json();
        const d = json.data;

        const parsed: PolicyValuesData = {
          questions: d,
        };

        setData(parsed);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load policy values:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { data, loading, error };
}

// Helper function to convert distribution counts to percentages
export function distributionToPercentages(
  distribution: Distribution,
  options: { [key: string]: string }
): { categories: string[]; values: number[] } {
  const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);
  const orderedOptions = Object.values(options);
  const categories: string[] = [];
  const values: number[] = [];

  orderedOptions.forEach(optionLabel => {
    categories.push(optionLabel);
    const count = distribution[optionLabel] || 0;
    values.push(total > 0 ? Math.round((count / total) * 1000) / 10 : 0);
  });

  return { categories, values };
}
