import type { AudioConfiguration, BluetoothOperationResult } from '@/types';

export class AudioService {
  private static instance: AudioService;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private isRecording = false;
  private audioChunks: Blob[] = [];
  private currentConfiguration: AudioConfiguration = {
    source: 'microphone',
    sink: 'speakers',
    quality: 'medium',
    routing: 'stereo'
  };

  private constructor() {}

  static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  async initializeAudio(): Promise<BluetoothOperationResult<void>> {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Audio initialization failed'
      };
    }
  }

  async configureAudio(config: Partial<AudioConfiguration>): Promise<BluetoothOperationResult<void>> {
    try {
      this.currentConfiguration = { ...this.currentConfiguration, ...config };
      
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop());
        this.audioStream = null;
      }

      const constraints = this.getMediaConstraints(this.currentConfiguration);
      this.audioStream = await navigator.mediaDevices.getUserMedia(constraints);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Audio configuration failed'
      };
    }
  }

  async startRecording(): Promise<BluetoothOperationResult<void>> {
    try {
      if (this.isRecording) {
        return { success: false, error: 'Already recording' };
      }

      if (!this.audioStream) {
        const configResult = await this.configureAudio({});
        if (!configResult.success) {
          return configResult;
        }
      }

      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(this.audioStream!, {
        mimeType: this.getMimeType()
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(1000); // Capture in 1-second chunks
      this.isRecording = true;

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start recording'
      };
    }
  }

  async stopRecording(): Promise<BluetoothOperationResult<Blob>> {
    return new Promise((resolve) => {
      if (!this.isRecording || !this.mediaRecorder) {
        resolve({ success: false, error: 'Not currently recording' });
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { 
          type: this.getMimeType() 
        });
        this.isRecording = false;
        this.audioChunks = [];
        resolve({ success: true, data: audioBlob });
      };

      this.mediaRecorder.stop();
    });
  }

  async streamAudioToCharacteristic(
    characteristic: BluetoothRemoteGATTCharacteristic,
    duration: number = 10000
  ): Promise<BluetoothOperationResult<void>> {
    try {
      if (!characteristic.properties.write && !characteristic.properties.writeWithoutResponse) {
        return { success: false, error: 'Characteristic does not support writing' };
      }

      await this.initializeAudio();
      const configResult = await this.configureAudio({});
      if (!configResult.success) {
        return configResult;
      }

      const processor = this.audioContext!.createScriptProcessor(1024, 1, 1);
      const source = this.audioContext!.createMediaStreamSource(this.audioStream!);
      
      let streamActive = true;
      setTimeout(() => { streamActive = false; }, duration);

      processor.onaudioprocess = async (event) => {
        if (!streamActive) {
          processor.disconnect();
          source.disconnect();
          return;
        }

        const inputData = event.inputBuffer.getChannelData(0);
        const audioData = new Float32Array(inputData.length);
        audioData.set(inputData);

        const audioBuffer = new ArrayBuffer(audioData.length * 4);
        const view = new DataView(audioBuffer);
        
        for (let i = 0; i < audioData.length; i++) {
          view.setFloat32(i * 4, audioData[i] ?? 0, true);
        }

        try {
          if (characteristic.properties.writeWithoutResponse) {
            await characteristic.writeValueWithoutResponse(audioBuffer);
          } else {
            await characteristic.writeValueWithResponse(audioBuffer);
          }
        } catch (error) {
          console.warn('Audio streaming error:', error);
        }
      };

      source.connect(processor);
      processor.connect(this.audioContext!.destination);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Audio streaming failed'
      };
    }
  }

  async receiveAudioFromCharacteristic(
    characteristic: BluetoothRemoteGATTCharacteristic
  ): Promise<BluetoothOperationResult<void>> {
    try {
      if (!characteristic.properties.notify && !characteristic.properties.indicate) {
        return { success: false, error: 'Characteristic does not support notifications' };
      }

      await this.initializeAudio();
      
      const audioBuffer = this.audioContext!.createBuffer(1, 44100, 44100);
      let bufferIndex = 0;

      const handleAudioData = (event: Event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        if (target.value) {
          const view = new DataView(target.value.buffer);
          const samples = new Float32Array(view.byteLength / 4);
          
          for (let i = 0; i < samples.length; i++) {
            samples[i] = view.getFloat32(i * 4, true);
          }

          const channelData = audioBuffer.getChannelData(0);
          for (let i = 0; i < samples.length && bufferIndex < channelData.length; i++) {
            channelData[bufferIndex++] = samples[i] ?? 0;
          }
        }
      };

      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', handleAudioData);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Audio reception failed'
      };
    }
  }

  getCurrentConfiguration(): AudioConfiguration {
    return { ...this.currentConfiguration };
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  async getAvailableAudioDevices(): Promise<{
    inputs: MediaDeviceInfo[];
    outputs: MediaDeviceInfo[];
  }> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      return {
        inputs: devices.filter(device => device.kind === 'audioinput'),
        outputs: devices.filter(device => device.kind === 'audiooutput')
      };
    } catch (error) {
      console.error('Failed to enumerate audio devices:', error);
      return { inputs: [], outputs: [] };
    }
  }

  private getMediaConstraints(config: AudioConfiguration): MediaStreamConstraints {
    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    };

    switch (config.quality) {
      case 'high':
        (audioConstraints as any).sampleRate = 44100;
        (audioConstraints as any).channelCount = config.routing === 'stereo' ? 2 : 1;
        break;
      case 'medium':
        (audioConstraints as any).sampleRate = 22050;
        (audioConstraints as any).channelCount = config.routing === 'stereo' ? 2 : 1;
        break;
      case 'low':
        (audioConstraints as any).sampleRate = 16000;
        (audioConstraints as any).channelCount = 1;
        break;
    }

    return { audio: audioConstraints };
  }

  private getMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/wav'
    ];

    return types.find(type => MediaRecorder.isTypeSupported(type)) || 'audio/webm';
  }

  async cleanup(): Promise<void> {
    if (this.isRecording && this.mediaRecorder) {
      this.mediaRecorder.stop();
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.isRecording = false;
    this.audioChunks = [];
  }
}