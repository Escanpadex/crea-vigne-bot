/*
 * BACKTESTING SYSTEM - SIMPLIFIED VERSION MATCHING TRADINGVIEW
 * 
 * ✅ SIMPLIFIED LOGIC:
 * - Single timeframe MACD analysis (15m by default)
 * - Long on MACD delta crossover above 0
 * - Short on MACD delta crossunder below 0
 * - Exact same MACD parameters as TradingView (12, 26, 9)
 * - Support for both LONG and SHORT positions
 * - Proper trailing stop for both directions
 * 
 * REMOVED ELEMENTS:
 * - Multi-timeframe analysis (4H, 1H filtering)
 * - Extended data fetching
 * - Persistent signals system
 * - Complex signal filtering
 * 
 * 🔧 SIMPLIFIED APPROACH:
 * - Direct MACD calculation matching TradingView
 * - Simple crossover/crossunder detection
 * - Unified position management for LONG/SHORT
 * - Precision trailing stop support maintained
 */

// Backtesting System for Trading Strategies
console.log('📁 Loading simplified backtesting.js...');

// Variables globales pour le backtesting avec gardes d'initialisation
let backtestRunning = false;
let backtestData = null;
let backtestResults = null;
let backtestInterval = null;
let equityChart = null;
let precisionData = [];  // Nouvelle variable globale pour stocker toutes les bougies de précision (ex. 3m) pré-chargées

// Configuration du backtesting (simplifiée)
let backtestConfig = {
    timeframe: '15m', // Base for simulation
    duration: 7, // jours
    capital: 1000, // Capital fixe
    positionSize: 10, // pourcentage
    trailingStop: 1.5, // pourcentage
    disableSampling: true, // analyser toutes les bougies
    
    // Options de debug
    debugMode: false, // Mode debug avec logs détaillés
    
    // Options de précision pour trailing stop
    enablePrecisionTrailingStop: true, // Activer la vérification précision pour trailing stop
    precisionTrailingStopDebug: false, // Logs détaillés pour le trailing stop précision
};

// NOUVELLE FONCTION : Gardes d'initialisation pour les variables globales
function initializeBacktestingVariables() {
    try {
        console.log('🔍 [INIT] Initialisation des variables de backtesting...');
        
        // Réinitialiser les variables si nécessaire
        if (typeof backtestRunning !== 'boolean') {
            backtestRunning = false;
            console.log('⚠️ [INIT] backtestRunning réinitialisé à false');
        }
        
        if (backtestData !== null && (!Array.isArray(backtestData) || backtestData.length === 0)) {
            backtestData = null;
            console.log('⚠️ [INIT] backtestData réinitialisé à null');
        }
        
        if (backtestResults !== null && typeof backtestResults !== 'object') {
            backtestResults = null;
            console.log('⚠️ [INIT] backtestResults réinitialisé à null');
        }
        
        if (backtestInterval !== null && typeof backtestInterval !== 'number' && typeof backtestInterval !== 'object') {
            backtestInterval = null;
            console.log('⚠️ [INIT] backtestInterval réinitialisé à null');
        }
        
        if (equityChart !== null && typeof equityChart !== 'object') {
            equityChart = null;
            console.log('⚠️ [INIT] equityChart réinitialisé à null');
        }
        
        // Valider et corriger la configuration
        if (!backtestConfig || typeof backtestConfig !== 'object') {
            backtestConfig = {
                timeframe: '15m',
                duration: 7,
                capital: 1000,
                positionSize: 10,
                trailingStop: 1.5,
                disableSampling: true
            };
            console.log('⚠️ [INIT] backtestConfig réinitialisé avec valeurs par défaut');
        }
        
        console.log('✅ [INIT] Variables de backtesting initialisées et validées');
        return true;
        
    } catch (error) {
        console.error('❌ [INIT] Erreur lors de l\'initialisation des variables:', error);
        return false;
    }
}

// NOUVELLE FONCTION : Validation des variables avant exécution
function validateBacktestingState() {
    const validationErrors = [];
    
    try {
        // Vérifier l'état des variables critiques
        if (typeof backtestRunning !== 'boolean') {
            validationErrors.push('backtestRunning n\'est pas un booléen');
        }
        
        if (backtestRunning && backtestData === null) {
            validationErrors.push('backtestData est null alors que le backtesting est en cours');
        }
        
        if (backtestData !== null && (!Array.isArray(backtestData) || backtestData.length === 0)) {
            validationErrors.push('backtestData est invalide');
        }
        
        if (!backtestConfig || typeof backtestConfig !== 'object') {
            validationErrors.push('backtestConfig est invalide');
        }
        
        // Vérifier les propriétés critiques de la configuration
        if (backtestConfig) {
            if (typeof backtestConfig.capital !== 'number' || backtestConfig.capital <= 0) {
                validationErrors.push('backtestConfig.capital est invalide');
            }
            
            if (typeof backtestConfig.positionSize !== 'number' || backtestConfig.positionSize <= 0 || backtestConfig.positionSize > 100) {
                validationErrors.push('backtestConfig.positionSize est invalide');
            }
            
            if (typeof backtestConfig.trailingStop !== 'number' || backtestConfig.trailingStop <= 0 || backtestConfig.trailingStop > 10) {
                validationErrors.push('backtestConfig.trailingStop est invalide');
            }
        }
        
        if (validationErrors.length > 0) {
            console.error('❌ [VALIDATION] Erreurs de validation:', validationErrors);
            return false;
        }
        
        console.log('✅ [VALIDATION] État du backtesting validé');
        return true;
        
    } catch (error) {
        console.error('❌ [VALIDATION] Erreur lors de la validation:', error);
        return false;
    }
}

// NOUVELLE FONCTION : Nettoyage sécurisé des variables
function cleanupBacktestingVariables() {
    try {
        console.log('🧹 [CLEANUP] Nettoyage des variables de backtesting...');
        
        // Nettoyer les données
        backtestData = null;
        backtestResults = null;
        
        // Nettoyer les timers
        if (backtestInterval) {
            clearInterval(backtestInterval);
            backtestInterval = null;
        }
        
        // Nouveau: Nettoyer les données de précision
        precisionData = [];
        
        // Nettoyer les graphiques
        if (equityChart) {
            try {
                equityChart.destroy();
            } catch (chartError) {
                console.warn('⚠️ [CLEANUP] Erreur lors de la destruction du graphique:', chartError);
            }
            equityChart = null;
        }
        
        // Nettoyer le graphique TradingView
        if (backtestTradingViewWidget) {
            try {
                backtestTradingViewWidget.remove();
            } catch (chartError) {
                console.warn('⚠️ [CLEANUP] Erreur lors de la destruction du widget TradingView:', chartError);
            }
            backtestTradingViewWidget = null;
        }
        
        // Nettoyer les marqueurs de trades
        clearAllTradeMarkers();
        
        // Réinitialiser l'état
        backtestRunning = false;
        
        console.log('✅ [CLEANUP] Variables nettoyées');
        return true;
        
    } catch (error) {
        console.error('❌ [CLEANUP] Erreur lors du nettoyage:', error);
        return false;
    }
}

// Initialiser les variables au chargement du module
initializeBacktestingVariables();

// NOUVELLE FONCTION : Calcul MACD simplifié pour correspondre exactement à TradingView
function calculateMACD(prices, fastLength = 12, slowLength = 26, signalLength = 9) {
    if (prices.length < slowLength + signalLength) {
        return null;
    }
    
    const emaFast = calculateEMA(prices, fastLength);
    const emaSlow = calculateEMA(prices, slowLength);
    const macdLine = emaFast.map((val, i) => val - emaSlow[i]);
    const signalLine = calculateEMA(macdLine, signalLength);
    const delta = macdLine.map((val, i) => val - signalLine[i]);
    
    return { macdLine, signalLine, delta };
}

// NOUVELLE FONCTION : Détection des signaux MACD correspondant exactement à TradingView
function getMACDSignal(historicalData, i) {
    const prices = historicalData.slice(0, i + 1).map(c => c.close);
    if (prices.length < 26 + 9) return { long: false };

    const macdData = calculateMACD(prices);
    if (!macdData) return { long: false };
    
    const { delta } = macdData;
    const currentDelta = delta[delta.length - 1];
    const prevDelta = delta[delta.length - 2];

    const crossover = prevDelta <= 0 && currentDelta > 0;

    if (backtestConfig.debugMode) {
        if (crossover) {
            log(`🔍 [MACD_SIGNAL] Index ${i}: CROSSOVER (prev: ${prevDelta.toFixed(6)}, curr: ${currentDelta.toFixed(6)})`, 'DEBUG');
        }
    }

    return { long: crossover };
}

// Fonction pour démarrer le backtesting (SIMPLIFIÉE)
async function startBacktest() {
    try {
        // Validation préliminaire des variables
        if (!validateBacktestingState()) {
            console.error('❌ [VALIDATION] État invalide, réinitialisation des variables...');
            initializeBacktestingVariables();
            if (!validateBacktestingState()) {
                throw new Error('Impossible de valider l\'état du backtesting après réinitialisation');
            }
        }
        
        if (backtestRunning) {
            log('⚠️ Un backtesting est déjà en cours', 'WARNING');
            return;
        }
        
        // Vérifier l'élément chartSymbol
        const chartSymbolElement = document.getElementById('chartSymbol');
        if (!chartSymbolElement) {
            throw new Error('Élément chartSymbol manquant');
        }
        
        const selectedSymbol = chartSymbolElement.value;
        if (!selectedSymbol) {
            throw new Error('Aucun symbole sélectionné');
        }
        
        // Récupérer la configuration
        await updateBacktestConfig();
        
        // Valider la configuration
        if (!validateBacktestConfig()) {
            return;
        }
        
        // Récupérer la crypto sélectionnée
        const symbol = selectedSymbol.includes(':') ? selectedSymbol.split(':')[1] : selectedSymbol;
        
        backtestRunning = true;
        updateBacktestUI(true);
        
        log(`🚀 Démarrage du backtesting simplifié: ${symbol} - MACD Crossover/Crossunder - ${backtestConfig.duration} jours`, 'INFO');
        
        // Récupérer les données historiques
        await fetchHistoricalData(symbol);
        
        if (!backtestData || backtestData.length === 0) {
            throw new Error('Impossible de récupérer les données historiques');
        }
        
        // Exécuter le backtesting avec la logique simplifiée
        await runSimplifiedBacktest(symbol);

        // Afficher les résultats
        displayBacktestResults();

        log('✅ Backtesting terminé avec succès', 'SUCCESS');
        
        // Arrêter automatiquement le backtesting
        backtestRunning = false;
        updateBacktestUI(false);

    } catch (error) {
        log(`❌ Erreur dans startBacktest: ${error.message}`, 'ERROR');
        
        // Nettoyer les variables en cas d'erreur
        cleanupBacktestingVariables();
        
        // Arrêter automatiquement le backtesting en cas d'erreur
        backtestRunning = false;
        updateBacktestUI(false);
    }
}

