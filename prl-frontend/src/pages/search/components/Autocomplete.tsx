import { useState, useRef, useEffect, useCallback } from 'react';

interface AutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
}

export function Autocomplete({
  value,
  onChange,
  suggestions,
  placeholder = 'Any',
  className = 'form-control bg-light',
  id,
  name,
}: AutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input value
  useEffect(() => {
    if (!value.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilteredSuggestions([]);
      return;
    }

    const searchTerm = value.toLowerCase();
    const filtered = suggestions
      .filter((suggestion) => suggestion.toLowerCase().includes(searchTerm))
      .slice(0, 10); // Limit to 10 suggestions

    setFilteredSuggestions(filtered);
    setHighlightedIndex(-1);
  }, [value, suggestions]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('li');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setIsOpen(true);
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredSuggestions.length === 0) {
      if (e.key === 'ArrowDown' && filteredSuggestions.length > 0) {
        setIsOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
          onChange(filteredSuggestions[highlightedIndex]);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  }, [isOpen, filteredSuggestions, highlightedIndex, onChange]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    onChange(suggestion);
    setIsOpen(false);
    inputRef.current?.focus();
  }, [onChange]);

  const handleFocus = useCallback(() => {
    if (value.trim() && filteredSuggestions.length > 0) {
      setIsOpen(true);
    }
  }, [value, filteredSuggestions.length]);

  // Highlight matching text in suggestion
  const highlightMatch = (suggestion: string, searchTerm: string) => {
    if (!searchTerm.trim()) return suggestion;

    const lowerSuggestion = suggestion.toLowerCase();
    const lowerSearch = searchTerm.toLowerCase();
    const index = lowerSuggestion.indexOf(lowerSearch);

    if (index === -1) return suggestion;

    const before = suggestion.slice(0, index);
    const match = suggestion.slice(index, index + searchTerm.length);
    const after = suggestion.slice(index + searchTerm.length);

    return (
      <>
        {before}
        <strong className="text-primary">{match}</strong>
        {after}
      </>
    );
  };

  return (
    <div ref={containerRef} className="position-relative">
      <input
        ref={inputRef}
        type="text"
        name={name}
        id={id}
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        autoComplete="off"
      />
      {isOpen && filteredSuggestions.length > 0 && (
        <ul
          ref={listRef}
          className="autocomplete-suggestions list-group position-absolute w-100 mt-1 overflow-auto"
          style={{ maxHeight: '200px' }}
        >
          {filteredSuggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              className={`list-group-item list-group-item-action ${
                index === highlightedIndex ? 'active' : ''
              }`}
              onClick={() => handleSuggestionClick(suggestion)}
              onMouseEnter={() => setHighlightedIndex(index)}
              role="button"
            >
              {highlightMatch(suggestion, value)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
