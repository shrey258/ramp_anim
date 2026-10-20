// Port of the intro dunes on ramp.com/glass, taken from Ramp's own shaders. Each grain's screen
// position is computed by hand (no 3D camera), lit as a small crystal, then a final pass turns the
// image into Ramp's dark look and later fades to the light one.
export const grainVertex = /* glsl */ `
  attribute float aIntroDepth; // 1 = farthest grain, 0 = nearest; grains are stored far to near
  uniform float uDuneTime;     // dune clock: starts at 1.8, runs at real time
  uniform float uAspect;
  uniform float uFrameAspect;  // Ramp frames the dunes for a 2:1 desktop (0.6 on phones)
  uniform float uPixelRatio;   // target pixels per CSS px of an 850px-tall frame (smaller for blur layers)
  uniform float uLayer;        // 0 sharp grains, 1 far blur layer, 2 near blur layer
  varying vec4 vMaterial;      // x unused, y light, z defocus, w opacity
  varying vec2 vSpark;         // glint strength, sprite growth to fit the glint
  varying float vSeed;
  varying float vFade;

  // Hash without sine (Dave Hoskins, MIT).
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  vec2 hash22(vec2 p) { float n = hash12(p); return vec2(n, hash12(p + n + 19.19)); }

  // Value noise with its slope (x = value, yz = gradient), so lighting needs no extra lookups.
  vec3 noise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
    float a = hash12(cell);
    float b = hash12(cell + vec2(1.0, 0.0));
    float c = hash12(cell + vec2(0.0, 1.0));
    float d = hash12(cell + vec2(1.0));
    float k = a - b - c + d;
    return vec3(a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y,
      du * (vec2(b - a, c - a) + k * u.yx));
  }

  // Broad asymmetric dunes plus folds and fine sand. Returns height and its slope.
  vec3 terrain(vec2 p) {
    vec3 warp = noise(p * vec2(0.62, 0.53) + 4.7);
    float phase = p.y * 1.85 + p.x * 0.72 + (warp.x - 0.5) * 3.6;
    vec2 phaseSlope = vec2(0.72, 1.85) + warp.yz * vec2(0.62, 0.53) * 3.6;
    float ridge = sin(phase) + 0.16 * sin(phase * 2.0 + 0.7);
    float ridgeSlope = cos(phase) + 0.32 * cos(phase * 2.0 + 0.7);
    vec3 folds = noise(p * vec2(1.8, 2.2) - 7.1);
    vec3 sand = noise(p * vec2(5.8, 7.1) + 31.5);
    return vec3(
      ridge * 0.40 + (folds.x - 0.5) * 0.27 + (sand.x - 0.5) * 0.045,
      phaseSlope * ridgeSlope * 0.40 + folds.yz * vec2(1.8, 2.2) * 0.27 + sand.yz * vec2(5.8, 7.1) * 0.045
    );
  }

  void main() {
    // Same identities as Ramp: position.xy is a grid cell, position.z which of its copies.
    vec2 reference = position.xy;
    vSeed = hash12(reference * 719.0);
    vec2 identity = reference + position.z * vec2(0.731, 0.419);
    vec2 distribution = hash22(identity * 971.0 + 31.0);
    float depthSeed = hash12(identity * 1391.0 + 17.0);
    float airborne = smoothstep(0.91, 0.998, depthSeed); // ~9% hop above the surface
    float t = uDuneTime;

    // 1. Spread grains through the view: depth -> distance on the ground, wind slot -> across.
    //    Framed like object-fit: cover, so wide screens zoom in and narrow ones crop the sides.
    float screenDepth = (aIntroDepth - 0.5) * 2.7;
    float ground = 4.5 * screenDepth / (2.108 - screenDepth * 0.58);
    float width = (4.5 + ground * 0.58) / 3.4;
    float cover = max(uAspect / uFrameAspect, 1.0);
    vec2 plane = vec2((fract(distribution.x + t * 0.05) - 0.5) * 2.6 * uFrameAspect * width, ground);
    // Slow currents bend neighbouring paths together.
    float crossing = plane.x * 0.63 + plane.y * 0.82 - t * 0.19;
    plane += vec2(sin(plane.y * 1.3 + t * 0.32) * 0.12 + sin(crossing) * 0.055, cos(crossing) * 0.032);

    // 2. Dunes creep right and toward the viewer.
    vec2 domain = plane + vec2(-t * 0.15, t * 0.19);
    vec3 dune = terrain(domain);
    float hop = sin(t * 0.85 + vSeed * 31.0);
    float elevation = dune.x + (depthSeed - 0.5) * 0.13 + airborne * (0.12 + 0.42 * hop * hop);

    // 3. Hand-made perspective. Height counts more than depth, so dunes fill the screen.
    float cameraDepth = 4.5 + plane.y * 0.58 - elevation * 0.40;
    float perspective = 3.4 / cameraDepth;
    gl_Position = vec4(vec2(plane.x / uAspect, plane.y * 0.62 + elevation * 0.90 + 0.08) * perspective * cover, 0.0, 1.0);

    // 4. Light: slopes facing the key light glow, and a crest upwind shades the trough behind it.
    vec3 normal = normalize(vec3(-dune.y, -dune.z, 1.0));
    float surface = max(0.0, dot(normal, normalize(vec3(-0.68, -0.22, 0.70))));
    float shelter = terrain(domain + vec2(-0.35, -0.12)).x - dune.x;
    float visibility = 1.0 - smoothstep(0.11, 0.30, shelter) * 0.82;
    float light = clamp(0.18 + surface * visibility * 0.74, 0.0, 1.0);

    // 5. Depth of field: sharp at one distance, big faint discs nearer and farther.
    float defocus = smoothstep(0.10, 1.00, abs(cameraDepth - 4.72));
    float size = (1.75 + vSeed * 0.90) * perspective + defocus * defocus * 26.0;
    float opacity = 0.94 / (1.0 + defocus * defocus * 22.0) * mix(1.0, 0.70, airborne);

    // Wide blur goes to low-res layers, split at the focal plane so each sits on its own side.
    float layer = 0.0;
    if (defocus >= 0.5) {
      if (cameraDepth > 4.72 && aIntroDepth >= 0.66) layer = 1.0;
      if (cameraDepth < 4.72 && aIntroDepth <= 0.43) layer = 2.0;
    }

    // A rare polished facet turns through the key light: a slow catch and release.
    vSpark = vec2(0.0, 1.0);
    float polished = smoothstep(0.984, 0.998, hash12(identity * 2153.0 + 73.0));
    if (polished > 0.0) {
      float turn = 0.5 + 0.5 * cos(t * (0.52 + distribution.y * 0.22) + vSeed * 62.83185 + dune.y * 0.6 + dune.z * 0.4);
      float catchLight = polished * pow(turn, 18.0) * visibility * (0.4 + surface * 0.6);
      vSpark = vec2(catchLight, 1.0 + catchLight * mix(13.0, 5.0, defocus) / clamp(size, 0.85, 30.0));
    }
    vMaterial = vec4(1.0, light, defocus, opacity);
    vFade = mix(0.64, 1.0, clamp(0.5 - plane.y * 0.16, 0.0, 1.0)); // the far field sits at 64% opacity

    gl_PointSize = clamp(size, 0.85, 30.0) * uPixelRatio * cover * vSpark.y;
    if (layer != uLayer) gl_Position = vec4(2.0, 2.0, 0.0, 1.0); // drawn in another pass
  }
`

