declare module 'locar' {
  import * as THREE from 'three'

  export class LocationBased {
    constructor(
      scene: any,
      camera: any,
      options?: { gpsMinDistance?: number; gpsMinAccuracy?: number }
    )
    startGps(): Promise<boolean>
    stopGps(): boolean
    fakeGps(lon: number, lat: number, elev?: number | null, acc?: number): void
    lonLatToWorldCoords(longitude: number, latitude: number): [number, number]
    on(event: 'gpsupdate', cb: (position: GeolocationPosition | { coords?: GeolocationCoordinates; timestamp?: number }, distanceMoved: number) => void): void
    on(event: 'gpserror', cb: (code: number) => void): void
    off?(event: string, cb: (...args: any[]) => void): void
    setGpsOptions(options: { gpsMinDistance?: number; gpsMinAccuracy?: number }): void
  }

  export class DeviceOrientationControls extends THREE.EventDispatcher {
    object: THREE.Object3D
    enabled: boolean
    deviceOrientation: {
      alpha?: number
      beta?: number
      gamma?: number
      webkitCompassHeading?: number
      absolute?: boolean
    } | null
    screenOrientation: number
    alphaOffset: number
    orientationOffset: number
    initialOffset: boolean | null
    lastQuaternion: THREE.Quaternion | null
    orientationChangeEventName: 'deviceorientation' | 'deviceorientationabsolute'
    smoothingFactor: number
    enablePermissionDialog: boolean
    enableInlineStyling: boolean
    preferConfirmDialog: boolean

    constructor(
      camera: THREE.Camera,
      options?: {
        smoothingFactor?: number
        orientationChangeThreshold?: number
      }
    )
    connect(): void
    disconnect(): void
    update(): void
    dispose(): void
  }
}


