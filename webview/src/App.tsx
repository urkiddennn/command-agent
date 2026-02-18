import React, { useState, useEffect, useRef } from 'react';
import './styles.css';
import Header from './components/Header';
import SettingsPanel from './components/SettingsPanel';
import EmptyState from './components/EmptyState';
import InputArea from './components/InputArea';
import ChatArea from './components/ChatArea';
import { Message, FileSuggestion } from './types';

declare const acquireVsCodeApi: any;
const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

declare global {
    interface Window {
        vsCodeIcon: string;
    }
}

const App: React.FC = () => {
    // Global error handler for uncaught exceptions
    useEffect(() => {
        const errorHandler = (event: ErrorEvent) => {
            if (vscode) {
                vscode.postMessage({ type: 'show-info', value: `Webview Error: ${event.message}` });
            }
        };
        window.addEventListener('error', errorHandler);
        return () => window.removeEventListener('error', errorHandler);
    }, []);

    return (
        <ErrorBoundary>
            <MainContent />
        </ErrorBoundary>
    );
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
    }

    componentDidCatch(error: any, errorInfo: any) {
        if (vscode) {
            vscode.postMessage({ type: 'show-info', value: `React Error: ${error.message}` });
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', color: '#ff6b6b', background: '#1e1e1e' }}>
                    <h3>Something went wrong.</h3>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>{this.state.error?.message}</pre>
                </div>
            );
        }

        return this.props.children;
    }
}

