import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { DragsterComponent } from './dragster/dragster.component';
import { SortablejsModule } from 'ngx-sortablejs';
import { IgvComponent } from './igv/igv.component';
import { ComponentsModule } from '../components/components.module';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ConfirmComponent } from './confirm/confirm.component';
import { DescribeComponent } from './describe/describe.component';

@NgModule({
  declarations: [DragsterComponent, IgvComponent, ConfirmComponent, DescribeComponent],
  imports: [
    IonicModule,
    SortablejsModule,
    CommonModule,
    ComponentsModule,
    FontAwesomeModule
  ],
  exports: []
})
export class ModalsModule { }
