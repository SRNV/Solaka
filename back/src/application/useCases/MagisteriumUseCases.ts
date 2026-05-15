import type { IMagisteriumRepository } from '../../domain/repositories/IMagisteriumRepository';

export class GetMagisteriumAuthors {
  constructor(private repo: IMagisteriumRepository) {}
  execute() { return this.repo.getAuthors(); }
}

export class GetMagisteriumAuthorBySlug {
  constructor(private repo: IMagisteriumRepository) {}
  execute(slug: string) { return this.repo.getAuthorBySlug(slug); }
}

export class GetMagisteriumDocuments {
  constructor(private repo: IMagisteriumRepository) {}
  execute(authorSlug?: string) { return this.repo.getDocuments(authorSlug); }
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
