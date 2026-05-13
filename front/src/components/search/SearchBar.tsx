import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './SearchBar.module.css';

export function SearchBar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [value, setValue] = useState(searchParams.get('q') ?? '');

  useEffect(() => {
    setValue(searchParams.get('q') ?? '');
  }, [searchParams]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (q.length >= 2) navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} role="search">
      <svg className={styles.icon} viewBox="0 0 20 20" fill="none" aria-hidden>
        <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        className={styles.input}
        type="search"
        placeholder="Rechercher dans la Bible… (termes séparés par ;)"
        value={value}
        onChange={e => setValue(e.target.value)}
        aria-label="Rechercher dans la Bible"
      />
    </form>
  );
}
