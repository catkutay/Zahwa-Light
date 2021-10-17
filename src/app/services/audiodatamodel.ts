import { IAudioFile } from 'src/app/interface'
import { Subject } from 'rxjs'

export interface IAudioDataModelConfig {
    audioContext: AudioContext,
    sampleRate: number,
    channels: number
}

export class AudioDataModel {
    config: IAudioDataModelConfig = {
        audioContext: new AudioContext(),
        sampleRate: 16000,
        channels: 1
    }
    buffer: Float32Array = null
    playing: boolean = false
    playsource: AudioBufferSourceNode
    playstarttime: Date
    playstartfromms: number
    replaying: boolean = false
    progressSubject: Subject<number> = new Subject()
    constructor(config?: IAudioDataModelConfig) {
        if (config) {
            Object.assign(this.config, config)
        }
    }
    // In order to use frame accurate samplerate-specific archival audio from a file, we must keep
    // the total frames (and the sample rate) since we can't find this out from a raw file.
    loadFile(iAudioFile: IAudioFile) {
        // adopt the sample rate off the audio file we are loading
        this.config.sampleRate = iAudioFile.sampleRate
        return new Promise((resolve) => {
            const fileReader = new FileReader()
            fileReader.onloadend = () => {
                const oac = new OfflineAudioContext(1, 1, this.config.sampleRate)
                oac.decodeAudioData(fileReader.result as ArrayBuffer)
                    .then((audioBuffer) => {
                        const f32a = new Float32Array(iAudioFile.frames)
                        audioBuffer.copyFromChannel(f32a, 0)
                        this.buffer = f32a
                        resolve()
                    })
            }
            fileReader.readAsArrayBuffer(iAudioFile.file)
        })
    }
    // resample the provided buffer and append to list of buffers, return stats on last segment added
    async addResample(buffer: Float32Array): Promise<{ offset: number, frames: number }> {
        const resampledBuffer = await this._resampleBuffer(buffer)
        const preAppendLength = this.buffer ? this.buffer.length : 0
        if (this.buffer) {
            this.buffer = this._mergeBuffers([this.buffer, resampledBuffer])
        } else {
            this.buffer = resampledBuffer
        }
        return {
            offset: preAppendLength,
            frames: resampledBuffer.length
        }
    }

    // add a a float buffer without resampling (for the new webm recorder)
    //   addAudioBuffer(buffer: Float32Array): {offset: number, frames: number}  {
    //     const preAppendLength = this.buffer ? this.buffer.length : 0
    //     if (this.buffer) {
    //       this.buffer = this._mergeBuffers([this.buffer, buffer])
    //     } else {
    //       this.buffer = buffer
    //     }
    //     return {
    //       offset: preAppendLength,
    //       frames: buffer.length
    //     }
    //   }

    getLength(): { frames: number, ms: number } {
        return {
            frames: (this.buffer !== null) ? this.buffer.length : 0,
            ms: (this.buffer !== null) ? ~~(this.buffer.length / this.config.sampleRate * 1000) : 0
        }
    }

    // Assumes inputBuffer sample rate is the same as the current audioContext, i.e. came from a microphone
    private _resampleBuffer(inputBuffer: Float32Array): Promise<Float32Array> {
        const numFrames = ~~((inputBuffer.length / this.config.audioContext.sampleRate) * this.config.sampleRate)
        const offCont = new OfflineAudioContext(1, numFrames, this.config.sampleRate)
        const newBuffer = offCont.createBuffer(1, inputBuffer.length, this.config.audioContext.sampleRate)
        newBuffer.copyToChannel(inputBuffer, 0)
        const source = offCont.createBufferSource()
        source.buffer = newBuffer
        source.connect(offCont.destination)
        source.start()
        return offCont.startRendering().then((ab: AudioBuffer) => {
            const fa = new Float32Array(ab.getChannelData(0))
            return fa
        })
    }

    // delete a section of the buffer from frame
    deleteFrom(frame: number) {
        if (frame === 0) {
            this.buffer = null
        } else {
            this.buffer = this.buffer.slice(0, frame)
        }
    }

