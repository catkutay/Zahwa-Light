import { Component, OnInit, Input, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { ISession, IGVSegment } from 'src/app/interface';
import { ModalController, PopoverController } from '@ionic/angular';
import { faSquare, faPlay, faPause, IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { SwiperComponent } from 'src/app/components/swiper/swiper.component';
import { SimpleMicrophone, RecordStats } from '../../services/simplemicrophone'
import { AudioDataModel } from '../../services/audiodatamodel'
import { DataService } from 'src/app/services/data.service';
import { AudioService } from 'src/app/services/audio.service';
import { Subscription } from 'rxjs';
import { ConfirmComponent } from '../confirm/confirm.component';
import { ToolsService } from 'src/app/services/tools.service';
import { SessionsService } from 'src/app/services/sessions.service';

enum IGVState {
    LOADING = 1,
    READY,
    RECORDING,
    RECBUSY,
    REVIEWING
}

@Component({
    templateUrl: './igv.component.html',
    styleUrls: ['./igv.component.scss']
})
export class IgvComponent implements OnInit, AfterViewInit, OnDestroy {
    @Input() session: ISession
    @ViewChild(SwiperComponent) swiper: SwiperComponent
    faSquare: IconDefinition = faSquare
    faPause: IconDefinition = faPause
    // faMicrophone: IconDefinition = faMicrophone
    faPlay: IconDefinition = faPlay
    elapsed: number = 0
    currentIndex: number = 0
    recordedMark: number = -1 // for colouring the progress bullets
    startupPromises: Promise<any>[] = []
    state: IGVState = IGVState.LOADING
    flags: {
        isRecording: boolean,
        isReviewing: boolean,
        canSlide: boolean,
        canReverse: boolean,
        canPressRecord: boolean,
        canReview: boolean,
        canFinish: boolean
    }
    audioContext: AudioContext
    audioDataModel: AudioDataModel
    microphone: SimpleMicrophone
    timeLine: IGVSegment[] = []
    playSub: Subscription
    startLength: number = 0 // to compare against to see if anything has changed
    constructor(
        private modalCtrl: ModalController,
        private data: DataService,
        private audio: AudioService,
        private popCtrl: PopoverController,
        private tools: ToolsService,
        private seshservice: SessionsService
    ) { }
    // Life cycle
    ngOnInit(): void {
        console.log(this.session)
        this.changeState(IGVState.LOADING)
        if (this.session.igvTimeline) {
            this.recordedMark = this.session.igvTimeline.length - 1
            this.timeLine = this.session.igvTimeline
        }
        this.startupPromises.push(this.initialise()) // this might take a while
    }
    async ngAfterViewInit() {
        this.startupPromises.push(this.swiper.waitForStart()) // and so might this
        await Promise.all(this.startupPromises)
        console.log('everything ready')
        this.changeState(IGVState.READY) // so only now do we become ready
    }
    ngOnDestroy() {
        if (this.playSub) {
            this.playSub.unsubscribe()
        }
    }

    async initialise() {
        this.audioContext = this.audio.getAudioContext()
        this.audioDataModel = new AudioDataModel({ audioContext: this.audioContext, sampleRate: 16000, channels: 1 })
        this.playSub = this.audioDataModel.getPlayProgress().subscribe((ms) => {
            if (this.state === IGVState.REVIEWING && ms === -1) {
                this.changeState(IGVState.READY)
            } else (this.checkSlidePlayback(ms))
        })
        if (this.session.primary) {
            const audioFile = await this.data.getAudioFile(this.session.primary)
            await this.audioDataModel.loadFile(audioFile)
        }
        this.startLength = this.audioDataModel.getLength().frames
        this.microphone = new SimpleMicrophone({ audioContext: this.audioContext })
        await this.microphone.connect()
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
    async clickRecord() {
        if (!this.flags.canPressRecord) return;
        if (this.state === IGVState.RECORDING) {
            console.log('stopping')
            this.changeState(IGVState.RECBUSY)
            const recstats = await this.microphone.stop()
            console.log('stopped')
            await this.audioDataModel.addResample(this.microphone.getBuffer())
            this.microphone.clear()
            this.getLastSegment().endMs = this.audioDataModel.getLength().ms + recstats.ms
            this.changeState(IGVState.READY)
        } else {
            console.log('recording')
            this.changeState(IGVState.RECORDING)
            this.microphone.record()
            this.startResumeSegment()
        }
    }
    async clickPlay() {
        if (!this.flags.canReview) return;
        if (this.state === IGVState.REVIEWING) {
            //this.changeState(IGVState.READY)
            this.audioDataModel.stopPlay()
        } else {
            this.changeState(IGVState.REVIEWING)
            this.currentIndex = 0
            this.swiper.seekTo(this.currentIndex)
            this.audioDataModel.playFromMs(0)
            console.log(this.timeLine)
        }
    }

    // Incoming slice change events
    swiperMove(slide: number) {
        console.log('slide', slide)
        this.currentIndex = slide
        if (this.state === IGVState.RECORDING) {
            this.transitionSlide()
            if (slide > this.recordedMark) {
                this.recordedMark = slide
            }
        } else if (this.state === IGVState.REVIEWING) {
            if (this.currentIndex < this.timeLine.length - 1) {
                this.audioDataModel.playFromMs(this.timeLine[this.currentIndex].startMs)
            } else {
                this.changeState(IGVState.READY)
            }

        }
    }
    // State machine
    changeState(s: IGVState) {
        if (s === IGVState.LOADING) {
            this.flags = {
                isRecording: false,
                isReviewing: false,
                canSlide: false,
                canReverse: false,
                canPressRecord: false,
                canReview: false,
                canFinish: false
            }
        } else if (s === IGVState.READY) {
            this.flags = {
                isRecording: false,
                isReviewing: false,
                canSlide: true,
                canReverse: true,
                canPressRecord: true,
                canReview: this.audioDataModel.hasData(),
                canFinish: this.hasChanged()
            }
        } else if (s === IGVState.RECORDING) {
            this.flags = {
                isRecording: true,
                isReviewing: false,
                canSlide: true,
                canReverse: false,
                canPressRecord: true,
                canReview: false,
                canFinish: false
            }
            if (this.currentIndex !== this.recordedMark) {
                if (this.recordedMark === -1) {
                    this.currentIndex = 0
                    this.recordedMark = 0
                } else {
                    this.currentIndex = this.recordedMark
                }
                this.swiper.seekTo(this.currentIndex)
            }
        } else if (s === IGVState.RECBUSY) {
            this.flags = {
                isRecording: true,
                isReviewing: false,
                canSlide: false,
                canReverse: false,
                canPressRecord: false,
                canReview: false,
                canFinish: false
            }
        } else if (s === IGVState.REVIEWING) {
            this.flags = {
                isRecording: false,
                isReviewing: true,
                canSlide: true,
                canReverse: true,
                canPressRecord: false,
                canReview: true,
                canFinish: this.hasChanged()
            }
        }
        this.state = s
    }

    hasChanged() {
        // console.log(this.startLength, this.audioDataModel.getLength().frames)
        return this.startLength !== this.audioDataModel.getLength().frames
    }

    // export interface IGVSegment {
    //     prompt: {id: string, type: string}[]
    //     startMs: number,
    //     endMs?: number
    //     gestures?: Gesture[]
    // }

    getLastSegment(): IGVSegment {
        return this.timeLine[this.timeLine.length - 1]
    }
    startResumeSegment() {
        if (this.timeLine.length === 0) {
            this.timeLine.push({
                startMs: 0,
                promptId: this.session.imageIds[0]
            })
        }
    }

    transitionSlide() {
        const thisTime = this.audioDataModel.getLength().ms + this.microphone.getElapsed()
        this.getLastSegment().endMs = thisTime - 1
        this.timeLine.push({
            startMs: thisTime,
            promptId: this.session.imageIds[this.currentIndex]
        })
    }

    checkSlidePlayback(ms: number) {
        const slide = this.timeLine.findIndex(x => (ms >= x.startMs && ms <= x.endMs))
        if (slide !== -1 && slide !== this.currentIndex) {
            this.currentIndex = slide
            this.swiper.seekTo(this.currentIndex, 'smooth')
        }
    }

    async finish() {
        if (this.timeLine.length === this.session.imageIds.length) {
            ++this.session.stage
        }
        const audiodeets = {
            blob: this.audioDataModel.exportWav(),
            language: '',
            frames: this.audioDataModel.getLength().frames,
            channels: this.audioDataModel.config.channels,
            sampleRate: this.audioDataModel.config.sampleRate
        }
        this.seshservice.updateSessionPrimaryAudio(
            this.session.id,
            {
                stage: this.session.stage,
                igvTimeline: this.timeLine
            },
            audiodeets
        )
        this.modalCtrl.dismiss()
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

}
