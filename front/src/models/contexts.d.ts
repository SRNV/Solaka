export interface BibleTarget {
  book: string;
  chapter: number;
  verse?: number;
  verseTo?: number;
}

export interface ArcRef {
  from:   string;
  toFrom: string;
  toTo:   string;
  trad:   'c' | 'p';
}

export interface BibleDrawerCtx {
  target:           BibleTarget | null;
  targets:          BibleTarget[];
  openArc:          ArcRef | null;
  showInMapCount:   number;
  mapTargets:       BibleTarget[] | null;
  historicalDate:   number | null;
  open:             (t: BibleTarget) => void;
  openMany:         (ts: BibleTarget[], arc?: ArcRef) => void;
  close:            () => void;
  triggerShowInMap: (ts?: BibleTarget[]) => void;
  setHistoricalDate: (date: number | null) => void;
}
