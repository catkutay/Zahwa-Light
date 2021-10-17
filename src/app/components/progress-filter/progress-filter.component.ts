import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'app-progress-filter',
    styleUrls: ['./progress-filter.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
<div class="snippet">
    <div class="photo"></div>
    <div class="progressbar">
        <div *ngFor="let step of progIcons; let i = index" class="progressitem"
            [class.complete]="selected == i">
            <ion-icon icon-only [name]="geticon(i)"></ion-icon>
        </div>
    </div>
</div>
  `
})
export class ProgressFilterComponent implements OnInit {
    progIcons: string[] = ['camera', 'mic-circle', 'help-circle', 'checkmark-circle']
    selected: number = 0
    constructor() { }
    geticon(i: number): string {
        let istring = this.progIcons[i]
        if (this.selected !== i) {
            istring = istring += '-outline'
        }
        return istring
    }
    ngOnInit(): void {
    }

}
