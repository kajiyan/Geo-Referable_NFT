import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import MapComponent from '../MapComponent'

// Mock react-map-gl/maplibre
jest.mock('react-map-gl/maplibre', () => {
  const MockMap = React.forwardRef(({ children, onLoad, onError, ...props }: any, _ref: any) => {
    React.useEffect(() => {
      // Simulate successful map load
      setTimeout(() => onLoad?.(), 100)
    }, [onLoad])

    return (
      <div data-testid="map-container" {...props}>
        {children}
      </div>
    )
  })
  
  return {
    __esModule: true,
    default: MockMap,
    NavigationControl: ({ position }: any) => <div data-testid={`nav-control-${position}`} />,
    AttributionControl: ({ position }: any) => <div data-testid={`attribution-${position}`} />,
  }
})

// Mock maplibre-gl CSS import
jest.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

describe('MapComponent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render map container', () => {
    render(<MapComponent />)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('should render navigation and attribution controls', () => {
    render(<MapComponent />)
    expect(screen.getByTestId('nav-control-top-right')).toBeInTheDocument()
    expect(screen.getByTestId('attribution-bottom-right')).toBeInTheDocument()
  })

  it('should handle map load successfully', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    render(<MapComponent />)
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Map loaded successfully')
    })
    
    consoleSpy.mockRestore()
  })
})