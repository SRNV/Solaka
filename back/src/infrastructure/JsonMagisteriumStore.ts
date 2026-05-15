import * as fs from 'fs';
import { injectable, inject } from 'inversify';
import { TYPES } from '../container/types';
import type { AppConfig } from '../container/config';
import type { IMagisteriumRepository } from '../domain/repositories/IMagisteriumRepository';
import type {
  MagisteriumPerson,
  MagisteriumComment,
  MagisteriumCommentResult,
  MagisteriumDocument,
} from '../domain/Magisterium';
import type { PaginatedResponse } from '../domain/Pagination';

@injectable()
export class JsonMagisteriumStore implements IMagisteriumRepository {
  private persons: MagisteriumPerson[] = [];
  private bySlug  = new Map<string, MagisteriumPerson>();

  // verse uuid → comments citing that verse
  private byVerse = new Map<string, MagisteriumComment[]>();
  // document abbr → comments from that document
  private byDoc   = new Map<string, MagisteriumComment[]>();
  // document abbr → MagisteriumDocument summary (built on load)
  private docs: MagisteriumDocument[] = [];

  constructor(@inject(TYPES.Config) config: AppConfig) {
    this.load(config.magisterePersonsPath, config.magistereCommentsPath);
  }

  private load(personsPath: string, commentsPath: string): void {
    const isFile = (p: string) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
    if (!isFile(personsPath) || !isFile(commentsPath)) {
      console.warn('[MagisteriumStore] Missing data files — magistère endpoints will return empty results');
      return;
    }

    this.persons = JSON.parse(fs.readFileSync(personsPath, 'utf-8')) as MagisteriumPerson[];
    for (const a of this.persons) this.bySlug.set(a.slug, a);

    const comments = JSON.parse(fs.readFileSync(commentsPath, 'utf-8')) as MagisteriumComment[];

    // Intermediate map to build document summaries
    const docMeta = new Map<string, { name: string; url: string; year: number; author_slug: string }>();

    for (const c of comments) {
      // Index by verse (each comment can cite multiple verses)
      for (const vuuid of c.verse_uuids) {
        const vList = this.byVerse.get(vuuid) ?? [];
        vList.push(c);
        this.byVerse.set(vuuid, vList);
      }

      // Index by document
      const dList = this.byDoc.get(c.document_abbr) ?? [];
      dList.push(c);
      this.byDoc.set(c.document_abbr, dList);

      if (!docMeta.has(c.document_abbr)) {
        docMeta.set(c.document_abbr, {
          name: c.document_name,
          url:  c.document_url,
          year: c.year,
          author_slug: c.author_slug,
        });
      }
    }

    this.docs = [...docMeta.entries()].map(([abbr, meta]) => ({
      abbr,
      name:          meta.name,
      url:           meta.url,
      year:          meta.year,
      author_slug:   meta.author_slug,
      comment_count: this.byDoc.get(abbr)!.length,
    })).sort((a, b) => a.year - b.year);

    console.log(`[MagisteriumStore] ${this.persons.length} persons, ${comments.length} comments, ${this.docs.length} documents loaded`);
  }

  private attachPerson(c: MagisteriumComment): MagisteriumCommentResult {
    return { ...c, person: this.bySlug.get(c.author_slug)! };
  }

  private paginate<T>(items: T[], limit = 50, offset = 0): PaginatedResponse<T> {
    return { data: items.slice(offset, offset + limit), total: items.length, limit, offset };
  }

  getPersons(): MagisteriumPerson[] {
    return this.persons;
  }

  getPersonBySlug(slug: string): MagisteriumPerson | null {
    return this.bySlug.get(slug) ?? null;
  }

  getDocuments(personSlug?: string): MagisteriumDocument[] {
    if (!personSlug) return this.docs;
    return this.docs.filter(d => d.author_slug === personSlug);
  }

  getCommentsByVerse(verseUuid: string, limit = 50, offset = 0): PaginatedResponse<MagisteriumCommentResult> {
    const comments = (this.byVerse.get(verseUuid) ?? []).map(c => this.attachPerson(c));
    return this.paginate(comments, limit, offset);
  }

  getCommentsByDocument(abbr: string, limit = 50, offset = 0): PaginatedResponse<MagisteriumCommentResult> {
    const comments = (this.byDoc.get(abbr.toUpperCase()) ?? this.byDoc.get(abbr) ?? [])
      .map(c => this.attachPerson(c));
    return this.paginate(comments, limit, offset);
  }
}
