'use client'

import React, { useCallback, useRef, useMemo, useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import type { AppDispatch } from '@/lib/store'
import Map, {
  Marker,
  type MapRef,
  type MapEvent,
  type MapLayerMouseEvent,
} from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useNFTMapViewport } from '@/hooks/useNFTMapViewport'
import { useMapState } from '@/hooks/useMapState'
import { MAP_CONFIG } from '@/config/mapConstants'
import { useInitialViewState } from '@/hooks/useInitialViewState'
import { calculateObserverVisibility, calculateSmokeReach, isNightTime, processedTokenToSmokeReachInput } from '@/utils/norosiObservation'
import { isValidWeatherColorIndex } from '@/config/gpsConfig'
import { TOKEN_COLORS } from '@/utils/tokenColors'
import {
  selectVisibleTokens,
  selectMapLoading,
  selectMapError,
  selectCacheStats,
  selectSelectedTokenId,
  selectSelectedTreeId,
  selectSelectedTreeTokenIds,
  updateTokenAccess,
  setSelectedToken,
  clearTreeSelection,
  fetchTreeTokensForSelection,
} from '@/lib/slices/nftMapSlice'
import {
  processTokenData,
  filterTokensInViewport,
  limitTokensByPriority,
  createConnectionLines,
  createGradientSegments
} from '@/utils/mapDataTransform'
import { createNFTConnectionLines } from './NFTConnectionLines'
import { createVisibilityRangeLayer, createSmokeReachLayer } from './VisibilityRangeLayer'
import { DeckGLOverlay } from './DeckGLOverlay'
import MapErrorBoundary from './MapErrorBoundary'
import MapControls from './MapControls'
import NFTMarkers from './NFTMarkers'
import MapError from './MapError'
import { NFTDetailPanel } from './NFTDetailPanel'
import { useMapLocationSync } from '@/hooks/useMapLocationSync'
import { selectGpsPosition, selectShouldCenterMap, clearMapCenterRequest, fetchCurrentLocation, selectIsFetchingLocation, selectLastMapViewport, setLastMapViewport } from '@/lib/slices/sensorSlice'
import { selectWeatherColorIndex } from '@/lib/slices/weatherSlice'
import { CircleButton } from '@/components/ui/CircleButton'
import { GpsIcon, GpsFilledIcon } from '@/components/ui/Icons'
import type { URLCoordinates } from '@/hooks/useURLCoordinates'

interface MapComponentProps {
  urlCoordinates?: URLCoordinates | null
  /** Whether URL coordinates are expected (prevents hotspot flyTo during hydration) */
  expectingUrlCoordinates?: boolean
}