// NOUVELLE FONCTION : Exécuter le backtesting avec logique simplifiée
async function runSimplifiedBacktest(symbol) {
    try {
        log('🚀 [BACKTEST] === DÉBUT DU BACKTESTING SIMPLIFIÉ ===', 'INFO');
        
        updateBacktestStatus('Exécution du backtesting avec signaux MACD simples...', 55);
        
        // Initialiser les variables de simulation
        let equity = backtestConfig.capital;
        let openTrades = [];
        let closedTrades = [];
        let equityHistory = [];
        let totalSignals = 0;
        let longSignals = 0;
        
        log(`✅ [BACKTEST] Variables initialisées - Capital: ${equity}$`, 'INFO');
        log(`📊 [BACKTEST] Configuration: Longs seulement (pas de shorts)`, 'INFO');
        
        // Vérifier les données historiques
        if (!backtestData || backtestData.length === 0) {
            throw new Error('Données historiques manquantes');
        }
        
        log(`📊 [BACKTEST] ${backtestData.length} bougies disponibles pour le backtesting`, 'INFO');
        
        // Déterminer le taux d'échantillonnage
        let sampleRate = backtestConfig.disableSampling ? 1 : Math.max(1, Math.floor(backtestData.length / 50));
        
        if (backtestConfig.disableSampling) {
            sampleRate = 1;
            log(`🔧 [BACKTEST] Sampling forcé à 1 (disableSampling=true) - Analyse complète`, 'INFO');
        }
        
        log(`📊 [BACKTEST] Début analyse de l'index 50 à ${backtestData.length} avec pas de ${sampleRate}`, 'INFO');
        
        // Parcourir les données historiques
        for (let i = 50; i < backtestData.length; i += sampleRate) {
            try {
                const currentCandle = backtestData[i];
                
                if (!currentCandle) {
                    log(`❌ [BACKTEST] Bougie manquante à l'index ${i}`, 'ERROR');
                    continue;
                }
                
                // Mettre à jour le progrès
                const progress = Math.round((i / backtestData.length) * 100);
                if (i % (sampleRate * 10) === 0) {
                    updateBacktestStatus(`Analyse bougie ${i}/${backtestData.length} (${progress}%)`, 55 + (progress * 0.4));
                }
                
                // Obtenir le signal MACD
                const signal = getMACDSignal(backtestData, i);
                totalSignals++;
                
                // Ouvrir une position LONG si signal crossover et pas de position ouverte
                if (signal.long && openTrades.length === 0) {
                    longSignals++;
                    const positionSize = (equity * backtestConfig.positionSize / 100);
                    const quantity = positionSize / currentCandle.close;
                    
                    const trade = {
                        id: Date.now(),
                        symbol: symbol,
                        side: 'LONG',
                        entryPrice: currentCandle.close,
                        quantity: quantity,
                        positionSize: positionSize,
                        entryTime: currentCandle.timestamp,
                        entryIndex: i,
                        reason: 'MACD Crossover',
                        highestPrice: currentCandle.close,
                        stopLossPrice: currentCandle.close * (1 - backtestConfig.trailingStop / 100),
                    };
                    
                    openTrades.push(trade);
                    log(`🚀 [BACKTEST] 📈 POSITION LONG OUVERTE ! Prix: ${trade.entryPrice.toFixed(4)}`, 'SUCCESS');
                }
                
                // Gérer les positions ouvertes
                for (let j = openTrades.length - 1; j >= 0; j--) {
                    const trade = openTrades[j];
                    
                    // Vérification de précision pour trailing stop
                    let precisionClose = null;
                    if (backtestConfig.enablePrecisionTrailingStop && i + 1 < backtestData.length) {
                        try {
                            precisionClose = await checkTrailingStopPrecision(trade, currentCandle, backtestData[i + 1]);
                        } catch (precisionError) {
                            log(`⚠️ [BACKTEST] Erreur vérification précision: ${precisionError.message}`, 'WARNING');
                        }
                    }
                    
                    if (precisionClose) {
                        // Fermer avec données de précision
                        const pnl = (precisionClose.exitPrice - trade.entryPrice) * trade.quantity;
                        const pnlPercent = (pnl / trade.positionSize) * 100;
                        
                        trade.exitPrice = precisionClose.exitPrice;
                        trade.exitTime = precisionClose.exitTime;
                        trade.exitReason = precisionClose.reason;
                        trade.pnl = pnl;
                        trade.pnlPercent = pnlPercent;
                        
                        equity += pnl;
                        closedTrades.push(trade);
                        openTrades.splice(j, 1);
                        
                        log(`📊 [BACKTEST] 💸 POSITION FERMÉE (PRECISION): ${precisionClose.reason}, PnL=${pnl.toFixed(2)}$`, 'INFO');
                        continue;
                    }
                    
                    // Gestion standard des positions LONG uniquement
                    // Mettre à jour le trailing stop pour LONG
                    if (currentCandle.high > trade.highestPrice) {
                        trade.highestPrice = currentCandle.high;
                        trade.stopLossPrice = trade.highestPrice * (1 - backtestConfig.trailingStop / 100);
                    }
                    
                    let closeReason = null;
                    let closePrice = null;
                    
                    // Vérifier stop loss
                    if (currentCandle.low <= trade.stopLossPrice) {
                        closeReason = 'Stop Loss';
                        closePrice = trade.stopLossPrice;
                    }
                    
                    // Fermer la position LONG
                    if (closeReason) {
                        const pnl = (closePrice - trade.entryPrice) * trade.quantity;
                        const pnlPercent = (pnl / trade.positionSize) * 100;
                        
                        trade.exitPrice = closePrice;
                        trade.exitTime = currentCandle.timestamp;
                        trade.exitReason = closeReason;
                        trade.pnl = pnl;
                        trade.pnlPercent = pnlPercent;
                        
                        equity += pnl;
                        closedTrades.push(trade);
                        openTrades.splice(j, 1);
                        
                        log(`📊 [BACKTEST] 💸 POSITION LONG FERMÉE: ${closeReason}, PnL=${pnl.toFixed(2)}$`, 'INFO');
                    }
                }
                
                // Enregistrer l'équité
                equityHistory.push({
                    timestamp: currentCandle.timestamp,
                    equity: equity,
                    drawdown: Math.max(0, (backtestConfig.capital - equity) / backtestConfig.capital * 100)
                });
                
            } catch (candleError) {
                log(`❌ [BACKTEST] Erreur à l'index ${i}: ${candleError.message}`, 'ERROR');
            }
        }
        
        // Fermer les positions ouvertes à la fin
        openTrades.forEach(trade => {
            const finalCandle = backtestData[backtestData.length - 1];
            const pnl = (finalCandle.close - trade.entryPrice) * trade.quantity;
            const pnlPercent = (pnl / trade.positionSize) * 100;
            
            trade.exitPrice = finalCandle.close;
            trade.exitTime = finalCandle.timestamp;
            trade.exitReason = 'Fin du backtesting';
            trade.pnl = pnl;
            trade.pnlPercent = pnlPercent;
            
            equity += pnl;
            closedTrades.push(trade);
        });
        
        // Statistiques finales
        log(`\n📊 [BACKTEST] === STATISTIQUES FINALES ===`, 'INFO');
        log(`📊 [BACKTEST] Total signaux analysés: ${totalSignals}`, 'INFO');
        log(`📊 [BACKTEST] Signaux LONG: ${longSignals}`, 'INFO');
        log(`📊 [BACKTEST] Positions exécutées: ${closedTrades.length}`, 'INFO');
        log(`📊 [BACKTEST] Capital final: ${equity.toFixed(2)}$ (${((equity-backtestConfig.capital)/backtestConfig.capital*100).toFixed(2)}%)`, 'INFO');
        
        // Calculer les résultats finaux
        backtestResults = {
            equity: equity,
            equityHistory: equityHistory,
            trades: closedTrades,
            totalTrades: closedTrades.length,
            winningTrades: closedTrades.filter(t => t.pnl > 0).length,
            losingTrades: closedTrades.filter(t => t.pnl < 0).length,
            totalPnL: equity - backtestConfig.capital,
            totalPnLPercent: ((equity - backtestConfig.capital) / backtestConfig.capital) * 100,
            winRate: closedTrades.length > 0 ? (closedTrades.filter(t => t.pnl > 0).length / closedTrades.length) * 100 : 0,
            maxDrawdown: Math.max(...equityHistory.map(h => h.drawdown), 0),
            avgTradeDuration: closedTrades.length > 0 ? 
                closedTrades.reduce((sum, t) => sum + (t.exitTime - t.entryTime), 0) / closedTrades.length / (1000 * 60 * 60) : 0,
            // Stats supplémentaires
            totalSignals: totalSignals,
            longSignals: longSignals,
            longTrades: closedTrades.length
        };
        
        log('✅ [BACKTEST] === BACKTESTING SIMPLIFIÉ TERMINÉ ===', 'SUCCESS');
        updateBacktestStatus('Backtesting terminé avec succès !', 100);
        
    } catch (error) {
        log(`❌ [BACKTEST] Erreur CRITIQUE: ${error.message}`, 'ERROR');
        throw error;
    }
}

// Fonction pour arrêter le backtesting (AVEC NETTOYAGE)
function stopBacktest() {
    try {
        if (!backtestRunning) {
            console.log('⚠️ Aucun backtesting en cours');
            return;
        }
        
        console.log('⏹️ Arrêt du backtesting...');
        
        // Nettoyer proprement toutes les variables
        cleanupBacktestingVariables();
        
        // Mettre à jour l'interface
        updateBacktestUI(false);
        
        log('⏹️ Backtesting arrêté par l\'utilisateur', 'INFO');
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'arrêt du backtesting:', error);
        // Forcer le nettoyage en cas d'erreur
        cleanupBacktestingVariables();
    }
}

