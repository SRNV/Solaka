import { useEffect } from 'react';
import { useTextSearch }           from './useTextSearch';
import { useActiveRelationsStore } from '@/store/activeRelations.store';
import { SearchInput }             from './SearchInput';
import type { BibleBookMeta }      from '@/models/bible';
interface Props {
  books: BibleBookMeta[] | null;
}

/** Owns text search state and syncs results (searchHitUuids, activeSearchTarget) into the store. */
export function SearchFeature({ books }: Props) {
  const {
    setDrawerRelations, setActiveRelationsQuery,
    setRelationsEnabled, setActiveSearchTarget, setSearchHitUuids,
  } = useActiveRelationsStore();

  const { setSubmittedQuery, searchHitUuids, activeSearchRef, clearSearch } = useTextSearch(books, {
    onClearDrawerRelations: () => setDrawerRelations(null),
    onSetRelationsQuery:    setActiveRelationsQuery,
    onSetRelationsEnabled:  setRelationsEnabled,
  });

  useEffect(() => {
    setActiveSearchTarget(activeSearchRef ?? null);
  }, [activeSearchRef, setActiveSearchTarget]);

  useEffect(() => {
    setSearchHitUuids(searchHitUuids ?? null);
  }, [searchHitUuids, setSearchHitUuids]);

  return <SearchInput onSubmit={setSubmittedQuery} onClear={clearSearch} />;
}
