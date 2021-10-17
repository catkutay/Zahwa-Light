import { Component, OnInit, Input, ViewChild, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { ModalController, PopoverController } from '@ionic/angular';
import { ConfirmComponent } from '../confirm/confirm.component';
import { ToolsService } from 'src/app/services/tools.service';
import { ISession, IGVSegment, IImageLabel } from 'src/app/interface';
import { DataService } from 'src/app/services/data.service';
import { SimpleMicrophone } from 'src/app/services/simplemicrophone';
import { AudioDataModel } from 'src/app/services/audiodatamodel';
import { AudioService } from 'src/app/services/audio.service';
import { SwiperComponent } from 'src/app/components/swiper/swiper.component';
import { CanvasMultiTouch } from './canvasmulti';
import { faSquare, faPlay, faCheck, faPause, faMicrophone, IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { WebAudioPlayer } from 'src/app/services/webaudio-player';

export enum DymatState {
    LOADING = 1,
    READY,
    SELECTED,
    RECORDING,
    RECBUSY,
    REVIEWING,
    CONFIRMING
}

enum CMTState {
    READY,
    TOUCHING,
    SELECTED
}

interface UIFlags {
    isRecording?: boolean,
    isReviewing?: boolean,
    isPlaying?: boolean,
    canSlide?: boolean,
    canAccept?: boolean
    canReverse?: boolean,
    canPressRecord?: boolean,
    canPlay?: boolean,
    canFinish?: boolean
}

@Component({
    templateUrl: './describe.component.html',
    styleUrls: ['./describe.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DescribeComponent implements OnInit, OnDestroy {
    @Input() session: ISession
    flags: UIFlags
    faSquare: IconDefinition = faSquare
    faPause: IconDefinition = faPause
    faPlay: IconDefinition = faPlay
    faCheck: IconDefinition = faCheck
    faMicrophone: IconDefinition = faMicrophone
    audioContext: AudioContext
    audioDataModel: AudioDataModel
    microphone: SimpleMicrophone
    timeLine: IGVSegment[] = []
    currentIndex: number = 0
    labelMark: number = -1
    imageLabels: {[key: string]: IImageLabel[]} = {}
    googleLabels: Map<string, any[]>
    cmt: CanvasMultiTouch
    state: DymatState
    recordedSegment: {offset: number, frames: number} = null
    @ViewChild(SwiperComponent) swiper: SwiperComponent
    @ViewChild('floater') floatingIcon: ElementRef
    player: WebAudioPlayer
    constructor(
        private modalCtrl: ModalController,
        private popCtrl: PopoverController,
        private tools: ToolsService,
        private data: DataService,
        private audio: AudioService,
        private change: ChangeDetectorRef) { }

    async ngOnInit() {
        console.log('describe session', this.session)
        this.changeState(DymatState.LOADING)
        if (this.session.igvTimeline) {
            // this.recordedMark = this.session.igvTimeline.length - 1
            this.timeLine = this.session.igvTimeline
        }
        if (this.session.imageLabels) {
            // make a copy
            this.imageLabels = Object.assign({}, this.session.imageLabels)
            // set high mark for existing labels
            for (let i = 0; i < this.session.imageIds.length; ++i) {
                if (this.imageLabels.hasOwnProperty(this.session.imageIds[i])) {
                    this.labelMark = i
                } else {
                    break
                }
            }
        }
        // this.googleLabels = await this.data.getGoogleLabels(this.session.imageIds)
        // console.log(this.googleLabels)
        await this.initialiseAudio()
        // this.renderGoogle(0)
        await this.swiper.waitForStart()
        this.cmt = new CanvasMultiTouch(this.swiper, this.session.imageIds)
        this.changeState(DymatState.READY)
        this.cmt.activate(0)
        this.cmt.observe().subscribe((s: CMTState) => {
            if (s === CMTState.SELECTED) {
                this.changeState(DymatState.SELECTED)
            } else if (s === CMTState.TOUCHING) {
                if (this.state === DymatState.SELECTED || this.state === DymatState.REVIEWING) { // started pinching again
                    this.changeState(DymatState.READY)
                }
            }
        })
    }

    ngOnDestroy() {
        this.audioDataModel.destroy()
        this.player.destroy()
    }


    async initialiseAudio() {
        this.audioContext = this.audio.getAudioContext()
        this.audioDataModel = new AudioDataModel({ audioContext: this.audioContext, sampleRate: 16000, channels: 1 })
        this.player = new WebAudioPlayer({audioContext: this.audioContext})
        if (this.session.primary) {
            const audioFile = await this.data.getAudioFile(this.session.primary)
            await this.player.loadFromBlob(audioFile.file)
        }
        this.audioDataModel.getPlayProgress().subscribe((ms) => {
            if (this.state === DymatState.REVIEWING && ms === -1) {
                this.changeState(DymatState.CONFIRMING)
            }
        })
        this.player.observeProgress().subscribe((ms) => {
            console.log('progress', ms)
            if (ms === -1) {
                this.changeFlags({isPlaying: false})
            }
        })
        this.microphone = new SimpleMicrophone({ audioContext: this.audioContext })
        await this.microphone.connect()
    }

    getCurrentImageId(): string {
        return this.session.imageIds[this.currentIndex]
    }

    // Buttons
    async close(evt) {
        if (this.hasChanged()) {
            const res = await this.confirm('Quit and discard changes?', ['Yep', 'Nah'], evt)
            if (!res || res === 'Nah') {
                return
            }
        }
        this.modalCtrl.dismiss()
    }

    hasChanged() {
        return false
    }

    async confirm(message: string, options: string[], evt = null): Promise<string> {
        const popover = await this.popCtrl.create({
            component: ConfirmComponent,
            componentProps: {
                text: message,
                options
            }
        })
        return await this.tools.showPopover(popover)
    }

    // Incoming slice change events
    swiperMove(slide: number) {
        console.log('slide', slide)
        this.currentIndex = slide
        // this.renderGoogle(slide)
        this.cmt.activate(slide)
    }


    // State machine
    changeState(s: DymatState) {
        if (s === DymatState.LOADING) {
            this.flags = {
                isRecording: false,
                isReviewing: false,
                isPlaying: false,
                canPlay: false,
                canSlide: false,
                canAccept: false,
                canReverse: false,
                canPressRecord: false,
                canFinish: false
            }
        } else if (s === DymatState.READY) {
            this.flags = {
                isRecording: false,
                isReviewing: false,
                isPlaying: false,
                canPlay: true,
                canSlide: true,
                canReverse: false,
                canPressRecord: false,
                canAccept: false,
                canFinish: this.hasChanged()
            }
            this.cmt.enable()
        } else if (s === DymatState.SELECTED) {
            this.flags = {
                isRecording: false,
                isReviewing: false,
                isPlaying: false,
                canPlay: true,
                canSlide: true,
                canReverse: false,
                canAccept: false,
                canPressRecord: true,
                canFinish: this.hasChanged()
            }
            this.cmt.drawupdate('yellow')
            // const mid = this.cmt.getMidPointCS()
            this.cmt.enable()
        } else if (s === DymatState.RECORDING) {
            this.flags = {
                isRecording: true,
                isReviewing: false,
                isPlaying: false,
                canPlay: false,
                canSlide: false,
                canReverse: false,
                canAccept: false,
                canPressRecord: true,
                canFinish: this.hasChanged()
            }
            this.cmt.disable()
        } else if (s === DymatState.RECBUSY) {
            this.flags = {
                isRecording: true,
                isReviewing: false,
                isPlaying: false,
                canPlay: false,
                canSlide: false,
                canReverse: false,
                canAccept: false,
                canPressRecord: false,
                canFinish: this.hasChanged()
            }
            this.cmt.disable()
        } else if (s === DymatState.REVIEWING) {
            this.flags = {
                isRecording: false,
                isReviewing: true,
                isPlaying: false,
                canPlay: false,
                canSlide: true,
                canReverse: false,
                canAccept: true,
                canPressRecord: true,
                canFinish: this.hasChanged()
            }
            this.cmt.disable()
        } else if (s === DymatState.CONFIRMING) {
            this.flags = {
                isRecording: false,
                isReviewing: false,
                isPlaying: false,
                canPlay: true,
                canSlide: true,
                canReverse: false,
                canAccept: true,
                canPressRecord: true,
                canFinish: this.hasChanged()
            }
        }
        this.state = s
        this.change.markForCheck()
    }

    finish() {

    }
    // renderGoogle(slide: number) {
    //     const {canvas, width, height } = this.swiper.getCanvas(slide)
    //     const ctx = canvas.getContext('2d')
    //     ctx.strokeStyle = 'red'
    //     ctx.lineWidth = 4
    //     ctx.font = '40px Arial'
    //     ctx.fillStyle = 'red'
    //     const tx = (x) => {
    //         return width * x
    //     }
    //     const ty = (y) => {
    //         return height * y
    //     }
    //     const glab = this.googleLabels.get(this.session.imageIds[slide])
    //     for (const g of glab) {

    //             console.log('g', g)
    //             for (let i = 0; i < g.boundingPoly.normalizedVertices.length; ++i) {
    //                 const v = g.boundingPoly.normalizedVertices[i]
    //                 console.log('v', v)
    //                 if (i === 0) {
    //                     ctx.moveTo(tx(v.x), ty(v.y))
    //                 } else {
    //                     ctx.lineTo(tx(v.x), ty(v.y))
    //                 }
    //             }
    //             // go back to the first one
    //             const f = g.boundingPoly.normalizedVertices[0]
    //             ctx.lineTo(tx(f.x), ty(f.y))
    //             ctx.fillText(g.name, tx(f.x) + 40 , ty(f.y) + 40)
    //             ctx.stroke()
    //     }
    // }

    recdown(evt: TouchEvent) {
        evt.preventDefault()
        console.log('d down')
        if (!this.flags.canPressRecord || this.flags.isRecording) return;
        if (this.recordedSegment) {
            this.audioDataModel.deleteFrom(this.recordedSegment.offset)
            this.recordedSegment = null
        }
        this.changeState(DymatState.RECORDING)
        this.microphone.record()
        this.cmt.animate('red')
    }
    async recup(evt: TouchEvent) {
        evt.preventDefault()
        console.log('d up')
        if (this.state !== DymatState.RECORDING) return;
        console.log('stopping')
        this.changeState(DymatState.RECBUSY)
        this.cmt.stopanimate('red')
        await this.microphone.stop()
        console.log('stopped')
        this.recordedSegment = await this.audioDataModel.addResample(this.microphone.getBuffer())
        this.microphone.clear()
        this.changeState(DymatState.REVIEWING)
        console.log('reviewing')
        this.audioDataModel.playFromFrame(this.recordedSegment.offset)
        this.cmt.drawupdate('green')
    }

    recmove(evt: TouchEvent) {
        evt.preventDefault()
    }

    play() {
        if (!this.flags.canPlay) return;
        if (this.flags.isPlaying) {
            this.player.pause()
            this.changeFlags({isPlaying: false})
        } else {
            const thisSegment = this.session.igvTimeline[this.currentIndex]
            const startMs = thisSegment.startMs / 1000
            const endMs = thisSegment.endMs / 1000
            this.player.play(startMs, endMs)
            this.changeFlags({isPlaying: true})
        }
    }

    acceptLabelRecording() {
        const cb = this.cmt.savebox()
        const i = this.getCurrentImageId()
        if (!(i in this.imageLabels)) {
            this.imageLabels[i] = []
        }
        this.imageLabels[i].push({
            audio: {startFrame: this.recordedSegment.offset, endFrame: this.recordedSegment.offset + this.recordedSegment.frames - 1},
            box: cb
        })
        console.log('labels', this.imageLabels)
        this.changeState(DymatState.READY)
    }

    // do a full copy to invoke change detection
    changeFlags(newflags: UIFlags) {
        const f = Object.assign({}, this.flags)
        Object.assign(f, newflags)
        this.flags = f
        this.change.markForCheck()
    }

}
