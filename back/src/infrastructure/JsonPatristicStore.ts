import * as fs from 'fs';
import { injectable, inject } from 'inversify';
import { TYPES } from '../container/types';
import type { AppConfig } from '../container/config';
import type { IPatristicRepository } from '../domain/repositories/IPatristicRepository';
import type { PatristicPerson, PatristicComment, PatristicCommentResult, CommentSummary } from '../domain/Patristic';
import type { PaginatedResponse } from '../domain/Pagination';

@injectable()
export class JsonPatristicStore implements IPatristicRepository {
  private persons: PatristicPerson[] = [];
  private byUuid  = new Map<string, PatristicPerson>();
  private bySlug  = new Map<string, PatristicPerson>();

  // verse uuid → comments for that verse
  private byVerse = new Map<string, PatristicComment[]>();
  // person uuid → comments by that person
  private byPersonUuid = new Map<string, PatristicComment[]>();
  // pre-built full index (uuid → summary)
  private commentIndex: Record<string, CommentSummary> = {};

  constructor(@inject(TYPES.Config) config: AppConfig) {
    this.load(config.patristicPersonsPath, config.patristicCommentsPath);
  }

  private load(personsPath: string, commentsPath: string): void {
    const isFile = (p: string) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
    if (!isFile(personsPath) || !isFile(commentsPath)) {
      console.warn('[PatristicStore] Missing data files — patristic endpoints will return empty results');
      return;
    }

    this.persons = JSON.parse(fs.readFileSync(personsPath, 'utf-8')) as PatristicPerson[];
    for (const a of this.persons) {
      this.byUuid.set(a.uuid, a);
      this.bySlug.set(a.slug, a);
    }

    const rawComments = JSON.parse(fs.readFileSync(commentsPath, 'utf-8')) as Array<PatristicComment & { authorUuid?: string }>;
    const comments: PatristicComment[] = rawComments.map(c => ({
      ...c,
      personUuid: c.personUuid ?? c.authorUuid ?? '',
    }));

    for (const c of comments) {
      // Index by verse
      const vList = this.byVerse.get(c.verseFromUuid) ?? [];
      vList.push(c);
      this.byVerse.set(c.verseFromUuid, vList);

      // Index by person
      const aList = this.byPersonUuid.get(c.personUuid) ?? [];
      aList.push(c);
      this.byPersonUuid.set(c.personUuid, aList);
    }

    // Pre-build comment index
    for (const [uuid, list] of this.byVerse) {
      const seen = new Set<string>();
      const persons: CommentSummary['persons'] = [];
      for (const c of list) {
        if (!seen.has(c.personUuid)) {
          seen.add(c.personUuid);
          const a = this.byUuid.get(c.personUuid);
          if (a) persons.push({ slug: a.slug, nameFr: a.nameFr, tradition: a.tradition, type: a.type ?? 'patristic' });
        }
      }
      this.commentIndex[uuid] = { count: list.length, persons: persons.slice(0, 12) };
    }

    console.log(`[PatristicStore] ${this.persons.length} persons, ${comments.length} comments loaded`);
  }

  private attachPerson(c: PatristicComment): PatristicCommentResult {
    return { ...c, person: this.byUuid.get(c.personUuid)! };
  }

  private paginate<T>(items: T[], limit = 50, offset = 0): PaginatedResponse<T> {
    return {
      data:   items.slice(offset, offset + limit),
      total:  items.length,
      limit,
      offset,
    };
  }

  getPersons(limit = 50, offset = 0): PaginatedResponse<PatristicPerson> {
    return this.paginate(this.persons, limit, offset);
  }

  getPersonBySlug(slug: string): PatristicPerson | null {
    return this.bySlug.get(slug) ?? null;
  }

  getCommentsByVerse(verseUuid: string, limit = 50, offset = 0): PaginatedResponse<PatristicCommentResult> {
    const comments = (this.byVerse.get(verseUuid) ?? []).map(c => this.attachPerson(c));
    return this.paginate(comments, limit, offset);
  }

  getCommentsByPerson(slug: string, limit = 50, offset = 0): PaginatedResponse<PatristicCommentResult> {
    const person = this.bySlug.get(slug);
    if (!person) return { data: [], total: 0, limit, offset };
    const comments = (this.byPersonUuid.get(person.uuid) ?? []).map(c => this.attachPerson(c));
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
      const persons: CommentSummary['persons'] = [];
      for (const c of comments) {
        if (!seen.has(c.personUuid)) {
          seen.add(c.personUuid);
          const a = this.byUuid.get(c.personUuid);
          if (a) persons.push({ slug: a.slug, nameFr: a.nameFr, tradition: a.tradition, type: a.type ?? 'patristic' });
        }
      }
      result[uuid] = { count: comments.length, persons: persons.slice(0, 12) };
    }
    return result;
  }
}