    exportWav(): Blob {
        const floatTo16BitPCM = (output: DataView, offset: number, input: Float32Array) => {
            for (let i = 0; i < input.length; i++, offset += 2) {
                let s = Math.max(-1, Math.min(1, input[i]))
                output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
            }
        }
        const writeString = (view: DataView, offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i))
            }
        }
        const encodeWAV = (numChannels: number, sampleRate: number): DataView => {
            // let rTotalLen: number = 0
            // for (let r of this.buffers) {
            //   rTotalLen += r.frames
            // }
            const rTotalLen = this.buffer.length
            const buffer = new ArrayBuffer(44 + rTotalLen * 2)
            const view = new DataView(buffer)
            /* RIFF identifier */
            writeString(view, 0, 'RIFF')
            /* RIFF chunk length */
            view.setUint32(4, 36 + rTotalLen * 2, true)
            /* RIFF type */
            writeString(view, 8, 'WAVE')
            /* format chunk identifier */
            writeString(view, 12, 'fmt ')
            /* format chunk length */
            view.setUint32(16, 16, true)
            /* sample format (raw) */
            view.setUint16(20, 1, true)
            /* channel count */
            view.setUint16(22, numChannels, true)
            /* sample rate */
            view.setUint32(24, sampleRate, true)
            /* byte rate (sample rate * block align) */
            view.setUint32(28, sampleRate * 4, true)
            /* block align (channel count * bytes per sample) */
            view.setUint16(32, numChannels * 2, true)
            /* bits per sample */
            view.setUint16(34, 16, true)
            /* data chunk identifier */
            writeString(view, 36, 'data')
            /* data chunk length */
            view.setUint32(40, rTotalLen * 2, true)
            // let offset: number = 0
            // for (let r of this.buffers) {
            //   floatTo16BitPCM(view, 44 + (offset * 2), r.buffer)
            //   offset += r.frames
            // }
            floatTo16BitPCM(view, 44, this.buffer)
            return view
        }

        const blob = new Blob([encodeWAV(1, this.config.sampleRate)], {
            type: 'audio/wav'
        })
        return blob
    }

    clear() {
        this.buffer = null
    }

    private _mergeBuffers(buffers: Float32Array[]): Float32Array {
        let tlen: number = 0
        for (let b of buffers) {
            tlen += b.length
        }
        const merged = new Float32Array(tlen)
        let offset = 0
        for (let i = 0; i < buffers.length; i++) {
            merged.set(buffers[i], offset)
            offset += buffers[i].length
        }
        return merged
    }
    playFromMs(fromMs: number = 0) {
        this.playstartfromms = fromMs
        const fromframe = Math.round(fromMs / 1000 * 16000)
        this.playFromFrame(fromframe)
    }

    playFromFrame(fromframe: number = 0) {
        if (this.buffer === null) {
            throw new Error('No audio data in buffer')
        } else if (fromframe >= this.buffer.length) {
            throw new Error('listen From frame is larger than buffer')
        }
        if (this.playing) {
            this.playsource.stop()
            this.replaying = true
        } else {
            this.replaying = false
        }
        const length = this.buffer.length - fromframe
        const ab = this.config.audioContext.createBuffer(1, length, this.config.sampleRate)
        const partOfBuffer = this.buffer.slice(fromframe)
        ab.getChannelData(0).set(partOfBuffer)
        const source = this.config.audioContext.createBufferSource()
        source.buffer = ab
        source.connect(this.config.audioContext.destination)
        source.start()
        this.playing = true
        this.playsource = source
        this.playstarttime = new Date()
        source.onended = () => {
            if (!this.replaying) {
                this.progressSubject.next(-1)
                this.playing = false
            } else {
                this.replaying = false
            }
        }
        this.progressLoop()
    }

    stopPlay() {
        if (this.playing) {
            this.replaying = false
            this.playsource.stop()
            this.playing = false
        }
    }

    progressLoop() {
        if (this.playing) {
            const e = (new Date()).valueOf() - this.playstarttime.valueOf()
            this.progressSubject.next(this.playstartfromms + e)
            if (this.playing) {
                setTimeout(() => {
                    this.progressLoop()
                }, 100)
            }
        }
    }

    getPlayProgress() {
        return this.progressSubject.asObservable()
    }

    hasData(): boolean {
        return this.buffer !== null
    }

    destroy() {
        this.stopPlay()
        this.progressSubject.complete()
      }

}