// Mettre à jour la configuration du backtesting
async function updateBacktestConfig() {
    try {
        console.log('🔍 [DEBUG] Vérification des éléments HTML pour backtesting...');
        console.log('🔍 [DEBUG] DOM ready state:', document.readyState);
        
        // Attendre que le DOM soit prêt si nécessaire
        if (document.readyState === 'loading') {
            console.log('🔍 [DEBUG] DOM en cours de chargement, attente...');
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        const elements = {
            backtestDuration: document.getElementById('backtestDuration'),
            backtestPositionSize: document.getElementById('backtestPositionSize'),
            backtestTrailingStop: document.getElementById('backtestTrailingStop')
        };
        
        console.log('🔍 [DEBUG] Éléments recherchés:', Object.keys(elements));
        
        // Vérifier chaque élément
        for (const [name, element] of Object.entries(elements)) {
            if (!element) {
                console.error(`❌ [DEBUG] Élément HTML manquant: ${name}`);
                console.error(`❌ [DEBUG] Élément recherché avec getElementById('${name}'):`, element);
                throw new Error(`Élément HTML manquant: ${name}`);
            } else {
                console.log(`✅ [DEBUG] Élément trouvé: ${name}`);
            }
        }
        
        // Récupérer les valeurs
        const duration = elements.backtestDuration.value;
        const positionSize = elements.backtestPositionSize.value;
        const trailingStop = elements.backtestTrailingStop.value;
        
        // Construire la configuration simplifiée
        backtestConfig = {
            timeframe: '15m',
            duration: parseInt(duration),
            capital: 1000,
            positionSize: parseFloat(positionSize),
            trailingStop: parseFloat(trailingStop),
            disableSampling: true,
            debugMode: false,
            enablePrecisionTrailingStop: true,
            precisionTrailingStopDebug: false
        };
        
        log('✅ [DEBUG] Configuration simplifiée mise à jour', 'DEBUG');
        
    } catch (error) {
        console.error('❌ [DEBUG] Erreur dans updateBacktestConfig:', error);
        log(`❌ Erreur configuration backtesting: ${error.message}`, 'ERROR');
        throw error;
    }
}

// Valider la configuration du backtesting
function validateBacktestConfig() {
    if (backtestConfig.positionSize < 1 || backtestConfig.positionSize > 100) {
        alert('La taille de position doit être entre 1% et 100%');
        return false;
    }
    
    if (backtestConfig.trailingStop < 0.1 || backtestConfig.trailingStop > 5) {
        alert('Le trailing stop loss doit être entre 0.1% et 5%');
        return false;
    }
    
    return true;
}

// Récupérer les données historiques via API Binance
async function fetchHistoricalData(symbol) {
    try {
        updateBacktestStatus('Récupération des données historiques via Binance...', 10);
        
        const timeframeMs = getTimeframeMinutes(backtestConfig.timeframe) * 60 * 1000;
        const totalMs = backtestConfig.duration * 24 * 60 * 60 * 1000;
        
        // Calculer le nombre de bougies nécessaires + marge pour les indicateurs
        const expectedCandles = Math.floor(totalMs / timeframeMs);
        const totalCandles = expectedCandles + 100; // Ajouter 100 bougies pour les indicateurs
        
        log(`📊 Récupération de ${totalCandles} bougies ${backtestConfig.timeframe} pour ${backtestConfig.duration} jours`, 'INFO');
        
        const data = await getBinanceKlineData(symbol, totalCandles, backtestConfig.timeframe);
        
        if (data.length === 0) {
            throw new Error('Aucune donnée historique récupérée depuis Binance');
        }
        
        backtestData = data;
        
        // Nouveau: Pré-charger les données de précision si activé
        const precisionTimeframe = getPrecisionTimeframe(backtestConfig.timeframe);
        if (backtestConfig.enablePrecisionTrailingStop && backtestData.length > 0) {
            updateBacktestStatus('Pré-chargement des données de précision pour trailing stop...', 20);
            const startTime = backtestData[0].timestamp;
            const endTime = backtestData[backtestData.length - 1].timestamp + (getTimeframeMinutes(backtestConfig.timeframe) * 60 * 1000);  // Couvrir jusqu'à la fin
            precisionData = await fetchAllPrecisionData(symbol, startTime, endTime, precisionTimeframe);
        }
        
        updateBacktestStatus('Données historiques récupérées avec succès', 30);
        log(`✅ ${backtestData.length} bougies récupérées pour le backtesting`, 'SUCCESS');
        
    } catch (error) {
        log(`❌ Erreur récupération données: ${error.message}`, 'ERROR');
        throw error;
    }
}

// Convertir timeframe en minutes
function getTimeframeMinutes(timeframe) {
    const timeframeMap = {
        '1m': 1,
        '3m': 3,
        '5m': 5,
        '15m': 15,
        '30m': 30,
        '1h': 60,
        '4h': 240,
        '6h': 360,
        '12h': 720,
        '1d': 1440,
        '3d': 4320,
        '1w': 10080
    };
    
    return timeframeMap[timeframe] || 15;
}

// Fonction pour récupérer les données klines depuis l'API Binance
async function getBinanceKlineData(symbol, limit = 500, interval = '15m', startTime, endTime) {
    const maxRetries = 3;
    const baseDelay = 1000;
    let lastError = null;
    
    // Conversion des timeframes pour Binance
    const binanceIntervals = {
        '1m': '1m',
        '3m': '3m',
        '5m': '5m',
        '15m': '15m',
        '30m': '30m',
        '1h': '1h',
        '4h': '4h',
        '6h': '6h',
        '12h': '12h',
        '1d': '1d',
        '3d': '3d',
        '1w': '1w'
    };
    
    const binanceInterval = binanceIntervals[interval] || '15m';
    
    // Limiter à 1000 (limite Binance)
    if (limit > 1000) {
        limit = 1000;
    }
    
    let url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${limit}`;
    if (startTime) url += `&startTime=${startTime}`;
    if (endTime) url += `&endTime=${endTime}`;
    
    // Boucle de retry avec backoff exponentiel
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After') || 60;
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
                        continue;
                    }
                    throw new Error(`Rate limit dépassé: ${response.status} ${response.statusText}`);
                }
                throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data || !Array.isArray(data)) {
                throw new Error('Réponse invalide de l\'API Binance');
            }
            
            if (data.length === 0) {
                return [];
            }
            
            const klines = data.map((candle) => {
                if (!candle || !Array.isArray(candle) || candle.length < 6) {
                    return null;
                }
                
                return {
                    timestamp: parseInt(candle[0]),
                    open: parseFloat(candle[1]),
                    high: parseFloat(candle[2]),
                    low: parseFloat(candle[3]),
                    close: parseFloat(candle[4]),
                    volume: parseFloat(candle[5])
                };
            }).filter(candle => candle !== null);
            
            log(`📊 Binance: ${symbol} - ${klines.length} bougies ${interval} récupérées`, 'INFO');
            return klines;
            
        } catch (error) {
            lastError = error;
            
            if (attempt === maxRetries) {
                break;
            }
            
            const delay = baseDelay * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    const finalError = `Échec après ${maxRetries + 1} tentatives: ${lastError?.message || 'Erreur inconnue'}`;
    log(`❌ Erreur réseau Binance ${symbol}: ${finalError}`, 'ERROR');
    
    return [];
}

// Nouvelle fonction pour pré-charger toutes les données de précision en chunks
async function fetchAllPrecisionData(symbol, startTime, endTime, interval) {
    let allData = [];
    let currentStart = startTime;
    const chunkLimit = 1000;  // Limite max par requête Binance

    while (currentStart < endTime) {
        const chunk = await getBinanceKlineData(symbol, chunkLimit, interval, currentStart, endTime);
        if (chunk.length === 0) break;

        allData = allData.concat(chunk);
        currentStart = chunk[chunk.length - 1].timestamp + 1;  // Commencer après la dernière bougie du chunk
    }

    log(`✅ Pré-chargement précision: ${allData.length} bougies ${interval} récupérées pour ${symbol}`, 'SUCCESS');
    return allData;
}

// Calculer EMA
function calculateEMA(prices, period) {
    if (prices.length < period) return new Array(prices.length).fill(null);
    
    const ema = new Array(prices.length).fill(null);
    const k = 2 / (period + 1);
    
    // Première valeur = moyenne simple
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += prices[i];
    }
    ema[period - 1] = sum / period;
    
    // Calculer le reste
    for (let i = period; i < prices.length; i++) {
        ema[i] = prices[i] * k + ema[i - 1] * (1 - k);
    }
    
    return ema;
}

// Mapping des timeframes d'analyse vers les timeframes de précision pour trailing stop
function getPrecisionTimeframe(analysisTimeframe) {
    const mapping = {
        '15m': '3m',
        '1h': '5m',
        '4h': '15m',
        '1d': '1h',
        '5m': '1m',
        '30m': '5m'
    };
    return mapping[analysisTimeframe] || '1m';
}

// Récupérer les données de précision pour le trailing stop
async function getPrecisionDataForTrailing(symbol, startTime, endTime, analysisTimeframe) {
    try {
        const precisionTimeframe = getPrecisionTimeframe(analysisTimeframe);
        
        const precisionMinutes = getTimeframeMinutes(precisionTimeframe);
        const totalMinutes = Math.ceil((endTime - startTime) / (60 * 1000));
        let limit = Math.ceil(totalMinutes / precisionMinutes);
        
        if (limit > 1000) {
            limit = 1000;
        }
        
        if (limit < 2) {
            return [];
        }
        
        const klines = await getBinanceKlineData(symbol, limit, precisionTimeframe);
        
        return klines.filter(k => k.timestamp >= startTime && k.timestamp <= endTime);
    } catch (error) {
        log(`❌ Erreur récupération données précision trailing stop: ${error.message}`, 'ERROR');
        return [];
    }
}

// Vérifier le trailing stop loss avec précision selon le timeframe
async function checkTrailingStopPrecision(trade, currentCandle, nextCandle) {
    const analysisTimeframe = backtestConfig.timeframe;
    const precisionTimeframe = getPrecisionTimeframe(analysisTimeframe);
    
    if (analysisTimeframe === precisionTimeframe) {
        return null;
    }
    
    const symbol = trade.symbol;
    const endTime = nextCandle ? nextCandle.timestamp : currentCandle.timestamp + (getTimeframeMinutes(analysisTimeframe) * 60 * 1000);
    
    // Modification: Utiliser les données pré-chargées au lieu de fetch
    const filteredPrecisionData = precisionData.filter(k => k.timestamp >= currentCandle.timestamp && k.timestamp <= endTime);
    
    if (filteredPrecisionData.length === 0) {
        log(`⚠️ Aucune donnée de précision disponible pour [${currentCandle.timestamp}, ${endTime}]`, 'WARNING');
        return null;
    }
    
    // Utiliser filteredPrecisionData au lieu de precisionData
    for (const precisionCandle of filteredPrecisionData) {
        // Gestion LONG uniquement
        // Mettre à jour le prix le plus haut
        if (precisionCandle.high > trade.highestPrice) {
            trade.highestPrice = precisionCandle.high;
            trade.stopLossPrice = trade.highestPrice * (1 - backtestConfig.trailingStop / 100);
        }
        
        // Vérifier si le trailing stop est touché
        if (precisionCandle.low <= trade.stopLossPrice) {
            return {
                exitPrice: trade.stopLossPrice,
                exitTime: precisionCandle.timestamp,
                reason: `Trailing Stop Loss (${precisionTimeframe} precision)`
            };
        }
    }
    
    return null;
}

// Afficher les résultats du backtesting
function displayBacktestResults() {
    try {
        if (!backtestResults) {
            log('❌ Aucun résultat de backtesting à afficher', 'ERROR');
            return;
        }
        
        // Vérifier la présence des éléments HTML
        const elementsToCheck = [
            'backtestResults',
            'backtestProfit',
            'backtestTrades',
            'backtestWinRate',
            'backtestSharpe',
            'backtestDrawdown',
            'exportBacktestBtn'
        ];
        
        for (const elementId of elementsToCheck) {
            const element = document.getElementById(elementId);
            if (!element) {
                throw new Error(`Élément HTML manquant: ${elementId}`);
            }
        }
        
        // Afficher la section des résultats
        document.getElementById('backtestResults').style.display = 'block';
        
        // Mettre à jour les statistiques
        document.getElementById('backtestProfit').textContent = `${backtestResults.totalPnLPercent >= 0 ? '+' : ''}${backtestResults.totalPnLPercent.toFixed(2)}%`;
        document.getElementById('backtestProfit').className = `stat-value ${backtestResults.totalPnLPercent >= 0 ? '' : 'negative'}`;
        
        document.getElementById('backtestTrades').textContent = backtestResults.totalTrades;
        document.getElementById('backtestWinRate').textContent = `${backtestResults.winRate.toFixed(1)}%`;
        
        // Calculer le Sharpe ratio
        const sharpeRatio = backtestResults.totalPnLPercent > 0 ? 
            (backtestResults.totalPnLPercent / Math.max(backtestResults.maxDrawdown, 1)) : 0;
        document.getElementById('backtestSharpe').textContent = sharpeRatio.toFixed(2);
        
        document.getElementById('backtestDrawdown').textContent = `${backtestResults.maxDrawdown.toFixed(2)}%`;
        
        // Afficher l'historique des trades
        displayTradeHistory();
        
        // Afficher le bouton d'export
        document.getElementById('exportBacktestBtn').style.display = 'block';

        // Plot equity curve
        if (backtestResults.equityHistory && backtestResults.equityHistory.length > 0) {
            const timestamps = backtestResults.equityHistory.map(h => h.timestamp);
            const equity = backtestResults.equityHistory.map(h => h.equity);
            plotEquityCurve(equity, timestamps);
        }
        
        // Ajouter les marqueurs de trades sur le graphique
        addPositionedTradeMarkers();
        
    } catch (error) {
        log(`❌ Erreur affichage résultats: ${error.message}`, 'ERROR');
    }
}

function plotEquityCurve(equity, timestamps) {
    try {
        const canvas = document.getElementById('equityCurveChart');
        const placeholder = document.getElementById('chartPlaceholder');
        
        if (!canvas) {
            console.error('❌ [CHART] Canvas equityCurveChart non trouvé');
            return;
        }
        
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart if it exists
        if (equityChart) {
            equityChart.destroy();
            equityChart = null;
        }
        
        // Create new chart
        equityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timestamps.map(ts => new Date(ts).toLocaleDateString()),
                datasets: [{
                    label: 'Courbe d\'équité',
                    data: equity,
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Équité (USDT)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                }
            }
        });
        
        console.log('✅ [CHART] Graphique d\'équité créé avec succès');
        
    } catch (error) {
        console.error('❌ [CHART] Erreur création graphique:', error);
        const placeholder = document.getElementById('chartPlaceholder');
        if (placeholder) {
            placeholder.style.display = 'block';
            placeholder.textContent = '❌ Erreur lors de la création du graphique';
        }
    }
}

// Afficher l'historique des trades
function displayTradeHistory() {
    try {
        const historyDiv = document.getElementById('backtestTradeHistory');
        if (!historyDiv) {
            throw new Error('Élément backtestTradeHistory manquant');
        }
        
        if (!backtestResults || !backtestResults.trades || backtestResults.trades.length === 0) {
            historyDiv.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Aucun trade effectué</div>';
            return;
        }
        
        let html = '';
        backtestResults.trades.forEach((trade, index) => {
            const isProfit = trade.pnl > 0;
            const duration = (trade.exitTime - trade.entryTime) / (1000 * 60 * 60);
            
            html += `
                <div class="trade-item ${isProfit ? 'profit' : 'loss'}" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee; ${isProfit ? 'background: #f0f8f0;' : 'background: #fff0f0;'}">
                    <div class="trade-info">
                        <div class="trade-symbol" style="font-weight: bold;">${trade.symbol} ${trade.side}</div>
                        <div class="trade-details" style="font-size: 12px; color: #666;">
                            Entrée: ${trade.entryPrice.toFixed(4)} → Sortie: ${trade.exitPrice.toFixed(4)} 
                            (${trade.exitReason}) - ${duration.toFixed(1)}h
                        </div>
                        <div style="font-size: 11px; color: #999; margin-top: 2px;">
                            ${trade.reason}
                        </div>
                    </div>
                    <div class="trade-result ${isProfit ? 'profit' : 'loss'}" style="text-align: right; font-weight: bold; ${isProfit ? 'color: #28a745;' : 'color: #dc3545;'}">
                        ${isProfit ? '+' : ''}${trade.pnl.toFixed(2)} USDT
                        <br><small>(${trade.pnlPercent >= 0 ? '+' : ''}${trade.pnlPercent.toFixed(2)}%)</small>
                    </div>
                </div>
            `;
        });
        
        historyDiv.innerHTML = html;
        
    } catch (error) {
        log(`❌ Erreur affichage historique: ${error.message}`, 'ERROR');
    }
}

// Exporter les résultats
function exportBacktestResults() {
    if (!backtestResults) {
        alert('Aucun résultat de backtesting à exporter');
        return;
    }
    
    const data = {
        config: backtestConfig,
        results: backtestResults,
        summary: {
            symbol: document.getElementById('chartSymbol').value.split(':')[1],
            strategy: 'MACD Crossover LONG seulement (simplifié)',
            timeframe: backtestConfig.timeframe,
            duration: backtestConfig.duration,
            totalTrades: backtestResults.totalTrades,
            winRate: backtestResults.winRate,
            totalPnl: backtestResults.totalPnL,
            totalPnlPercent: backtestResults.totalPnLPercent,
            maxDrawdown: backtestResults.maxDrawdown,
            avgTradeDuration: backtestResults.avgTradeDuration
        }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backtesting_${data.summary.symbol.replace('/', '')}_MACD_LONG_Only_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    log('📊 Résultats exportés avec succès', 'SUCCESS');
}

// Mettre à jour l'interface utilisateur
function updateBacktestUI(running) {
    const startBtn = document.getElementById('startBacktestBtn');
    const stopBtn = document.getElementById('stopBacktestBtn');
    const statusDiv = document.getElementById('backtestStatus');
    
    if (startBtn) startBtn.style.display = running ? 'none' : 'block';
    if (stopBtn) stopBtn.style.display = running ? 'block' : 'none';
    if (statusDiv) statusDiv.style.display = running ? 'block' : 'none';
    
    // Désactiver les contrôles pendant l'exécution
    document.querySelectorAll('#backtesting input, #backtesting select').forEach(el => {
        el.disabled = running;
    });
}

// Mettre à jour le statut du backtesting
function updateBacktestStatus(message, progress = 0) {
    try {
        const statusTextElement = document.getElementById('backtestStatusText');
        const progressElement = document.getElementById('backtestProgress');
        const progressTextElement = document.getElementById('backtestProgressText');
        
        if (!statusTextElement || !progressElement || !progressTextElement) {
            return;
        }
        
        statusTextElement.textContent = message;
        progressElement.style.width = `${progress}%`;
        progressTextElement.textContent = `${progress}% terminé`;
        
    } catch (error) {
        log(`❌ Erreur mise à jour status: ${error.message}`, 'ERROR');
    }
}

// Fonction pour mettre à jour la paire sélectionnée
function updateSelectedPair() {
    const selectedPair = document.getElementById('chartSymbol').value;
    const symbol = selectedPair.split(':')[1];
    
    log(`🔄 Paire sélectionnée pour le backtesting: ${symbol}`, 'INFO');
    
    if (backtestRunning) {
        stopBacktest();
        log('⏹️ Backtesting arrêté - Nouvelle paire sélectionnée', 'INFO');
    }
    
    // Créer le graphique TradingView pour la nouvelle paire
    if (symbol && typeof updateBacktestChart === 'function') {
        // Vérifier si l'onglet backtesting est actif
        const backtestingTab = document.getElementById('backtesting');
        if (backtestingTab && backtestingTab.classList.contains('active')) {
            setTimeout(() => updateBacktestChart(symbol), 500);
        }
    }
}

// Rendre les fonctions accessibles globalement
window.startBacktest = startBacktest;
window.stopBacktest = stopBacktest;
window.exportBacktestResults = exportBacktestResults;
window.updateSelectedPair = updateSelectedPair;

// NOUVELLE FONCTION : Créer et mettre à jour le graphique TradingView pour backtesting
let backtestTradingViewWidget = null;

function updateBacktestChart(symbol) {
    try {
        console.log(`🔄 [CHART] Mise à jour du graphique TradingView pour ${symbol}`);
        
        // Vérifier si TradingView est disponible
        if (typeof TradingView === 'undefined') {
            console.error('❌ [CHART] TradingView non disponible');
            return;
        }
        
        const chartContainer = document.getElementById('backtestTradingViewChart');
        const placeholder = document.getElementById('backtestChartPlaceholder');
        
        if (!chartContainer) {
            console.error('❌ [CHART] Container backtestTradingViewChart non trouvé');
            return;
        }
        
        // Masquer le placeholder
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        
        // Nettoyer les marqueurs existants
        clearAllTradeMarkers();
        
        // Détruire le widget existant s'il existe
        if (backtestTradingViewWidget) {
            try {
                backtestTradingViewWidget.remove();
            } catch (error) {
                console.warn('⚠️ [CHART] Erreur lors de la suppression du widget existant:', error);
            }
            backtestTradingViewWidget = null;
        }
        
        // Vider le container
        chartContainer.innerHTML = '';
        
        // Créer un nouveau widget TradingView
        backtestTradingViewWidget = new TradingView.widget({
            autosize: true,
            symbol: `BINANCE:${symbol}`,
            interval: '15',
            timezone: 'Etc/UTC',
            theme: 'light',
            style: '1',
            locale: 'fr',
            toolbar_bg: '#f1f3f6',
            enable_publishing: false,
            hide_top_toolbar: false,
            hide_legend: false,
            save_image: false,
            container_id: 'backtestTradingViewChart',
            studies: [
                {
                    id: 'MACD@tv-basicstudies',
                    inputs: {
                        fastLength: 12,
                        slowLength: 26,
                        MACDLength: 9,
                        source: 'close'
                    }
                }
            ],
            loading_screen: {
                backgroundColor: '#f8f9fa',
                foregroundColor: '#2196F3'
            },
            disabled_features: [
                'use_localstorage_for_settings',
                'volume_force_overlay',
                'create_volume_indicator_by_default'
            ],
            enabled_features: [
                'study_templates'
            ],
            overrides: {
                'paneProperties.background': '#ffffff',
                'paneProperties.vertGridProperties.color': '#e1e4e8',
                'paneProperties.horzGridProperties.color': '#e1e4e8',
                'symbolWatermarkProperties.transparency': 90,
                'scalesProperties.textColor': '#666666'
            }
        });
        
        console.log(`✅ [CHART] Graphique TradingView créé pour ${symbol}`);
        
        // Ajouter un listener pour quand le graphique est prêt
        if (backtestTradingViewWidget.onChartReady) {
            backtestTradingViewWidget.onChartReady(() => {
                console.log('✅ [CHART] Graphique TradingView prêt');
            });
        }
        
    } catch (error) {
        console.error('❌ [CHART] Erreur création graphique TradingView:', error);
        
        // Afficher le placeholder en cas d'erreur
        const placeholder = document.getElementById('backtestChartPlaceholder');
        if (placeholder) {
            placeholder.style.display = 'block';
            placeholder.textContent = '❌ Erreur lors du chargement du graphique TradingView';
        }
    }
}

// Fonction pour tester la disponibilité de TradingView
function testTradingViewAvailability() {
    console.log('🧪 [TEST] Test de disponibilité TradingView...');
    
    if (typeof TradingView === 'undefined') {
        console.error('❌ [TEST] TradingView non disponible - Vérifiez la connexion internet');
        return false;
    }
    
    if (typeof TradingView.widget === 'undefined') {
        console.error('❌ [TEST] TradingView.widget non disponible');
        return false;
    }
    
    console.log('✅ [TEST] TradingView disponible et fonctionnel');
    return true;
}

// Rendre les nouvelles fonctions accessibles globalement
window.updateBacktestChart = updateBacktestChart;
window.testTradingViewAvailability = testTradingViewAvailability;

// Initialiser les événements
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Simplified backtesting module initialized');
    
    // Vérifier la présence des éléments critiques
    const criticalElements = [
        'chartSymbol',
        'backtestDuration',
        'backtestPositionSize',
        'backtestTrailingStop',
        'startBacktestBtn',
        'stopBacktestBtn'
    ];
    
    const missingElements = [];
    criticalElements.forEach(elementId => {
        const element = document.getElementById(elementId);
        if (!element) {
            missingElements.push(elementId);
        }
    });
    
    if (missingElements.length > 0) {
        console.warn('⚠️ Éléments HTML manquants pour le backtesting:', missingElements);
    } else {
        console.log('✅ Tous les éléments HTML critiques sont présents');
    }
});

console.log('✅ Simplified backtesting system loaded successfully');

// Ajouter les marqueurs de trades sur le graphique
function addTradeMarkersToChart() {
    try {
        console.log('📍 [MARKERS] Ajout des marqueurs de trades sur le graphique...');
        
        // Vérifier si le widget TradingView est disponible et les résultats existent
        if (!backtestTradingViewWidget || !backtestResults || !backtestResults.trades || backtestResults.trades.length === 0) {
            console.log('⚠️ [MARKERS] Widget TradingView ou résultats non disponibles');
            return;
        }
        
        // Attendre que le graphique soit complètement chargé
        setTimeout(() => {
            try {
                // Vérifier si le widget a la méthode onChartReady
                if (backtestTradingViewWidget.onChartReady) {
                    backtestTradingViewWidget.onChartReady(() => {
                        addAdvancedTradeMarkers();
                    });
                } else {
                    // Fallback: essayer d'ajouter les marqueurs directement
                    addAdvancedTradeMarkers();
                }
            } catch (error) {
                console.error('❌ [MARKERS] Erreur lors de l\'ajout des marqueurs:', error);
            }
        }, 2000); // Attendre 2 secondes que le graphique soit prêt
        
    } catch (error) {
        console.error('❌ [MARKERS] Erreur dans addTradeMarkersToChart:', error);
    }
}

// NOUVELLE FONCTION AMÉLIORÉE : Ajouter des marqueurs via l'API TradingView
function addAdvancedTradeMarkers() {
    try {
        console.log('📍 [ADVANCED_MARKERS] Ajout de marqueurs avancés...');
        
        if (!backtestResults || !backtestResults.trades || backtestResults.trades.length === 0) {
            console.log('⚠️ [ADVANCED_MARKERS] Aucun trade à marquer');
            return;
        }
        
        if (!backtestTradingViewWidget) {
            console.log('⚠️ [ADVANCED_MARKERS] Widget TradingView non disponible');
            return;
        }
        
        // Utiliser la nouvelle méthode positionnée
        addPositionedTradeMarkers();
        
    } catch (error) {
        console.error('❌ [ADVANCED_MARKERS] Erreur globale:', error);
    }
}

// Méthode 1: Utiliser l'API de marqueurs TradingView
function addMarkersWithTradingViewAPI() {
    try {
        console.log('📍 [TV_API] Tentative d\'ajout via API TradingView...');
        
        // Vérifier si le widget a une méthode pour ajouter des marqueurs
        if (backtestTradingViewWidget.onChartReady) {
            backtestTradingViewWidget.onChartReady(() => {
                try {
                    const chart = backtestTradingViewWidget.chart();
                    
                    if (chart && chart.createStudy) {
                        // Créer des marqueurs personnalisés
                        const markers = backtestResults.trades.map((trade, index) => {
                            const isProfit = trade.pnl > 0;
                            return {
                                time: Math.floor(trade.entryTime / 1000),
                                position: 'belowBar',
                                color: isProfit ? '#28a745' : '#dc3545',
                                shape: 'arrowUp',
                                text: `Entry #${index + 1}: ${trade.entryPrice.toFixed(4)}`,
                                size: 'small'
                            };
                        });
                        
                        // Ajouter les marqueurs
                        chart.setVisibleRange({
                            from: Math.floor(backtestResults.trades[0].entryTime / 1000) - 3600,
                            to: Math.floor(backtestResults.trades[backtestResults.trades.length - 1].entryTime / 1000) + 3600
                        });
                        
                        console.log(`✅ [TV_API] ${markers.length} marqueurs ajoutés via API TradingView`);
                    }
                } catch (apiError) {
                    console.error('❌ [TV_API] Erreur API:', apiError);
                }
            });
        }
        
    } catch (error) {
        console.error('❌ [TV_API] Erreur méthode API:', error);
    }
}

