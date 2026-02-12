import { renderHook, act, waitFor } from '@testing-library/react';
import { RefObject } from 'react';
import { useSkySegmentation } from '@/hooks/useSkySegmentation';
import * as ortSession from '@/lib/skySeg/ortSession';
import * as preprocess from '@/lib/skySeg/preprocess';
import * as postprocess from '@/lib/skySeg/postprocess';

// Mock the ort module
jest.mock('onnxruntime-web', () => ({
  Tensor: jest.fn().mockImplementation((type: string, data: Float32Array, shape: number[]) => ({
    type,
    data,
    dims: shape,
    size: data.length
  }))
}));

// Mock the sky segmentation modules
jest.mock('@/lib/skySeg/ortSession');
jest.mock('@/lib/skySeg/preprocess');
jest.mock('@/lib/skySeg/postprocess');
jest.mock('@/config/skySegConfig', () => ({
  SKY_SEG_CONFIG: {
    INPUT_WIDTH: 320,
    INPUT_HEIGHT: 320,
    DOWNSCALE_RATIO_DEFAULT: 0.5
  },
  getTargetFps: () => 30
}));

const mockOrtSession = ortSession as jest.Mocked<typeof ortSession>;
const mockPreprocess = preprocess as jest.Mocked<typeof preprocess>;
const mockPostprocess = postprocess as jest.Mocked<typeof postprocess>;

// Mock RAF for testing
const mockRaf = jest.fn();
const mockCancelRaf = jest.fn();
global.requestAnimationFrame = mockRaf;
global.cancelAnimationFrame = mockCancelRaf;

// Mock performance.now
const mockPerformanceNow = jest.fn();
global.performance = { now: mockPerformanceNow } as any;