const MainContent: React.FC = () => {
    // Core extensions state
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoadingState] = useState(false);
    const loadingRef = useRef(false);
    const setLoading = (val: boolean) => {
        loadingRef.current = val;
        setLoadingState(val);
    };

    const [apiKey, setApiKey] = useState('');
    const [memoryType, setMemoryType] = useState<'memory' | 'cache'>('memory');
    const [agentMode, setAgentMode] = useState('Planning');
    const [selectedModel, setSelectedModel] = useState('command-a-reasoning-08-2025');
    const [showSettings, setShowSettings] = useState(false);

    // UI states
    const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
    const [waitingForApproval, setWaitingForApproval] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [allFiles, setAllFiles] = useState<FileSuggestion[]>([]);
    const [planContent, setPlanContent] = useState('');

    const [showSystemLog, setShowSystemLog] = useState(false);

    // Tab State
    const [tabs, setTabs] = useState<{ id: string; title: string; messages: Message[] }[]>([
        { id: '1', title: 'New session 1', messages: [] }
    ]);
    const [activeTabId, setActiveTabId] = useState('1');

    // Real-time timer that counts while loading
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (loading) {
            setElapsedTime(0);
            interval = setInterval(() => {
                setElapsedTime(prev => prev + 0.1);
            }, 100);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [loading]);

    // Sync messages with active tab
    useEffect(() => {
        setTabs(prev => prev.map(tab =>
            tab.id === activeTabId ? { ...tab, messages } : tab
        ));
    }, [messages]);

    // Switch/Load messages when active tab changes
    useEffect(() => {
        const currentTab = tabs.find(t => t.id === activeTabId);
        if (currentTab) {
            setMessages(currentTab.messages);
            if (vscode) {
                // In a real app, we'd load specific history for this ID.
                // vscode.postMessage({ type: 'load-session', value: activeTabId }); 
            }
        }
    }, [activeTabId]);

    const handleAddTab = () => {
        const newId = Date.now().toString();
        const newTab = { id: newId, title: `New session ${tabs.length + 1}`, messages: [] };
        setTabs([...tabs, newTab]);
        setActiveTabId(newId);
    };

    // Extension communication
    useEffect(() => {
        if (vscode) {
            vscode.postMessage({ type: 'webview-ready' });
            vscode.postMessage({ type: 'get-files' });
        }

        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.type) {
                case 'cohere-response':
                    if (!loadingRef.current) return; // FIX: Ignore responses if stopped

                    const responseData = typeof message.value === 'string' ? { text: message.value } : message.value;
                    setMessages((prev) => {
                        const newMessages = [...prev];
                        const lastMsg = newMessages.length > 0 ? newMessages[newMessages.length - 1] : null;

                        if (lastMsg && lastMsg.role === 'bot') {
                            lastMsg.content = responseData.text;
                            if (responseData.thought) lastMsg.thought = responseData.thought;
                            if (responseData.progress) lastMsg.progress = responseData.progress;
                        } else {
                            newMessages.push({
                                role: 'bot',
                                content: responseData.text,
                                thought: responseData.thought,
                                progress: responseData.progress
                            });
                        }
                        return newMessages;
                    });

                    if (message.value.isFinal) {
                        setLoading(false);
                    }
                    break;
                case 'plan-ready':
                    setPlanContent(message.value || '');
                    setLoading(false);
                    if (vscode) {
                        vscode.postMessage({ type: 'open-plan', value: message.value || '' });
                    }
                    setWaitingForApproval(true);
                    break;
                case 'init-settings':
                    setApiKey(message.value.apiKey || '');
                    setMemoryType(message.value.memoryType || 'memory');
                    break;
                case 'load-history':
                    if (message.value && Array.isArray(message.value)) {
                        setMessages(message.value);
                    }
                    break;
                case 'file-list':
                    setAllFiles(message.value || []);
                    break;

            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    useEffect(() => {
        if (vscode && messages.length > 0) {
            vscode.postMessage({ type: 'save-history', value: messages });
        }
    }, [messages]);

    // Handlers
    const handleStop = () => {
        if (!loadingRef.current) return;
        vscode.postMessage({ type: 'cancel-generation' });
        setLoading(false);
        setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'bot') {
                const newProgress: any[] = [...(last.progress || [])];
                newProgress.push({ label: '⏹ Stopped by user', type: 'tool' });
                return [
                    ...prev.slice(0, -1),
                    { ...last, content: last.content || '⏹ Generation stopped.', progress: newProgress }
                ];
            }
            return prev;
        });
    };

    const handleSend = () => {
        if (!input.trim() || loading) return;

        const newMessages: Message[] = [...messages, { role: 'user', content: input }];
        setMessages(newMessages);
        setInput('');
        setLoading(true);

        if (vscode) {
            vscode.postMessage({
                type: 'user-message',
                value: input,
                mode: agentMode,
                model: selectedModel
            });
        }
    };

    const handleProceed = () => {
        setWaitingForApproval(false);
        setLoading(true);
        if (vscode) {
            vscode.postMessage({
                type: 'execute-plan',
                value: planContent
            });
        }
    };

    const handleClearChat = () => {
        setMessages([]);
        if (vscode) {
            vscode.postMessage({ type: 'clear-chat' });
        }
    };

    const handleHistoryClick = () => {
        if (vscode) {
            vscode.postMessage({ type: 'show-info', value: 'History loading...' });
        }
    };

    const handleMicClick = () => {
        if (vscode) {
            vscode.postMessage({ type: 'show-info', value: 'Voice input coming soon!' });
        }
    };

    const updateSettings = (newKey: string, newType: 'memory' | 'cache') => {
        setApiKey(newKey);
        setMemoryType(newType);
        if (vscode) {
            vscode.postMessage({
                type: 'update-settings',
                value: { apiKey: newKey, memoryType: newType }
            });
        }
    };

    return (
        <div className="container">
            <Header
                onAddTab={handleAddTab}
                onClearChat={handleClearChat}
                onHistoryClick={handleHistoryClick}
                toggleSettings={() => setShowSettings(!showSettings)}
                showSettings={showSettings}
                toggleSystemLog={() => setShowSystemLog(!showSystemLog)}
                showSystemLog={showSystemLog}
            />

            {showSettings ? (
                <SettingsPanel
                    apiKey={apiKey}
                    memoryType={memoryType}
                    onUpdateSettings={updateSettings}
                    onClose={() => setShowSettings(false)}
                />
            ) : (
                <>
                    <div className="main-content">
                        {messages.length === 0 ? (
                            <EmptyState
                                input={input}
                                setInput={setInput}
                                handleSend={handleSend}
                                handleStop={handleStop}
                                handleClearChat={handleClearChat}
                                handleMicClick={handleMicClick}
                                loading={loading}
                                agentMode={agentMode}
                                setAgentMode={setAgentMode}
                                selectedModel={selectedModel}
                                setSelectedModel={setSelectedModel}
                                allFiles={allFiles}
                                vscode={vscode}
                            />
                        ) : (
                            <ChatArea
                                messages={messages}
                                loading={loading}
                                elapsedTime={elapsedTime}
                                handleStop={handleStop}
                                expandedSteps={expandedSteps}
                                setExpandedSteps={setExpandedSteps}
                                waitingForApproval={waitingForApproval}
                                planContent={planContent}
                                handleProceed={handleProceed}
                                vscode={vscode}
                                showSystemLog={showSystemLog}
                            />
                        )}
                    </div>

                    {messages.length > 0 && (
                        <InputArea
                            input={input}
                            setInput={setInput}
                            handleSend={handleSend}
                            handleStop={handleStop}
                            handleClearChat={handleClearChat}
                            handleMicClick={handleMicClick}
                            loading={loading}
                            agentMode={agentMode}
                            setAgentMode={setAgentMode}
                            selectedModel={selectedModel}
                            setSelectedModel={setSelectedModel}
                            allFiles={allFiles}
                            vscode={vscode}
                        />
                    )}
                </>
            )}

            <div className="footer">
                <div className="footer-text">
                    AI may make mistakes. Double-check all generated code.
                </div>
            </div>
        </div>
    );
};

export default App;
