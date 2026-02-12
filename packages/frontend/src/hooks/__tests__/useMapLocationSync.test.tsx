import React from 'react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import sensorReducer, { updateGpsPosition } from '@/lib/slices/sensorSlice'
import { render, act } from '@testing-library/react'
import { useMapLocationSync } from '@/hooks/useMapLocationSync'

function TestComp({ mapRef }: { mapRef: any }) {
  useMapLocationSync(mapRef, { enabled: true, minAccuracy: 100, fly: false })
  return null
}

describe('useMapLocationSync', () => {
  it('should call map.easeTo on GPS updates with good accuracy', () => {
    const easeTo = jest.fn()
    const flyTo = jest.fn()
    const mapObj = { easeTo, flyTo }
    const mapRef = { current: { getMap: () => mapObj } }

    const store = configureStore({ reducer: { sensor: sensorReducer } })
    render(
      <Provider store={store}>
        <TestComp mapRef={mapRef} />
      </Provider>,
    )

    act(() => {
      store.dispatch(
        updateGpsPosition({ latitude: 35.6584, longitude: 139.7454, accuracy: 20, timestamp: Date.now() }),
      )
    })

    expect(easeTo).toHaveBeenCalled()
    expect(flyTo).not.toHaveBeenCalled()
  })
})