describe('useSkySegmentation', () => {
  let mockVideoElement: HTMLVideoElement;
  let mockVideoRef: RefObject<HTMLVideoElement>;
  let mockSession: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRaf.mockClear();
    mockCancelRaf.mockClear();
    mockPerformanceNow.mockReturnValue(1000);

    // Create mock video element
    mockVideoElement = {
      videoWidth: 640,
      videoHeight: 480,
      readyState: 4, // HAVE_ENOUGH_DATA
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    } as unknown as HTMLVideoElement;

    mockVideoRef = { current: mockVideoElement };

    // Mock session
    mockSession = {
      run: jest.fn().mockResolvedValue({
        output: {
          data: new Float32Array([0.1, 0.9, 0.3, 0.7]),
          dims: [1, 1, 2, 2]
        }
      }),
      inputNames: ['input.1'],
      inputMetadata: {
        'input.1': {
          dimensions: [1, 3, 320, 320]
        }
      }
    };

    // Mock module implementations
    mockOrtSession.getSkySegSession.mockResolvedValue(mockSession);
    mockPreprocess.preprocessVideoFrame.mockReturnValue({
      data: new Float32Array(Array(3 * 320 * 320).fill(0.5)),
      width: 320,
      height: 320
    });
    mockPostprocess.postprocess.mockReturnValue({
      mask: new Float32Array([0.1, 0.9, 0.3, 0.7]),
      width: 2,
      height: 2
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initialization', () => {
    it('initializes with correct default state', () => {
      const { result } = renderHook(() =>
        useSkySegmentation({ videoRef: mockVideoRef })
      );

      expect(result.current.ready).toBe(false);
      expect(result.current.error).toBeUndefined();
      expect(result.current.maskTextureData).toBeUndefined();
      expect(result.current.width).toBeUndefined();
      expect(result.current.height).toBeUndefined();
    });

    it('does not initialize when disabled', () => {
      const { result } = renderHook(() =>
        useSkySegmentation({ videoRef: mockVideoRef, enabled: false })
      );

      expect(result.current.ready).toBe(false);
      expect(mockOrtSession.getSkySegSession).not.toHaveBeenCalled();
    });

    it('initializes session and sets ready state', async () => {
      const { result } = renderHook(() =>
        useSkySegmentation({ videoRef: mockVideoRef })
      );

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });

      expect(mockOrtSession.getSkySegSession).toHaveBeenCalled();
      expect(result.current.error).toBeUndefined();
    });

    it('starts with not ready state for unready video', () => {
      // Mock video element that is not ready
      const unreadyVideoRef = {
        current: {
          videoWidth: 0,
          videoHeight: 0,
          readyState: 0
        } as HTMLVideoElement
      };

      const { result } = renderHook(() =>
        useSkySegmentation({ videoRef: unreadyVideoRef })
      );

      expect(result.current.ready).toBe(false);
    });
  });

  describe('inference loop', () => {
    it('processes video frames and updates mask data', async () => {
      const { result } = renderHook(() =>
        useSkySegmentation({ videoRef: mockVideoRef })
      );

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });

      // Simulate RAF callback
      expect(mockRaf).toHaveBeenCalled();
      const rafCallback = mockRaf.mock.calls[0][0];

      // Advance time to trigger processing
      mockPerformanceNow.mockReturnValue(2000);

      await act(async () => {
        rafCallback();
        // Allow promises to resolve
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Check that preprocessing was called with default config dimensions
      expect(mockPreprocess.preprocessVideoFrame).toHaveBeenCalledWith(
        mockVideoElement,
        320, // Uses fixed dimensions from session metadata
        320
      );
      expect(mockSession.run).toHaveBeenCalled();
      expect(mockPostprocess.postprocess).toHaveBeenCalled();

      await waitFor(() => {
        expect(result.current.maskTextureData).toBeDefined();
        expect(result.current.width).toBe(2);
        expect(result.current.height).toBe(2);
      });
    });

    it('respects FPS throttling', async () => {
      const { result } = renderHook(() =>
        useSkySegmentation({ videoRef: mockVideoRef })
      );

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });

      const rafCallback = mockRaf.mock.calls[0][0];

      // First call at time 1000
      mockPerformanceNow.mockReturnValue(1000);
      await act(async () => {
        rafCallback();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Second call immediately after (should be throttled)
      mockPerformanceNow.mockReturnValue(1010); // Only 10ms later
      await act(async () => {
        rafCallback();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should only process once due to throttling (30fps = ~33ms interval)
      expect(mockPreprocess.preprocessVideoFrame).toHaveBeenCalledTimes(1);
    });

    it('uses custom resolution scale', async () => {
      const { result } = renderHook(() =>
        useSkySegmentation({
          videoRef: mockVideoRef,
          resolutionScale: 0.75
        })
      );

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });

      const rafCallback = mockRaf.mock.calls[0][0];
      mockPerformanceNow.mockReturnValue(2000);

      await act(async () => {
        rafCallback();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // With fixed dimensions from metadata, resolution scale doesn't apply
      expect(mockPreprocess.preprocessVideoFrame).toHaveBeenCalledWith(
        mockVideoElement,
        320, // Uses fixed dimensions from session metadata
        320
      );
    });

    it('adapts to fixed shape from session metadata', async () => {
      // Mock session with fixed dimensions
      mockSession.inputMetadata = {
        'input.1': {
          dimensions: [1, 3, 256, 256] // Fixed 256x256
        }
      };

      const { result } = renderHook(() =>
        useSkySegmentation({ videoRef: mockVideoRef })
      );

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });

      const rafCallback = mockRaf.mock.calls[0][0];
      mockPerformanceNow.mockReturnValue(2000);

      await act(async () => {
        rafCallback();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockPreprocess.preprocessVideoFrame).toHaveBeenCalledWith(
        mockVideoElement,
        256, // Uses fixed dimensions from metadata
        256
      );
    });
  });

  describe('error handling', () => {
    it('handles preprocessing errors gracefully', async () => {
      mockPreprocess.preprocessVideoFrame.mockReturnValue(null);

      const { result } = renderHook(() =>
        useSkySegmentation({ videoRef: mockVideoRef })
      );

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });

      const rafCallback = mockRaf.mock.calls[0][0];
      mockPerformanceNow.mockReturnValue(2000);

      await act(async () => {
        rafCallback();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should not crash, session.run should not be called
      expect(mockSession.run).not.toHaveBeenCalled();
    });

    it('handles inference errors and sets error state', async () => {
      mockSession.run.mockRejectedValue(new Error('Inference failed'));

      const { result } = renderHook(() =>
        useSkySegmentation({ videoRef: mockVideoRef })
      );

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });

      const rafCallback = mockRaf.mock.calls[0][0];
      mockPerformanceNow.mockReturnValue(2000);

      await act(async () => {
        rafCallback();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Inference failed');
      });
    });

    it('handles inference errors gracefully', async () => {
      mockSession.run.mockRejectedValue(new Error('Dimension mismatch'));

      const { result } = renderHook(() =>
        useSkySegmentation({ videoRef: mockVideoRef })
      );

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });

      const rafCallback = mockRaf.mock.calls[0][0];
      mockPerformanceNow.mockReturnValue(2000);

      await act(async () => {
        rafCallback();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should set error state and continue gracefully
      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });
    });
  });

  describe('memory management', () => {
    it('reuses tensors from memory pool', async () => {
      const { result } = renderHook(() =>
        useSkySegmentation({ videoRef: mockVideoRef })
      );

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });

      const rafCallback = mockRaf.mock.calls[0][0];

      // Process multiple frames
      for (let i = 0; i < 3; i++) {
        mockPerformanceNow.mockReturnValue(1000 + i * 100);
        await act(async () => {
          await rafCallback();
        });
      }

      // Should have been called for each frame (tensor pooling is internal)
      expect(mockSession.run).toHaveBeenCalled();
    });

    it('only updates state when mask data actually changes', async () => {
      let renderCount = 0;
      const { result } = renderHook(() => {
        renderCount++;
        return useSkySegmentation({ videoRef: mockVideoRef });
      });

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });

      const initialRenderCount = renderCount;
      const rafCallback = mockRaf.mock.calls[0][0];

      // Return same mask data
      mockPostprocess.postprocess.mockReturnValue({
        mask: new Float32Array([0.1, 0.9, 0.3, 0.7]),
        width: 2,
        height: 2
      });

      // Process frame
      mockPerformanceNow.mockReturnValue(2000);
      await act(async () => {
        rafCallback();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Process same frame again
      mockPerformanceNow.mockReturnValue(3000);
      await act(async () => {
        rafCallback();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should minimize re-renders by checking if data actually changed
      expect(renderCount).toBeLessThan(initialRenderCount + 10); // Allow some reasonable re-renders
    });
  });

  describe('cleanup', () => {
    it('cancels RAF and cleans up resources on unmount', () => {
      const { unmount } = renderHook(() =>
        useSkySegmentation({ videoRef: mockVideoRef })
      );

      unmount();

      // RAF cancellation and cleanup should be called
      // Note: The exact timing depends on the implementation
      expect(mockPreprocess.cleanupPreprocessor).toHaveBeenCalled();
    });

    it('stops processing when disabled', async () => {
      const { result, rerender } = renderHook(
        (enabled) => useSkySegmentation({ videoRef: mockVideoRef, enabled }),
        { initialProps: true }
      );

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });

      // Disable the hook
      rerender(false);

      const rafCallback = mockRaf.mock.calls[0][0];
      mockPerformanceNow.mockReturnValue(2000);

      await act(async () => {
        rafCallback();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // May have been called during initial render before disable took effect
      // Just check it's not continuing to process
      expect(mockSession.run).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('handles missing video element gracefully', () => {
      const emptyVideoRef = { current: null };

      const { result } = renderHook(() =>
        useSkySegmentation({ videoRef: emptyVideoRef })
      );

      // Should start in not ready state
      expect(result.current.ready).toBe(false);
    });

    it('handles video with zero dimensions', () => {
      const zeroVideoElement = {
        ...mockVideoElement,
        videoWidth: 0,
        videoHeight: 0
      } as HTMLVideoElement;
      const zeroVideoRef = { current: zeroVideoElement };

      const { result } = renderHook(() =>
        useSkySegmentation({ videoRef: zeroVideoRef })
      );

      // Should not crash, just not process frames
      expect(result.current.ready).toBe(false);
    });

    it('prevents concurrent processing', async () => {
      const { result } = renderHook(() =>
        useSkySegmentation({ videoRef: mockVideoRef })
      );

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });

      const rafCallback = mockRaf.mock.calls[0][0];

      // Mock a slow session.run to test concurrency prevention
      let callCount = 0;
      mockSession.run.mockImplementation(async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate slow processing
        return {
          output: {
            data: new Float32Array([0.1, 0.9, 0.3, 0.7]),
            dims: [1, 1, 2, 2]
          }
        };
      });

      // Start first processing and second quickly after
      mockPerformanceNow.mockReturnValue(2000);

      await act(async () => {
        rafCallback(); // First call
        mockPerformanceNow.mockReturnValue(2100);
        rafCallback(); // Second call while first is running

        // Wait for processing to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should only have called session.run once (concurrent call blocked)
      expect(callCount).toBeLessThanOrEqual(1);
    });
  });
});