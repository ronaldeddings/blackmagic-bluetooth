/**
 * Camera Control Context
 * 
 * Provides camera control state management and methods across the application
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  blackmagicBluetoothManager,
  BlackmagicDeviceInfo,
  CameraSettings,
  RecordingState,
  FrameRate,
  Resolution,
  Codec,
  ColorSpace
} from '../services/bluetooth'

interface CameraControlContextType {
  // Connected devices with camera control capabilities
  connectedDevices: BlackmagicDeviceInfo[]
  selectedDevice: BlackmagicDeviceInfo | null
  
  // Camera settings for all connected devices
  cameraSettings: Record<string, CameraSettings>
  
  // Loading states
  isLoading: boolean
  recordingStates: Record<string, boolean>
  
  // Methods
  selectDevice: (device: BlackmagicDeviceInfo | null) => void
  refreshCameraSettings: (deviceId?: string) => Promise<void>
  
  // Recording controls
  startRecording: (deviceId: string) => Promise<void>
  stopRecording: (deviceId: string) => Promise<void>
  toggleRecording: (deviceId: string) => Promise<void>
  isRecording: (deviceId: string) => boolean
  
  // Camera controls
  setAutoFocus: (deviceId: string) => Promise<void>
  setManualFocus: (deviceId: string, value: number) => Promise<void>
  adjustFocus: (deviceId: string, direction: 'near' | 'far') => Promise<void>
  
  setAutoExposure: (deviceId: string) => Promise<void>
  setManualExposure: (deviceId: string, value: number) => Promise<void>
  adjustExposure: (deviceId: string, direction: 'up' | 'down') => Promise<void>
  
  setAutoISO: (deviceId: string) => Promise<void>
  setISO: (deviceId: string, iso: number) => Promise<void>
  
  setAutoWhiteBalance: (deviceId: string) => Promise<void>
  setWhiteBalance: (deviceId: string, preset: string) => Promise<void>
  
  // Settings controls
  setFrameRate: (deviceId: string, frameRate: FrameRate) => Promise<void>
  setResolution: (deviceId: string, resolution: Resolution) => Promise<void>
  setCodec: (deviceId: string, codec: Codec) => Promise<void>
  setColorSpace: (deviceId: string, colorSpace: ColorSpace) => Promise<void>
  
  // Utility methods
  getCameraStatus: (deviceId: string) => Promise<{
    isRecording: boolean
    settings: CameraSettings
    batteryLevel?: number
  } | null>
}

const CameraControlContext = createContext<CameraControlContextType | undefined>(undefined)

export const useCameraControl = () => {
  const context = useContext(CameraControlContext)
  if (!context) {
    throw new Error('useCameraControl must be used within a CameraControlProvider')
  }
  return context
}

interface CameraControlProviderProps {
  children: React.ReactNode
}

export const CameraControlProvider: React.FC<CameraControlProviderProps> = ({ children }) => {
  const [connectedDevices, setConnectedDevices] = useState<BlackmagicDeviceInfo[]>([])
  const [selectedDevice, setSelectedDevice] = useState<BlackmagicDeviceInfo | null>(null)
  const [cameraSettings, setCameraSettings] = useState<Record<string, CameraSettings>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [recordingStates, setRecordingStates] = useState<Record<string, boolean>>({})

  // Subscribe to connection changes
  useEffect(() => {
    const unsubscribe = blackmagicBluetoothManager.onConnectionStateChange((event) => {
      const { device, state } = event
      
      if (state === 'connected') {
        setConnectedDevices(prev => {
          const exists = prev.find(d => d.id === device.id)
          if (exists) return prev
          return [...prev, device]
        })
        
        // Auto-select first connected device
        if (!selectedDevice) {
          setSelectedDevice(device)
        }
        
        // Load camera settings for new device
        refreshCameraSettings(device.id)
      } else if (state === 'disconnected') {
        setConnectedDevices(prev => prev.filter(d => d.id !== device.id))
        
        // Clear camera settings for disconnected device
        setCameraSettings(prev => {
          const { [device.id]: removed, ...rest } = prev
          return rest
        })
        
        setRecordingStates(prev => {
          const { [device.id]: removed, ...rest } = prev
          return rest
        })
        
        // Unselect device if it was selected
        if (selectedDevice?.id === device.id) {
          const remainingDevices = connectedDevices.filter(d => d.id !== device.id)
          setSelectedDevice(remainingDevices.length > 0 ? remainingDevices[0] : null)
        }
      }
    })

    return unsubscribe
  }, [selectedDevice, connectedDevices])

  // Load initial connected devices
  useEffect(() => {
    const loadConnectedDevices = async () => {
      try {
        const devices = blackmagicBluetoothManager.getConnectedDevices()
        setConnectedDevices(devices)
        
        if (devices.length > 0 && !selectedDevice) {
          setSelectedDevice(devices[0])
        }
        
        // Load camera settings for all connected devices
        for (const device of devices) {
          await refreshCameraSettings(device.id)
        }
      } catch (error) {
        console.error('Failed to load connected devices:', error)
      }
    }

    loadConnectedDevices()
  }, [])

  const selectDevice = useCallback((device: BlackmagicDeviceInfo | null) => {
    setSelectedDevice(device)
  }, [])

  const refreshCameraSettings = useCallback(async (deviceId?: string) => {
    const devicesToRefresh = deviceId ? [deviceId] : connectedDevices.map(d => d.id)
    
    for (const id of devicesToRefresh) {
      try {
        const settings = await blackmagicBluetoothManager.getCameraSettings(id)
        setCameraSettings(prev => ({ ...prev, [id]: settings }))
        
        // Update recording state
        const isRecording = settings.recordingState === RecordingState.RECORDING
        setRecordingStates(prev => ({ ...prev, [id]: isRecording }))
      } catch (error) {
        console.error(`Failed to refresh camera settings for device ${id}:`, error)
      }
    }
  }, [connectedDevices])

  // Recording controls
  const startRecording = useCallback(async (deviceId: string) => {
    try {
      setIsLoading(true)
      await blackmagicBluetoothManager.startRecording(deviceId)
      await refreshCameraSettings(deviceId)
    } finally {
      setIsLoading(false)
    }
  }, [refreshCameraSettings])

  const stopRecording = useCallback(async (deviceId: string) => {
    try {
      setIsLoading(true)
      await blackmagicBluetoothManager.stopRecording(deviceId)
      await refreshCameraSettings(deviceId)
    } finally {
      setIsLoading(false)
    }
  }, [refreshCameraSettings])

  const toggleRecording = useCallback(async (deviceId: string) => {
    try {
      setIsLoading(true)
      await blackmagicBluetoothManager.toggleRecording(deviceId)
      await refreshCameraSettings(deviceId)
    } finally {
      setIsLoading(false)
    }
  }, [refreshCameraSettings])

  const isRecording = useCallback((deviceId: string): boolean => {
    return recordingStates[deviceId] || false
  }, [recordingStates])

  // Camera controls
  const setAutoFocus = useCallback(async (deviceId: string) => {
    try {
      setIsLoading(true)
      await blackmagicBluetoothManager.setAutoFocus(deviceId)
      await refreshCameraSettings(deviceId)
    } finally {
      setIsLoading(false)
    }
  }, [refreshCameraSettings])

  const setManualFocus = useCallback(async (deviceId: string, value: number) => {
    try {
      setIsLoading(true)
      await blackmagicBluetoothManager.setManualFocus(deviceId, value)
      await refreshCameraSettings(deviceId)
    } finally {
      setIsLoading(false)
    }
  }, [refreshCameraSettings])

  const adjustFocus = useCallback(async (deviceId: string, direction: 'near' | 'far') => {
    try {
      setIsLoading(true)
      await blackmagicBluetoothManager.adjustFocus(deviceId, direction)
      await refreshCameraSettings(deviceId)
    } finally {
      setIsLoading(false)
    }
  }, [refreshCameraSettings])

  const setAutoExposure = useCallback(async (deviceId: string) => {
    try {
      setIsLoading(true)
      await blackmagicBluetoothManager.setAutoExposure(deviceId)
      await refreshCameraSettings(deviceId)
    } finally {
      setIsLoading(false)
    }
  }, [refreshCameraSettings])

  const setManualExposure = useCallback(async (deviceId: string, value: number) => {
    try {
      setIsLoading(true)
      await blackmagicBluetoothManager.setManualExposure(deviceId, value)
      await refreshCameraSettings(deviceId)
    } finally {
      setIsLoading(false)
    }
  }, [refreshCameraSettings])

  const adjustExposure = useCallback(async (deviceId: string, direction: 'up' | 'down') => {
    try {
      setIsLoading(true)
      await blackmagicBluetoothManager.adjustExposure(deviceId, direction)
      await refreshCameraSettings(deviceId)
    } finally {
      setIsLoading(false)
    }
  }, [refreshCameraSettings])

  const setAutoISO = useCallback(async (deviceId: string) => {
    try {
      setIsLoading(true)
      await blackmagicBluetoothManager.setAutoISO(deviceId)
      await refreshCameraSettings(deviceId)
    } finally {
      setIsLoading(false)
    }
  }, [refreshCameraSettings])

  const setISO = useCallback(async (deviceId: string, iso: number) => {
    try {
      setIsLoading(true)
      await blackmagicBluetoothManager.setISO(deviceId, iso)
      await refreshCameraSettings(deviceId)
    } finally {
      setIsLoading(false)
    }
  }, [refreshCameraSettings])

  const setAutoWhiteBalance = useCallback(async (deviceId: string) => {
    try {
      setIsLoading(true)
      await blackmagicBluetoothManager.setAutoWhiteBalance(deviceId)
      await refreshCameraSettings(deviceId)
    } finally {
      setIsLoading(false)
    }
  }, [refreshCameraSettings])

  const setWhiteBalance = useCallback(async (deviceId: string, preset: string) => {
    try {
      setIsLoading(true)
      await blackmagicBluetoothManager.setWhiteBalance(deviceId, preset)
      await refreshCameraSettings(deviceId)
    } finally {
      setIsLoading(false)
    }
  }, [refreshCameraSettings])

  // Settings controls
  const setFrameRate = useCallback(async (deviceId: string, frameRate: FrameRate) => {
    try {
      setIsLoading(true)
      await blackmagicBluetoothManager.setFrameRate(deviceId, frameRate)
      await refreshCameraSettings(deviceId)
    } finally {
      setIsLoading(false)
    }
  }, [refreshCameraSettings])

  const setResolution = useCallback(async (deviceId: string, resolution: Resolution) => {
    try {
      setIsLoading(true)
      await blackmagicBluetoothManager.setResolution(deviceId, resolution)
      await refreshCameraSettings(deviceId)
    } finally {
      setIsLoading(false)
    }
  }, [refreshCameraSettings])

  const setCodec = useCallback(async (deviceId: string, codec: Codec) => {
    try {
      setIsLoading(true)
      await blackmagicBluetoothManager.setCodec(deviceId, codec)
      await refreshCameraSettings(deviceId)
    } finally {
      setIsLoading(false)
    }
  }, [refreshCameraSettings])

  const setColorSpace = useCallback(async (deviceId: string, colorSpace: ColorSpace) => {
    try {
      setIsLoading(true)
      await blackmagicBluetoothManager.setColorSpace(deviceId, colorSpace)
      await refreshCameraSettings(deviceId)
    } finally {
      setIsLoading(false)
    }
  }, [refreshCameraSettings])

  const getCameraStatus = useCallback(async (deviceId: string) => {
    try {
      return await blackmagicBluetoothManager.getCameraStatus(deviceId)
    } catch (error) {
      console.error('Failed to get camera status:', error)
      return null
    }
  }, [])

  const contextValue: CameraControlContextType = {
    connectedDevices,
    selectedDevice,
    cameraSettings,
    isLoading,
    recordingStates,
    selectDevice,
    refreshCameraSettings,
    startRecording,
    stopRecording,
    toggleRecording,
    isRecording,
    setAutoFocus,
    setManualFocus,
    adjustFocus,
    setAutoExposure,
    setManualExposure,
    adjustExposure,
    setAutoISO,
    setISO,
    setAutoWhiteBalance,
    setWhiteBalance,
    setFrameRate,
    setResolution,
    setCodec,
    setColorSpace,
    getCameraStatus
  }

  return (
    <CameraControlContext.Provider value={contextValue}>
      {children}
    </CameraControlContext.Provider>
  )
}