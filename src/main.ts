import {
  bootstrapApplication,
  provideNativeScriptHttpClient,
  provideNativeScriptRouter,
  runNativeScriptAngularApp,
  registerElement,
} from '@nativescript/angular';
import { provideZonelessChangeDetection } from '@angular/core';
import { withInterceptorsFromDi } from '@angular/common/http';
import { Application } from '@nativescript/core';
import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

// Register custom streamdown elements
import { registerStreamdownElements } from '@nstudio/nstreamdown/angular';
registerStreamdownElements();

// Register Shimmer element
import { Shimmer } from '@nstudio/nativescript-shimmer';
registerElement('Shimmer', () => Shimmer);

// Handle keyboard manually for chat UI
if (__APPLE__) {
  Application.on(Application.launchEvent, () => {
    const iqKeyboard = IQKeyboardManager.sharedManager();
    iqKeyboard.enableAutoToolbar = false;
    iqKeyboard.enable = false;
  });
}

runNativeScriptAngularApp({
  appModuleBootstrap: () => {
    return bootstrapApplication(AppComponent, {
      providers: [
        provideNativeScriptHttpClient(withInterceptorsFromDi()),
        provideNativeScriptRouter(routes),
        provideZonelessChangeDetection(),
      ],
    });
  },
});
