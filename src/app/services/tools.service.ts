import { Injectable } from '@angular/core';
import loadImage from 'blueimp-load-image'
import { PopoverController, ModalController, ActionSheetController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class ToolsService {
  windowHistoryState: any[] = []
  maxid: number = 0
  constructor(
    private popCtrl: PopoverController,
    private modalCtrl: ModalController,
    private actionCtrl: ActionSheetController
  ){}
  addWindowHistoryState(ctrl: any) {
    window.history.pushState({modal: true}, null)
    this.windowHistoryState.push(ctrl)
    // console.log('adding history', this.windowHistoryState)
  }
  popWindowHistoryState() {
    // console.log('popping history')
    this.windowHistoryState.pop()
    // console.log('new length', this.windowHistoryState.length)
  }
  // the hardware back button event will only trigger the dismiss
  // removing the item from windowHistoryState array happens in the wrappers
  hardwareBack() {
    if (this.windowHistoryState.length > 0) {
      const lpos = this.windowHistoryState.length - 1
      this.windowHistoryState[lpos].dismiss()
    }
  }

  // modal test
  async showPopover(pop: HTMLIonPopoverElement ): Promise<any> {
    await pop.present()
    this.addWindowHistoryState(this.popCtrl)
    const res = await pop.onDidDismiss()
    // console.log('REMOVING')
    this.popWindowHistoryState()
    return res && res.data ? res.data : null
  }

  // modal test
  async showModal(modal: HTMLIonModalElement): Promise<any> {
    await modal.present()
    this.addWindowHistoryState(this.modalCtrl)
    const res = await modal.onDidDismiss()
    this.popWindowHistoryState()
    return res && res.data ? res.data : null
  }

  async showActionsheet(asheet: HTMLIonActionSheetElement): Promise<any> {
    await asheet.present()
    this.addWindowHistoryState(this.actionCtrl)
    const res = await asheet.onDidDismiss()
    this.popWindowHistoryState()
    return res && res.data ? res.data : null
  }

  makeObjectId(m = Math, d = Date, h = 16, s = s => m.floor(s).toString(h)): string {
    return s(d.now() / 1000) + ' '.repeat(h).replace(/./g, () => s(m.random() * h))
  }

  makeObjectIdWithDomain(domain: string) {
    return domain + '/' + this.makeObjectId()
  }

  async _resize(file: File | Blob, mwidth: number, mheight: number, quality: number): Promise<{width: number, height: number, blob: Blob}> {
    return new Promise((resolve) => {
        console.log('loading')
      loadImage(file, (data) => {
          console.log('got data', data)
        data.toBlob((blob: Blob) => {
            console.log('got blob', blob)
          resolve({width: data.width, height: data.height, blob: blob})
        }, 'image/jpeg', quality)
      }, {maxWidth: mwidth, maxHeight: mheight, canvas: true, orientation: true, contain: true})
    })
  }

  resizeImage(file: File | Blob, mwidth: number = 1280, mheight: number = 960, qual: number = 0.5): Promise<{width: number, height: number, blob: Blob}> {
    return this._resize(file, mwidth, mheight, qual)
  }

  async resizeImages(files: File[] | Blob[], mwidth: number = 1280, mheight: number = 960, qual: number = 0.5): Promise<{width: number, height: number, blob: Blob}[]> {
    const resizeResults: {width: number, height: number, blob: Blob}[] = []
    for (const file of files) {
      resizeResults.push(await this._resize(file, mwidth, mheight, qual))
    }
    return resizeResults
  }

  getNiceTime(milliseconds: number): string {
    let d = new Date(null)
    d.setMilliseconds(milliseconds)
    let m = d.getUTCMinutes().toLocaleString('en', {minimumIntegerDigits:2,minimumFractionDigits:0,useGrouping:false})
    let s = d.getUTCSeconds().toLocaleString('en', {minimumIntegerDigits:2,minimumFractionDigits:0,useGrouping:false})
    let ms = (d.getUTCMilliseconds() / 1000).toFixed(1).slice(1)
    return m + ':' + s + ms
  }
  getNiceLowResTime(seconds: number): string {
    let d = new Date(null)
    d.setSeconds(seconds)
    let m = d.getUTCMinutes().toLocaleString('en', {minimumIntegerDigits:1,minimumFractionDigits:0,useGrouping:false})
    let s = d.getUTCSeconds().toLocaleString('en', {minimumIntegerDigits:2,minimumFractionDigits:0,useGrouping:false})
    return m + ':' + s
  }
  pluralStrings(num: number, str: string): string {
    if (num === 0) {
      return 'No ' + str + 's'
    } else {
      return num.toString() + ' ' + str + (num > 1 ? 's' : '')
    } 
  }
  getNiceLongTime(seconds: number): string {
    const d = new Date(null)
    d.setSeconds(seconds)
    const m = d.getUTCMinutes()
    const s = d.getUTCSeconds()
    let str = ''
    if (m > 0) {
      str += m.toString() + ' mins '
    }
    str += s.toString() + ' secs'
    return str
  }

  smoothScroll(elem: HTMLElement, options: any = {}) {
    return new Promise( (resolve) => {
      if( !( elem instanceof Element ) ) {
        throw new TypeError( 'Argument 1 must be an Element' );
      }
      let same = 0; // a counter
      let lastPos = null; // last known Y position
      // pass the user defined options along with our default
      const scrollOptions = Object.assign( { behavior: 'smooth' }, options );
      // let's begin
      elem.scrollIntoView( scrollOptions );
      requestAnimationFrame( check );
      // this function will be called every painting frame
      // for the duration of the smooth scroll operation
      function check() {
        // check our current position
        const newPos = elem.getBoundingClientRect().top;
        if( newPos === lastPos ) { // same as previous
          if(same ++ > 2) { // if it's more than two frames
            return resolve(); // we've come to an halt
          }
        }
        else {
          same = 0; // reset our counter
          lastPos = newPos; // remember our current position
        }
        // check again next painting frame
        requestAnimationFrame(check);
      }
    })
  }
}
