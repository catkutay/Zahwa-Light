import { Component, Input, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { ISession } from 'src/app/interface';
import { SafeStyle } from '@angular/platform-browser';
import { SessionsService } from 'src/app/services/sessions.service';
import { ModalController } from '@ionic/angular';
import { IgvComponent } from 'src/app/modals/igv/igv.component';
import { ToolsService } from 'src/app/services/tools.service';
import { DescribeComponent } from 'src/app/modals/describe/describe.component';
import AlloyFinger from 'alloyfinger'

@Component({
    selector: 'app-kitchen-snippet',
    styleUrls: ['./kitchen-snippet.component.scss'],
    template: `
<div #snippetel class="snippet">
    <div class="photo" [style.background-image]="(imageStyle | async)?.style">
    </div>
    <div class="progressbar">
        <div *ngFor="let step of progIcons; let i = index" class="progressitem"
            [class.complete]="session.stage > i">
            <ion-icon icon-only [name]="geticon(i)"></ion-icon>
        </div>
    </div>
</div>
  `
})
export class KitchenSnippetComponent implements OnInit, AfterViewInit, OnDestroy {
    // C O N S T R U C T O R
    @Input() session: ISession
    @Input() setac
    progIcons: string[] = ['camera', 'mic-circle', 'help-circle', 'checkmark-circle']
    imageStyle: Promise<{style: SafeStyle, width: number, height: number}>
    openingmodal: boolean = false
    alloy: AlloyFinger
    @ViewChild('snippetel') snippetElement: ElementRef
    @Output() longpress = new EventEmitter<void>()
    activated: Set<string> = new Set()
    constructor(
        private sesh: SessionsService,
        private modalCtrl: ModalController,
        private tools: ToolsService) { }

    ngOnInit() {
        this.imageStyle = this.sesh.getImageStyleFromId(this.session.coverId)
    }

    ngAfterViewInit() {
        console.log('el', this.snippetElement)
        const div = this.snippetElement.nativeElement as HTMLDivElement
        this.alloy = new AlloyFinger(div, {
            tap: () => {
                this.click()
            },
            longTap: () => {
                this.longpress.emit()
            }
        })
    }

    ngOnDestroy() {
        this.alloy.destroy()
    }

    geticon(i: number): string {
        let istring = this.progIcons[i]
        if (this.session.stage <= i) {
            istring = istring += '-outline'
        }
        return istring
    }

    async click() {
        if (this.openingmodal) return;
        this.openingmodal = true
        if (this.session.stage === 1) {
            const m = await this.modalCtrl.create({
                component: IgvComponent,
                componentProps: {
                    session: this.session
                }
            })
            const retval = await this.tools.showModal(m)
        } else if (this.session.stage === 2) {
            const m = await this.modalCtrl.create({
                component: DescribeComponent,
                componentProps: {
                    session: this.session
                }
            })
            const retval = await this.tools.showModal(m)
        }
        this.openingmodal = false
    }
}
