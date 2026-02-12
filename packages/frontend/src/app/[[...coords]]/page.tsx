'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { CircleButton } from '@/components/ui/CircleButton'
import { InfomationIcon } from '@/components/ui/Icons'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog'
import { useSelector } from 'react-redux'
import { selectViewMode, selectArPermissionDenied } from '@/lib/slices/sensorSlice'
import { selectMintAnimationActive } from '@/lib/slices/appSlice'
import ViewToggle from '@/components/features/ViewToggle'
import { useDeviceOrientationSupport } from '@/hooks/useDeviceOrientationSupport'
import { DateTimeStrip } from '@/components/features/DateTimeStrip'
import { Skeleton } from '@/components/ui/Skeleton'
import { getLayoutPadding } from '@/constants/layout'
import { useURLCoordinates } from '@/hooks/useURLCoordinates'

const MapComponent = dynamic(
  () => import('@/components/features/MapComponent'),
  {
    ssr: false,
    loading: () => <Skeleton width="100%" height="100%" />
  }
)
const ARView = dynamic(
  () => import('@/components/features/ARView'),
  {
    ssr: false,
    loading: () => <Skeleton width="100%" height="100%" />
  }
)

export default function Home() {
  const params = useParams<{ coords?: string[] }>()
  const urlCoordinates = useURLCoordinates(params.coords)

  // Check if URL path looks like coordinate URL (starts with @ or %40)
  // Need to handle URL-encoded @ symbol (%40) from some browsers/routers
  const firstCoord = params.coords?.[0]
  const decodedFirstCoord = firstCoord ? decodeURIComponent(firstCoord) : undefined
  const expectingUrlCoordinates = !!(decodedFirstCoord?.startsWith('@'))

  const viewMode = useSelector(selectViewMode)
  const mintAnimationActive = useSelector(selectMintAnimationActive)
  const isOrientationSupported = useDeviceOrientationSupport()
  const arPermissionDenied = useSelector(selectArPermissionDenied)
  const [infoDialogOpen, setInfoDialogOpen] = useState(false)

  const handleOpenInfo = useCallback(() => setInfoDialogOpen(true), [])

  return (
    <>
      <main className="fixed inset-0" style={getLayoutPadding()}>
        <div className="w-full h-full relative">
          {viewMode === 'map' && <MapComponent urlCoordinates={urlCoordinates} expectingUrlCoordinates={expectingUrlCoordinates} />}
          {viewMode === 'ar' && <ARView active={!mintAnimationActive} />}

          <DateTimeStrip className="absolute left-4 top-1/2 -translate-y-1/2 z-10" />

          <div className="absolute top-4 left-4 z-20">
            <CircleButton
              icon={<InfomationIcon />}
              aria-label="Show information"
              size="sm"
              onClick={handleOpenInfo}
            />
          </div>

          {isOrientationSupported && !arPermissionDenied && (
            <div className="absolute top-4 right-4 z-20">
              <ViewToggle />
            </div>
          )}
        </div>
      </main>

      <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>About NOROSI</DialogTitle>
            <DialogDescription>
              NOROSI is a geo-location based NFT platform.
              Discover NFTs on the map and build your collection.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  )
}
