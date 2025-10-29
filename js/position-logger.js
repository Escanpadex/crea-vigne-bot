// 📝 SYSTÈME DE LOGS POUR POSITIONS
// Ce module gère le logging persistant des ouvertures/fermetures de positions
console.log('📁 Loading position-logger.js...');

// Configuration du logger
const LOGGER_CONFIG = {
    storageKey: 'trading_bot_position_logs',
    maxLogs: 300, // Nombre maximum de logs conservés
    enableConsole: true, // Afficher aussi dans la console
    includeTimestamp: true,
    includeDetails: true,
    // Fenêtre de déduplication des fermetures (par défaut: 6 heures)
    closeDedupMs: 6 * 60 * 60 * 1000
};

// Classe pour gérer les logs de positions
class PositionLogger {
    constructor() {
        this.logs = this.loadLogs();
        console.log(`✅ Position Logger initialisé avec ${this.logs.length} entrées`);
    }

    // Charger les logs depuis localStorage
    loadLogs() {
        try {
            const stored = localStorage.getItem(LOGGER_CONFIG.storageKey);
            if (stored) {
                const logs = JSON.parse(stored);
                console.log(`📂 ${logs.length} logs chargés depuis le stockage`);
                return logs;
            }
        } catch (error) {
            console.error('❌ Erreur chargement logs:', error);
        }
        return [];
    }

    // Sauvegarder les logs dans localStorage
    saveLogs() {
        try {
            // Limiter le nombre de logs
            if (this.logs.length > LOGGER_CONFIG.maxLogs) {
                this.logs = this.logs.slice(-LOGGER_CONFIG.maxLogs);
                // Silencieux - pas de log à chaque troncature
            }
            
            localStorage.setItem(LOGGER_CONFIG.storageKey, JSON.stringify(this.logs));
            return true;
        } catch (error) {
            console.error('❌ Erreur sauvegarde logs:', error);
            // Si le stockage est plein, supprimer les anciens logs
            if (error.name === 'QuotaExceededError') {
                console.warn('⚠️ Quota localStorage dépassé - Nettoyage des anciens logs...');
                this.logs = this.logs.slice(-Math.floor(LOGGER_CONFIG.maxLogs / 2));
                return this.saveLogs();
            }
            return false;
        }
    }

    // Ajouter un log d'ouverture de position
    logPositionOpen(position, details = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'POSITION_OPEN',
            symbol: position.symbol,
            side: position.side || 'LONG',
            entryPrice: position.entryPrice,
            quantity: position.quantity,
            size: position.size || (position.quantity * position.entryPrice),
            leverage: position.leverage || config.leverage,
            targetPnL: position.targetPnL || config.targetPnL,
            isBotManaged: position.isBotManaged,
            details: {
                change24h: details.change24h || 'N/A',
                volume24h: details.volume24h || 'N/A',
                strategy: details.strategy || 'Paires positives 24h',
                ...details
            }
        };

        this.logs.push(logEntry);
        this.saveLogs();

        // Log dans la console
        if (LOGGER_CONFIG.enableConsole) {
            console.log('📈 [POSITION OPEN]', {
                symbol: logEntry.symbol,
                price: logEntry.entryPrice,
                size: logEntry.size,
                leverage: logEntry.leverage,
                bot: logEntry.isBotManaged ? 'BOT' : 'MANUEL'
            });
        }

        // Log dans l'interface utilisateur
        log(`📈 OUVERTURE: ${position.symbol} @ ${position.entryPrice} | Taille: $${logEntry.size.toFixed(2)} | Levier: x${logEntry.leverage} | ${logEntry.isBotManaged ? '🤖 Bot' : '👤 Manuel'}`, 'SUCCESS');

