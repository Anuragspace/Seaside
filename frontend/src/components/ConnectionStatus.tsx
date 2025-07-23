import React from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, AlertTriangle, CheckCircle, RotateCcw } from 'lucide-react';

interface ConnectionStatusProps {
    connectionState: RTCPeerConnectionState;
    iceConnectionState: RTCIceConnectionState;
    isReconnecting: boolean;
    dataChannelOpen: boolean;
    onReconnect: () => void;
    connectionStats?: {
        bytesReceived: number;
        bytesSent: number;
        packetsLost: number;
        roundTripTime: number;
    } | null;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
    connectionState,
    iceConnectionState,
    isReconnecting,
    dataChannelOpen,
    onReconnect,
    connectionStats
}) => {
    const getStatusColor = () => {
        if (isReconnecting) return 'text-yellow-400';
        if (connectionState === 'connected' && iceConnectionState === 'connected') return 'text-green-400';
        if (connectionState === 'failed' || iceConnectionState === 'failed') return 'text-red-400';
        if (connectionState === 'connecting' || iceConnectionState === 'checking') return 'text-blue-400';
        return 'text-gray-400';
    };

    const getStatusIcon = () => {
        if (isReconnecting) return <RotateCcw size={16} className="animate-spin" />;
        if (connectionState === 'connected' && iceConnectionState === 'connected') return <CheckCircle size={16} />;
        if (connectionState === 'failed' || iceConnectionState === 'failed') return <WifiOff size={16} />;
        if (connectionState === 'connecting' || iceConnectionState === 'checking') return <Wifi size={16} className="animate-pulse" />;
        return <AlertTriangle size={16} />;
    };

    const getStatusText = () => {
        if (isReconnecting) return 'Reconnecting...';
        if (connectionState === 'connected' && iceConnectionState === 'connected') return 'Connected';
        if (connectionState === 'failed' || iceConnectionState === 'failed') return 'Connection Failed';
        if (connectionState === 'connecting' || iceConnectionState === 'checking') return 'Connecting...';
        return 'Disconnected';
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed top-20 right-4 z-40 bg-gray-900/90 backdrop-blur-md rounded-lg border border-gray-700 p-3 min-w-[200px]"
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                    <span className={getStatusColor()}>{getStatusIcon()}</span>
                    <span className={`text-sm font-medium ${getStatusColor()}`}>
                        {getStatusText()}
                    </span>
                </div>
                {(connectionState === 'failed' || iceConnectionState === 'failed') && (
                    <button
                        onClick={onReconnect}
                        className="p-1 rounded hover:bg-gray-700 transition-colors"
                        title="Retry connection"
                    >
                        <RotateCcw size={14} className="text-gray-400 hover:text-white" />
                    </button>
                )}
            </div>

            <div className="space-y-1 text-xs text-gray-400">
                <div className="flex justify-between">
                    <span>WebRTC:</span>
                    <span className={connectionState === 'connected' ? 'text-green-400' : 'text-gray-400'}>
                        {connectionState}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span>ICE:</span>
                    <span className={iceConnectionState === 'connected' ? 'text-green-400' : 'text-gray-400'}>
                        {iceConnectionState}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span>Chat:</span>
                    <span className={dataChannelOpen ? 'text-green-400' : 'text-gray-400'}>
                        {dataChannelOpen ? 'Open' : 'Closed'}
                    </span>
                </div>
            </div>

            {connectionStats && (
                <div className="mt-2 pt-2 border-t border-gray-700 space-y-1 text-xs text-gray-400">
                    <div className="flex justify-between">
                        <span>Received:</span>
                        <span>{formatBytes(connectionStats.bytesReceived)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Sent:</span>
                        <span>{formatBytes(connectionStats.bytesSent)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Lost:</span>
                        <span className={connectionStats.packetsLost > 0 ? 'text-yellow-400' : 'text-green-400'}>
                            {connectionStats.packetsLost}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>RTT:</span>
                        <span>{Math.round(connectionStats.roundTripTime * 1000)}ms</span>
                    </div>
                </div>
            )}
        </motion.div>
    );
};

export default ConnectionStatus;