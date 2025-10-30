// 📊 SYSTÈME DE TRACKING DU SOLDE ET HISTORIQUE
// Ce module gère le suivi du solde avec graphiques et statistiques
console.log('📁 Loading balance-tracker.js...');

// Configuration du tracker
const TRACKER_CONFIG = {
    storageKey: 'trading_bot_balance_history',
    maxHourlySnapshots: 24 * 30, // 30 jours d'historique horaire
    maxDailySnapshots: 365, // 1 an d'historique quotidien
    snapshotInterval: 60 * 60 * 1000, // 1 heure en millisecondes
    enableConsole: false
};

// Classe pour gérer le tracking du solde
class BalanceTracker {
    constructor() {
        this.hourlyHistory = [];
        this.dailyHistory = [];
        this.loadHistory();
        this.lastSnapshotTime = 0;
        this.chartInstance = null;
        this.currentView = 'hours'; // 'hours' ou 'days'
        console.log(`✅ Balance Tracker initialisé avec ${this.hourlyHistory.length} snapshots horaires et ${this.dailyHistory.length} snapshots journaliers`);
    }

    // Charger l'historique depuis localStorage
    loadHistory() {
        try {
            const stored = localStorage.getItem(TRACKER_CONFIG.storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                this.hourlyHistory = data.hourly || [];
                this.dailyHistory = data.daily || [];
                console.log(`📂 Historique chargé: ${this.hourlyHistory.length} heures, ${this.dailyHistory.length} jours`);
            }
        } catch (error) {
            console.error('❌ Erreur chargement historique:', error);
        }
    }