        return logEntry;
    }

    // Ajouter un log de fermeture de position
    logPositionClose(position, closeDetails = {}) {
        // 🔧 NOUVEAU: Éviter les doublons robustement (par id si dispo, sinon symbole+entrée) sur une fenêtre étendue
        const now = Date.now();
        const closeKey = position?.id ? `id:${position.id}` : `sym:${position.symbol}|entry:${position.entryPrice}`;
        const recentDuplicate = this.logs.find(log => 
            log.type === 'POSITION_CLOSE' &&
            (
                (log.closeKey && log.closeKey === closeKey) ||
                (!log.closeKey && log.symbol === position.symbol && log.entryPrice === position.entryPrice)
            ) &&
            (now - new Date(log.timestamp).getTime()) < LOGGER_CONFIG.closeDedupMs
        );
        
        if (recentDuplicate) {
            console.log(`⚠️ Log doublon détecté pour ${position.symbol} - Ignoré`);
            return recentDuplicate;
        }
        
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'POSITION_CLOSE',
            symbol: position.symbol,
            side: position.side || 'LONG',
            entryPrice: position.entryPrice,
            exitPrice: closeDetails.exitPrice || position.currentPrice,
            quantity: position.quantity,
            size: position.size || (position.quantity * position.entryPrice),
            leverage: position.leverage || config.leverage,
            pnlDollar: closeDetails.pnlDollar || 0,
            pnlPercent: closeDetails.pnlPercent || 0,
            duration: closeDetails.duration || this.calculateDuration(position.timestamp),
            closeReason: closeDetails.reason || 'UNKNOWN',
            isBotManaged: position.isBotManaged,
            closeKey,
            details: {
                targetPnL: position.targetPnL,
                highestPrice: position.highestPrice,
                lowestPrice: position.lowestPrice,
                currentStopPrice: position.currentStopPrice,
                ...closeDetails
            }
        };

        this.logs.push(logEntry);
        this.saveLogs();

        // Log dans la console
        if (LOGGER_CONFIG.enableConsole) {
            const isProfit = logEntry.pnlDollar >= 0;
            console.log(`${isProfit ? '✅' : '❌'} [POSITION CLOSE]`, {
                symbol: logEntry.symbol,
                entry: logEntry.entryPrice,
                exit: logEntry.exitPrice,
                pnl: `${isProfit ? '+' : ''}$${logEntry.pnlDollar.toFixed(2)} (${isProfit ? '+' : ''}${logEntry.pnlPercent.toFixed(2)}%)`,
                reason: logEntry.closeReason,
                duration: logEntry.duration
            });
        }

        // Log détaillé dans l'interface utilisateur
        const isProfit = logEntry.pnlDollar >= 0;
        const pnlSign = isProfit ? '+' : '';
        const emoji = isProfit ? '✅' : '❌';
        
        log(`${emoji} FERMETURE: ${position.symbol} @ ${logEntry.exitPrice} | PnL: ${pnlSign}$${logEntry.pnlDollar.toFixed(2)} (${pnlSign}${logEntry.pnlPercent.toFixed(2)}%) | Durée: ${logEntry.duration} | Raison: ${logEntry.closeReason}`, isProfit ? 'SUCCESS' : 'WARNING');

        return logEntry;
    }

    // Calculer la durée d'une position
    calculateDuration(openTimestamp) {
        try {
            const openTime = new Date(openTimestamp);
            const now = new Date();
            const diffMs = now - openTime;
            const diffMinutes = Math.floor(diffMs / 60000);

            if (diffMinutes < 60) {
                return `${diffMinutes}min`;
            } else if (diffMinutes < 1440) {
                const hours = Math.floor(diffMinutes / 60);
                const mins = diffMinutes % 60;
                return mins > 0 ? `${hours}h${mins}min` : `${hours}h`;
            } else {
                const days = Math.floor(diffMinutes / 1440);
                const hours = Math.floor((diffMinutes % 1440) / 60);
                return hours > 0 ? `${days}j${hours}h` : `${days}j`;
            }
        } catch (error) {
            return 'N/A';
        }
    }

    // Obtenir tous les logs
    getAllLogs() {
        return this.logs;
    }

    // Obtenir les logs d'ouverture
    getOpenLogs() {
        return this.logs.filter(log => log.type === 'POSITION_OPEN');
    }

    // Obtenir les logs de fermeture
    getCloseLogs() {
        return this.logs.filter(log => log.type === 'POSITION_CLOSE');
    }

    // Obtenir les statistiques des logs
    getStats() {
        const closeLogs = this.getCloseLogs();
        const wins = closeLogs.filter(log => log.pnlDollar > 0);
        const losses = closeLogs.filter(log => log.pnlDollar < 0);
        
        return {
            totalPositions: this.getOpenLogs().length,
            totalClosed: closeLogs.length,
            wins: wins.length,
            losses: losses.length,
            winRate: closeLogs.length > 0 ? (wins.length / closeLogs.length * 100).toFixed(2) : 0,
            totalProfit: wins.reduce((sum, log) => sum + log.pnlDollar, 0),
            totalLoss: losses.reduce((sum, log) => sum + log.pnlDollar, 0),
            netPnL: closeLogs.reduce((sum, log) => sum + log.pnlDollar, 0)
        };
    }

    // Exporter les logs en texte formaté
    exportToText() {
        let text = '═══════════════════════════════════════════════════════════════\n';
        text += '         BOT TRADING BITGET - HISTORIQUE DES POSITIONS\n';
        text += '═══════════════════════════════════════════════════════════════\n';
        text += `Généré le: ${new Date().toLocaleString('fr-FR')}\n`;
        text += `Nombre total de logs: ${this.logs.length}\n\n`;

        // Statistiques
        const stats = this.getStats();
        text += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        text += '                        STATISTIQUES\n';
        text += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        text += `Total positions ouvertes: ${stats.totalPositions}\n`;
        text += `Total positions fermées: ${stats.totalClosed}\n`;
        text += `Positions gagnantes: ${stats.wins} (${stats.winRate}%)\n`;
        text += `Positions perdantes: ${stats.losses}\n`;
        text += `Profit total: +$${stats.totalProfit.toFixed(2)}\n`;
        text += `Perte totale: $${stats.totalLoss.toFixed(2)}\n`;
        text += `PnL Net: ${stats.netPnL >= 0 ? '+' : ''}$${stats.netPnL.toFixed(2)}\n\n`;

        // Logs détaillés
        text += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        text += '                     HISTORIQUE DÉTAILLÉ\n';
        text += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

        this.logs.reverse().forEach((log, index) => {
            const date = new Date(log.timestamp).toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }).replace(',', '');
            
            if (log.type === 'POSITION_OPEN') {
                text += `[${date}] 📈 OUVERTURE / Objectif PnL: +${log.targetPnL}%\n`;
                text += ` Symbol: ${log.symbol} Prix d'entrée: ${log.entryPrice}\n`;
                text += ` Quantité: ${log.quantity} / Taille: $${log.size.toFixed(2)} / Levier: x${log.leverage}\n`;
                if (log.details.change24h !== 'N/A') {
                    text += ` Performance 24h: +${log.details.change24h}%\n`;
                }
                text += ` Stratégie: ${log.details.strategy || 'N/A'}\n`;
                text += ` Gestion: ${log.isBotManaged ? '🤖 Bot' : '👤 Manuel'}\n`;
            } else if (log.type === 'POSITION_CLOSE') {
                const isProfit = log.pnlDollar >= 0;
                const pnlSign = isProfit ? '+' : '';
                text += `[${date}] ${isProfit ? '✅' : '❌'} FERMETURE / PnL: ${pnlSign}$${log.pnlDollar.toFixed(2)} (${pnlSign}${log.pnlPercent.toFixed(2)}%) / Durée: ${log.duration}\n`;
                text += ` Symbol: ${log.symbol} Prix d'entrée: ${log.entryPrice} / Prix de sortie: ${log.exitPrice}\n`;
                text += ` Quantité: ${log.quantity} / Taille: $${log.size.toFixed(2)} / Levier: x${log.leverage}\n`;
                text += ` Raison de fermeture: ${log.closeReason}\n`;
                if (log.details.highestPrice) {
                    text += ` Plus haut: ${log.details.highestPrice}`;
                    if (log.details.currentStopPrice) {
                        text += ` / Stop Loss: ${log.details.currentStopPrice}`;
                    }
                    text += '\n';
                } else if (log.details.currentStopPrice) {
                    text += ` Stop Loss: ${log.details.currentStopPrice}\n`;
                }
                text += ` Gestion: ${log.isBotManaged ? '🤖 Bot' : '👤 Manuel'}\n`;
            }
            
            text += '\n';
        });

        return text;
    }

    // Télécharger les logs en fichier texte
    downloadLogs() {
        try {
            const text = this.exportToText();
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `trading_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            log('✅ Logs téléchargés avec succès!', 'SUCCESS');
            return true;
        } catch (error) {
            console.error('❌ Erreur téléchargement logs:', error);
            log('❌ Erreur lors du téléchargement des logs', 'ERROR');
            return false;
        }
    }

    // Effacer tous les logs
    clearLogs() {
        if (confirm('⚠️ Êtes-vous sûr de vouloir effacer tous les logs? Cette action est irréversible.')) {
            this.logs = [];
            this.saveLogs();
            log('🗑️ Tous les logs ont été effacés', 'INFO');
            return true;
        }
        return false;
    }
}

// Créer une instance globale du logger
window.positionLogger = new PositionLogger();

// Fonctions globales pour faciliter l'utilisation
window.downloadPositionLogs = function() {
    return window.positionLogger.downloadLogs();
};

window.clearPositionLogs = function() {
    return window.positionLogger.clearLogs();
};

window.getPositionLogsStats = function() {
    return window.positionLogger.getStats();
};

console.log('✅ Position Logger chargé et prêt à l\'emploi');

