import { Plus, Eraser, History as HistoryIcon, Settings, X, Activity } from 'lucide-react';

declare global {
    interface Window {
        vsCodeIcon: string;
    }
}

interface HeaderProps {
    onAddTab: () => void;
    onClearChat: () => void;
    onHistoryClick: () => void;
    toggleSettings: () => void;
    showSettings: boolean;
    toggleSystemLog: () => void;
    showSystemLog: boolean;
}

const Header: React.FC<HeaderProps> = ({
    onAddTab,
    onClearChat,
    onHistoryClick,
    toggleSettings,
    showSettings,
    toggleSystemLog,
    showSystemLog
}) => {
    return (
        <div className="header">
            <div className="nav-brand">
                {window.vsCodeIcon && <img src={window.vsCodeIcon} className="nav-logo" alt="Logo" />}
                <span>Cohere</span>
            </div>
            {/* Tabs removed */}
            <div className="header-actions">
                <button
                    className={`icon-btn ${showSystemLog ? 'active' : ''}`}
                    title="Toggle System Log"
                    onClick={toggleSystemLog}
                >
                    <Activity size={14} />
                </button>
                <button className="icon-btn" title="New Tab" onClick={onAddTab}><Plus size={14} /></button>
                <button className="icon-btn" title="New Chat" onClick={onClearChat}><Eraser size={14} /></button>

                <button className="icon-btn" title="History" onClick={onHistoryClick}><HistoryIcon size={14} /></button>
                <button
                    className="icon-btn"
                    title="Settings"
                    onClick={toggleSettings}
                >
                    {showSettings ? <X size={14} /> : <Settings size={14} />}
                </button>
            </div>
        </div>
    );
};

export default Header;