    // Sauvegarder l'historique dans localStorage
    saveHistory() {
        try {
            // Limiter le nombre de snapshots
            if (this.hourlyHistory.length > TRACKER_CONFIG.maxHourlySnapshots) {
                this.hourlyHistory = this.hourlyHistory.slice(-TRACKER_CONFIG.maxHourlySnapshots);
            }
            if (this.dailyHistory.length > TRACKER_CONFIG.maxDailySnapshots) {
                this.dailyHistory = this.dailyHistory.slice(-TRACKER_CONFIG.maxDailySnapshots);
            }
            
            const data = {
                hourly: this.hourlyHistory,
                daily: this.dailyHistory
            };
            
            localStorage.setItem(TRACKER_CONFIG.storageKey, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('❌ Erreur sauvegarde historique:', error);
            return false;
        }
    }

    // Prendre un snapshot du solde actuel
    takeSnapshot() {
        try {
            const now = new Date();
            const balance = this.getCurrentBalance();
            
            if (balance === null || balance === undefined) {
                console.warn('⚠️ Impossible de prendre un snapshot: solde non disponible');
                return false;
            }

            const snapshot = {
                timestamp: now.toISOString(),
                balance: balance,
                hour: now.getHours(),
                date: now.toISOString().split('T')[0], // YYYY-MM-DD
                positions: openPositions ? openPositions.length : 0,
                botRunning: window.botRunning || false
            };

            // Ajouter aux snapshots horaires
            this.hourlyHistory.push(snapshot);
            
            // Agrégation journalière : moyenne du dernier jour pour chaque date
            this.updateDailyHistory(snapshot);
            
            this.saveHistory();
            this.lastSnapshotTime = Date.now();
            
            if (TRACKER_CONFIG.enableConsole) {
                console.log(`📸 Snapshot pris: ${balance.toFixed(2)}$ à ${now.toLocaleTimeString()}`);
            }
            
            return true;
        } catch (error) {
            console.error('❌ Erreur prise de snapshot:', error);
            return false;
        }
    }

    // Obtenir le solde actuel depuis l'interface
    getCurrentBalance() {
        try {
            // Essayer de récupérer depuis l'élément d'interface
            const balanceEl = document.getElementById('balance');
            if (balanceEl && balanceEl.textContent) {
                const balanceText = balanceEl.textContent.replace('$', '').replace(',', '').trim();
                const balance = parseFloat(balanceText);
                if (!isNaN(balance)) {
                    return balance;
                }
            }
            
            // Fallback: essayer depuis la variable globale si elle existe
            if (window.currentBalance !== undefined && window.currentBalance !== null) {
                return window.currentBalance;
            }
            
            return null;
        } catch (error) {
            console.error('❌ Erreur récupération solde:', error);
            return null;
        }
    }

    // Mettre à jour l'historique journalier
    updateDailyHistory(snapshot) {
        const date = snapshot.date;
        
        // Trouver si on a déjà un snapshot pour cette date
        const existingIndex = this.dailyHistory.findIndex(s => s.date === date);
        
        if (existingIndex >= 0) {
            // Mettre à jour avec la dernière valeur du jour
            this.dailyHistory[existingIndex] = {
                timestamp: snapshot.timestamp,
                balance: snapshot.balance,
                date: date,
                positions: snapshot.positions,
                botRunning: snapshot.botRunning
            };
        } else {
            // Ajouter un nouveau snapshot journalier
            this.dailyHistory.push({
                timestamp: snapshot.timestamp,
                balance: snapshot.balance,
                date: date,
                positions: snapshot.positions,
                botRunning: snapshot.botRunning
            });
        }
    }

    // Vérifier s'il est temps de prendre un snapshot (toutes les heures)
    shouldTakeSnapshot() {
        const now = Date.now();
        const timeSinceLastSnapshot = now - this.lastSnapshotTime;
        
        // Prendre un snapshot toutes les heures
        if (timeSinceLastSnapshot >= TRACKER_CONFIG.snapshotInterval) {
            return true;
        }
        
        // Prendre un snapshot si on n'en a jamais pris
        if (this.hourlyHistory.length === 0) {
            return true;
        }
        
        return false;
    }

    // Obtenir les données pour la vue horaire (24 dernières heures)
    getHourlyData() {
        const last24h = this.hourlyHistory.slice(-24);
        return {
            labels: last24h.map(s => {
                const date = new Date(s.timestamp);
                return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            }),
            values: last24h.map(s => s.balance),
            data: last24h
        };
    }

    // Obtenir les données pour la vue journalière (30 derniers jours)
    getDailyData() {
        const last30d = this.dailyHistory.slice(-30);
        return {
            labels: last30d.map(s => {
                const date = new Date(s.timestamp);
                return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
            }),
            values: last30d.map(s => s.balance),
            data: last30d
        };
    }

    // Calculer les statistiques avancées
    calculateStats(data) {
        if (!data || data.length === 0) {
            return {
                currentBalance: 0,
                startBalance: 0,
                totalProfit: 0,
                profitPercent: 0,
                maxBalance: 0,
                minBalance: 0,
                maxDrawdown: 0,
                maxDrawdownPercent: 0,
                avgBalance: 0,
                volatility: 0,
                bestPeriod: 0,
                worstPeriod: 0,
                profitablePeriods: 0,
                totalPeriods: 0,
                winRate: 0
            };
        }

        const balances = data.map(s => s.balance);
        const currentBalance = balances[balances.length - 1];
        const startBalance = balances[0];
        const totalProfit = currentBalance - startBalance;
        const profitPercent = startBalance > 0 ? (totalProfit / startBalance) * 100 : 0;
        
        const maxBalance = Math.max(...balances);
        const minBalance = Math.min(...balances);
        const avgBalance = balances.reduce((a, b) => a + b, 0) / balances.length;
        
        // Calculer le drawdown maximum
        let maxDrawdown = 0;
        let maxDrawdownPercent = 0;
        let peak = balances[0];
        
        for (let i = 0; i < balances.length; i++) {
            if (balances[i] > peak) {
                peak = balances[i];
            }
            const drawdown = peak - balances[i];
            const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;
            
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
                maxDrawdownPercent = drawdownPercent;
            }
        }
        
        // Calculer les variations période par période
        const changes = [];
        for (let i = 1; i < balances.length; i++) {
            changes.push(balances[i] - balances[i - 1]);
        }
        
        const bestPeriod = changes.length > 0 ? Math.max(...changes) : 0;
        const worstPeriod = changes.length > 0 ? Math.min(...changes) : 0;
        const profitablePeriods = changes.filter(c => c > 0).length;
        const totalPeriods = changes.length;
        const winRate = totalPeriods > 0 ? (profitablePeriods / totalPeriods) * 100 : 0;
        
        // Calculer la volatilité (écart-type)
        const variance = balances.reduce((sum, val) => sum + Math.pow(val - avgBalance, 2), 0) / balances.length;
        const volatility = Math.sqrt(variance);
        
        return {
            currentBalance,
            startBalance,
            totalProfit,
            profitPercent,
            maxBalance,
            minBalance,
            maxDrawdown,
            maxDrawdownPercent,
            avgBalance,
            volatility,
            bestPeriod,
            worstPeriod,
            profitablePeriods,
            totalPeriods,
            winRate
        };
    }

