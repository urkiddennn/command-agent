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
     * Searches for a text pattern across workspace files.
     * Returns matching lines with file paths and line numbers.
     */
    public static async searchFiles(query: string, filePattern: string = '**/*'): Promise<string> {
        console.log(`ToolHandler: searchFiles called for "${query}" in ${filePattern}`);
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return 'Error: No workspace open.';
        }

        try {
            const files = await vscode.workspace.findFiles(
                filePattern,
                '**/node_modules/**,**/.git/**,**/dist/**,**/out/**',
                50 // Max 50 files to search
            );

            const results: string[] = [];
            const regex = new RegExp(query, 'gi');
            const root = workspaceFolders[0].uri.fsPath;

            for (const file of files) {
                try {
                    const data = await vscode.workspace.fs.readFile(file);
                    const content = Buffer.from(data).toString('utf8');
                    const lines = content.split('\n');

                    for (let i = 0; i < lines.length; i++) {
                        if (regex.test(lines[i])) {
                            const relativePath = path.relative(root, file.fsPath).replace(/\\/g, '/');
                            results.push(`${relativePath}:${i + 1}: ${lines[i].trim()}`);
                            regex.lastIndex = 0; // Reset regex state

                            if (results.length >= 30) break; // Cap results
                        }
                    }

                    if (results.length >= 30) break;
                } catch {
                    // Skip files that can't be read (binary, etc.)
                }
            }

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
            await vscode.workspace.fs.writeFile(fullPath, Buffer.from(newContent, 'utf8'));
            return `Successfully edited ${filePath}: replaced ${target.length} chars with ${replacement.length} chars.`;
        } catch (error: any) {
            return `Error editing file: ${error.message}`;
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
        const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**|**/.git/**|**/dist/**|**/out/**|build/**|.svelte-kit/**');

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
