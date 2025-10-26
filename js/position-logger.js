// 📝 SYSTÈME DE LOGS POUR POSITIONS
// Ce module gère le logging persistant des ouvertures/fermetures de positions

// Configuration du logger
const LOGGER_CONFIG = {
    storageKey: 'trading_bot_position_logs',
    maxLogs: 200, // 🔧 RÉDUIT: 200 logs max au lieu de 1000 (environ 1 mois d'historique)
    maxDownloadLogs: 100, // 🔧 RÉDUIT: 100 logs max pour téléchargement (~1200 lignes) au lieu de 500
    maxDownloadLines: 10000, // 🆕 NOUVEAU: Limite stricte du nombre de lignes dans le fichier exporté
    enableConsole: true, // Afficher aussi dans la console
    includeTimestamp: true,
    includeDetails: true,
    autoCleanupDays: 30 // 🆕 NOUVEAU: Supprimer automatiquement les logs > 30 jours
};

// Classe pour gérer les logs de positions
class PositionLogger {
    constructor() {
        this.logs = this.loadLogs();
        // console.log(`✅ Position Logger initialisé avec ${this.logs.length} entrées`); // Supprimé
    }

    // Charger les logs depuis localStorage
    loadLogs() {
        try {
            const stored = localStorage.getItem(LOGGER_CONFIG.storageKey);
            if (stored) {
                let logs = JSON.parse(stored);
                
                // 🆕 NETTOYAGE AUTOMATIQUE: Supprimer les logs trop anciens (silencieux)
                logs = this.cleanOldLogs(logs);
                
                return logs;
            }
        } catch (error) {
            console.error('❌ Erreur chargement logs:', error);
        }
        return [];
    }
    