    // Créer ou mettre à jour le graphique
    updateChart() {
        const canvas = document.getElementById('balanceChart');
        if (!canvas) {
            console.warn('⚠️ Canvas du graphique non trouvé');
            return;
        }

        const ctx = canvas.getContext('2d');
        const data = this.currentView === 'hours' ? this.getHourlyData() : this.getDailyData();
        
        if (data.values.length === 0) {
            // Afficher un message si pas de données
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '16px Arial';
            ctx.fillStyle = '#9ca3af';
            ctx.textAlign = 'center';
            ctx.fillText('Aucune donnée disponible', canvas.width / 2, canvas.height / 2);
            return;
        }

        // Détruire l'ancien graphique s'il existe
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        // Créer le nouveau graphique avec Chart.js
        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Solde ($)',
                    data: data.values,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#10b981',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                return 'Solde: $' + context.parsed.y.toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#9ca3af',
                            maxRotation: 45,
                            minRotation: 0
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#9ca3af',
                            callback: function(value) {
                                return '$' + value.toFixed(0);
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    // Mettre à jour l'affichage des statistiques
    updateStatsDisplay() {
        const data = this.currentView === 'hours' ? this.getHourlyData().data : this.getDailyData().data;
        const stats = this.calculateStats(data);
        
        // Mettre à jour chaque stat dans l'interface
        const statsElements = {
            'stat-current': `$${stats.currentBalance.toFixed(2)}`,
            'stat-start': `$${stats.startBalance.toFixed(2)}`,
            'stat-profit': `${stats.totalProfit >= 0 ? '+' : ''}$${stats.totalProfit.toFixed(2)}`,
            'stat-profit-percent': `${stats.profitPercent >= 0 ? '+' : ''}${stats.profitPercent.toFixed(2)}%`,
            'stat-max': `$${stats.maxBalance.toFixed(2)}`,
            'stat-min': `$${stats.minBalance.toFixed(2)}`,
            'stat-avg': `$${stats.avgBalance.toFixed(2)}`,
            'stat-drawdown': `-$${stats.maxDrawdown.toFixed(2)} (-${stats.maxDrawdownPercent.toFixed(2)}%)`,
            'stat-best': `+$${stats.bestPeriod.toFixed(2)}`,
            'stat-worst': `$${stats.worstPeriod.toFixed(2)}`,
            'stat-winrate': `${stats.winRate.toFixed(1)}% (${stats.profitablePeriods}/${stats.totalPeriods})`
        };
        
        for (const [id, value] of Object.entries(statsElements)) {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = value;
                
                // Ajouter des couleurs selon la valeur
                if (id.includes('profit') && stats.totalProfit >= 0) {
                    el.style.color = '#10b981';
                } else if (id.includes('profit') && stats.totalProfit < 0) {
                    el.style.color = '#ef4444';
                } else if (id === 'stat-best') {
                    el.style.color = '#10b981';
                } else if (id === 'stat-worst') {
                    el.style.color = '#ef4444';
                } else if (id === 'stat-drawdown') {
                    el.style.color = '#f59e0b';
                }
            }
        }
    }

    // Changer la vue (heures/jours)
    switchView(view) {
        this.currentView = view;
        
        // Mettre à jour les boutons
        const hoursBtn = document.getElementById('view-hours-btn');
        const daysBtn = document.getElementById('view-days-btn');
        
        if (hoursBtn && daysBtn) {
            if (view === 'hours') {
                hoursBtn.classList.add('active');
                daysBtn.classList.remove('active');
            } else {
                hoursBtn.classList.remove('active');
                daysBtn.classList.add('active');
            }
        }
        
        // Mettre à jour le graphique et les stats
        this.updateChart();
        this.updateStatsDisplay();
    }

    // Export des données en CSV
    exportToCSV() {
        try {
            const data = this.currentView === 'hours' ? this.hourlyHistory : this.dailyHistory;
            
            if (data.length === 0) {
                alert('⚠️ Aucune donnée à exporter');
                return;
            }
            
            // Créer le CSV
            let csv = 'Timestamp,Balance,Positions,Bot Running\n';
            data.forEach(snapshot => {
                csv += `${snapshot.timestamp},${snapshot.balance},${snapshot.positions},${snapshot.botRunning}\n`;
            });
            
            // Télécharger le fichier
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `balance_history_${this.currentView}_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('✅ Données exportées en CSV');
            return true;
        } catch (error) {
            console.error('❌ Erreur export CSV:', error);
            return false;
        }
    }

    // Effacer tout l'historique
    clearHistory() {
        if (confirm('⚠️ Êtes-vous sûr de vouloir effacer tout l\'historique? Cette action est irréversible.')) {
            this.hourlyHistory = [];
            this.dailyHistory = [];
            this.saveHistory();
            this.updateChart();
            this.updateStatsDisplay();
            console.log('🗑️ Historique effacé');
            return true;
        }
        return false;
    }
}

// Créer une instance globale du tracker
window.balanceTracker = new BalanceTracker();

// Prendre un snapshot automatiquement toutes les heures
setInterval(() => {
    if (window.balanceTracker && window.balanceTracker.shouldTakeSnapshot()) {
        window.balanceTracker.takeSnapshot();
        
        // Mettre à jour l'affichage si la section est visible
        const section = document.getElementById('balance-history-section');
        if (section && section.style.display !== 'none') {
            window.balanceTracker.updateChart();
            window.balanceTracker.updateStatsDisplay();
        }
    }
}, 60000); // Vérifier toutes les minutes

// Prendre un snapshot initial au chargement
setTimeout(() => {
    if (window.balanceTracker) {
        window.balanceTracker.takeSnapshot();
    }
}, 5000); // Attendre 5 secondes que le solde soit chargé

// Fonctions globales pour faciliter l'utilisation
window.exportBalanceHistory = function() {
    return window.balanceTracker.exportToCSV();
};

window.clearBalanceHistory = function() {
    return window.balanceTracker.clearHistory();
};

window.takeBalanceSnapshot = function() {
    return window.balanceTracker.takeSnapshot();
};

console.log('✅ Balance Tracker chargé et prêt à l\'emploi');

