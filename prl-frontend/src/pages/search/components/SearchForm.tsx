import { useState, useCallback, useRef, useEffect } from 'react';
import type { SearchFilters, AutocompleteData } from '../types';
import { fetchAutocompleteData } from '../api';
import { Autocomplete } from './Autocomplete';

interface SearchFormProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onSearch: () => void;
  onClear: () => void;
}

export function SearchForm({ filters, onFiltersChange, onSearch, onClear }: SearchFormProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [updatedFields, setUpdatedFields] = useState<Set<string>>(new Set());
  const [autocompleteData, setAutocompleteData] = useState<AutocompleteData>({
    names: [],
    states: [],
    districts: [],
  });
  const prevFiltersRef = useRef<SearchFilters>(filters);
  const userInputRef = useRef<string | null>(null);

  // Fetch autocomplete data on mount
  useEffect(() => {
    fetchAutocompleteData()
      .then(setAutocompleteData)
      .catch((error) => console.error('Failed to fetch autocomplete data:', error));
  }, []);

  // Track filter changes from external sources (badge clicks)
  useEffect(() => {
    const changedFields: string[] = [];
    const prev = prevFiltersRef.current;

    // Check which fields changed
    (Object.keys(filters) as (keyof SearchFilters)[]).forEach((key) => {
      if (filters[key] !== prev[key] && userInputRef.current !== key) {
        changedFields.push(key);
      }
    });

    // Update highlighted fields
    if (changedFields.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUpdatedFields((current) => {
        const newSet = new Set(current);
        changedFields.forEach((f) => newSet.add(f));
        return newSet;
      });

      // Clear highlights after animation
      setTimeout(() => {
        setUpdatedFields((current) => {
          const newSet = new Set(current);
          changedFields.forEach((f) => newSet.delete(f));
          return newSet;
        });
      }, 1500);
    }

    prevFiltersRef.current = filters;
    userInputRef.current = null;
  }, [filters]);

  const handleChange = useCallback((field: keyof SearchFilters, value: string) => {
    userInputRef.current = field; // Mark as user input to skip highlighting
    onFiltersChange({ ...filters, [field]: value });
  }, [filters, onFiltersChange]);

  // Handle level change with chamber auto-adjustment
  const handleLevelChange = useCallback((value: string) => {
    userInputRef.current = 'level';
    const currentChamber = filters.type;
    let newChamber = currentChamber;

    // Clear chamber if incompatible with new level
    if (value === 'federal') {
      // Federal level: only House (Representative) and Senate (Senator) are valid
      if (currentChamber && currentChamber !== 'Representative' && currentChamber !== 'Senator') {
        newChamber = '';
      }
    } else if (value === 'state') {
      // State level: only Lower, Upper, Legislature are valid
      if (currentChamber && !['lower', 'upper', 'legislature'].includes(currentChamber)) {
        newChamber = '';
      }
    }

    if (newChamber !== currentChamber) {
      onFiltersChange({ ...filters, level: value, type: newChamber });
    } else {
      onFiltersChange({ ...filters, level: value });
    }
  }, [filters, onFiltersChange]);

  // Get chamber options based on selected level
  const getChamberOptions = () => {
    const level = filters.level;
    if (level === 'federal') {
      return (
        <>
          <option value="">Any</option>
          <option value="Representative">House</option>
          <option value="Senator">Senate</option>
        </>
      );
    } else if (level === 'state') {
      return (
        <>
          <option value="">Any</option>
          <option value="lower">Lower</option>
          <option value="upper">Upper</option>
          <option value="legislature">Legislature</option>
        </>
      );
    }
    // Default: show all options
    return (
      <>
        <option value="">Any</option>
        <option value="Representative">House</option>
        <option value="Senator">Senate</option>
        <option value="lower">Lower</option>
        <option value="upper">Upper</option>
        <option value="legislature">Legislature</option>
      </>
    );
  };

  // Helper to get field class with highlight
  const getFieldClass = (field: keyof SearchFilters, baseClass: string) => {
    return updatedFields.has(field) ? `${baseClass} filter-updated` : baseClass;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch();
  };

  return (
    <div className="card search rounded-4 shadow-sm p-1 mb-3">
      <div className="card-body">
        <form onSubmit={handleSubmit} autoComplete="off">
          {/* Advanced filters (collapsible) */}
          <div className={`mb-2 ${advancedOpen ? '' : 'd-none'}`} id="advancedFilters">
            {/* Basic information */}
            <div className="row g-2">
              {/* Full name */}
              <div className="col-md-6 form-section mb-2">
                <label className="form-label d-flex align-items-center mb-1" htmlFor="fullNameInput">
                  <i className="bi bi-person me-2" aria-hidden="true"></i> Name
                </label>
                <Autocomplete
                  name="name"
                  id="fullNameInput"
                  className={getFieldClass('name', 'form-control bg-light')}
                  placeholder="Any"
                  value={filters.name}
                  onChange={(value) => handleChange('name', value)}
                  suggestions={autocompleteData.names}
                />
              </div>

              {/* Gender */}
              <div className="col-md-6 form-section mb-2">
                <label className="form-label d-flex align-items-center mb-1" htmlFor="genderSelect">
                  <i className="bi bi-gender-ambiguous me-2" aria-hidden="true"></i> Gender
                </label>
                <select
                  name="gender"
                  className={getFieldClass('gender', 'form-select bg-light')}
                  value={filters.gender}
                  onChange={(e) => handleChange('gender', e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="man">Male</option>
                  <option value="woman">Female</option>
                  <option value="nonbinary">Non-Binary</option>
                </select>
              </div>
            </div>

            {/* Position information */}
            <div className="row g-2">
              {/* Level */}
              <div className="col-md-3 form-section mb-2">
                <label className="form-label d-flex align-items-center mb-1" htmlFor="levelSelect">
                  <i className="bi bi-flag me-2" aria-hidden="true"></i> Level
                </label>
                <select
                  name="level"
                  className={getFieldClass('level', 'form-select bg-light')}
                  value={filters.level}
                  onChange={(e) => handleLevelChange(e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="federal">Federal</option>
                  <option value="state">State</option>
                </select>
              </div>

              {/* Chamber */}
              <div className="col-md-3 form-section mb-2">
                <label className="form-label d-flex align-items-center mb-1" htmlFor="chamberSelect">
                  <i className="bi bi-bank me-2" aria-hidden="true"></i> Chamber
                </label>
                <select
                  name="type"
                  className={getFieldClass('type', 'form-select bg-light')}
                  id="chamberSelect"
                  value={filters.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                >
                  {getChamberOptions()}
                </select>
              </div>

              {/* State */}
              <div className="col-md-3 form-section mb-2">
                <label className="form-label d-flex align-items-center mb-1" htmlFor="stateInput">
                  <i className="bi bi-geo-alt me-2" aria-hidden="true"></i> State
                </label>
                <Autocomplete
                  name="state"
                  id="stateInput"
                  className={getFieldClass('state', 'form-control bg-light')}
                  placeholder="Any"
                  value={filters.state}
                  onChange={(value) => handleChange('state', value)}
                  suggestions={autocompleteData.states}
                />
              </div>

              {/* District */}
              <div className="col-md-3 form-section mb-2">
                <label className="form-label d-flex align-items-center mb-1" htmlFor="districtInput">
                  <i className="bi bi-geo me-2" aria-hidden="true"></i> District
                </label>
                <Autocomplete
                  name="district"
                  id="districtInput"
                  className={getFieldClass('district', 'form-control bg-light')}
                  placeholder="Any"
                  value={filters.district}
                  onChange={(value) => handleChange('district', value)}
                  suggestions={autocompleteData.districts}
                />
              </div>
            </div>

            {/* Political affiliation */}
            <div className="row g-2">
              {/* Party */}
              <div className="col-md-6 form-section mb-2">
                <label className="form-label d-flex align-items-center mb-1" htmlFor="partySelect">
                  <i className="bi bi-people me-2" aria-hidden="true"></i> Party
                </label>
                <select
                  name="party"
                  className={getFieldClass('party', 'form-select bg-light')}
                  value={filters.party}
                  onChange={(e) => handleChange('party', e.target.value)}
                >
                  <option value="">Any</option>
                  <optgroup label="National Parties">
                    <option value="Democrat">Democrat</option>
                    <option value="Republican">Republican</option>
                    <option value="Independent">Independent</option>
                  </optgroup>
                  <optgroup label="Puerto Rico Parties">
                    <option value="Partido Nuevo Progresista">Partido Nuevo Progresista</option>
                    <option value="Partido Popular Democrático">Partido Popular Democrático</option>
                    <option value="Partido Independentista Puertorriqueño">Partido Independentista Puertorriqueño</option>
                    <option value="Movimiento Victoria Ciudadana">Movimiento Victoria Ciudadana</option>
                    <option value="Proyecto Dignidad">Proyecto Dignidad</option>
                  </optgroup>
                </select>
              </div>

              {/* Currently serving */}
              <div className="col-md-6 form-section mb-2">
                <label className="form-label d-flex align-items-center mb-1" htmlFor="activeSelect">
                  <i className="bi bi-check2-circle me-2" aria-hidden="true"></i> Currently Serving
                </label>
                <select
                  name="active"
                  className={getFieldClass('active', 'form-select bg-light')}
                  value={filters.active}
                  onChange={(e) => handleChange('active', e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>
            </div>

            {/* Divider before rhetoric filters */}
            <hr className="my-3 text-muted" />

            {/* Rhetoric filters */}
            <div className="row g-2">
              {/* Extreme */}
              <div className="col-md-4 form-section mb-2">
                <label className="form-label d-flex align-items-center mb-1" htmlFor="extremeSelect">
                  <i className="bi bi-fire me-2" aria-hidden="true"></i> Is Extreme
                </label>
                <select
                  name="extreme_label"
                  className={getFieldClass('extreme_label', 'form-select bg-light')}
                  value={filters.extreme_label}
                  onChange={(e) => handleChange('extreme_label', e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              {/* Policy attack */}
              <div className="col-md-4 form-section mb-2">
                <label className="form-label d-flex align-items-center mb-1" htmlFor="attackPolicySelect">
                  <i className="bi bi-exclamation-diamond me-2" aria-hidden="true"></i> Policy Criticism
                </label>
                <select
                  name="attack_policy"
                  className={getFieldClass('attack_policy', 'form-select bg-light')}
                  value={filters.attack_policy}
                  onChange={(e) => handleChange('attack_policy', e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>

              {/* Personal attack */}
              <div className="col-md-4 form-section mb-2">
                <label className="form-label d-flex align-items-center mb-1" htmlFor="attackPersonalInput">
                  <i className="bi bi-person-x me-2" aria-hidden="true"></i> Personal Attacks
                </label>
                <select
                  name="attack_personal"
                  className={getFieldClass('attack_personal', 'form-select bg-light')}
                  value={filters.attack_personal}
                  onChange={(e) => handleChange('attack_personal', e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>
            </div>

            {/* Additional outcomes */}
            <div className="row g-2">
              {/* Policy */}
              <div className="col-md-4 form-section mb-2">
                <label className="form-label d-flex align-items-center mb-1" htmlFor="policySelect">
                  <i className="bi bi-lightbulb me-2" aria-hidden="true"></i> Policy Discussion
                </label>
                <select
                  name="policy"
                  className={getFieldClass('policy', 'form-select bg-light')}
                  value={filters.policy}
                  onChange={(e) => handleChange('policy', e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>

              {/* Bipartisanship */}
              <div className="col-md-4 form-section mb-2">
                <label className="form-label d-flex align-items-center mb-1" htmlFor="bipartisanshipSelect">
                  <i className="bi bi-people me-2" aria-hidden="true"></i> Bipartisanship
                </label>
                <select
                  name="outcome_bipartisanship"
                  className={getFieldClass('outcome_bipartisanship', 'form-select bg-light')}
                  value={filters.outcome_bipartisanship}
                  onChange={(e) => handleChange('outcome_bipartisanship', e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>

              {/* Creditclaiming */}
              <div className="col-md-4 form-section mb-2">
                <label className="form-label d-flex align-items-center mb-1" htmlFor="creditclaimingSelect">
                  <i className="bi bi-award me-2" aria-hidden="true"></i> Accomplishments
                </label>
                <select
                  name="outcome_creditclaiming"
                  className={getFieldClass('outcome_creditclaiming', 'form-select bg-light')}
                  value={filters.outcome_creditclaiming}
                  onChange={(e) => handleChange('outcome_creditclaiming', e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>
            </div>
          </div>
          {/* End advanced filters */}

          {/* Search parameters row */}
          <div className="row align-items-end g-2">
            {/* Source */}
            <div className="col-md-3">
              <label className="form-label d-flex align-items-center mb-1" htmlFor="source">
                <i className="bi bi-card-list me-2" aria-hidden="true"></i> Source
              </label>
              <select
                name="source"
                className={getFieldClass('source', 'form-select')}
                value={filters.source}
                onChange={(e) => handleChange('source', e.target.value)}
              >
                <option value="">Any</option>
                <option value="tweets">Tweets</option>
                <option value="floor">Floor</option>
                <option value="newsletters">Newsletters</option>
                <option value="statements">Statements</option>
              </select>
            </div>

            {/* Start date */}
            <div className="col-md-3">
              <label className="form-label d-flex align-items-center mb-1" htmlFor="startDate">
                <i className="bi bi-calendar me-2" aria-hidden="true"></i> Start Date
              </label>
              <input
                type="date"
                name="start_date"
                className={getFieldClass('start_date', 'form-control')}
                id="startDate"
                value={filters.start_date}
                onChange={(e) => handleChange('start_date', e.target.value)}
              />
            </div>

            {/* End date */}
            <div className="col-md-3">
              <label className="form-label d-flex align-items-center mb-1" htmlFor="endDate">
                <i className="bi bi-calendar2 me-2" aria-hidden="true"></i> End Date
              </label>
              <input
                type="date"
                name="end_date"
                className={getFieldClass('end_date', 'form-control')}
                id="endDate"
                value={filters.end_date}
                onChange={(e) => handleChange('end_date', e.target.value)}
              />
            </div>

            {/* Advanced search toggle */}
            <div className="col-md-3 d-grid">
              <button
                className="btn btn-light-grey"
                type="button"
                onClick={() => setAdvancedOpen(!advancedOpen)}
              >
                <i className="bi bi-sliders me-2" aria-hidden="true"></i>
                <span className="filter-btn-text">
                  {advancedOpen ? 'Hide Advanced' : 'Advanced Search'}
                </span>
              </button>
            </div>
          </div>

          {/* Search input and action buttons */}
          <div className="row align-items-end g-2 mt-0">
            {/* Search input */}
            <div className="col-md-9">
              <label className="visually-hidden" htmlFor="searchInput">Search terms</label>
              <input
                type="text"
                name="search"
                id="searchInput"
                className={getFieldClass('search', 'form-control')}
                placeholder='Enter a search phrase like "healthcare"'
                value={filters.search}
                onChange={(e) => handleChange('search', e.target.value)}
              />
            </div>

            {/* Submit */}
            <div className="col-md-2 d-grid align-items-end">
              <button
                type="submit"
                className="btn btn-primary"
                id="searchButton"
                title="Search"
              >
                <i className="bi bi-search" aria-hidden="true"></i>
                {' '}Search
              </button>
            </div>

            {/* Clear */}
            <div className="col-md-1 d-grid align-items-end">
              <button
                type="button"
                className="btn btn-light-grey"
                onClick={onClear}
                title="Clear Filters"
              >
                <i className="bi bi-eraser" aria-hidden="true"></i>
                <span className="visually-hidden">Clear Filters</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
