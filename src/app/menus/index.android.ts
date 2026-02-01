import { Button, Image } from '@nativescript/core';

export * from './index-common';

export class MenuButton extends Button {
  set options(value) {
    this.set('menu', value);

    if (!this.hasListeners('menuSelected')) {
      this.on('menuSelected', args => {
        this.notify({
          ...args,
          eventName: 'selected',
        });
      });
    }
  }
}

export class MenuImage extends Image {
  set options(value) {
    this.set('menu', value);

    if (!this.hasListeners('menuSelected')) {
      this.on('menuSelected', args => {
        this.notify({
          ...args,
          eventName: 'selected',
        });
      });
    }
  }
}
