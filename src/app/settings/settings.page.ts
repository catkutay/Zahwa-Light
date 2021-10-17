import { Component } from '@angular/core';
import { AuthenticateService } from '../services/authentication';

@Component({
  selector: 'app-settings',
  templateUrl: 'settings.page.html',
  styleUrls: ['settings.page.scss']
})
export class SettingsPage {

  constructor(public authService: AuthenticateService) {}

}
