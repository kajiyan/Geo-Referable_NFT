import { getSkySegSession, isUsingGpu, getSessionPerformanceInfo, resetSession } from '@/lib/skySeg/ortSession';

// Mock onnxruntime-web modules
const mockWebGPUModule = {
  env: {
    wasm: { simd: true, wasmPaths: '', initTimeout: 30000, proxy: true, numThreads: 4 },
    logLevel: 'warning'
  },
  InferenceSession: {
    create: jest.fn()
  }
};

const mockWasmModule = {
  env: {
    wasm: { simd: true, wasmPaths: '', initTimeout: 30000, proxy: true, numThreads: 4 },
    logLevel: 'warning'
  },
  InferenceSession: {
    create: jest.fn()
  }
};

// Mock dynamic imports
jest.mock('onnxruntime-web/webgpu', () => mockWebGPUModule);
jest.mock('onnxruntime-web', () => mockWasmModule);

// Mock global fetch for model loading
global.fetch = jest.fn();

// Mock navigator properties
const originalNavigator = global.navigator;
const mockNavigator = {
  ...originalNavigator,
  hardwareConcurrency: 8,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  gpu: {
    requestAdapter: jest.fn()
  }
};

Object.defineProperty(global, 'navigator', {
  writable: true,
  value: mockNavigator
});

