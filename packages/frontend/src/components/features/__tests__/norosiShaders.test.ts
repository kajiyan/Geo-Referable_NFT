import { createNorosiUniforms, toLodValue } from '../norosiShaders'
import * as THREE from 'three'

// Mock Three.js
jest.mock('three', () => ({
  Vector2: jest.fn().mockImplementation((x = 0, y = 0) => ({ x, y })),
  Color: jest.fn().mockImplementation((_color) => ({
    r: 1, g: 1, b: 1,
    setHex: jest.fn(),
    getHex: jest.fn(() => 0xffffff),
  })),
}))

describe('norosiShaders', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createNorosiUniforms', () => {
    // Updated to use top-level brightness instead of posterize object
    // (posterize/halftone feature is commented out for future use)
    const defaultParams = {
      width: 2,
      height: 6,
      topColor: '#ff6b6b',
      bottomColor: '#cc5555',
      opacity: 1.0,
      swayAmplitude: 0.15,
      swayFrequency: 1.0,
      flowSpeed: 0.8,
      noiseScale: 1.0,
      noiseAmplitude: 0.5,
      edgeSoftness: 0.1,
      densityBoost: 1.0,
      alphaCurve: 1.0,
      noiseLow: 0.0,
      noiseHigh: 1.0,
      brightness: 1.0,
      targetWidthPx: 100,
      lod: 'medium' as const,
      swayPadding: 1.6,
    }

    it('should create uniforms with all required properties', () => {
      const uniforms = createNorosiUniforms(defaultParams)

      // Check that all expected uniform properties exist
      // Note: posterize uniforms (uSize, uLevels, uGamma, etc.) are commented out
      const expectedProperties = [
        'uTime', 'uTopColor', 'uBottomColor', 'uOpacity',
        'uSwayAmp', 'uSwayFreq', 'uFlowSpeed', 'uNoiseScale', 'uNoiseAmp',
        'uEdgeSoftness', 'uAlphaBoost', 'uAlphaCurve', 'uNoiseLow', 'uNoiseHigh',
        'uBrightness', 'uResolution', 'uLod'
      ]

      expectedProperties.forEach(prop => {
        expect(uniforms).toHaveProperty(prop)
        expect(uniforms[prop as keyof typeof uniforms]).toHaveProperty('value')
      })
    })

    it('should initialize uTime to 0', () => {
      const uniforms = createNorosiUniforms(defaultParams)
      expect(uniforms.uTime.value).toBe(0)
    })

    // [REMOVED] uSize test - posterize feature commented out
    // it('should create Vector2 for uSize with correct dimensions', () => {
    //   const uniforms = createNorosiUniforms(defaultParams)
    //   expect(THREE.Vector2).toHaveBeenCalledWith(defaultParams.width, defaultParams.height)
    //   expect(uniforms.uSize.value).toEqual({ x: defaultParams.width, y: defaultParams.height })
    // })

    it('should create Color objects for top and bottom colors', () => {
      const uniforms = createNorosiUniforms(defaultParams)

      expect(THREE.Color).toHaveBeenCalledWith(defaultParams.topColor)
      expect(THREE.Color).toHaveBeenCalledWith(defaultParams.bottomColor)
      expect(uniforms.uTopColor.value).toBeDefined()
      expect(uniforms.uBottomColor.value).toBeDefined()
    })

    it('should correctly map basic parameters to uniforms', () => {
      const uniforms = createNorosiUniforms(defaultParams)

      expect(uniforms.uOpacity.value).toBe(defaultParams.opacity)
      expect(uniforms.uSwayAmp.value).toBe(defaultParams.swayAmplitude)
      expect(uniforms.uSwayFreq.value).toBe(defaultParams.swayFrequency)
      expect(uniforms.uFlowSpeed.value).toBe(defaultParams.flowSpeed)
      expect(uniforms.uNoiseScale.value).toBe(defaultParams.noiseScale)
      expect(uniforms.uNoiseAmp.value).toBe(defaultParams.noiseAmplitude)
      expect(uniforms.uEdgeSoftness.value).toBe(defaultParams.edgeSoftness)
      expect(uniforms.uAlphaBoost.value).toBe(defaultParams.densityBoost)
      expect(uniforms.uAlphaCurve.value).toBe(defaultParams.alphaCurve)
      expect(uniforms.uNoiseLow.value).toBe(defaultParams.noiseLow)
      expect(uniforms.uNoiseHigh.value).toBe(defaultParams.noiseHigh)
    })

    // [REMOVED] posterize test - feature commented out, brightness is now top-level
    // it('should correctly map posterize parameters to uniforms', () => {
    //   const uniforms = createNorosiUniforms(defaultParams)
    //   expect(uniforms.uLevels.value).toBe(defaultParams.posterize.levels)
    //   expect(uniforms.uGamma.value).toBe(defaultParams.posterize.gamma)
    //   expect(uniforms.uBrightness.value).toBe(defaultParams.posterize.brightness)
    //   expect(uniforms.uThreshold.value).toBe(defaultParams.posterize.threshold)
    //   expect(uniforms.uSmoothness.value).toBe(defaultParams.posterize.smoothness)
    //   expect(uniforms.uDotSize.value).toBe(defaultParams.posterize.dotSize)
    //   expect(uniforms.uDotDensity.value).toBe(defaultParams.posterize.dotDensity)
    //   expect(uniforms.uColorBoost.value).toBe(defaultParams.posterize.colorBoost)
    //   expect(uniforms.uHalftoneStrength.value).toBe(defaultParams.posterize.halftoneStrength)
    // })

    it('should correctly map brightness to uBrightness uniform', () => {
      const uniforms = createNorosiUniforms(defaultParams)
      expect(uniforms.uBrightness.value).toBe(defaultParams.brightness)
    })

    it('should calculate resolution correctly', () => {
      const uniforms = createNorosiUniforms(defaultParams)

      const expectedResolutionY = Math.max(1, Math.floor(defaultParams.targetWidthPx / (defaultParams.width / defaultParams.height)))

      expect(THREE.Vector2).toHaveBeenCalledWith(defaultParams.targetWidthPx, expectedResolutionY)
      expect(uniforms.uResolution.value).toBeDefined()
    })

    it('should handle different LOD values correctly', () => {
      const lodTestCases = [
        { lod: 'low' as const, expected: 0.0 },
        { lod: 'medium' as const, expected: 1.0 },
        { lod: 'high' as const, expected: 2.0 },
      ]

      lodTestCases.forEach(({ lod, expected }) => {
        const uniforms = createNorosiUniforms({ ...defaultParams, lod })
        expect(uniforms.uLod.value).toBe(expected)
      })
    })

    it('should handle edge case dimensions', () => {
      const edgeCases = [
        { width: 0.1, height: 0.1, targetWidthPx: 1 },
        { width: 100, height: 200, targetWidthPx: 1000 },
        { width: 1, height: 10, targetWidthPx: 50 },
      ]

      edgeCases.forEach(({ width, height, targetWidthPx }) => {
        const params = { ...defaultParams, width, height, targetWidthPx }
        const uniforms = createNorosiUniforms(params)

        const expectedResolutionY = Math.max(1, Math.floor(targetWidthPx / (width / height)))

        // Note: uSize is now commented out (posterize feature)
        expect(uniforms.uResolution.value).toEqual({ x: targetWidthPx, y: expectedResolutionY })
      })
    })

    it('should ensure minimum resolution Y of 1', () => {
      const params = {
        ...defaultParams,
        width: 1000, // Very wide
        height: 1,   // Very short
        targetWidthPx: 10, // Small target
      }

      const uniforms = createNorosiUniforms(params)
      expect(uniforms.uResolution.value.y).toBeGreaterThanOrEqual(1)
    })

    it('should handle different color formats', () => {
      const colorTests = [
        { topColor: '#ffffff', bottomColor: '#000000' },
        { topColor: 'red', bottomColor: 'blue' },
        { topColor: 'rgb(255,0,0)', bottomColor: 'hsl(240,100%,50%)' },
      ]

      colorTests.forEach(({ topColor, bottomColor }) => {
        const params = { ...defaultParams, topColor, bottomColor }
        const uniforms = createNorosiUniforms(params)

        expect(THREE.Color).toHaveBeenCalledWith(topColor)
        expect(THREE.Color).toHaveBeenCalledWith(bottomColor)
        expect(uniforms.uTopColor.value).toBeDefined()
        expect(uniforms.uBottomColor.value).toBeDefined()
      })
    })

    it('should handle extreme parameter values', () => {
      const extremeParams = {
        ...defaultParams,
        opacity: 0,
        swayAmplitude: 0,
        swayFrequency: 100,
        flowSpeed: 0.001,
        noiseScale: 1000,
        noiseAmplitude: 0,
        edgeSoftness: 1,
        densityBoost: 10,
        alphaCurve: 0.1,
        noiseLow: -1,
        noiseHigh: 2,
      }

      const uniforms = createNorosiUniforms(extremeParams)

      expect(uniforms.uOpacity.value).toBe(0)
      expect(uniforms.uSwayAmp.value).toBe(0)
      expect(uniforms.uSwayFreq.value).toBe(100)
      expect(uniforms.uFlowSpeed.value).toBe(0.001)
      expect(uniforms.uNoiseScale.value).toBe(1000)
      expect(uniforms.uNoiseAmp.value).toBe(0)
      expect(uniforms.uEdgeSoftness.value).toBe(1)
      expect(uniforms.uAlphaBoost.value).toBe(10)
      expect(uniforms.uAlphaCurve.value).toBe(0.1)
      expect(uniforms.uNoiseLow.value).toBe(-1)
      expect(uniforms.uNoiseHigh.value).toBe(2)
    })

    // [REMOVED] posterize test - feature commented out
    // it('should handle extreme posterize values', () => {
    //   const extremePosterize = {
    //     levels: 256,
    //     gamma: 0.1,
    //     brightness: 5.0,
    //     threshold: 0.0,
    //     smoothness: 1.0,
    //     dotSize: 0.01,
    //     dotDensity: 100,
    //     colorBoost: 10,
    //     halftoneStrength: 1.0,
    //   }
    //   const params = { ...defaultParams, posterize: extremePosterize }
    //   const uniforms = createNorosiUniforms(params)
    //   expect(uniforms.uLevels.value).toBe(256)
    //   expect(uniforms.uGamma.value).toBe(0.1)
    //   expect(uniforms.uBrightness.value).toBe(5.0)
    //   expect(uniforms.uThreshold.value).toBe(0.0)
    //   expect(uniforms.uSmoothness.value).toBe(1.0)
    //   expect(uniforms.uDotSize.value).toBe(0.01)
    //   expect(uniforms.uDotDensity.value).toBe(100)
    //   expect(uniforms.uColorBoost.value).toBe(10)
    //   expect(uniforms.uHalftoneStrength.value).toBe(1.0)
    // })

    it('should handle extreme brightness values', () => {
      const params = { ...defaultParams, brightness: 5.0 }
      const uniforms = createNorosiUniforms(params)
      expect(uniforms.uBrightness.value).toBe(5.0)
    })
  })

  describe('toLodValue', () => {
    it('should convert low LOD to 0.0', () => {
      expect(toLodValue('low')).toBe(0.0)
    })

    it('should convert medium LOD to 1.0', () => {
      expect(toLodValue('medium')).toBe(1.0)
    })

    it('should convert high LOD to 2.0', () => {
      expect(toLodValue('high')).toBe(2.0)
    })

    it('should handle undefined by defaulting to high', () => {
      expect(toLodValue(undefined as any)).toBe(2.0)
    })

    it('should handle invalid LOD values by defaulting to high', () => {
      const invalidLods = ['invalid', '', null, 123, {}, []]

      invalidLods.forEach((invalidLod) => {
        expect(toLodValue(invalidLod as any)).toBe(2.0)
      })
    })
  })

  describe('shader compilation', () => {
    it('should have vertex and fragment shaders defined', () => {
      const { singleVertexShader, singleFragmentShader } = require('../norosiShaders')

      expect(typeof singleVertexShader).toBe('string')
      expect(typeof singleFragmentShader).toBe('string')
      expect(singleVertexShader.length).toBeGreaterThan(0)
      expect(singleFragmentShader.length).toBeGreaterThan(0)
    })

    it('should include required uniform declarations in shaders', () => {
      const { singleVertexShader, singleFragmentShader } = require('../norosiShaders')

      // Check for key uniforms in the shaders
      // Note: uSize is now commented out (posterize feature)
      const keyUniforms = ['uTime', 'uTopColor', 'uBottomColor']

      keyUniforms.forEach(uniform => {
        const hasUniformInVertex = singleVertexShader.includes(uniform)
        const hasUniformInFragment = singleFragmentShader.includes(uniform)

        // At least one shader should contain the uniform
        expect(hasUniformInVertex || hasUniformInFragment).toBe(true)
      })
    })

    it('should have proper GLSL syntax structure', () => {
      const { singleVertexShader, singleFragmentShader } = require('../norosiShaders')

      // Basic GLSL syntax checks
      expect(singleVertexShader).toMatch(/void\s+main\s*\(\s*\)/)
      expect(singleFragmentShader).toMatch(/void\s+main\s*\(\s*\)/)

      // Should have proper precision declarations for fragment shader
      expect(singleFragmentShader).toMatch(/precision\s+(lowp|mediump|highp)\s+float/)
    })
  })

  describe('uniform value types', () => {
    // Updated to use top-level brightness instead of posterize object
    const testParams = {
      width: 2,
      height: 6,
      topColor: '#ff6b6b',
      bottomColor: '#cc5555',
      opacity: 1.0,
      swayAmplitude: 0.15,
      swayFrequency: 1.0,
      flowSpeed: 0.8,
      noiseScale: 1.0,
      noiseAmplitude: 0.5,
      edgeSoftness: 0.1,
      densityBoost: 1.0,
      alphaCurve: 1.0,
      noiseLow: 0.0,
      noiseHigh: 1.0,
      brightness: 1.0,
      targetWidthPx: 100,
      lod: 'medium' as const,
      swayPadding: 1.6,
    }

    it('should create proper uniform value structure', () => {
      const uniforms = createNorosiUniforms(testParams)

      // Check that all uniforms have the correct { value: ... } structure
      Object.entries(uniforms).forEach(([, uniform]) => {
        expect(uniform).toHaveProperty('value')
        expect(typeof uniform).toBe('object')
        expect(Object.keys(uniform)).toEqual(['value'])
      })
    })

    it('should have appropriate value types for each uniform', () => {
      const uniforms = createNorosiUniforms(testParams)

      // Numbers (posterize uniforms removed)
      const numberUniforms = ['uTime', 'uOpacity', 'uSwayAmp', 'uSwayFreq', 'uFlowSpeed', 'uNoiseScale', 'uNoiseAmp', 'uEdgeSoftness', 'uAlphaBoost', 'uAlphaCurve', 'uNoiseLow', 'uNoiseHigh', 'uBrightness', 'uLod']

      numberUniforms.forEach(uniformName => {
        expect(typeof uniforms[uniformName as keyof typeof uniforms].value).toBe('number')
      })

      // Vector2 objects (uSize removed - posterize feature)
      const vector2Uniforms = ['uResolution']
      vector2Uniforms.forEach(uniformName => {
        const value = uniforms[uniformName as keyof typeof uniforms].value
        expect(value).toHaveProperty('x')
        expect(value).toHaveProperty('y')
        expect(typeof value.x).toBe('number')
        expect(typeof value.y).toBe('number')
      })

      // Color objects
      const colorUniforms = ['uTopColor', 'uBottomColor']
      colorUniforms.forEach(uniformName => {
        const value = uniforms[uniformName as keyof typeof uniforms].value
        expect(value).toHaveProperty('r')
        expect(value).toHaveProperty('g')
        expect(value).toHaveProperty('b')
      })
    })
  })
})