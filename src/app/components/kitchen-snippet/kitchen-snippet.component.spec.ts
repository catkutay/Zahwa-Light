import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { KitchenSnippetComponent } from './kitchen-snippet.component';

describe('KitchenSnippetComponent', () => {
  let component: KitchenSnippetComponent;
  let fixture: ComponentFixture<KitchenSnippetComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ KitchenSnippetComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(KitchenSnippetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