// Méthode 2: Ajouter des annotations visuelles
function addVisualAnnotations() {
    try {
        console.log('📍 [ANNOTATIONS] Ajout d\'annotations visuelles...');
        
        const chartContainer = document.getElementById('backtestTradingViewChart');
        if (!chartContainer) return;
        
        // Nettoyer les annotations existantes
        const existingAnnotations = chartContainer.querySelectorAll('.trade-annotation');
        existingAnnotations.forEach(annotation => annotation.remove());
        
        // Créer des annotations pour chaque trade
        backtestResults.trades.forEach((trade, index) => {
            const annotation = document.createElement('div');
            annotation.className = 'trade-annotation';
            annotation.style.cssText = `
                position: absolute;
                background: ${trade.pnl > 0 ? '#28a745' : '#dc3545'};
                color: white;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 10px;
                font-weight: bold;
                z-index: 1000;
                pointer-events: none;
                top: ${20 + (index * 25)}px;
                left: 10px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            `;
            
            const date = new Date(trade.entryTime).toLocaleString();
            const profit = trade.pnl > 0 ? '+' : '';
            
            annotation.innerHTML = `
                📍 #${index + 1}: ${trade.entryPrice.toFixed(4)} 
                <span style="font-size: 9px;">(${profit}${trade.pnl.toFixed(2)}$)</span>
            `;
            
            annotation.title = `Trade #${index + 1}\nEntrée: ${date}\nPrix: ${trade.entryPrice.toFixed(4)}\nRaison: ${trade.reason}\nPnL: ${profit}${trade.pnl.toFixed(2)}$ (${trade.pnlPercent.toFixed(2)}%)`;
            
            chartContainer.appendChild(annotation);
        });
        
        console.log(`✅ [ANNOTATIONS] ${backtestResults.trades.length} annotations ajoutées`);
        
    } catch (error) {
        console.error('❌ [ANNOTATIONS] Erreur:', error);
    }
}

