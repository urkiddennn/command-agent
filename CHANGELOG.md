# Changelog

All notable changes to the "Cohere Agent" extension will be documented in this file.

## [0.0.121] - 2026-02-19

### ✨ New Features
- **Secure API Key Storage**: API keys are now securely stored using VS Code's `SecretStorage` API, ensuring they persist safely across window reloads and sessions.
- **Token Usage Tracking**: Real-time display of input and output token usage in the sidebar footer, providing visibility into model consumption.
- **Visual Diff View Integration**: 
    - **Edit Verification**: When the agent modifies an existing file, a Diff Editor now opens automatically, allowing you to review and approve changes before they are applied.
    - **New File Verification**: Creating new files also triggers a diff view (against empty) for content verification.
- **Auto-Execution Workflow**: The "Process" button in the Planning phase now automatically switches the agent to "Execution" mode and begins the task, streamlining the user workflow.

### ⚡ Performance Improvements
- **Optimized Codebase Search**: Replaced the previous file-reading search method with VS Code's native `findTextInFiles` (powered by ripgrep), significantly improving search speed and reducing memory usage in large repositories.
- **Large Workspace Handling**: Implemented limits on file listing to prevent UI freezing when working in massive directories.

### 🐛 Bug Fixes
- **Tool Protocol Stability**: Fixed a critical `BadRequestError` in the Cohere V2 API integration where cancelled tool calls could break the conversation history. The agent now gracefully handles interruptions.
- **State Management**: Fixed duplicate state declarations in the Webview that caused rendering issues.
