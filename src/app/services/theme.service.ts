/**
 * Theme Service
 * Reactive based on system appearance changes.
 */
import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { Application, SystemAppearanceChangedEventData } from '@nativescript/core';

export type ThemeMode = 'dark' | 'light';

function getInitialSystemAppearance(): ThemeMode {
  if (__APPLE__) {
    try {
      const style = UITraitCollection.currentTraitCollection?.userInterfaceStyle;
      if (style === UIUserInterfaceStyle.Dark) {
        return 'dark';
      }
      return 'light';
    } catch (e) {
      console.warn('ThemeService: Could not get initial system appearance', e);
    }
  }
  return Application.systemAppearance() || 'light';
}

@Injectable({
  providedIn: 'root',
})
export class ThemeService implements OnDestroy {
  private readonly _mode = signal<ThemeMode>(getInitialSystemAppearance());
  readonly mode = this._mode.asReadonly();
  readonly isDarkMode = computed(() => this._mode() === 'dark');
  readonly isLightMode = computed(() => this._mode() === 'light');

  readonly colors = computed(() => {
    const dark = this.isDarkMode();
    return {
      // Text colors
      textPrimary: dark ? '#f1f5f9' : '#1e293b',
    };
  });

  private readonly appearanceHandler = (args: SystemAppearanceChangedEventData) => {
    console.log('ThemeService: System appearance changed to:', args.newValue);
    this._mode.set(args.newValue as ThemeMode);
  };

  constructor() {
    Application.on(Application.systemAppearanceChangedEvent, this.appearanceHandler);
    console.log('ThemeService initialized with mode:', this._mode());
  }

  ngOnDestroy(): void {
    Application.off(Application.systemAppearanceChangedEvent, this.appearanceHandler);
  }
}
