"use client"

import React, { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { selectViewMode, setViewMode } from '@/lib/slices/sensorSlice'
import { CircleButton } from '@/components/ui/CircleButton'
import { ArIcon, MapIcon } from '@/components/ui/Icons'

export default function ViewToggle() {
  const dispatch = useDispatch()
  const viewMode = useSelector(selectViewMode)

  const toggle = useCallback(() => {
    dispatch(setViewMode(viewMode === 'map' ? 'ar' : 'map'))
  }, [dispatch, viewMode])

  return (
    <CircleButton
      icon={viewMode === 'map' ? <ArIcon /> : <MapIcon />}
      aria-label={viewMode === 'map' ? 'AR viewに切り替え' : 'Map viewに切り替え'}
      size="sm"
      variant="white"
      onClick={toggle}
    />
  )
}
