import { useEffect, useState } from 'react';
import { bibleContentCache } from '../store/bibleContent.store';
import { useRelationsStore, relsFetched, type RelRow } from '../store/relations.store';

const chapterSummaryCache = new Map<string, string>();

export function useChapterData(book: string | null, chapter: number | null) {
  const key = book && chapter ? `${book}|${chapter}` : null;

  const [uuids,    setUuids]    = useState<string[] | null>(() =>
    book && chapter ? (bibleContentCache.getChapterUuids(book, chapter) ?? null) : null
  );
  const [summary,  setSummary]  = useState<string>(() =>
    key ? (chapterSummaryCache.get(key) ?? '') : ''
  );
  const [loading,  setLoading]  = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!book || !chapter || !key) { setUuids(null); setSummary(''); setNotFound(false); return; }

    const cached = bibleContentCache.getChapterUuids(book, chapter);
    if (cached) {
      setUuids(cached);
      setSummary(chapterSummaryCache.get(key) ?? '');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    fetch(`/api/bible/books/${encodeURIComponent(book)}/chapters/${chapter}`)
      .then(async r => {
        if (r.status === 404) { if (!cancelled) { setNotFound(true); setLoading(false); } return; }
        const data: any = await r.json();
        if (cancelled) return;
        const ch: any = data.chapter ?? {};
        const verses: any[] = ch.verses ?? [];
        const ids = verses.map((v: any) => v.uuid as string);
        const sum: string = ch.summary ?? '';

        const allRelations: RelRow[] = [];
        const leanVerses = verses.map((v: any) => {
          if (Array.isArray(v.related_to)) allRelations.push(...(v.related_to as RelRow[]));
          return { uuid: v.uuid as string, number: v.number as number, content: v.content as string };
        });

        // Mark before setUuids so VerseRow's useVerseRelations sees relsFetched synchronously
        for (const id of ids) relsFetched.add(id);
        if (allRelations.length) useRelationsStore.getState().addBatch(allRelations);

        bibleContentCache.setChapterUuids(book, chapter, ids);
        bibleContentCache.setVerses(leanVerses);
        chapterSummaryCache.set(key, sum);

        setUuids(ids);
        setSummary(sum);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [book, chapter, key]);

  return { uuids, summary, loading, notFound };
}