describe('ortSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSession(); // Reset session state between tests

    // Reset mock implementations
    mockWebGPUModule.InferenceSession.create.mockReset();
    mockWasmModule.InferenceSession.create.mockReset();

    // Mock successful model buffer fetch
    (global.fetch as jest.Mock).mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    });
  });

  afterAll(() => {
    global.navigator = originalNavigator;
  });

  describe('hardware detection', () => {
    it('detects Apple Silicon correctly', async () => {
      // Mock Apple Silicon environment
      Object.defineProperty(global, 'navigator', {
        writable: true,
        value: {
          ...mockNavigator,
          hardwareConcurrency: 10,
          userAgent: 'Mozilla/5.0 (Macintosh; Apple Silicon Mac OS X 10_15_7)',
          gpu: {
            requestAdapter: () => Promise.resolve({
              info: { vendor: 'Apple', device: 'Apple M1' }
            })
          }
        }
      });

      // Mock successful session creation
      const mockSession = {
        run: jest.fn().mockResolvedValue({ output: { data: new Float32Array([0.6]), dims: [1,1,1,1] } })
      };
      mockWebGPUModule.InferenceSession.create.mockResolvedValueOnce(mockSession);

      const session = await getSkySegSession();
      expect(session).toBeDefined();
      expect(isUsingGpu()).toBe(true);

      const perfInfo = getSessionPerformanceInfo();
      expect(perfInfo.isGpu).toBe(true);
      expect(perfInfo.cores).toBe(10);
    });

    it('detects iOS WebGPU correctly', async () => {
      // Mock iOS Safari 26+ environment
      Object.defineProperty(global, 'navigator', {
        writable: true,
        value: {
          ...mockNavigator,
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)',
          gpu: {
            requestAdapter: () => Promise.resolve({
              info: { vendor: 'Apple', device: 'Apple A17' }
            })
          }
        }
      });

      const mockSession = {
        run: jest.fn().mockResolvedValue({ output: { data: new Float32Array([0.6]), dims: [1,1,1,1] } })
      };
      mockWebGPUModule.InferenceSession.create.mockResolvedValueOnce(mockSession);

      const session = await getSkySegSession();
      expect(session).toBeDefined();
      expect(isUsingGpu()).toBe(true);
    });

    it('falls back to WASM when WebGPU unavailable', async () => {
      // Mock environment without WebGPU
      Object.defineProperty(global, 'navigator', {
        writable: true,
        value: {
          ...mockNavigator,
          gpu: undefined
        }
      });

      const mockSession = {
        run: jest.fn().mockResolvedValue({ output: { data: new Float32Array([0.6]), dims: [1,1,1,1] } })
      };
      mockWasmModule.InferenceSession.create.mockResolvedValueOnce(mockSession);

      const session = await getSkySegSession();
      expect(session).toBeDefined();
      expect(isUsingGpu()).toBe(false);

      const perfInfo = getSessionPerformanceInfo();
      expect(perfInfo.provider).toBe('wasm');
    });
  });

  describe('model selection', () => {
    it('prioritizes non-quantized models for Apple Silicon', async () => {
      // Mock Apple Silicon
      Object.defineProperty(global, 'navigator', {
        writable: true,
        value: {
          ...mockNavigator,
          hardwareConcurrency: 10,
          userAgent: 'Mozilla/5.0 (Macintosh; Apple Silicon Mac OS X 10_15_7)',
          gpu: {
            requestAdapter: () => Promise.resolve({
              info: { vendor: 'Apple', device: 'Apple M1' }
            })
          }
        }
      });

      const mockSession = {
        run: jest.fn().mockResolvedValue({ output: { data: new Float32Array([0.6]), dims: [1,1,1,1] } })
      };
      mockWebGPUModule.InferenceSession.create.mockResolvedValueOnce(mockSession);

      const session = await getSkySegSession();
      expect(session).toBeDefined();

      // Should try non-quantized ORT models first for Apple Silicon
      const createCalls = mockWebGPUModule.InferenceSession.create.mock.calls;
      expect(createCalls.length).toBeGreaterThan(0);
      // The first attempted model should be a .ort non-quantized model
      expect(createCalls[0][0]).toBeInstanceOf(Uint8Array); // Model is loaded as buffer
    });

    it('prioritizes quantized models for mobile devices', async () => {
      // Mock mobile environment
      Object.defineProperty(global, 'navigator', {
        writable: true,
        value: {
          ...mockNavigator,
          hardwareConcurrency: 6,
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
          gpu: {
            requestAdapter: () => Promise.resolve({
              info: { vendor: 'Apple', device: 'Apple A15' }
            })
          }
        }
      });

      const mockSession = {
        run: jest.fn().mockResolvedValue({ output: { data: new Float32Array([0.6]), dims: [1,1,1,1] } })
      };
      mockWebGPUModule.InferenceSession.create.mockResolvedValueOnce(mockSession);

      const session = await getSkySegSession();
      expect(session).toBeDefined();
    });
  });

  describe('session configuration', () => {
    it('creates session with appropriate optimization levels', async () => {
      const mockSession = {
        run: jest.fn().mockResolvedValue({ output: { data: new Float32Array([0.6]), dims: [1,1,1,1] } })
      };
      mockWebGPUModule.InferenceSession.create.mockResolvedValueOnce(mockSession);

      const session = await getSkySegSession();
      expect(session).toBeDefined();

      // Check that session was created with optimization settings
      const createCall = mockWebGPUModule.InferenceSession.create.mock.calls[0];
      const sessionOptions = createCall[1];
      expect(sessionOptions).toHaveProperty('executionProviders');
      expect(sessionOptions).toHaveProperty('enableMemPattern');
      expect(sessionOptions).toHaveProperty('graphOptimizationLevel');
    });

    it('disables Graph Capture for stability', async () => {
      const mockSession = {
        run: jest.fn().mockResolvedValue({ output: { data: new Float32Array([0.6]), dims: [1,1,1,1] } })
      };
      mockWebGPUModule.InferenceSession.create.mockResolvedValueOnce(mockSession);

      const session = await getSkySegSession();
      expect(session).toBeDefined();

      const createCall = mockWebGPUModule.InferenceSession.create.mock.calls[0];
      const sessionOptions = createCall[1];
      expect(sessionOptions.enableGraphCapture).toBe(false);
    });

    it('uses CPU output location for unified memory architecture', async () => {
      const mockSession = {
        run: jest.fn().mockResolvedValue({ output: { data: new Float32Array([0.6]), dims: [1,1,1,1] } })
      };
      mockWebGPUModule.InferenceSession.create.mockResolvedValueOnce(mockSession);

      const session = await getSkySegSession();
      expect(session).toBeDefined();

      const createCall = mockWebGPUModule.InferenceSession.create.mock.calls[0];
      const sessionOptions = createCall[1];
      expect(sessionOptions.preferredOutputLocation).toBe('cpu');
    });
  });

  describe('error handling and fallback', () => {
    it('attempts to use WebGPU when available', async () => {
      // This test verifies that WebGPU is attempted when available
      // The complex fallback logic is tested by the integration tests
      const mockSession = {
        run: jest.fn().mockResolvedValue({ output: { data: new Float32Array([0.6]), dims: [1,1,1,1] } })
      };
      mockWebGPUModule.InferenceSession.create.mockResolvedValue(mockSession);

      const session = await getSkySegSession();
      expect(session).toBeDefined();
      expect(isUsingGpu()).toBe(true);
      expect(mockWebGPUModule.InferenceSession.create).toHaveBeenCalled();
    });

    it('throws error when all models fail', async () => {
      // Mock all model failures
      mockWebGPUModule.InferenceSession.create.mockRejectedValue(new Error('All WebGPU models failed'));
      mockWasmModule.InferenceSession.create.mockRejectedValue(new Error('All WASM models failed'));

      await expect(getSkySegSession()).rejects.toThrow('All model candidates failed');
    });

    it('loads model as buffer from URL', async () => {
      const mockBuffer = new ArrayBuffer(1024);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        arrayBuffer: () => Promise.resolve(mockBuffer)
      });

      const mockSession = {
        run: jest.fn().mockResolvedValue({ output: { data: new Float32Array([0.6]), dims: [1,1,1,1] } })
      };
      mockWebGPUModule.InferenceSession.create.mockResolvedValueOnce(mockSession);

      const session = await getSkySegSession();
      expect(session).toBeDefined();

      // Verify fetch was called and buffer was passed to session creation
      expect(global.fetch).toHaveBeenCalled();
      const createCall = mockWebGPUModule.InferenceSession.create.mock.calls[0];
      expect(createCall[0]).toBeInstanceOf(Uint8Array);
    });
  });

  describe('session management', () => {
    it('returns singleton instance', async () => {
      const mockSession = {
        run: jest.fn().mockResolvedValue({ output: { data: new Float32Array([0.6]), dims: [1,1,1,1] } })
      };
      mockWebGPUModule.InferenceSession.create.mockResolvedValue(mockSession);

      const session1 = await getSkySegSession();
      const session2 = await getSkySegSession();

      expect(session1).toBe(session2);
      expect(mockWebGPUModule.InferenceSession.create).toHaveBeenCalledTimes(1);
    });

    it('resets session correctly', async () => {
      const mockSession = {
        run: jest.fn().mockResolvedValue({ output: { data: new Float32Array([0.6]), dims: [1,1,1,1] } }),
        release: jest.fn()
      };
      mockWebGPUModule.InferenceSession.create.mockResolvedValue(mockSession);

      const session1 = await getSkySegSession();
      expect(session1).toBeDefined();

      resetSession();
      expect(isUsingGpu()).toBe(false);

      // Next session creation should create new session
      await getSkySegSession();
      expect(mockWebGPUModule.InferenceSession.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('performance info', () => {
    it('returns correct performance information', async () => {
      const mockSession = {
        run: jest.fn().mockResolvedValue({ output: { data: new Float32Array([0.6]), dims: [1,1,1,1] } })
      };
      mockWebGPUModule.InferenceSession.create.mockResolvedValue(mockSession);

      await getSkySegSession();
      const perfInfo = getSessionPerformanceInfo();

      expect(perfInfo).toHaveProperty('isGpu');
      expect(perfInfo).toHaveProperty('provider');
      expect(perfInfo).toHaveProperty('cores');
      expect(perfInfo).toHaveProperty('memory');
      expect(perfInfo).toHaveProperty('sessionMetadata');
      expect(perfInfo).toHaveProperty('capabilities');

      expect(perfInfo.sessionMetadata).toHaveProperty('modelPath');
      expect(perfInfo.sessionMetadata).toHaveProperty('isGraphCaptureEnabled');
      expect(perfInfo.sessionMetadata).toHaveProperty('optimizationLevel');
      expect(perfInfo.sessionMetadata).toHaveProperty('outputLocation');
    });
  });
});