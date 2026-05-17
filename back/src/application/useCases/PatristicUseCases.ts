import type { IPatristicRepository } from '../../models/IPatristicRepository';

export class GetPatristicPersons {
  constructor(private repo: IPatristicRepository) {}
  execute(limit?: number, offset?: number) { return this.repo.getPersons(limit, offset); }
}

export class GetPatristicPersonBySlug {
  constructor(private repo: IPatristicRepository) {}
  execute(slug: string) { return this.repo.getPersonBySlug(slug); }
}

export class GetPatristicCommentsByVerse {
  constructor(private repo: IPatristicRepository) {}
  execute(verseUuid: string, limit?: number, offset?: number) {
    return this.repo.getCommentsByVerse(verseUuid, limit, offset);
  }
}

export class GetPatristicCommentsByPerson {
  constructor(private repo: IPatristicRepository) {}
  execute(slug: string, limit?: number, offset?: number) {
    return this.repo.getCommentsByPerson(slug, limit, offset);
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
