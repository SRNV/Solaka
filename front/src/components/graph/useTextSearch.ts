import { useCallback, useEffect, useRef, useState, startTransition } from 'react';
import { useStompSearch } from '@/hooks/useStompSearch.ts';
import { parseRef } from '@/utils/bibleRef.ts';
import type { BibleBookMeta } from '@/models/bible';

function normText(s: string): string {
  return s.toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[''ʼ]/g, "'")
    .replace(/\s+/g, ' ').trim();
}

interface Callbacks {
  onClearDrawerRelations: () => void;
  onSetRelationsQuery:    (q: string) => void;
  onSetRelationsEnabled:  (e: boolean) => void;
}

export function useTextSearch(books: BibleBookMeta[] | null, cb: Callbacks) {
  const [submittedQuery,  setSubmittedQuery]  = useState('');
  const [textSearchQuery, setTextSearchQuery] = useState('');
  const [searchHitUuids,  setSearchHitUuids]  = useState<Map<string, string> | null>(null);
  const [activeSearchRef, setActiveSearchRef] = useState<ReturnType<typeof parseRef> | null>(null);
  const textExtraTermsRef = useRef<string[]>([]);
  const cbRef = useRef(cb);
  cbRef.current = cb;

  const { results: stompSearchResults } = useStompSearch(textSearchQuery);

  useEffect(() => {
    const { onClearDrawerRelations, onSetRelationsQuery, onSetRelationsEnabled } = cbRef.current;
    const query = submittedQuery.trim();
    setSearchHitUuids(null);
    setActiveSearchRef(null);
    onClearDrawerRelations();
    onSetRelationsQuery('');

    if (query.length < 2) {
      setTextSearchQuery('');
      textExtraTermsRef.current = [];
      onSetRelationsEnabled(false);
      return;
    }

    const parts = query.split(';').map(p => p.trim()).filter(p => p.length > 0);
    const ref   = books ? parseRef(parts[0], books) : null;
    if (ref) setActiveSearchRef(ref);

    fetch(`/api/bible/search/hits?q=${encodeURIComponent(parts[0])}`)
      .then(r => r.json())
      .then(res => {
        const hits = new Map<string, string>(
          (res.data as Array<{ uuid: string; relType: string }>).map(h => [h.uuid, h.relType]),
        );
        startTransition(() => setSearchHitUuids(hits));
      });

    const terms = parts.map(p => normText(p));
    textExtraTermsRef.current = terms.slice(1);
    setTextSearchQuery(parts[0]);

    const hasRef = parts.some(p => !!(books && parseRef(p, books)));
    onSetRelationsQuery(hasRef ? parts[0] : '');
    onSetRelationsEnabled(hasRef);
  }, [submittedQuery, books]);

  useEffect(() => {
    if (stompSearchResults.length === 0) return;
    const extras   = textExtraTermsRef.current;
    const filtered = extras.length === 0
      ? stompSearchResults
      : stompSearchResults.filter(r => { const nv = normText(r.content); return extras.every(t => nv.includes(t)); });
    if (filtered.length === 0) return;
    startTransition(() =>
      setSearchHitUuids(prev => {
        const next = new Map(prev);
        for (const r of filtered) next.set(r.uuid, '');
        return next;
      }),
    );
  }, [stompSearchResults]);

  const clearSearch = useCallback(() => {
    setSubmittedQuery('');
    startTransition(() => {
      setSearchHitUuids(null);
      setActiveSearchRef(null);
      cbRef.current.onClearDrawerRelations();
    });
  }, []);

  return { submittedQuery, setSubmittedQuery, searchHitUuids, activeSearchRef, clearSearch };
}
