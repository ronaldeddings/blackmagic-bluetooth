/**
 * Audio Source Service (UUID 0x110A)
 * Handles streaming audio from Blackmagic cameras
 * 
 * This service provides:
 * - Audio streaming from camera to device
 * - Audio input configuration
 * - Audio level monitoring
 * - Real-time audio meter data
 */

import { 
  BLACKMAGIC_SERVICE_UUIDS,
  BlackmagicBluetoothError,
  IAudioSourceService,
  AudioConfig,
  AudioStreamInfo,
  AudioInputSettings,
  AudioMeterData,
  AudioStreamState,
  AudioQuality,
  AudioCodec,
  AudioChannelConfig,
  AudioLevel,
  AudioCapabilities,
  AudioDataCallback,
  AudioLevelCallback,
  BlackmagicBluetoothUtils
} from './types/BlackmagicTypes'

export interface AudioSourceServiceDependencies {
  readCharacteristic(deviceId: string, serviceUUID: string, characteristicUUID: string): Promise<string>
  writeCharacteristic(deviceId: string, serviceUUID: string, characteristicUUID: string, value: string): Promise<void>
  subscribeToCharacteristic(
    deviceId: string, 
    serviceUUID: string, 
    characteristicUUID: string, 
    callback: (error: Error | null, data: string | null) => void
  ): Promise<() => void>
  discoverCharacteristics(deviceId: string, serviceUUID: string): Promise<string[]>
}

// Audio Source Service characteristics
const AUDIO_SOURCE_CHARACTERISTICS = {
  AUDIO_CONTROL: '00002b80-0000-1000-8000-00805f9b34fb',      // Audio control point
  AUDIO_STATUS: '00002b81-0000-1000-8000-00805f9b34fb',       // Audio status
  AUDIO_DATA: '00002b82-0000-1000-8000-00805f9b34fb',         // Audio data stream
  AUDIO_CONFIG: '00002b83-0000-1000-8000-00805f9b34fb',       // Audio configuration
  AUDIO_LEVELS: '00002b84-0000-1000-8000-00805f9b34fb',       // Audio level meters
  INPUT_SETTINGS: '00002b85-0000-1000-8000-00805f9b34fb',     // Input configuration
  CAPABILITIES: '00002b86-0000-1000-8000-00805f9b34fb'        // Audio capabilities
} as const

// Audio control commands
enum AudioControlCommand {
  START_STREAM = 0x01,
  STOP_STREAM = 0x02,
  PAUSE_STREAM = 0x03,
  RESUME_STREAM = 0x04,
  CONFIGURE_INPUT = 0x05,
  GET_LEVELS = 0x06,
  GET_CAPABILITIES = 0x07
}

export class AudioSourceService implements IAudioSourceService {
  private dependencies: AudioSourceServiceDependencies
  private activeStreams = new Map<string, Map<string, AudioStreamInfo>>() // deviceId -> streamId -> info
  private levelSubscriptions = new Map<string, () => void>() // deviceId -> unsubscribe
  private audioDataSubscriptions = new Map<string, Map<string, () => void>>() // deviceId -> streamId -> unsubscribe
  private streamIdCounter = 0

  constructor(dependencies: AudioSourceServiceDependencies) {
    this.dependencies = dependencies
  }

