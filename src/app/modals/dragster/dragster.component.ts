import { Component, OnInit, Input, ElementRef, ViewChild } from '@angular/core';
import { ToolsService } from 'src/app/services/tools.service';
import { DomSanitizer, SafeStyle, SafeResourceUrl } from '@angular/platform-browser';
import { Options } from 'sortablejs';
import { ModalController } from '@ionic/angular';
//import { Capacitor } from '@capacitor/core';
//import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';

interface ImageThumb {
    id?: string
    style: SafeStyle
    date: Date
    blob: Blob
    name: string
    width: number
    height: number
}

@Component({
    templateUrl: './dragster.component.html',
    styleUrls: ['./dragster.component.scss']
})
export class DragsterComponent implements OnInit {
    @Input() files: FileList
    @ViewChild('fileinput', { static: true }) inputElement: ElementRef
    imageBlob: Blob
    imageStyle: SafeStyle
    images: string[] = [] // ids for the map - this array gets sorted by drag 'n drop
    imagebackup: string[] = [] // for restoring
    deletedimages: string[] = [] // image ids moved here when dragging to bin
    processing: boolean = true
    changed: boolean = false
    options: Options = {
        group: 'pictures',
        onUpdate: (event: any) => {
            if (this.images.length !== this.imagebackup.length) {
                this.changed = true
                return
            }
            for (let i = 0; i < this.images.length; ++i) {
                if (this.images[i] !== this.imagebackup[i]) {
                    this.changed = true
                    return
                }
            }
            this.changed = false
        }
    }
    imageMap: Map<string, ImageThumb> = new Map()
    //photo: SafeResourceUrl

    constructor(private tools: ToolsService, private sanitizer: DomSanitizer, private modalCtrl: ModalController) { }

    async ngOnInit() {
        if (!this.files) {
            throw new Error('Dragster files property requires FileList')
        }
        this.importPhotos(this.files)
        /*
        if (!this.files) {
            throw new Error('Dragster files property requires FileList');
        }
        else if(this.importPhotos){
            await this.importPhotos(this.files);
        }
        
        else if(this.addNew){
            await this.addNew();
        }*/

    }

    async importPhotos(files: FileList) {
        this.processing = true
        console.log('resizing',files.length,'files')
        const fl = Array.from(this.files)
        const ids: string[] = []
        for (const file of fl) {
            console.log('resizing', file.name)
            const b = await this.tools.resizeImage(file)
            console.log('resizing done')
            const u = URL.createObjectURL(b.blob)
            const s = this.sanitizer.bypassSecurityTrustStyle('url(' + u + ')')
            const id = this.tools.makeObjectId()
            const d = new Date(0)
            d.setUTCMilliseconds(file.lastModified)
            this.imageMap.set(id, {blob: b.blob, width: b.width, height: b.height, style: s, date: d, name: file.name})
            ids.push(id)
        }
        this.images = [...this.images, ...ids]
        this.imagebackup = this.images.slice(0) // clone
        this.processing = false
    }

    reset() {
        this.images = this.imagebackup.slice(0)
        this.deletedimages = []
    }

    async handleFiles(f: any) {
        f.preventDefault()
        const numfiles = f.target.files.length
        if (numfiles === 0) {
            console.log('No files selected')
            return
        }
        this.importPhotos(f.target.files)
    }
/*
    async addNew() {
        if (!Capacitor.isPluginAvailable('Camera') ) {
            this.inputElement.nativeElement.click();
            return;
        //this.inputElement.nativeElement.click()
    }

    const image = await Camera.getPhoto({
        quality: 100,
        width: 400,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt
      });
  
      this.photo = this.sanitizer.bypassSecurityTrustResourceUrl(image.webPath) ;
    }
    */
    accept() {
        // serialise to keep the order, remove ids because they will be generated when saved
        const imagearray = this.images.map((i) => {
            const img = this.imageMap.get(i)
            return {
                date: img.date,
                name: img.name,
                width: img.width,
                height: img.height,
                blob: this.imageMap.get(i).blob
            }
        })
        this.modalCtrl.dismiss({photos: imagearray, coverIndex: 0}) // no means to set cover index for now
    }
    close() {
        this.modalCtrl.dismiss()
    }

}
