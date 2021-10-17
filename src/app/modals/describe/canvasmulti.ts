import { SwiperComponent } from 'src/app/components/swiper/swiper.component'
import AlloyFinger from 'alloyfinger'
import { Observable, Subject } from 'rxjs'

export enum CMTState {
    READY,
    TOUCHING,
    SELECTED,
    DISABLED
}

export class CanvasMultiTouch {
    ids: string[]
    canvii: {canvas: HTMLCanvasElement, width: number, height: number, boxes: {x1: number, y1: number, x2: number, y2: number}[]}[] = []
    active: number = 0
    af: AlloyFinger
    touchEvtSub: Subject<CMTState> = new Subject()
    state: CMTState = CMTState.READY
    box: {x1: number, y1: number, x2: number, y2: number}
    mid: {x: number, y: number}
    animating: boolean = false
    animateToggle: number = 0
    animatecolor: string
    constructor(swiper: SwiperComponent, imageIds: string[]){
        imageIds.forEach((v,i) => {
            const c = swiper.getCanvas(i)
            this.canvii.push({
                canvas: c.canvas,
                width: c.width,
                height: c.height,
                boxes: []
            })
        })
    }
    public activate(index: number) {
        if (this.af) {
            this.af.destroy()
        }
        this.box = null
        this.drawupdate('foo')
        const canvas = this.canvii[index].canvas
        this.active = index
        this.setState(CMTState.READY)
        const that = this
        this.af = new AlloyFinger(canvas, {
            // touchStart: function () { },
            // touchMove: function () { },
            // touchEnd:  function () { },
            // touchCancel: function () { },
            // multipointStart: function () { },
            // multipointEnd: function () { },
            // tap: function () { },
            // doubleTap: function () { },
            // longTap: function () { },
            // singleTap: function () { },
            // rotate: function () { },
            multipointStart: (evt: TouchEvent) => {
                if (this.state === CMTState.DISABLED) return;
                console.log('start', evt)
                this.touchEvtSub.next(CMTState.TOUCHING)
                this.state = CMTState.TOUCHING
            },
            pinch: (evt: TouchEvent) => {
                if (this.state === CMTState.DISABLED) return;
                this.processpinch(evt.targetTouches)
            },
            multipointEnd: (evt: TouchEvent) => {
                if (this.state === CMTState.DISABLED) return;
                console.log('ended', evt)
                if (this.state === CMTState.TOUCHING) {
                    this.touchEvtSub.next(CMTState.SELECTED)
                    this.state = CMTState.SELECTED
                }
            }
        })
    }
    setState(s: CMTState) {
        this.state = s
    }
    enable() {
        this.state = CMTState.READY
    }
    disable() {
        this.state = CMTState.DISABLED
    }
    observe(): Observable<CMTState> {
        return this.touchEvtSub.asObservable()
    }
    processpinch(tl: TouchList) {
        let x1 = tl[0].clientX
        let y1 = tl[0].clientY
        let x2 = tl[1].clientX
        let y2 = tl[1].clientY
        if (x1 > x1 || y1 > y2) {
            x2 = [x1, x1 = x2][0] // typescript is too lame for ES6 destructuring
            y2 = [y1, y1 = y2][0]
        }
        const c = this.canvii[this.active]
        // transform x coords to relative to the canvas
        const rect = c.canvas.getBoundingClientRect()
        x1 = x1 - rect.left
        y1 = y1 - rect.top
        x2 = x2 - rect.left
        y2 = y2 - rect.top
        // set relative integer selected box value
        this.box = {x1, y1, x2, y2}
        this.drawupdate('red')
    }

    getSelected() {
        return this.box
    }
    getMidPointCS(): {top: string, left: string} {
        const c = this.canvii[this.active]
        const rect = c.canvas.getBoundingClientRect()
        const midoffx = ((this.box.x2 - this.box.x1) / 2)
        const midoffy = ((this.box.y2 - this.box.y1) / 2)
        const x = this.box.x1 + rect.left + midoffx
        const y = this.box.y1 + rect.top + midoffy
        return {
            top: y.toString() + 'px',
            left: x.toString() + 'px'
        }
    }

    drawupdate(selectedColor: string) {
        const canvas = this.canvii[this.active].canvas
        const scale = canvas.width / canvas.clientWidth
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        const drawbox = (style: string, box: {x1: number, y1: number, x2: number, y2: number}) => {
            const width = box.x2 - box.x1
            const height = box.y2 - box.y1
            ctx.strokeStyle = style
            ctx.lineWidth = Math.round(3*scale)
            ctx.beginPath()
            ctx.rect(box.x1 * scale, box.y1 * scale, width * scale, height * scale)
            ctx.stroke()
        }
        for (const box of this.canvii[this.active].boxes) {
            drawbox('grey', box)
        }
        if (this.box) {
            drawbox(selectedColor, this.box)
        }
    }
    savebox(): {x1: number, y1: number, x2: number, y2: number}  {
        if (!this.box) {
            throw new Error('no box to save')
        }
        const cb = Object.assign({}, this.box)
        this.canvii[this.active].boxes.push(cb)
        this.box = null
        this.drawupdate('red') // color is irrelevant
        console.log( this.canvii)
        return cb
    }
    popbox() {
        if (this.canvii[this.active].boxes.length === 0) {
            throw new Error('no box to pop')
        }
        this.canvii[this.active].boxes.pop()
    }
    getboxlength() {
        return this.canvii[this.active].boxes.length
    }
    animate(highlight: string) {
        this.animatecolor = highlight
        this.animateToggle = 0
        this.animating = true
        this.doanimate()
    }
    stopanimate(highlight: string) {
        this.animating = false
        this.drawupdate(highlight)
    }
    doanimate() {
        if (this.animating) {
            if (this.animateToggle) {
                this.drawupdate(this.animatecolor)
                this.animateToggle = 0
            } else {
                this.drawupdate('black')
                this.animateToggle = 1
            }
            setTimeout(() => {
                this.doanimate()
            }, 400)
        }
    }

    // getXYFromTouch (touch: Touch): { x: number, y: number } {
    //     const target = touch.target as Element
    //     const rect = target.getBoundingClientRect()
    //     const rx = touch.clientX - rect.left
    //     const ry = touch.clientY - rect.top
    //     return {
    //         x: rx / rect.width,
    //         y: ry / rect.height
    //     }
    // }

}