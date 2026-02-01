/**
 * Copilot Bridge Server
 * 
 * This server uses the @github/copilot-sdk to communicate with Copilot
 * and exposes a simple HTTP API for the NativeScript app.
 * 
 * Run: node tools/copilot-bridge.mjs
 * Or: npm run copilot:bridge
 */
import { createServer } from 'http';
import { CopilotClient, defineTool } from '@github/copilot-sdk';
import { z } from 'zod';

const BRIDGE_PORT = 3210;

// State
let client = null;
const sessions = new Map(); // sessionId -> CopilotSession
const streamBuffers = new Map(); // sessionId -> { chunks: [], complete: false }

/**
 * Initialize the Copilot client
 */
async function initClient() {
  console.log('🚀 Starting Copilot Bridge Server...\n');
  console.log('📦 Initializing Copilot SDK client...');
  
  client = new CopilotClient({
    autoStart: true,
    logLevel: 'info',
  });
  
  await client.start();
  console.log('✅ Copilot client started');
  
  // Test connectivity
  try {
    const pong = await client.ping('bridge-test');
    console.log('✅ Ping successful:', pong.message);
  } catch (err) {
    console.error('❌ Ping failed:', err.message);
  }
}

/**
 * Parse request body
 */
async function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

/**
 * Send JSON response
 */
