import { create } from 'zustand';

export interface YearPoint { year: number; x: number }

interface YearMarkersState {
  yearPoints:        YearPoint[];
  scrubberWorldX:    number | null;
  year0WorldX:       number | null;
  scrubberHandleEl:  HTMLDivElement | null;
  canvasContainerEl: HTMLDivElement | null;
  cameraX:           number;
  cameraZoom:        number;
  isCameraMoving:    boolean;
  isZooming:         boolean;
  invalidateCanvas:  (() => void) | null;
  setYearPoints:        (points: YearPoint[])       => void;
  setScrubberWorldX:    (x: number | null)          => void;
  setYear0WorldX:       (x: number | null)          => void;
  setScrubberHandleEl:  (el: HTMLDivElement | null) => void;
  setCanvasContainerEl: (el: HTMLDivElement | null) => void;
  setCameraState:       (x: number, zoom: number)   => void;
  setIsCameraMoving:    (moving: boolean)           => void;
  setIsZooming:         (zooming: boolean)          => void;
  setInvalidateCanvas:  (fn: (() => void) | null)  => void;
}

export const useYearMarkersStore = create<YearMarkersState>(set => ({
  yearPoints:        [],
  scrubberWorldX:    null,
  year0WorldX:       null,
  scrubberHandleEl:  null,
  canvasContainerEl: null,
  cameraX:           0,
  cameraZoom:        1,
  isCameraMoving:    false,
  isZooming:         false,
  invalidateCanvas:  null,
  setYearPoints:        (yearPoints)        => set({ yearPoints }),
  setScrubberWorldX:    (scrubberWorldX)    => set({ scrubberWorldX }),
  setYear0WorldX:       (year0WorldX)       => set({ year0WorldX }),
  setScrubberHandleEl:  (scrubberHandleEl)  => set({ scrubberHandleEl }),
  setCanvasContainerEl: (canvasContainerEl) => set({ canvasContainerEl }),
  setCameraState:       (cameraX, cameraZoom) => set({ cameraX, cameraZoom }),
  setIsCameraMoving:    (isCameraMoving)    => set({ isCameraMoving }),
  setIsZooming:         (isZooming)         => set({ isZooming }),
  setInvalidateCanvas:  (invalidateCanvas)    => set({ invalidateCanvas }),
  setCameraX:           (cameraX)             => set({ cameraX }),
  setCameraZoom:        (cameraZoom)          => set({ cameraZoom }),
}));
