import { Utils } from "@nativescript/core";
import { Subscription } from "rxjs";
import { CopilotService } from "../services/copilot.service";

/**
 * Callbacks an engine uses to stream a single response back to the UI.
 * `onContent` always receives the FULL accumulated content (not a delta),
 * so the component can simply set the message content each time.
 */
export interface StreamCallbacks {
  onContent: (fullContent: string) => void;
  onComplete: () => void;
  onError: (error: unknown) => void;
}

/**
 * A chat backend. The component talks to this and stays agnostic about
 * whether responses come from GitHub Copilot or Apple Foundation Models.
 */
export interface AiEngine {
  /** Human readable name, used for the welcome message + header. */
  readonly displayName: string;
  /** Avatar/branding image for this engine (NativeScript asset path). */
  readonly icon: string;
  initialize(): Promise<void>;
  sendMessage(prompt: string, callbacks: StreamCallbacks): Promise<void>;
  cleanup(): void;
}

/**
 * GitHub Copilot SDK engine (used on Android and as the cross-platform default).
 * Bridges the service's RxJS streams into the unified callback shape.
 */
export class CopilotEngine implements AiEngine {
  readonly displayName = "GitHub Copilot";
  readonly icon = "~/assets/gh-emoji.png";

  private subscriptions = new Subscription();
  private accumulated = "";
  private active: StreamCallbacks | null = null;

  constructor(private copilot: CopilotService) {}

  async initialize(): Promise<void> {
    await this.copilot.initialize();

    this.subscriptions.add(
      this.copilot.stream$.subscribe((chunk) => {
        if (!this.active) return;
        this.accumulated += chunk.content;
        this.active.onContent(this.accumulated);
      }),
    );

    this.subscriptions.add(
      this.copilot.messageComplete$.subscribe(() => {
        const active = this.active;
        this.active = null;
        active?.onComplete();
      }),
    );
  }

  async sendMessage(prompt: string, callbacks: StreamCallbacks): Promise<void> {
    this.accumulated = "";
    this.active = callbacks;
    try {
      // Response arrives via the stream/complete subscriptions above.
      await this.copilot.sendMessage(prompt);
    } catch (error) {
      this.active = null;
      callbacks.onError(error);
    }
  }

  cleanup(): void {
    this.subscriptions.unsubscribe();
    this.copilot.cleanup();
  }
}

/**
 * Apple Foundation Models engine (on-device, Apple platforms running iOS 26+).
 * `AI.shared.streamResponseFor` yields cumulative snapshots, which already
 * match the "full content" contract of StreamCallbacks.
 */
export class FoundationModelsEngine implements AiEngine {
  readonly displayName = "Apple Intelligence";
  readonly icon = "~/assets/apple-foundation-models.png";

  /** True only where the native FoundationModels APIs are available. */
  static isSupported(): boolean {
    return __APPLE__ && Utils.SDK_VERSION >= 26;
  }

  async initialize(): Promise<void> {
    // On-device model needs no connection/session setup.
  }

  async sendMessage(prompt: string, callbacks: StreamCallbacks): Promise<void> {
    try {
      AI.shared.streamResponseFor(
        prompt,
        (content) => callbacks.onContent(content || ""),
        (error) => {
          if (error) {
            callbacks.onError(error);
          } else {
            callbacks.onComplete();
          }
        },
      );
    } catch (error) {
      callbacks.onError(error);
    }
  }

  cleanup(): void {
    // Nothing to tear down.
  }
}

/**
 * Picks the right engine for the current platform/device.
 * Apple devices on iOS 26+ use on-device Foundation Models; everything
 * else falls back to the GitHub Copilot SDK.
 */
export function createAiEngine(copilot: CopilotService): AiEngine {
  if (FoundationModelsEngine.isSupported()) {
    return new FoundationModelsEngine();
  }
  return new CopilotEngine(copilot);
}
