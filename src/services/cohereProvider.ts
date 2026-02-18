import { CohereClient } from 'cohere-ai';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ToolHandler } from './toolHandler.js';

function debugLog(message: string) {
    if (vscode.workspace.workspaceFolders) {
        const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const logPath = path.join(root, 'agent_debug.log');
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
    }
}

export class CohereProvider {
    private client: CohereClient | undefined;
    private memoryType: 'memory' | 'cache' = 'memory';
    private chatHistory: any[] = [];
    private _cancelled = false;
    private _currentOnUpdate: ((data: any) => void) | null = null;

    cancelGeneration() {
        this._cancelled = true;
        if (this._currentOnUpdate) {
            this._currentOnUpdate({ text: '⏹ Generation stopped by user.' });
        }
    }

    private readonly TOOLS = [
        {
            type: 'function',
            function: {
                name: 'readFile',
                description: 'Reads the content of a file in the workspace.',
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: {
                            description: 'The relative path to the file.',
                            type: 'string'
                        }
                    },
                    required: ['filePath']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'writeFile',
                description: 'Writes or overwrites a file in the workspace.',
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: {
                            description: 'The relative path to the file.',
                            type: 'string'
                        },
                        content: {
                            description: 'The content to write.',
                            type: 'string'
                        }
                    },
                    required: ['filePath', 'content']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'listDirectory',
                description: 'Lists files and directories in a workspace path.',
                parameters: {
                    type: 'object',
                    properties: {
                        dirPath: {
                            description: 'The relative path to the directory (default is ".").',
                            type: 'string'
                        }
                    }
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'createDirectory',
                description: 'Creates a new directory in the workspace.',
                parameters: {
                    type: 'object',
                    properties: {
                        dirPath: {
                            description: 'The relative path to the new directory.',
                            type: 'string'
                        }
                    },
                    required: ['dirPath']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'runCommand',
                description: 'Executes a shell command in the workspace root directory. Use for: npm install, git commands, build scripts, running tests, etc. Returns stdout and stderr. Has a 30 second timeout.',
                parameters: {
                    type: 'object',
                    properties: {
                        command: {
                            description: 'The shell command to execute (e.g. "npm install", "git status", "tsc --noEmit").',
                            type: 'string'
                        }
                    },
                    required: ['command']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'searchFiles',
                description: 'Searches for a text pattern across workspace files. Returns matching lines with file paths and line numbers. Use to find usages, definitions, imports, and patterns across the codebase.',
                parameters: {
                    type: 'object',
                    properties: {
                        query: {
                            description: 'The text or regex pattern to search for.',
                            type: 'string'
                        },
                        filePattern: {
                            description: 'Optional glob pattern to filter files (default: "**/*"). Example: "**/*.ts" for TypeScript files only.',
                            type: 'string'
                        }
                    },
                    required: ['query']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'deleteFile',
                description: 'Deletes a file or directory from the workspace (moves to trash for safety).',
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: {
                            description: 'The relative path to the file or directory to delete.',
                            type: 'string'
                        }
                    },
                    required: ['filePath']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'editFile',
                description: 'Makes a targeted edit to a file by finding and replacing specific text. Use instead of writeFile when you only need to change a small part of a file. The target text must exactly match text in the file.',
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: {
                            description: 'The relative path to the file to edit.',
                            type: 'string'
                        },
                        target: {
                            description: 'The exact text to find and replace. Must match the file content exactly.',
                            type: 'string'
                        },
                        replacement: {
                            description: 'The new text to replace the target with.',
                            type: 'string'
                        }
                    },
                    required: ['filePath', 'target', 'replacement']
                }
            }
        }
    ];

    constructor() {
        this.updateClient();
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('cohere-agent.apiKey')) {
                this.updateClient();
            }
        });
    }

    private updateClient(apiKey?: string) {
        const key = apiKey || vscode.workspace.getConfiguration('cohere-agent').get<string>('apiKey');
        if (key) {
            try {
                this.client = new CohereClient({
                    token: key,
                });
            } catch (err) {
                console.error('CohereProvider: Failed to initialize client:', err);
            }
        }
    }

    public setSettings(apiKey: string, memoryType: 'memory' | 'cache') {
        this.memoryType = memoryType;
        if (apiKey) {
            this.updateClient(apiKey);
        }
    }

    public getSettings() {
        return {
            apiKey: vscode.workspace.getConfiguration('cohere-agent').get<string>('apiKey') || '',
            memoryType: this.memoryType
        };
    }

    public clearHistory() {
        this.chatHistory = [];
    }

    public setHistory(messages: any[]) {
        this.chatHistory = [];

        // Always prepend the strict system message
        const systemMessage = `You are Command, an autonomous full-stack systems engineer with direct filesystem and terminal access.
CRITICAL: You are an AGENT, not a chat assistant.
1. NEVER provide code snippets for the user to copy. ALWAYS use tools to implement changes directly.
2. Available tools: readFile, writeFile, editFile, deleteFile, listDirectory, createDirectory, searchFiles, runCommand.
3. Prefer 'editFile' for small changes, 'writeFile' for new files or full rewrites.
4. Use 'searchFiles' to find code locations. Use 'runCommand' for npm, git, build, test commands.
5. For new tasks, FIRST create 'planning.md' using 'writeFile', then wait for approval.
6. AFTER executing a tool, be concise: "Done" or "Updated [filename]". Do NOT output full file content unless asked.
7. Format responses with Markdown.`;

        this.chatHistory.push({ role: 'system', content: systemMessage });

        // Map and append user/bot messages
        for (const msg of messages) {
            let role = msg.role;
            let content = msg.content;

            if (role === 'bot') role = 'assistant';

            if (!content || content.trim() === '') {
                // Skip empty User messages
                if (role === 'user') continue;
                // Default empty Assistant messages to a space to satisfy API requirements
                content = ' ';
            }

            if (role === 'user') {
                this.chatHistory.push({ role: 'user', content: content });
            } else if (role === 'assistant') {
                // Try to preserve tool calls if they were passed (even if frontend didn't fully capture them)
                // But for now, ensure content is non-empty
                this.chatHistory.push({ role: 'assistant', content: content });
            }
        }
        console.log(`CohereProvider: History synced. ${this.chatHistory.length} messages loaded.`);
    }

    async generateResponse(shortPrompt: string, mode: string, model: string | undefined, onUpdate: (data: { text: string; thought?: string; progress?: any[]; isFinal?: boolean }) => void, onPlanReady: (plan: string) => void) {
        if (!this.client) {
            onUpdate({ text: 'Error: Please set your Cohere API Key in settings.', isFinal: true });
            return;
        }

        const effectiveModel = model || 'command-r7b-12-2024';
        const isReasoningModel = effectiveModel.includes('reasoning'); // Simple heuristic for now

        try {
            // Process mentions and inject context
            let processedPrompt = await this.processMentions(shortPrompt);

            // Enforce Planning Mode
            if (mode === 'Planning') {
                processedPrompt = `(Mode: Planning)
INSTRUCTION: You are in PLANNING mode.
1. You MUST NOT write any code or modify any files yet (except 'planning.md').
2. You MUST first create a detailed 'planning.md' file using the 'writeFile' tool.
3. The plan should outline the steps you will take in Execution mode.
4. Stop immediately after creating the plan.

User Request: ${processedPrompt}`;
            }

            let iterations = 0;
            const maxIterations = 15;
            this._cancelled = false;
            this._currentOnUpdate = onUpdate;
            let planDetected = false;

            const systemMessage = `You are Command, an autonomous full-stack systems engineer. You execute precise filesystem modifications across UI, frontend, and backend architectures.

## Core Rules
1. You are an AGENT — never provide code snippets for the user to copy. ALWAYS use the tools to implement changes directly.
2. Available tools: readFile, writeFile, editFile, deleteFile, listDirectory, createDirectory, searchFiles, runCommand.
3. Prefer 'editFile' over 'writeFile' when making small changes to existing files — it's faster and preserves the rest of the file.
4. Use 'searchFiles' to find relevant code locations before making changes.
5. Use 'runCommand' for package management (npm), version control (git), build/test commands, etc.
6. When you generate code, immediately call 'writeFile' to save it. Never say "Here is the code" without writing it.
7. For any new task, FIRST create a "planning.md" file using 'writeFile', then wait for approval before executing.

## Response Format
Structure your final response with clear sections using Markdown:
- **Summary**: 1-2 sentence overview of what was done.
- **Changes Made**: Bullet list of each file modified and what changed.
- **Key Details**: Any important implementation decisions.

## When Debugging / Fixing Code
- ALWAYS read the relevant file(s) FIRST to understand the current state.
- In your response, show the **specific lines** that were causing the issue using a fenced code block with the language identifier.
- Explain WHY the code was broken.
- Show the corrected code in a separate code block.

## When Auditing / Improving Code
- Read the file(s) to analyze.
- In your response, highlight **specific code sections** that need improvement using fenced code blocks.
- For each section, explain the issue (performance, readability, accessibility, etc.) and show the improved version.
- Prioritize: critical bugs > performance > accessibility > code quality > style.

## UI & Frontend Guidelines
- Write clean, modern, semantic HTML5.
- Use responsive CSS with mobile-first approach.
- Prefer CSS custom properties for theming.
- Add smooth transitions and micro-animations for polish.
- Ensure proper color contrast (WCAG AA minimum).
- Use system font stacks or popular web fonts (Inter, Geist, etc.).

## Code Quality
- Write production-ready code, not MVPs.
- Add comments for non-obvious logic.
- Handle edge cases and errors gracefully.
- Keep functions small and focused.`;

            // Initialize chat history with system message if empty
            if (this.chatHistory.length === 0) {
                this.chatHistory.push({ role: 'system', content: systemMessage });
            }

            // Always add the current user message to history
            this.chatHistory.push({ role: 'user', content: processedPrompt });

            // Persistent progress steps across all iterations
            // Each step: { label: string, thought?: string, type: 'thinking' | 'tool' }
            const progressSteps: any[] = [];
            let lastFullText = '';

            while (iterations < maxIterations) {
                // Check cancellation at start of each iteration
                if (this._cancelled) {
                    progressSteps.push({ label: '\u23f9 Stopped by user', type: 'tool' });
                    onUpdate({ text: lastFullText || '\u23f9 Generation stopped by user.', thought: '', progress: [...progressSteps], isFinal: true });
                    break;
                }

                iterations++;
                console.log(`CohereProvider (V2): Iteration ${iterations} starting (Streaming). Model: ${effectiveModel}`);

                // Remove trailing "Continuing..." placeholder from previous iteration
                if (progressSteps.length > 0 && progressSteps[progressSteps.length - 1]?.label === 'Continuing...') {
                    progressSteps.pop();
                }

                // Add a "Thinking..." step to show reasoning is in progress
                progressSteps.push({ label: 'Thinking...', thought: '', type: 'thinking' });
                const thinkingStepIndex = progressSteps.length - 1;
                const thinkingStart = Date.now();
                let fullText = '';
                let fullThought = '';

                // Independent timer that ticks every 500ms to keep the UI updating
                const thinkingTimer = setInterval(() => {
                    const elapsed = ((Date.now() - thinkingStart) / 1000).toFixed(1);
                    progressSteps[thinkingStepIndex] = { ...progressSteps[thinkingStepIndex], label: `Thinking... (${elapsed}s)` };
                    onUpdate({ text: fullText, thought: fullThought, progress: [...progressSteps], isFinal: false });
                }, 500);

                onUpdate({
                    text: '',
                    thought: '',
                    progress: [...progressSteps],
                    isFinal: false
                });

                const streamParams: any = {
                    model: effectiveModel,
                    messages: this.chatHistory,
                    tools: this.TOOLS as any,
                };

                // Debug: Log history to check for empty messages
                console.log('CohereProvider (V2): Sending history to API:');
                this.chatHistory.forEach((msg, idx) => {
                    console.log(`  [${idx}] ${msg.role}: ${msg.content ? (typeof msg.content === 'string' ? msg.content.substring(0, 50) : '[Blocks]') : '(no content)'} ${msg.toolCalls ? `(ToolCalls: ${msg.toolCalls.length})` : ''}`);
                });

                if (isReasoningModel) {
                    streamParams.thinking = {
                        type: 'enabled',
                        token_budget: 2048
                    };
                }

                const stream = await (this.client as any).v2.chatStream(streamParams);

                const toolCallsMap = new Map<number, any>();

                // Process stream events
                for await (const event of stream) {
                    if (event.type === 'content-delta') {
                        const textDelta = event.delta?.message?.content?.text || '';
                        fullText += textDelta;
                        if (textDelta.length > 10) debugLog(`CohereProvider (V2): Received content delta (${textDelta.length} chars)`);
                        onUpdate({ text: fullText, thought: fullThought, progress: [...progressSteps], isFinal: false });
                    } else if (event.type === 'tool-plan-delta') {
                        const thoughtDelta = event.delta?.message?.toolPlan || '';
                        fullThought += thoughtDelta;
                        debugLog('CohereProvider (V2): Received thought delta');
                        onUpdate({ text: fullText, thought: fullThought, progress: [...progressSteps], isFinal: false });
                    } else if (event.type === 'tool-call-start') {
                        debugLog('CohereProvider (V2): Tool call started');
                        const index = event.index;
                        const toolCall = event.delta?.message?.toolCalls;
                        if (index !== undefined && toolCall) {
                            // Initialize tool call
                            toolCallsMap.set(index, {
                                id: toolCall.id,
                                type: toolCall.type,
                                function: {
                                    name: toolCall.function?.name,
                                    arguments: toolCall.function?.arguments || ''
                                }
                            });
                        }
                    } else if (event.type === 'tool-call-delta') {
                        const index = event.index;
                        const toolCallDelta = event.delta?.message?.toolCalls;
                        if (index !== undefined && toolCallDelta?.function?.arguments) {
                            const existing = toolCallsMap.get(index);
                            if (existing) {
                                existing.function.arguments += toolCallDelta.function.arguments;
                                toolCallsMap.set(index, existing);
                            }
                        }
                    }
                }

                // Stop the independent thinking timer
                clearInterval(thinkingTimer);

                // Mark thinking step as completed with final time and attach the thought
                const thinkingElapsed = ((Date.now() - thinkingStart) / 1000).toFixed(1);
                progressSteps[thinkingStepIndex] = {
                    label: `✓ Reasoning complete — ${thinkingElapsed}s`,
                    thought: fullThought,
                    type: 'thinking'
                };

                // Finalize tool calls from map
                const toolCalls = Array.from(toolCallsMap.values());
                debugLog(`CohereProvider (V2): Stream finished. Tool calls: ${toolCalls.length}.`);

                // VALIDATION: Ensure content is not empty if no tools (V2 API requirement)
                if (!fullText && toolCalls.length === 0) {
                    console.warn('CohereProvider (V2): Received empty response. Defaulting to space.');
                    fullText = ' '; // Message must have non-empty content
                }

                // Add assistant response to history
                const assistantMsg: any = {
                    role: 'assistant',
                    content: fullText || (toolCalls.length > 0 ? undefined : ' ')
                };
                if (toolCalls.length > 0) assistantMsg.toolCalls = toolCalls;
                this.chatHistory.push(assistantMsg);

                // Structured update for UI final state of this turn
                onUpdate({
                    text: fullText || (toolCalls.length > 0 ? '' : '...'),
                    thought: fullThought,
                    progress: [...progressSteps],
                    isFinal: false
                });

                // If tool calls are requested, execute them
                if (toolCalls.length > 0) {
                    for (const call of toolCalls) {
                        // Check cancellation before each tool execution
                        if (this._cancelled) {
                            progressSteps.push({ label: '⏹ Stopped by user', type: 'tool' });
                            onUpdate({ text: fullText || '⏹ Generation stopped.', thought: fullThought, progress: [...progressSteps], isFinal: true });
                            break;
                        }

                        let result: string;
                        try {
                            const { name, arguments: paramsString } = call.function;
                            debugLog(`CohereProvider (V2): Parsing tool call ${name}. Arg string length: ${paramsString.length}`);

                            let parameters: any;
                            try {
                                parameters = JSON.parse(paramsString);
                            } catch (parseError: any) {
                                debugLog(`CohereProvider (V2): Standard JSON parse failed. Attempting sanitization...`);

                                try {
                                    // Robust attempt to fix unescaped newlines inside JSON string values
                                    // This targets newlines found after a colon and quote, but before the next quote+comma or quote+bracket
                                    let sanitized = paramsString;

                                    // Heuristic: Multi-line strings in JSON from LLMs often look like:
                                    // "content": "some
                                    // code
                                    // here",
                                    // We look for everything between the opening quote of a value and the closing quote.
                                    // This regex is a bit complex but captures the pattern of a JSON value string.
                                    sanitized = sanitized.replace(/:(\s*)"([^"\\]*(?:\\.[^"\\]*)*)"/gs, (match: string, space: string, content: string) => {
                                        // Replace literal newlines in the content part with \n
                                        const fixedContent = content.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
                                        return `:${space}"${fixedContent}"`;
                                    });

                                    parameters = JSON.parse(sanitized);
                                    debugLog(`CohereProvider (V2): Sanitization successful.`);
                                } catch (e2) {
                                    console.error('CohereProvider (V2): JSON content causing error:', paramsString);
                                    throw parseError; // Rethrow original error if sanitization fails
                                }
                            }

                            // Build a descriptive step label
                            let stepLabel = '';
                            switch (name) {
                                case 'readFile':
                                    stepLabel = `Reading \`${parameters.filePath}\``;
                                    break;
                                case 'writeFile':
                                    stepLabel = `Writing \`${parameters.filePath}\``;
                                    break;
                                case 'listDirectory':
                                    stepLabel = `Listing \`${parameters.dirPath || '.'}\``;
                                    break;
                                case 'createDirectory':
                                    stepLabel = `Creating directory \`${parameters.dirPath}\``;
                                    break;
                                case 'runCommand':
                                    stepLabel = `Running \`${parameters.command}\``;
                                    break;
                                case 'searchFiles':
                                    stepLabel = `Searching for \`${parameters.query}\``;
                                    break;
                                case 'deleteFile':
                                    stepLabel = `Deleting \`${parameters.filePath}\``;
                                    break;
                                case 'editFile':
                                    stepLabel = `Editing \`${parameters.filePath}\``;
                                    break;
                                default:
                                    stepLabel = `Executing ${name}`;
                            }

                            // Add step as "in-progress" (loading indicator will show on last item)
                            const filePath = (parameters.filePath || parameters.dirPath || '') as string;
                            progressSteps.push({ label: stepLabel + '...', type: 'tool', toolName: name, filePath });
                            const stepIndex = progressSteps.length - 1;
                            const stepStart = Date.now();

                            // Real-time update showing this step loading
                            onUpdate({
                                text: fullText,
                                thought: fullThought,
                                progress: [...progressSteps],
                                isFinal: false
                            });

                            debugLog(`CohereProvider (V2): Executing ${name} with params: ${JSON.stringify(parameters)}`);

                            switch (name) {
                                case 'readFile':
                                    result = await ToolHandler.readFile(parameters.filePath as string);
                                    break;
                                case 'writeFile':
                                    result = await ToolHandler.writeFile(parameters.filePath as string, parameters.content as string);
                                    if ((parameters.filePath as string).toLowerCase().endsWith('planning.md')) {
                                        planDetected = true;
                                        // Send plan content to UI
                                        onPlanReady(parameters.content as string);
                                    }
                                    break;
                                case 'listDirectory':
                                    result = await ToolHandler.listDirectory(parameters.dirPath as string);
                                    break;
                                case 'createDirectory':
                                    result = await ToolHandler.createDirectory(parameters.dirPath as string);
                                    break;
                                case 'runCommand':
                                    result = await ToolHandler.runCommand(parameters.command as string);
                                    break;
                                case 'searchFiles':
                                    result = await ToolHandler.searchFiles(parameters.query as string, parameters.filePattern as string);
                                    break;
                                case 'deleteFile':
                                    result = await ToolHandler.deleteFile(parameters.filePath as string);
                                    break;
                                case 'editFile':
                                    result = await ToolHandler.editFile(parameters.filePath as string, parameters.target as string, parameters.replacement as string);
                                    break;
                                default:
                                    result = `Error: Unknown tool ${name}`;
                            }

                            // Mark step as completed with elapsed time and attach result
                            const stepElapsed = ((Date.now() - stepStart) / 1000).toFixed(1);
                            progressSteps[stepIndex] = {
                                label: `✓ ${stepLabel} — ${stepElapsed}s`,
                                type: 'tool',
                                toolName: name,
                                filePath,
                                result: result.length > 2000 ? result.substring(0, 2000) + '\n... (truncated)' : result
                            };
                            onUpdate({
                                text: fullText,
                                thought: fullThought,
                                progress: [...progressSteps],
                                isFinal: false
                            });

                            debugLog(`CohereProvider (V2): Finished executing ${name}`);
                        } catch (e: any) {
                            debugLog(`CohereProvider (V2): Tool Execution Error: ${e}`);
                            result = `Exception executing tool: ${e.message}`;
                            // Mark as failed with error result
                            progressSteps[progressSteps.length - 1] = {
                                label: `✗ Failed: ${e.message}`,
                                type: 'tool',
                                toolName: call.function?.name || 'unknown',
                                filePath: '',
                                result: `Error: ${e.message}`
                            };
                            onUpdate({
                                text: fullText,
                                thought: fullThought,
                                progress: [...progressSteps],
                                isFinal: false
                            });
                        }

                        // Add EACH tool result as an individual message (Strict V2 requirement)
                        this.chatHistory.push({
                            role: 'tool',
                            toolCallId: call.id,
                            content: [{
                                type: 'text',
                                text: result
                            }]
                        });
                    }

                    if (planDetected) {
                        progressSteps.push({ label: '✓ Plan creation complete', type: 'tool' });
                        // CRITICAL: Close the turn with an assistant message to follow V2 protocol
                        this.chatHistory.push({
                            role: 'assistant',
                            content: "Technical plan created in `planning.md`. Please review the plan in the **Plan** tab and click **Process** to start implementation."
                        });
                        onUpdate({
                            text: "Technical plan created in `planning.md`. Please review the plan in the **Plan** tab and click **Process** to start implementation.",
                            thought: fullThought,
                            progress: [...progressSteps],
                            isFinal: true
                        });
                        break;
                    }

                    // Add a trailing "Continuing..." step to show loading between iterations
                    lastFullText = fullText;
                    progressSteps.push({ label: 'Continuing...', type: 'tool' });
                    onUpdate({
                        text: fullText,
                        thought: fullThought,
                        progress: [...progressSteps],
                        isFinal: false
                    });
                } else {
                    // Final text response
                    lastFullText = fullText;
                    onUpdate({
                        text: fullText,
                        thought: fullThought,
                        progress: [...progressSteps],
                        isFinal: true
                    });
                    break;
                }
            }

            // Handle max iterations reached
            if (iterations >= maxIterations && !this._cancelled) {
                const limitMsg = 'Reached maximum tool iterations. You can send another message to continue.';
                progressSteps.push({ label: '⚠ Reached maximum iterations', type: 'tool' });
                this.chatHistory.push({ role: 'assistant', content: limitMsg });
                onUpdate({ text: lastFullText || limitMsg, thought: '', progress: [...progressSteps], isFinal: true });
            }

            this._currentOnUpdate = null;
        } catch (error: any) {
            console.error('CohereProvider Agent Error:', error);
            const errMsg = `Error: ${error.message || 'Unknown API Error'}`;
            this.chatHistory.push({ role: 'assistant', content: errMsg });
            onUpdate({ text: errMsg, isFinal: true });
        }
    }

    /**
     * Continues execution with the approved (and possibly edited) plan.
     */
    async executePlan(plan: string, onUpdate: (data: { text: string; thought?: string; progress?: any[]; isFinal?: boolean }) => void) {
        this._currentOnUpdate = onUpdate;
        this._cancelled = false;

        // Pass the full approved plan as the primary prompt to generateResponse.
        // This avoids pushing a duplicate user message inside generateResponse.
        const approvalPrompt = `I approve this plan. Switch to EXECUTION mode and follow the plan step-by-step using the provided tools. Proceed with execution:\n\n# Implementation Plan\n${plan}`;

        return this.generateResponse(approvalPrompt, "Execution", undefined, onUpdate, () => { });
    }

    private async processMentions(prompt: string): Promise<string> {
        const mentionRegex = /@([\w.-]+)/g;
        const matches = prompt.match(mentionRegex);

        if (!matches) return prompt;

        let enrichedPrompt = prompt;
        const processedFiles = new Set<string>();

        for (const mention of matches) {
            if (processedFiles.has(mention)) continue;
            processedFiles.add(mention);

            const fileData = await ToolHandler.resolveMention(mention);
            if (fileData) {
                enrichedPrompt = `User referenced file "${fileData.name}": \n\`\`\`${fileData.name}\n${fileData.content}\n\`\`\`\n\n${enrichedPrompt}`;
            }
        }

        return enrichedPrompt;
    }
}