// Méthode 3: Créer des overlays personnalisés
function addCustomOverlays() {
    try {
        console.log('📍 [OVERLAYS] Ajout d\'overlays personnalisés...');
        
        const chartContainer = document.getElementById('backtestTradingViewChart');
        if (!chartContainer) return;
        
        // Créer un overlay pour les statistiques détaillées
        let overlayContainer = document.getElementById('trade-overlay-container');
        if (!overlayContainer) {
            overlayContainer = document.createElement('div');
            overlayContainer.id = 'trade-overlay-container';
            overlayContainer.style.cssText = `
                position: absolute;
                bottom: 10px;
                left: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 10px;
                border-radius: 6px;
                font-size: 11px;
                z-index: 1000;
                max-width: 300px;
                font-family: monospace;
            `;
            chartContainer.appendChild(overlayContainer);
        }
        
        // Calculer les statistiques
        const totalTrades = backtestResults.trades.length;
        const profitTrades = backtestResults.trades.filter(t => t.pnl > 0);
        const lossTrades = backtestResults.trades.filter(t => t.pnl < 0);
        const totalPnL = backtestResults.trades.reduce((sum, t) => sum + t.pnl, 0);
        const avgPnL = totalPnL / totalTrades;
        const winRate = (profitTrades.length / totalTrades) * 100;
        
        // Trouver le meilleur et le pire trade
        const bestTrade = backtestResults.trades.reduce((best, current) => 
            current.pnl > best.pnl ? current : best
        );
        const worstTrade = backtestResults.trades.reduce((worst, current) => 
            current.pnl < worst.pnl ? current : worst
        );
        
        overlayContainer.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px; color: #4CAF50;">
                📊 RÉSUMÉ DES TRADES
            </div>
            <div style="margin-bottom: 3px;">
                Total: ${totalTrades} trades | Win Rate: ${winRate.toFixed(1)}%
            </div>
            <div style="margin-bottom: 3px;">
                PnL Total: <span style="color: ${totalPnL > 0 ? '#4CAF50' : '#f44336'}">${totalPnL > 0 ? '+' : ''}${totalPnL.toFixed(2)}$</span>
            </div>
            <div style="margin-bottom: 3px;">
                PnL Moyen: <span style="color: ${avgPnL > 0 ? '#4CAF50' : '#f44336'}">${avgPnL > 0 ? '+' : ''}${avgPnL.toFixed(2)}$</span>
            </div>
            <div style="margin-bottom: 3px;">
                🏆 Meilleur: +${bestTrade.pnl.toFixed(2)}$ à ${bestTrade.entryPrice.toFixed(4)}
            </div>
            <div style="margin-bottom: 3px;">
                💸 Pire: ${worstTrade.pnl.toFixed(2)}$ à ${worstTrade.entryPrice.toFixed(4)}
            </div>
            <div style="font-size: 9px; color: #ccc; margin-top: 5px;">
                📍 ${totalTrades} points d'entrée marqués sur le graphique
            </div>
        `;
        
        console.log('✅ [OVERLAYS] Overlay personnalisé créé');
        
    } catch (error) {
        console.error('❌ [OVERLAYS] Erreur:', error);
    }
}

// Fonction pour nettoyer tous les marqueurs et overlays
function clearAllTradeMarkers() {
    try {
        console.log('🧹 [CLEANUP] Nettoyage de tous les marqueurs...');
        
        const chartContainer = document.getElementById('backtestTradingViewChart');
        if (chartContainer) {
            // Nettoyer les annotations
            const annotations = chartContainer.querySelectorAll('.trade-annotation');
            annotations.forEach(annotation => annotation.remove());
            
            // Nettoyer les overlays
            const overlayContainer = document.getElementById('trade-overlay-container');
            if (overlayContainer) {
                overlayContainer.remove();
            }
            
            // Nettoyer les marqueurs d'info
            const markersInfo = document.getElementById('trade-markers-info');
            if (markersInfo) {
                markersInfo.remove();
            }
            
            // Nettoyer les marqueurs positionnés
            clearPositionedMarkers();
        }
        
        console.log('✅ [CLEANUP] Tous les marqueurs nettoyés');
        
    } catch (error) {
        console.error('❌ [CLEANUP] Erreur nettoyage:', error);
    }
}

// NOUVELLE FONCTION SIMPLIFIÉE : Ajouter des marqueurs via les données du graphique
function addSimpleTradeMarkers() {
    try {
        console.log('📍 [SIMPLE_MARKERS] Ajout de marqueurs simplifiés...');
        
        if (!backtestResults || !backtestResults.trades || backtestResults.trades.length === 0) {
            console.log('⚠️ [SIMPLE_MARKERS] Aucun trade à marquer');
            return;
        }
        
        // Créer un indicateur visuel simple dans l'interface
        const chartContainer = document.getElementById('backtestTradingViewChart');
        if (!chartContainer) {
            console.log('⚠️ [SIMPLE_MARKERS] Container graphique non trouvé');
            return;
        }
        
        // Supprimer les marqueurs existants
        const existingMarkers = chartContainer.querySelectorAll('.trade-marker');
        existingMarkers.forEach(marker => marker.remove());
        
        // Ajouter un résumé des trades au-dessus du graphique
        let markersInfo = document.getElementById('trade-markers-info');
        if (!markersInfo) {
            markersInfo = document.createElement('div');
            markersInfo.id = 'trade-markers-info';
            markersInfo.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                background: rgba(255, 255, 255, 0.9);
                padding: 10px;
                border-radius: 6px;
                border: 1px solid #e2e8f0;
                font-size: 12px;
                z-index: 1000;
                max-width: 300px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            `;
            chartContainer.appendChild(markersInfo);
        }
        
        // Générer le contenu des marqueurs
        const totalTrades = backtestResults.trades.length;
        const profitTrades = backtestResults.trades.filter(t => t.pnl > 0).length;
        const lossTrades = totalTrades - profitTrades;
        
        markersInfo.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px; color: #2d3748;">
                📍 Points d'Entrée des Trades
            </div>
            <div style="margin-bottom: 4px;">
                <span style="color: #28a745;">✅ ${profitTrades} trades gagnants</span>
            </div>
            <div style="margin-bottom: 4px;">
                <span style="color: #dc3545;">❌ ${lossTrades} trades perdants</span>
            </div>
            <div style="margin-bottom: 8px;">
                <span style="color: #666;">📊 Total: ${totalTrades} trades</span>
            </div>
            <div style="font-size: 10px; color: #999; border-top: 1px solid #e2e8f0; padding-top: 4px;">
                Les points d'entrée sont visibles sur le graphique TradingView ci-dessous
            </div>
        `;
        
        // Ajouter les détails des trades dans les logs
        console.log(`📍 [SIMPLE_MARKERS] Résumé des ${totalTrades} trades:`);
        backtestResults.trades.forEach((trade, index) => {
            const date = new Date(trade.entryTime).toLocaleString();
            const profit = trade.pnl > 0 ? '✅' : '❌';
            console.log(`${profit} Trade #${index + 1}: ${trade.symbol} à ${trade.entryPrice.toFixed(4)} le ${date} (${trade.reason})`);
        });
        
        console.log('✅ [SIMPLE_MARKERS] Marqueurs simplifiés ajoutés');
        
    } catch (error) {
        console.error('❌ [SIMPLE_MARKERS] Erreur:', error);
    }
}

