import type { IMagisteriumRepository } from '../../domain/repositories/IMagisteriumRepository';

export class GetMagisteriumPersons {
  constructor(private repo: IMagisteriumRepository) {}
  execute() { return this.repo.getPersons(); }
}

export class GetMagisteriumPersonBySlug {
  constructor(private repo: IMagisteriumRepository) {}
  execute(slug: string) { return this.repo.getPersonBySlug(slug); }
}

export class GetMagisteriumDocuments {
  constructor(private repo: IMagisteriumRepository) {}
  execute(personSlug?: string) { return this.repo.getDocuments(personSlug); }
}

export class GetMagisteriumCommentsByVerse {
  constructor(private repo: IMagisteriumRepository) {}
  execute(verseUuid: string, limit?: number, offset?: number) {
    return this.repo.getCommentsByVerse(verseUuid, limit, offset);
  }
}

export class GetMagisteriumCommentsByDocument {
  constructor(private repo: IMagisteriumRepository) {}
  execute(abbr: string, limit?: number, offset?: number) {
    return this.repo.getCommentsByDocument(abbr, limit, offset);
  }
}
