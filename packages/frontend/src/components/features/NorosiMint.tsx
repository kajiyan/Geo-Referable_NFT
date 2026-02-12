'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useSelector } from 'react-redux'
import { useElevation, useMintingLogic, useSiweAuth, useTokenDuplicateCheck } from '@/hooks'
import { AccessibleFormField, ElevationDisplay, WeatherDisplay } from '@/components/ui'
import { LocationDisplay } from '@/components/features/LocationDisplay'
import { LocationError } from '@/components/features/LocationError'
import { selectGpsPosition, selectGpsError } from '@/lib/slices/sensorSlice'

export const NorosiMint = () => {
  const { address, isConnected } = useAccount()

  const {
    elevation: frontendElevation,
    source: frontendElevationSource,
    loading: elevationLoading,
    error: elevationError,
    getElevation
  } = useElevation({ debounceMs: 500 })

  const {
    authenticate,
    isAuthenticated,
    isAuthenticating,
    error: authError
  } = useSiweAuth()

  const {
    handleMint,
    loadingStage,
    getLoadingMessage,
    isPending,
    isConfirming,
    isConfirmed,
    error
  } = useMintingLogic({ type: 'basic' })

  // GPS location from Redux
  const gpsPosition = useSelector(selectGpsPosition)
  const gpsError = useSelector(selectGpsError)

  // Token duplicate check (shared hook)
  const { isDuplicate, isChecking: checkingDuplicate, markAsDuplicate } = useTokenDuplicateCheck(gpsPosition)

  const [formData, setFormData] = useState({
    text: 'Hello Norosi!',
  })

  const [computedColorIndex, setComputedColorIndex] = useState<{
    id: number;
    source: 'api' | 'cache' | 'seasonal_default';
  } | null>(null)

  const [computedElevation, setComputedElevation] = useState<{
    value: number;
    source: 'api' | 'cache' | 'default';
  } | null>(null)

  // Auto-authenticate when wallet connects
  useEffect(() => {
    if (isConnected && address && !isAuthenticated && !isAuthenticating) {
      authenticate()
    }
  }, [isConnected, address, isAuthenticated, isAuthenticating, authenticate])

  // Auto-fetch elevation when GPS coordinates change
  useEffect(() => {
    if (gpsPosition?.latitude && gpsPosition?.longitude) {
      getElevation(gpsPosition.latitude, gpsPosition.longitude)
    }
  }, [gpsPosition?.latitude, gpsPosition?.longitude, getElevation])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleMintClick = async () => {
    if (!gpsPosition) {
      alert('Please get your current location first')
      return
    }

    const mintData = {
      ...formData,
      latitude: gpsPosition.latitude,
      longitude: gpsPosition.longitude,
    }

    const result = await handleMint(mintData)
    if (result?.success) {
      if ('computedColorIndex' in result && result.computedColorIndex) {
        setComputedColorIndex(result.computedColorIndex as { id: number; source: 'api' | 'cache' | 'seasonal_default' })
      }
      if ('computedElevation' in result && result.computedElevation) {
        setComputedElevation(result.computedElevation as { value: number; source: 'api' | 'cache' | 'default' })
      }

      // After successful mint, mark this location as minted (prevents signature reuse)
      markAsDuplicate()
    }
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Mint Norosi NFT</h2>
      
      {/* Wallet and Authentication Status */}
      {!isConnected && (
        <div className="mb-4 p-4 bg-yellow-100 dark:bg-yellow-900 rounded-md" role="alert">
          <p className="text-yellow-800 dark:text-yellow-200">Please connect your wallet to mint NFT</p>
        </div>
      )}

      {isConnected && isAuthenticating && (
        <div className="mb-4 p-4 bg-blue-100 dark:bg-blue-900 rounded-md" role="status">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-stone-500 mr-2"></div>
            <p className="text-blue-800 dark:text-blue-200">Authenticating wallet... Please sign the message.</p>
          </div>
        </div>
      )}

      {isConnected && !isAuthenticated && !isAuthenticating && authError && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 rounded-md" role="alert">
          <p className="text-red-800 dark:text-red-200">
            Authentication failed: {authError}
          </p>
          <button
            onClick={authenticate}
            className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-md transition-colors"
          >
            Retry Authentication
          </button>
        </div>
      )}

      {isConnected && isAuthenticated && (
        <div className="mb-4 p-4 bg-green-100 dark:bg-green-900 rounded-md" role="status">
          <p className="text-green-800 dark:text-green-200">✅ Wallet authenticated successfully!</p>
        </div>
      )}

      <div className="space-y-4">
        {/* GPS Location Section */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            📍 Location
          </h3>

          {gpsPosition && <LocationDisplay position={gpsPosition} />}

          {gpsError && <LocationError error={gpsError} />}

          {gpsPosition && gpsPosition.accuracy && gpsPosition.accuracy > 100 && (
            <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900 rounded-md">
              <p className="text-yellow-800 dark:text-yellow-200 text-xs">
                ⚠️ Low accuracy location (±{gpsPosition.accuracy.toFixed(0)}m).
                Consider moving to an open area for better GPS signal.
              </p>
            </div>
          )}
        </div>

        <ElevationDisplay
          frontendElevation={frontendElevation}
          frontendSource={frontendElevationSource}
          frontendLoading={elevationLoading}
          frontendError={elevationError}
          backendElevation={computedElevation?.value || null}
          backendSource={computedElevation?.source || null}
        />

        <AccessibleFormField
          label="Text"
          required
          description={`Enter NFT text content (${formData.text.length}/54 characters)`}
        >
          <textarea
            name="text"
            value={formData.text}
            onChange={handleInputChange}
            maxLength={54}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            disabled={!isConnected || !isAuthenticated || isPending || isConfirming || loadingStage !== 'idle'}
          />
        </AccessibleFormField>

        {computedColorIndex && (
          <WeatherDisplay
            weatherId={computedColorIndex.id}
            source={computedColorIndex.source}
          />
        )}

        {isDuplicate && gpsPosition && (
          <div className="p-4 bg-red-100 dark:bg-red-900 rounded-md" role="alert">
            <p className="text-red-800 dark:text-red-200 text-sm font-semibold mb-1">
              ⚠️ この座標は既にミント済みです
            </p>
            <p className="text-red-700 dark:text-red-300 text-xs">
              座標: {gpsPosition.latitude.toFixed(6)}°, {gpsPosition.longitude.toFixed(6)}°
            </p>
            <p className="text-red-700 dark:text-red-300 text-xs mt-1">
              異なる場所に移動してから再度お試しください。
            </p>
          </div>
        )}

        {checkingDuplicate && (
          <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-md" role="status">
            <div className="flex items-center text-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-stone-500 mr-2"></div>
              <p className="text-blue-800 dark:text-blue-200">重複チェック中...</p>
            </div>
          </div>
        )}

        <button
          onClick={handleMintClick}
          disabled={!isConnected || !isAuthenticated || !gpsPosition || isDuplicate || checkingDuplicate || isPending || isConfirming || loadingStage !== 'idle'}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-describedby={error ? 'mint-error' : undefined}
        >
          {!gpsPosition ? '📍 Get Location First' :
           isDuplicate ? '❌ Already Minted at This Location' :
           checkingDuplicate ? '🔍 Checking Duplicate...' :
           loadingStage !== 'idle' ? getLoadingMessage() :
           isPending ? '⏳ Waiting for Approval...' :
           isConfirming ? '✅ Confirming Transaction...' :
           isConfirmed ? '🌟 Minted Successfully!' :
           '🌟 Mint NFT'}
        </button>

        {error && (
          <div id="mint-error" className="mt-4 p-4 bg-red-100 dark:bg-red-900 rounded-md" role="alert">
            <p className="text-red-800 dark:text-red-200 text-sm">
              <span className="sr-only">Error: </span>
              {error.message}
            </p>
          </div>
        )}

        {isConfirmed && (
          <div className="mt-4 p-4 bg-green-100 dark:bg-green-900 rounded-md" role="alert">
            <p className="text-green-800 dark:text-green-200 text-sm">
              <span className="sr-only">Success: </span>
              NFT minted successfully!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}