export const grainFragment = /* glsl */ `
  uniform float uDarkTone;
  varying vec4 vMaterial;
  varying vec2 vSpark;
  varying float vSeed;
  varying float vFade;

  void main() {
    // Growing the sprite for a glint must not grow the grain itself.
    float radius = length(gl_PointCoord - 0.5) * 2.0 * vSpark.y;
    float edge = 1.0 - smoothstep(0.78, 1.0, radius);
    float focused = 1.0 - smoothstep(0.48, 0.98, radius);
    float bokeh = exp(-3.2 * radius * radius) * edge;
    float defocus = smoothstep(0.06, 0.6, vMaterial.z);
    float profile = mix(focused, bokeh, defocus);
    if (profile <= 0.0 && vSpark.x <= 0.001) discard;

    // Clear mineral grains in a slate room; champagne is the colour of the light. Linear values.
    vec3 shade = vec3(0.075, 0.095, 0.11);
    vec3 body = vec3(0.24, 0.285, 0.31);
    vec3 key = vec3(1.0, 0.82, 0.56);
    float light = vMaterial.y * mix(0.66, 1.10, vSeed);
    vec3 color = mix(shade, body, smoothstep(0.0, 0.48, light));
    color = mix(color, key, smoothstep(0.35, 0.94, light) * 0.82);

    // In focus, each grain is a cut crystal: a bevelled face and a coloured rim.
    float angle = vSeed * 6.2831853;
    vec2 cut = vec2(cos(angle), sin(angle));
    if (defocus < 1.0) {
      vec2 p = (gl_PointCoord - 0.5) * 2.0 * vSpark.y;
      float face = dot(p, cut);
      float rim = pow(clamp(radius, 0.0, 1.0), 4.0);
      float bevel = smoothstep(0.08, 0.78, face) * (1.0 - rim * 0.45);
      float polish = smoothstep(0.48, 0.94, vSeed);
      vec3 crystal = color * (0.76 + 0.24 * bevel);
      vec3 edgeLight = mix(vec3(0.62, 0.80, 1.04), vec3(1.05, 0.87, 0.63), smoothstep(-0.65, 0.75, face + light * 0.28));
      crystal += edgeLight * rim * (0.07 + polish * 0.14);
      crystal += key * bevel * polish * light * 0.24;
      color = mix(crystal, color, defocus);
    }

    color += vec3(1.12, 0.98, 0.72) * pow(vSeed, 22.0) * pow(vMaterial.y, 3.0); // rare hot catches
    float alpha = profile * vMaterial.w;
    if (vSpark.x > 0.001) {
      vec2 optical = (gl_PointCoord - 0.5) * 2.0;
      vec2 axes = vec2(dot(optical, cut), dot(optical, vec2(-cut.y, cut.x)));
      float r2 = dot(optical, optical);
      float rays = exp(-abs(axes.x) * 42.0 - abs(axes.y) * 5.0) + exp(-abs(axes.y) * 42.0 - abs(axes.x) * 7.0);
      float sharpCatch = exp(-r2 * 38.0) + rays * 0.14 + exp(-r2 * 9.0) * 0.10;
      float sparkAlpha = clamp(mix(sharpCatch, exp(-r2 * 4.8), defocus) * vSpark.x * mix(3.2, 0.25, defocus), 0.0, 0.98);
      // The dark look inverts tone, so there the glint is a dark facet that comes out as light.
      vec3 specular = mix(vec3(4.2, 3.5, 2.6), vec3(0.0001, 0.0004, 0.0010), uDarkTone);
      float combined = alpha + sparkAlpha * (1.0 - alpha);
      color = (color * alpha * (1.0 - sparkAlpha) + specular * sparkAlpha) / max(combined, 0.0001);
      alpha = combined;
    }
    // Light look: the same light level on Ramp's neutral pearl palette (grey shadow -> white).
    float level = dot(color, vec3(0.2126, 0.7152, 0.0722));
    vec3 pearl = mix(mix(vec3(0.576), vec3(0.737, 0.741, 0.745), 0.62), vec3(1.0), smoothstep(0.12, 0.80, level) * 0.90);
    color = mix(pearl, color, uDarkTone);
    if (alpha < 0.001) discard;
    gl_FragColor = vec4(color, alpha * vFade);
  }
`

