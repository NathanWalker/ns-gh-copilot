import { View, TextView, ScrollView } from "@nativescript/core";

export class KeyboardAccessoryManager {
  /**
   * Set up keyboard accessory behavior.
   * @param viewController UIViewController (iOS) or unused (Android)
   * @param inputContainer The NativeScript View containing the input bar
   * @param scrollView Native scroll view (UIScrollView on iOS, android.widget.ScrollView on Android)
   * @param scrollViewView NativeScript ScrollView wrapper
   * @param textView NativeScript TextView for the message input
   */
  setup(
    viewController: any,
    inputContainer: View,
    scrollView: any,
    scrollViewView: ScrollView,
    textView: TextView
  ): void;

  /**
   * Update the accessory height when text content changes (multi-line growth).
   */
  updateAccessoryHeight(): void;

  /**
   * Dismiss the keyboard programmatically.
   */
  dismissKeyboard(): void;

  /**
   * Clean up all listeners, restore original state.
   */
  cleanup(): void;

  /**
   * Relayout ScrollView content after native frame/padding changes.
   * Remeasures the NativeScript StackLayout and updates contentSize/contentHeight.
   */
  relayoutScrollViewContent(): void;
}
