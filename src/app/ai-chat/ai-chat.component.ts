import {
  Component,
  NO_ERRORS_SCHEMA,
  OnInit,
  OnDestroy,
  signal,
  computed,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  AfterViewInit,
  inject,
} from "@angular/core";
import { NativeScriptCommonModule } from "@nativescript/angular";
import {
  Dialogs,
  ScrollView,
  TextView,
  View,
  Page,
  EventData,
  AndroidOverflowInsetData,
} from "@nativescript/core";
import { Streamdown } from "@nstudio/nstreamdown/angular";
import type { StreamdownConfig } from "@nstudio/nstreamdown/angular";
import { CopilotService } from "../services/copilot.service";
import { AiEngine, createAiEngine } from "./ai-engine";
import { ThemeService } from "../services/theme.service";
import { InputAccessoryManager } from "@nativescript/input-accessory";
import { MenuSelectedEvent } from "@nstudio/nativescript-menu";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming: boolean;
}

@Component({
  selector: "ai-chat",
  templateUrl: "./ai-chat.component.html",
  imports: [NativeScriptCommonModule, Streamdown],
  schemas: [NO_ERRORS_SCHEMA],
})
export class AiChatComponent implements OnInit, OnDestroy, AfterViewInit {
  themeService = inject(ThemeService);
  @ViewChild("scrollView", { read: ElementRef }) scrollView?: ElementRef;
  @ViewChild("messageInput", { read: ElementRef }) messageInput?: ElementRef;
  @ViewChild("inputContainer", { read: ElementRef })
  inputContainer?: ElementRef;

  messages = signal<ChatMessage[]>([]);
  inputText = signal("");
  isMultiline = computed(
    () => this.inputText().includes("\n") || this.inputText().length > 40,
  );
  isLoading = signal(false);
  isInitialized = signal(false);
  // True only while waiting for the first chunk — once content starts
  // streaming into the bubble the shimmer placeholder should disappear.
  isAwaitingResponse = computed(() => {
    if (!this.isLoading()) return false;
    const last = this.messages()[this.messages().length - 1];
    return !!last && last.role === "assistant" && last.isStreaming && !last.content;
  });
  selectedModel = signal("v0-max");

  // Active chat backend (GitHub Copilot or Apple Foundation Models).
  engineName = signal("");
  assistantIcon = signal("~/assets/gh-emoji.png");

  page = inject(Page);
  addOptions = [
    {
      id: 1,
      name: "New Chat",
      icon: "square.and.pencil",
    },
    {
      id: 2,
      name: "Import from Drive",
      subtitle: "Login Required",
      icon: "cloud",
    },
    {
      id: 3,
      name: "Tiers",
      icon: "circle.dotted",
      singleSelection: true,
      children: [
        {
          id: 31,
          name: "Starter",
          subtitle: "Lean quickstart",
        },
        {
          id: 32,
          name: "Pro",
          subtitle: "Growing businesses",
        },
        {
          id: 33,
          name: "Enterprise",
          subtitle: "Maximum throughput",
          state: "on" as const,
        },
      ],
    },
    {
      id: 4,
      name: "Protocols",
      icon: "square.2.layers.3d",
      children: [
        {
          id: 41,
          name: "Add Protocol",
          icon: "plus",
        },
      ],
    },
    {
      id: 5,
      name: "",
      childrenStyle: "palette" as const,
      children: [
        { id: 51, name: "Camera", icon: "camera" },
        { id: 52, name: "Photos", icon: "photo" },
        { id: 53, name: "Files", icon: "folder" },
      ],
    },
  ];
  isApple = __APPLE__;

  private engine!: AiEngine;
  private currentStreamingMessageId = "";
  private keyboardAccessoryManager: InputAccessoryManager | null = null;
  private isAccessorySetup = false;
  private textView: TextView | null = null;

