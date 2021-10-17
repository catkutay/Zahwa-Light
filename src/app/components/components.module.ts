import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { KitchenSnippetComponent } from './kitchen-snippet/kitchen-snippet.component';
import { ProgressFilterComponent } from './progress-filter/progress-filter.component';
import { SwiperComponent } from './swiper/swiper.component';

@NgModule({
  declarations: [KitchenSnippetComponent, ProgressFilterComponent, SwiperComponent],
  imports: [
    IonicModule,
    CommonModule
  ],
  exports: [KitchenSnippetComponent, SwiperComponent]
})
export class ComponentsModule { }
