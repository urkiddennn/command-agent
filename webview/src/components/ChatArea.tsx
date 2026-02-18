import React, { useRef, useEffect } from 'react';
import {
    ListTodo,
    Loader2,
    Timer,
    Square,
    FileEdit,
    ArrowRight
} from 'lucide-react';
import { Message } from '../types';
import MessageItem from './MessageItem';

interface ChatAreaProps {
    messages: Message[];
    loading: boolean;
    elapsedTime: number;
    handleStop: () => void;
    expandedSteps: Set<string>;
    setExpandedSteps: React.Dispatch<React.SetStateAction<Set<string>>>;
    waitingForApproval: boolean;
    planContent: string;
    handleProceed: () => void;
    vscode?: any;
    showSystemLog: boolean;
}

const ChatArea: React.FC<ChatAreaProps> = ({
    messages,
    loading,
    elapsedTime,
    handleStop,
    expandedSteps,
    setExpandedSteps,
    waitingForApproval,
    planContent,
    handleProceed,
    vscode,
    showSystemLog
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading]);

    return (
        <div className="chat-area">
            {messages.map((msg, index) => (
                <MessageItem
                    key={index}
                    index={index}
                    message={msg}
                    isLast={index === messages.length - 1}
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
            ))}
            <div ref={messagesEndRef} />

            {waitingForApproval && (
                <div className="approval-section">
                    <button
                        className="proceed-btn secondary"
                        onClick={() => vscode?.postMessage({ type: 'open-plan', value: planContent })}
                        title="Open Plan in Editor"
                    >
                        <FileEdit size={16} />
                        View Plan
                    </button>
                    <button className="proceed-btn" onClick={handleProceed}>
                        <ArrowRight size={16} />
                        Proceed
                    </button>
                </div>
            )}
        </div>
    );
};

export default ChatArea;
