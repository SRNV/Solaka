import type { IBibleRepository } from '../../models/IBibleRepository';

export class GetBooks {
  constructor(private repo: IBibleRepository) {}
  execute(limit?: number, offset?: number) { return this.repo.getBooks(limit, offset); }
}

export class GetStructure {
  constructor(private repo: IBibleRepository) {}
  execute(limit?: number, offset?: number) { return this.repo.getStructure(limit, offset); }
}

export class GetChapter {
  constructor(private repo: IBibleRepository) {}
  execute(bookRef: string | number, chapterNum: number) { return this.repo.getChapter(bookRef, chapterNum); }
}

export class GetVerse {
  constructor(private repo: IBibleRepository) {}
  execute(uuid: string) { return this.repo.getVerse(uuid); }
}

export class GetKings {
  constructor(private repo: IBibleRepository) {}
  execute(limit?: number, offset?: number) { return this.repo.getKings(limit, offset); }
}

export class GetPeriods {
  constructor(private repo: IBibleRepository) {}
  execute(limit?: number, offset?: number) { return this.repo.getPeriods(limit, offset); }
}

export class GetEvents {
  constructor(private repo: IBibleRepository) {}
  execute(limit?: number, offset?: number) { return this.repo.getEvents(limit, offset); }
}

export class GetRelations {
  constructor(private repo: IBibleRepository) {}
  execute(limit?: number, offset?: number) { return this.repo.getRelations(limit, offset); }
}

export class GetRelationsByUuids {
  constructor(private repo: IBibleRepository) {}
  execute(uuids: string[]) { return this.repo.getRelationsByUuids(uuids); }
}

export class SearchBible {
  constructor(private repo: IBibleRepository) {}
  execute(query: string, limit?: number, offset?: number) { return this.repo.search(query, limit, offset); }
}

export class SearchBibleHits {
  constructor(private repo: IBibleRepository) {}
  execute(query: string) { return this.repo.searchHits(query); }
}
