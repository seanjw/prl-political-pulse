import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrimaryAwards } from './PrimaryAwards';
import type { PrimaryAward } from '../../../types/primary';

// Helper to render with router context
function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

// Factory for minimal valid PrimaryAward objects
function makeAward(overrides: Partial<PrimaryAward> = {}): PrimaryAward {
  return {
    candidate_id: 'cand-001',
    name: 'Jane Smith',
    party: 'Democrat',
    state: 'CA',
    office: 'H',
    district: '12',
    race_id: 'CA-12-D',
    category: 'policy',
    type: 'top',
    award_name: 'Policy Discussion Leader',
    value: 0.85,
    statement_count: 120,
    ...overrides,
  };
}

describe('PrimaryAwards', () => {
  describe('empty state', () => {
    it('renders "No awards data available" when awards array is empty', () => {
      renderWithRouter(<PrimaryAwards awards={[]} />);
      expect(screen.getByText(/No awards data available/i)).toBeInTheDocument();
    });

    it('does not render category tabs when awards array is empty', () => {
      renderWithRouter(<PrimaryAwards awards={[]} />);
      expect(screen.queryByText('Policy Discussion')).not.toBeInTheDocument();
    });
  });

  describe('category tabs', () => {
    it('renders all five category tabs', () => {
      const awards = [makeAward()];
      renderWithRouter(<PrimaryAwards awards={awards} />);

      expect(screen.getByText('Policy Discussion')).toBeInTheDocument();
      expect(screen.getByText('Policy Criticism')).toBeInTheDocument();
      expect(screen.getByText('Personal Attacks')).toBeInTheDocument();
      expect(screen.getByText('Accomplishments')).toBeInTheDocument();
      expect(screen.getByText('Bipartisanship')).toBeInTheDocument();
    });

    it('clicking a category tab switches the active category', () => {
      const awards = [
        makeAward({ category: 'policy', type: 'top', candidate_id: 'cand-001', name: 'Jane Smith' }),
        makeAward({ category: 'bipartisanship', type: 'top', candidate_id: 'cand-002', name: 'Bob Jones', award_name: 'Bipartisanship Leader' }),
      ];
      renderWithRouter(<PrimaryAwards awards={awards} />);

      // Policy tab is active by default — Jane Smith should be visible
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();

      // Click the Bipartisanship tab
      fireEvent.click(screen.getByText('Bipartisanship'));

      // Now Bob Jones should be visible
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    });

    it('first tab (Policy Discussion) is active on initial render', () => {
      const awards = [makeAward({ category: 'policy', type: 'top' })];
      renderWithRouter(<PrimaryAwards awards={awards} />);

      // The description for policy category should be shown
      expect(screen.getByText('Discussion of political issues without attacking opponents')).toBeInTheDocument();
    });

    it('switching to a tab shows that category description', () => {
      const awards = [makeAward()];
      renderWithRouter(<PrimaryAwards awards={awards} />);

      fireEvent.click(screen.getByText('Bipartisanship'));

      expect(screen.getByText('Collaboration and finding common ground across party lines')).toBeInTheDocument();
    });
  });

  describe('award rows', () => {
    it('renders candidate name in an award row', () => {
      const awards = [makeAward({ name: 'Alice Johnson', category: 'policy', type: 'top' })];
      renderWithRouter(<PrimaryAwards awards={awards} />);
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    it('renders the award badge name', () => {
      const awards = [makeAward({ award_name: 'Policy Discussion Leader' })];
      renderWithRouter(<PrimaryAwards awards={awards} />);
      expect(screen.getByText('Policy Discussion Leader')).toBeInTheDocument();
    });

    it('renders statement count for a candidate', () => {
      const awards = [makeAward({ statement_count: 250 })];
      renderWithRouter(<PrimaryAwards awards={awards} />);
      expect(screen.getByText(/250 statements/i)).toBeInTheDocument();
    });

    it('renders state and district for House candidates', () => {
      const awards = [makeAward({ state: 'TX', office: 'H', district: '7' })];
      renderWithRouter(<PrimaryAwards awards={awards} />);
      expect(screen.getByText(/TX-7/)).toBeInTheDocument();
    });

    it('renders state and Senate label for Senate candidates', () => {
      const awards = [makeAward({ state: 'NY', office: 'S', district: '' })];
      renderWithRouter(<PrimaryAwards awards={awards} />);
      expect(screen.getByText(/NY Senate/)).toBeInTheDocument();
    });

    it('renders the percentage value', () => {
      // value 0.33 -> Math.round(0.33 * 100) = 33 -> "33%"
      const awards = [makeAward({ value: 0.33 })];
      renderWithRouter(<PrimaryAwards awards={awards} />);
      expect(screen.getByText('33%')).toBeInTheDocument();
    });

    it('renders multiple award rows when multiple awards exist in a category', () => {
      const awards = [
        makeAward({ candidate_id: 'cand-001', name: 'Alice', category: 'policy', type: 'top', value: 0.9 }),
        makeAward({ candidate_id: 'cand-002', name: 'Bob', category: 'policy', type: 'top', value: 0.85 }),
      ];
      renderWithRouter(<PrimaryAwards awards={awards} />);
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('shows "No candidates qualify" when a section has no awards', () => {
      // Only top award provided; bottom section should show placeholder
      const awards = [makeAward({ category: 'policy', type: 'top' })];
      renderWithRouter(<PrimaryAwards awards={awards} />);
      // At least one "No candidates qualify" message should appear (for bottom section)
      expect(screen.getAllByText('No candidates qualify').length).toBeGreaterThan(0);
    });
  });

  describe('links', () => {
    it('award row links point to the correct candidate URL', () => {
      const awards = [makeAward({ candidate_id: 'cand-42', category: 'policy', type: 'top' })];
      renderWithRouter(<PrimaryAwards awards={awards} />);

      const link = screen.getByRole('link', { name: /Jane Smith/i });
      expect(link).toHaveAttribute('href', '/primary/candidate/cand-42');
    });

    it('renders separate links for distinct candidates', () => {
      const awards = [
        makeAward({ candidate_id: 'cand-001', name: 'Alice', category: 'policy', type: 'top' }),
        makeAward({ candidate_id: 'cand-002', name: 'Bob', category: 'policy', type: 'bottom' }),
      ];
      renderWithRouter(<PrimaryAwards awards={awards} />);

      const aliceLink = screen.getByRole('link', { name: /Alice/i });
      const bobLink = screen.getByRole('link', { name: /Bob/i });

      expect(aliceLink).toHaveAttribute('href', '/primary/candidate/cand-001');
      expect(bobLink).toHaveAttribute('href', '/primary/candidate/cand-002');
    });
  });

  describe('positive/negative styling', () => {
    it('top section for non-attack_personal category uses green accent color', () => {
      const awards = [makeAward({ category: 'policy', type: 'top', candidate_id: 'cand-top' })];
      renderWithRouter(<PrimaryAwards awards={awards} />);

      // "Top 3%" header should be rendered with green color
      const topHeader = screen.getByText('Top 3%');
      expect(topHeader).toBeInTheDocument();
      // The color is applied inline — verify the element exists in the positive (green) section
      expect(topHeader).toHaveStyle({ color: '#059669' });
    });

    it('bottom section for non-attack_personal category uses red accent color', () => {
      const awards = [makeAward({ category: 'policy', type: 'bottom', candidate_id: 'cand-bot' })];
      renderWithRouter(<PrimaryAwards awards={awards} />);

      const bottomHeader = screen.getByText('Bottom 3%');
      expect(bottomHeader).toBeInTheDocument();
      expect(bottomHeader).toHaveStyle({ color: '#dc2626' });
    });

    it('attack_personal top section uses red accent (most personal attacks is negative)', () => {
      const awards = [
        makeAward({
          category: 'attack_personal',
          type: 'top',
          candidate_id: 'cand-atk',
          award_name: 'Least Civil Candidate',
        }),
      ];
      renderWithRouter(<PrimaryAwards awards={awards} />);

      // Switch to the Personal Attacks tab — section headings are only rendered for the active tab
      fireEvent.click(screen.getByText('Personal Attacks'));

      const header = screen.getByText('Least Civil Candidates (Top 3%)');
      expect(header).toHaveStyle({ color: '#dc2626' });
    });

    it('attack_personal bottom section uses green accent (most civil is positive)', () => {
      const awards = [
        makeAward({
          category: 'attack_personal',
          type: 'bottom',
          candidate_id: 'cand-civil',
          award_name: 'Most Civil Candidate',
        }),
      ];
      renderWithRouter(<PrimaryAwards awards={awards} />);

      // Switch to the Personal Attacks tab first
      fireEvent.click(screen.getByText('Personal Attacks'));

      const header = screen.getByText('Most Civil (Bottom 3%)');
      expect(header).toHaveStyle({ color: '#059669' });
    });
  });

  describe('zero personal attacks section', () => {
    it('does not appear for non-attack_personal tabs', () => {
      const awards = [
        makeAward({
          category: 'attack_personal',
          type: 'zero_attacks',
          candidate_id: 'cand-z',
          award_name: 'Zero Personal Attacks',
        }),
      ];
      renderWithRouter(<PrimaryAwards awards={awards} />);

      // Default tab is Policy Discussion — Zero Personal Attacks section should not be visible
      expect(screen.queryByText('Zero Personal Attacks')).not.toBeInTheDocument();
    });

    it('appears on the attack_personal tab when zero_attacks awards exist', () => {
      const awards = [
        makeAward({
          category: 'attack_personal',
          type: 'zero_attacks',
          candidate_id: 'cand-z',
          name: 'Peaceful Pete',
          award_name: 'Zero Personal Attacks',
          value: 0,
        }),
      ];
      renderWithRouter(<PrimaryAwards awards={awards} />);

      fireEvent.click(screen.getByText('Personal Attacks'));

      // "Zero Personal Attacks" appears in both the section header and the award badge
      const matches = screen.getAllByText('Zero Personal Attacks');
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Peaceful Pete')).toBeInTheDocument();
    });

    it('does not appear on the attack_personal tab when no zero_attacks awards exist', () => {
      const awards = [
        makeAward({
          category: 'attack_personal',
          type: 'top',
          candidate_id: 'cand-atk',
          award_name: 'Least Civil Candidate',
        }),
      ];
      renderWithRouter(<PrimaryAwards awards={awards} />);

      fireEvent.click(screen.getByText('Personal Attacks'));

      expect(screen.queryByText('Zero Personal Attacks')).not.toBeInTheDocument();
    });
  });

  describe('heading and subtitle', () => {
    it('renders the "Candidate Awards" heading when awards exist', () => {
      const awards = [makeAward()];
      renderWithRouter(<PrimaryAwards awards={awards} />);
      expect(screen.getByText('Candidate Awards')).toBeInTheDocument();
    });

    it('renders the subtitle describing the 3% threshold', () => {
      const awards = [makeAward()];
      renderWithRouter(<PrimaryAwards awards={awards} />);
      expect(screen.getByText(/top and bottom 3%/i)).toBeInTheDocument();
    });
  });
});
