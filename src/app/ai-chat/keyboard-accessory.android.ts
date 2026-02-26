import { View, TextView, Utils, ScrollView, Application } from "@nativescript/core";

/**
 * KeyboardAccessoryManager — Android implementation.
 *
 * Works with NativeScript's layout system using the "deferred transition" pattern:
 * - NativeScript handles keyboard layout (resize/reposition) via its defaults
 * - Kotlin helper smooths the transition with translationY animation
 * - Interactive swipe-to-dismiss via WindowInsetsAnimationControllerCompat
 * - Keyboard state callbacks for auto-scroll behavior
 */
export class KeyboardAccessoryManager {
  private helper: org.nativescript.KeyboardAccessoryHelper | null = null;
  private scrollViewView: ScrollView | null = null;
  private nsInputContainer: View | null = null;
  private textView: TextView | null = null;
  private baseHeight: number = 48;
  private maxHeight: number = 200;
  private isRelayoutingScrollView: boolean = false;

  setup(
    _viewController: any, // unused on Android (iOS UIViewController)
    inputContainer: View,
    scrollView: any, // android.widget.ScrollView
    scrollViewView: ScrollView,
    textView: TextView
  ): void {
    this.scrollViewView = scrollViewView;
    this.nsInputContainer = inputContainer;
    this.textView = textView;

    const nativeScrollView = scrollViewView.android as android.widget.ScrollView;
    const nativeInputContainer = inputContainer.android as android.view.View;

    if (!nativeScrollView || !nativeInputContainer) {
      console.error("[KeyboardAccessory] Native views not ready");
      return;
    }

    // API 30+ required for reliable WindowInsetsAnimationCompat.
    // On older APIs, skip — NativeScript's default keyboard behavior works fine.
    if (android.os.Build.VERSION.SDK_INT < 30) {
      console.log("[KeyboardAccessory] API < 30, using default keyboard behavior");
      return;
    }

    const activity =
      Application.android.foregroundActivity ||
      Application.android.startActivity;
    if (!activity) {
      console.error("[KeyboardAccessory] No activity available");
      return;
    }

    // Get initial height in pixels
    const frameHeight = nativeInputContainer.getHeight();
    const maxInitialPx = Utils.layout.toDevicePixels(50);
    const inputHeightPx =
      frameHeight > 0 && frameHeight <= maxInitialPx
        ? frameHeight
        : Utils.layout.toDevicePixels(48);
    this.baseHeight = Utils.layout.toDeviceIndependentPixels(inputHeightPx);

    // Create native helper
    this.helper = new org.nativescript.KeyboardAccessoryHelper(
      activity,
      nativeInputContainer,
      nativeScrollView,
      inputHeightPx
    );

    // Bridge callback: Kotlin → TypeScript
    const self = this;
    const callbackImpl =
      new org.nativescript.KeyboardAccessoryHelper.KeyboardStateCallback({
        onKeyboardHeightChanged(heightPx: number, isAnimating: boolean): void {
          // Per-frame during animation — handled by Kotlin (translationY + padding)
        },
        onKeyboardFullyShown(heightPx: number): void {
          self.handleKeyboardShown();
        },
        onKeyboardFullyHidden(): void {
          self.handleKeyboardHidden();
        },
        onRelayoutScrollContent(): void {
          self.relayoutScrollViewContent();
        },
      });

    this.helper.setup(callbackImpl);
  }

  setTextView(textView: TextView): void {
    this.textView = textView;
  }

  updateAccessoryHeight(): void {
    if (!this.helper || !this.textView) return;

    const nativeEditText = this.textView.android as android.widget.EditText;
    if (!nativeEditText) return;

    // Measure natural text height using Android's measure system
    const currentWidth = nativeEditText.getWidth();
    if (currentWidth <= 0) return;

    const widthSpec = android.view.View.MeasureSpec.makeMeasureSpec(
      currentWidth,
      android.view.View.MeasureSpec.EXACTLY
    );
    const heightSpec = android.view.View.MeasureSpec.makeMeasureSpec(
      0,
      android.view.View.MeasureSpec.UNSPECIFIED
    );
    nativeEditText.measure(widthSpec, heightSpec);
    const textHeightDip = Utils.layout.toDeviceIndependentPixels(
      nativeEditText.getMeasuredHeight()
    );

    const containerPadding = 16;
    let newHeight = textHeightDip + containerPadding;
    newHeight = Math.max(this.baseHeight, Math.min(newHeight, this.maxHeight));

    // Update native helper (pass pixels)
    this.helper.updateAccessoryHeight(Utils.layout.toDevicePixels(newHeight));
  }

  dismissKeyboard(): void {
    if (this.helper) {
      this.helper.dismissKeyboard();
    }
  }

  cleanup(): void {
    if (this.helper) {
      this.helper.cleanup();
      this.helper = null;
    }
    this.scrollViewView = null;
    this.nsInputContainer = null;
    this.textView = null;
  }

  // ──────────────────────────────────────────────
  // Scroll behavior (mirrors iOS logic)
  // ──────────────────────────────────────────────

  private handleKeyboardShown(): void {
    // Auto-scroll to bottom when keyboard appears
    if (!this.helper) return;

    // Small delay to let padding settle before scrolling
    setTimeout(() => {
      this.helper?.scrollToBottom();
    }, 50);
  }

  private handleKeyboardHidden(): void {
    // Clamp scroll position to valid range
    if (!this.helper) return;
    this.helper.clampScrollPosition();

    // Relayout to ensure correct content measurement
    this.relayoutScrollViewContent();
  }

  /**
   * Relayout ScrollView content after native padding changes.
   * Remeasures the NativeScript StackLayout and updates scroll dimensions.
   */
  public relayoutScrollViewContent(): void {
    if (this.isRelayoutingScrollView) return;
    if (!this.scrollViewView) return;

    this.isRelayoutingScrollView = true;

    try {
      const stackLayout = this.scrollViewView.content;
      if (!stackLayout) return;

      const nativeScrollView = this.scrollViewView
        .android as android.widget.ScrollView;
      if (!nativeScrollView) return;

      const width = nativeScrollView.getWidth();
      if (width <= 0) return;

      // Remeasure StackLayout with content-based height
      const widthSpec = Utils.layout.makeMeasureSpec(
        width,
        Utils.layout.EXACTLY
      );
      const heightSpec = Utils.layout.makeMeasureSpec(
        0,
        Utils.layout.UNSPECIFIED
      );

      stackLayout.measure(widthSpec, heightSpec);
      const measuredHeight = stackLayout.getMeasuredHeight();
      stackLayout.layout(0, 0, width, measuredHeight);
    } finally {
      this.isRelayoutingScrollView = false;
    }
  }
}
