// Mock types for locar library - intentionally unused in this mock implementation

class Emitter {
  private handlers: Record<string, ((...args: unknown[]) => void)[]> = {}
  on(event: string, cb: (...args: unknown[]) => void) {
    this.handlers[event] = this.handlers[event] || []
    this.handlers[event].push(cb)
  }
  off(event: string, cb: (...args: unknown[]) => void) {
    this.handlers[event] = (this.handlers[event] || []).filter((h) => h !== cb)
  }
  emit(event: string, ...args: unknown[]) {
    for (const h of this.handlers[event] || []) h(...args)
  }
}

export class LocationBased extends Emitter {
  constructor(_scene: unknown, _camera: unknown, _opts?: unknown) {
    super()
  }
  async startGps(): Promise<boolean> {
    // simulate initial update
    setTimeout(() => {
      this.emit('gpsupdate', { coords: { latitude: 35.6584, longitude: 139.7454, accuracy: 20 } }, Number.MAX_VALUE)
    }, 0)
    return true
  }
  stopGps(): boolean {
    return true
  }
  fakeGps(lon: number, lat: number, _elev?: number | null, acc?: number) {
    this.emit('gpsupdate', { coords: { latitude: lat, longitude: lon, accuracy: acc ?? 10 } }, 10)
  }
}

export class DeviceOrientationControls {
  constructor(_camera: unknown, _opts?: unknown) {}
  update() {}
  connect() {}
  disconnect() {}
  dispose() {}
}

export default { LocationBased, DeviceOrientationControls }
