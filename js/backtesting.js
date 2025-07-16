/*
 * BACKTESTING SYSTEM - SIMPLIFIED VERSION MATCHING TRADINGVIEW
 * 
 * ✅ SIMPLIFIED LOGIC:
 * - Single timeframe MACD analysis (15m by default)
 * - Long on MACD delta crossover above 0
 * - Short on MACD delta crossunder below 0
 * - MACD parameters (30, 50, 20) - Custom settings
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
 * - Direct MACD calculation with custom parameters (30, 50, 20)
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
function calculateMACD(prices, fastLength = 30, slowLength = 50, signalLength = 20) {
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
    if (prices.length < 50 + 20) return { long: false };

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
        console.log('🚀 [DEBUG] Début startBacktest - Vérification des conditions');  // NEW: Log au tout début
        
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
        
        console.log(`🔍 [DEBUG] Backtest lancé pour ${symbol} - Timeframe: ${backtestConfig.timeframe}, Duration: ${backtestConfig.duration} jours`);  // NEW: Log des params
        
        log(`🚀 Démarrage du backtesting simplifié: ${symbol} - MACD Crossover/Crossunder - ${backtestConfig.duration} jours`, 'INFO');
        
        // Récupérer les données historiques
        await fetchHistoricalData(symbol);
        
        if (!backtestData || backtestData.length === 0) {
            throw new Error('Impossible de récupérer les données historiques');
        }
        
        // Exécuter le backtesting avec la logique simplifiée
        await runSimplifiedBacktest(symbol);

        console.log('✅ [DEBUG] Fin simulation backtest - Résultats générés:', !!backtestResults);  // NEW: Log de fin de simulation
        
        // Afficher les résultats
        displayBacktestResults();

        console.log('🔍 [DEBUG] Fin startBacktest - Backtest terminé');  // NEW: Log final
        
        log('✅ Backtesting terminé avec succès', 'SUCCESS');
        
        // Arrêter automatiquement le backtesting
        backtestRunning = false;
        updateBacktestUI(false);

    } catch (error) {
        console.error('❌ [DEBUG] Erreur dans startBacktest:', error);  // NEW: Log d'erreur
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
        
        log(`📊 [BACKTEST] Début analyse de l'index 70 à ${backtestData.length} avec pas de ${sampleRate}`, 'INFO');
        
        // Parcourir les données historiques
        for (let i = 70; i < backtestData.length; i += sampleRate) {
            try {
                const currentCandle = backtestData[i];
                
                if (!currentCandle) {
                    log(`❌ [BACKTEST] Bougie manquante à l'index ${i}`, 'ERROR');
                    continue;
                }
                
                // NEW: Log par bougie pour tracer la progression (seulement tous les 100 pour éviter le spam)
                if (i % 100 === 0) {
                    console.log(`🔍 [DEBUG] Analyse bougie #${i} - Timestamp: ${currentCandle.timestamp}`);
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
        const totalCandles = expectedCandles + 150; // Ajouter 150 bougies pour les indicateurs MACD (30,50,20)
        
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
        console.log('🔍 [DEBUG] Début displayBacktestResults - Trades disponibles:', backtestResults?.trades?.length || 0);  // NEW: Log pour vérifier si on atteint cette fonction
        
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
        
        // Trier les trades par ordre chronologique (du plus ancien au plus récent)
        const sortedTrades = backtestResults.trades.sort((a, b) => a.entryTime - b.entryTime);
        
        let html = '';
        sortedTrades.forEach((trade, index) => {
            const isProfit = trade.pnl > 0;
            
            // Formatage des dates et heures
            const entryTime = new Date(trade.entryTime);
            const exitTime = new Date(trade.exitTime);
            
            // Format jour/mois
            const entryDay = entryTime.getDate().toString().padStart(2, '0');
            const entryMonth = (entryTime.getMonth() + 1).toString().padStart(2, '0');
            const exitDay = exitTime.getDate().toString().padStart(2, '0');
            const exitMonth = (exitTime.getMonth() + 1).toString().padStart(2, '0');
            
            // Format heures
            const entryHour = entryTime.getHours().toString().padStart(2, '0') + 'h' + entryTime.getMinutes().toString().padStart(2, '0');
            const exitHour = exitTime.getHours().toString().padStart(2, '0') + 'h' + exitTime.getMinutes().toString().padStart(2, '0');
            
            html += `
                <div class="trade-item ${isProfit ? 'profit' : 'loss'}" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee; ${isProfit ? 'background: #f0f8f0;' : 'background: #fff0f0;'}">
                    <div class="trade-info">
                        <div class="trade-symbol" style="font-weight: bold;">${trade.symbol} ${trade.side}</div>
                        <div class="trade-details" style="font-size: 12px; color: #666;">
                            Entrée: ${Math.round(trade.entryPrice)} → Sortie: ${Math.round(trade.exitPrice)}
                        </div>
                        <div style="font-size: 12px; color: #666; margin-top: 2px;">
                            ${entryDay}/${entryMonth} - Heure entrée : ${entryHour} → Sortie : ${exitDay}/${exitMonth} ${exitHour}
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
            strategy: 'MACD (30,50,20) Crossover LONG seulement (simplifié)',
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
                        fastLength: 30,
                        slowLength: 50,
                        MACDLength: 20,
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












