/// <reference path="./node_modules/@nativescript/types/index.d.ts" />
/// <reference path="./node_modules/@nativescript/iqkeyboardmanager/typings/objc!IQKeyboardManager.d.ts" />

// Android KeyboardAccessoryHelper typings
declare namespace org {
  namespace nativescript {
    class KeyboardAccessoryHelper {
      constructor(
        activity: android.app.Activity,
        inputContainer: android.view.View,
        scrollView: android.view.View,
        inputContainerHeight: number
      );

      setup(callback: org.nativescript.KeyboardAccessoryHelper.KeyboardStateCallback): void;
      updateAccessoryHeight(newHeightPx: number): void;
      dismissKeyboard(): void;
      showKeyboard(): void;
      scrollToBottom(): void;
      clampScrollPosition(): void;
      cleanup(): void;
    }

    namespace KeyboardAccessoryHelper {
      class KeyboardStateCallback {
        constructor(implementation: {
          onKeyboardHeightChanged(heightPx: number, isAnimating: boolean): void;
          onKeyboardFullyShown(heightPx: number): void;
          onKeyboardFullyHidden(): void;
          onRelayoutScrollContent(): void;
        });
      }
    }
  }
}

// iOS KeyboardTrackingView typings
declare class InputAccessoryContainerView extends UIView {

	static alloc(): InputAccessoryContainerView; // inherited from NSObject

	static appearance(): InputAccessoryContainerView; // inherited from UIAppearance

	/**
	 * @since 8.0
	 */
	static appearanceForTraitCollection(trait: UITraitCollection): InputAccessoryContainerView; // inherited from UIAppearance

	/**
	 * @since 8.0
	 * @deprecated 9.0
	 */
	static appearanceForTraitCollectionWhenContainedIn(trait: UITraitCollection, ContainerClass: typeof NSObject): InputAccessoryContainerView; // inherited from UIAppearance

	/**
	 * @since 9.0
	 */
	static appearanceForTraitCollectionWhenContainedInInstancesOfClasses(trait: UITraitCollection, containerTypes: NSArray<typeof NSObject> | typeof NSObject[]): InputAccessoryContainerView; // inherited from UIAppearance

	/**
	 * @since 5.0
	 * @deprecated 9.0
	 */
	static appearanceWhenContainedIn(ContainerClass: typeof NSObject): InputAccessoryContainerView; // inherited from UIAppearance

	/**
	 * @since 9.0
	 */
	static appearanceWhenContainedInInstancesOfClasses(containerTypes: NSArray<typeof NSObject> | typeof NSObject[]): InputAccessoryContainerView; // inherited from UIAppearance

	static new(): InputAccessoryContainerView; // inherited from NSObject
}

declare class KeyboardTrackingView extends UIView {

	static alloc(): KeyboardTrackingView; // inherited from NSObject

	static appearance(): KeyboardTrackingView; // inherited from UIAppearance

	/**
	 * @since 8.0
	 */
	static appearanceForTraitCollection(trait: UITraitCollection): KeyboardTrackingView; // inherited from UIAppearance

	/**
	 * @since 8.0
	 * @deprecated 9.0
	 */
	static appearanceForTraitCollectionWhenContainedIn(trait: UITraitCollection, ContainerClass: typeof NSObject): KeyboardTrackingView; // inherited from UIAppearance

	/**
	 * @since 9.0
	 */
	static appearanceForTraitCollectionWhenContainedInInstancesOfClasses(trait: UITraitCollection, containerTypes: NSArray<typeof NSObject> | typeof NSObject[]): KeyboardTrackingView; // inherited from UIAppearance

	/**
	 * @since 5.0
	 * @deprecated 9.0
	 */
	static appearanceWhenContainedIn(ContainerClass: typeof NSObject): KeyboardTrackingView; // inherited from UIAppearance

	/**
	 * @since 9.0
	 */
	static appearanceWhenContainedInInstancesOfClasses(containerTypes: NSArray<typeof NSObject> | typeof NSObject[]): KeyboardTrackingView; // inherited from UIAppearance

	static new(): KeyboardTrackingView; // inherited from NSObject

	cleanup(): void;

	setScrollViewRelayoutCallback(callback: () => void): void;

	setupWithInputContainerScrollViewHeight(inputContainer: UIView, scrollView: UIScrollView, height: number): void;

	showKeyboardWithTextField(textField: UITextField): void;

	setDismissingKeyboard(): void;

	trackKeyboardPosition(): void;

	updateHeight(newHeight: number): void;
}