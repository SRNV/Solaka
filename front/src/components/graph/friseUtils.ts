import type { BibleBookOrder, HistoricalSubMode } from '@/models/bible';
import type { LayoutResult } from '@/models/graph';

export const COLOR_BY_EVENT_TYPE: Record<string, string> = {
  covenant: '#f0c040', exodus: '#e8956d', conquest: '#e05555',
  monarchy: '#826AED', temple: '#4caf50', exile: '#c0392b',
  return: '#27ae60', reform: '#2980b9', political: '#a0a8c8',
  birth: '#f9dc5c', death: '#888', theological: '#ffffff', prophecy: '#bb8fce',
  writing: '#85c1e9', martyrdom: '#e74c3c', council: '#5dade2',
  revolt: '#e59866', migration: '#a9cce3', missionary: '#a9dfbf',
};

/** Interpolate a year from a world-space X using the sorted year→X mapping. */
export function worldXToYear(worldX: number, yearPoints: { year: number; x: number }[]): number {
  if (yearPoints.length === 0) return 0;
  if (yearPoints.length === 1) return yearPoints[0].year;

  if (worldX <= yearPoints[0].x) {
    const p0 = yearPoints[0], p1 = yearPoints[1];
    return p0.year + ((p1.year - p0.year) / (p1.x - p0.x)) * (worldX - p0.x);
  }
  if (worldX >= yearPoints[yearPoints.length - 1].x) {
    const p0 = yearPoints[yearPoints.length - 2], p1 = yearPoints[yearPoints.length - 1];
    return p1.year + ((p1.year - p0.year) / (p1.x - p0.x)) * (worldX - p1.x);
  }
  for (let i = 0; i < yearPoints.length - 1; i++) {
    const p0 = yearPoints[i], p1 = yearPoints[i + 1];
    if (worldX >= p0.x && worldX <= p1.x) {
      return p0.year + ((p1.year - p0.year) / (p1.x - p0.x)) * (worldX - p0.x);
    }
  }
  return 0;
}

/** Interpolate a world-space X from a year using the sorted year→X mapping. */
export function yearToWorldX(year: number, yearPoints: { year: number; x: number }[]): number {
  if (yearPoints.length === 0) return 0;
  if (yearPoints.length === 1) return yearPoints[0].x;

  if (year <= yearPoints[0].year) {
    const p0 = yearPoints[0], p1 = yearPoints[1];
    return p0.x + ((p1.x - p0.x) / (p1.year - p0.year)) * (year - p0.year);
  }
  if (year >= yearPoints[yearPoints.length - 1].year) {
    const p0 = yearPoints[yearPoints.length - 2], p1 = yearPoints[yearPoints.length - 1];
    return p1.x + ((p1.x - p0.x) / (p1.year - p0.year)) * (year - p1.year);
  }
  for (let i = 0; i < yearPoints.length - 1; i++) {
    const p0 = yearPoints[i], p1 = yearPoints[i + 1];
    if (year >= p0.year && year <= p1.year) {
      return p0.x + ((p1.x - p0.x) / (p1.year - p0.year)) * (year - p0.year);
    }
  }
  return 0;
}

export function buildYearPoints(
  bookOrderData: BibleBookOrder[],
  bookLabels:    LayoutResult['bookLabels'],
  histSubMode:   HistoricalSubMode,
): { year: number; x: number }[] {
  const dateMap  = new Map(bookOrderData.map(b => [b.number, b[histSubMode]]));
  const yearToXs = new Map<number, number[]>();
  for (const b of bookLabels) {
    const dateRange = dateMap.get(b.number);
    if (!dateRange) continue;
    const year = dateRange[0];
    if (!yearToXs.has(year)) yearToXs.set(year, []);
    yearToXs.get(year)!.push((b.startX + b.endX) / 2);
  }
  const pts: { year: number; x: number }[] = [];
  for (const [year, xs] of yearToXs.entries()) {
    pts.push({ year, x: xs.reduce((a, b) => a + b, 0) / xs.length });
  }
  pts.sort((a, b) => a.year - b.year);
  return pts;
}
