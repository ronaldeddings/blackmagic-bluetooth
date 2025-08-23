/**
 * Audio Sink Service (UUID 0x110B)
 * Handles sending audio to Blackmagic cameras (talkback functionality)
 * 
 * This service provides:
 * - Talkback audio streaming to camera
 * - Audio output configuration
 * - Audio codec negotiation
 * - Two-way communication support
 */

import { 
  BLACKMAGIC_SERVICE_UUIDS,
  BlackmagicBluetoothError,
  IAudioSinkService,
  AudioConfig,
  AudioOutputSettings,
  AudioCodec,
  AudioQuality,
  AudioChannelConfig,
  AudioCapabilities,
  BlackmagicBluetoothUtils
} from './types/BlackmagicTypes'

export interface AudioSinkServiceDependencies {
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

// Audio Sink Service characteristics
const AUDIO_SINK_CHARACTERISTICS = {
  AUDIO_CONTROL: '00002b90-0000-1000-8000-00805f9b34fb',      // Audio sink control point
  AUDIO_STATUS: '00002b91-0000-1000-8000-00805f9b34fb',       // Audio sink status
  AUDIO_INPUT: '00002b92-0000-1000-8000-00805f9b34fb',        // Audio data input to camera
  AUDIO_CONFIG: '00002b93-0000-1000-8000-00805f9b34fb',       // Audio sink configuration
  OUTPUT_SETTINGS: '00002b94-0000-1000-8000-00805f9b34fb',    // Output configuration
  CODEC_NEGOTIATION: '00002b95-0000-1000-8000-00805f9b34fb',  // Codec negotiation
  TALKBACK_CONTROL: '00002b96-0000-1000-8000-00805f9b34fb'    // Talkback session control
} as const

// Audio sink control commands
enum AudioSinkCommand {
  START_TALKBACK = 0x01,
  STOP_TALKBACK = 0x02,
  CONFIGURE_OUTPUT = 0x03,
  NEGOTIATE_CODEC = 0x04,
  GET_SUPPORTED_CODECS = 0x05,
  SET_TALKBACK_LEVEL = 0x06,
  MUTE_OUTPUT = 0x07,
  UNMUTE_OUTPUT = 0x08
}

export interface TalkbackSession {
  id: string
  deviceId: string
  config: AudioConfig
  isActive: boolean
  startTime: Date
  lastActivity: Date
  bytesTransmitted: number
}

export class AudioSinkService implements IAudioSinkService {
  private dependencies: AudioSinkServiceDependencies
  private activeTalkbackSessions = new Map<string, Map<string, TalkbackSession>>() // deviceId -> sessionId -> session
  private talkbackIdCounter = 0
  private audioBuffers = new Map<string, ArrayBuffer[]>() // deviceId -> buffer queue

  constructor(dependencies: AudioSinkServiceDependencies) {
    this.dependencies = dependencies
  }

