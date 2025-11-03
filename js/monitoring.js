// 🔍 MONITORING SYSTEM - Diagnostics de la santé du bot
// Détecte les problèmes d'API queue saturation et de performance

console.log('📁 Loading monitoring.js...');

// 📊 Classe pour monitorer la santé du système
class BotHealthMonitor {
    constructor() {
        this.checks = {
            apiQueueHealth: 'UNKNOWN',
            apiQueueSize: 0,
            averageWaitTime: 0,
            lastCheckTime: 0,
            intervalCount: 0
        };
        this.alertThresholds = {
            maxQueueSize: 50,           // Alerte si 50+ requêtes en attente
            maxWaitTime: 5000,          // Alerte si attente moyenne > 5s
            maxErrorRate: 0.1           // Alerte si >10% d'erreurs
        };
        this.startMonitoring();
    }
    
    // 🔄 Vérifier la santé toutes les 30 minutes (au lieu de 30 secondes)
    startMonitoring() {
        setInterval(() => {
            this.checkHealth();
        }, 1800000); // 30 minutes = 1800000 ms
    }
    
    // 🏥 Vérifier l'état global
    checkHealth() {
        if (!window.apiQueue) {
            console.warn('⚠️ API Queue non disponible');
            return;
        }
        
        const stats = window.apiQueue.getStats();
        this.checks.apiQueueSize = stats.queueSize;
        this.checks.averageWaitTime = stats.avgWaitTime;
        this.checks.lastCheckTime = Date.now();
        
        // Évaluer la santé
        let health = 'HEALTHY';
        let warnings = [];
        
        // Vérification 1: Taille de la queue
        if (stats.queueSize > this.alertThresholds.maxQueueSize) {
            health = 'DEGRADED';
            warnings.push(`🔴 Queue saturée: ${stats.queueSize}/${this.alertThresholds.maxQueueSize} requêtes`);
        } else if (stats.queueSize > 30) {
            health = 'CAUTION';
            warnings.push(`🟡 Queue élevée: ${stats.queueSize} requêtes`);
        }
        
        // Vérification 2: Temps d'attente
        if (stats.avgWaitTime > this.alertThresholds.maxWaitTime) {
            health = 'DEGRADED';
            warnings.push(`🔴 Temps d'attente élevé: ${Math.round(stats.avgWaitTime)}ms`);
        } else if (stats.avgWaitTime > 3000) {
            health = 'CAUTION';
            warnings.push(`🟡 Temps d'attente: ${Math.round(stats.avgWaitTime)}ms`);
        }
        
        // Vérification 3: Taux d'erreur
        const errorRate = stats.totalErrors / Math.max(stats.totalRequests, 1);
        if (errorRate > this.alertThresholds.maxErrorRate) {
            health = 'DEGRADED';
            warnings.push(`🔴 Taux d'erreur élevé: ${(errorRate * 100).toFixed(1)}%`);
        }
        
        this.checks.apiQueueHealth = health;
        
        // Logger les avertissements
        if (warnings.length > 0) {
            const logLevel = health === 'DEGRADED' ? 'ERROR' : 'WARNING';
            warnings.forEach(w => log(w, logLevel));
            // Afficher le dashboard complet en cas de problème
            this.displayDashboard(stats, health);
        } else if (health === 'HEALTHY') {
            // ✅ HEALTHYY: Affichage simplifié, une seule ligne par 30 minutes
            log(`✅ BOT HEALTH CHECK - Système sain | Queue: ${stats.queueSize}/50 | Requêtes: ${stats.totalRequests} | Erreurs: ${stats.totalErrors}`, 'DEBUG');
        }
    }
    
    // 📊 Afficher un dashboard dans la console
    displayDashboard(stats, health) {
        const emoji = health === 'HEALTHY' ? '✅' : health === 'CAUTION' ? '🟡' : '🔴';
        const color = health === 'HEALTHY' ? '#10b981' : health === 'CAUTION' ? '#f59e0b' : '#ef4444';
        
        console.log(`%c${emoji} BOT HEALTH - ${health}`, `color: ${color}; font-weight: bold; font-size: 14px`);
        console.table({
            '🎯 API Queue': {
                'Running Requests': stats.running,
                'Pending Queue': stats.queueSize,
                'Max Queue Ever': stats.maxQueueSize,
                'Total Requests': stats.totalRequests,
                'Total Errors': stats.totalErrors,
                'Cache Size': stats.cacheSize
            },
            '⏱️ Timings': {
                'Average Wait': `${Math.round(stats.avgWaitTime)}ms`,
                'Max Concurrent': 3,
                'Request Timeout': '8000ms'
            }
        });
    }
    
    // 🎯 Obtenir un rapport complet
    getFullReport() {
        const stats = window.apiQueue.getStats();
        return {
            timestamp: new Date().toISOString(),
            health: this.checks.apiQueueHealth,
            apiQueue: {
                running: stats.running,
                pending: stats.queueSize,
                maxQueueEver: stats.maxQueueSize,
                totalRequests: stats.totalRequests,
                totalErrors: stats.totalErrors,
                cacheSize: stats.cacheSize,
                errorRate: ((stats.totalErrors / Math.max(stats.totalRequests, 1)) * 100).toFixed(2) + '%'
            },
            timing: {
                avgWaitMs: Math.round(stats.avgWaitTime),
                maxConcurrent: 3,
                requestTimeoutMs: 8000
            },
            positions: {
                open: openPositions ? openPositions.length : 0,
                bot: openPositions ? openPositions.filter(p => p.isBotManaged === true).length : 0
            },
            bot: {
                running: botRunning ? 'YES' : 'NO',
                uptime: botStartTime ? Math.round((Date.now() - botStartTime) / 1000 / 60) + ' min' : 'N/A'
            }
        };
    }
}

// 🌍 Instance globale
window.botHealthMonitor = new BotHealthMonitor();

// 🛠️ Fonctions utilitaires pour le debug

// Afficher le rapport de santé complet
window.showBotHealth = function() {
    const report = window.botHealthMonitor.getFullReport();
    console.log('%c📊 BOT HEALTH REPORT', 'color: #3b82f6; font-weight: bold; font-size: 16px');
    console.log(JSON.stringify(report, null, 2));
    return report;
};

// Nettoyer le cache pour tester la recovery
window.clearAPICache = function() {
    if (window.apiQueue) {
        window.apiQueue.clearCache();
        log('🧹 API Cache vidé', 'SUCCESS');
    }
};

// Forcer un check de santé immédiat
window.checkBotHealthNow = function() {
    if (window.botHealthMonitor) {
        window.botHealthMonitor.checkHealth();
    }
};

// Afficher les stats de la queue en temps réel
window.watchAPIQueue = function() {
    if (!window.apiQueue) {
        console.error('❌ API Queue non disponible');
        return;
    }
    
    console.log('%c🔍 WATCHING API QUEUE (toutes les 2s)', 'color: #f59e0b; font-weight: bold');
    const watchInterval = setInterval(() => {
        const stats = window.apiQueue.getStats();
        const pct = (stats.queueSize / 50) * 100;
        const bar = '█'.repeat(Math.min(20, Math.round(pct / 5))) + 
                   '░'.repeat(20 - Math.min(20, Math.round(pct / 5)));
        
        console.log(`[${bar}] Queue: ${stats.queueSize}/50 | Running: ${stats.running} | Total Requests: ${stats.totalRequests}`);
    }, 2000);
    
    return watchInterval;
};

console.log('✅ Monitoring system loaded');
