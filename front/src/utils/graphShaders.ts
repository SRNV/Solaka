import * as THREE from 'three';

/**
 * Vertex shader for arc rendering.
 *
 * Expands each line segment into a screen-space quad (`aSide = ±1`) with pixel-accurate
 * width, animates arc height from zero via a smooth-step birth animation (`aArcBorn`),
 * and passes per-vertex attributes (colour gradient, pulse speed, relation index) to the
 * fragment shader.
 */
export const VERT = /* glsl */`
uniform vec2  uResolution;
uniform float uLinePx;
uniform float uTime;
uniform float uAnimDur;
uniform float uHeightScale;
uniform float uHorizontalScale;
attribute vec3  aDir;
attribute float aSide;
attribute float aColorT;
attribute float aProg;
attribute float aArcSpeed;
attribute float aRelIdx;
attribute float aIsAuthority;
attribute float aCatholic;
attribute float aArcBorn;
varying vec3  vColor;
varying float vProg;
varying float vArcSpeed;
varying float vRelIdx;
varying float vIsAuthority;
varying float vSide;
varying float vCatholic;
vec3 grad(float t) {
  vec3 w = vec3(0.976,0.863,0.361);
  vec3 p = vec3(0.231,0.957,0.984);
  vec3 s = vec3(0.784,0.475,1.0);
  return t < 0.5 ? mix(w,p,t*2.0) : mix(p,s,(t-0.5)*2.0);
}
void main() {
  float age     = max(0.0, uTime - aArcBorn);
  float rawT    = clamp(age / max(uAnimDur, 0.001), 0.0, 1.0);
  float eased   = rawT * rawT * (3.0 - 2.0 * rawT);
  vec3 animPos  = vec3(position.x * uHorizontalScale, position.y * eased * uHeightScale, position.z);
  vec3 animDir  = vec3(aDir.x * uHorizontalScale, aDir.y * eased * uHeightScale, aDir.z);
  vec3 safeDir  = length(animDir) < 0.001 ? vec3(1.0, 0.0, 0.0) : animDir;
  vec4 clipPos  = projectionMatrix * modelViewMatrix * vec4(animPos, 1.0);
  vec4 clipNext = projectionMatrix * modelViewMatrix * vec4(animPos + normalize(safeDir), 1.0);
  vec2 dir      = normalize(clipNext.xy/clipNext.w - clipPos.xy/clipPos.w);
  vec2 normal   = vec2(-dir.y, dir.x);
  clipPos.xy   += normal * aSide * uLinePx * vec2(2.0/uResolution.x, 2.0/uResolution.y) * clipPos.w;
  gl_Position   = clipPos;
  vColor        = grad(aColorT);
  vProg         = aProg;
  vArcSpeed     = aArcSpeed;
  vRelIdx       = aRelIdx;
  vIsAuthority  = aIsAuthority;
  vSide         = aSide;
  vCatholic     = aCatholic;
}`;

/**
 * Fragment shader for arc rendering.
 *
 * Draws a travelling pulse along each arc, highlights hovered relations with a warm
 * colour, desaturates Protestant arcs, and blinks authority-verse arcs with a purple
 * outline.
 */
export const FRAG = /* glsl */`
uniform float uTime;
uniform float uAnimate;
uniform vec3  uBaseColor;
uniform float uHoveredRel;
uniform float uZoomT;
varying vec3  vColor;
varying float vProg;
varying float vArcSpeed;
varying float vRelIdx;
varying float vIsAuthority;
varying float vSide;
varying float vCatholic;
void main() {
  float speed      = vArcSpeed * (1.0 - uZoomT);
  float pulseT     = fract(uTime * speed);
  float d          = abs(vProg - pulseT);
  d                = min(d, 1.0 - d);
  float halfW      = mix(0.08, 0.51, uZoomT);
  float edge       = max(halfW - 0.075, 0.001);
  float pulseW     = mix(smoothstep(halfW, edge, d), 1.0, uZoomT);
  vec3  animCol    = mix(uBaseColor, vColor, pulseW);
  float isHovered  = 1.0 - step(0.5, abs(vRelIdx - uHoveredRel));
  vec3  warningCol = vec3(0.976, 0.863, 0.361);
  vec3  baseColor  = mix(vColor, animCol, uAnimate * (1.0 - isHovered));
  vec3  finalColor = mix(baseColor, warningCol, isHovered);
  float luma       = dot(finalColor, vec3(0.299, 0.587, 0.114));
  finalColor       = mix(vec3(luma), finalColor, mix(0.33, 1.0, vCatholic));
  float blink      = (0.5 + 0.5 * sin(uTime * 10.0)) * vIsAuthority;
  finalColor       = mix(finalColor, vec3(1.0), blink * (1.0 - isHovered));
  vec3  secCol     = vec3(0.784, 0.475, 1.0);
  float outline    = smoothstep(0.55, 0.95, abs(vSide)) * vIsAuthority;
  finalColor       = mix(finalColor, secCol, outline);
  float alpha      = mix(0.55, 0.92, isHovered);
  gl_FragColor     = vec4(finalColor, alpha);
}`;

/**
 * CPU-side equivalent of the GLSL `grad()` function — used to tint brace circles.
 * @param t - Arc height ratio in [0, 1] (short arc → warm yellow, tall arc → violet).
 * @returns Interpolated THREE.Color along the warm → cyan → violet gradient.
 */
export function gradColor(t: number): THREE.Color {
  const w = new THREE.Color(0.976, 0.863, 0.361);
  const p = new THREE.Color(0.231, 0.957, 0.984);
  const s = new THREE.Color(0.784, 0.475, 1.0);
  return t < 0.5 ? w.lerp(p, t * 2) : p.lerp(s, (t - 0.5) * 2);
}
