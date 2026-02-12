'use client'

import { useState, useEffect } from 'react'
import { useNorosi } from './useNorosi'

interface GpsPosition {
  latitude: number
  longitude: number
  accuracy?: number
  altitude?: number | null
  altitudeAccuracy?: number | null
  heading?: number | null
  speed?: number | null
}

interface UseTokenDuplicateCheckResult {
  isDuplicate: boolean
  isChecking: boolean
  markAsDuplicate: () => void
}

/**
 * Custom hook for checking TokenID duplication based on GPS coordinates
 *
 * Benefits:
 * - Reusable across NorosiMint and ChainMintModal
 * - Follows DRY principle (Don't Repeat Yourself)
 * - Centralizes duplicate check logic
 * - Automatic checking when GPS position changes
 *
 * @param gpsPosition - Current GPS position from sensor
 * @returns Object containing duplicate state, checking state, and manual mark function
 */
export const useTokenDuplicateCheck = (
  gpsPosition: GpsPosition | null
): UseTokenDuplicateCheckResult => {
  const { checkTokenExists } = useNorosi()
  const [isDuplicate, setIsDuplicate] = useState<boolean>(false)
  const [isChecking, setIsChecking] = useState<boolean>(false)

  // Automatically check for duplicate when GPS coordinates change
  useEffect(() => {
    const checkDuplicate = async () => {
      if (gpsPosition?.latitude && gpsPosition?.longitude && checkTokenExists) {
        setIsChecking(true)
        try {
          const exists = await checkTokenExists(gpsPosition.latitude, gpsPosition.longitude)
          setIsDuplicate(exists)
        } catch (error) {
          console.error('Error checking token duplicate:', error)
          // On error, assume not duplicate (fail-safe approach)
          setIsDuplicate(false)
        } finally {
          setIsChecking(false)
        }
      } else {
        // Reset state if no valid GPS position
        setIsDuplicate(false)
        setIsChecking(false)
      }
    }

    checkDuplicate()
  }, [gpsPosition?.latitude, gpsPosition?.longitude, checkTokenExists])

  // Manual function to mark current location as minted (after successful mint)
  const markAsDuplicate = () => {
    setIsDuplicate(true)
  }

  return {
    isDuplicate,
    isChecking,
    markAsDuplicate,
  }
}
