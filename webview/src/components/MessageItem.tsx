import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
    ChevronDown,
    ChevronRight,
    Terminal,
    Loader2,
    CheckCircle2,
    BrainCircuit,
    Search,
    Trash2,
    FolderOpen,
    Eye,
    PenLine,
    FileEdit,
    Atom,
    FileCode2,
    Palette,
    Globe,
    FileJson,
    AlertCircle,
    Square
} from 'lucide-react';
import { Message } from '../types';

interface MessageItemProps {
    message: Message;
    index: number;
    loading: boolean;
    expandedSteps: Set<string>;
    setExpandedSteps: React.Dispatch<React.SetStateAction<Set<string>>>;
    isLast: boolean;
    elapsedTime: number;
    handleStop: () => void;
    waitingForApproval: boolean;
    planContent: string;
    handleProceed: () => void;
    vscode?: any;
    showSystemLog: boolean;
}

const MessageItem: React.FC<MessageItemProps> = ({
    message: msg,
    index: i,
    loading,
    expandedSteps,
    setExpandedSteps,
    isLast,
    elapsedTime,
    handleStop,
    waitingForApproval,
    planContent,
    handleProceed,
    vscode,
    showSystemLog
}) => {
    return (
        <div key={i} className={`card-container ${msg.role}`}>
            {msg.role === 'bot' ? (
                <>
                    {/* System Log / Telemetry Gutter - Auto-show if no content yet */}
                    {(showSystemLog || (!msg.content && msg.progress && msg.progress.length > 0)) && (
                        <div className="progress-section">
                            <div className="progress-list">
                                {msg.progress?.map((step: any, idx: number) => {
                                    const stepObj = typeof step === 'string' ? { label: step, type: 'tool' } : step;
                                    const cleanLabel = stepObj.label.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '');
                                    const isStepLast = idx === (msg.progress?.length || 0) - 1;
                                    const isThinking = stepObj.type === 'thinking';
                                    const hasThought = isThinking && stepObj.thought && stepObj.thought.trim().length > 0;
                                    const hasResult = !isThinking && stepObj.result && stepObj.result.trim().length > 0;
                                    const isExpandable = hasThought || hasResult;
                                    const stepKey = `${i}-${idx}`;
                                    const isExpanded = expandedSteps.has(stepKey) || (isThinking && loading && isStepLast);
                                    const isFailed = cleanLabel.startsWith('✗');

                                    // File-type icon logic (same as before)
                                    const getFileIcon = (fp: string) => {
                                        if (!fp) return null;
                                        const ext = fp.split('.').pop()?.toLowerCase();
                                        switch (ext) {
                                            case 'tsx': case 'jsx': return <Atom size={12} color="#61dafb" />;
                                            case 'ts': case 'js': return <FileCode2 size={12} color="#f7df1e" />;
                                            case 'css': case 'scss': case 'less': return <Palette size={12} color="#a855f7" />;
                                            case 'html': return <Globe size={12} color="#e34f26" />;
                                            case 'json': return <FileJson size={12} color="#a3a3a3" />;
                                            default: return <FileCode2 size={12} color="var(--text-secondary)" />;
                                        }
                                    };

                                    // Icon logic
                                    const getStepIcon = () => {
                                        if (isThinking) {
                                            return isStepLast && loading
                                                ? <Loader2 size={14} className="spinner" />
                                                : <BrainCircuit size={14} color="var(--accent)" />;
                                        }
                                        if (isFailed) return <AlertCircle size={14} color="#ef4444" />;

                                        // Specific icons based on label text
                                        let Icon = CheckCircle2;
                                        let color = "var(--color-green)"; // Assuming green defined or use accent
                                        if (cleanLabel.includes('Running')) Icon = Terminal;
                                        if (cleanLabel.includes('Searching')) Icon = Search;
                                        if (cleanLabel.includes('Deleting')) Icon = Trash2;
                                        if (cleanLabel.includes('Editing')) Icon = PenLine;
                                        if (cleanLabel.includes('Reading')) Icon = Eye;
                                        if (cleanLabel.includes('Writing')) Icon = FileEdit;
                                        if (cleanLabel.includes('Listing')) Icon = FolderOpen;

                                        return isStepLast && loading
                                            ? <Loader2 size={14} className="spinner" />
                                            : <Icon size={14} style={{ opacity: 0.7 }} />;
                                    };

                                    const toggleStep = () => {
                                        if (!isExpandable) return;
                                        setExpandedSteps(prev => {
                                            const next = new Set(prev);
                                            if (next.has(stepKey)) next.delete(stepKey);
                                            else next.add(stepKey);
                                            return next;
                                        });
                                    };

                                    const getResultLang = () => {
                                        if (stepObj.toolName === 'runCommand') return 'bash';
                                        if (!stepObj.filePath) return '';
                                        const ext = stepObj.filePath.split('.').pop()?.toLowerCase();
                                        const langMap: any = { ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx', css: 'css', html: 'html', json: 'json', py: 'python', md: 'markdown' };
                                        return langMap[ext || ''] || '';
                                    };

                                    return (
                                        <div key={idx} className={`progress-item ${isStepLast && loading ? 'active-pulse' : ''} ${isExpandable ? 'has-dropdown' : ''} ${isExpanded ? 'expanded' : ''} ${isFailed ? 'failed' : ''}`}>
                                            <div className="progress-item-header" onClick={toggleStep}>
                                                <div className="progress-icon">{getStepIcon()}</div>
                                                <div className="progress-text">
                                                    <ReactMarkdown>{cleanLabel}</ReactMarkdown>
                                                </div>
                                                {stepObj.filePath && !isThinking && (
                                                    <div className="progress-file-badge">
                                                        {getFileIcon(stepObj.filePath)}
                                                        {stepObj.filePath.split('/').pop()}
                                                    </div>
                                                )}
                                                {isExpandable && (
                                                    <div className="progress-chevron">
                                                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                    </div>
                                                )}
                                            </div>
                                            {isExpanded && hasThought && (
                                                <div className="progress-thought-content">
                                                    <ReactMarkdown components={{
                                                        code({ node, inline, className, children, ...props }: any) {
                                                            const match = /language-(\w+)/.exec(className || '');
                                                            return !inline && match ? (
                                                                <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter>
                                                            ) : (<code className={className} {...props}>{children}</code>);
                                                        }
                                                    }}>{stepObj.thought}</ReactMarkdown>
                                                </div>
                                            )}
                                            {isExpanded && hasResult && (
                                                <div className="progress-result-content">
                                                    {getResultLang() ? (
                                                        <SyntaxHighlighter style={vscDarkPlus} language={getResultLang()} PreTag="div" customStyle={{ margin: 0, fontSize: '11px', borderRadius: '4px', maxHeight: '250px' }}>{stepObj.result}</SyntaxHighlighter>
                                                    ) : (<pre className="result-plain">{stepObj.result}</pre>)}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Active Loading Indicator in Gutter style */}
                    {/* Active Loading Indicator & Controls */}
                    {loading && isLast && (
                        <div className="loader-container">
                            <Loader2 size={14} className="spinner" />
                            <span>Processing...</span>
                            {showSystemLog && (
                                <span className="timer-badge">
                                    <Terminal size={10} style={{ marginRight: 4 }} />
                                    {elapsedTime.toFixed(1)}s
                                </span>
                            )}
                            <button className="stop-btn-mini" onClick={handleStop} title="Stop Generation">
                                <Square size={10} fill="currentColor" />
                            </button>
                        </div>
                    )}

                    <div className="final-response">
                        <ReactMarkdown
                            components={{
                                code({ node, inline, className, children, ...props }: any) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return !inline && match ? (
                                        <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter>
                                    ) : (<code className={className} {...props}>{children}</code>);
                                }
                            }}
                        >
                            {msg.content}
                        </ReactMarkdown>
                    </div>
                </>
            ) : (
                <div className="user-message">
                    {msg.content}
                </div>
            )}
        </div>
    );
};

export default MessageItem;
