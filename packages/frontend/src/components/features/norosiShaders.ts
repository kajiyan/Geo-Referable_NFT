import * as THREE from 'three'

export const singleVertexShader = `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const singleFragmentShader = `
  precision highp float;
  varying vec2 vUv;

  // Active uniforms
  uniform float uTime;
  uniform vec3  uTopColor;
  uniform vec3  uBottomColor;
  uniform float uOpacity;
  uniform float uSwayAmp;
  uniform float uSwayFreq;
  uniform float uFlowSpeed;
  uniform float uNoiseScale;
  uniform float uNoiseAmp;
  uniform float uEdgeSoftness;
  uniform float uAlphaBoost;
  uniform float uAlphaCurve;
  uniform float uNoiseLow;
  uniform float uNoiseHigh;
  uniform float uBrightness;
  uniform vec2  uResolution;
  uniform float uLod;
  uniform float uSwayPadding;
  uniform float uAspect; // height/width ratio for noise UV correction

  // [COMMENTED OUT] Posterize/halftone uniforms - reserved for future use
  // uniform vec2  uSize;
  // uniform float uLevels;
  // uniform float uGamma;
  // uniform float uThreshold;
  // uniform float uSmoothness;
  // uniform float uDotSize;
  // uniform float uDotDensity;
  // uniform float uColorBoost;
  // uniform float uHalftoneStrength;

  float hash(vec2 p){
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float noise(vec2 p){
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(a, b, u.x) + (c - a)*u.y*(1.0-u.x) + (d - b)*u.x*u.y;
  }

  float fbm(vec2 p){
    float n = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    // Fix: ensure at least 1 octave when LOD=0 (was producing black output)
    int oct = max(1, int(1.0 + uLod));
    for(int i=0;i<3;i++){
      if(i>=oct) break;
      n += amp * noise(p*freq);
      freq *= 2.0;
      amp *= 0.5;
    }
    return n;
  }

  // [COMMENTED OUT] Color space conversion - reserved for future posterize effects
  // vec3 rgb2hsv(vec3 c){
  //   vec4 K = vec4(0., -1./3., 2./3., -1.);
  //   vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  //   vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  //   float d = q.x - min(q.w, q.y);
  //   float e = 1e-10;
  //   return vec3(abs(q.z + (q.w - q.y) / (6.*d + e)), d / (q.x + e), q.x);
  // }
  //
  // vec3 hsv2rgb(vec3 c){
  //   vec3 p = abs(fract(c.xxx + vec3(0., 1./3., 2./3.)) * 6. - 3.);
  //   vec3 a = clamp(p - 1., 0., 1.);
  //   return c.z * mix(vec3(1.), a, c.y);
  // }
  //
  // float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
  //
  // float halftone(vec2 uv, float density){
  //   vec2 p = uv * uResolution * density;
  //   vec2 f = fract(p);
  //   float dist = length(f - 0.5);
  //   return smoothstep(uDotSize, uDotSize * 0.5, dist);
  // }

  void main(){
    vec2 uv = vUv;

    // Remap UV.x to account for wider geometry (sway padding).
    // Geometry is uSwayPadding times wider than the logical smoke body.
    // This gives the sway room to shift without clipping at geometry edges.
    // e.g., uSwayPadding=1.6 maps uv.x 0..1 → -0.3..1.3 in logical space.
    float x = (uv.x - 0.5) * uSwayPadding + 0.5;

    vec3 grad = mix(uBottomColor, uTopColor, smoothstep(0.0, 0.3, uv.y));
    float topFade = smoothstep(0.7, 1.0, uv.y);

    float phase = uTime * uFlowSpeed;
    float swaySin1 = sin(uv.y * (6.28318 * uSwayFreq) + phase) * uSwayAmp;
    float swaySin2 = sin(uv.y * (6.28318 * uSwayFreq * 2.3) + phase * 1.5) * uSwayAmp * 0.3;
    float swaySin = swaySin1 + swaySin2;
    // Aspect-correct UV.y so noise density stays constant in world space.
    // Reference aspect 5.0 (width=10, height=50). Keeps noise scale stable across smoke heights.
    float aspectScale = clamp(uAspect / 5.0, 0.2, 3.0);
    float swayNoise = (fbm(vec2(uv.y * aspectScale * uNoiseScale, phase*0.5)) - 0.5) * uNoiseAmp;
    float sway = (swaySin + swayNoise) * mix(0.6, 1.0, clamp(uLod/2.0, 0.0, 1.0));
    sway *= mix(0.7, 1.0, uv.y);
    float center = 0.5 + sway;
    vec2 noiseUV = vec2(uv.x, uv.y * aspectScale);
    float edgeNoise = noise(noiseUV * vec2(3.0, 8.0) + vec2(uTime * 0.2, 0.0)) * 0.15;
    float falloff = smoothstep(0.0, uEdgeSoftness + edgeNoise, 1.0 - abs(x-center) * 2.0);

    float n1 = fbm(noiseUV*vec2(2.5, 8.0) + vec2(0.0, -uTime*0.8));
    float n2 = fbm(noiseUV*vec2(5.0, 18.0) + vec2(0.0, -uTime*1.6));
    float n = mix(n1, n2, 0.7);
    float alphaBase = falloff * smoothstep(uNoiseLow, uNoiseHigh, n);
    alphaBase = pow(alphaBase, max(0.0001, uAlphaCurve));
    float alpha = clamp(alphaBase * uAlphaBoost, 0.0, 1.0);

    vec3 finalColor = grad;
    finalColor *= uBrightness;

    float finalAlpha = alpha * uOpacity * (1.0 - topFade);
    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export type NorosiUniforms = {
  // Active uniforms
  uTime: THREE.IUniform;
  uTopColor: THREE.IUniform<THREE.Color>;
  uBottomColor: THREE.IUniform<THREE.Color>;
  uOpacity: THREE.IUniform;
  uSwayAmp: THREE.IUniform;
  uSwayFreq: THREE.IUniform;
  uFlowSpeed: THREE.IUniform;
  uNoiseScale: THREE.IUniform;
  uNoiseAmp: THREE.IUniform;
  uEdgeSoftness: THREE.IUniform;
  uAlphaBoost: THREE.IUniform;
  uAlphaCurve: THREE.IUniform;
  uNoiseLow: THREE.IUniform;
  uNoiseHigh: THREE.IUniform;
  uBrightness: THREE.IUniform;
  uResolution: THREE.IUniform<THREE.Vector2>;
  uLod: THREE.IUniform;
  uSwayPadding: THREE.IUniform;
  uAspect: THREE.IUniform;

  // [COMMENTED OUT] Posterize/halftone uniforms - reserved for future use
  // uSize: THREE.IUniform<THREE.Vector2>;
  // uLevels: THREE.IUniform;
  // uGamma: THREE.IUniform;
  // uThreshold: THREE.IUniform;
  // uSmoothness: THREE.IUniform;
  // uDotSize: THREE.IUniform;
  // uDotDensity: THREE.IUniform;
  // uColorBoost: THREE.IUniform;
  // uHalftoneStrength: THREE.IUniform;
};

export interface NorosiUniformDefaults {
  width: number;
  height: number;
  topColor: string;
  bottomColor: string;
  opacity: number;
  swayAmplitude: number;
  swayFrequency: number;
  flowSpeed: number;
  noiseScale: number;
  noiseAmplitude: number;
  edgeSoftness: number;
  densityBoost: number;
  alphaCurve: number;
  noiseLow: number;
  noiseHigh: number;
  brightness: number;
  targetWidthPx: number;
  lod: 'low' | 'medium' | 'high';
  swayPadding: number;

  // [COMMENTED OUT] Posterize/halftone settings - reserved for future use
  // posterize: {
  //   levels: number;
  //   gamma: number;
  //   brightness: number;
  //   threshold: number;
  //   smoothness: number;
  //   dotSize: number;
  //   dotDensity: number;
  //   colorBoost: number;
  //   halftoneStrength: number;
  // };
}

export function createNorosiUniforms(defaults: NorosiUniformDefaults): NorosiUniforms {
  const { width, height, topColor, bottomColor, opacity, swayAmplitude, swayFrequency, flowSpeed, noiseScale, noiseAmplitude, edgeSoftness, densityBoost, alphaCurve, noiseLow, noiseHigh, brightness, targetWidthPx, lod, swayPadding } = defaults;

  const resolutionY = Math.max(1, Math.floor(targetWidthPx / (width / height)));

  return {
    // Active uniforms
    uTime: { value: 0 },
    uTopColor: { value: new THREE.Color(topColor) },
    uBottomColor: { value: new THREE.Color(bottomColor) },
    uOpacity: { value: opacity },
    uSwayAmp: { value: swayAmplitude },
    uSwayFreq: { value: swayFrequency },
    uFlowSpeed: { value: flowSpeed },
    uNoiseScale: { value: noiseScale },
    uNoiseAmp: { value: noiseAmplitude },
    uEdgeSoftness: { value: edgeSoftness },
    uAlphaBoost: { value: densityBoost },
    uAlphaCurve: { value: alphaCurve },
    uNoiseLow: { value: noiseLow },
    uNoiseHigh: { value: noiseHigh },
    uBrightness: { value: brightness },
    uResolution: { value: new THREE.Vector2(targetWidthPx, resolutionY) },
    uLod: { value: lod === 'low' ? 0.0 : lod === 'medium' ? 1.0 : 2.0 },
    uSwayPadding: { value: swayPadding },
    uAspect: { value: height / width },

    // [COMMENTED OUT] Posterize/halftone uniforms - reserved for future use
    // uSize: { value: new THREE.Vector2(width, height) },
    // uLevels: { value: posterize.levels },
    // uGamma: { value: posterize.gamma },
    // uThreshold: { value: posterize.threshold },
    // uSmoothness: { value: posterize.smoothness },
    // uDotSize: { value: posterize.dotSize },
    // uDotDensity: { value: posterize.dotDensity },
    // uColorBoost: { value: posterize.colorBoost },
    // uHalftoneStrength: { value: posterize.halftoneStrength },
  };
}

export function toLodValue(lod: 'low' | 'medium' | 'high'): number {
  if (lod === 'low') return 0.0;
  if (lod === 'medium') return 1.0;
  return 2.0;
}
