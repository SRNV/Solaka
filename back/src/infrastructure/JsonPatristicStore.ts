import * as fs from 'fs';
import { injectable, inject } from 'inversify';
import { TYPES } from '../container/types';
import type { AppConfig } from '../container/config';
import type { IPatristicRepository } from '../domain/repositories/IPatristicRepository';
import type { PatristicAuthor, PatristicComment, PatristicCommentResult, CommentSummary } from '../domain/Patristic';
import type { PaginatedResponse } from '../domain/Pagination';

@injectable()
export class JsonPatristicStore implements IPatristicRepository {
  private authors: PatristicAuthor[] = [];
  private byUuid  = new Map<string, PatristicAuthor>();
  private bySlug  = new Map<string, PatristicAuthor>();

  // verse uuid → comments for that verse
  private byVerse = new Map<string, PatristicComment[]>();
  // author uuid → comments by that author
  private byAuthorUuid = new Map<string, PatristicComment[]>();
  // pre-built full index (uuid → summary)
  private commentIndex: Record<string, CommentSummary> = {};

  constructor(@inject(TYPES.Config) config: AppConfig) {
    this.load(config.patristicAuthorsPath, config.patristicCommentsPath);
  }

  private load(authorsPath: string, commentsPath: string): void {
    const isFile = (p: string) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
    if (!isFile(authorsPath) || !isFile(commentsPath)) {
      console.warn('[PatristicStore] Missing data files — patristic endpoints will return empty results');
      return;
    }

    this.authors = JSON.parse(fs.readFileSync(authorsPath, 'utf-8')) as PatristicAuthor[];
    for (const a of this.authors) {
      this.byUuid.set(a.uuid, a);
      this.bySlug.set(a.slug, a);
    }

    const comments = JSON.parse(fs.readFileSync(commentsPath, 'utf-8')) as PatristicComment[];
    for (const c of comments) {
      // Index by verse
      const vList = this.byVerse.get(c.verseFromUuid) ?? [];
      vList.push(c);
      this.byVerse.set(c.verseFromUuid, vList);

      // Index by author
      const aList = this.byAuthorUuid.get(c.authorUuid) ?? [];
      aList.push(c);
      this.byAuthorUuid.set(c.authorUuid, aList);
    }

    // Pre-build comment index
    for (const [uuid, list] of this.byVerse) {
      const seen = new Set<string>();
      const authors: CommentSummary['authors'] = [];
      for (const c of list) {
        if (!seen.has(c.authorUuid)) {
          seen.add(c.authorUuid);
          const a = this.byUuid.get(c.authorUuid);
          if (a) authors.push({ slug: a.slug, nameFr: a.nameFr, tradition: a.tradition, type: a.type ?? 'patristic' });
        }
      }
      this.commentIndex[uuid] = { count: list.length, authors: authors.slice(0, 12) };
    }

    console.log(`[PatristicStore] ${this.authors.length} authors, ${comments.length} comments loaded`);
  }

  private attachAuthor(c: PatristicComment): PatristicCommentResult {
    return { ...c, author: this.byUuid.get(c.authorUuid)! };
  }

  private paginate<T>(items: T[], limit = 50, offset = 0): PaginatedResponse<T> {
    return {
      data:   items.slice(offset, offset + limit),
      total:  items.length,
      limit,
      offset,
    };
  }

  getAuthors(limit = 50, offset = 0): PaginatedResponse<PatristicAuthor> {
    return this.paginate(this.authors, limit, offset);
  }

  getAuthorBySlug(slug: string): PatristicAuthor | null {
    return this.bySlug.get(slug) ?? null;
  }

  getCommentsByVerse(verseUuid: string, limit = 50, offset = 0): PaginatedResponse<PatristicCommentResult> {
    const comments = (this.byVerse.get(verseUuid) ?? []).map(c => this.attachAuthor(c));
    return this.paginate(comments, limit, offset);
  }

  getCommentsByAuthor(slug: string, limit = 50, offset = 0): PaginatedResponse<PatristicCommentResult> {
    const author = this.bySlug.get(slug);
    if (!author) return { data: [], total: 0, limit, offset };
    const comments = (this.byAuthorUuid.get(author.uuid) ?? []).map(c => this.attachAuthor(c));
    return this.paginate(comments, limit, offset);
  }

  getCommentIndex(): Record<string, CommentSummary> {
    return this.commentIndex;
  }

  getCommentsBatch(verseUuids: string[]): Record<string, CommentSummary> {
    const result: Record<string, CommentSummary> = {};
    for (const uuid of verseUuids) {
      const comments = this.byVerse.get(uuid);
      if (!comments || comments.length === 0) continue;
      const seen = new Set<string>();
      const authors: CommentSummary['authors'] = [];
      for (const c of comments) {
        if (!seen.has(c.authorUuid)) {
          seen.add(c.authorUuid);
          const a = this.byUuid.get(c.authorUuid);
          if (a) authors.push({ slug: a.slug, nameFr: a.nameFr, tradition: a.tradition, type: a.type ?? 'patristic' });
        }
      }
      result[uuid] = { count: comments.length, authors: authors.slice(0, 12) };
    }
    return result;
  }
}
