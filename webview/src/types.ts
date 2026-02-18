export interface Message {
    role: 'user' | 'bot';
    content: string;
    thought?: string;
    progress?: string[];
    isError?: boolean;
    isFinal?: boolean;
}

export interface FileSuggestion {
    label: string;
    type: 'file' | 'folder';
}

export interface ProgressStep {
    label: string;
    type: 'tool' | 'thinking';
    thought?: string;
    result?: string;
    filePath?: string;
    toolName?: string;
}