const MapComponent = React.memo(function MapComponent({ urlCoordinates, expectingUrlCoordinates = false }: MapComponentProps) {
  const mapRef = useRef<MapRef | null>(null)
  const dispatch = useDispatch<AppDispatch>()

  // Track map initialization state for auto-centering on first GPS acquisition
  const [isMapLoaded, setIsMapLoaded] = useState(false)
  const [hasInitialCentered, setHasInitialCentered] = useState(false)

  // Auto-select nearest token from URL coordinates (one-time)
  const [hasAutoSelectedFromUrl, setHasAutoSelectedFromUrl] = useState(false)

  // Redux selectors
  const visibleTokens = useSelector(selectVisibleTokens)
  const nftMapLoading = useSelector(selectMapLoading)
  const nftMapError = useSelector(selectMapError)
  const gpsPosition = useSelector(selectGpsPosition)
  const cacheStats = useSelector(selectCacheStats)
  const shouldCenterMap = useSelector(selectShouldCenterMap)
  const isFetchingLocation = useSelector(selectIsFetchingLocation)
  const selectedTokenId = useSelector(selectSelectedTokenId)
  const selectedTreeId = useSelector(selectSelectedTreeId)
  const selectedTreeTokenIds = useSelector(selectSelectedTreeTokenIds)
  const weatherColorIndex = useSelector(selectWeatherColorIndex)
  const lastMapViewport = useSelector(selectLastMapViewport)

  // Dynamic initial view state based on hotspots or URL coordinates
  const {
    initialViewState,
    targetViewState,
    markFlyToComplete
  } = useInitialViewState({ urlCoordinates, expectingUrlCoordinates, restoredViewport: lastMapViewport })

  // Night mode detection (stable per render, updates on next render cycle)
  const isNight = isNightTime()

  // Calculate observer visibility with day/night awareness (Koschmieder/Allard)
  const visibilityRange = useMemo(
    () => calculateObserverVisibility(weatherColorIndex),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weatherColorIndex, isNight]
  )

  // NFT map viewport hook
  const { onViewportChange, refetchImmediate } = useNFTMapViewport(mapRef, {
    enabled: true,
    debounceMs: MAP_CONFIG.PERFORMANCE.DEBOUNCE_MS
  })

  // Sync map center with GPS when available and refetch NFTs immediately after move
  // Uses refetchImmediate to cancel any pending debounced fetches and fetch immediately
  // fly: true for smooth animation over long distances (e.g., Tokyo to Nagoya)
  useMapLocationSync(mapRef, {
    enabled: !!gpsPosition,
    fly: true,
    minAccuracy: 100,
    onSyncComplete: refetchImmediate
  })

  // Map state management hook
  const { currentZoom, currentBounds, mapError, handlers } = useMapState(mapRef, onViewportChange)

  // Extended handleMapLoad to track map initialization
  const handleMapLoad = useCallback((_event: MapEvent) => {
    setIsMapLoaded(true)
    handlers.handleMapLoad()
  }, [handlers])

  // Save viewport to Redux on every move end for restoration on remount
  const handleMoveEnd = useCallback(() => {
    onViewportChange()
    const map = mapRef.current?.getMap?.()
    if (map) {
      const center = map.getCenter()
      dispatch(setLastMapViewport({
        longitude: center.lng,
        latitude: center.lat,
        zoom: map.getZoom(),
      }))
    }
  }, [onViewportChange, dispatch])

  // Fly to hotspot after map loads (first visit only)
  // This runs when targetViewState becomes available after initial Japan overview
  useEffect(() => {
    if (!isMapLoaded || !targetViewState) {
      return undefined
    }

    const map = mapRef.current?.getMap?.()
    if (!map) {
      return undefined
    }

    // Handler declared outside setTimeout for cleanup access
    let handleFlyToEnd: (() => void) | null = null

    // Delay slightly to ensure map is fully rendered
    const timeoutId = setTimeout(() => {
      // Callback to run when flyTo animation completes
      handleFlyToEnd = () => {
        markFlyToComplete()
        refetchImmediate()  // Bypass debounce and fetch tokens immediately
      }

      // Register one-time listener for moveend (fires when flyTo completes)
      map.once('moveend', handleFlyToEnd)

      map.flyTo({
        center: [targetViewState.longitude, targetViewState.latitude],
        zoom: targetViewState.zoom,
        speed: 1.2,
        curve: 1.42,
        essential: true,
      })
    }, 500)

    return () => {
      clearTimeout(timeoutId)
      // Cleanup: remove listener if component unmounts during animation
      if (handleFlyToEnd) {
        map.off('moveend', handleFlyToEnd)
      }
    }
  }, [isMapLoaded, targetViewState, markFlyToComplete, refetchImmediate])

  // Auto-center map on first GPS acquisition after map loads
  // Skip if source === 'manual' to avoid race condition with useMapLocationSync
  // Skip if URL coordinates are provided - URL navigation takes priority
  useEffect(() => {
    // Skip GPS auto-center if URL coordinates are expected
    if (!hasInitialCentered && isMapLoaded && gpsPosition && !urlCoordinates && !expectingUrlCoordinates && !lastMapViewport) {
      // Always mark as centered to prevent future auto-centering
      setHasInitialCentered(true)

      // Skip flyTo if this is a manual GPS request - useMapLocationSync handles those
      // This prevents race condition between flyTo and easeTo animations
      if (gpsPosition.source === 'manual') {
        return
      }

      const map = mapRef.current?.getMap?.()
      if (map) {
        map.flyTo({
          center: [gpsPosition.longitude, gpsPosition.latitude],
          zoom: MAP_CONFIG.STYLES.DEFAULT_ZOOM,
          speed: 1.2,
          curve: 1.2,
          essential: true,
        })
      }
    }
  }, [hasInitialCentered, isMapLoaded, gpsPosition, urlCoordinates, expectingUrlCoordinates, lastMapViewport])

  // Respond to map center requests from Redux (triggered by dialog open)
  useEffect(() => {
    if (shouldCenterMap && isMapLoaded && gpsPosition) {
      const map = mapRef.current?.getMap?.()
      if (map) {
        map.flyTo({
          center: [gpsPosition.longitude, gpsPosition.latitude],
          zoom: MAP_CONFIG.STYLES.DEFAULT_ZOOM,
          speed: 1.2,
          curve: 1.2,
          essential: true,
        })
        dispatch(clearMapCenterRequest())
      }
    }
  }, [shouldCenterMap, isMapLoaded, gpsPosition, dispatch])

  // Process token data
  const processedTokens = useMemo(() => {
    return processTokenData(visibleTokens)
  }, [visibleTokens])

  // Auto-select nearest token when navigating via URL coordinates
  // Runs once after tokens are fetched for the URL target viewport
  useEffect(() => {
    if (!urlCoordinates || hasAutoSelectedFromUrl || processedTokens.length === 0) return

    // Find nearest token to URL coordinates (squared Euclidean distance)
    let nearest: (typeof processedTokens)[number] | null = null
    let minDist = Infinity

    for (const token of processedTokens) {
      const dLat = token.numericLatitude - urlCoordinates.latitude
      const dLng = token.numericLongitude - urlCoordinates.longitude
      const dist = dLat * dLat + dLng * dLng
      if (dist < minDist) {
        minDist = dist
        nearest = token
      }
    }

    // Threshold: ~111m in degrees squared (0.001° ≈ 111m)
    const THRESHOLD_SQ = 0.001 * 0.001
    if (nearest && minDist < THRESHOLD_SQ) {
      setHasAutoSelectedFromUrl(true)
      dispatch(fetchTreeTokensForSelection({ treeId: nearest.treeId }))
    }
  }, [urlCoordinates, hasAutoSelectedFromUrl, processedTokens, dispatch])

  // Get selected token as ProcessedToken for detail panel
  const selectedToken = useMemo(() => {
    if (!selectedTokenId) return null
    return processedTokens.find(t => t.id === selectedTokenId) ?? null
  }, [selectedTokenId, processedTokens])

  // Filter tokens in viewport
  const visibleProcessedTokens = useMemo(() => {
    if (!currentBounds) return processedTokens
    return filterTokensInViewport(processedTokens, currentBounds)
  }, [processedTokens, currentBounds])

  // Limit markers by priority
  const optimizedTokens = useMemo(() => {
    return limitTokensByPriority(visibleProcessedTokens, MAP_CONFIG.PERFORMANCE.MAX_VISIBLE_MARKERS)
  }, [visibleProcessedTokens])

  // Always show individual tokens
  const tokensToShow = optimizedTokens

  // Compute dimmed token IDs for tree highlight
  const dimmedTokenIds = useMemo(() => {
    if (!selectedTreeTokenIds || selectedTreeTokenIds.length === 0) return null
    const treeSet = new Set(selectedTreeTokenIds)
    const dimmed = new Set<string>()
    for (const t of processedTokens) {
      if (!treeSet.has(t.id)) dimmed.add(t.id)
    }
    return dimmed
  }, [selectedTreeTokenIds, processedTokens])

  // Track visible tokens for access timestamp updates
  useEffect(() => {
    if (tokensToShow.length > 0) {
      const visibleIds = tokensToShow.map(t => t.id)
      dispatch(updateTokenAccess(visibleIds))
    }
  }, [tokensToShow, dispatch])

  // Log cache stats (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[MapComponent] Cache stats:', cacheStats)
    }
  }, [cacheStats])

  // Handle token marker click - opens detail panel and highlights tree
  const handleTokenClick = useCallback((tokenId: string, treeId: string) => {
    dispatch(setSelectedToken(tokenId))
    dispatch(fetchTreeTokensForSelection({ treeId }))
  }, [dispatch])

  // Handle detail panel close
  const handleDetailPanelClose = useCallback(() => {
    dispatch(setSelectedToken(null))
    dispatch(clearTreeSelection())
  }, [dispatch])

  // Handle GPS location button click
  const handleLocationClick = useCallback(() => {
    dispatch(fetchCurrentLocation())
  }, [dispatch])

  // Drag detection: track mousedown position to distinguish clicks from drags
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null)

  const handleMouseDown = useCallback((e: MapLayerMouseEvent) => {
    mouseDownPosRef.current = { x: e.point.x, y: e.point.y }
  }, [])

  // Handle map background click - closes detail panel and clears tree highlight
  // Note: Marker clicks call stopPropagation() so this only fires on map background
  const handleMapClick = useCallback((e: MapLayerMouseEvent) => {
    // Ignore drags: if mouse moved more than 3px, treat as drag
    if (mouseDownPosRef.current) {
      const dx = e.point.x - mouseDownPosRef.current.x
      const dy = e.point.y - mouseDownPosRef.current.y
      if (dx * dx + dy * dy > 9) return
    }
    if (selectedTokenId || selectedTreeId) {
      dispatch(setSelectedToken(null))
      dispatch(clearTreeSelection())
    }
  }, [selectedTokenId, selectedTreeId, dispatch])

  // Close panel and clear tree highlight on unmount (tab switch)
  useEffect(() => {
    return () => {
      dispatch(setSelectedToken(null))
      dispatch(clearTreeSelection())
    }
  }, [dispatch])

  // Performance optimization: separate connection calculation from zoom dependency
  // Following the reference implementation from map-experiments/OpenFreeMapReactGL.tsx
  // IMPORTANT: Use processedTokens (not optimizedTokens) to avoid breaking reference chains

  // Step 1: Calculate connections - only depends on processedTokens
  const allConnections = useMemo(
    () => createConnectionLines(processedTokens),
    [processedTokens]
  )

  // Step 2: Calculate gradient segments - only depends on connections
  // This prevents recalculation when only zoom changes
  // Include treeId from sourceToken for tree highlight filtering
  const allGradientSegments = useMemo(
    () => createGradientSegments(
      allConnections.map(conn => ({
        ...conn,
        treeId: conn.sourceToken.treeId,
      })),
      24
    ),
    [allConnections]
  )

  // Step 3: Create deck.gl LineLayer - depends on segments, zoom, and tree selection
  // When a tree is selected, show only that tree's connections; hide all others
  const connectionLayers = useMemo(() => {
    if (currentZoom < 10 || allGradientSegments.length === 0) {
      return []
    }

    if (selectedTreeId && selectedTreeTokenIds?.length) {
      // Show only the selected tree's connection lines; hide all others
      const treeSegments = allGradientSegments.filter(s => s.treeId === selectedTreeId)
      if (treeSegments.length > 0) {
        const layer = createNFTConnectionLines({
          gradientSegments: treeSegments, zoom: currentZoom, visible: true,
          layerId: 'nft-connections-tree',
        })
        return layer ? [layer] : []
      }
      return []
    }

    // No tree selected: single layer as before
    const layer = createNFTConnectionLines({
      gradientSegments: allGradientSegments, zoom: currentZoom, visible: true,
    })
    return layer ? [layer] : []
  }, [allGradientSegments, currentZoom, selectedTreeId, selectedTreeTokenIds])

  // Observer circle color: weather color when available, gray fallback
  const observerCircleColor = useMemo(() => {
    if (isValidWeatherColorIndex(weatherColorIndex)) {
      return TOKEN_COLORS[weatherColorIndex]
    }
    return '#B2B2B2'
  }, [weatherColorIndex])

  // Create observer visibility range layer (weather-colored stroke)
  const visibilityRangeLayer = useMemo(() => {
    return createVisibilityRangeLayer({
      position: gpsPosition,
      radiusMeters: visibilityRange,
      color: observerCircleColor,
      visible: !!gpsPosition,
    })
  }, [gpsPosition, visibilityRange, observerCircleColor])

  // Create smoke reach circle for selected token only (Venn diagram)
  const smokeReachLayer = useMemo(() => {
    if (!selectedToken) return null
    const now = Math.floor(Date.now() / 1000)
    const reach = calculateSmokeReach(processedTokenToSmokeReachInput(selectedToken), now)
    const tokenColor = TOKEN_COLORS[Math.abs(selectedToken.numericColorIndex) % TOKEN_COLORS.length]
    return createSmokeReachLayer({
      circle: {
        position: [selectedToken.numericLongitude, selectedToken.numericLatitude],
        radius: reach,
      },
      color: tokenColor,
    })
  }, [selectedToken])

  // Combine all deck.gl layers (order: observer circle, smoke circle, connection lines on top)
  const deckLayers = useMemo(() => {
    const layers = [...connectionLayers]
    if (smokeReachLayer) {
      layers.unshift(smokeReachLayer)
    }
    if (visibilityRangeLayer) {
      layers.unshift(visibilityRangeLayer)
    }
    return layers
  }, [connectionLayers, visibilityRangeLayer, smokeReachLayer])

  if (mapError) {
    return <MapError error={mapError.message} />
  }

  return (
    <div className="w-full h-full overflow-hidden relative">
      <MapControls
        nftMapLoading={nftMapLoading}
        nftMapError={nftMapError}
        isNight={isNight}
      />

      {/* GPS Location Button - hidden when detail panel is open */}
      {!selectedTokenId && (
        <div className="absolute bottom-[14px] right-4 z-10">
          <CircleButton
            icon={gpsPosition ? <GpsFilledIcon /> : <GpsIcon />}
            aria-label="Get current GPS location"
            size="sm"
            isLoading={isFetchingLocation}
            onClick={handleLocationClick}
            variant="white"
          />
        </div>
      )}

      {/* NFT Detail Panel - handles its own fade in/out animation */}
      <NFTDetailPanel
        token={selectedToken}
        onClose={handleDetailPanelClose}
      />

      <MapErrorBoundary component="map" resetKeys={[isNight ? MAP_CONFIG.STYLES.DARK : MAP_CONFIG.STYLES.POSITRON]}>
        <Map
          ref={mapRef}
          mapStyle={isNight ? MAP_CONFIG.STYLES.DARK : MAP_CONFIG.STYLES.POSITRON}
          initialViewState={initialViewState}
          dragRotate={false}
          attributionControl={false}
          onLoad={handleMapLoad}
          onError={handlers.handleMapError}
          onMove={handlers.handleMove}
          onMoveEnd={handleMoveEnd}
          onMouseDown={handleMouseDown}
          onClick={handleMapClick}
          style={{ width: '100%', height: '100%' }}
        >

          {/* User Location Marker */}
          {gpsPosition && (
            <Marker
              longitude={gpsPosition.longitude}
              latitude={gpsPosition.latitude}
              anchor="center"
              style={{ zIndex: 10, pointerEvents: 'none' }}
            >
              <div className="relative flex items-center justify-center pointer-events-none" style={{ width: '56px', height: '56px' }}>
                {/* Pulsing sonar ring */}
                <div className="absolute rounded-full animate-ping" style={{ width: '52px', height: '52px', border: `3px solid ${observerCircleColor}`, opacity: 0.5 }}></div>
                {/* Outer colored ring */}
                <div className="relative rounded-full flex items-center justify-center" style={{ width: '24px', height: '24px', backgroundColor: observerCircleColor, boxShadow: `0 0 8px 2px ${observerCircleColor}` }}>
                  {/* White inner dot */}
                  <div className="absolute rounded-full" style={{ width: '10px', height: '10px', backgroundColor: '#fff' }}></div>
                  {/* Eye icon overlaid on white dot */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" className="absolute">
                    <path fill="#1c1917" d="M15.852 7c-1.3 0-2.644.53-3.687 1.572a6 6 0 0 0-.29.316 4 4 0 0 0-.522-.64C10.518 7.415 9.405 7 8.258 7c-1.299 0-2.644.53-3.687 1.572-1.96 1.961-2.107 4.998-.323 6.781.837.838 1.948 1.25 3.094 1.25 1.3 0 2.644-.53 3.687-1.573q.153-.154.291-.315.225.34.521.638c.838.838 1.948 1.25 3.095 1.25 1.299 0 2.644-.53 3.687-1.573 1.96-1.96 2.107-4.997.323-6.781C18.111 7.414 16.999 7 15.852 7m-5.263 4.476c-.037.781-.385 1.54-.98 2.134-.625.625-1.45.983-2.267.983-.463 0-1.13-.115-1.676-.66a2.28 2.28 0 0 1-.639-1.324c.926.64 2.267.49 3.168-.411.9-.901 1.049-2.242.412-3.168.415.054.904.218 1.324.637.458.458.69 1.1.658 1.809m7.593 0c-.037.781-.385 1.54-.98 2.134-.625.625-1.45.983-2.266.983-.464 0-1.13-.115-1.676-.66a2.28 2.28 0 0 1-.64-1.324c.926.64 2.268.49 3.168-.411s1.049-2.242.412-3.168c.416.054.905.218 1.324.637.458.458.69 1.1.658 1.809"/>
                    <path fill="#fff" d="M18.182 11.476c-.037.781-.385 1.54-.98 2.134-.625.625-1.45.983-2.266.983-.464 0-1.13-.115-1.676-.66a2.28 2.28 0 0 1-.64-1.324c.926.64 2.268.49 3.168-.411s1.049-2.242.412-3.168c.416.054.905.218 1.324.637.458.458.69 1.1.658 1.809M10.589 11.476c-.037.781-.385 1.54-.98 2.134-.625.625-1.45.983-2.267.983-.463 0-1.13-.115-1.676-.66a2.28 2.28 0 0 1-.639-1.324c.926.64 2.267.49 3.168-.411.9-.901 1.049-2.242.412-3.168.415.054.904.218 1.324.637.458.458.69 1.1.658 1.809"/>
                  </svg>
                </div>
              </div>
            </Marker>
          )}

          <NFTMarkers
            tokens={tokensToShow}
            currentZoom={currentZoom}
            onTokenClick={handleTokenClick}
            dimmedTokenIds={dimmedTokenIds}
            isNight={isNight}
          />

          {/* deck.gl overlay for visibility range and connection lines - MUST be child of Map */}
          <DeckGLOverlay layers={deckLayers} />
        </Map>
      </MapErrorBoundary>
    </div>
  )
})

export default MapComponent
