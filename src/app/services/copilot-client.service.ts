/**
 * Lightweight Copilot CLI Client for NativeScript
 * 
 * The Copilot CLI server uses JSON-RPC over TCP sockets (not WebSocket).
 * Since NativeScript on iOS/Android can't directly use TCP sockets in the same way,
 * we need a bridge server that exposes HTTP endpoints.
 * 
 * This client communicates via HTTP with a simple bridge server that forwards
 * requests to the Copilot CLI.
 * 
 * Run: npm run copilot:bridge (starts CLI + bridge server)
 */
import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { Http } from '@nativescript/core';

export interface StreamChunk {
  content: string;
  messageId: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
  handler: (args: any) => Promise<any>;
}

/**
 * Configuration for the Copilot bridge server connection.
 */
export const COPILOT_CONFIG = {
  // For iOS Simulator: use localhost
  // For Android Emulator: use 10.0.2.2 (maps to host localhost)
  // For physical devices: use your machine's local IP
  host: 'localhost',
  port: 3210, // Bridge server port (different from CLI port 4321)
};

@Injectable({
  providedIn: 'root',
})
export class CopilotClientService {
  private sessionId: string | null = null;
  private tools = new Map<string, ToolDefinition>();
  private pollingInterval: any = null;

  private streamSubject = new Subject<StreamChunk>();
  private messageCompleteSubject = new Subject<string>();
  private connectionSubject = new Subject<'connected' | 'disconnected' | 'error'>();

  public stream$: Observable<StreamChunk> = this.streamSubject.asObservable();
  public messageComplete$: Observable<string> = this.messageCompleteSubject.asObservable();
  public connection$: Observable<'connected' | 'disconnected' | 'error'> = this.connectionSubject.asObservable();

  private _isConnected = false;
  get isConnected(): boolean {
    return this._isConnected;
  }

  private get baseUrl(): string {
    return `http://${COPILOT_CONFIG.host}:${COPILOT_CONFIG.port}`;
  }

  /**
   * Connect to the Copilot bridge server
   */
  async connect(): Promise<void> {
    if (this._isConnected) {
      console.log('📡 Already connected, skipping...');
      return;
    }

    console.log(`🔗 Connecting to Copilot bridge server at ${this.baseUrl}...`);

    try {
      // Test connection with a health check
      const response = await Http.request({
        url: `${this.baseUrl}/health`,
        method: 'GET',
        timeout: 5000,
      });

      if (response.statusCode === 200) {
        console.log('✅ Connected to Copilot bridge server');
        this._isConnected = true;
        this.connectionSubject.next('connected');
      } else {
        throw new Error(`Health check failed: ${response.statusCode}`);
      }
    } catch (error) {
      console.error('❌ Failed to connect to bridge server:', error);
      console.error('💡 Make sure to run: npm run copilot:bridge');
      this._isConnected = false;
      this.connectionSubject.next('error');
      throw error;
    }
  }

  /**
   * Initialize a new session with the Copilot CLI
   */
  async createSession(options: {
    model?: string;
    systemMessage?: string;
  } = {}): Promise<void> {
    const toolSchemas = Array.from(this.tools.values()).map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    console.log('📝 Creating session...');

    const response = await Http.request({
      url: `${this.baseUrl}/session/create`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      content: JSON.stringify({
        model: options.model || 'gpt-4.1',
        streaming: true,
        tools: toolSchemas,
        systemMessage: options.systemMessage,
      }),
      timeout: 30000,
    });

    const result = response.content.toJSON();
    
    if (result.error) {
      throw new Error(result.error);
    }

    this.sessionId = result.sessionId;
    console.log(`✅ Session created: ${this.sessionId}`);
  }

  /**
   * Send a message and stream the response
   */
  async sendMessage(prompt: string): Promise<void> {
    if (!this.sessionId) {
      throw new Error('No session created. Call createSession() first.');
    }

    console.log('💬 Sending message:', prompt);

    // Start polling for stream chunks BEFORE sending
    this.startPolling();

    try {
      const response = await Http.request({
        url: `${this.baseUrl}/session/send`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        content: JSON.stringify({
          sessionId: this.sessionId,
          prompt,
        }),
        timeout: 10000, // Just wait for acknowledgment
      });

      const result = response.content.toJSON();

      if (result.error) {
        this.stopPolling();
        throw new Error(result.error);
      }

      console.log('📤 Message sent, polling for response...');
      // Polling continues until complete flag is received
    } catch (error) {
      this.stopPolling();
      throw error;
    }
  }

  private lastChunkId: string | null = null;

  private startPolling(): void {
    this.lastChunkId = null;
    
    // Poll for streaming updates every 200ms
    this.pollingInterval = setInterval(async () => {
      try {
        const response = await Http.request({
          url: `${this.baseUrl}/stream/poll`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          content: JSON.stringify({
            sessionId: this.sessionId,
            lastChunkId: this.lastChunkId,
          }),
          timeout: 5000,
        });

        const result = response.content.toJSON();
        
        if (result.chunks && result.chunks.length > 0) {
          for (const chunk of result.chunks) {
            this.streamSubject.next({ content: chunk.content, messageId: chunk.id || 'chunk' });
            this.lastChunkId = chunk.id;
          }
        }

        // Handle tool calls
        if (result.toolCalls && result.toolCalls.length > 0) {
          for (const toolCall of result.toolCalls) {
            await this.handleToolCall(toolCall);
          }
        }

        // Check if response is complete
        if (result.complete) {
          console.log('✅ Response complete');
          this.stopPolling();
          this.messageCompleteSubject.next('complete');
        }
      } catch (error) {
        console.log('⚠️ Polling error:', error);
        // Don't stop on errors, might be temporary
      }
    }, 200);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Register a custom tool that Copilot can call
   */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Disconnect from the bridge server
   */
  disconnect(): void {
    this.stopPolling();
    this._isConnected = false;
    this.sessionId = null;
  }

  private async handleToolCall(toolCall: any): Promise<void> {
    const { callId, name, arguments: args } = toolCall;
    const tool = this.tools.get(name);

    if (!tool) {
      console.error(`Unknown tool: ${name}`);
      return;
    }

    try {
      const result = await tool.handler(JSON.parse(args || '{}'));
      
      // Send tool result back to bridge
      await Http.request({
        url: `${this.baseUrl}/tool/result`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        content: JSON.stringify({
          sessionId: this.sessionId,
          callId,
          result: JSON.stringify(result),
        }),
        timeout: 10000,
      });
    } catch (error) {
      console.error(`Tool ${name} error:`, error);
    }
  }
}
