import { View, TextView, Utils, ScrollView } from "@nativescript/core";

/**
 * KeyboardAccessoryManager
 *
 * Connect NativeScript's layout system with iOS inputAccessoryView.
 *
 */
export class KeyboardAccessoryManager {
  private keyboardTrackingView: KeyboardTrackingView | null = null;
  private scrollView: UIScrollView | null = null;
  private nsScrollViewContainer: ScrollView | null = null;
  private inputContainerView: UIView | null = null;
  private nsInputContainer: View | null = null;
  private textView: TextView | null = null;
  private baseHeight: number = 48;
  private maxHeight: number = 200;
  private isRelayoutingScrollView: boolean = false;

  setup(
    viewController: UIViewController,
    inputContainer: View,
    scrollView: UIScrollView,
    scrollViewView: ScrollView,
    textView: TextView
  ): void {
    this.scrollView = scrollView;
    this.nsScrollViewContainer = scrollViewView;
    this.nsInputContainer = inputContainer;
    this.inputContainerView = inputContainer.ios as UIView;
    this.textView = textView;

    // Cap initial height to avoid excessive top padding
    const frameHeight = this.inputContainerView.frame.size.height;
    const inputHeight = (frameHeight > 0 && frameHeight <= 50) ? frameHeight : 48;
    this.baseHeight = inputHeight;

    // Create native KeyboardTrackingView (invisible, just for first responder chain)
    this.keyboardTrackingView = KeyboardTrackingView.alloc().initWithFrame(
      CGRectMake(0, 0, 0, 0)
    );
    viewController.view.addSubview(this.keyboardTrackingView);

    // Swift moves the native UIView into the inputAccessoryView
    this.keyboardTrackingView.setupWithInputContainerScrollViewHeight(
      this.inputContainerView,
      scrollView,
      inputHeight
    );

    // Collapse the NativeScript View in the parent GridLayout.
    // This makes row 2 = 0 height and prevents the parent from calling
    // _setNativeViewFrame (which would conflict with the accessory positioning).
    // We handle layout of children ourselves via relayoutAccessory().
    inputContainer.isCollapsed = true;
    if (inputContainer.parent) {
      inputContainer.parent.requestLayout();
    }

    // Set the callback so Swift can trigger ScrollView content relayout
    const relayoutCallback = () => {
      this.relayoutScrollViewContent();
    };
    this.keyboardTrackingView.setScrollViewRelayoutCallback(relayoutCallback);

    // Run initial layout of children within the accessory dimensions
    setTimeout(() => this.relayoutAccessory(), 50);
  }

  setTextView(textView: TextView): void {
    this.textView = textView;
  }

  updateAccessoryHeight(): void {
    if (!this.keyboardTrackingView || !this.textView) return;

    const nativeTextView = this.textView.ios as UITextView;
    if (!nativeTextView) return;

    // sizeThatFits returns the natural text height
    const currentWidth = nativeTextView.frame.size.width;
    const fittingSize = nativeTextView.sizeThatFits(
      CGSizeMake(currentWidth, 10000)
    );
    const containerPadding = 16;

    let newHeight = fittingSize.height + containerPadding;
    newHeight = Math.max(this.baseHeight, Math.min(newHeight, this.maxHeight));

    // Update native accessory container height (Swift handles height constraint + reloadInputViews)
    this.keyboardTrackingView.updateHeight(newHeight);

    // Re-layout NativeScript children within the new dimensions
    this.relayoutAccessory();
  }

  /**
   * Manually trigger NativeScript's measure + layout cycle on the input container.
   *
   * Since isCollapsed=true prevents the parent from doing this, we call
   * measure() and layout() directly. This makes children (TextView, buttons)
   * re-measure and reposition within the accessory container's current size.
   */
  private relayoutAccessory(): void {
    if (!this.nsInputContainer || !this.inputContainerView) return;

    const frame = this.inputContainerView.frame;
    const width = frame.size.width;
    const height = frame.size.height;

    if (width <= 0 || height <= 0) return;

    const dpWidth = Utils.layout.toDevicePixels(width);
    const dpHeight = Utils.layout.toDevicePixels(height);

    const widthSpec = Utils.layout.makeMeasureSpec(
      dpWidth,
      Utils.layout.EXACTLY
    );
    const heightSpec = Utils.layout.makeMeasureSpec(
      dpHeight,
      Utils.layout.EXACTLY
    );

    this.nsInputContainer.measure(widthSpec, heightSpec);
    this.nsInputContainer.layout(0, 0, dpWidth, dpHeight);

    // Force hint placeholder to re-render after reparenting into the accessory.
    if (this.textView && (!this.textView.text || this.textView.text.length === 0)) {
      const hint = this.textView.hint;
      this.textView.hint = '';
      this.textView.hint = hint;
    }
  }

  /**
   * Relayout ScrollView content after native frame resize.
   */
  public relayoutScrollViewContent(): void {
    // Prevent recursive calls - if we're already relayouting, skip
    if (this.isRelayoutingScrollView) {
      console.log('[ScrollView Relayout] Skipping - already in progress');
      return;
    }

    if (!this.scrollView || !this.nsScrollViewContainer) return;

    this.isRelayoutingScrollView = true;

    try {
      // Get the content child (the StackLayout containing messages)
      // ScrollView extends ContentView which has a single 'content' child
      const scrollViewView = this.nsScrollViewContainer;
      const stackLayout = scrollViewView.content;

      if (!stackLayout) {
        console.log('[ScrollView Relayout] No StackLayout found');
        return;
      }

      // Get current frame dimensions
      const frame = this.scrollView.frame;
      const width = frame.size.width;
      const height = frame.size.height;

      if (width <= 0 || height <= 0) {
        console.log('[ScrollView Relayout] Invalid frame dimensions');
        return;
      }

      const dpWidth = Utils.layout.toDevicePixels(width);

      // Remeasure
      const widthSpec = Utils.layout.makeMeasureSpec(dpWidth, Utils.layout.EXACTLY);
      const heightSpec = Utils.layout.makeMeasureSpec(0, Utils.layout.UNSPECIFIED);

      stackLayout.measure(widthSpec, heightSpec);
      const measuredHeight = stackLayout.getMeasuredHeight();
      stackLayout.layout(0, 0, dpWidth, measuredHeight);

      // Recalculate contentSize based on measured height
      const contentHeight = Utils.layout.toDeviceIndependentPixels(measuredHeight);
      this.scrollView.contentSize = CGSizeMake(width, contentHeight);

      console.log(`[ScrollView Relayout] frame: ${width.toFixed(0)}x${height.toFixed(0)}, contentHeight: ${contentHeight.toFixed(0)}`);
    } finally {
      // Always reset the flag, even if an error occurred
      this.isRelayoutingScrollView = false;
    }
  }

  /**
   * Dismiss the keyboard by transferring first responder to the KeyboardTrackingView.
   * This keeps the accessory visible (single transition) instead of dismissSoftInput()
   * which briefly removes the accessory and causes a scroll jump.
   */
  dismissKeyboard(): void {
    if (this.keyboardTrackingView) {
      this.keyboardTrackingView.setDismissingKeyboard();
      this.keyboardTrackingView.becomeFirstResponder();
    }
  }

  cleanup(): void {
    if (this.keyboardTrackingView) {
      this.keyboardTrackingView.cleanup();
      this.keyboardTrackingView.removeFromSuperview();
      this.keyboardTrackingView = null;
    }

    this.scrollView = null;
    this.nsScrollViewContainer = null;
    this.inputContainerView = null;
    this.nsInputContainer = null;
    this.textView = null;
  }
}
