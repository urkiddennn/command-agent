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
        })
    );
}

export function deactivate() { }
