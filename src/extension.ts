import * as vscode from 'vscode';
import { SidebarProvider } from './providers/sidebarProvider.js';

export function activate(context: vscode.ExtensionContext) {
    console.log('Cohere Agent is now active!');

    const sidebarProvider = new SidebarProvider(context.extensionUri, context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'cohere-agent-sidebar',
            sidebarProvider
        ),
        vscode.window.registerWebviewViewProvider(
            'cohere-agent-explorer-view',
            sidebarProvider
        ),
        vscode.window.registerWebviewViewProvider(
            'cohere-agent-panel-view',
            sidebarProvider
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cohere-agent.ask', () => {
            vscode.window.showInformationMessage('Ask Cohere anything in the sidebar!');
        }),
        vscode.commands.registerCommand('cohere-agent.inlineQuery', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('Please open a file to use Inline Edit.');
                return;
            }
            const selection = editor.document.getText(editor.selection);
            if (!selection) {
                vscode.window.showErrorMessage('Please select some code to edit.');
                return;
            }

            const prompt = await vscode.window.showInputBox({
                placeHolder: 'Describe the change (e.g., "Refactor this function", "Fix bug")',
                prompt: 'Cohere Inline Edit'
            });

            if (prompt) {
                await sidebarProvider.handleInlineRequest(prompt, selection, 'edit');
            }
        }),
        vscode.commands.registerCommand('cohere-agent.explain', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            const selection = editor.document.getText(editor.selection);
            if (selection) {
                await sidebarProvider.handleInlineRequest('Explain this code concisely.', selection, 'explain');
            }
        }),
        vscode.commands.registerCommand('cohere-agent.refactor', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            const selection = editor.document.getText(editor.selection);
            if (selection) {
                await sidebarProvider.handleInlineRequest('Refactor this code to strictly follow best practices and improve readability.', selection, 'refactor');
            }
        })
    );
}

export function deactivate() { }