  // Quick action prompts
  quickPrompts = [
    {
      text: "🌤️ Weather in Seattle",
      prompt: "What's the weather like in Seattle?",
    },
    { text: "🧮 Calculate 123 × 456", prompt: "Calculate 123 * 456" },
    { text: "⏰ Current time", prompt: "What time is it now?" },
    {
      text: "💡 Code example",
      prompt: "Show me a simple NativeScript Angular component",
    },
  ];

  streamdownConfig: StreamdownConfig = {
    mode: "streaming",
  };
  inset = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    ime: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    cutout: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
  };

  constructor(
    private copilotService: CopilotService,
    private cdr: ChangeDetectorRef,
  ) {
    this.page.actionBarHidden = true;
    this.page.on("androidOverflowInset", (args: AndroidOverflowInsetData) => {
      const inset = args.inset;

      // store inset
      this.inset.top = inset.top;
      this.inset.right = inset.right;
      this.inset.bottom = inset.bottom;
      this.inset.left = inset.left;
      // ime can be used to handle the opening/closing of the keyboard
      // this.inset.ime.bottom = inset.imeBottom;

      // this.inset.cutout.top = inset.cutoutTop;
      // this.inset.cutout.right = inset.cutoutRight;
      // this.inset.cutout.bottom = inset.cutoutBottom;
      // this.inset.cutout.left = inset.cutoutLeft;

      // Mark edges as consumed so parents do not re-apply them
      inset.topConsumed = true;
      inset.rightConsumed = true;
      inset.bottomConsumed = true;
      inset.leftConsumed = true;
    });
  }

  async ngOnInit() {
    this.initAssistant();
  }

  ngAfterViewInit() {
    // Setup keyboard handling after views are ready (both platforms)
    setTimeout(() => this.setupKeyboardAccessory(), 100);
  }

  tapCloseKeyboard() {
    if (!this.keyboardAccessoryManager) return;
    this.keyboardAccessoryManager.dismissKeyboard();
  }

  private setupKeyboardAccessory() {
    if (this.isAccessorySetup) return;
    if (
      !this.inputContainer?.nativeElement ||
      !this.messageInput?.nativeElement ||
      !this.scrollView?.nativeElement ||
      !this.textView
    ) {
      // Views not ready yet, try again
      setTimeout(() => this.setupKeyboardAccessory(), 100);
      return;
    }

    this.isAccessorySetup = true;
    this.keyboardAccessoryManager = new InputAccessoryManager();

    this.keyboardAccessoryManager.setup({
      page: this.page,
      scrollView: this.scrollView.nativeElement as ScrollView,
      inputContainer: this.inputContainer.nativeElement as View,
      textView: this.textView,
      // baseHeight: 64
    });
  }

  selectOption(args: MenuSelectedEvent) {
    const option = args.data.option;
    console.log("Selected option:", option);
    switch (option.id) {
      case 1:
        // New Chat
        this.clearChat();
        break;
      case 2:
        // Import from GitHub
        break;
      case 31:
      case 32:
      case 33:
        // Model selection
        this.selectedModel.set(option.name);
        break;
      case 41:
        // Add MCP
        break;
    }
  }

  async initAssistant() {
    try {
      this.isLoading.set(true);

      // Pick the backend for this platform/device and initialize it.
      this.engine ??= createAiEngine(this.copilotService);
      this.engineName.set(this.engine.displayName);
      this.assistantIcon.set(this.engine.icon);
      await this.engine.initialize();
      this.isInitialized.set(true);

      // Add welcome message
      this.addMessage({
        id: Date.now().toString(),
        role: "assistant",
        content: `I'm an AI assistant powered by **${this.engine.displayName}** and rendered with **@nstudio/streamdown**.

## What I can do:

- 🌤️ Check weather for any city

- 🧮 Perform calculations

- ⏰ Tell you the current time

- 💻 Help with code examples

- 📱 Answer questions about NativeScript

Try the quick actions below or type your own message!`,
        isStreaming: false,
      });
    } catch (error) {
      console.error("Failed to initialize:", error);
      this.addMessage({
        id: Date.now().toString(),
        role: "assistant",
        content: `⚠️ **Error**: Failed to initialize ${this.engine?.displayName ?? "the AI engine"}.

${error}`,
        isStreaming: false,
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  ngOnDestroy() {
    this.engine?.cleanup();

    // Clean up keyboard accessory manager
    if (!this.keyboardAccessoryManager) return;
    this.keyboardAccessoryManager.cleanup();
  }

  onTextChange(args: EventData) {
    const textView = args.object as TextView;
    this.inputText.set(textView.text);

    // Trigger accessory view height update if needed
    if (!this.keyboardAccessoryManager) return;
    this.keyboardAccessoryManager.updateAccessoryHeight();
  }

  onTextViewLoaded(args: EventData) {
    this.textView = args.object as TextView;
    // iOS UITextView configuration (scrollEnabled, textContainerInset)
    // is handled by the @nativescript/input-accessory plugin in setup()
  }

  async sendMessage(customPrompt?: string) {
    const text = customPrompt || this.inputText();
    if (!text.trim() || this.isLoading()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      isStreaming: false,
    };
    this.addMessage(userMessage);

    // Clear input
    this.inputText.set("");
    if (this.messageInput?.nativeElement) {
      (this.messageInput.nativeElement as TextView).text = "";
    }

    // Create placeholder for assistant response
    this.currentStreamingMessageId = (Date.now() + 1).toString();
    this.addMessage({
      id: this.currentStreamingMessageId,
      role: "assistant",
      content: "",
      isStreaming: true,
    });

    this.isLoading.set(true);

    // Route through the active engine. Each engine streams the FULL
    // accumulated content via onContent, so we just set it on the message.
    const messageId = this.currentStreamingMessageId;
    await this.engine.sendMessage(text.trim(), {
      onContent: (content) => {
        this.updateMessageContent(messageId, content, true);
        // Animate so the view glides with the stream instead of jumping.
        this.scrollToBottom(true);
      },
      onComplete: () => {
        this.updateMessageContent(
          messageId,
          this.messages().find((m) => m.id === messageId)?.content ?? "",
          false,
        );
        this.isLoading.set(false);
      },
      onError: (error) => {
        console.error("Error sending message:", error);
        this.updateMessageContent(messageId, `⚠️ **Error** ${error}`, false);
        this.isLoading.set(false);
      },
    });
  }

  onQuickPrompt(prompt: string) {
    this.sendMessage(prompt);
  }

  private addMessage(message: ChatMessage) {
    this.messages.update((messages) => [...messages, message]);
    setTimeout(() => this.scrollToBottom(), 100);
  }

  private updateMessageContent(
    id: string,
    content: string,
    isStreaming: boolean,
  ) {
    const messages = this.messages();
    const msg = messages.find((m) => m.id === id);
    if (msg) {
      msg.content = content;
      msg.isStreaming = isStreaming;
      this.messages.set([...messages]);
      this.cdr.detectChanges();
    }
  }

  private scrollToBottom(animated = false) {
    if (this.scrollView?.nativeElement) {
      const scrollView = this.scrollView.nativeElement as ScrollView;
      setTimeout(() => {
        scrollView.scrollToVerticalOffset(scrollView.scrollableHeight, animated);
      }, 50);
    }
  }

  clearChat() {
    Dialogs.confirm({
      title: "Clear Chat",
      message: "Are you sure you want to clear the chat history?",
      okButtonText: "Yes",
      cancelButtonText: "No",
    }).then((ok) => {
      if (ok) {
        this.messages.set([]);
        this.initAssistant();
      }
    });
  }

  getMessageConfig(message: ChatMessage): StreamdownConfig {
    return {
      ...this.streamdownConfig,
      mode: message.isStreaming ? "streaming" : "static",
    };
  }
}
