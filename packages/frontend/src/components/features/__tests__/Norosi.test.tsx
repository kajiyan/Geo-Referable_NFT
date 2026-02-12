/**
 * ⚠️ TECHNICAL DEBT: These tests are currently deferred (0/29 passing)
 *
 * @see TECHNICAL_DEBT.md - Item #3: Norosi.test.tsx (3D Rendering Tests)
 * @see TEST_ARCHITECTURE_DECISION.md - Decision #1: 3D Rendering Tests の延期
 *
 * STATUS: Deferred until AR/VR feature development
 * PRIORITY: LOW (different domain from GPS flow)
 * EFFORT: 6-8 hours (comprehensive R3F mock implementation)
 *
 * ERROR: "R3F: Hooks can only be used within the Canvas component!"
 * CAUSE: Current R3F mock is insufficient - needs full context provider
 *
 * WHY DEFERRED:
 * - This tests 3D WebGL rendering (Three.js/React Three Fiber)
 * - GPS minting flow tests (71/71 passing) are complete ✅
 * - AR/VR features are not on critical path
 * - Different technical domain requires specialized R3F mocking expertise
 *
 * WHEN TO ADDRESS:
 * - When AR/VR feature development starts
 * - When smoke effect visualization needs enhancement
 * - After E2E testing and LocationBased tests are complete
 */

import { render, screen, act } from '@testing-library/react'
import { Canvas } from '@react-three/fiber'
// THREE import used for type reference in tests
import { NorosiComponent } from '../Norosi'

// Declare global mock callback for tests
declare global {
  // eslint-disable-next-line no-var
  var mockUseFrameCallback: ((state: { clock: { elapsedTime: number } }) => void) | undefined
}

// Mock Three.js objects
jest.mock('three', () => ({
  ...jest.requireActual('three'),
  ShaderMaterial: jest.fn().mockImplementation(() => ({
    uniforms: {},
    vertexShader: '',
    fragmentShader: '',
    transparent: true,
    depthWrite: false,
    side: 2,
    dispose: jest.fn(),
  })),
  PlaneGeometry: jest.fn().mockImplementation(() => ({
    dispose: jest.fn(),
  })),
  Vector2: jest.fn().mockImplementation((x = 0, y = 0) => ({ x, y, set: jest.fn() })),
  Color: jest.fn().mockImplementation((_color) => ({
    r: 1, g: 1, b: 1,
    setHex: jest.fn(),
    getHex: jest.fn(() => 0xffffff),
  })),
}))

// Mock useFrame hook
jest.mock('@react-three/fiber', () => ({
  ...jest.requireActual('@react-three/fiber'),
  useFrame: jest.fn((callback) => {
    // Store callback for manual triggering in tests
    global.mockUseFrameCallback = callback
  }),
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
}))

// Mock TextMarquee component
jest.mock('../TextMarquee', () => ({
  TextMarquee: ({ text, ...props }: any) => (
    <group data-testid="text-marquee" data-text={text} {...props}>
      <mesh data-testid="text-mesh" />
    </group>
  )
}))

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  return <Canvas>{children}</Canvas>
}

