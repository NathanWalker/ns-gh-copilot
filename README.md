# NativeScript with GitHub Copilot SDK

Chat app built with **NativeScript**, integrating:
- **[@github/copilot-sdk](https://github.com/github/copilot-sdk)** - GitHub's Copilot SDK for AI interactions
- **[@nstudio/nstreamdown](https://nstreamdown.ai)** - Beautiful markdown rendering with real-time streaming support

https://github.com/user-attachments/assets/9684b282-c35e-49e6-9498-52f73131ea9a

## What's Included

### Custom AI Tools

The app includes several custom tools that GitHub Copilot can intelligently call:

1. **🌤️ Weather Lookup** - Get weather for any city
2. **🧮 Calculator** - Perform mathematical calculations
3. **⏰ Time Checker** - Get current date and time

### Smart Features

- **Quick Action Prompts** - Pre-configured prompts for common tasks
- **Streaming Responses** - See AI responses appear in real-time
- **Syntax Highlighting** - Beautiful code blocks with proper highlighting
- **Math Support** - LaTeX equations rendered natively
- **Interactive UI** - Smooth scrolling and typing experience

## Prerequisites

Before running the app, make sure you have:

1. **GitHub Copilot CLI** installed and authenticated:
   ```bash
   # Check if installed
   copilot --version
   
   # If not installed, follow: https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli
   ```

2. **NativeScript** environment set up:
   ```bash
   # Install NativeScript CLI globally
   npm install -g nativescript
   
   # Verify setup
   ns doctor
   ```

3. **Node.js 22+** installed

## Try it

```bash
# Run on iOS
npm run dev:ios:copilot

# Run on Android
npm run dev:android:copilot
```

## How to Use

1. **Launch the app** - Opens directly to the AI chat interface
2. **Try Quick Actions** - Tap any of the suggested prompts
3. **Ask Questions** - Type anything and watch the AI respond in real-time
4. **Explore Tools** - Ask about weather, time, or calculations
5. **See Markdown** - Request code examples or formatted content

### Example Prompts

Try these to see the app in action:

- "What's the weather in Tokyo?"
- "Calculate 123 * 456"
- "Show me a NativeScript Angular component example"
- "What time is it?"
- "Explain async/await with code examples"

## Architecture

### Components

- **AiChatComponent** - Main chat interface with message display
- **CopilotService** - Wraps GitHub Copilot SDK for easy Angular integration

### Key Files

- `/src/app/ai-chat/` - Chat component and template
- `/src/app/services/copilot.service.ts` - GitHub Copilot integration
- `/src/main.ts` - App bootstrap with nstreamdown registration

## Customization

### Add Custom Tools

Edit `/src/app/services/copilot.service.ts` to add new tools:

```typescript
defineTool('my_tool', {
  description: 'What your tool does',
  parameters: {
    type: 'object',
    properties: {
      param: { type: 'string', description: 'Parameter description' }
    },
    required: ['param']
  },
  handler: async (args) => {
    // Your tool logic here
    return { result: 'something' };
  }
})
```

### Customize System Prompt

In `copilot.service.ts`, modify the `systemMessage`:

```typescript
systemMessage: {
  content: 'Your custom AI personality and instructions...'
}
```

### Adjust nstreamdown Config

In `ai-chat.component.ts`, modify `streamdownConfig`:

```typescript
streamdownConfig: StreamdownConfig = {
  mode: 'streaming',
  codeTheme: 'github-dark', // or 'github-light', etc.
  // Add more config options
};
```

## Troubleshooting

### Copilot SDK Not Initializing

- Verify Copilot CLI is installed: `copilot --version`
- Check authentication: `copilot --status`
- Ensure internet connection

### Markdown Not Rendering

- Verify streamdown elements are registered in `main.ts`
- Check that `@nstudio/nstreamdown` is properly installed

### Build Errors

```bash
# Clean build
ns clean

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Learn More

- [GitHub Copilot SDK Documentation](https://github.com/github/copilot-sdk/blob/main/docs/getting-started.md)
- [nstreamdown Documentation](https://nstreamdown.ai/docs/getting-started)
- [NativeScript Documentation](https://docs.nativescript.org)

## Contributing

Feel free to experiment and share your improvements!

---

**Built with ❤️ using NativeScript, GitHub Copilot SDK, and @nstudio/nstreamdown**
