import type { IPatristicRepository } from '../../domain/repositories/IPatristicRepository';

export class GetPatristicAuthors {
  constructor(private repo: IPatristicRepository) {}
  execute(limit?: number, offset?: number) { return this.repo.getAuthors(limit, offset); }
}

export class GetPatristicAuthorBySlug {
  constructor(private repo: IPatristicRepository) {}
  execute(slug: string) { return this.repo.getAuthorBySlug(slug); }
}

export class GetPatristicCommentsByVerse {
  constructor(private repo: IPatristicRepository) {}
  execute(verseUuid: string, limit?: number, offset?: number) {
    return this.repo.getCommentsByVerse(verseUuid, limit, offset);
  }
}

export class GetPatristicCommentsByAuthor {
  constructor(private repo: IPatristicRepository) {}
  execute(slug: string, limit?: number, offset?: number) {
    return this.repo.getCommentsByAuthor(slug, limit, offset);
  }
}

export class GetPatristicCommentsBatch {
  constructor(private repo: IPatristicRepository) {}
  execute(verseUuids: string[]) {
    return this.repo.getCommentsBatch(verseUuids);
  }
}

export class GetPatristicCommentIndex {
  constructor(private repo: IPatristicRepository) {}
  execute() {
    return this.repo.getCommentIndex();
  }
}
