import { useEffect, useRef } from 'react';
import { usePatristicCommentStore } from '@/store/comment.store.ts';
import type { CommentBatchResult } from '@/types/patristic.ts';

export function usePatristicCommentSummaries(uuids: string[] | null) {
  const mergeSummaries = usePatristicCommentStore(s => s.mergeSummaries);
  const keyRef = useRef('');

  useEffect(() => {
    if (!uuids || uuids.length === 0) return;
    const key = uuids.join(',');
    if (key === keyRef.current) return;
    keyRef.current = key;

    fetch('/api/patristic/verses/comments/batch', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ uuids }),
    })
      .then(r => r.json())
      .then((data: CommentBatchResult) => {
        mergeSummaries(Object.entries(data));
      })
      .catch(() => { /* non-critical */ });
  }, [uuids, mergeSummaries]);
}
