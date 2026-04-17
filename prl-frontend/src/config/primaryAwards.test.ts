import { describe, it, expect } from 'vitest';
import { getAwardConfig, AWARD_CONFIGS } from './primaryAwards';

describe('primaryAwards', () => {
  describe('AWARD_CONFIGS', () => {
    it('has exactly 11 entries', () => {
      expect(AWARD_CONFIGS).toHaveLength(11);
    });

    it('contains entries for all expected category+type combinations', () => {
      const keys = AWARD_CONFIGS.map((c) => `${c.category}:${c.type}`);
      expect(keys).toContain('policy:top');
      expect(keys).toContain('policy:bottom');
      expect(keys).toContain('attack_policy:top');
      expect(keys).toContain('attack_policy:bottom');
      expect(keys).toContain('accomplishments:top');
      expect(keys).toContain('accomplishments:bottom');
      expect(keys).toContain('bipartisanship:top');
      expect(keys).toContain('bipartisanship:bottom');
      expect(keys).toContain('attack_personal:top');
      expect(keys).toContain('attack_personal:bottom');
      expect(keys).toContain('attack_personal:zero_attacks');
    });
  });

  describe('isPositive values', () => {
    it('attack_personal top is NOT positive (negative award)', () => {
      const config = getAwardConfig('attack_personal', 'top');
      expect(config?.isPositive).toBe(false);
    });

    it('attack_personal bottom IS positive (most civil)', () => {
      const config = getAwardConfig('attack_personal', 'bottom');
      expect(config?.isPositive).toBe(true);
    });

    it('attack_personal zero_attacks IS positive', () => {
      const config = getAwardConfig('attack_personal', 'zero_attacks');
      expect(config?.isPositive).toBe(true);
    });

    it('policy top IS positive', () => {
      const config = getAwardConfig('policy', 'top');
      expect(config?.isPositive).toBe(true);
    });

    it('policy bottom is NOT positive', () => {
      const config = getAwardConfig('policy', 'bottom');
      expect(config?.isPositive).toBe(false);
    });

    it('attack_policy top IS positive', () => {
      const config = getAwardConfig('attack_policy', 'top');
      expect(config?.isPositive).toBe(true);
    });

    it('attack_policy bottom is NOT positive', () => {
      const config = getAwardConfig('attack_policy', 'bottom');
      expect(config?.isPositive).toBe(false);
    });

    it('accomplishments top IS positive', () => {
      const config = getAwardConfig('accomplishments', 'top');
      expect(config?.isPositive).toBe(true);
    });

    it('accomplishments bottom is NOT positive', () => {
      const config = getAwardConfig('accomplishments', 'bottom');
      expect(config?.isPositive).toBe(false);
    });

    it('bipartisanship top IS positive', () => {
      const config = getAwardConfig('bipartisanship', 'top');
      expect(config?.isPositive).toBe(true);
    });

    it('bipartisanship bottom is NOT positive', () => {
      const config = getAwardConfig('bipartisanship', 'bottom');
      expect(config?.isPositive).toBe(false);
    });
  });

  describe('getAwardConfig', () => {
    it('returns correct config for policy:top', () => {
      const config = getAwardConfig('policy', 'top');
      expect(config).toBeDefined();
      expect(config?.category).toBe('policy');
      expect(config?.type).toBe('top');
      expect(config?.name).toBe('Policy Discussion Leader');
      expect(config?.isPositive).toBe(true);
    });

    it('returns correct config for policy:bottom', () => {
      const config = getAwardConfig('policy', 'bottom');
      expect(config).toBeDefined();
      expect(config?.category).toBe('policy');
      expect(config?.type).toBe('bottom');
      expect(config?.name).toBe('Least Policy-Focused');
      expect(config?.isPositive).toBe(false);
    });

    it('returns correct config for attack_policy:top', () => {
      const config = getAwardConfig('attack_policy', 'top');
      expect(config).toBeDefined();
      expect(config?.name).toBe('Policy Criticism Leader');
      expect(config?.isPositive).toBe(true);
    });

    it('returns correct config for attack_policy:bottom', () => {
      const config = getAwardConfig('attack_policy', 'bottom');
      expect(config).toBeDefined();
      expect(config?.name).toBe('Least Policy-Critical');
      expect(config?.isPositive).toBe(false);
    });

    it('returns correct config for accomplishments:top', () => {
      const config = getAwardConfig('accomplishments', 'top');
      expect(config).toBeDefined();
      expect(config?.name).toBe('Accomplishments Leader');
      expect(config?.isPositive).toBe(true);
    });

    it('returns correct config for accomplishments:bottom', () => {
      const config = getAwardConfig('accomplishments', 'bottom');
      expect(config).toBeDefined();
      expect(config?.name).toBe('Fewest Accomplishment Claims');
      expect(config?.isPositive).toBe(false);
    });

    it('returns correct config for bipartisanship:top', () => {
      const config = getAwardConfig('bipartisanship', 'top');
      expect(config).toBeDefined();
      expect(config?.name).toBe('Bipartisanship Leader');
      expect(config?.isPositive).toBe(true);
    });

    it('returns correct config for bipartisanship:bottom', () => {
      const config = getAwardConfig('bipartisanship', 'bottom');
      expect(config).toBeDefined();
      expect(config?.name).toBe('Least Bipartisan');
      expect(config?.isPositive).toBe(false);
    });

    it('returns correct config for attack_personal:top', () => {
      const config = getAwardConfig('attack_personal', 'top');
      expect(config).toBeDefined();
      expect(config?.name).toBe('Least Civil Candidate');
      expect(config?.isPositive).toBe(false);
    });

    it('returns correct config for attack_personal:bottom', () => {
      const config = getAwardConfig('attack_personal', 'bottom');
      expect(config).toBeDefined();
      expect(config?.name).toBe('Most Civil Candidate');
      expect(config?.isPositive).toBe(true);
    });

    it('returns correct config for attack_personal:zero_attacks', () => {
      const config = getAwardConfig('attack_personal', 'zero_attacks');
      expect(config).toBeDefined();
      expect(config?.name).toBe('Zero Personal Attacks');
      expect(config?.type).toBe('zero_attacks');
      expect(config?.isPositive).toBe(true);
    });

    it('returns undefined for an invalid category', () => {
      const config = getAwardConfig('nonexistent', 'top');
      expect(config).toBeUndefined();
    });

    it('returns undefined for an invalid type', () => {
      const config = getAwardConfig('policy', 'invalid_type');
      expect(config).toBeUndefined();
    });

    it('returns undefined for empty strings', () => {
      const config = getAwardConfig('', '');
      expect(config).toBeUndefined();
    });

    it('returns undefined for valid category with mismatched type', () => {
      // zero_attacks only exists for attack_personal, not policy
      const config = getAwardConfig('policy', 'zero_attacks');
      expect(config).toBeUndefined();
    });

    it('all returned configs have required fields', () => {
      for (const award of AWARD_CONFIGS) {
        const config = getAwardConfig(award.category, award.type);
        expect(config).toBeDefined();
        expect(typeof config?.name).toBe('string');
        expect(config?.name.length).toBeGreaterThan(0);
        expect(typeof config?.description).toBe('string');
        expect(config?.description.length).toBeGreaterThan(0);
        expect(typeof config?.isPositive).toBe('boolean');
      }
    });
  });
});
