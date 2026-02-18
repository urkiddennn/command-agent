import * as vscode from 'vscode';

export async function getWorkspaceContext(): Promise<string> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) {
        return 'No workspace folders open.';
    }

    let context = 'Current Workspace Context:\n';
    for (const folder of folders) {
        context += `Folder: ${folder.name}\n`;

        const files = await vscode.workspace.fs.readDirectory(folder.uri);
        context += 'Files: ' + files.map(f => f[0]).join(', ') + '\n';
    }

    return context;
}

export async function getActiveFileContent(): Promise<string | null> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return null;
    }
    return editor.document.getText();
}
