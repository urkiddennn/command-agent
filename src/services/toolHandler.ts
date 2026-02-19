import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
export class ToolHandler {
    /**
     * Reads the content of a file within the workspace.
     */
    public static async readFile(filePath: string): Promise<string> {
        console.log(`ToolHandler: readFile called for ${filePath}`);
        const fullPath = this.resolvePath(filePath);
        if (!fullPath) {
            console.error('ToolHandler: No workspace open.');
            return 'Error: No workspace open.';
        }

        try {
            const data = await vscode.workspace.fs.readFile(fullPath);
            return Buffer.from(data).toString('utf8');
        } catch (error: any) {
            return `Error reading file: ${error.message}`;
        }
    }

    /**
     * Writes content to a file. Overwrites if it exists.
     */
    public static async writeFile(filePath: string, content: string): Promise<string> {
        console.log(`ToolHandler: writeFile called for ${filePath}`);
        const fullPath = this.resolvePath(filePath);
        if (!fullPath) {
            console.error('ToolHandler: No workspace open.');
            return 'Error: No workspace open.';
        }

        try {
            // ALWAYS propose change via Diff View (even for new files)
            const approved = await this.proposeChange(filePath, content);
            if (!approved) {
                return `Action cancelled: User rejected the changes to ${filePath}.`;
            }

            const data = Buffer.from(content, 'utf8');
            await vscode.workspace.fs.writeFile(fullPath, data);
            this.fileCache = null; // Invalidate cache
            return `Successfully wrote to ${filePath}`;
        } catch (error: any) {
            return `Error writing file: ${error.message}`;
        }
    }

    /**
     * Lists files and directories in a given path.
     */
    public static async listDirectory(dirPath: string = '.'): Promise<string> {
        console.log(`ToolHandler: listDirectory called for ${dirPath}`);
        const fullPath = this.resolvePath(dirPath);
        if (!fullPath) {
            console.error('ToolHandler: No workspace open.');
            return 'Error: No workspace open.';
        }

        try {
            const entries = await vscode.workspace.fs.readDirectory(fullPath);
            return entries.map(([name, type]) => {
                const typeStr = type === vscode.FileType.Directory ? '[DIR]' : '[FILE]';
                return `${typeStr} ${name}`;
            }).join('\n');
        } catch (error: any) {
            return `Error listing directory: ${error.message}`;
        }
    }

    /**
     * Creates a directory.
     */
    public static async createDirectory(dirPath: string): Promise<string> {
        console.log(`ToolHandler: createDirectory called for ${dirPath}`);
        const fullPath = this.resolvePath(dirPath);
        if (!fullPath) {
            console.error('ToolHandler: No workspace open.');
            return 'Error: No workspace open.';
        }

        try {
            await vscode.workspace.fs.createDirectory(fullPath);
            this.fileCache = null; // Invalidate cache
            return `Successfully created directory: ${dirPath}`;
        } catch (error: any) {
            return `Error creating directory: ${error.message}`;
        }
    }

    /**
     * Executes a shell command in the workspace root.
     * Captures stdout and stderr. Has a 30s timeout for safety.
     */
    public static async runCommand(command: string): Promise<string> {
        console.log(`ToolHandler: runCommand called: ${command}`);
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return 'Error: No workspace open.';
        }

