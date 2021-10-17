import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { PopoverController } from '@ionic/angular';

@Component({
  selector: 'app-confirm',
  templateUrl: './confirm.component.html',
  styleUrls: ['./confirm.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmComponent {
  @Input() options: string[]
  @Input() text: string
  constructor(
    private popCtrl: PopoverController
    ) { }
    accept(val: string) {
      this.popCtrl.dismiss(val)
    }
}