    // 🆕 NOUVEAU: Nettoyer les logs trop anciens
    cleanOldLogs(logs) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - LOGGER_CONFIG.autoCleanupDays);
        
        return logs.filter(log => {
            const logDate = new Date(log.timestamp);
            return logDate >= cutoffDate;
        });
    }

    // Sauvegarder les logs dans localStorage
    saveLogs() {
        try {
            // Limiter le nombre de logs (silencieux)
            if (this.logs.length > LOGGER_CONFIG.maxLogs) {
                this.logs = this.logs.slice(-LOGGER_CONFIG.maxLogs);
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
        // 🔧 AMÉLIORATION: Limiter le nombre de logs exportés pour réduire la taille du fichier
        const logsToExport = this.logs.slice(-LOGGER_CONFIG.maxDownloadLogs);
        const isLimited = logsToExport.length < this.logs.length;
        
        let text = '═══════════════════════════════════════════════════════════════\n';
        text += '         BOT TRADING BITGET - HISTORIQUE DES POSITIONS\n';
        text += '═══════════════════════════════════════════════════════════════\n';
        text += `Généré le: ${new Date().toLocaleString('fr-FR')}\n`;
        text += `Nombre total de logs: ${this.logs.length}\n`;
        if (isLimited) {
            text += `⚠️ Fichier limité aux ${logsToExport.length} derniers logs (config: max ${LOGGER_CONFIG.maxDownloadLogs})\n`;
            text += `💡 Pour voir l'historique complet, consultez le localStorage dans la console\n`;
        }
        text += '\n';

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

        // 🔧 CORRECTION: Compter les lignes et respecter la limite
        let lineCount = text.split('\n').length;
        let logsExported = 0;
        
        // 🔧 CORRECTION: Utiliser logsToExport au lieu de this.logs
        logsToExport.reverse().forEach((log, index) => {
            const date = new Date(log.timestamp).toLocaleString('fr-FR');
            let logText = '';
            
            if (log.type === 'POSITION_OPEN') {
                logText += `[${date}] 📈 OUVERTURE\n`;
                logText += `  Symbol: ${log.symbol}\n`;
                logText += `  Prix d'entrée: ${log.entryPrice}\n`;
                logText += `  Quantité: ${log.quantity}\n`;
                logText += `  Taille: $${log.size.toFixed(2)}\n`;
                logText += `  Levier: x${log.leverage}\n`;
                logText += `  Objectif PnL: +${log.targetPnL}%\n`;
                logText += `  Gestion: ${log.isBotManaged ? '🤖 Bot' : '👤 Manuel'}\n`;
                if (log.details.change24h !== 'N/A') {
                    logText += `  Performance 24h: +${log.details.change24h}%\n`;
                }
                logText += `  Stratégie: ${log.details.strategy || 'N/A'}\n`;
            } else if (log.type === 'POSITION_CLOSE') {
                const isProfit = log.pnlDollar >= 0;
                logText += `[${date}] ${isProfit ? '✅' : '❌'} FERMETURE\n`;
                logText += `  Symbol: ${log.symbol}\n`;
                logText += `  Prix d'entrée: ${log.entryPrice}\n`;
                logText += `  Prix de sortie: ${log.exitPrice}\n`;
                logText += `  Quantité: ${log.quantity}\n`;
                logText += `  Taille: $${log.size.toFixed(2)}\n`;
                logText += `  Levier: x${log.leverage}\n`;
                logText += `  PnL: ${isProfit ? '+' : ''}$${log.pnlDollar.toFixed(2)} (${isProfit ? '+' : ''}${log.pnlPercent.toFixed(2)}%)\n`;
                logText += `  Durée: ${log.duration}\n`;
                logText += `  Raison de fermeture: ${log.closeReason}\n`;
                logText += `  Gestion: ${log.isBotManaged ? '🤖 Bot' : '👤 Manuel'}\n`;
                if (log.details.highestPrice) {
                    logText += `  Plus haut: ${log.details.highestPrice}\n`;
                }
                if (log.details.currentStopPrice) {
                    logText += `  Stop Loss: ${log.details.currentStopPrice}\n`;
                }
            }
            
            logText += '\n';
            
            // 🎯 NOUVEAU: Vérifier si ajouter ce log dépasserait la limite
            const newLineCount = lineCount + logText.split('\n').length;
            if (newLineCount < LOGGER_CONFIG.maxDownloadLines) {
                text += logText;
                lineCount = newLineCount;
                logsExported++;
            }
            // Sinon, arrêter l'export (on a atteint la limite de lignes)
        });
        
        // 🔧 NOUVEAU: Indiquer si des logs ont été omis pour respect de la limite de lignes
        if (logsExported < logsToExport.length) {
            text += '\n⚠️ ─────────────────────────────────────────────────────────\n';
            text += `⚠️ Export limité: ${logsExported}/${logsToExport.length} logs exportés\n`;
            text += `⚠️ Raison: Limite de ${LOGGER_CONFIG.maxDownloadLines} lignes atteinte\n`;
            text += '⚠️ ─────────────────────────────────────────────────────────\n';
        }

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
    
    // 🆕 NOUVEAU: Nettoyer manuellement les logs anciens
    cleanOldLogsManually(days = LOGGER_CONFIG.autoCleanupDays) {
        const beforeCount = this.logs.length;
        this.logs = this.cleanOldLogs(this.logs);
        const afterCount = this.logs.length;
        const removed = beforeCount - afterCount;
        
        if (removed > 0) {
            this.saveLogs();
            log(`🗑️ ${removed} logs anciens (>${days} jours) supprimés`, 'INFO');
            console.log(`✅ Nettoyage terminé: ${removed} logs supprimés, ${afterCount} logs conservés`);
        } else {
            log(`✅ Aucun log ancien à supprimer (tous < ${days} jours)`, 'INFO');
        }
        
        return { removed, remaining: afterCount };
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

window.cleanOldLogs = function(days) {
    return window.positionLogger.cleanOldLogsManually(days);
};

// console.log('✅ Position Logger chargé et prêt à l\'emploi'); // Supprimé

