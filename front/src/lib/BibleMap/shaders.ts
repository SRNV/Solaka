export const displayVertex = /* glsl */`
uniform float zoom;
uniform vec2 resolution;

attribute float hover;

varying float vHover;

void main() {
  vHover = hover;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = (zoom * 1.5) * (resolution.y / 1000.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const displayFragment = /* glsl */`
varying float vHover;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  if (length(coord) > 0.5) discard;
  float alpha = vHover > 0.5 ? 1.0 : 0.6;
  gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
}
`;

export const pickerVertex = /* glsl */`
uniform float zoom;
uniform vec2 resolution;

attribute vec3 color;
varying vec3 vColor;

void main() {
  vColor = color;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = (zoom * 1.5) * (resolution.y / 1000.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const pickerFragment = /* glsl */`
varying vec3 vColor;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  if (length(coord) > 0.5) discard;
  gl_FragColor = vec4(vColor, 1.0);
}
`;
