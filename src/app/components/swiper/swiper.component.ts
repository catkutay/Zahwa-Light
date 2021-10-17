import { Component, OnInit, Input, ViewChildren, ElementRef, QueryList, OnDestroy, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { SessionsService } from 'src/app/services/sessions.service';
import { Deferred } from 'ts-deferred';
import { ILocalImage } from 'src/app/interface';
import { SafeStyle, DomSanitizer } from '@angular/platform-browser';
import { ToolsService } from 'src/app/services/tools.service';

@Component({
    selector: 'app-swiper',
    templateUrl: './swiper.component.html',
    styleUrls: ['./swiper.component.scss']
})
export class SwiperComponent implements OnInit, OnDestroy {
    @Input() images: string[]
    @Input() selected: number = 0  // one shot
    @Input() enabled: boolean = false
    @Input() reverse: boolean = false
    @Input() highwater: number = 0
    @Output() move: EventEmitter<number> = new EventEmitter();
    current: number = 0
    loading: boolean = true
    // imageList: {style: SafeStyle, width: number, height: number}[] = []
    imageList: ILocalImage[] = []
    thumbs: {prev: SafeStyle, cur: SafeStyle, next: SafeStyle} = {prev: '', cur: '', next: ''}
    @ViewChildren('frames') frameElements!: QueryList<ElementRef>;
    @ViewChildren('images') imageElements!: QueryList<ElementRef>;
    @ViewChildren('overlays') canvasElements: QueryList<ElementRef>;
    // @ViewChild('scroller') scrollerElement: ElementRef
    progress: number[] = []
    orientListener: (event) => void
    started: Deferred<any> = new Deferred<any>()
    cstyle: {width: string, height: string}[] = []
    constructor(
        private sesh: SessionsService,
        private detol: DomSanitizer,
        private tools: ToolsService,
        private change: ChangeDetectorRef) { }
    async ngOnInit() {
        for (const id of this.images) {
            // this.imageList.push(await this.sesh.getImageStyleFromId(id))
            this.imageList.push(await this.sesh.getLocalImageFromId(id))
            console.log(id)
        }
        this.setThumbs()
        this.progress = Array.from({length: this.imageList.length}, (x, i) => i)
        this.orientListener = () => {
            this.homeIndex(this.current)
        }
        window.addEventListener('resize', this.orientListener)
        this.change.markForCheck()
        setTimeout(() => {
            this.loading = false
            this.resizeCanvas()
            this.change.markForCheck()
            this.started.resolve()
        }, 100)
    }
    waitForStart(): Promise<any> {
        return this.started.promise
    }

    ngOnDestroy() {
        window.removeEventListener('resize', this.orientListener)
    }
    seekTo(index: number, behav: string = 'auto') {
        this.current = index
        this._moveTo(this.current, behav)
    }
    getCurrent(): number {
        return this.current
    }
    setThumbs() {
        this.thumbs = {
            prev: this.current > 0 ? this.imageList[this.current - 1].style : '',
            cur: this.imageList[this.current].style,
            next: (this.current < (this.imageList.length - 1)) ? this.imageList[this.current + 1].style : ''
        }
    }
    clickThumb(offset: number) {
        if (!this.enabled) return;
        if (!this.reverse && offset === -1) return;
        const desired = this.current + offset
        if (desired < 0 || desired >= this.imageList.length) {
            return
        }
        this.current = desired
        this.move.emit(desired)
        this._moveTo(desired, 'smooth')
    }
    _moveTo(index: number, behav: string = 'auto') {
        this.homeIndex(index, behav)
        this.setThumbs()
    }
    async homeIndex(index: number, behav: string = 'auto') {
        console.log('scrolling')
        await this.tools.smoothScroll(this.frameElements.toArray()[index].nativeElement)
        console.log('done')
        this.resizeCanvas()
    }

    // resizeCanvas() {
    //     const thisImage = this.imageElements.toArray()[this.current].nativeElement as HTMLImageElement
    //     const irect = thisImage.getBoundingClientRect() as DOMRect
    //     // const srect = this.scrollerElement.nativeElement.getBoundingClientRect() as DOMRect
    //     // const ce = this.canvasElement.nativeElement
    //     // const xdif = srect.width - rect.width
    //     // const ydif = srect.height - rect.height
    //     // const xpos = srect.left + ((xdif > 0) ? (xdif / 2) : 0)
    //     // const ypos = srect.top + ((ydif > 0) ? (ydif / 2) : 0)
    //     // console.log(xdif, ydif)
    //     const thisFrame= this.frameElements.toArray()[this.current].nativeElement as HTMLImageElement
    //     const xpos = irect.left
    //     this.cstyle = {
    //         width: irect.width.toString() + 'px',
    //         height: irect.height.toString() + 'px',
    //         left: xpos.toString() + 'px'
    //     }
    //     console.log('cstyle', this.cstyle.width, this.cstyle.height, this.cstyle.left)
    //     // ce.style.setProperty('width', rect.width.toString() + 'px')
    //     // ce.style.setProperty('height', rect.height.toString() + 'px')
    //     // ce.style.setProperty('top', ypos.toString() + 'px')
    //     // ce.style.setProperty('left', xpos.toString() + 'px')
    // }
    // setCanvasSize(i: number) {
    //     if (!this.imageElements.toArray()[i]) return '';
    //     const thisImage = this.imageElements.toArray()[i].nativeElement as HTMLImageElement
    //     return {
    //         width: thisImage.width.toString() + 'px',
    //         height: thisImage.height.toString() + 'px',
    //     }

    resizeCanvas() {
        this.cstyle = this.imageElements.map((ie) => {
            return {
                width: ie.nativeElement.width.toString() + 'px',
                height: ie.nativeElement.height.toString() + 'px'
            }
        })
        console.log('cstyle', this.cstyle)
    }

    getCanvas(frame: number): {canvas: HTMLCanvasElement, width: number, height: number} {
        try {
            const canvasEl = this.canvasElements.toArray()[frame]
            return {
                canvas: (canvasEl.nativeElement as HTMLCanvasElement),
                width: this.imageList[frame].width,
                height: this.imageList[frame].height
            }
        } catch {
            console.log('canvas elements', this.canvasElements.toArray())
        }
    }
}
