import { Component, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticateService } from './services/authentication';
import { Observable } from 'rxjs';

@Component({
    selector: 'app-root',
    template: `
    <ion-app>
        <ion-router-outlet *ngIf="authService.observeUser() | async as user; else showLogin"></ion-router-outlet>
        <ng-template #showLogin>
            <ion-row>
                <ion-col>
                <ion-button
                type="submit"
                color="danger"
                (click)="authService.loginUser()"
                expand="block">
                    Login with Google
                </ion-button>
            </ion-col>
        </ion-row>
        </ng-template>
    </ion-app> 
    <!-- 
    <ion-app>
        <ion-router-outlet ></ion-router-outlet>
    </ion-app>
    -->
  `,
    styleUrls: ['app.component.scss']
})
export class AppComponent {
    user: firebase.User = null
    authObs: Observable<firebase.User>
    constructor(
        private router: Router,
        private zone: NgZone,
        public authService: AuthenticateService
    ) { }

}
