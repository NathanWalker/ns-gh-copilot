import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CopilotClientService, COPILOT_CONFIG, ToolDefinition } from './copilot-client.service';

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface StreamChunk {
  content: string;
  messageId: string;
}

@Injectable({
  providedIn: 'root',
})
export class CopilotService {
  private client = inject(CopilotClientService);
  private initialized = false;

  public stream$: Observable<StreamChunk> = this.client.stream$;
  public messageComplete$: Observable<string> = this.client.messageComplete$;

  get isInitialized(): boolean {
    return this.initialized && this.client.isConnected;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Register custom tools before creating session
    this.registerDefaultTools();

    console.log(`🔗 Connecting to Copilot CLI server at ${COPILOT_CONFIG.host}:${COPILOT_CONFIG.port}...`);
    
    try {
      // Connect to CLI server
      await this.client.connect();

      // Create a session with our tools
      await this.client.createSession({
        model: 'gpt-4.1',
        systemMessage:
          'You are a helpful AI assistant in a NativeScript mobile app. Be concise and friendly. ' +
          'When showing code examples, use TypeScript and NativeScript best practices. ' +
          'You can use your tools to get weather, perform calculations, and get the current time.',
      });

      this.initialized = true;
      console.log('✅ GitHub Copilot initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize GitHub Copilot:', error);
      throw error;
    }
  }

  async sendMessage(prompt: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Copilot not initialized. Call initialize() first.');
    }

    try {
      await this.client.sendMessage(prompt);
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    this.client.disconnect();
    this.initialized = false;
    console.log('✅ GitHub Copilot cleaned up');
  }

  /**
   * Register the default set of tools
   */
  private registerDefaultTools(): void {
    // Weather tool
    this.client.registerTool({
      name: 'get_weather',
      description: 'Get the current weather for a city',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'The city name' },
        },
        required: ['city'],
      },
      handler: async (args: { city: string }) => {
        const { city } = args;
        // Simulated weather data - in a real app, you'd call a weather API
        const conditions = ['sunny', 'cloudy', 'rainy', 'partly cloudy', 'stormy'];
        const temp = Math.floor(Math.random() * 30) + 50;
        const condition = conditions[Math.floor(Math.random() * conditions.length)];
        return { city, temperature: `${temp}°F`, condition };
      },
    });

    // Calculator tool
    this.client.registerTool({
      name: 'calculate',
      description: 'Perform mathematical calculations',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'Mathematical expression to evaluate' },
        },
        required: ['expression'],
      },
      handler: async (args: { expression: string }) => {
        try {
          // Safe evaluation using Function constructor instead of eval
          const result = Function('"use strict"; return (' + args.expression + ')')();
          return { expression: args.expression, result };
        } catch (error) {
          return { expression: args.expression, error: 'Invalid expression' };
        }
      },
    });

    // Time tool
    this.client.registerTool({
      name: 'get_time',
      description: 'Get the current time and date',
      parameters: {
        type: 'object',
        properties: {
          timezone: { type: 'string', description: 'Timezone (optional)' },
        },
      },
      handler: async (args: { timezone?: string }) => {
        const now = new Date();
        return {
          datetime: now.toISOString(),
          local: now.toLocaleString(),
          timestamp: now.getTime(),
        };
      },
    });
  }

  /**
   * Add a custom tool that Copilot can call
   */
  addCustomTool(tool: ToolDefinition): void {
    this.client.registerTool(tool);
  }
}