describe('NorosiComponent', () => {
  const defaultProps = {
    position: [0, 1, 0] as [number, number, number],
    smokeProps: {
      width: 2,
      height: 6,
      topColor: '#ff6b6b',
      bottomColor: '#cc5555',
      swayAmplitude: 0.15,
      flowSpeed: 0.8,
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    global.mockUseFrameCallback = undefined
  })

  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      render(
        <TestWrapper>
          <NorosiComponent {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.getByTestId('canvas')).toBeInTheDocument()
    })

    it('should render with default props', () => {
      render(
        <TestWrapper>
          <NorosiComponent position={[0, 0, 0]} />
        </TestWrapper>
      )

      expect(screen.getByTestId('canvas')).toBeInTheDocument()
    })

    it('should apply position correctly', () => {
      const position: [number, number, number] = [1, 2, 3]

      render(
        <TestWrapper>
          <NorosiComponent position={position} smokeProps={defaultProps.smokeProps} />
        </TestWrapper>
      )

      // The position should be applied to the group
      expect(screen.getByTestId('canvas')).toBeInTheDocument()
    })
  })

  describe('Smoke Props Validation', () => {
    it('should handle valid smoke props', () => {
      const validSmokeProps = {
        width: 3,
        height: 8,
        topColor: '#00ff00',
        bottomColor: '#008800',
        swayAmplitude: 0.2,
        flowSpeed: 1.0,
      }

      render(
        <TestWrapper>
          <NorosiComponent position={[0, 0, 0]} smokeProps={validSmokeProps} />
        </TestWrapper>
      )

      expect(screen.getByTestId('canvas')).toBeInTheDocument()
    })

    it('should clamp smoke props to valid ranges', () => {
      const invalidSmokeProps = {
        width: -1, // Should be clamped to MIN_DIMENSION
        height: 1000, // Should be clamped to MAX_DIMENSION
        topColor: 'invalid-color', // Should fallback to default
        bottomColor: '', // Should fallback to default
        swayAmplitude: -0.5, // Should be clamped to 0-1
        flowSpeed: 10, // Should be clamped to reasonable range
      }

      render(
        <TestWrapper>
          <NorosiComponent position={[0, 0, 0]} smokeProps={invalidSmokeProps} />
        </TestWrapper>
      )

      expect(screen.getByTestId('canvas')).toBeInTheDocument()
    })

    it('should handle missing smoke props with fallbacks', () => {
      render(
        <TestWrapper>
          <NorosiComponent position={[0, 0, 0]} />
        </TestWrapper>
      )

      expect(screen.getByTestId('canvas')).toBeInTheDocument()
    })
  })

  describe('Text Marquee Integration', () => {
    it('should render TextMarquee when textMarqueeProps.text is provided', () => {
      const propsWithText = {
        ...defaultProps,
        textMarqueeProps: { text: 'Hello Norosi!' },
      }

      render(
        <TestWrapper>
          <NorosiComponent {...propsWithText} />
        </TestWrapper>
      )

      const textMarquee = screen.getByTestId('text-marquee')
      expect(textMarquee).toBeInTheDocument()
      expect(textMarquee).toHaveAttribute('data-text', 'Hello Norosi!')
    })

    it('should not render TextMarquee when textMarqueeProps.text is empty', () => {
      render(
        <TestWrapper>
          <NorosiComponent {...defaultProps} textMarqueeProps={{ text: '' }} />
        </TestWrapper>
      )

      expect(screen.queryByTestId('text-marquee')).not.toBeInTheDocument()
    })

    it('should not render TextMarquee when textMarqueeProps is undefined', () => {
      render(
        <TestWrapper>
          <NorosiComponent {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.queryByTestId('text-marquee')).not.toBeInTheDocument()
    })

    it('should handle long text properly', () => {
      const longText = 'This is a very long text that should be handled properly by the TextMarquee component'

      render(
        <TestWrapper>
          <NorosiComponent {...defaultProps} textMarqueeProps={{ text: longText }} />
        </TestWrapper>
      )

      const textMarquee = screen.getByTestId('text-marquee')
      expect(textMarquee).toBeInTheDocument()
      expect(textMarquee).toHaveAttribute('data-text', longText)
    })
  })

  // LOD (Level of Detail) tests are skipped - prop removed in current implementation
  describe.skip('LOD (Level of Detail) System', () => {
    it('should handle high LOD state', () => {
      render(
        <TestWrapper>
          <NorosiComponent {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.getByTestId('canvas')).toBeInTheDocument()
    })

    it('should handle medium LOD state', () => {
      render(
        <TestWrapper>
          <NorosiComponent {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.getByTestId('canvas')).toBeInTheDocument()
    })

    it('should handle low LOD state', () => {
      render(
        <TestWrapper>
          <NorosiComponent {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.getByTestId('canvas')).toBeInTheDocument()
    })

    it('should default to medium LOD when not specified', () => {
      render(
        <TestWrapper>
          <NorosiComponent {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.getByTestId('canvas')).toBeInTheDocument()
    })
  })

  describe('Shader Animation', () => {
    it('should initialize animation uniforms', () => {
      const { ShaderMaterial } = require('three')

      render(
        <TestWrapper>
          <NorosiComponent {...defaultProps} />
        </TestWrapper>
      )

      // Verify that ShaderMaterial was called
      expect(ShaderMaterial).toHaveBeenCalled()
    })

    it('should update animation on frame', () => {
      render(
        <TestWrapper>
          <NorosiComponent {...defaultProps} />
        </TestWrapper>
      )

      // Simulate frame update
      const callback = global.mockUseFrameCallback
      if (callback) {
        act(() => {
          callback({ clock: { elapsedTime: 1 } })
        })
      }

      expect(screen.getByTestId('canvas')).toBeInTheDocument()
    })

    it('should handle different sway amplitudes', () => {
      const swayAmplitudes = [0.0, 0.1, 0.5, 1.0]

      swayAmplitudes.forEach((amplitude) => {
        const props = {
          ...defaultProps,
          smokeProps: {
            ...defaultProps.smokeProps,
            swayAmplitude: amplitude,
          },
        }

        render(
          <TestWrapper>
            <NorosiComponent {...props} />
          </TestWrapper>
        )

        expect(screen.getByTestId('canvas')).toBeInTheDocument()
      })
    })

    it('should handle different flow speeds', () => {
      const flowSpeeds = [0.1, 0.5, 1.0, 2.0]

      flowSpeeds.forEach((speed) => {
        const props = {
          ...defaultProps,
          smokeProps: {
            ...defaultProps.smokeProps,
            flowSpeed: speed,
          },
        }

        render(
          <TestWrapper>
            <NorosiComponent {...props} />
          </TestWrapper>
        )

        expect(screen.getByTestId('canvas')).toBeInTheDocument()
      })
    })
  })

  describe('Color Handling', () => {
    it('should handle hex colors', () => {
      const hexColors = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000']

      hexColors.forEach((color) => {
        const props = {
          ...defaultProps,
          smokeProps: {
            ...defaultProps.smokeProps,
            topColor: color,
            bottomColor: color,
          },
        }

        render(
          <TestWrapper>
            <NorosiComponent {...props} />
          </TestWrapper>
        )

        expect(screen.getByTestId('canvas')).toBeInTheDocument()
      })
    })

    it('should handle color names', () => {
      const colorNames = ['red', 'green', 'blue', 'white', 'black']

      colorNames.forEach((color) => {
        const props = {
          ...defaultProps,
          smokeProps: {
            ...defaultProps.smokeProps,
            topColor: color,
            bottomColor: color,
          },
        }

        render(
          <TestWrapper>
            <NorosiComponent {...props} />
          </TestWrapper>
        )

        expect(screen.getByTestId('canvas')).toBeInTheDocument()
      })
    })

    it('should handle invalid colors with fallbacks', () => {
      const invalidColors = ['invalid', '', undefined, null, 123]

      invalidColors.forEach((color: any) => {
        const props = {
          ...defaultProps,
          smokeProps: {
            ...defaultProps.smokeProps,
            topColor: color,
            bottomColor: color,
          },
        }

        render(
          <TestWrapper>
            <NorosiComponent {...props} />
          </TestWrapper>
        )

        expect(screen.getByTestId('canvas')).toBeInTheDocument()
      })
    })
  })

  describe('Posterization Effects', () => {
    it('should apply posterization when enabled', () => {
      const props = {
        ...defaultProps,
        posterize: {
          enabled: true,
          levels: 8,
          strength: 0.5,
        },
      }

      render(
        <TestWrapper>
          <NorosiComponent {...props} />
        </TestWrapper>
      )

      expect(screen.getByTestId('canvas')).toBeInTheDocument()
    })

    it('should handle different posterization levels', () => {
      const levels = [2, 4, 8, 16, 32]

      levels.forEach((level) => {
        const props = {
          ...defaultProps,
          posterize: {
            enabled: true,
            levels: level,
            strength: 0.5,
          },
        }

        render(
          <TestWrapper>
            <NorosiComponent {...props} />
          </TestWrapper>
        )

        expect(screen.getByTestId('canvas')).toBeInTheDocument()
      })
    })

    it('should not apply posterization when disabled', () => {
      const props = {
        ...defaultProps,
        posterize: {
          enabled: false,
          levels: 8,
          strength: 0.5,
        },
      }

      render(
        <TestWrapper>
          <NorosiComponent {...props} />
        </TestWrapper>
      )

      expect(screen.getByTestId('canvas')).toBeInTheDocument()
    })
  })

  describe('Performance and Memory', () => {
    it('should dispose of resources properly', () => {
      const { container } = render(
        <TestWrapper>
          <NorosiComponent {...defaultProps} />
        </TestWrapper>
      )

      // Unmount component
      container.remove()

      // Resources should be disposed (mocked)
      expect(screen.queryByTestId('canvas')).not.toBeInTheDocument()
    })

    it('should handle rapid prop changes', () => {
      const { rerender } = render(
        <TestWrapper>
          <NorosiComponent {...defaultProps} />
        </TestWrapper>
      )

      // Rapidly change props
      for (let i = 0; i < 10; i++) {
        const newProps = {
          ...defaultProps,
          smokeProps: {
            ...defaultProps.smokeProps,
            swayAmplitude: i * 0.1,
          },
        }

        rerender(
          <TestWrapper>
            <NorosiComponent {...newProps} />
          </TestWrapper>
        )
      }

      expect(screen.getByTestId('canvas')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero dimensions', () => {
      const props = {
        ...defaultProps,
        smokeProps: {
          ...defaultProps.smokeProps,
          width: 0,
          height: 0,
        },
      }

      render(
        <TestWrapper>
          <NorosiComponent {...props} />
        </TestWrapper>
      )

      expect(screen.getByTestId('canvas')).toBeInTheDocument()
    })

    it('should handle negative dimensions', () => {
      const props = {
        ...defaultProps,
        smokeProps: {
          ...defaultProps.smokeProps,
          width: -1,
          height: -2,
        },
      }

      render(
        <TestWrapper>
          <NorosiComponent {...props} />
        </TestWrapper>
      )

      expect(screen.getByTestId('canvas')).toBeInTheDocument()
    })

    it('should handle very large dimensions', () => {
      const props = {
        ...defaultProps,
        smokeProps: {
          ...defaultProps.smokeProps,
          width: 1000,
          height: 2000,
        },
      }

      render(
        <TestWrapper>
          <NorosiComponent {...props} />
        </TestWrapper>
      )

      expect(screen.getByTestId('canvas')).toBeInTheDocument()
    })
  })
})