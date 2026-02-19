import * as vscode from 'vscode';
import { CohereProvider } from '../services/cohereProvider.js';
import { ToolHandler } from '../services/toolHandler.js';

export class SidebarProvider implements vscode.WebviewViewProvider {
    private cohere: CohereProvider;
    private _lastMessages: any[] = [];

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {
        this.cohere = new CohereProvider();
    }

    public async resolveWebviewView(
        webviewView: vscode.WebviewView
    ) {

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        // Retain context when hidden to prevent state loss
        webviewView.description = "Coding Agent";
        (webviewView as any).retainContextWhenHidden = true;

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Load API Key from secure storage
        let apiKey = '';
        try {
            apiKey = await this._context.secrets.get('cohereApiKey') || '';
        } catch (e) {
            console.error('Error loading API key from secrets:', e);
        }

        const settings = this.cohere.getSettings();
        // Override with secure key if available
        if (apiKey) {
            settings.apiKey = apiKey;
            this.cohere.setSettings(apiKey, settings.memoryType);
        }

        // Send initial settings
        webviewView.webview.postMessage({
            type: 'init-settings',
            value: settings
        });

        // Load correct history based on current memory selection
        this._loadHistory(webviewView, settings.memoryType);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'webview-ready': {
                    console.log('Cohere Agent: Webview ready signal received');
                    // When a view is ready, send it the current buffer or persistent history
                    const settings = this.cohere.getSettings();
                    this._loadHistory(webviewView, settings.memoryType);
                    break;
                }
                case 'user-message': {
                    // Update local buffer immediately for sync across views
                    this._lastMessages.push({ role: 'user', content: data.value });

                    await this.cohere.generateResponse(data.value, data.mode || 'Planning', data.model, (update) => {
                        // update is { text, thought, progress }
                        // Update the last bot message in the buffer (text only for history)
                        const lastMsg = this._lastMessages[this._lastMessages.length - 1];
                        if (lastMsg && lastMsg.role === 'bot') {
                            lastMsg.content = update.text;
                        } else {
                            this._lastMessages.push({ role: 'bot', content: update.text });
                        }

                        // Send full structured update to webview
                        webviewView.webview.postMessage({
                            type: 'cohere-response',
                            value: update
                        });
                    }, (planContent: string) => {
                        webviewView.webview.postMessage({
                            type: 'plan-ready',
                            value: planContent
                        });
                    });
                    break;
                }
                case 'execute-plan': {
                    const plan = data.value;
                    this.cohere.executePlan(plan, (data) => {
                        webviewView.webview.postMessage({
                            type: 'cohere-response',
                            value: data
                        });
                    });
                    break;
                }
                case 'save-history': {
                    this._lastMessages = data.value; // Sync buffer with webview's state
                    const currentSettings = this.cohere.getSettings();
                    if (currentSettings.memoryType === 'cache') {
                        await this._context.globalState.update('cohere-chat-history-global', data.value);
                    } else {
                        await this._context.workspaceState.update('cohere-chat-history-local', data.value);
                    }
                    break;
                }
                case 'clear-chat': {
                    this._lastMessages = [];
                    this.cohere.clearHistory();
                    break;
                }
                case 'update-settings': {
                    try {
                        await this._context.secrets.store('cohereApiKey', data.value.apiKey);
                    } catch (err) {
                        console.error('SidebarProvider: Failed to store API key in secrets:', err);
                    }
                    this.cohere.setSettings(data.value.apiKey, data.value.memoryType);
                    // Clear buffer and re-load history if memory type changed
                    this._lastMessages = [];
                    this._loadHistory(webviewView, data.value.memoryType);
                    vscode.window.showInformationMessage(`Settings updated: ${data.value.memoryType} mode active.`);
                    break;
                }
                case 'get-files': {
                    const files = await ToolHandler.getAllFiles();
                    webviewView.webview.postMessage({ type: 'file-list', value: files });
                    break;
                }
                case 'show-info': {
                    vscode.window.showInformationMessage(data.value);
                    break;
                }
                case 'cancel-generation': {
                    this.cohere.cancelGeneration();
                    break;
                }
                case 'open-plan': {
                    const planContent = data.value;
                    const document = await vscode.workspace.openTextDocument({
                        content: planContent,
                        language: 'markdown'
                    });
                    await vscode.window.showTextDocument(document);
                    break;
                }
            }
        });
    }

    private _loadHistory(webviewView: vscode.WebviewView, memoryType: string) {
        // Prefer the live buffer for syncing across Activity Bar/Explorer/Panel
        let history = this._lastMessages;

        if (history.length === 0) {
            history = memoryType === 'cache'
                ? this._context.globalState.get<any[]>('cohere-chat-history-global', [])
                : this._context.workspaceState.get<any[]>('cohere-chat-history-local', []);
            this._lastMessages = history;
        }

        // Sync history to Cohere agent to restore context (and system prompt)
        this.cohere.setHistory(history);

        webviewView.webview.postMessage({
            type: 'load-history',
            value: history
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.css'));
        const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'icon.svg'));

        const nonce = getNonce();

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
				<link href="${styleUri}" rel="stylesheet">
				<title>Cohere Agent</title>
                <script nonce="${nonce}">
                    window.vsCodeIcon = "${iconUri}";
                </script>
			</head>
			<body>
				<div id="root"></div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
    }
    public async handleInlineRequest(prompt: string, selection: string, operation: 'refactor' | 'explain' | 'edit') {
        if (!selection) {
            vscode.window.showErrorMessage('No code selected!');
            return;
        }

        const systemPrompt = `You are an expert coding assistant.
You are performing the following operation: ${operation.toUpperCase()}.
User Prompt: ${prompt}

CODE CONTEXT:
\`\`\`
${selection}
\`\`\`

INSTRUCTIONS:
- If operation is 'refactor' or 'edit': Return ONLY the modified code. Do not include markdown formatting or explanations unless asked. The output will be directly diffed against the original.
- If operation is 'explain': Return a concise explanation of the code.

Produce the output now.`;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Cohere: ${operation === 'edit' ? 'Thinking...' : operation + 'ing...'}`,
            cancellable: true
        }, async (progress, token) => {
            let fullText = '';
            await this.cohere.generateResponse(systemPrompt, 'Execution', undefined, (update) => {
                fullText = update.text;
            }, undefined, true); // true for "inline" mode if we add that flag, or just use standard generation with prompt engineering

            // Post-processing
            if (operation === 'explain') {
                // Show in a new output channel or information message
                const channel = vscode.window.createOutputChannel("Cohere Explanation");
                channel.appendLine(fullText);
                channel.show();
            } else {
                // Edit/Refactor -> Open Diff
                // Extract code block if wrapped in markdown
                const codeBlockRegex = /```[\s\S]*?\n([\s\S]*?)\n```/;
                const match = fullText.match(codeBlockRegex);
                const cleanCode = match ? match[1] : fullText;

                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    await ToolHandler.applyEditWithDiff(editor.document.uri, cleanCode, editor.selection);
                }
            }
        });
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
