import React, { useState, useEffect } from 'react';
import {
    Plus,
    ChevronDown,
    Mic,
    ArrowRight,
    Square,
    Folder,
    File
} from 'lucide-react';
import { FileSuggestion } from '../types';

interface InputAreaProps {
    input: string;
    setInput: (val: string) => void;
    handleSend: () => void;
    handleStop: () => void;
    handleClearChat: () => void;
    handleMicClick: () => void;
    loading: boolean;
    agentMode: string;
    setAgentMode: (val: string) => void;
    selectedModel: string;
    setSelectedModel: (val: string) => void;
    allFiles: FileSuggestion[];
    vscode?: any;
}

const InputArea: React.FC<InputAreaProps> = ({
    input,
    setInput,
    handleSend,
    handleStop,
    handleClearChat,
    handleMicClick,
    loading,
    agentMode,
    setAgentMode,
    selectedModel,
    setSelectedModel,
    allFiles,
    vscode
}) => {
    const [filteredFiles, setFilteredFiles] = useState<FileSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionIndex, setSuggestionIndex] = useState(0);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInput(value);

        // Find if we are currently typing a mention (cursor after @)
        const lastAtIndex = value.lastIndexOf('@');
        const isMentioning = lastAtIndex !== -1 && (lastAtIndex === 0 || value[lastAtIndex - 1] === ' ');

        if (isMentioning) {
            const query = value.slice(lastAtIndex + 1).split(/\s/)[0];
            const filtered = allFiles.filter(f =>
                f.label.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 10);

            setFilteredFiles(filtered);
            setShowSuggestions(filtered.length > 0);
            setSuggestionIndex(0);

            // Refresh list if it might be stale
            if (allFiles.length === 0 && vscode) {
                vscode.postMessage({ type: 'get-files' });
            }
        } else {
            setShowSuggestions(false);
        }
    };

    const handleSelectFile = (file: string) => {
        const lastAtIndex = input.lastIndexOf('@');
        const beforeAt = input.slice(0, lastAtIndex);
        const afterQuery = input.slice(lastAtIndex).split(/\s/).slice(1).join(' ');

        setInput(`${beforeAt}@${file} ${afterQuery}`);
        setShowSuggestions(false);
    };

    return (
        <div className="input-section">
            <div className="input-card">
                {showSuggestions && (
                    <div className="suggestions-dropdown top">
                        {filteredFiles.map((file, idx) => (
                            <div
                                key={file.label}
                                className={`suggestion-item ${idx === suggestionIndex ? 'active' : ''}`}
                                onClick={() => handleSelectFile(file.label)}
                            >
                                {file.type === 'folder' ? (
                                    <Folder size={14} className="suggestion-icon" />
                                ) : (
                                    <File size={14} className="suggestion-icon" />
                                )}
                                {file.label}
                            </div>
                        ))}
                    </div>
                )}
                <input
                    className="input-box"
                    type="text"
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Type a message..."
                    onKeyDown={(e) => {
                        if (showSuggestions) {
                            if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setSuggestionIndex((prev) => (prev + 1) % filteredFiles.length);
                            } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setSuggestionIndex((prev) => (prev - 1 + filteredFiles.length) % filteredFiles.length);
                            } else if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSelectFile(filteredFiles[suggestionIndex].label);
                            } else if (e.key === 'Escape') {
                                setShowSuggestions(false);
                            }
                        } else if (e.key === 'Enter') {
                            handleSend();
                        }
                    }}
                />
                <div className="action-bar">
                    <div className="left-actions">
                        <div className="pill-selector" onClick={handleClearChat} title="New Chat">
                            <Plus size={12} />
                        </div>
                        <div className="pill-selector">
                            <ChevronDown size={12} />
                            <select
                                value={agentMode}
                                onChange={(e) => setAgentMode(e.target.value)}
                            >
                                <option value="Planning">Planning</option>
                                <option value="Execution">Execution</option>
                                <option value="Research">Research</option>
                            </select>
                        </div>
                        <select
                            className="pill-selector"
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            style={{ border: 'none', background: 'none', color: 'inherit', fontSize: 'inherit' }}
                        >
                            <option value="command-r7b-arabic-02-2025">Cohere R7B</option>
                            <option value="command-r-plus">Command R+</option>
                        </select>
                    </div>
                    <div className="right-actions">
                        <button className="icon-btn" title="Voice Input" onClick={handleMicClick}><Mic size={14} /></button>
                        {loading ? (
                            <button
                                className="send-btn stop"
                                onClick={handleStop}
                                title="Stop Generation"
                                style={{ backgroundColor: '#ef4444' }}
                            >
                                <Square size={12} fill="currentColor" />
                            </button>
                        ) : (
                            <button
                                className="send-btn"
                                onClick={handleSend}
                                disabled={!input.trim()}
                            >
                                <ArrowRight size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InputArea;
