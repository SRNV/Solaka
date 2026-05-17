import { useEffect, useRef } from 'react';
import { usePatristicCommentStore } from '@/store/comment.store.ts';
import type { CommentBatchResult } from '@/models/patristic';

export function usePatristicCommentIndex() {
  const mergeSummaries = usePatristicCommentStore(s => s.mergeSummaries);
  const fetchedRef     = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    fetch('/api/patristic/comment-index')
      .then(r => r.json())
      .then((data: CommentBatchResult) => {
        mergeSummaries(Object.entries(data));
      })
      .catch(() => { /* non-critical */ });
  }, [mergeSummaries]);
}