// NOUVELLE FONCTION : Positionner les marqueurs aux coordonnées exactes du graphique
function addPositionedTradeMarkers() {
    try {
        console.log('📍 [POSITIONED_MARKERS] Ajout de marqueurs positionnés...');
        
        if (!backtestResults || !backtestResults.trades || backtestResults.trades.length === 0) {
            console.log('⚠️ [POSITIONED_MARKERS] Aucun trade à marquer');
            return;
        }
        
        const chartContainer = document.getElementById('backtestTradingViewChart');
        if (!chartContainer) {
            console.log('⚠️ [POSITIONED_MARKERS] Container graphique non trouvé');
            return;
        }
        
        // Nettoyer les marqueurs existants
        clearAllTradeMarkers();
        
        // Attendre que le graphique soit chargé
        setTimeout(() => {
            try {
                // Calculer les positions des marqueurs avec synchronisation
                calculateMarkersWithChartSync();
                
                // Démarrer la synchronisation avec le zoom/défilement
                syncMarkersWithChart();
                
                // Ajouter aussi l'overlay de résumé
                addCustomOverlays();
                
            } catch (error) {
                console.error('❌ [POSITIONED_MARKERS] Erreur positionnement:', error);
                // Fallback vers les annotations fixes
                addVisualAnnotations();
            }
        }, 2000);
        
    } catch (error) {
        console.error('❌ [POSITIONED_MARKERS] Erreur globale:', error);
    }
}

// Fonction pour calculer et positionner les marqueurs
function calculateAndPositionMarkers() {
    try {
        console.log('📊 [CALC_MARKERS] Calcul des positions des marqueurs...');
        
        const chartContainer = document.getElementById('backtestTradingViewChart');
        if (!chartContainer) return;
        
        // Obtenir les dimensions du graphique
        const chartRect = chartContainer.getBoundingClientRect();
        const chartWidth = chartRect.width;
        const chartHeight = chartRect.height;
        
        console.log(`📊 [CALC_MARKERS] Dimensions graphique: ${chartWidth}x${chartHeight}`);
        
        // Calculer la période de temps couverte par le backtesting
        const trades = backtestResults.trades;
        const firstTradeTime = Math.min(...trades.map(t => t.entryTime));
        const lastTradeTime = Math.max(...trades.map(t => t.entryTime));
        
        // Obtenir aussi les données du backtesting pour les prix min/max
        let minPrice = Math.min(...backtestData.map(d => d.low));
        let maxPrice = Math.max(...backtestData.map(d => d.high));
        
        // Ajouter une marge de 5% pour les prix
        const priceRange = maxPrice - minPrice;
        minPrice -= priceRange * 0.05;
        maxPrice += priceRange * 0.05;
        
        console.log(`📊 [CALC_MARKERS] Période: ${new Date(firstTradeTime).toLocaleString()} à ${new Date(lastTradeTime).toLocaleString()}`);
        console.log(`📊 [CALC_MARKERS] Prix: ${minPrice.toFixed(4)} à ${maxPrice.toFixed(4)}`);
        
        // Calculer les positions pour chaque trade
        trades.forEach((trade, index) => {
            try {
                // Calculer la position X (temporelle)
                const timeProgress = (trade.entryTime - firstTradeTime) / (lastTradeTime - firstTradeTime);
                const xPosition = 60 + (timeProgress * (chartWidth - 120)); // Marges de 60px
                
                // Calculer la position Y (prix)
                const priceProgress = (trade.entryPrice - minPrice) / (maxPrice - minPrice);
                const yPosition = chartHeight - 60 - (priceProgress * (chartHeight - 120)); // Marges de 60px
                
                // Créer le marqueur positionné
                createPositionedMarker(trade, index, xPosition, yPosition, chartContainer);
                
            } catch (markerError) {
                console.error(`❌ [CALC_MARKERS] Erreur marqueur #${index + 1}:`, markerError);
            }
        });
        
        console.log(`✅ [CALC_MARKERS] ${trades.length} marqueurs positionnés`);
        
    } catch (error) {
        console.error('❌ [CALC_MARKERS] Erreur calcul:', error);
    }
}

