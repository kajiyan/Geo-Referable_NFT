"use client"

import { useEffect, useRef, useState } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { useDispatch } from 'react-redux'
import * as THREE from 'three'
import { DeviceOrientationControls as LocARDeviceOrientationControls } from 'locar'

import { updateDeviceOrientation, setOrientationActive, setArPermissionDenied, setViewMode } from '@/lib/slices/sensorSlice'

interface DeviceOrientationControlsProps {
  smoothingFactor?: number
  enabled?: boolean
  useDesktopFallback?: boolean
}

class DesktopDeviceOrientationControls extends LocARDeviceOrientationControls {
  orientationChangeEventName: 'deviceorientation' | 'deviceorientationabsolute'
  private fallbackListener: ((e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => void) | null = null

  constructor(camera: THREE.Camera, opts?: { smoothingFactor?: number; orientationChangeThreshold?: number }) {
    super(camera, opts)
    // prevent default listener, we will attach our own
    this.disconnect()
    this.orientationChangeEventName = 'deviceorientation'
    this.fallbackListener = (e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      if (e.webkitCompassHeading == null && typeof e.alpha === 'number') {
        e.webkitCompassHeading = 360 - e.alpha
      }
    }
    window.addEventListener('deviceorientation', this.fallbackListener, true)
    this.connect()
  }

  dispose = () => {
    if (this.fallbackListener) {
      window.removeEventListener('deviceorientation', this.fallbackListener, true)
      this.fallbackListener = null
    }
    try {
      // Call parent dispose - access via prototype since it's also an arrow function
      const parentDispose = Object.getPrototypeOf(Object.getPrototypeOf(this)).dispose
      if (typeof parentDispose === 'function') {
        parentDispose.call(this)
      } else {
        this.disconnect()
      }
    } catch {
      this.disconnect()
    }
  }
}

export default function DeviceOrientationControls({
  smoothingFactor = 1,
  enabled = true,
  useDesktopFallback = true,
}: DeviceOrientationControlsProps) {
  const { camera } = useThree()
  const controlsRef = useRef<LocARDeviceOrientationControls | null>(null)
  const dispatch = useDispatch()
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false)

  useEffect(() => {
    // iOS 13+ ではユーザー操作後に requestPermission が必要
    const needPermission = typeof (DeviceOrientationEvent as any)?.requestPermission === 'function'
    if (needPermission && enabled) {
      const onClick = async () => {
        try {
          const res = await (DeviceOrientationEvent as any).requestPermission()
          if (res === 'granted') {
            setPermissionGranted(true)
          } else {
            console.log('[VIEW_SWITCH] Orientation permission denied → fallback to MapView')
            setPermissionGranted(false)
            dispatch(setArPermissionDenied(true))
            dispatch(setViewMode('map'))
          }
        } catch {
          console.log('[VIEW_SWITCH] Orientation permission error → fallback to MapView')
          setPermissionGranted(false)
          dispatch(setArPermissionDenied(true))
          dispatch(setViewMode('map'))
        } finally {
          window.removeEventListener('click', onClick, true)
          window.removeEventListener('touchend', onClick, true)
        }
      }
      window.addEventListener('click', onClick, true)
      window.addEventListener('touchend', onClick, true)

      // 確実なクリーンアップ（アンマウント/依存変更時）
      return () => {
        window.removeEventListener('click', onClick, true)
        window.removeEventListener('touchend', onClick, true)
      }
    } else {
      setPermissionGranted(true)
    }
    return undefined
  }, [enabled, dispatch])

  useEffect(() => {
    if (!permissionGranted || !enabled) {
      dispatch(setOrientationActive(false))
      return () => {}
    }

    const opts = { smoothingFactor, orientationChangeThreshold: 0.01 }
    const controls = useDesktopFallback
      ? new DesktopDeviceOrientationControls(camera, opts)
      : new LocARDeviceOrientationControls(camera, opts)
    controlsRef.current = controls
    dispatch(setOrientationActive(true))

    return () => {
      dispatch(setOrientationActive(false))
      controls.dispose()
      controlsRef.current = null
    }
  }, [camera, smoothingFactor, useDesktopFallback, dispatch, permissionGranted, enabled])

  useEffect(() => {
    if (!permissionGranted || !enabled) {
      return
    }

    const handler = (e: DeviceOrientationEvent) => {
      if (!enabled || !permissionGranted) return
      const alpha = e.alpha ?? null
      const beta = e.beta ?? null
      const gamma = e.gamma ?? null
      dispatch(
        updateDeviceOrientation({
          alpha,
          beta,
          gamma,
          timestamp: Date.now(),
        }),
      )
    }
    const events: Array<'deviceorientation' | 'deviceorientationabsolute'> = ['deviceorientation', 'deviceorientationabsolute']
    events.forEach((eventName) => window.addEventListener(eventName, handler, true))
    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, handler, true))
    }
  }, [dispatch, enabled, permissionGranted])

  useFrame(() => {
    if (controlsRef.current && enabled && permissionGranted) {
      controlsRef.current.update()
    }
  })

  return null
}
