/** Side length of one verse cube in world units. */
export const CUBE_S   = 0.4;
/** Y distance between consecutive verse cubes within the same chapter column. */
export const V_STEP   = CUBE_S + 0.05;
/** X distance between consecutive chapter columns within the same book. */
export const CH_STEP  = CUBE_S + 0.3;
/** Extra X gap added between books. */
export const BK_PAD   = 1.5;
/** Number of Bézier subdivisions per arc relation segment. */
export const ARC_SEGS = 20;

/** Maximum tick length for a brace bar end-cap. */
export const BRACE_TICK   = 0.18;
/** Minimum gap between the cube edge and the nearest brace bar. */
export const BRACE_MARGIN = 0.03;
/** Total X space available for stacking brace bars in one inter-chapter gap. */
export const BRACE_AVAIL  = CH_STEP / 2 - CUBE_S / 2 - BRACE_MARGIN;

/** Half-width of the invisible hit quad drawn over each arc segment. */
export const HIT_W              = 4.0;
/** Pointer proximity threshold (world units) for registering an arc hover. */
export const HIT_PROX           = 3.0;
/** Orthographic zoom level at which brace circle overlays become visible. */
export const CIRCLE_ZOOM_THRESH = 15;
/** Diameter of each brace circle overlay in CSS pixels. */
export const CIRCLE_PX          = 16;
/** Minimum Y separation between two circles on the same brace bar (world units). */
export const CIRCLE_SEP         = (CIRCLE_PX + 4) / CIRCLE_ZOOM_THRESH;

/** Duration of cube-position and arc-position animations in seconds. */
export const ANIM_DURATION = 0.55;

/**
 * Smooth in-out cubic easing.
 * @param t - Progress in [0, 1].
 * @returns Eased value in [0, 1].
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