// Fonction pour créer un marqueur positionné
function createPositionedMarker(trade, index, xPosition, yPosition, container) {
    try {
        const isProfit = trade.pnl > 0;
        const profit = trade.pnl > 0 ? '+' : '';
        
        // Créer le marqueur principal
        const marker = document.createElement('div');
        marker.className = 'positioned-trade-marker';
        marker.style.cssText = `
            position: absolute;
            left: ${xPosition}px;
            top: ${yPosition}px;
            width: 20px;
            height: 20px;
            background: ${isProfit ? '#28a745' : '#dc3545'};
            border: 2px solid white;
            border-radius: 50%;
            z-index: 1000;
            cursor: pointer;
            transform: translate(-50%, -50%);
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transition: all 0.2s ease;
        `;
        
        // Ajouter le numéro du trade
        const tradeNumber = document.createElement('div');
        tradeNumber.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 10px;
            font-weight: bold;
            font-family: Arial, sans-serif;
        `;
        tradeNumber.textContent = index + 1;
        marker.appendChild(tradeNumber);
        
        // Créer le tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'trade-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            bottom: 25px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 11px;
            white-space: nowrap;
            z-index: 1001;
            display: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            pointer-events: none;
        `;
        
        const entryDate = new Date(trade.entryTime);
        const dateStr = entryDate.toLocaleDateString();
        const timeStr = entryDate.toLocaleTimeString();
        
        tooltip.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 2px;">Trade #${index + 1}</div>
            <div>📅 ${dateStr} ${timeStr}</div>
            <div>💰 Entrée: ${trade.entryPrice.toFixed(4)}</div>
            <div>📊 PnL: <span style="color: ${isProfit ? '#4CAF50' : '#f44336'}">${profit}${trade.pnl.toFixed(2)}$ (${trade.pnlPercent.toFixed(2)}%)</span></div>
            <div>🔍 ${trade.reason}</div>
        `;
        
        marker.appendChild(tooltip);
        
        // Ajouter les événements hover
        marker.addEventListener('mouseenter', () => {
            tooltip.style.display = 'block';
            marker.style.transform = 'translate(-50%, -50%) scale(1.2)';
            marker.style.zIndex = '1002';
        });
        
        marker.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
            marker.style.transform = 'translate(-50%, -50%) scale(1)';
            marker.style.zIndex = '1000';
        });
        
        // Ajouter une ligne verticale pour mieux voir l'alignement temporel
        const verticalLine = document.createElement('div');
        verticalLine.className = 'trade-vertical-line';
        verticalLine.style.cssText = `
            position: absolute;
            left: ${xPosition}px;
            top: 0;
            bottom: 0;
            width: 1px;
            background: ${isProfit ? 'rgba(40, 167, 69, 0.3)' : 'rgba(220, 53, 69, 0.3)'};
            z-index: 999;
            pointer-events: none;
        `;
        
        container.appendChild(verticalLine);
        container.appendChild(marker);
        
        console.log(`✅ [MARKER] Trade #${index + 1} positionné à (${xPosition.toFixed(0)}, ${yPosition.toFixed(0)})`);
        
    } catch (error) {
        console.error(`❌ [MARKER] Erreur création marqueur #${index + 1}:`, error);
    }
}

// Fonction améliorée pour calculer les positions avec les données de backtesting
function calculateMarkersWithBacktestData() {
    try {
        console.log('📊 [CALC_IMPROVED] Calcul amélioré avec données de backtesting...');
        
        if (!backtestData || backtestData.length === 0) {
            console.log('⚠️ [CALC_IMPROVED] Données de backtesting non disponibles');
            return calculateAndPositionMarkers(); // Fallback
        }
        
        const chartContainer = document.getElementById('backtestTradingViewChart');
        if (!chartContainer) return;
        
        const chartRect = chartContainer.getBoundingClientRect();
        const chartWidth = chartRect.width;
        const chartHeight = chartRect.height;
        
        // Utiliser les données réelles du backtesting pour les calculs
        const firstCandle = backtestData[0];
        const lastCandle = backtestData[backtestData.length - 1];
        const totalTimeSpan = lastCandle.timestamp - firstCandle.timestamp;
        
        // Calculer la plage de prix réelle
        const minPrice = Math.min(...backtestData.map(d => d.low));
        const maxPrice = Math.max(...backtestData.map(d => d.high));
        const priceRange = maxPrice - minPrice;
        
        console.log(`📊 [CALC_IMPROVED] Période réelle: ${new Date(firstCandle.timestamp).toLocaleString()} à ${new Date(lastCandle.timestamp).toLocaleString()}`);
        console.log(`📊 [CALC_IMPROVED] Prix réels: ${minPrice.toFixed(4)} à ${maxPrice.toFixed(4)}`);
        
        // Positionner chaque trade
        backtestResults.trades.forEach((trade, index) => {
            try {
                // Position X basée sur le timestamp réel
                const timeProgress = (trade.entryTime - firstCandle.timestamp) / totalTimeSpan;
                const xPosition = 60 + (timeProgress * (chartWidth - 120));
                
                // Position Y basée sur le prix réel
                const priceProgress = (trade.entryPrice - minPrice) / priceRange;
                const yPosition = chartHeight - 60 - (priceProgress * (chartHeight - 120));
                
                // Créer le marqueur avec les positions calculées
                createPositionedMarker(trade, index, xPosition, yPosition, chartContainer);
                
            } catch (markerError) {
                console.error(`❌ [CALC_IMPROVED] Erreur marqueur #${index + 1}:`, markerError);
            }
        });
        
        console.log(`✅ [CALC_IMPROVED] ${backtestResults.trades.length} marqueurs positionnés avec données réelles`);
        
    } catch (error) {
        console.error('❌ [CALC_IMPROVED] Erreur calcul amélioré:', error);
        // Fallback vers la méthode standard
        calculateAndPositionMarkers();
    }
}

// Fonction pour nettoyer tous les marqueurs positionnés
function clearPositionedMarkers() {
    try {
        const chartContainer = document.getElementById('backtestTradingViewChart');
        if (chartContainer) {
            // Nettoyer les marqueurs positionnés
            const markers = chartContainer.querySelectorAll('.positioned-trade-marker');
            if (markers.length > 0) {
                markers.forEach(marker => marker.remove());
            }
            
            // Nettoyer les lignes verticales
            const lines = chartContainer.querySelectorAll('.trade-vertical-line');
            if (lines.length > 0) {
                lines.forEach(line => line.remove());
            }
            
            // Nettoyer le résumé des trades s'il existe
            const summary = chartContainer.querySelector('.trade-summary-overlay');
            if (summary) {
                summary.remove();
            }
        }
        
        console.log('✅ [CLEANUP] Marqueurs positionnés nettoyés');
        
    } catch (error) {
        console.error('❌ [CLEANUP] Erreur nettoyage marqueurs positionnés:', error);
    }
}

// Variables pour le suivi du zoom et du défilement
let chartSyncInterval = null;
let lastVisibleRange = null;
let isChartReady = false;

// NOUVELLE FONCTION : Synchroniser les marqueurs avec le zoom/défilement TradingView
function syncMarkersWithChart() {
    try {
        console.log('🔄 [SYNC] Initialisation de la synchronisation des marqueurs...');
        
        if (!backtestTradingViewWidget || !backtestResults || !backtestResults.trades) {
            console.log('⚠️ [SYNC] Widget ou résultats non disponibles');
            return;
        }
        
        // Attendre que le graphique soit prêt
        if (backtestTradingViewWidget.onChartReady) {
            backtestTradingViewWidget.onChartReady(() => {
                console.log('✅ [SYNC] Graphique prêt, démarrage de la synchronisation');
                isChartReady = true;
                startChartSynchronization();
            });
        } else {
            // Fallback si onChartReady n'est pas disponible
            setTimeout(() => {
                isChartReady = true;
                startChartSynchronization();
            }, 3000);
        }
        
    } catch (error) {
        console.error('❌ [SYNC] Erreur initialisation synchronisation:', error);
    }
}

// Fonction pour démarrer la synchronisation
function startChartSynchronization() {
    try {
        console.log('🚀 [SYNC] Démarrage de la synchronisation en temps réel...');
        
        // Nettoyer l'ancien intervalle s'il existe
        if (chartSyncInterval) {
            clearInterval(chartSyncInterval);
        }
        
        // Créer un intervalle pour vérifier les changements de vue (réduit la fréquence)
        chartSyncInterval = setInterval(() => {
            try {
                checkAndUpdateMarkerPositions();
            } catch (error) {
                console.error('❌ [SYNC] Erreur dans l\'intervalle de synchronisation:', error);
            }
        }, 250); // Vérifier toutes les 250ms (réduit le scintillement)
        
        // Ajouter des listeners pour les événements de zoom/défilement si disponibles
        addChartEventListeners();
        
        console.log('✅ [SYNC] Synchronisation démarrée');
        
    } catch (error) {
        console.error('❌ [SYNC] Erreur démarrage synchronisation:', error);
    }
}

// Variables pour optimiser la détection des changements
let lastChartState = null;
let lastUpdateTime = 0;
let isUpdating = false;