// Full-screen triangle; the layer pass stretches a low-res blur layer back over the field.
export const quadVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`
export const layerFragment = /* glsl */ `
  uniform sampler2D uLayer;
  varying vec2 vUv;
  void main() { gl_FragColor = texture2D(uLayer, vUv); }
`

// Final pass. The field holds premultiplied linear light.
// Light look: grains over a warm off-white floor with a faint yellow leak from the top left.
// Dark look: each pixel's tone-mapped lightness is inverted and scaled by grain coverage, so
// empty space is black, shaded grains glow and lit faces go dark.
export const compositeFragment = /* glsl */ `
  uniform sampler2D uField;
  uniform float uDarkTone;
  varying vec2 vUv;
  void main() {
    vec4 field = texture2D(uField, vUv);
    vec2 fromSun = vUv - vec2(0.12, 1.08);
    vec2 spread = vec2(dot(fromSun, vec2(0.68, -0.733)), dot(fromSun, vec2(0.733, 0.68))) / vec2(0.75, 0.40);
    vec3 floorColor = clamp(vec3(0.961, 0.957, 0.941) + vec3(0.894, 0.949, 0.133) * exp(-dot(spread, spread) * 1.3) * 0.235, 0.0, 1.0);
    vec3 lightLook = field.rgb + floorColor * (1.0 - field.a);

    vec3 grain = linearToOutputTexel(vec4(toneMapping(field.rgb / max(field.a, 0.0001)), 1.0)).rgb;
    float lightness = dot(grain, vec3(0.2126, 0.7152, 0.0722));
    vec3 darkLook = clamp(vec3(1.0 - lightness) + (grain - lightness) * 0.4, 0.0, 1.0) * field.a;
    gl_FragColor = vec4(mix(lightLook, darkLook, uDarkTone), 1.0);
  }
`
