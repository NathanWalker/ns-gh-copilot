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
} from "@nativescript/core";
import { Streamdown } from "@nstudio/nstreamdown/angular";
import type { StreamdownConfig } from "@nstudio/nstreamdown/angular";
import { CopilotService } from "../services/copilot.service";
import { ThemeService } from "../services/theme.service";
import { Subscription } from "rxjs";
import { KeyboardAccessoryManager } from "./keyboard-accessory";
import { MenuSelectedEvent } from "../menus";

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
  isMultiLine = computed(
    () => this.inputText().includes("\n") || this.inputText().length > 40,
  );
  isLoading = signal(false);
  isInitialized = signal(false);
  selectedModel = signal("v0-max");
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

  private subscriptions = new Subscription();
  private currentStreamingMessageId = "";
  private nativeScrollView: UIScrollView | null = null;
  private keyboardAccessoryManager: KeyboardAccessoryManager | null = null;
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

  constructor(
    private copilotService: CopilotService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    this.initAssistant();
  }

  ngAfterViewInit() {
    if (__APPLE__) {
      // Setup keyboard handling after views are ready
      setTimeout(() => this.setupKeyboardAccessory(), 100);
    }
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
      !this.nativeScrollView
    ) {
      // Views not ready yet, try again
      setTimeout(() => this.setupKeyboardAccessory(), 100);
      return;
    }

    this.isAccessorySetup = true;
    this.keyboardAccessoryManager = new KeyboardAccessoryManager();

    const inputContainerView = this.inputContainer.nativeElement as View;
    const scrollViewView = this.scrollView.nativeElement as ScrollView;
    const viewController = this.page.viewController as UIViewController;

    // Setup keyboard handling with inputAccessoryView
    this.keyboardAccessoryManager.setup(
      viewController,
      inputContainerView,
      this.nativeScrollView,
      scrollViewView,
      this.textView,
    );
  }

  onScrollViewLoaded(args: any) {
    if (__APPLE__) {
      const scrollView = args.object as ScrollView;
      this.nativeScrollView = scrollView.ios as UIScrollView;
    }
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
      await this.copilotService.initialize();
      this.isInitialized.set(true);

      // Subscribe to streaming chunks
      this.subscriptions.add(
        this.copilotService.stream$.subscribe((chunk) => {
          this.handleStreamChunk(chunk.content);
        }),
      );

      // Subscribe to message completion
      this.subscriptions.add(
        this.copilotService.messageComplete$.subscribe(() => {
          this.handleStreamComplete();
        }),
      );

      // Add welcome message
      this.addMessage({
        id: Date.now().toString(),
        role: "assistant",
        content: `I'm an AI assistant powered by **GitHub Copilot SDK** and rendered with **@nstudio/streamdown**.

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
        content: `⚠️ **Error**: Failed to initialize GitHub Copilot SDK. 

Please make sure you have:
1. GitHub Copilot CLI installed
2. Authenticated
3. Internet connection

${error}`,
        isStreaming: false,
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    this.copilotService.cleanup();

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
    if (__APPLE__) {
      this.textView = args.object as TextView;
      const nativeTextView = this.textView.ios as UITextView;

      // Configure for auto-growing
      nativeTextView.scrollEnabled = false; // Allows auto-sizing
      nativeTextView.textContainerInset = new UIEdgeInsets({
        top: 10,
        left: 10,
        bottom: 10,
        right: 10,
      });
    }
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

    try {
      // This just sends the message - response comes via stream events
      await this.copilotService.sendMessage(text.trim());
      // Note: isLoading stays true until handleStreamComplete is called
    } catch (error) {
      console.error("Error sending message:", error);
      this.updateMessageContent(
        this.currentStreamingMessageId,
        `⚠️ **Error** ${error}`,
        false,
      );
      this.isLoading.set(false); // Only set false on error
    }
  }

  onQuickPrompt(prompt: string) {
    this.sendMessage(prompt);
  }

  private handleStreamChunk(content: string) {
    const messages = this.messages();
    const currentMsg = messages.find(
      (m) => m.id === this.currentStreamingMessageId,
    );

    if (currentMsg) {
      currentMsg.content += content;
      this.messages.set([...messages]);
      this.scrollToBottom();
      this.cdr.detectChanges();
    }
  }

  private handleStreamComplete() {
    const messages = this.messages();
    const currentMsg = messages.find(
      (m) => m.id === this.currentStreamingMessageId,
    );

    if (currentMsg) {
      currentMsg.isStreaming = false;
      this.messages.set([...messages]);
      this.cdr.detectChanges();
    }

    // Stop loading when stream is complete
    this.isLoading.set(false);
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

  private scrollToBottom() {
    if (this.scrollView?.nativeElement) {
      const scrollView = this.scrollView.nativeElement as ScrollView;
      setTimeout(() => {
        scrollView.scrollToVerticalOffset(scrollView.scrollableHeight, false);
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
