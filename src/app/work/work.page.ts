import { Component, ViewChild, ElementRef } from '@angular/core';
import { Observable } from 'rxjs';
import { ISession } from 'src/app/interface';
import { SessionsService } from '../services/sessions.service';
import { ModalController, ActionSheetController, PopoverController } from '@ionic/angular';
import { DragsterComponent } from '../modals/dragster/dragster.component';
import { ToolsService } from '../services/tools.service';
import { ConfirmComponent } from '../modals/confirm/confirm.component'

@Component({
    selector: 'app-kitchen',
    templateUrl: 'work.page.html',
    styleUrls: ['work.page.scss']
})
export class WorkPage {
    $sessionList: Observable<ISession[]>
    @ViewChild('fileinput', { static: true }) inputElement: ElementRef;
    activated: Set<string> = new Set()
    showMenu: boolean = false
    constructor(
        private sessions: SessionsService,
        private modalCtrl: ModalController,
        private tools: ToolsService,
        private actionCtrl: ActionSheetController,
        private popCtrl: PopoverController) {
        this.$sessionList = sessions.observeSessions()
    }

    async handleFiles(f: any) {
        f.preventDefault()
        const numfiles = f.target.files.length
        if (numfiles === 0) {
            return
        }
        const m = await this.modalCtrl.create({
            component: DragsterComponent,
            componentProps: {
                files: f.target.files,
            }
        })
        const retval = await this.tools.showModal(m)
        if (retval) {
            await this.sessions.createSession(retval.photos, retval.coverIndex)
        }
    }
    clickNew() {
        this.inputElement.nativeElement.click()
    }

    longpress(id: string) {
        if (this.activated.has(id)) {
            this.activated.delete(id)
        } else {
            this.activated.add(id)
        }
        this.showMenu = Array.from(this.activated.values()).length > 0
    }

    async openActionSheet(evt) {
        const actionSheet = await this.actionCtrl.create({
            header: 'Sessions',
            cssClass: 'my-custom-class',
            buttons: [{
              text: 'Delete',
              role: 'destructive',
              icon: 'trash',
              handler: async () => {
                console.log('Delete clicked');
                const numactiv = this.activated.size
                const plural = numactiv > 1 ? 's' : ''
                const poptext = 'Delete ' + numactiv.toString() + ' session' + plural + '?'
                const res = await this.confirm(poptext, ['Delete', 'Cancel'], evt)
                if (!res || res === 'Cancel') return;
                console.log('deleting')
                await this.sessions.deleteSessions(Array.from(this.activated.values()))
                this.activated.clear()
                this.showMenu = false
              }
            }, {
              text: 'Cancel',
              icon: 'close',
              role: 'cancel',
              handler: () => {
                console.log('Cancel clicked');
                this.activated.clear()
                this.showMenu = false
              }
            }]
          });
          await actionSheet.present()
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
