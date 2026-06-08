import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { LiquidGlass } from '@nativescript/core'
import { PageRouterOutlet, registerElement } from '@nativescript/angular';
import { MenuButton, MenuImage } from '@nstudio/nativescript-menu';

registerElement('LiquidGlass', () => LiquidGlass);
registerElement('MenuImage', () => MenuImage);
registerElement('MenuButton', () => MenuButton);

@Component({
  selector: 'ns-app',
  templateUrl: './app.component.html',
  imports: [PageRouterOutlet],
  schemas: [NO_ERRORS_SCHEMA],
})
export class AppComponent {}