// Fonction pour vérifier et mettre à jour les positions des marqueurs
function checkAndUpdateMarkerPositions() {
    try {
        if (!isChartReady || !backtestTradingViewWidget || isUpdating) return;
        
        // Throttle: ne pas vérifier plus d'une fois par 200ms
        const now = Date.now();
        if (now - lastUpdateTime < 200) return;
        
        // Essayer d'obtenir la plage visible du graphique
        let currentVisibleRange = null;
        
        try {
            // Méthode 1: Essayer d'accéder à la plage visible via l'API
            if (backtestTradingViewWidget.chart && backtestTradingViewWidget.chart().getVisibleRange) {
                currentVisibleRange = backtestTradingViewWidget.chart().getVisibleRange();
            }
        } catch (apiError) {
            // Méthode 2: Détecter les changements via les dimensions du container
            currentVisibleRange = detectVisibleRangeChange();
        }
        
        // Vérifier si la plage visible a réellement changé
        if (hasVisibleRangeChanged(currentVisibleRange)) {
            console.log('🔄 [SYNC] Changement de vue détecté, repositionnement des marqueurs...');
            lastVisibleRange = currentVisibleRange;
            lastUpdateTime = now;
            
            // Repositionner tous les marqueurs avec protection contre les appels multiples
            repositionAllMarkers();
        }
        
    } catch (error) {
        // Erreur silencieuse pour éviter de spammer les logs
        if (error.message && !error.message.includes('getVisibleRange')) {
            console.error('❌ [SYNC] Erreur vérification positions:', error);
        }
    }
}

// Fonction pour détecter les changements de plage visible
function detectVisibleRangeChange() {
    try {
        const chartContainer = document.getElementById('backtestTradingViewChart');
        if (!chartContainer) return null;
        
        // Utiliser une heuristique basée sur les dimensions et le scroll
        const rect = chartContainer.getBoundingClientRect();
        const scrollInfo = {
            width: rect.width,
            height: rect.height,
            scrollLeft: chartContainer.scrollLeft || 0,
            scrollTop: chartContainer.scrollTop || 0,
            timestamp: Date.now()
        };
        
        return scrollInfo;
        
    } catch (error) {
        return null;
    }
}

// Fonction pour vérifier si la plage visible a changé
function hasVisibleRangeChanged(currentRange) {
    if (!lastVisibleRange || !currentRange) return true;
    
    // Comparer les plages (adaptation selon le type de données disponibles)
    if (currentRange.from !== undefined && currentRange.to !== undefined) {
        const timeThreshold = 1000; // 1 seconde de seuil
        const fromChanged = Math.abs(currentRange.from - lastVisibleRange.from) > timeThreshold;
        const toChanged = Math.abs(currentRange.to - lastVisibleRange.to) > timeThreshold;
        return fromChanged || toChanged;
    }
    
    // Fallback: comparer les dimensions et scroll (plus précis)
    if (currentRange.width !== undefined && lastVisibleRange.width !== undefined) {
        const widthChanged = Math.abs(currentRange.width - lastVisibleRange.width) > 10;
        const heightChanged = Math.abs(currentRange.height - lastVisibleRange.height) > 10;
        const scrollLeftChanged = Math.abs(currentRange.scrollLeft - lastVisibleRange.scrollLeft) > 5;
        const scrollTopChanged = Math.abs(currentRange.scrollTop - lastVisibleRange.scrollTop) > 5;
        
        return widthChanged || heightChanged || scrollLeftChanged || scrollTopChanged;
    }
    
    // Dernier recours: ne jamais déclencher sur timestamp seul
    return false;
}

// Fonction pour repositionner tous les marqueurs
function repositionAllMarkers() {
    try {
        if (isUpdating) return; // Éviter les appels multiples
        
        isUpdating = true;
        console.log('📍 [REPOSITION] Repositionnement des marqueurs...');
        
        // Nettoyer les marqueurs existants
        clearPositionedMarkers();
        
        // Recalculer et repositionner avec les nouvelles coordonnées
        setTimeout(() => {
            calculateMarkersWithChartSync();
            isUpdating = false; // Libérer le verrou
        }, 50);
        
    } catch (error) {
        console.error('❌ [REPOSITION] Erreur repositionnement:', error);
        isUpdating = false; // Libérer le verrou en cas d'erreur
    }
}

// Fonction améliorée pour calculer les positions avec synchronisation
function calculateMarkersWithChartSync() {
    try {
        console.log('📊 [CALC_SYNC] Calcul des positions avec synchronisation...');
        
        if (!backtestData || backtestData.length === 0 || !backtestResults || !backtestResults.trades) {
            console.log('⚠️ [CALC_SYNC] Données manquantes');
            return;
        }
        
        const chartContainer = document.getElementById('backtestTradingViewChart');
        if (!chartContainer) return;
        
        // Obtenir les dimensions actuelles du graphique
        const chartRect = chartContainer.getBoundingClientRect();
        const chartWidth = chartRect.width;
        const chartHeight = chartRect.height;
        
        // Essayer d'obtenir la plage visible actuelle
        let visibleTimeRange = null;
        let visiblePriceRange = null;
        
        try {
            if (backtestTradingViewWidget.chart && backtestTradingViewWidget.chart().getVisibleRange) {
                const range = backtestTradingViewWidget.chart().getVisibleRange();
                visibleTimeRange = range;
                console.log('📊 [CALC_SYNC] Plage visible obtenue:', range);
            }
        } catch (apiError) {
            console.log('⚠️ [CALC_SYNC] Impossible d\'obtenir la plage visible, utilisation des données complètes');
        }
        
        // Utiliser les données complètes si pas de plage visible
        const firstCandle = backtestData[0];
        const lastCandle = backtestData[backtestData.length - 1];
        
        const timeStart = visibleTimeRange ? visibleTimeRange.from * 1000 : firstCandle.timestamp;
        const timeEnd = visibleTimeRange ? visibleTimeRange.to * 1000 : lastCandle.timestamp;
        const totalTimeSpan = timeEnd - timeStart;
        
        // Calculer la plage de prix pour la période visible
        const visibleCandles = backtestData.filter(candle => 
            candle.timestamp >= timeStart && candle.timestamp <= timeEnd
        );
        
        let minPrice, maxPrice;
        if (visibleCandles.length > 0) {
            minPrice = Math.min(...visibleCandles.map(d => d.low));
            maxPrice = Math.max(...visibleCandles.map(d => d.high));
        } else {
            minPrice = Math.min(...backtestData.map(d => d.low));
            maxPrice = Math.max(...backtestData.map(d => d.high));
        }
        
        const priceRange = maxPrice - minPrice;
        
        console.log(`📊 [CALC_SYNC] Période visible: ${new Date(timeStart).toLocaleString()} à ${new Date(timeEnd).toLocaleString()}`);
        console.log(`📊 [CALC_SYNC] Prix visibles: ${minPrice.toFixed(4)} à ${maxPrice.toFixed(4)}`);
        
        // Repositionner chaque trade visible
        let visibleTrades = 0;
        backtestResults.trades.forEach((trade, index) => {
            try {
                // Vérifier si le trade est dans la plage visible
                if (trade.entryTime >= timeStart && trade.entryTime <= timeEnd) {
                    // Calculer la position X basée sur la plage visible
                    const timeProgress = (trade.entryTime - timeStart) / totalTimeSpan;
                    const xPosition = 60 + (timeProgress * (chartWidth - 120));
                    
                    // Calculer la position Y basée sur la plage de prix visible
                    const priceProgress = (trade.entryPrice - minPrice) / priceRange;
                    const yPosition = chartHeight - 60 - (priceProgress * (chartHeight - 120));
                    
                    // Créer le marqueur seulement s'il est dans la vue
                    if (xPosition >= 60 && xPosition <= chartWidth - 60) {
                        createPositionedMarker(trade, index, xPosition, yPosition, chartContainer);
                        visibleTrades++;
                    }
                }
                
            } catch (markerError) {
                console.error(`❌ [CALC_SYNC] Erreur marqueur #${index + 1}:`, markerError);
            }
        });
        
        console.log(`✅ [CALC_SYNC] ${visibleTrades} marqueurs repositionnés pour la vue actuelle`);
        
    } catch (error) {
        console.error('❌ [CALC_SYNC] Erreur calcul synchronisé:', error);
    }
}

// Fonction pour ajouter des listeners d'événements du graphique
function addChartEventListeners() {
    try {
        console.log('📡 [LISTENERS] Ajout des listeners d\'événements...');
        
        const chartContainer = document.getElementById('backtestTradingViewChart');
        if (!chartContainer) return;
        
        // Listener pour les événements de scroll/zoom sur le container
        chartContainer.addEventListener('wheel', (event) => {
            // Déclencher une mise à jour après un court délai
            setTimeout(() => {
                repositionAllMarkers();
            }, 100);
        });
        
        // Listener pour les changements de taille
        window.addEventListener('resize', () => {
            setTimeout(() => {
                repositionAllMarkers();
            }, 200);
        });
        
        // Essayer d'ajouter des listeners TradingView spécifiques
        try {
            if (backtestTradingViewWidget.chart) {
                const chart = backtestTradingViewWidget.chart();
                
                // Listener pour les changements de plage visible
                if (chart.onVisibleRangeChanged) {
                    chart.onVisibleRangeChanged().subscribe(null, () => {
                        setTimeout(() => {
                            repositionAllMarkers();
                        }, 50);
                    });
                }
            }
        } catch (tvError) {
            console.log('⚠️ [LISTENERS] Listeners TradingView non disponibles, utilisation des fallbacks');
        }
        
        console.log('✅ [LISTENERS] Listeners ajoutés');
        
    } catch (error) {
        console.error('❌ [LISTENERS] Erreur ajout listeners:', error);
    }
}

// Fonction pour arrêter la synchronisation
function stopChartSynchronization() {
    try {
        console.log('⏹️ [SYNC] Arrêt de la synchronisation...');
        
        if (chartSyncInterval) {
            clearInterval(chartSyncInterval);
            chartSyncInterval = null;
        }
        
        isChartReady = false;
        lastVisibleRange = null;
        
        console.log('✅ [SYNC] Synchronisation arrêtée');
        
    } catch (error) {
        console.error('❌ [SYNC] Erreur arrêt synchronisation:', error);
    }
}
