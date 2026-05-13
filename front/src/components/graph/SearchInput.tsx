import { memo, useState } from 'react';
import styles from './SearchInput.module.css';

interface SearchInputProps {
  onSubmit: (query: string) => void;
  onClear:  () => void;
}

export const SearchInput = memo(function SearchInput({ onSubmit, onClear }: SearchInputProps) {
  const [query, setQuery] = useState('');

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter')  onSubmit(query.trim());
    if (e.key === 'Escape') { setQuery(''); onClear(); }
  }

  function handleClear() {
    setQuery('');
    onClear();
  }

  return (
    <div className={styles.graphSearch}>
      <svg className={styles.graphSearchIcon} viewBox="0 0 20 20" fill="none" aria-hidden>
        <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      <input
        className={styles.graphSearchInput}
        type="search"
        placeholder="Rechercher un verset ou une référence… (ex: Jean 3:16)"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {query && (
        <button className={styles.graphSearchClear} onClick={handleClear}>
          ✕
        </button>
      )}
    </div>
  );
});