  /**
   * Send raw audio data to camera
   */
  async sendAudioData(deviceId: string, audioData: ArrayBuffer): Promise<void> {
    try {
      await this.verifyService(deviceId)
      
      // Convert audio data to base64 for transmission
      const base64Data = BlackmagicBluetoothUtils.arrayBufferToBase64(audioData)
      
      // Add to buffer queue for better transmission reliability
      if (!this.audioBuffers.has(deviceId)) {
        this.audioBuffers.set(deviceId, [])
      }
      
      this.audioBuffers.get(deviceId)!.push(audioData)
      
      // Send the audio data
      await this.dependencies.writeCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SINK,
        AUDIO_SINK_CHARACTERISTICS.AUDIO_INPUT,
        base64Data
      )
      
      // Update session statistics if talkback is active
      const deviceSessions = this.activeTalkbackSessions.get(deviceId)
      if (deviceSessions) {
        for (const session of deviceSessions.values()) {
          if (session.isActive) {
            session.bytesTransmitted += audioData.byteLength
            session.lastActivity = new Date()
          }
        }
      }
      
    } catch (error) {
      throw new Error(`Failed to send audio data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Start a talkback session
   */
  async startTalkback(deviceId: string, config: AudioConfig): Promise<string> {
    try {
      const talkbackId = this.generateTalkbackId()
      
      await this.verifyService(deviceId)
      
      // Configure talkback settings
      await this.configureTalkbackSession(deviceId, talkbackId, config)
      
      // Start talkback session
      const command = this.encodeTalkbackCommand(AudioSinkCommand.START_TALKBACK, {
        talkbackId,
        config
      })
      
      await this.dependencies.writeCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SINK,
        AUDIO_SINK_CHARACTERISTICS.TALKBACK_CONTROL,
        command
      )
      
      // Create session info
      const session: TalkbackSession = {
        id: talkbackId,
        deviceId,
        config,
        isActive: true,
        startTime: new Date(),
        lastActivity: new Date(),
        bytesTransmitted: 0
      }
      
      // Store session
      if (!this.activeTalkbackSessions.has(deviceId)) {
        this.activeTalkbackSessions.set(deviceId, new Map())
      }
      this.activeTalkbackSessions.get(deviceId)!.set(talkbackId, session)
      
      // Subscribe to talkback status updates
      await this.subscribeToTalkbackStatus(deviceId, talkbackId)
      
      return talkbackId
      
    } catch (error) {
      throw new Error(`Failed to start talkback: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Stop a talkback session
   */
  async stopTalkback(deviceId: string, talkbackId: string): Promise<void> {
    try {
      const session = this.getTalkbackSession(deviceId, talkbackId)
      if (!session) {
        throw new Error(`Talkback session ${talkbackId} not found for device ${deviceId}`)
      }
      
      // Mark as inactive
      session.isActive = false
      
      // Send stop command
      const command = this.encodeTalkbackCommand(AudioSinkCommand.STOP_TALKBACK, { talkbackId })
      
      await this.dependencies.writeCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SINK,
        AUDIO_SINK_CHARACTERISTICS.TALKBACK_CONTROL,
        command
      )
      
      // Remove from active sessions
      this.activeTalkbackSessions.get(deviceId)?.delete(talkbackId)
      
      // Clear audio buffers for this device if no active sessions
      const deviceSessions = this.activeTalkbackSessions.get(deviceId)
      if (!deviceSessions || deviceSessions.size === 0) {
        this.audioBuffers.delete(deviceId)
      }
      
    } catch (error) {
      throw new Error(`Failed to stop talkback: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Configure audio output settings
   */
  async configureAudioOutput(deviceId: string, settings: AudioOutputSettings): Promise<void> {
    try {
      await this.verifyService(deviceId)
      
      const configData = this.encodeOutputSettings(settings)
      
      await this.dependencies.writeCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SINK,
        AUDIO_SINK_CHARACTERISTICS.OUTPUT_SETTINGS,
        configData
      )
      
    } catch (error) {
      throw new Error(`Failed to configure audio output: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get current audio output settings
   */
  async getAudioOutputSettings(deviceId: string): Promise<AudioOutputSettings> {
    try {
      await this.verifyService(deviceId)
      
      const data = await this.dependencies.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SINK,
        AUDIO_SINK_CHARACTERISTICS.OUTPUT_SETTINGS
      )
      
      return this.decodeOutputSettings(data)
      
    } catch (error) {
      throw new Error(`Failed to get audio output settings: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get supported audio codecs
   */
  async getSupportedCodecs(deviceId: string): Promise<AudioCodec[]> {
    try {
      await this.verifyService(deviceId)
      
      // Send command to get supported codecs
      const command = this.encodeTalkbackCommand(AudioSinkCommand.GET_SUPPORTED_CODECS, {})
      
      await this.dependencies.writeCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SINK,
        AUDIO_SINK_CHARACTERISTICS.CODEC_NEGOTIATION,
        command
      )
      
      // Read the response
      const data = await this.dependencies.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SINK,
        AUDIO_SINK_CHARACTERISTICS.CODEC_NEGOTIATION
      )
      
      return this.decodeSupportedCodecs(data)
      
    } catch (error) {
      throw new Error(`Failed to get supported codecs: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Negotiate audio codec with camera
   */
  async negotiateCodec(deviceId: string, preferredCodec: AudioCodec): Promise<AudioCodec> {
    try {
      await this.verifyService(deviceId)
      
      // Send codec negotiation request
      const command = this.encodeTalkbackCommand(AudioSinkCommand.NEGOTIATE_CODEC, {
        codec: preferredCodec
      })
      
      await this.dependencies.writeCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SINK,
        AUDIO_SINK_CHARACTERISTICS.CODEC_NEGOTIATION,
        command
      )
      
      // Read negotiation response
      const data = await this.dependencies.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SINK,
        AUDIO_SINK_CHARACTERISTICS.CODEC_NEGOTIATION
      )
      
      return this.decodeNegotiatedCodec(data)
      
    } catch (error) {
      throw new Error(`Failed to negotiate codec: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get active talkback sessions for device
   */
  async getTalkbackSessions(deviceId: string): Promise<string[]> {
    const deviceSessions = this.activeTalkbackSessions.get(deviceId)
    if (!deviceSessions) {
      return []
    }
    
    return Array.from(deviceSessions.keys())
  }

  /**
   * Configure talkback settings
   */
  async configureTalkback(deviceId: string, settings: {
    level: number
    codec: AudioCodec
    quality: AudioQuality
  }): Promise<void> {
    try {
      await this.verifyService(deviceId)
      
      const configData = this.encodeTalkbackConfig(settings)
      
      await this.dependencies.writeCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SINK,
        AUDIO_SINK_CHARACTERISTICS.TALKBACK_CONTROL,
        configData
      )
      
    } catch (error) {
      throw new Error(`Failed to configure talkback: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get talkback session information
   */
  getTalkbackSessionInfo(deviceId: string, talkbackId: string): TalkbackSession | undefined {
    return this.activeTalkbackSessions.get(deviceId)?.get(talkbackId)
  }

  /**
   * Cleanup all talkback sessions for a device
   */
  async cleanup(deviceId: string): Promise<void> {
    const deviceSessions = this.activeTalkbackSessions.get(deviceId)
    if (deviceSessions) {
      // Stop all active sessions
      for (const [talkbackId] of deviceSessions) {
        try {
          await this.stopTalkback(deviceId, talkbackId)
        } catch (error) {
          console.error(`Failed to stop talkback session ${talkbackId}:`, error)
        }
      }
      
      this.activeTalkbackSessions.delete(deviceId)
    }
    
    // Clear audio buffers
    this.audioBuffers.delete(deviceId)
  }

  // Private helper methods

  private async verifyService(deviceId: string): Promise<void> {
    try {
      const characteristics = await this.dependencies.discoverCharacteristics(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.AUDIO_SINK
      )
      
      if (characteristics.length === 0) {
        throw new Error('Audio Sink service not available on device')
      }
    } catch (error) {
      throw new Error(`Audio Sink service verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private generateTalkbackId(): string {
    return `talkback_${++this.talkbackIdCounter}_${Date.now()}`
  }

  private getTalkbackSession(deviceId: string, talkbackId: string): TalkbackSession | undefined {
    return this.activeTalkbackSessions.get(deviceId)?.get(talkbackId)
  }

  private async configureTalkbackSession(deviceId: string, talkbackId: string, config: AudioConfig): Promise<void> {
    const configData = this.encodeTalkbackSessionConfig(talkbackId, config)
    
    await this.dependencies.writeCharacteristic(
      deviceId,
      BLACKMAGIC_SERVICE_UUIDS.AUDIO_SINK,
      AUDIO_SINK_CHARACTERISTICS.AUDIO_CONFIG,
      configData
    )
  }

  private async subscribeToTalkbackStatus(deviceId: string, talkbackId: string): Promise<void> {
    await this.dependencies.subscribeToCharacteristic(
      deviceId,
      BLACKMAGIC_SERVICE_UUIDS.AUDIO_SINK,
      AUDIO_SINK_CHARACTERISTICS.AUDIO_STATUS,
      (error, data) => {
        if (error) {
          console.error(`Talkback status subscription error for ${deviceId}/${talkbackId}:`, error)
          return
        }
        
        if (data) {
          this.handleTalkbackStatusUpdate(deviceId, talkbackId, data)
        }
      }
    )
  }

  private handleTalkbackStatusUpdate(deviceId: string, talkbackId: string, data: string): void {
    try {
      const status = this.decodeTalkbackStatus(data)
      const session = this.getTalkbackSession(deviceId, talkbackId)
      
      if (session && status.talkbackId === talkbackId) {
        session.isActive = status.isActive
        session.lastActivity = new Date()
        
        if (!status.isActive) {
          // Session ended remotely, clean up
          this.activeTalkbackSessions.get(deviceId)?.delete(talkbackId)
        }
      }
    } catch (error) {
      console.error('Failed to parse talkback status:', error)
    }
  }

  // Data encoding/decoding methods

  private encodeTalkbackCommand(command: AudioSinkCommand, data: any): string {
    const buffer = new ArrayBuffer(64) // Larger buffer for talkback commands
    const view = new DataView(buffer)
    
    view.setUint8(0, command)
    
    if (data.talkbackId) {
      const talkbackIdBytes = new TextEncoder().encode(data.talkbackId)
      for (let i = 0; i < Math.min(talkbackIdBytes.length, 31); i++) {
        view.setUint8(1 + i, talkbackIdBytes[i])
      }
    }
    
    if (data.config) {
      view.setUint8(32, this.encodeAudioQuality(data.config.quality))
      view.setUint8(33, this.encodeAudioCodec(data.config.codec))
      view.setUint8(34, this.encodeChannelConfig(data.config.channels))
      view.setUint32(35, data.config.sampleRate, true)
      view.setUint8(39, data.config.bitDepth)
    }
    
    if (data.codec) {
      view.setUint8(40, this.encodeAudioCodec(data.codec))
    }
    
    return BlackmagicBluetoothUtils.arrayBufferToBase64(buffer)
  }

  private encodeTalkbackSessionConfig(talkbackId: string, config: AudioConfig): string {
    const buffer = new ArrayBuffer(64)
    const view = new DataView(buffer)
    
    // Talkback ID (first 32 bytes)
    const talkbackIdBytes = new TextEncoder().encode(talkbackId)
    for (let i = 0; i < Math.min(talkbackIdBytes.length, 32); i++) {
      view.setUint8(i, talkbackIdBytes[i])
    }
    
    // Audio configuration
    view.setUint8(32, this.encodeAudioQuality(config.quality))
    view.setUint8(33, this.encodeAudioCodec(config.codec))
    view.setUint8(34, this.encodeChannelConfig(config.channels))
    view.setUint32(35, config.sampleRate, true)
    view.setUint8(39, config.bitDepth)
    
    if (config.bitRate) {
      view.setUint32(40, config.bitRate, true)
    }
    
    if (config.bufferSize) {
      view.setUint32(44, config.bufferSize, true)
    }
    
    return BlackmagicBluetoothUtils.arrayBufferToBase64(buffer)
  }

  private encodeOutputSettings(settings: AudioOutputSettings): string {
    const buffer = new ArrayBuffer(16)
    const view = new DataView(buffer)
    
    view.setUint8(0, settings.outputLevel)
    view.setUint8(1, settings.outputMute ? 1 : 0)
    
    // Output destination mapping
    const destMap = { 'headphones': 0, 'line': 1, 'both': 2 }
    view.setUint8(2, destMap[settings.outputDestination] || 0)
    
    view.setUint8(3, settings.talkbackEnabled ? 1 : 0)
    view.setUint8(4, settings.talkbackLevel)
    view.setUint8(5, settings.playbackMonitoring ? 1 : 0)
    view.setUint8(6, settings.playbackLevel)
    
    return BlackmagicBluetoothUtils.arrayBufferToBase64(buffer)
  }

  private encodeTalkbackConfig(settings: {
    level: number
    codec: AudioCodec
    quality: AudioQuality
  }): string {
    const buffer = new ArrayBuffer(8)
    const view = new DataView(buffer)
    
    view.setUint8(0, settings.level)
    view.setUint8(1, this.encodeAudioCodec(settings.codec))
    view.setUint8(2, this.encodeAudioQuality(settings.quality))
    
    return BlackmagicBluetoothUtils.arrayBufferToBase64(buffer)
  }

  private decodeOutputSettings(data: string): AudioOutputSettings {
    const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
    const view = new DataView(buffer)
    
    const destMap = ['headphones', 'line', 'both'] as const
    
    return {
      outputLevel: view.getUint8(0),
      outputMute: view.getUint8(1) === 1,
      outputDestination: destMap[view.getUint8(2)] || 'headphones',
      talkbackEnabled: view.getUint8(3) === 1,
      talkbackLevel: view.getUint8(4),
      playbackMonitoring: view.getUint8(5) === 1,
      playbackLevel: view.getUint8(6)
    }
  }

  private decodeSupportedCodecs(data: string): AudioCodec[] {
    const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
    const view = new DataView(buffer)
    
    const codecCount = view.getUint8(0)
    const codecs: AudioCodec[] = []
    
    const codecMap = [AudioCodec.PCM, AudioCodec.AAC, AudioCodec.MP3, AudioCodec.OPUS]
    
    for (let i = 0; i < codecCount && i < 8; i++) {
      const codecIndex = view.getUint8(1 + i)
      if (codecIndex < codecMap.length) {
        codecs.push(codecMap[codecIndex])
      }
    }
    
    return codecs
  }

  private decodeNegotiatedCodec(data: string): AudioCodec {
    const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
    const view = new DataView(buffer)
    
    const codecMap = [AudioCodec.PCM, AudioCodec.AAC, AudioCodec.MP3, AudioCodec.OPUS]
    const codecIndex = view.getUint8(0)
    
    return codecMap[codecIndex] || AudioCodec.PCM
  }

  private decodeTalkbackStatus(data: string): any {
    const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
    const view = new DataView(buffer)
    
    // Decode talkback ID
    const talkbackIdBytes = new Uint8Array(buffer, 0, 32)
    const talkbackIdEnd = talkbackIdBytes.indexOf(0)
    const talkbackId = new TextDecoder().decode(talkbackIdBytes.subarray(0, talkbackIdEnd === -1 ? 32 : talkbackIdEnd))
    
    return {
      talkbackId,
      isActive: view.getUint8(32) === 1,
      level: view.getUint8(33),
      bytesReceived: view.getUint32(34, true)
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