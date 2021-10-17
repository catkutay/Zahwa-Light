import { Subject, Observable } from 'rxjs'

export interface RecordStats {
  frames: number
  ms: number
}

enum RecorderState {
  STOPPED = 0,
  STARTING = 1,
  RECORDING = 2,
  STOPPING = 3
}

//
// Simple microphone stores only one final buffer, does no resampling, playing or Wav export as these
// ... functions have moved to the AudioDataModelClass
// Removed worker since merely appending data to an array is almost no work anyway
//
export class SimpleMicrophone {
  audioContext: AudioContext
  sourceNode: MediaStreamAudioSourceNode
  stream: MediaStream
  connected: boolean = false
  progressSubject: Subject<{elapsed: number, db: number}> = new Subject()
  node: ScriptProcessorNode
  config: {bufferLen: number, numChannels: number} = {bufferLen: 4096, numChannels: 1}
  recordingState: RecorderState = RecorderState.STOPPED
  stopTick: number = 0
  startRecording: Date = null
  recordedData: Float32Array[] = []
  debugMode: boolean
  pinterval: number = null
  volume: number = -50
  constructor(config?: {audioContext?: AudioContext, debug?: boolean, bufferLen?: number}) {
    this.audioContext = config && config.audioContext ? config.audioContext : new AudioContext()
    this.debugMode = config && config.debug ? config.debug : false
    if (config && config.bufferLen ) {
      this.config.bufferLen = config.bufferLen
    }
    this._init()
  }
  _init() {
    this.debug('init()')
  }
  debug(...args) {
    if (this.debugMode) {
      console.log('simpleMicrophone:', ...args)
    }
  }
  async connect(): Promise<any> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('No mediaDevices.getUserMedia in browser!')
    }
    let ms: MediaStream = await navigator.mediaDevices.getUserMedia({audio: true, video: false})
    this.sourceNode = this.audioContext.createMediaStreamSource(ms)
    this.stream = ms
    // make it on connect
    this.node = this.audioContext.createScriptProcessor(this.config.bufferLen, this.config.numChannels, this.config.numChannels)
    this.node.onaudioprocess = (e) => {
      const cdat = e.inputBuffer.getChannelData(0)
      // calculate volume regardless if we are recording...
      this._setVolumeFromBuffer(cdat)
      // ... but if we aren't, just return.
      if (this.recordingState === RecorderState.STOPPED) {
        return
      } 
      // all other cases will record data - special cases do fades and delay
      if (this.recordingState === RecorderState.STARTING) {
        // fade up
        for (let i = 0; i < 2000; ++i) {
          cdat[i] = (i / 2000) * cdat[i]
        }
        this.debug('recording - set recording state')
        this.recordingState = RecorderState.RECORDING // switch to recording
      } else if (this.recordingState === RecorderState.STOPPING) {
        if (this.stopTick === 1) {
          this.debug('set recording stopped state')
          this.recordingState = RecorderState.STOPPED
          // fade out
          for (let i = 0; i < 2000; ++i) {
            cdat[-i] = (i / 2000) * cdat[-i]
          }
        } else {
          ++this.stopTick
        }
      }
      this.recordedData.push(cdat.slice(0))
    }
    this.sourceNode.connect(this.node)
    this.node.connect(this.audioContext.destination)
    this.connected = true
    this._progressTick()
  }

  _setVolumeFromBuffer(buf: Float32Array): void {
    let sum = 0
    let x
    // Do a root-mean-square on the samples: sum up the squares...
    for (let i=0; i<buf.length; i++) {
      x = buf[i]
      sum += x * x
    }
    // ... then take the square root of the sum.
    let rms =  Math.sqrt(sum / buf.length)
    let vol = Math.max(rms, this.volume*0.95)
    this.volume = 10*Math.log(vol)
  }

  record(): void {
    if (!this.sourceNode) {
      throw new Error('No source node, did you call .connect() first?')
    }
    if (!this.canRecord()) {
      throw new Error('Cannot start recording, check canRecord() first.')
    }
    this.debug('recording - set start state')
    this.startRecording = new Date()
    this.recordingState = RecorderState.STARTING // starting
    //this._progressTick()
  }
  destroy(): void {
    if (this.stream) {
      for (let track of this.stream.getAudioTracks()) {
        track.stop()
      }
    }
    this.connected = false
    this.progressSubject.complete()
  }
  // construct elapsed from the samples we have in final buffers plus
  // a temporary timer. 
  getElapsed(): number {
    // let tmp = this.startRecording ? 
    //   (new Date().valueOf() - this.startRecording.valueOf() ) :
    //   0
    // return tmp
    const len = this.getLength()
    return len.ms

  }
  isRecording(): boolean {
    return this.recordingState !== RecorderState.STOPPED
  }
  hasRecordedData(): boolean {
    return this.recordedData.length !== 0
  }
  observeProgress(): Observable<{elapsed: number, db: number}> {
    return this.progressSubject.asObservable()
  }
  async pause() { 
    if (this.isRecording()) {
      this.debug('recording set stopping state')
      this.recordingState = 2 // set stoppping
      this.debug('pausing')
      while (this.isRecording()) {
        await this._waitMilliseconds(100)
      }
    }
  }
  canRecord(): boolean {
    return this.connected && this.recordingState == RecorderState.STOPPED
  }

  resume(): boolean {
    if (!this.isRecording()) {
      this.recordingState = RecorderState.STARTING // set starting
      return true
    } else {
      return false
    }
  }

  async stop(): Promise<RecordStats> {
    // pausing will cause one extra buffer to be dumped
    this.debug('recording set stopping state')
    this.recordingState = RecorderState.STOPPING
    while (this.isRecording()) {
      await this._waitMilliseconds(100)
    }
    //this.sourceNode.disconnect(this.node)
    //this.node.disconnect(this.audioContext.destination)
    return this.getLength()
  }

  getLength(): { frames: number, ms: number } {
    let frames = 0
    for (let b of this.recordedData) {
      frames += b.length
    }
    return {
      ms: Math.floor((frames / this.audioContext.sampleRate) * 1000),
      frames: frames
    }
  }

  _waitMilliseconds(ms: number) {
    return new Promise((resolve) => {
      setTimeout(() =>  {
        resolve()
      }, ms)
    })
  }

  getBuffer() {
    return this._getMergedBuffers(this.recordedData)
  }

  clear() {
    this.recordingState = RecorderState.STOPPED
    this.recordedData = []
    console.log('simple microphone cleared', this.recordedData)
  }

  // remove the progress subject from the onaudioprocess event
  _progressTick() {
    if (this.pinterval) {
      return
    }
    this.pinterval = setInterval(() => {
      this.progressSubject.next({elapsed: this.getElapsed(), db: this.volume})
    }, 100) as any as number
  }

  _getMergedBuffers(recBuffers: Float32Array[]): Float32Array {
    let recLength = 0
    for (let b of recBuffers) {
      recLength += b.length
    }
    let result = new Float32Array(recLength)
    let offset = 0
    for (let i = 0; i < recBuffers.length; i++) {
      result.set(recBuffers[i], offset)
      offset += recBuffers[i].length
    }
    return result
  }
}