        const cwd = workspaceFolders[0].uri.fsPath;

        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd,
                timeout: 30000, // 30 second timeout
                maxBuffer: 1024 * 1024, // 1MB output buffer
            });

            let output = '';
            if (stdout) output += stdout;
            if (stderr) output += (output ? '\n--- stderr ---\n' : '') + stderr;

            // Trim very long output
            if (output.length > 5000) {
                output = output.substring(0, 5000) + '\n... (output truncated)';
            }

            return output || '(Command completed with no output)';
        } catch (error: any) {
            // exec errors include the stderr in the error object
            const output = error.stdout || '';
            const errMsg = error.stderr || error.message;
            return `Command failed (exit code ${error.code || '?'}):\n${output}\n${errMsg}`.trim();
        }
    }

    /**
     * Searches for a text pattern across workspace files using VS Code's native search (ripgrep).
     * Returns matching lines with file paths and line numbers.
     */
    public static async searchFiles(query: string, filePattern: string = '**/*'): Promise<string> {
        console.log(`ToolHandler: searchFiles called for "${query}" in ${filePattern}`);
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return 'Error: No workspace open.';
        }

        try {
            const results: string[] = [];

            // Use findTextInFiles for faster, low-memory search
            // Cast to any because @types/vscode seems to be missing this stable API definition in the current setup
            await (vscode.workspace as any).findTextInFiles(
                { pattern: query, isCaseSensitive: false, isRegex: true },
                {
                    include: new vscode.RelativePattern(workspaceFolders[0], filePattern),
                    exclude: '**/node_modules/**,**/.git/**,**/dist/**,**/out/**'
                },
                (result: any) => {
                    // Start collecting results
                    if (results.length >= 50) return;

                    if (result.uri) { // result is TextSearchMatch
                        const relativePath = vscode.workspace.asRelativePath(result.uri);
                        // result.ranges[0] gives the first match on the line
                        const lineNum = result.ranges[0].start.line + 1;
                        const lineText = result.preview.text.trim();
                        results.push(`${relativePath}:${lineNum}: ${lineText}`);
                    }
                }
            );

            return results.length > 0
                ? results.join('\n')
                : `No matches found for "${query}"`;
        } catch (error: any) {
            return `Error searching files: ${error.message}`;
        }
    }

    /**
     * Deletes a file or directory from the workspace.
     */
    public static async deleteFile(filePath: string): Promise<string> {
        console.log(`ToolHandler: deleteFile called for ${filePath}`);
        const fullPath = this.resolvePath(filePath);
        if (!fullPath) {
            return 'Error: No workspace open.';
        }

        try {
            await vscode.workspace.fs.delete(fullPath, { recursive: true, useTrash: true });
            this.fileCache = null; // Invalidate cache
            return `Successfully deleted: ${filePath}`;
        } catch (error: any) {
            return `Error deleting ${filePath}: ${error.message}`;
        }
    }

    /**
     * Edits a file by replacing the first occurrence of target text with replacement text.
     * Enables targeted edits without rewriting entire files.
     */
    public static async editFile(filePath: string, target: string, replacement: string): Promise<string> {
        console.log(`ToolHandler: editFile called for ${filePath}`);
        const fullPath = this.resolvePath(filePath);
        if (!fullPath) {
            return 'Error: No workspace open.';
        }

        try {
            const data = await vscode.workspace.fs.readFile(fullPath);
            const content = Buffer.from(data).toString('utf8');

            if (!content.includes(target)) {
                return `Error: Target text not found in ${filePath}. The exact text to replace was not found.`;
            }

            const newContent = content.replace(target, replacement);

            // Propose change via Diff View
            const approved = await this.proposeChange(filePath, newContent);
            if (!approved) {
                return `Action cancelled: User rejected the edits to ${filePath}.`;
            }

            await vscode.workspace.fs.writeFile(fullPath, Buffer.from(newContent, 'utf8'));
            return `Successfully edited ${filePath}: replaced ${target.length} chars with ${replacement.length} chars.`;
        } catch (error: any) {
            return `Error editing file: ${error.message}`;
        }
    }

    /**
     * Helper to present a Diff View to the user and request approval.
     */
    public static async proposeChange(filePath: string, newContent: string, selection?: vscode.Selection | vscode.Range): Promise<boolean> {
        const uri = this.resolvePath(filePath);
        if (!uri) return false;

        // READ existing content first
        let originalContent = '';
        try {
            const data = await vscode.workspace.fs.readFile(uri);
            originalContent = Buffer.from(data).toString('utf8');
        } catch {
            // File might not exist
        }

        let finalContentForDiff = newContent;

        // If selection is provided, we need to construct the full file content with the replacement
        if (selection && originalContent) {
            const document = await vscode.workspace.openTextDocument(uri);
            // Verify selection is valid within document

            // To show a proper diff of the WHOLE file with just the range changed:
            // 1. Get text before selection
            // 2. Get text after selection
            // 3. Construct new full text

            // However, verify selection is valid within document
            const range = new vscode.Range(selection.start, selection.end);
            const textBefore = document.getText(new vscode.Range(new vscode.Position(0, 0), range.start));
            const textAfter = document.getText(new vscode.Range(range.end, document.lineAt(document.lineCount - 1).range.end));

            finalContentForDiff = textBefore + newContent + textAfter;
        }

        // Create a temporary file for the new content to diff against
        const tempUri = vscode.Uri.file(uri.fsPath + '.pending');

        try {
            await vscode.workspace.fs.writeFile(tempUri, Buffer.from(finalContentForDiff, 'utf8'));

            // Check if original file exists. If not, create an empty one for diffing.
            let originalUri = uri;
            let usingEmpty = false;
            if (!originalContent) {
                // File doesn't exist. Create an empty temp file to diff against.
                originalUri = vscode.Uri.file(uri.fsPath + '.empty');
                await vscode.workspace.fs.writeFile(originalUri, new Uint8Array(0));
                usingEmpty = true;
            }

            // Open the Diff Editor
            await vscode.commands.executeCommand(
                'vscode.diff',
                originalUri,
                tempUri,
                `Proposed Changes: ${path.basename(filePath)}`
            );

            // Prompt the user
            const fileExists = !usingEmpty;
            const title = fileExists ? `Review proposed changes for '${path.basename(filePath)}'. Approve?` : `Review NEW file creation: '${path.basename(filePath)}'. Approve?`;

            const userSelection = await vscode.window.showInformationMessage(
                title,
                { modal: false }, // Non-modal so they can interact with the diff
                'Approve',
                'Reject'
            );

            // Cleanup
            await vscode.workspace.fs.delete(tempUri);
            if (usingEmpty) {
                try { await vscode.workspace.fs.delete(originalUri); } catch { /* ignore cleanup error */ }
            }

            // Attempt to close the diff editor (assuming it's still active)
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

            // If approved AND it was a selection-based edit, we need to ensure we apply the FULL content provided in finalContentForDiff
            // actually, the caller (editFile) expects us to return true/false, and IT writes the file.
            // But for inline chat which calls applyEditWithDiff directly, we might need a helper.

            return userSelection === 'Approve';
        } catch (e) {
            console.error('Error in proposeChange:', e);
            // Ensure cleanup
            try { await vscode.workspace.fs.delete(tempUri); } catch { /* ignore cleanup error */ }
            return false;
        }
    }

    /**
     * Applies a diff-verified edit to a file (full or selection).
     * This is a public wrapper for inline chat use.
     */
    public static async applyEditWithDiff(uri: vscode.Uri, newText: string, selection?: vscode.Selection | vscode.Range): Promise<void> {
        // We reuse the logic in proposeChange but we need to handle the actual writing if approved,
        // since proposeChange only returns boolean.

        // 1. Construct full new content if selection
        let finalContent = newText;
        if (selection) {
            try {
                const document = await vscode.workspace.openTextDocument(uri);
                const range = new vscode.Range(selection.start, selection.end);
                const textBefore = document.getText(new vscode.Range(new vscode.Position(0, 0), range.start));
                const textAfter = document.getText(new vscode.Range(range.end, document.lineAt(document.lineCount - 1).range.end));
                finalContent = textBefore + newText + textAfter;
            } catch (e) {
                console.error('Error reading document for selection apply:', e);
                return;
            }
        }

        const approved = await this.proposeChange(uri.fsPath, finalContent); // Pass the FULL content to proposeChange
        if (approved) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(finalContent, 'utf8'));
            vscode.window.showInformationMessage('Changes applied successfully.');
        } else {
            vscode.window.showInformationMessage('Changes rejected.');
        }
    }

    private static fileCache: { files: { label: string, type: 'file' | 'folder' }[], time: number } | null = null;
    private static CACHE_DURATION = 30000; // 30 seconds

    /**
     * Fetches all files in the workspace (excluding node_modules, .git, etc).
     */
    public static async getAllFiles(): Promise<{ label: string, type: 'file' | 'folder' }[]> {
        const now = Date.now();
        // Return cached if valid (and strictly check it's the new object format if needed, but for now assuming cache invalidation handles it)
        if (this.fileCache && (now - this.fileCache.time < this.CACHE_DURATION)) {
            // Check if cache is in new format (basic check)
            if (this.fileCache.files.length > 0 && typeof this.fileCache.files[0] === 'string') {
                // Old cache format, invalidate
            } else {
                console.log('ToolHandler: Returning cached file list');
                return this.fileCache.files as any;
            }
        }

        console.log('ToolHandler: getAllFiles called (fetching fresh)');
        const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**|**/.git/**|**/dist/**|**/out/**|build/**|.svelte-kit/**', 2000);

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }
        const root = workspaceFolders[0].uri.fsPath;

        const filePaths = files.map(f => path.relative(root, f.fsPath).replace(/\\/g, '/'));
        const folderSet = new Set<string>();

        // Extract all parent folders
        filePaths.forEach(filePath => {
            let currentDir = path.dirname(filePath);
            while (currentDir !== '.' && currentDir !== '/') {
                folderSet.add(currentDir);
                currentDir = path.dirname(currentDir);
            }
        });

        const allItems: { label: string, type: 'file' | 'folder' }[] = [
            ...Array.from(folderSet).sort().map(f => ({ label: f, type: 'folder' as const })),
            ...filePaths.sort().map(f => ({ label: f, type: 'file' as const }))
        ];

        this.fileCache = { files: allItems as any, time: now };
        return allItems;
    }

    /**
     * Resolves a file mention (e.g. "@index.js") to its content.
     */
    public static async resolveMention(filename: string): Promise<{ name: string, content: string } | null> {
        console.log(`ToolHandler: resolveMention called for ${filename}`);

        // Remove @ if present
        const cleanName = filename.startsWith('@') ? filename.slice(1) : filename;

        // Search for the file in the workspace
        const files = await vscode.workspace.findFiles(`**/${cleanName}`, '**/node_modules/**', 1);

        if (files.length > 0) {
            try {
                const uri = files[0];
                const stat = await vscode.workspace.fs.stat(uri);

                if (stat.type === vscode.FileType.Directory) {
                    // It's a directory (unlikely from findFiles unless we searched for it specifically, but good safety)
                    // Actually findFiles usually finds files. 
                    // But if the user typed a folder name exactly, we might want to support it.
                    // The logic below for exact folder match is better handled if findFiles returns it. 
                    // However, listDirectory logic above is better for folders.
                    // Let's try to resolve exact path first.
                }

                const data = await vscode.workspace.fs.readFile(uri);
                return {
                    name: cleanName,
                    content: Buffer.from(data).toString('utf8')
                };
            } catch (error) {
                console.error(`ToolHandler: Error reading mentioned file ${cleanName}`, error);
                return null;
            }
        }

        // Try to resolve as a directory if no file found, or if it looks like a folder
        const resolvedPath = this.resolvePath(cleanName);
        if (resolvedPath) {
            try {
                const stat = await vscode.workspace.fs.stat(resolvedPath);
                if (stat.type === vscode.FileType.Directory) {
                    const entries = await vscode.workspace.fs.readDirectory(resolvedPath);
                    const listing = entries.map(([name, type]) => {
                        const typeStr = type === vscode.FileType.Directory ? '[DIR]' : '[FILE]';
                        return `${typeStr} ${name}`;
                    }).join('\n');

                    return {
                        name: cleanName,
                        content: `Directory Listing for '${cleanName}':\n${listing}`
                    };
                }
            } catch (e) {
                // Ignore if not found
            }
        }

        return null;
    }

    /**
     * Resolves a relative path to a workspace URI.
     */
    private static resolvePath(relativePath: string): vscode.Uri | undefined {
        // Sanitize path: remove leading @ if present (fix for agent hallucinations or user input)
        if (relativePath.startsWith('@')) {
            relativePath = relativePath.slice(1);
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        let root: string | undefined;

        if (workspaceFolders && workspaceFolders.length > 0) {
            root = workspaceFolders[0].uri.fsPath;
            console.log(`ToolHandler: Using workspace root: ${root}`);
        } else {
            // Fallback: Use active editor directory
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                root = path.dirname(activeEditor.document.uri.fsPath);
                console.log(`ToolHandler: No workspace open, using fallback active editor root: ${root}`);
            }
        }

        if (!root) {
            console.error('ToolHandler: Unable to resolve root path. Please open a folder or a file.');
            return undefined;
        }

        const absolutePath = path.isAbsolute(relativePath)
            ? relativePath
            : path.join(root, relativePath);

        // Normalize path for Windows consistency
        const normalizedPath = path.normalize(absolutePath);
        return vscode.Uri.file(normalizedPath);
    }
}
