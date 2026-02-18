# Cohere Agent (Alpha)

**Cohere Agent** is an autonomous AI systems engineer integrated directly into VS Code. Powered by Cohere's state-of-the-art Command models, it goes beyond simple code suggestions to plan, execute, and verify complex technical tasks across your entire codebase.

![Marketplace Banner](https://raw.githubusercontent.com/urkiddennn/command-agent/main/media/icon.png)

## 🚀 Core Capabilities

- **Autonomous Engineering**: Executes precise filesystem modifications, runs terminal commands, and audits code architectures.
- **Advanced Reasoning**: Leverages Cohere's reasoning-optimized models (like `command-r7b`) with real-time "Thinking" visualization.
- **Tool-Augmented Intelligence**: Seamlessly uses tools like `readFile`, `writeFile`, `editFile`, `runCommand`, and `searchFiles` to implement solutions.
- **High-Density UI**: Features a specialized "Engineering Industrialism" aesthetic (the Kiro.co design system) for professional developer productivity.
- **Context Awareness**: Efficiently processes codebase context and user mentions to stay relevant to your specific project.

## 🛠 Features

### 1. Collaborative Planning
Before any major change, Cohere Agent generates a detailed `planning.md` file. Review the technical approach, architecture decisions, and task breakdown before giving the signal to execute.

### 2. Multi-Mode Operation
- **Planning Mode**: Focuses on research and architectural mapping.
- **Execution Mode**: Actively modifies files and runs build/test loops to verify fixes.

### 3. Integrated Toolchain
The agent has a direct line to your local environment:
- **Filesystem**: Read, write, edit, and delete files.
- **Terminal**: Run `npm`, `git`, or custom build scripts via `runCommand`.
- **Search**: Perform deep pattern matching across files to find relevant logic.

### 4. Dual View Layout
Access the agent from the **Activity Bar** for quick sidebar chats or use the **Panel View** at the bottom for an expanded engineering workspace.

## 🎨 Aesthetic: Engineering Industrialism
Designed with a high-density, high-contrast aesthetic:
- **Signal Orange Accents**: High-visibility feedback for critical processing states.
- **Modular Grid**: Sharp 0px radius layout for maximum information density.
- **The Snap**: 100ms linear transitions for a tactile, responsive feel.

## ⚙️ Requirements

- A [Cohere API Key](https://dashboard.cohere.com/api-keys).
- VS Code version `1.80.0` or higher.

## 📦 Installation

1. Install the extension from the VS Code Marketplace.
2. Open the extension sidebar.
3. Enter your **Cohere API Key** in the settings panel.
4. Choose your preferred model (e.g., `command-r-plus` or `command-r7b-12-2024`).

## 📄 License

This project is licensed under the **ISC License**. See the [LICENSE.md](LICENSE.md) file for details.

---

*Note: This extension is currently in **Alpha**. Your support and feedback help improve the agent's reasoning and autonomy.*
