import React from 'react';
import { Settings, X, Key, Database } from 'lucide-react';

interface SettingsPanelProps {
    apiKey: string;
    memoryType: 'memory' | 'cache';
    onUpdateSettings: (key: string, type: 'memory' | 'cache') => void;
    onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ apiKey, memoryType, onUpdateSettings, onClose }) => {
    return (
        <div className="settings-panel">
            <div className="settings-header">
                <div className="settings-header-title">
                    <Settings size={14} />
                    Settings
                </div>
                <button className="icon-btn" onClick={onClose}>
                    <X size={14} />
                </button>
            </div>
            <div className="settings-body">
                <div className="setting-group">
                    <div className="setting-group-label">
                        <Key size={12} />
                        API Configuration
                    </div>
                    <div className="setting-row">
                        <label>Cohere API Key</label>
                        <input
                            type="password"
                            value={apiKey}
                            placeholder="Enter your API key..."
                            onChange={(e) => onUpdateSettings(e.target.value, memoryType)}
                        />
                    </div>
                </div>
                <div className="setting-group">
                    <div className="setting-group-label">
                        <Database size={12} />
                        History Storage
                    </div>
                    <div className="toggle-group">
                        <button
                            className={`toggle-btn ${memoryType === 'memory' ? 'active' : ''}`}
                            onClick={() => onUpdateSettings(apiKey, 'memory')}
                        >
                            Project
                        </button>
                        <button
                            className={`toggle-btn ${memoryType === 'cache' ? 'active' : ''}`}
                            onClick={() => onUpdateSettings(apiKey, 'cache')}
                        >
                            Global
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
