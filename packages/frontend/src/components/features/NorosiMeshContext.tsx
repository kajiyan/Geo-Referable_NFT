"use client"

import { createContext, useContext, useCallback, useRef, type ReactNode } from 'react'
import * as THREE from 'three'

interface NorosiMeshContextValue {
  register: (tokenId: string, mesh: THREE.Mesh) => void
  unregister: (tokenId: string) => void
  getMeshes: () => THREE.Mesh[]
}

const NorosiMeshContext = createContext<NorosiMeshContextValue | null>(null)

/**
 * NorosiMeshProvider - Manages mesh registration for tap detection
 *
 * - Norosi components register their meshes with tokenId
 * - useTapSelection hook uses getMeshes() for raycasting
 *
 * Performance optimization:
 * - Uses dirty flag pattern to cache the mesh array
 * - getMeshes() returns the same array reference unless meshes changed
 * - Reduces garbage collection pressure in render loops
 */
export function NorosiMeshProvider({ children }: { children: ReactNode }) {
  const meshesRef = useRef(new Map<string, THREE.Mesh>())
  // Cache for getMeshes() - only recreate array when dirty
  const meshArrayRef = useRef<THREE.Mesh[]>([])
  const isDirtyRef = useRef(true)

  const register = useCallback((tokenId: string, mesh: THREE.Mesh) => {
    meshesRef.current.set(tokenId, mesh)
    isDirtyRef.current = true
  }, [])

  const unregister = useCallback((tokenId: string) => {
    meshesRef.current.delete(tokenId)
    isDirtyRef.current = true
  }, [])

  const getMeshes = useCallback(() => {
    if (isDirtyRef.current) {
      meshArrayRef.current = Array.from(meshesRef.current.values())
      isDirtyRef.current = false
    }
    return meshArrayRef.current
  }, [])

  return (
    <NorosiMeshContext.Provider value={{ register, unregister, getMeshes }}>
      {children}
    </NorosiMeshContext.Provider>
  )
}

/**
 * Must be used within NorosiMeshProvider
 */
export function useNorosiMeshes() {
  const context = useContext(NorosiMeshContext)
  if (!context) {
    throw new Error('useNorosiMeshes must be used within NorosiMeshProvider')
  }
  return context
}

/**
 * Optional version - returns null if not within provider
 * Use this in Norosi to allow usage outside AR context
 */
export function useNorosiMeshesOptional() {
  return useContext(NorosiMeshContext)
}