function sendJson(res, data, status = 200) {
  res.writeHead(status, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

/**
 * Create default tools for the session
 */
function createDefaultTools() {
  return [
    defineTool('get_weather', {
      description: 'Get current weather for a location',
      parameters: z.object({
        location: z.string().describe('City name or location'),
      }),
      handler: async ({ location }) => {
        // Mock weather data
        const weather = ['sunny', 'cloudy', 'rainy', 'partly cloudy'][Math.floor(Math.random() * 4)];
        const temp = Math.floor(Math.random() * 30) + 10;
        return {
          location,
          weather,
          temperature: `${temp}°C`,
          humidity: `${Math.floor(Math.random() * 50) + 30}%`,
        };
      },
    }),
    defineTool('calculate', {
      description: 'Perform mathematical calculations',
      parameters: z.object({
        expression: z.string().describe('Math expression to evaluate'),
      }),
      handler: async ({ expression }) => {
        try {
          // Safe eval for basic math
          const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
          const result = Function(`"use strict"; return (${sanitized})`)();
          return { expression, result: String(result) };
        } catch (err) {
          return { expression, error: err.message };
        }
      },
    }),
    defineTool('get_current_time', {
      description: 'Get the current date and time',
      parameters: z.object({
        timezone: z.string().optional().describe('Timezone (e.g., "America/New_York")'),
      }),
      handler: async ({ timezone }) => {
        const now = new Date();
        return {
          iso: now.toISOString(),
          local: now.toLocaleString('en-US', { timeZone: timezone || 'UTC' }),
          timezone: timezone || 'UTC',
        };
      },
    }),
  ];
}

/**
 * Create the HTTP bridge server
 */
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }
  
  console.log(`📥 ${req.method} ${path}`);
  
  try {
    // Health check
    if (path === '/health') {
      const state = client?.getState?.() || 'unknown';
      sendJson(res, { 
        status: 'ok', 
        clientState: state,
        sessions: sessions.size,
      });
      return;
    }
    
    // Create session
    if (path === '/session/create' && req.method === 'POST') {
      const body = await parseBody(req);
      
      console.log('📝 Creating session with model:', body.model || 'gpt-4.1');
      
      const session = await client.createSession({
        model: body.model || 'gpt-4.1',
        tools: createDefaultTools(),
        systemMessage: body.systemMessage ? { content: body.systemMessage } : undefined,
      });
      
      const sessionId = session.sessionId;
      sessions.set(sessionId, session);
      streamBuffers.set(sessionId, { chunks: [], toolCalls: [], complete: false, fullContent: '' });
      
      // Set up event listeners for streaming
      session.on('assistant.message_delta', (event) => {
        const buffer = streamBuffers.get(sessionId);
        const content = event.data?.deltaContent || '';
        console.log('📨 Delta chunk:', content.substring(0, 50));
        if (buffer && content) {
          buffer.chunks.push({
            id: Date.now().toString(),
            content: content,
          });
        }
      });
      
      session.on('assistant.message', (event) => {
        const buffer = streamBuffers.get(sessionId);
        const content = event.data?.content || '';
        console.log('📨 Full message received, length:', content.length);
        // Store the full content as fallback
        if (buffer) {
          buffer.fullContent = content;
        }
      });
      
      session.on('session.idle', () => {
        const buffer = streamBuffers.get(sessionId);
        console.log('✅ Session idle, chunks collected:', buffer?.chunks?.length || 0);
        if (buffer) {
          buffer.complete = true;
        }
      });
      
      // Listen to ALL events for debugging
      session.on((event) => {
        console.log('📡 Event:', event.type);
      });
      
      session.on('tool.execution_start', (event) => {
        console.log('🔧 Tool execution:', event.data?.toolName);
      });
      
      console.log('✅ Session created:', sessionId);
      sendJson(res, { sessionId, success: true });
      return;
    }
    
    // Send message to session
    if (path === '/session/send' && req.method === 'POST') {
      const body = await parseBody(req);
      const { sessionId, prompt } = body;
      
      const session = sessions.get(sessionId);
      if (!session) {
        sendJson(res, { error: 'Session not found' }, 404);
        return;
      }
      
      // Reset stream buffer for new message
      streamBuffers.set(sessionId, { chunks: [], toolCalls: [], complete: false });
      
      console.log('💬 Sending prompt to session:', sessionId);
      
      // Send message (async - don't wait for completion)
      session.send({ prompt }).catch(err => {
        console.error('❌ Send error:', err.message);
      });
      
      sendJson(res, { success: true, messageId: Date.now().toString() });
      return;
    }
    
    // Send message and wait for response
    if (path === '/session/send-and-wait' && req.method === 'POST') {
      const body = await parseBody(req);
      const { sessionId, prompt } = body;
      
      const session = sessions.get(sessionId);
      if (!session) {
        sendJson(res, { error: 'Session not found' }, 404);
        return;
      }
      
      console.log('💬 Sending prompt (waiting):', sessionId);
      
      try {
        const result = await session.sendAndWait({ prompt }, 120000);
        sendJson(res, { 
          success: true, 
          content: result?.data?.content || '',
        });
      } catch (err) {
        sendJson(res, { error: err.message }, 500);
      }
      return;
    }
    
    // Poll for stream chunks
    if (path === '/stream/poll' && req.method === 'POST') {
      const body = await parseBody(req);
      const { sessionId, lastChunkId } = body;
      
      const buffer = streamBuffers.get(sessionId);
      if (!buffer) {
        sendJson(res, { error: 'Session not found' }, 404);
        return;
      }
      
      // Get new chunks since lastChunkId
      let chunks = buffer.chunks;
      if (lastChunkId) {
        const idx = chunks.findIndex(c => c.id === lastChunkId);
        if (idx !== -1) {
          chunks = chunks.slice(idx + 1);
        }
      }
      
      // If complete but no chunks, use full content as fallback
      if (buffer.complete && chunks.length === 0 && buffer.fullContent) {
        console.log('📦 Using full content fallback, length:', buffer.fullContent.length);
        chunks = [{
          id: 'final',
          content: buffer.fullContent,
        }];
      }
      
      sendJson(res, {
        chunks,
        complete: buffer.complete,
        toolCalls: buffer.toolCalls,
      });
      return;
    }
    
    // Destroy session
    if (path === '/session/destroy' && req.method === 'POST') {
      const body = await parseBody(req);
      const { sessionId } = body;
      
      const session = sessions.get(sessionId);
      if (session) {
        await session.destroy();
        sessions.delete(sessionId);
        streamBuffers.delete(sessionId);
      }
      
      sendJson(res, { success: true });
      return;
    }
    
    // 404
    sendJson(res, { error: 'Not found' }, 404);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    sendJson(res, { error: err.message }, 500);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  
  // Destroy all sessions
  for (const [id, session] of sessions) {
    try {
      await session.destroy();
    } catch {}
  }
  
  // Stop client
  if (client) {
    try {
      await client.stop();
    } catch {}
  }
  
  server.close();
  process.exit(0);
});

// Start everything
(async () => {
  try {
    await initClient();
    
    server.listen(BRIDGE_PORT, () => {
      console.log(`\n🌉 Bridge server listening on http://localhost:${BRIDGE_PORT}`);
      console.log('\n✅ Ready for NativeScript app connections!');
    });
  } catch (err) {
    console.error('❌ Failed to start:', err.message);
    process.exit(1);
  }
})();
