import { Link } from 'react-router-dom';
import { ELITE_CATEGORIES } from '../../config/elitesCategories';
import { usePageTitle } from '../../hooks/usePageTitle';

export function ElitesAbout() {
  usePageTitle('About Congressional Rhetoric');
  return (
    <div>
      <div className="mb-8">
        <Link
          to="/elites"
          className="inline-flex items-center gap-2 mb-4 text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
        <h1 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1.5rem' }}>
          About Congressional Rhetoric Analysis
        </h1>
      </div>

      {/* Overview */}
      <div
        className="p-6 rounded-xl mb-6"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      >
        <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>
          Overview
        </h2>
        <p className="mb-4" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          Our congressional rhetoric analysis project tracks how U.S. legislators communicate with
          the public across multiple channels. We collect and analyze statements from floor speeches,
          newsletters, press releases, and social media (X/Twitter) to understand patterns in
          political communication.
        </p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          Using advanced natural language processing and machine learning, we classify each statement
          into one of five rhetorical categories, allowing researchers and the public to track how
          political rhetoric has evolved over time and varies across parties, chambers, and individual legislators.
        </p>
      </div>

      {/* Data Sources */}
      <div
        className="p-6 rounded-xl mb-6"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      >
        <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>
          Data Sources
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              title: 'Floor Speeches',
              description: 'Speeches delivered on the floor of the House and Senate, sourced from the Congressional Record.',
            },
            {
              title: 'Newsletters',
              description: 'Email newsletters sent by legislators to their constituents.',
            },
            {
              title: 'Press Releases',
              description: 'Official press releases published on legislator websites.',
            },
            {
              title: 'Social Media',
              description: 'Posts from legislators\' official X (Twitter) accounts.',
            },
          ].map((source, index) => (
            <div
              key={index}
              className="p-4 rounded-lg"
              style={{ background: 'var(--bg-secondary)' }}
            >
              <h3 className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                {source.title}
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {source.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Classification Categories */}
      <div
        className="p-6 rounded-xl mb-6"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      >
        <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>
          Classification Categories
        </h2>
        <p className="mb-4" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          Our AI model classifies each statement into one of five rhetorical categories:
        </p>
        <div className="space-y-4">
          {Object.entries(ELITE_CATEGORIES).map(([key, category]) => (
            <div
              key={key}
              className="p-4 rounded-lg"
              style={{ background: 'var(--bg-secondary)', borderLeft: `4px solid ${category.color}` }}
            >
              <h3 className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                {category.label}
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {category.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Methodology */}
      <div
        className="p-6 rounded-xl mb-6"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      >
        <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>
          Methodology
        </h2>
        <div className="space-y-4" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          <p>
            <strong style={{ color: 'var(--text-primary)' }}>Data Collection:</strong> We continuously
            collect statements from all current members of Congress using automated scraping of official
            sources. Our collection goes back to 2017, with the most complete coverage from 2020 onwards.
          </p>
          <p>
            <strong style={{ color: 'var(--text-primary)' }}>Classification Model:</strong> We use a
            fine-tuned transformer model trained on expert-labeled examples of congressional rhetoric.
            The model achieves 85%+ accuracy on held-out test data across all five categories.
          </p>
          <p>
            <strong style={{ color: 'var(--text-primary)' }}>Aggregation:</strong> For each legislator,
            we calculate the percentage of their statements falling into each category. These percentages
            are updated weekly as new statements are collected and classified.
          </p>
          <p>
            <strong style={{ color: 'var(--text-primary)' }}>Geographic Aggregation:</strong> State-level
            statistics are calculated by averaging the category percentages of all legislators representing
            that state, weighted by the number of statements each legislator has made.
          </p>
        </div>
      </div>

      {/* Limitations */}
      <div
        className="p-6 rounded-xl mb-6"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      >
        <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>
          Limitations
        </h2>
        <ul className="list-disc list-inside space-y-2" style={{ color: 'var(--text-secondary)' }}>
          <li>
            Classification accuracy varies by category, with some categories (like policy discussion)
            being more reliably identified than others.
          </li>
          <li>
            Social media coverage may be incomplete for legislators who have restricted or deleted accounts.
          </li>
          <li>
            State legislator data is less comprehensive than federal legislator data due to the
            decentralized nature of state legislative records.
          </li>
          <li>
            The model may exhibit biases present in the training data, which was labeled by a small
            team of expert coders.
          </li>
        </ul>
      </div>

      {/* Contact */}
      <div
        className="p-6 rounded-xl"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      >
        <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>
          Contact & Questions
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          For questions about the data, methodology, or to report issues, please contact us at{' '}
          <a href="mailto:contact@americaspoliticalpulse.com" style={{ color: '#2563eb' }}>
            contact@americaspoliticalpulse.com
          </a>.
        </p>
      </div>
    </div>
  );
}