  /**
   * Start audio streaming from camera
   */
  async startAudioStream(deviceId: string, config: AudioConfig): Promise<string> {
    try {
      const streamId = this.generateStreamId()
      
      // Verify audio source service is available
      await this.verifyService(deviceId)
      
      // Configure audio settings
      await this.configureAudioStream(deviceId, streamId, config)
      
      // Start the stream
      const command = this.encodeAudioCommand(AudioControlCommand.START_STREAM, {
        streamId,
        config
      })
      
      await this.dependencies.writeCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SOURCE,
        AUDIO_SOURCE_CHARACTERISTICS.AUDIO_CONTROL,
        command
      )
      
      // Initialize stream info
      const streamInfo: AudioStreamInfo = {
        id: streamId,
        deviceId,
        state: AudioStreamState.STARTING,
        config,
        levels: [],
        latency: 0,
        droppedFrames: 0,
        totalFrames: 0,
        duration: 0,
        startTime: new Date(),
        lastActivity: new Date()
      }
      
      // Store stream info
      if (!this.activeStreams.has(deviceId)) {
        this.activeStreams.set(deviceId, new Map())
      }
      this.activeStreams.get(deviceId)!.set(streamId, streamInfo)
      
      // Subscribe to status updates
      await this.subscribeToStreamStatus(deviceId, streamId)
      
      return streamId
      
    } catch (error) {
      throw new Error(`Failed to start audio stream: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Stop audio streaming
   */
  async stopAudioStream(deviceId: string, streamId: string): Promise<void> {
    try {
      const streamInfo = this.getStreamInfo(deviceId, streamId)
      if (!streamInfo) {
        throw new Error(`Stream ${streamId} not found for device ${deviceId}`)
      }
      
      // Update state
      streamInfo.state = AudioStreamState.STOPPING
      
      // Send stop command
      const command = this.encodeAudioCommand(AudioControlCommand.STOP_STREAM, { streamId })
      
      await this.dependencies.writeCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SOURCE,
        AUDIO_SOURCE_CHARACTERISTICS.AUDIO_CONTROL,
        command
      )
      
      // Cleanup subscriptions
      await this.cleanupStreamSubscriptions(deviceId, streamId)
      
      // Remove from active streams
      this.activeStreams.get(deviceId)?.delete(streamId)
      
    } catch (error) {
      throw new Error(`Failed to stop audio stream: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Pause audio streaming
   */
  async pauseAudioStream(deviceId: string, streamId: string): Promise<void> {
    try {
      const streamInfo = this.getStreamInfo(deviceId, streamId)
      if (!streamInfo) {
        throw new Error(`Stream ${streamId} not found for device ${deviceId}`)
      }
      
      if (streamInfo.state !== AudioStreamState.STREAMING) {
        throw new Error(`Cannot pause stream in state: ${streamInfo.state}`)
      }
      
      // Update state
      streamInfo.state = AudioStreamState.PAUSED
      
      // Send pause command
      const command = this.encodeAudioCommand(AudioControlCommand.PAUSE_STREAM, { streamId })
      
      await this.dependencies.writeCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SOURCE,
        AUDIO_SOURCE_CHARACTERISTICS.AUDIO_CONTROL,
        command
      )
      
    } catch (error) {
      throw new Error(`Failed to pause audio stream: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Resume audio streaming
   */
  async resumeAudioStream(deviceId: string, streamId: string): Promise<void> {
    try {
      const streamInfo = this.getStreamInfo(deviceId, streamId)
      if (!streamInfo) {
        throw new Error(`Stream ${streamId} not found for device ${deviceId}`)
      }
      
      if (streamInfo.state !== AudioStreamState.PAUSED) {
        throw new Error(`Cannot resume stream in state: ${streamInfo.state}`)
      }
      
      // Update state
      streamInfo.state = AudioStreamState.STREAMING
      
      // Send resume command
      const command = this.encodeAudioCommand(AudioControlCommand.RESUME_STREAM, { streamId })
      
      await this.dependencies.writeCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SOURCE,
        AUDIO_SOURCE_CHARACTERISTICS.AUDIO_CONTROL,
        command
      )
      
    } catch (error) {
      throw new Error(`Failed to resume audio stream: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get all active audio streams for device
   */
  async getActiveStreams(deviceId: string): Promise<AudioStreamInfo[]> {
    const deviceStreams = this.activeStreams.get(deviceId)
    if (!deviceStreams) {
      return []
    }
    
    return Array.from(deviceStreams.values())
  }

  /**
   * Get specific stream information
   */
  async getStreamInfo(deviceId: string, streamId: string): Promise<AudioStreamInfo> {
    const streamInfo = this.getStreamInfo(deviceId, streamId)
    if (!streamInfo) {
      throw new Error(`Stream ${streamId} not found for device ${deviceId}`)
    }
    
    return { ...streamInfo } // Return a copy
  }

  /**
   * Configure audio input settings
   */
  async configureAudioInput(deviceId: string, settings: AudioInputSettings): Promise<void> {
    try {
      await this.verifyService(deviceId)
      
      const configData = this.encodeInputSettings(settings)
      
      await this.dependencies.writeCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SOURCE,
        AUDIO_SOURCE_CHARACTERISTICS.INPUT_SETTINGS,
        configData
      )
      
    } catch (error) {
      throw new Error(`Failed to configure audio input: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get current audio input settings
   */
  async getAudioInputSettings(deviceId: string): Promise<AudioInputSettings> {
    try {
      await this.verifyService(deviceId)
      
      const data = await this.dependencies.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SOURCE,
        AUDIO_SOURCE_CHARACTERISTICS.INPUT_SETTINGS
      )
      
      return this.decodeInputSettings(data)
      
    } catch (error) {
      throw new Error(`Failed to get audio input settings: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Subscribe to real-time audio level updates
   */
  async subscribeToAudioLevels(
    deviceId: string,
    callback: (meterData: AudioMeterData) => void
  ): Promise<() => void> {
    try {
      await this.verifyService(deviceId)
      
      const unsubscribe = await this.dependencies.subscribeToCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SOURCE,
        AUDIO_SOURCE_CHARACTERISTICS.AUDIO_LEVELS,
        (error, data) => {
          if (error) {
            console.error(`Audio level subscription error for ${deviceId}:`, error)
            return
          }
          
          if (data) {
            try {
              const meterData = this.decodeAudioMeterData(data)
              callback(meterData)
            } catch (parseError) {
              console.error('Failed to parse audio meter data:', parseError)
            }
          }
        }
      )
      
      // Store unsubscribe function
      const existingUnsubscribe = this.levelSubscriptions.get(deviceId)
      if (existingUnsubscribe) {
        existingUnsubscribe() // Cleanup previous subscription
      }
      this.levelSubscriptions.set(deviceId, unsubscribe)
      
      return unsubscribe
      
    } catch (error) {
      throw new Error(`Failed to subscribe to audio levels: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get current audio levels (one-time read)
   */
  async getAudioLevels(deviceId: string): Promise<AudioMeterData> {
    try {
      await this.verifyService(deviceId)
      
      const data = await this.dependencies.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SOURCE,
        AUDIO_SOURCE_CHARACTERISTICS.AUDIO_LEVELS
      )
      
      return this.decodeAudioMeterData(data)
      
    } catch (error) {
      throw new Error(`Failed to get audio levels: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Subscribe to raw audio data stream
   */
  async subscribeToAudioData(
    deviceId: string,
    streamId: string,
    callback: AudioDataCallback
  ): Promise<() => void> {
    try {
      const streamInfo = this.getStreamInfo(deviceId, streamId)
      if (!streamInfo) {
        throw new Error(`Stream ${streamId} not found for device ${deviceId}`)
      }
      
      const unsubscribe = await this.dependencies.subscribeToCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SOURCE,
        AUDIO_SOURCE_CHARACTERISTICS.AUDIO_DATA,
        (error, data) => {
          if (error) {
            console.error(`Audio data subscription error for ${deviceId}/${streamId}:`, error)
            return
          }
          
          if (data) {
            try {
              const audioData = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
              
              // Update stream statistics
              streamInfo.totalFrames++
              streamInfo.lastActivity = new Date()
              streamInfo.duration = (Date.now() - (streamInfo.startTime?.getTime() || Date.now())) / 1000
              
              callback(audioData)
            } catch (parseError) {
              console.error('Failed to parse audio data:', parseError)
              streamInfo.droppedFrames++
            }
          }
        }
      )
      
      // Store unsubscribe function
      if (!this.audioDataSubscriptions.has(deviceId)) {
        this.audioDataSubscriptions.set(deviceId, new Map())
      }
      
      const existingUnsubscribe = this.audioDataSubscriptions.get(deviceId)!.get(streamId)
      if (existingUnsubscribe) {
        existingUnsubscribe() // Cleanup previous subscription
      }
      
      this.audioDataSubscriptions.get(deviceId)!.set(streamId, unsubscribe)
      
      return unsubscribe
      
    } catch (error) {
      throw new Error(`Failed to subscribe to audio data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get audio capabilities of the device
   */
  async getAudioCapabilities(deviceId: string): Promise<AudioCapabilities> {
    try {
      await this.verifyService(deviceId)
      
      const data = await this.dependencies.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SOURCE,
        AUDIO_SOURCE_CHARACTERISTICS.CAPABILITIES
      )
      
      return this.decodeAudioCapabilities(data)
      
    } catch (error) {
      throw new Error(`Failed to get audio capabilities: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Cleanup all subscriptions for a device
   */
  async cleanup(deviceId: string): Promise<void> {
    // Clean up level subscriptions
    const levelUnsubscribe = this.levelSubscriptions.get(deviceId)
    if (levelUnsubscribe) {
      levelUnsubscribe()
      this.levelSubscriptions.delete(deviceId)
    }
    
    // Clean up audio data subscriptions
    const deviceAudioSubs = this.audioDataSubscriptions.get(deviceId)
    if (deviceAudioSubs) {
      for (const unsubscribe of deviceAudioSubs.values()) {
        unsubscribe()
      }
      this.audioDataSubscriptions.delete(deviceId)
    }
    
    // Clean up active streams
    this.activeStreams.delete(deviceId)
  }

  // Private helper methods

  private async verifyService(deviceId: string): Promise<void> {
    try {
      const characteristics = await this.dependencies.discoverCharacteristics(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SOURCE
      )
      
      if (characteristics.length === 0) {
        throw new Error('Audio Source service not available on device')
      }
    } catch (error) {
      throw new Error(`Audio Source service verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private generateStreamId(): string {
    return `audio_stream_${++this.streamIdCounter}_${Date.now()}`
  }

  private getStreamInfo(deviceId: string, streamId: string): AudioStreamInfo | undefined {
    return this.activeStreams.get(deviceId)?.get(streamId)
  }

  private async configureAudioStream(deviceId: string, streamId: string, config: AudioConfig): Promise<void> {
    const configData = this.encodeAudioConfig(streamId, config)
    
    await this.dependencies.writeCharacteristic(
      deviceId,
      BLACKMAGIC_SERVICE_UUIDS.AUDIO_SOURCE,
      AUDIO_SOURCE_CHARACTERISTICS.AUDIO_CONFIG,
      configData
    )
  }

  private async subscribeToStreamStatus(deviceId: string, streamId: string): Promise<void> {
    await this.dependencies.subscribeToCharacteristic(
      deviceId,
      BLACKMAGIC_SERVICE_UUIDS.AUDIO_SOURCE,
      AUDIO_SOURCE_CHARACTERISTICS.AUDIO_STATUS,
      (error, data) => {
        if (error) {
          console.error(`Stream status subscription error for ${deviceId}/${streamId}:`, error)
          return
        }
        
        if (data) {
          this.handleStreamStatusUpdate(deviceId, streamId, data)
        }
      }
    )
  }

  private handleStreamStatusUpdate(deviceId: string, streamId: string, data: string): void {
    try {
      const status = this.decodeStreamStatus(data)
      const streamInfo = this.getStreamInfo(deviceId, streamId)
      
      if (streamInfo && status.streamId === streamId) {
        streamInfo.state = status.state
        streamInfo.latency = status.latency || streamInfo.latency
        streamInfo.lastActivity = new Date()
      }
    } catch (error) {
      console.error('Failed to parse stream status:', error)
    }
  }

  private async cleanupStreamSubscriptions(deviceId: string, streamId: string): Promise<void> {
    const deviceAudioSubs = this.audioDataSubscriptions.get(deviceId)
    if (deviceAudioSubs) {
      const unsubscribe = deviceAudioSubs.get(streamId)
      if (unsubscribe) {
        unsubscribe()
        deviceAudioSubs.delete(streamId)
      }
    }
  }

  // Data encoding/decoding methods

  private encodeAudioCommand(command: AudioControlCommand, data: any): string {
    const buffer = new ArrayBuffer(32) // Fixed size for commands
    const view = new DataView(buffer)
    
    view.setUint8(0, command)
    
    if (data.streamId) {
      const streamIdBytes = new TextEncoder().encode(data.streamId)
      for (let i = 0; i < Math.min(streamIdBytes.length, 15); i++) {
        view.setUint8(1 + i, streamIdBytes[i])
      }
    }
    
    if (data.config) {
      view.setUint8(16, this.encodeAudioQuality(data.config.quality))
      view.setUint8(17, this.encodeAudioCodec(data.config.codec))
      view.setUint8(18, this.encodeChannelConfig(data.config.channels))
      view.setUint32(19, data.config.sampleRate, true)
      view.setUint8(23, data.config.bitDepth)
    }
    
    return BlackmagicBluetoothUtils.arrayBufferToBase64(buffer)
  }

  private encodeAudioConfig(streamId: string, config: AudioConfig): string {
    const buffer = new ArrayBuffer(64)
    const view = new DataView(buffer)
    
    // Stream ID (first 16 bytes)
    const streamIdBytes = new TextEncoder().encode(streamId)
    for (let i = 0; i < Math.min(streamIdBytes.length, 16); i++) {
      view.setUint8(i, streamIdBytes[i])
    }
    
    // Audio configuration
    view.setUint8(16, this.encodeAudioQuality(config.quality))
    view.setUint8(17, this.encodeAudioCodec(config.codec))
    view.setUint8(18, this.encodeChannelConfig(config.channels))
    view.setUint32(19, config.sampleRate, true)
    view.setUint8(23, config.bitDepth)
    
    if (config.bitRate) {
      view.setUint32(24, config.bitRate, true)
    }
    
    if (config.bufferSize) {
      view.setUint32(28, config.bufferSize, true)
    }
    
    return BlackmagicBluetoothUtils.arrayBufferToBase64(buffer)
  }

  private encodeInputSettings(settings: AudioInputSettings): string {
    const buffer = new ArrayBuffer(32)
    const view = new DataView(buffer)
    
    view.setUint8(0, settings.micGain)
    view.setUint8(1, settings.micMute ? 1 : 0)
    view.setUint8(2, settings.phantomPower ? 1 : 0)
    view.setUint8(3, settings.lowCutFilter ? 1 : 0)
    view.setUint8(4, settings.windNoise ? 1 : 0)
    
    // Input source mapping
    const sourceMap = { 'internal': 0, 'external': 1, 'xlr': 2, 'line': 3 }
    view.setUint8(5, sourceMap[settings.inputSource] || 0)
    
    view.setUint8(6, settings.monitoring ? 1 : 0)
    view.setUint8(7, settings.monitorLevel)
    view.setUint8(8, settings.autoGain ? 1 : 0)
    view.setUint8(9, settings.compressor ? 1 : 0)
    view.setUint8(10, settings.limiter ? 1 : 0)
    view.setUint8(11, settings.noiseSuppression ? 1 : 0)
    
    return BlackmagicBluetoothUtils.arrayBufferToBase64(buffer)
  }

  private decodeInputSettings(data: string): AudioInputSettings {
    const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
    const view = new DataView(buffer)
    
    const sourceMap = ['internal', 'external', 'xlr', 'line'] as const
    
    return {
      micGain: view.getUint8(0),
      micMute: view.getUint8(1) === 1,
      phantomPower: view.getUint8(2) === 1,
      lowCutFilter: view.getUint8(3) === 1,
      windNoise: view.getUint8(4) === 1,
      inputSource: sourceMap[view.getUint8(5)] || 'internal',
      monitoring: view.getUint8(6) === 1,
      monitorLevel: view.getUint8(7),
      autoGain: view.getUint8(8) === 1,
      compressor: view.getUint8(9) === 1,
      limiter: view.getUint8(10) === 1,
      noiseSuppression: view.getUint8(11) === 1
    }
  }

  private decodeAudioMeterData(data: string): AudioMeterData {
    const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
    const view = new DataView(buffer)
    
    const channelCount = view.getUint8(0)
    const levels: AudioLevel[] = []
    const peakHold: number[] = []
    const vuMeter: number[] = []
    const overload: boolean[] = []
    
    let offset = 1
    
    for (let i = 0; i < channelCount; i++) {
      const level = view.getFloat32(offset, true) // Convert from dB
      const peak = view.getFloat32(offset + 4, true)
      const vu = view.getFloat32(offset + 8, true)
      const overloadFlag = view.getUint8(offset + 12) === 1
      
      levels.push({
        level,
        peak,
        channel: i,
        timestamp: new Date()
      })
      
      peakHold.push(peak)
      vuMeter.push(vu)
      overload.push(overloadFlag)
      
      offset += 13
    }
    
    return {
      levels,
      peakHold,
      vuMeter,
      overload,
      timestamp: new Date()
    }
  }

  private decodeStreamStatus(data: string): any {
    const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
    const view = new DataView(buffer)
    
    // Decode stream ID
    const streamIdBytes = new Uint8Array(buffer, 0, 16)
    const streamIdEnd = streamIdBytes.indexOf(0)
    const streamId = new TextDecoder().decode(streamIdBytes.subarray(0, streamIdEnd === -1 ? 16 : streamIdEnd))
    
    const stateMap = [
      AudioStreamState.STOPPED,
      AudioStreamState.STARTING,
      AudioStreamState.STREAMING,
      AudioStreamState.STOPPING,
      AudioStreamState.PAUSED
    ]
    
    return {
      streamId,
      state: stateMap[view.getUint8(16)] || AudioStreamState.STOPPED,
      latency: view.getUint32(17, true)
    }
  }

  private decodeAudioCapabilities(data: string): AudioCapabilities {
    const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
    const view = new DataView(buffer)
    
    // This is a simplified decoder - actual implementation would be more complex
    return {
      supportedCodecs: [AudioCodec.PCM, AudioCodec.AAC],
      supportedQualities: [AudioQuality.MEDIUM, AudioQuality.HIGH],
      supportedChannelConfigs: [AudioChannelConfig.MONO, AudioChannelConfig.STEREO],
      supportedSampleRates: [16000, 44100, 48000],
      supportedBitDepths: [16, 24],
      hasInternalMicrophone: view.getUint8(0) === 1,
      hasExternalInput: view.getUint8(1) === 1,
      hasXLRInput: view.getUint8(2) === 1,
      hasPhantomPower: view.getUint8(3) === 1,
      hasHeadphoneOutput: view.getUint8(4) === 1,
      hasLineOutput: view.getUint8(5) === 1,
      hasAutoGain: view.getUint8(6) === 1,
      hasNoiseReduction: view.getUint8(7) === 1,
      hasCompressor: view.getUint8(8) === 1,
      hasLimiter: view.getUint8(9) === 1,
      hasLowCutFilter: view.getUint8(10) === 1,
      maxConcurrentStreams: view.getUint8(11),
      maxBitRate: view.getUint32(12, true),
      minLatency: view.getUint32(16, true),
      bufferSizes: [256, 512, 1024, 2048]
    }
  }

  private encodeAudioQuality(quality: AudioQuality): number {
    const qualityMap = { [AudioQuality.LOW]: 0, [AudioQuality.MEDIUM]: 1, [AudioQuality.HIGH]: 2, [AudioQuality.ULTRA]: 3 }
    return qualityMap[quality] || 1
  }

  private encodeAudioCodec(codec: AudioCodec): number {
    const codecMap = { [AudioCodec.PCM]: 0, [AudioCodec.AAC]: 1, [AudioCodec.MP3]: 2, [AudioCodec.OPUS]: 3 }
    return codecMap[codec] || 0
  }

  private encodeChannelConfig(channels: AudioChannelConfig): number {
    const channelMap = { 
      [AudioChannelConfig.MONO]: 1, 
      [AudioChannelConfig.STEREO]: 2, 
      [AudioChannelConfig.SURROUND_5_1]: 6, 
      [AudioChannelConfig.SURROUND_7_1]: 8 
    }
    return channelMap[channels] || 2
  }
}