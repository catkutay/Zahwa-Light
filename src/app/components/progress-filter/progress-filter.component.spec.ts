import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ProgressFilterComponent } from './progress-filter.component';

describe('ProgressFilterComponent', () => {
  let component: ProgressFilterComponent;
  let fixture: ComponentFixture<ProgressFilterComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ProgressFilterComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ProgressFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
