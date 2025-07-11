/*
 * BACKTESTING SYSTEM - VERSION IDENTIQUE AU TRADING PRINCIPAL
 * 
 * ✅ LOGIQUE IDENTIQUE AU TRADING :
 * - Analyse multi-timeframe 4H → 1H → 15M (identique à trading.js)
 * - Utilisation de la même fonction analyzeMultiTimeframe()
 * - Paramètres MACD fixes (non modifiables)
 * - Stratégie unique et cohérente
 * 
 * SUPPRESSION DES ÉLÉMENTS :
 * - Paramètres modifiables du MACD
 * - Sélecteur de type de stratégie
 * - Configuration de stratégie variable
 * 
 * Stratégie optimisée : Multi-timeframe → BUY strict → LONG → Fermeture par trailing stop
 */

// Backtesting System for Trading Strategies
console.log('📁 Loading backtesting.js...');

// Variables globales pour le backtesting avec gardes d'initialisation
let backtestRunning = false;
let backtestData = null;
let backtestResults = null;
let backtestInterval = null;
let equityChart = null;
let extended4hData = null;
let extended1hData = null;

// Configuration du backtesting (simplifiée et sécurisée)
let backtestConfig = {
    timeframe: '15m', // Base for simulation
    duration: 7, // jours
    capital: 1000, // Capital fixe
    positionSize: 10, // pourcentage
    trailingStop: 1.5, // pourcentage
    takeProfit: 4, // pourcentage
    enableTakeProfit: true, // activer/désactiver le take profit
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
        
        if (extended4hData !== null && (!Array.isArray(extended4hData) || extended4hData.length === 0)) {
            extended4hData = null;
            console.log('⚠️ [INIT] extended4hData réinitialisé à null');
        }
        
        if (extended1hData !== null && (!Array.isArray(extended1hData) || extended1hData.length === 0)) {
            extended1hData = null;
            console.log('⚠️ [INIT] extended1hData réinitialisé à null');
        }
        
        // Valider et corriger la configuration
        if (!backtestConfig || typeof backtestConfig !== 'object') {
            backtestConfig = {
                timeframe: '15m',
                duration: 7,
                capital: 1000,
                positionSize: 10,
                trailingStop: 1.5,
                takeProfit: 4,
                enableTakeProfit: true
            };
            console.log('⚠️ [INIT] backtestConfig réinitialisé avec valeurs par défaut');
        } else {
            // Valider chaque propriété de la configuration
            if (typeof backtestConfig.timeframe !== 'string' || !backtestConfig.timeframe) {
                backtestConfig.timeframe = '15m';
                console.log('⚠️ [INIT] backtestConfig.timeframe corrigé');
            }
            
            if (typeof backtestConfig.duration !== 'number' || backtestConfig.duration <= 0) {
                backtestConfig.duration = 7;
                console.log('⚠️ [INIT] backtestConfig.duration corrigé');
            }
            
            if (typeof backtestConfig.capital !== 'number' || backtestConfig.capital <= 0) {
                backtestConfig.capital = 1000;
                console.log('⚠️ [INIT] backtestConfig.capital corrigé');
            }
            
            if (typeof backtestConfig.positionSize !== 'number' || backtestConfig.positionSize <= 0 || backtestConfig.positionSize > 100) {
                backtestConfig.positionSize = 10;
                console.log('⚠️ [INIT] backtestConfig.positionSize corrigé');
            }
            
            if (typeof backtestConfig.trailingStop !== 'number' || backtestConfig.trailingStop <= 0 || backtestConfig.trailingStop > 10) {
                backtestConfig.trailingStop = 1.5;
                console.log('⚠️ [INIT] backtestConfig.trailingStop corrigé');
            }
            
            if (typeof backtestConfig.takeProfit !== 'number' || backtestConfig.takeProfit <= 0 || backtestConfig.takeProfit > 50) {
                backtestConfig.takeProfit = 4;
                console.log('⚠️ [INIT] backtestConfig.takeProfit corrigé');
            }
            
            if (typeof backtestConfig.enableTakeProfit !== 'boolean') {
                backtestConfig.enableTakeProfit = true;
                console.log('⚠️ [INIT] backtestConfig.enableTakeProfit corrigé');
            }
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
        extended4hData = null;
        extended1hData = null;
        
        // Nettoyer les timers
        if (backtestInterval) {
            clearInterval(backtestInterval);
            backtestInterval = null;
        }
        
        // Nettoyer les graphiques
        if (equityChart) {
            try {
                equityChart.destroy();
            } catch (chartError) {
                console.warn('⚠️ [CLEANUP] Erreur lors de la destruction du graphique:', chartError);
            }
            equityChart = null;
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

// NOUVELLE FONCTION : Copie exacte de la fonction analyzeMultiTimeframe du trading principal
// 🔧 CORRECTION: Analyse multi-timeframe avec données étendues pour 4H et 1H
async function analyzeMultiTimeframeForBacktest(symbol, historicalData, candleIndex) {
    try {
        console.log(`🔍 [DEBUG] Analyse multi-timeframe pour ${symbol} à l'index ${candleIndex}`);
        
        const currentTime = historicalData[candleIndex].timestamp;
        const results = {};
        
        // ÉTAPE 1 : Analyser le dernier signal 4H connu (peut être en dehors des 7 jours)
        // Validation des données étendues 4H
        if (!extended4hData || extended4hData.length === 0) {
            console.log(`❌ [DEBUG] Données étendues 4H manquantes ou vides`);
            return { finalDecision: 'FILTERED', filterReason: 'Données étendues 4H manquantes' };
        }
        
        const data4h = extended4hData.filter(c => c && c.timestamp && c.timestamp <= currentTime);
        console.log(`📊 [DEBUG] 4H: Utilisation de ${data4h.length} bougies étendues jusqu'à ${new Date(currentTime).toISOString()}`);
        
        if (data4h.length < 50) {
            console.log(`⚠️ [DEBUG] Données insuffisantes pour 4H: ${data4h.length} bougies`);
            return { finalDecision: 'FILTERED', filterReason: 'Données 4H insuffisantes' };
        }
        
        // Trouver le dernier signal 4H connu
        const lastSignal4h = await findLastSignalInTimeframe(symbol, '4h', data4h);
        results['4h'] = lastSignal4h;
        console.log(`📊 [DEBUG] 4H: Dernier signal connu = ${lastSignal4h.signal}, Index = ${lastSignal4h.signalIndex}`);
        
        // Si le dernier signal 4H est baissier, vérifier si un nouveau signal haussier est apparu
        if (lastSignal4h.signal === 'BEARISH' || lastSignal4h.signal === 'NEUTRAL') {
            const newBullish4h = await checkForNewBullishSignal(symbol, '4h', data4h, lastSignal4h.signalIndex);
            if (!newBullish4h) {
                results.finalDecision = 'FILTERED';
                results.filterReason = `Dernier signal 4H baissier/neutre, en attente d'un signal haussier`;
                console.log(`❌ [DEBUG] Filtré: Dernier signal 4H ${lastSignal4h.signal}, pas de nouveau signal haussier`);
                return results;
            } else {
                console.log(`✅ [DEBUG] Nouveau signal 4H haussier détecté à l'index ${newBullish4h.signalIndex}`);
                results['4h'] = newBullish4h;
            }
        }
        
        // ÉTAPE 2 : Si 4H est haussier, analyser le dernier signal 1H
        // Validation des données étendues 1H
        if (!extended1hData || extended1hData.length === 0) {
            console.log(`❌ [DEBUG] Données étendues 1H manquantes ou vides`);
            return { finalDecision: 'FILTERED', filterReason: 'Données étendues 1H manquantes' };
        }
        
        const data1h = extended1hData.filter(c => c && c.timestamp && c.timestamp <= currentTime);
        console.log(`📊 [DEBUG] 1H: Utilisation de ${data1h.length} bougies étendues jusqu'à ${new Date(currentTime).toISOString()}`);
        
        if (data1h.length < 50) {
            console.log(`⚠️ [DEBUG] Données insuffisantes pour 1H: ${data1h.length} bougies`);
            return { finalDecision: 'FILTERED', filterReason: 'Données 1H insuffisantes' };
        }
        
        // Trouver le dernier signal 1H connu
        const lastSignal1h = await findLastSignalInTimeframe(symbol, '1h', data1h);
        results['1h'] = lastSignal1h;
        console.log(`📊 [DEBUG] 1H: Dernier signal connu = ${lastSignal1h.signal}, Index = ${lastSignal1h.signalIndex}`);
        
        // Si le dernier signal 1H est baissier, vérifier si un nouveau signal haussier est apparu
        if (lastSignal1h.signal === 'BEARISH' || lastSignal1h.signal === 'NEUTRAL') {
            const newBullish1h = await checkForNewBullishSignal(symbol, '1h', data1h, lastSignal1h.signalIndex);
            if (!newBullish1h) {
                results.finalDecision = 'FILTERED';
                results.filterReason = `Dernier signal 1H baissier/neutre, en attente d'un signal haussier`;
                console.log(`❌ [DEBUG] Filtré: Dernier signal 1H ${lastSignal1h.signal}, pas de nouveau signal haussier`);
                return results;
            } else {
                console.log(`✅ [DEBUG] Nouveau signal 1H haussier détecté à l'index ${newBullish1h.signalIndex}`);
                results['1h'] = newBullish1h;
            }
        }
        
        // ÉTAPE 3 : Si 4H et 1H sont haussiers, analyser le 15M pour les signaux BUY
        const data15m = historicalData.slice(0, candleIndex + 1);
        console.log(`📊 [DEBUG] 15M: Utilisation de ${data15m.length} bougies locales`);
        
        if (data15m.length < 50) {
            console.log(`⚠️ [DEBUG] Données insuffisantes pour 15M: ${data15m.length} bougies`);
            return { finalDecision: 'FILTERED', filterReason: 'Données 15M insuffisantes' };
        }
        
        const analysis15m = await analyzePairMACDForBacktest(symbol, '15m', data15m);
        results['15m'] = analysis15m;
        console.log(`📊 [DEBUG] 15M: Signal = ${analysis15m.signal}, Crossover = ${analysis15m.crossover}`);
        
        // Décision finale : BUY seulement si 15M a un signal BUY avec croisement
        if (analysis15m.signal === 'BUY' && analysis15m.crossover) {
            results.finalDecision = 'BUY';
            results.finalReason = `4H et 1H haussiers + signal BUY 15M avec croisement détecté`;
            console.log(`✅ [DEBUG] Signal BUY validé: ${results.finalReason}`);
        } else if (analysis15m.signal === 'BULLISH') {
            results.finalDecision = 'WAIT';
            results.finalReason = `4H et 1H haussiers, 15M haussier mais pas de croisement`;
            console.log(`⏳ [DEBUG] Signal WAIT: ${results.finalReason}`);
        } else {
            results.finalDecision = 'FILTERED';
            results.filterReason = `15M non haussier: ${analysis15m.signal}`;
            console.log(`❌ [DEBUG] Filtré au 15M: ${analysis15m.signal}`);
        }
        
        return results;
        
    } catch (error) {
        console.error(`❌ [DEBUG] Erreur analyse multi-timeframe ${symbol}:`, error);
        log(`❌ Erreur analyse multi-timeframe backtesting ${symbol}: ${error.message}`, 'ERROR');
        return { finalDecision: 'FILTERED', filterReason: `Erreur: ${error.message}` };
    }
}

// NOUVELLE FONCTION : Trouver le dernier signal dans un timeframe (SÉCURISÉE)
async function findLastSignalInTimeframe(symbol, timeframe, data) {
    const startTime = Date.now();
    const maxExecutionTime = 30000; // 30 secondes maximum
    let iterationCount = 0;
    const maxIterations = 50; // Maximum 50 itérations
    
    try {
        // Validation des entrées
        if (!symbol || typeof symbol !== 'string') {
            throw new Error('Symbol invalide');
        }
        if (!timeframe || typeof timeframe !== 'string') {
            throw new Error('Timeframe invalide');
        }
        if (!data || !Array.isArray(data) || data.length === 0) {
            console.log(`⚠️ [SIGNAL_DEBUG] Données vides pour ${timeframe}`);
            return { signal: 'NEUTRAL', reason: 'Données vides', signalIndex: -1 };
        }
        
        console.log(`🔍 [SIGNAL_DEBUG] Recherche du dernier signal ${timeframe} dans ${data.length} bougies`);
        
        // Optimisation : analyser seulement les 100 dernières bougies pour éviter les boucles infinies
        const startIndex = Math.max(50, data.length - 100);
        let lastSignal = null;
        let lastSignalIndex = -1;
        
        // Validation des indices
        if (startIndex >= data.length) {
            console.log(`⚠️ [SIGNAL_DEBUG] Index de départ invalide pour ${timeframe}`);
            return { signal: 'NEUTRAL', reason: 'Index invalide', signalIndex: -1 };
        }
        
        // Parcourir les données de la fin vers le début (optimisé et sécurisé)
        for (let i = data.length - 1; i >= startIndex; i -= 5) { // Pas de 5 pour optimiser
            iterationCount++;
            
            // Protection contre les boucles infinies
            if (iterationCount > maxIterations) {
                console.error(`❌ [SIGNAL_DEBUG] Limite d'itérations atteinte (${maxIterations}) pour ${timeframe}`);
                break;
            }
            
            // Protection contre l'exécution trop longue
            if (Date.now() - startTime > maxExecutionTime) {
                console.error(`❌ [SIGNAL_DEBUG] Timeout d'exécution (${maxExecutionTime}ms) pour ${timeframe}`);
                break;
            }
            
            // Validation de l'indice
            if (i < 0 || i >= data.length) {
                console.error(`❌ [SIGNAL_DEBUG] Index invalide ${i} pour ${timeframe}`);
                continue;
            }
            
            const subData = data.slice(0, i + 1);
            if (subData.length < 50) continue;
            
            try {
                const analysis = await analyzePairMACDForBacktest(symbol, timeframe, subData);
                
                // Si on trouve un signal clair (BUY, BULLISH, ou BEARISH), c'est le dernier signal
                if (analysis && analysis.signal && (analysis.signal === 'BUY' || analysis.signal === 'BULLISH' || analysis.signal === 'BEARISH')) {
                    lastSignal = analysis;
                    lastSignalIndex = i;
                    console.log(`✅ [SIGNAL_DEBUG] Dernier signal ${timeframe} trouvé: ${analysis.signal} à l'index ${i} (${iterationCount} itérations)`);
                    break;
                }
            } catch (analysisError) {
                console.error(`❌ [SIGNAL_DEBUG] Erreur analyse à l'index ${i}:`, analysisError);
                continue;
            }
        }
        
        // Si aucun signal trouvé, considérer comme neutre
        if (!lastSignal) {
            lastSignal = { signal: 'NEUTRAL', reason: 'Aucun signal clair trouvé' };
            lastSignalIndex = data.length - 1;
            console.log(`⚠️ [SIGNAL_DEBUG] Aucun signal ${timeframe} trouvé après ${iterationCount} itérations, considéré comme NEUTRAL`);
        }
        
        lastSignal.signalIndex = lastSignalIndex;
        return lastSignal;
        
    } catch (error) {
        console.error(`❌ [SIGNAL_DEBUG] Erreur findLastSignalInTimeframe ${timeframe}:`, error);
        return { signal: 'NEUTRAL', reason: `Erreur: ${error.message}`, signalIndex: -1 };
    }
}

// NOUVELLE FONCTION : Vérifier si un nouveau signal haussier est apparu après un signal baissier (SÉCURISÉE)
async function checkForNewBullishSignal(symbol, timeframe, data, lastSignalIndex) {
    const startTime = Date.now();
    const maxExecutionTime = 30000; // 30 secondes maximum
    let iterationCount = 0;
    const maxIterations = 30; // Maximum 30 itérations
    
    try {
        // Validation des entrées
        if (!symbol || typeof symbol !== 'string') {
            throw new Error('Symbol invalide');
        }
        if (!timeframe || typeof timeframe !== 'string') {
            throw new Error('Timeframe invalide');
        }
        if (!data || !Array.isArray(data) || data.length === 0) {
            console.log(`⚠️ [SIGNAL_DEBUG] Données vides pour nouveau signal ${timeframe}`);
            return null;
        }
        if (typeof lastSignalIndex !== 'number' || lastSignalIndex < 0) {
            console.log(`⚠️ [SIGNAL_DEBUG] Index de dernier signal invalide: ${lastSignalIndex}`);
            return null;
        }
        
        console.log(`🔍 [SIGNAL_DEBUG] Recherche nouveau signal haussier ${timeframe} après index ${lastSignalIndex}`);
        
        // Optimisation : limiter la recherche aux 50 dernières bougies après le dernier signal
        const startSearch = Math.max(lastSignalIndex + 1, data.length - 50);
        const endSearch = data.length;
        
        // Validation des bornes
        if (startSearch >= endSearch || startSearch >= data.length) {
            console.log(`⚠️ [SIGNAL_DEBUG] Bornes de recherche invalides: ${startSearch} >= ${endSearch}`);
            return null;
        }
        
        console.log(`🔍 [SIGNAL_DEBUG] Recherche ${timeframe} de l'index ${startSearch} à ${endSearch}`);
        
        // Chercher un nouveau signal haussier (optimisé avec pas de 3 et sécurisé)
        for (let i = startSearch; i < endSearch; i += 3) {
            iterationCount++;
            
            // Protection contre les boucles infinies
            if (iterationCount > maxIterations) {
                console.error(`❌ [SIGNAL_DEBUG] Limite d'itérations atteinte (${maxIterations}) pour nouveau signal ${timeframe}`);
                break;
            }
            
            // Protection contre l'exécution trop longue
            if (Date.now() - startTime > maxExecutionTime) {
                console.error(`❌ [SIGNAL_DEBUG] Timeout d'exécution (${maxExecutionTime}ms) pour nouveau signal ${timeframe}`);
                break;
            }
            
            // Validation de l'indice
            if (i < 0 || i >= data.length) {
                console.error(`❌ [SIGNAL_DEBUG] Index invalide ${i} pour nouveau signal ${timeframe}`);
                continue;
            }
            
            const subData = data.slice(0, i + 1);
            if (subData.length < 50) continue;
            
            try {
                const analysis = await analyzePairMACDForBacktest(symbol, timeframe, subData);
                
                // Si on trouve un signal haussier (BUY ou BULLISH), c'est un nouveau signal
                if (analysis && analysis.signal && (analysis.signal === 'BUY' || analysis.signal === 'BULLISH')) {
                    analysis.signalIndex = i;
                    console.log(`✅ [SIGNAL_DEBUG] Nouveau signal haussier ${timeframe} trouvé à l'index ${i}: ${analysis.signal} (${iterationCount} itérations)`);
                    return analysis;
                }
            } catch (analysisError) {
                console.error(`❌ [SIGNAL_DEBUG] Erreur analyse nouveau signal à l'index ${i}:`, analysisError);
                continue;
            }
        }
        
        console.log(`❌ [SIGNAL_DEBUG] Aucun nouveau signal haussier ${timeframe} trouvé après ${iterationCount} itérations`);
        return null; // Aucun nouveau signal haussier trouvé
        
    } catch (error) {
        console.error(`❌ [SIGNAL_DEBUG] Erreur checkForNewBullishSignal ${timeframe}:`, error);
        return null;
    }
}

// 🆕 NOUVELLE FONCTION: Récupérer des données historiques étendues pour 4H et 1H (OPTIMISÉE)
async function getExtendedHistoricalData(symbol, timeframe, days = 30, endTimeMs = Date.now()) {
    try {
        console.log(`🔍 [DEBUG] Récupération de données étendues: ${symbol} ${timeframe} sur ${days} jours jusqu'à ${new Date(endTimeMs).toISOString()}`);
        
        const timeframeMs = getTimeframeMinutes(timeframe) * 60 * 1000;
        const totalMs = days * 24 * 60 * 60 * 1000;
        const startTime = endTimeMs - totalMs;
        
        // Calculer le nombre de bougies approximatif
        const expectedCandles = Math.floor(totalMs / timeframeMs);
        const maxCandles = Math.min(1000, expectedCandles); // Limiter à 1000 bougies max
        
        console.log(`📊 [DEBUG] Récupération de ${maxCandles} bougies ${timeframe} pour ${days} jours`);
        
        // Récupérer les données directement sans chunks pour optimiser
        const data = await getBinanceKlineData(symbol, maxCandles, timeframe, startTime, endTimeMs);
        
        console.log(`✅ [DEBUG] ${data.length} bougies ${timeframe} récupérées`);
        
        return data;
        
    } catch (error) {
        console.error(`❌ [DEBUG] Erreur récupération données étendues ${symbol} ${timeframe}:`, error);
        log(`❌ Erreur récupération données étendues: ${error.message}`, 'ERROR');
        return [];
    }
}

// NOUVELLE FONCTION : Analyse MACD pour backtesting (identique au trading)
async function analyzePairMACDForBacktest(symbol, timeframe, historicalData) {
    try {
        // Filtrer les données pour le timeframe
        const tfData = getTimeframeData(historicalData, timeframe);
        if (!tfData || tfData.length < 50) {
            return { symbol, timeframe, signal: 'INSUFFICIENT_DATA' };
        }
        
        // 🎯 Récupérer les paramètres MACD spécifiques au timeframe (IDENTIQUES AU TRADING)
        const macdParams = getMACDParametersForBacktest(timeframe);
        
        // Calcul MACD avec paramètres spécifiques au timeframe
        const prices = tfData.map(candle => candle.close);
        const macdData = calculateMACDForBacktest(prices, macdParams.fast, macdParams.slow, macdParams.signal);
        
        if (!macdData || macdData.length < 3) {
            return { symbol, timeframe, signal: 'INSUFFICIENT_DATA' };
        }
        
        const latest = macdData[macdData.length - 1];
        const previous = macdData[macdData.length - 2];
        const earlier = macdData[macdData.length - 3];
        
        // Analyse identique au trading principal
        const crossover = previous.macd <= previous.signal && latest.macd > latest.signal;
        const histogramImproving = latest.histogram > previous.histogram && previous.histogram > earlier.histogram;
        const macdAboveSignal = latest.macd > latest.signal;
        const histogramPositive = latest.histogram > 0;
        
        let signal = 'NEUTRAL';
        let reason = '';
        
        if (crossover && histogramPositive && histogramImproving) {
            signal = 'BUY';
            reason = `Croisement MACD + Histogram>0 + Tendance IMPROVING (${timeframe})`;
        } else if (macdAboveSignal && histogramPositive && histogramImproving) {
            signal = 'BULLISH';
            reason = `MACD>Signal + Histogram>0 + Tendance IMPROVING (${timeframe})`;
        } else if (macdAboveSignal && histogramPositive) {
            signal = 'BULLISH';
            reason = `MACD>Signal + Histogram>0 (${timeframe})`;
        } else if (latest.macd < latest.signal) {
            signal = 'BEARISH';
            reason = `MACD<Signal (${timeframe})`;
        }
        
        return {
            symbol,
            timeframe,
            signal,
            crossover,
            reason,
            price: tfData[tfData.length - 1].close,
            macd: latest.macd,
            signalLine: latest.signal,  // Renommer pour éviter la collision
            histogram: latest.histogram
        };
        
    } catch (error) {
        log(`❌ Erreur analyse MACD backtesting ${symbol} ${timeframe}: ${error.message}`, 'ERROR');
        return { symbol, timeframe, signal: 'ERROR' };
    }
}

// FONCTION CORRIGÉE : Extraire et agréger les données pour un timeframe spécifique
function getTimeframeData(historicalData, targetTimeframe) {
    if (!historicalData || historicalData.length === 0) {
        console.log(`❌ [DEBUG] Données historiques vides pour ${targetTimeframe}`);
        return [];
    }
    
    const baseTimeframe = '15m'; // Timeframe de base des données
    const baseMinutes = getTimeframeMinutes(baseTimeframe);
    const targetMinutes = getTimeframeMinutes(targetTimeframe);
    
    // Si le timeframe cible est le même que la base, retourner directement
    if (targetMinutes === baseMinutes) {
        console.log(`✅ [DEBUG] Même timeframe (${targetTimeframe}), ${historicalData.length} bougies`);
        return historicalData;
    }
    
    // Si le timeframe cible est plus petit que la base, on ne peut pas agréger
    if (targetMinutes < baseMinutes) {
        console.log(`⚠️ [DEBUG] Timeframe ${targetTimeframe} plus petit que la base ${baseTimeframe}, utilisation des données de base`);
        return historicalData;
    }
    
    // Agréger les données pour le timeframe cible
    const ratio = targetMinutes / baseMinutes;
    const aggregatedData = [];
    
    for (let i = 0; i < historicalData.length; i += ratio) {
        const chunk = historicalData.slice(i, i + ratio);
        if (chunk.length === 0) continue;
        
        const aggregated = {
            timestamp: chunk[0].timestamp,
            open: chunk[0].open,
            high: Math.max(...chunk.map(c => c.high)),
            low: Math.min(...chunk.map(c => c.low)),
            close: chunk[chunk.length - 1].close,
            volume: chunk.reduce((sum, c) => sum + c.volume, 0)
        };
        
        aggregatedData.push(aggregated);
    }
    
    console.log(`✅ [DEBUG] Agrégation ${baseTimeframe} → ${targetTimeframe}: ${historicalData.length} → ${aggregatedData.length} bougies`);
    return aggregatedData;
}

// NOUVELLE FONCTION : Paramètres MACD adaptés par timeframe (IDENTIQUES AU TRADING) - SANS LOGS RÉPÉTITIFS
function getMACDParametersForBacktest(timeframe) {
    const parameters = {
        '4h': { fast: 12, slow: 26, signal: 9, minCandles: 200 },
        '1h': { fast: 30, slow: 50, signal: 20, minCandles: 300 },
        '15m': { fast: 30, slow: 50, signal: 40, minCandles: 350 }
    };
    
    const params = parameters[timeframe] || parameters['4h'];
    // SUPPRESSION DU LOG RÉPÉTITIF
    // log(`📊 MACD ${timeframe} (Backtesting): Fast=${params.fast}, Slow=${params.slow}, Signal=${params.signal}`, 'DEBUG');
    return params;
}

// Fonction pour récupérer les données klines depuis l'API Binance (AMÉLIORÉE)
async function getBinanceKlineData(symbol, limit = 500, interval = '15m', startTime, endTime) {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 seconde
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
    
    // URL de l'API Binance (pas besoin d'authentification pour les données de marché)
    let url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${limit}`;
    if (startTime) url += `&startTime=${startTime}`;
    if (endTime) url += `&endTime=${endTime}`;
    
    console.log(`🔍 [API] Tentative de récupération: ${symbol} ${interval} (${limit} bougies)`);
    
    // Boucle de retry avec backoff exponentiel
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔍 [API] Tentative ${attempt + 1}/${maxRetries + 1} pour ${symbol}`);
            
            // Créer un AbortController pour le timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 secondes timeout
            
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            clearTimeout(timeoutId);
            
            // Vérifier le statut de la réponse
            if (!response.ok) {
                if (response.status === 429) {
                    // Rate limit exceeded
                    const retryAfter = response.headers.get('Retry-After') || 60;
                    console.log(`⚠️ [API] Rate limit atteint, attente ${retryAfter}s avant retry`);
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
                        continue;
                    }
                    throw new Error(`Rate limit dépassé: ${response.status} ${response.statusText}`);
                } else if (response.status === 403) {
                    throw new Error(`Accès interdit (possiblement IP bloquée): ${response.status} ${response.statusText}`);
                } else if (response.status >= 500) {
                    // Erreur serveur, on peut retry
                    throw new Error(`Erreur serveur (retry possible): ${response.status} ${response.statusText}`);
                } else {
                    // Autres erreurs HTTP
                    throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
                }
            }
            
            const data = await response.json();
            
            // Validation de la réponse
            if (!data) {
                throw new Error('Réponse vide de l\'API Binance');
            }
            
            if (Array.isArray(data)) {
                if (data.length === 0) {
                    console.log(`⚠️ [API] Aucune donnée disponible pour ${symbol} ${interval}`);
                    return [];
                }
                
                const klines = data.map((candle, index) => {
                    // Validation des données de chaque bougie
                    if (!candle || !Array.isArray(candle) || candle.length < 6) {
                        console.error(`❌ [API] Bougie invalide à l'index ${index}:`, candle);
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
                }).filter(candle => candle !== null); // Filtrer les bougies invalides
                
                console.log(`✅ [API] ${symbol} - ${klines.length} bougies ${interval} récupérées avec succès`);
                log(`📊 Binance: ${symbol} - ${klines.length} bougies ${interval} récupérées`, 'INFO');
                return klines;
            } else if (data.code && data.msg) {
                // Erreur API Binance
                const errorMsg = `Erreur API Binance (${data.code}): ${data.msg}`;
                console.error(`❌ [API] ${errorMsg}`);
                
                // Certaines erreurs ne méritent pas de retry
                if (data.code === -1121 || data.code === -1100) { // Invalid symbol ou Illegal characters
                    throw new Error(errorMsg);
                }
                
                throw new Error(errorMsg);
            } else {
                throw new Error(`Format de réponse inattendu: ${typeof data}`);
            }
            
        } catch (error) {
            lastError = error;
            console.error(`❌ [API] Erreur tentative ${attempt + 1}:`, error.message);
            
            // Gestion spécifique des erreurs
            if (error.name === 'AbortError') {
                console.error(`❌ [API] Timeout après 30 secondes pour ${symbol}`);
            } else if (error.message.includes('CORS') || error.message.includes('Network')) {
                console.error(`❌ [API] Erreur réseau/CORS pour ${symbol}`);
            } else if (error.message.includes('Rate limit') || error.message.includes('403')) {
                console.error(`❌ [API] Erreur d'accès pour ${symbol}`);
            }
            
            // Si c'est la dernière tentative, on sort
            if (attempt === maxRetries) {
                break;
            }
            
            // Attendre avant le prochain retry (backoff exponentiel)
            const delay = baseDelay * Math.pow(2, attempt);
            console.log(`⏳ [API] Attente ${delay}ms avant retry pour ${symbol}`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    // Toutes les tentatives ont échoué
    const finalError = `Échec après ${maxRetries + 1} tentatives: ${lastError?.message || 'Erreur inconnue'}`;
    console.error(`❌ [API] ${finalError}`);
    log(`❌ Erreur réseau Binance ${symbol}: ${finalError}`, 'ERROR');
    
    return []; // Retourner un tableau vide en cas d'échec
}

// Fonctions supprimées - utilisaient des appels API inutiles
// La nouvelle logique utilise uniquement la stratégie fixe identique au trading principal

// Fonction pour démarrer le backtesting (AVEC VALIDATION)
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
        
        // 🔍 DEBUG: Vérifier l'élément chartSymbol
        console.log('🔍 [DEBUG] Vérification de l\'élément chartSymbol...');
        const chartSymbolElement = document.getElementById('chartSymbol');
        if (!chartSymbolElement) {
            console.error('❌ [DEBUG] Élément chartSymbol manquant');
            throw new Error('Élément chartSymbol manquant');
        }
        
        const selectedSymbol = chartSymbolElement.value;
        console.log(`✅ [DEBUG] chartSymbol trouvé, valeur: ${selectedSymbol}`);
        
        if (!selectedSymbol) {
            console.error('❌ [DEBUG] Aucun symbole sélectionné');
            throw new Error('Aucun symbole sélectionné');
        }
        
        // Récupérer la configuration
        console.log('🔍 [DEBUG] Mise à jour de la configuration...');
        await updateBacktestConfig();
        
        // Valider la configuration
        console.log('🔍 [DEBUG] Validation de la configuration...');
        if (!validateBacktestConfig()) {
            console.error('❌ [DEBUG] Configuration invalide');
            return;
        }
        
        // Récupérer la crypto sélectionnée
        const symbol = selectedSymbol.includes(':') ? selectedSymbol.split(':')[1] : selectedSymbol;
        console.log(`🔍 [DEBUG] Symbole extrait: ${symbol}`);
        
        backtestRunning = true;
        updateBacktestUI(true);
        
        log(`🚀 Démarrage du backtesting: ${symbol} - STRATÉGIE IDENTIQUE AU TRADING PRINCIPAL - ${backtestConfig.duration} jours`, 'INFO');
        
        // Récupérer les données historiques
        console.log('🔍 [DEBUG] Récupération des données historiques...');
        await fetchHistoricalData(symbol);
        
        if (!backtestData || backtestData.length === 0) {
            console.error('❌ [DEBUG] Aucune donnée historique récupérée');
            throw new Error('Impossible de récupérer les données historiques');
        }
        
        console.log(`✅ [DEBUG] ${backtestData.length} bougies récupérées`);
        
        // Pré-récupérer les données étendues pour 4H et 1H (OPTIMISÉ)
        console.log('🔍 [DEBUG] Pré-récupération des données étendues pour optimisation...');
        updateBacktestStatus('Récupération des données étendues pour analyse multi-timeframe...', 35);
        
        const extendedDays = 30 + backtestConfig.duration; // Réduit de 60 à 30 jours
        const newestTime = backtestData[backtestData.length - 1].timestamp;
        
        // Récupérer 4H
        updateBacktestStatus('Récupération des données 4H...', 40);
        extended4hData = await getExtendedHistoricalData(symbol, '4h', extendedDays, newestTime);
        console.log(`✅ [DEBUG] Données 4H pré-chargées: ${extended4hData.length} bougies`);
        
        // Récupérer 1H
        updateBacktestStatus('Récupération des données 1H...', 45);
        extended1hData = await getExtendedHistoricalData(symbol, '1h', extendedDays, newestTime);
        console.log(`✅ [DEBUG] Données 1H pré-chargées: ${extended1hData.length} bougies`);
        
        updateBacktestStatus('Données étendues prêtes', 50);
        console.log(`✅ [DEBUG] Toutes les données étendues pré-chargées: 4H=${extended4hData.length}, 1H=${extended1hData.length}`);

        // Exécuter le backtesting avec la logique identique au trading
        console.log('🔍 [DEBUG] Exécution du backtesting...');
        await runBacktestWithTradingLogic();

        // Afficher les résultats
        console.log('🔍 [DEBUG] Affichage des résultats...');
        displayBacktestResults();

        log('✅ Backtesting terminé avec succès', 'SUCCESS');

    } catch (error) {
        console.error('❌ [DEBUG] Erreur dans startBacktest:', error);
        log(`❌ Erreur backtesting: ${error.message}`, 'ERROR');
        console.error('Erreur backtesting:', error);
        
        // Nettoyer les variables en cas d'erreur
        cleanupBacktestingVariables();
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
        // 🔍 DEBUG: Vérifier la présence de tous les éléments HTML
        console.log('🔍 [DEBUG] Vérification des éléments HTML pour backtesting...');
        
        const elements = {
            backtestDuration: document.getElementById('backtestDuration'),
            backtestPositionSize: document.getElementById('backtestPositionSize'),
            backtestTrailingStop: document.getElementById('backtestTrailingStop'),
            backtestTakeProfit: document.getElementById('backtestTakeProfit'),
            enableTakeProfit: document.getElementById('enableTakeProfit')
        };
        
        // Vérifier chaque élément
        for (const [name, element] of Object.entries(elements)) {
            if (!element) {
                console.error(`❌ [DEBUG] Élément HTML manquant: ${name}`);
                throw new Error(`Élément HTML manquant: ${name}`);
            } else {
                console.log(`✅ [DEBUG] Élément ${name} trouvé, value: ${element.value || element.checked}`);
            }
        }
        
        // 🔍 DEBUG: Récupérer les valeurs avec vérification
        const duration = elements.backtestDuration.value;
        const positionSize = elements.backtestPositionSize.value;
        const trailingStop = elements.backtestTrailingStop.value;
        const takeProfit = elements.backtestTakeProfit.value;
        const enableTakeProfit = elements.enableTakeProfit.checked;
        
        console.log('🔍 [DEBUG] Valeurs récupérées:');
        console.log(`  - Duration: ${duration} (type: ${typeof duration})`);
        console.log(`  - Position Size: ${positionSize} (type: ${typeof positionSize})`);
        console.log(`  - Trailing Stop: ${trailingStop} (type: ${typeof trailingStop})`);
        console.log(`  - Take Profit: ${takeProfit} (type: ${typeof takeProfit})`);
        console.log(`  - Enable Take Profit: ${enableTakeProfit} (type: ${typeof enableTakeProfit})`);
        
        // Construire la configuration
        backtestConfig = {
            timeframe: '15m', // Fixe pour la simulation
            duration: parseInt(duration),
            capital: 1000, // Capital fixe
            positionSize: parseFloat(positionSize),
            trailingStop: parseFloat(trailingStop),
            takeProfit: parseFloat(takeProfit),
            enableTakeProfit: enableTakeProfit,
        };
        
        console.log('✅ [DEBUG] Configuration mise à jour:', backtestConfig);
        
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
    
    if (backtestConfig.enableTakeProfit && (backtestConfig.takeProfit < 0.1 || backtestConfig.takeProfit > 20)) {
        alert('Le take profit doit être entre 0.1% et 20%');
        return false;
    }
    
    return true;
}

// Récupérer les données historiques via API Binance (OPTIMISÉE)
async function fetchHistoricalData(symbol) {
    try {
        updateBacktestStatus('Récupération des données historiques via Binance...', 10);
        
        const timeframeMs = getTimeframeMinutes(backtestConfig.timeframe) * 60 * 1000;
        const totalMs = backtestConfig.duration * 24 * 60 * 60 * 1000;
        const now = Date.now();
        
        // Calculer le nombre de bougies nécessaires + marge pour les indicateurs
        const expectedCandles = Math.floor(totalMs / timeframeMs);
        const totalCandles = expectedCandles + 100; // Ajouter 100 bougies pour les indicateurs
        
        console.log(`📊 [DEBUG] Récupération de ${totalCandles} bougies ${backtestConfig.timeframe} pour ${backtestConfig.duration} jours`);
        
        const data = await getBinanceKlineData(symbol, totalCandles, backtestConfig.timeframe);
        
        if (data.length === 0) {
            throw new Error('Aucune donnée historique récupérée depuis Binance');
        }
        
        backtestData = data;
        
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

// NOUVELLE FONCTION : Exécuter le backtesting avec la logique identique au trading (AMÉLIORÉE)
async function runBacktestWithTradingLogic() {
    try {
        console.log('🚀 [BACKTEST_DEBUG] === DÉBUT DU BACKTESTING ===');
        
        updateBacktestStatus('Exécution du backtesting avec stratégie identique au trading...', 55);
        
        // Initialiser les variables de simulation
        let equity = backtestConfig.capital;
        let openTrades = [];
        let closedTrades = [];
        let equityHistory = [];
        let totalSignals = 0;
        let buySignals = 0;
        let filteredSignals = 0;
        let waitSignals = 0;
        
        console.log(`✅ [BACKTEST_DEBUG] Variables initialisées - Capital: ${equity}$`);
        console.log(`📊 [BACKTEST_DEBUG] Configuration:`, backtestConfig);
        
        // Vérifier les données historiques
        if (!backtestData || backtestData.length === 0) {
            console.error('❌ [BACKTEST_DEBUG] backtestData manquant ou vide');
            throw new Error('Données historiques manquantes');
        }
        
        // Vérifier les données étendues
        if (!extended4hData || extended4hData.length === 0) {
            console.error('❌ [BACKTEST_DEBUG] extended4hData manquant ou vide');
            throw new Error('Données étendues 4H manquantes');
        }
        
        if (!extended1hData || extended1hData.length === 0) {
            console.error('❌ [BACKTEST_DEBUG] extended1hData manquant ou vide');
            throw new Error('Données étendues 1H manquantes');
        }
        
        console.log(`📊 [BACKTEST_DEBUG] ${backtestData.length} bougies disponibles pour le backtesting`);
        console.log(`📊 [BACKTEST_DEBUG] Données étendues: 4H=${extended4hData.length}, 1H=${extended1hData.length}`);
        
        // Récupérer le vrai symbole depuis les données
        const symbol = backtestData[0]?.symbol || 'SUIUSDT'; // Utiliser le vrai symbole
        console.log(`📊 [BACKTEST_DEBUG] Symbole utilisé: ${symbol}`);
        
        // Parcourir les données historiques (échantillonnage pour optimiser)
        const sampleRate = Math.max(1, Math.floor(backtestData.length / 50)); // Réduire à 50 points pour debug
        console.log(`📊 [BACKTEST_DEBUG] Échantillonnage: 1 analyse tous les ${sampleRate} bougies`);
        console.log(`📊 [BACKTEST_DEBUG] Début analyse de l'index 50 à ${backtestData.length} avec pas de ${sampleRate}`);
        
        for (let i = 50; i < backtestData.length; i += sampleRate) {
            try {
                const currentCandle = backtestData[i];
                
                if (!currentCandle) {
                    console.error(`❌ [BACKTEST_DEBUG] Bougie manquante à l'index ${i}`);
                    continue;
                }
                
                // Mettre à jour le progrès
                const progress = Math.round((i / backtestData.length) * 100);
                if (i % (sampleRate * 5) === 0) { // Plus fréquent pour debug
                    updateBacktestStatus(`Analyse bougie ${i}/${backtestData.length} (${progress}%)`, 55 + (progress * 0.4));
                    console.log(`📊 [BACKTEST_DEBUG] Progression: ${i}/${backtestData.length} (${progress}%)`);
                }
                
                // Analyser le signal multi-timeframe
                console.log(`\n🔍 [BACKTEST_DEBUG] === ANALYSE BOUGIE ${i} ===`);
                console.log(`📅 [BACKTEST_DEBUG] Timestamp: ${new Date(currentCandle.timestamp).toISOString()}`);
                console.log(`💰 [BACKTEST_DEBUG] Prix: ${currentCandle.close}`);
                
                const analysis = await analyzeMultiTimeframeForBacktest(
                    symbol, // Utiliser le vrai symbole
                    backtestData.slice(0, i + 1),
                    i
                );
                
                totalSignals++;
                
                if (!analysis) {
                    console.error(`❌ [BACKTEST_DEBUG] Analyse manquante à l'index ${i}`);
                    continue;
                }
                
                // Debug détaillé des signaux
                console.log(`📊 [BACKTEST_DEBUG] Résultat analyse: ${analysis.finalDecision}`);
                if (analysis.finalReason) console.log(`📝 [BACKTEST_DEBUG] Raison: ${analysis.finalReason}`);
                if (analysis.filterReason) console.log(`❌ [BACKTEST_DEBUG] Filtrage: ${analysis.filterReason}`);
                
                // Compter les signaux
                if (analysis.finalDecision === 'BUY') {
                    buySignals++;
                    console.log(`✅ [BACKTEST_DEBUG] 🚀 SIGNAL BUY DÉTECTÉ ! Total: ${buySignals}`);
                } else if (analysis.finalDecision === 'FILTERED') {
                    filteredSignals++;
                } else if (analysis.finalDecision === 'WAIT') {
                    waitSignals++;
                }
                
                // Ouvrir une position si signal BUY et pas de position ouverte
                if (analysis.finalDecision === 'BUY' && openTrades.length === 0) {
                    const positionSize = (equity * backtestConfig.positionSize / 100);
                    const quantity = positionSize / currentCandle.close;
                    
                    const trade = {
                        id: Date.now(),
                        symbol: symbol, // Utiliser le vrai symbole
                        side: 'LONG',
                        entryPrice: currentCandle.close,
                        quantity: quantity,
                        positionSize: positionSize,
                        entryTime: currentCandle.timestamp,
                        entryIndex: i,
                        reason: analysis.finalReason,
                        highestPrice: currentCandle.close,
                        stopLossPrice: currentCandle.close * (1 - backtestConfig.trailingStop / 100),
                        takeProfitPrice: backtestConfig.enableTakeProfit ? 
                            currentCandle.close * (1 + backtestConfig.takeProfit / 100) : null
                    };
                    
                    openTrades.push(trade);
                    console.log(`🚀 [BACKTEST_DEBUG] 💰 POSITION OUVERTE !`);
                    console.log(`📊 [BACKTEST_DEBUG] Prix: ${trade.entryPrice.toFixed(4)}, Quantité: ${trade.quantity.toFixed(6)}`);
                    console.log(`📊 [BACKTEST_DEBUG] Stop Loss: ${trade.stopLossPrice.toFixed(4)}, Take Profit: ${trade.takeProfitPrice?.toFixed(4) || 'N/A'}`);
                    log(`🚀 Position ouverte: ${trade.symbol} LONG @ ${trade.entryPrice.toFixed(4)}`, 'SUCCESS');
                }
                
                // Gérer les positions ouvertes
                for (let j = openTrades.length - 1; j >= 0; j--) {
                    const trade = openTrades[j];
                    
                    // Mettre à jour le trailing stop
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
                    
                    // Vérifier take profit
                    if (trade.takeProfitPrice && currentCandle.high >= trade.takeProfitPrice) {
                        closeReason = 'Take Profit';
                        closePrice = trade.takeProfitPrice;
                    }
                    
                    // Fermer la position si nécessaire
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
                        
                        console.log(`📊 [BACKTEST_DEBUG] 💸 POSITION FERMÉE: ${closeReason}, PnL=${pnl.toFixed(2)}$`);
                        log(`📊 Position fermée: ${closeReason} - PnL: ${pnl.toFixed(2)}$ (${pnlPercent.toFixed(2)}%)`, 
                            pnl > 0 ? 'SUCCESS' : 'WARNING');
                    }
                }
                
                // Enregistrer l'équité
                equityHistory.push({
                    timestamp: currentCandle.timestamp,
                    equity: equity,
                    drawdown: Math.max(0, (backtestConfig.capital - equity) / backtestConfig.capital * 100)
                });
                
            } catch (candleError) {
                console.error(`❌ [BACKTEST_DEBUG] Erreur à l'index ${i}:`, candleError);
                // Continuer avec la bougie suivante
            }
        }
        
        // Fermer les positions ouvertes à la fin
        console.log(`🔍 [BACKTEST_DEBUG] Fermeture des positions ouvertes: ${openTrades.length}`);
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
        
        // Statistiques finales de debug
        console.log(`\n📊 [BACKTEST_DEBUG] === STATISTIQUES FINALES ===`);
        console.log(`📊 [BACKTEST_DEBUG] Total signaux analysés: ${totalSignals}`);
        console.log(`📊 [BACKTEST_DEBUG] Signaux BUY: ${buySignals} (${totalSignals > 0 ? ((buySignals/totalSignals)*100).toFixed(2) : 0}%)`);
        console.log(`📊 [BACKTEST_DEBUG] Signaux WAIT: ${waitSignals} (${totalSignals > 0 ? ((waitSignals/totalSignals)*100).toFixed(2) : 0}%)`);
        console.log(`📊 [BACKTEST_DEBUG] Signaux FILTERED: ${filteredSignals} (${totalSignals > 0 ? ((filteredSignals/totalSignals)*100).toFixed(2) : 0}%)`);
        console.log(`📊 [BACKTEST_DEBUG] Positions ouvertes: ${closedTrades.length}`);
        console.log(`📊 [BACKTEST_DEBUG] Capital final: ${equity.toFixed(2)}$ (${((equity-backtestConfig.capital)/backtestConfig.capital*100).toFixed(2)}%)`);
        
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
            // Stats supplémentaires pour le debug
            totalSignals: totalSignals,
            buySignals: buySignals,
            waitSignals: waitSignals,
            filteredSignals: filteredSignals
        };
        
        console.log('✅ [BACKTEST_DEBUG] === BACKTESTING TERMINÉ ===');
        updateBacktestStatus('Backtesting terminé avec succès !', 100);
        
    } catch (error) {
        console.error('❌ [BACKTEST_DEBUG] Erreur CRITIQUE dans runBacktestWithTradingLogic:', error);
        console.error('❌ [BACKTEST_DEBUG] Stack trace:', error.stack);
        log(`❌ Erreur lors du backtesting: ${error.message}`, 'ERROR');
        
        // Créer des résultats vides en cas d'erreur
        backtestResults = {
            equity: backtestConfig.capital,
            equityHistory: [],
            trades: [],
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalPnL: 0,
            totalPnLPercent: 0,
            winRate: 0,
            maxDrawdown: 0,
            avgTradeDuration: 0,
            totalSignals: 0,
            buySignals: 0,
            waitSignals: 0,
            filteredSignals: 0,
            error: error.message
        };
        
        throw error;
    }
}

// Fonction pour calculer le MACD (identique au trading)
function calculateMACDForBacktest(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (prices.length < slowPeriod + signalPeriod) {
        return null;
    }
    
    function calculateEMA(data, period) {
        const k = 2 / (period + 1);
        let ema = data[0];
        const result = [ema];
        
        for (let i = 1; i < data.length; i++) {
            ema = (data[i] * k) + (ema * (1 - k));
            result.push(ema);
        }
        
        return result;
    }
    
    const emaFast = calculateEMA(prices, fastPeriod);
    const emaSlow = calculateEMA(prices, slowPeriod);
    
    const macdLine = [];
    for (let i = 0; i < prices.length; i++) {
        macdLine.push(emaFast[i] - emaSlow[i]);
    }
    
    const signalLine = calculateEMA(macdLine, signalPeriod);
    const histogram = [];
    
    for (let i = 0; i < macdLine.length; i++) {
        histogram.push(macdLine[i] - signalLine[i]);
    }
    
    const result = [];
    for (let i = 0; i < prices.length; i++) {
        result.push({
            macd: macdLine[i],
            signal: signalLine[i],
            histogram: histogram[i]
        });
    }
    
    return result;
}

// Calculer les indicateurs MACD (avec paramètres spécifiques au timeframe)
function calculateMACDIndicators(timeframe = '15m') {
    const closes = backtestData.map(candle => candle.close);
    
    // 🎯 Utiliser les paramètres MACD spécifiques au timeframe
    const macdParams = getMACDParametersForBacktest(timeframe);
    const macdData = calculateMACDForBacktest(closes, macdParams.fast, macdParams.slow, macdParams.signal);
    
    log(`📊 MACD calculé (${timeframe}): ${macdData.filter(v => v !== null).length} valeurs valides avec params ${macdParams.fast},${macdParams.slow},${macdParams.signal}`, 'DEBUG');
    
    // 🧮 DIAGNOSTIC MACD AVANCÉ
    diagnoseMACDAdvanced(macdData);
    
    return {
        type: 'macd',
        macd: macdData,
        signal: macdData.map(d => d.signal),
        histogram: macdData.map(d => d.histogram),
        crossover: macdData.map(d => d.crossover),
        trend: macdData.map(d => d.trend)
    };
}

// 🔍 Fonction de diagnostic pour le MACD avancé
function diagnoseMACDAdvanced(macdData) {
    const totalPoints = macdData.length;
    const validPoints = macdData.filter(v => v !== null && v.macd !== null).length;
    
    // Compter les croisements haussiers stricts (corriger l'accès aux propriétés)
    const crossovers = macdData.filter(d => d !== null && d.crossover === true).length;
    
    // Analyser les histogrammes (corriger l'accès aux propriétés)
    const histogramStats = {
        positive: macdData.filter(d => d !== null && d.histogram !== null && d.histogram > 0).length,
        negative: macdData.filter(d => d !== null && d.histogram !== null && d.histogram < 0).length,
        neutral: macdData.filter(d => d !== null && d.histogram !== null && d.histogram === 0).length
    };
    
    log(`🧮 === DIAGNOSTIC MACD AVANCÉ ===`, 'INFO');
    log(`📊 Points de données: ${validPoints}/${totalPoints} (${((validPoints/totalPoints)*100).toFixed(1)}%)`, 'INFO');
    log(`🔥 Croisements haussiers stricts: ${crossovers}`, 'SUCCESS');
    log(`📊 Histogramme: Positif=${histogramStats.positive}, Négatif=${histogramStats.negative}, Neutre=${histogramStats.neutral}`, 'INFO');
    
    // Calculer le pourcentage de signaux potentiels
    const potentialBuySignals = macdData.filter((d, i) => {
        return d !== null && d.macd !== null && d.signal !== null && d.histogram !== null && 
               d.macd > d.signal && d.histogram > 0;
    }).length;
    
    log(`🎯 Signaux BUY potentiels (MACD>Signal + Histogram>0): ${potentialBuySignals}`, 'SUCCESS');
    log(`🧮 === FIN DIAGNOSTIC MACD ===`, 'INFO');
}

// Calculer les indicateurs RSI
function calculateRSIIndicators() {
    const closes = backtestData.map(candle => candle.close);
    const rsiValues = calculateRSI(closes, backtestConfig.rsiParams.period);
    
    return {
        type: 'rsi',
        rsi: rsiValues
    };
}

// Calculer les indicateurs EMA
function calculateEMAIndicators() {
    const closes = backtestData.map(candle => candle.close);
    const emaFast = calculateEMA(closes, backtestConfig.emaParams.fast);
    const emaSlow = calculateEMA(closes, backtestConfig.emaParams.slow);
    
    return {
        type: 'ema',
        emaFast: emaFast,
        emaSlow: emaSlow
    };
}

// Calculer les indicateurs Bollinger
function calculateBollingerIndicators() {
    const closes = backtestData.map(candle => candle.close);
    const bollinger = calculateBollingerBands(closes, backtestConfig.bollingerParams.period, backtestConfig.bollingerParams.multiplier);
    
    return {
        type: 'bollinger',
        upper: bollinger.upper,
        middle: bollinger.middle,
        lower: bollinger.lower
    };
}

// FONCTION SUPPRIMÉE : simulateTrades() - Remplacée par runBacktestWithTradingLogic()
// Cette fonction utilisait l'ancienne logique de backtesting

// FONCTION SUPPRIMÉE : getEntrySignal() - Remplacée par analyzeMultiTimeframeForBacktest()
// Cette fonction utilisait l'ancienne logique MACD simple

// FONCTIONS SUPPRIMÉES : getRSISignal(), getEMASignal(), getBollingerSignal()
// Ces fonctions faisaient partie de l'ancienne logique multi-indicateurs
// Remplacées par la logique multi-timeframe MACD identique au trading principal

// FONCTION SUPPRIMÉE : openTrade() - Remplacée par la logique dans runBacktestWithTradingLogic()
// Cette fonction utilisait l'ancienne structure backtestResults.openTrades

// FONCTIONS SUPPRIMÉES : checkOpenTrades(), closeTrade(), updateEquity(), calculateFinalStats()
// Ces fonctions faisaient partie de l'ancienne logique de backtesting
// Remplacées par la logique intégrée dans runBacktestWithTradingLogic()

// Afficher les résultats du backtesting
function displayBacktestResults() {
    try {
        console.log('🔍 [DEBUG] Début displayBacktestResults...');
        
        if (!backtestResults) {
            console.error('❌ [DEBUG] backtestResults est null');
            log('❌ Aucun résultat de backtesting à afficher', 'ERROR');
            return;
        }
        
        console.log('✅ [DEBUG] backtestResults trouvé:', backtestResults);
        
        // 🔍 DEBUG: Vérifier la présence de tous les éléments HTML
        const elementsToCheck = [
            'backtestResults',
            'backtestProfit',
            'backtestTrades',
            'backtestWinRate',
            'backtestSharpe',
            'backtestDrawdown',
            'backtestAvgDuration',
            'exportBacktestBtn'
        ];
        
        for (const elementId of elementsToCheck) {
            const element = document.getElementById(elementId);
            if (!element) {
                console.error(`❌ [DEBUG] Élément HTML manquant: ${elementId}`);
                throw new Error(`Élément HTML manquant: ${elementId}`);
            } else {
                console.log(`✅ [DEBUG] Élément ${elementId} trouvé`);
            }
        }
        
        // Afficher la section des résultats
        document.getElementById('backtestResults').style.display = 'block';
        
        // Mettre à jour les statistiques avec la nouvelle structure
        document.getElementById('backtestProfit').textContent = `${backtestResults.totalPnLPercent >= 0 ? '+' : ''}${backtestResults.totalPnLPercent.toFixed(2)}%`;
        document.getElementById('backtestProfit').className = `stat-value ${backtestResults.totalPnLPercent >= 0 ? '' : 'negative'}`;
        
        document.getElementById('backtestTrades').textContent = backtestResults.totalTrades;
        document.getElementById('backtestWinRate').textContent = `${backtestResults.winRate.toFixed(1)}%`;
        
        // Calculer le Sharpe ratio (simplifié)
        const sharpeRatio = backtestResults.totalPnLPercent > 0 ? 
            (backtestResults.totalPnLPercent / Math.max(backtestResults.maxDrawdown, 1)) : 0;
        document.getElementById('backtestSharpe').textContent = sharpeRatio.toFixed(2);
        
        document.getElementById('backtestDrawdown').textContent = `${backtestResults.maxDrawdown.toFixed(2)}%`;
        
        // Durée moyenne en heures
        document.getElementById('backtestAvgDuration').textContent = `${backtestResults.avgTradeDuration.toFixed(1)}h`;
        
        // Afficher l'historique des trades
        console.log('🔍 [DEBUG] Affichage de l\'historique des trades...');
        displayTradeHistory();
        
        // Afficher le bouton d'export
        document.getElementById('exportBacktestBtn').style.display = 'block';

        // Plot equity curve
        console.log('🔍 [DEBUG] Affichage de la courbe d\'équité...');
        if (backtestResults.equityHistory && backtestResults.equityHistory.length > 0) {
            const timestamps = backtestResults.equityHistory.map(h => h.timestamp);
            const equity = backtestResults.equityHistory.map(h => h.equity);
            plotEquityCurve(equity, timestamps);
        } else {
            console.log('⚠️ [DEBUG] Pas de données d\'équité pour le graphique');
        }
        
        console.log('✅ [DEBUG] displayBacktestResults terminé avec succès');
        
    } catch (error) {
        console.error('❌ [DEBUG] Erreur dans displayBacktestResults:', error);
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
        
        // Masquer le placeholder
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
        // Remettre le placeholder en cas d'erreur
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
        console.log('🔍 [DEBUG] Début displayTradeHistory...');
        
        const historyDiv = document.getElementById('backtestTradeHistory');
        if (!historyDiv) {
            console.error('❌ [DEBUG] Élément backtestTradeHistory manquant');
            throw new Error('Élément backtestTradeHistory manquant');
        }
        
        console.log('✅ [DEBUG] Élément backtestTradeHistory trouvé');
        
        if (!backtestResults || !backtestResults.trades || backtestResults.trades.length === 0) {
            console.log('⚠️ [DEBUG] Aucun trade à afficher');
            historyDiv.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Aucun trade effectué</div>';
            return;
        }
        
        console.log(`✅ [DEBUG] Affichage de ${backtestResults.trades.length} trades`);
        
        let html = '';
        backtestResults.trades.forEach((trade, index) => {
            console.log(`🔍 [DEBUG] Processing trade ${index + 1}:`, trade);
            
            const isProfit = trade.pnl > 0;
            const duration = (trade.exitTime - trade.entryTime) / (1000 * 60 * 60); // en heures
            
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
        console.log('✅ [DEBUG] displayTradeHistory terminé avec succès');
        
    } catch (error) {
        console.error('❌ [DEBUG] Erreur dans displayTradeHistory:', error);
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
            strategy: 'MACD Multi-Timeframe (identique au trading)', // Hardcoded
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
    a.download = `backtesting_${data.summary.symbol.replace('/', '')}_MACD_MultiTimeframe_${Date.now()}.json`;
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
    
    // Vérifier que les éléments existent avant de les modifier
    if (startBtn) startBtn.style.display = running ? 'none' : 'block';
    if (stopBtn) stopBtn.style.display = running ? 'block' : 'none';
    if (statusDiv) statusDiv.style.display = running ? 'block' : 'none';
    
    // Désactiver les contrôles pendant l'exécution (sélecteur corrigé)
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
        
        if (!statusTextElement) {
            console.error('❌ [DEBUG] Élément backtestStatusText manquant');
            return;
        }
        
        if (!progressElement) {
            console.error('❌ [DEBUG] Élément backtestProgress manquant');
            return;
        }
        
        if (!progressTextElement) {
            console.error('❌ [DEBUG] Élément backtestProgressText manquant');
            return;
        }
        
        statusTextElement.textContent = message;
        progressElement.style.width = `${progress}%`;
        progressTextElement.textContent = `${progress}% terminé`;
        
        console.log(`📊 [DEBUG] Status mis à jour: ${message} (${progress}%)`);
        
    } catch (error) {
        console.error('❌ [DEBUG] Erreur dans updateBacktestStatus:', error);
    }
}

// Fonction pour changer le timeframe du graphique
function updateChartTimeframe() {
    const timeframeElement = document.getElementById('chartTimeframe');
    if (!timeframeElement) {
        log('⚠️ Chart timeframe element not found', 'WARNING');
        return;
    }
    const timeframe = timeframeElement.value;
    
    if (tvWidget) {
        try {
            tvWidget.chart().setResolution(timeframe);
            log(`📊 Timeframe du graphique changé: ${timeframe}`, 'INFO');
        } catch (error) {
            console.error('Erreur changement timeframe:', error);
        }
    }
}

// Fonctions utilitaires pour les indicateurs

// Calculer RSI
function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return new Array(prices.length).fill(null);
    
    const rsi = new Array(prices.length).fill(null);
    let gains = 0;
    let losses = 0;
    
    // Calculer les gains et pertes initiaux
    for (let i = 1; i <= period; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    rsi[period] = 100 - (100 / (1 + (avgGain / avgLoss)));
    
    // Calculer le RSI pour le reste
    for (let i = period + 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;
        
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        
        rsi[i] = 100 - (100 / (1 + (avgGain / avgLoss)));
    }
    
    return rsi;
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

// Calculer les Bandes de Bollinger
function calculateBollingerBands(prices, period = 20, multiplier = 2) {
    if (prices.length < period) {
        return {
            upper: new Array(prices.length).fill(null),
            middle: new Array(prices.length).fill(null),
            lower: new Array(prices.length).fill(null)
        };
    }
    
    const upper = new Array(prices.length).fill(null);
    const middle = new Array(prices.length).fill(null);
    const lower = new Array(prices.length).fill(null);
    
    for (let i = period - 1; i < prices.length; i++) {
        // Moyenne mobile simple
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
            sum += prices[j];
        }
        const sma = sum / period;
        middle[i] = sma;
        
        // Écart-type
        let variance = 0;
        for (let j = i - period + 1; j <= i; j++) {
            variance += Math.pow(prices[j] - sma, 2);
        }
        const stdDev = Math.sqrt(variance / period);
        
        upper[i] = sma + (multiplier * stdDev);
        lower[i] = sma - (multiplier * stdDev);
    }
    
    return { upper, middle, lower };
}

async function optimizeMACD() {
    // This function is no longer needed as MACD params are hardcoded
    log('Optimisation MACD désactivée - MACD params sont hardcodés.', 'INFO');
}

// Initialiser les événements
document.addEventListener('DOMContentLoaded', function() {
    // Initialiser le backtesting quand la page est chargée
    console.log('✅ Backtesting module initialized');
    
    // Vérifier la présence des éléments critiques
    const criticalElements = [
        'chartSymbol',
        'backtestDuration',
        'backtestPositionSize',
        'backtestTrailingStop',
        'backtestTakeProfit',
        'enableTakeProfit',
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

// Fonction pour mettre à jour la paire sélectionnée
function updateSelectedPair() {
    const selectedPair = document.getElementById('chartSymbol').value;
    const symbol = selectedPair.split(':')[1]; // Enlever le préfixe BINANCE:
    
    log(`🔄 Paire sélectionnée pour le backtesting: ${symbol}`, 'INFO');
    
    // Arrêter le backtesting en cours si il y en a un
    if (backtestRunning) {
        stopBacktest();
        log('⏹️ Backtesting arrêté - Nouvelle paire sélectionnée', 'INFO');
    }
}

// Fonction pour activer/désactiver le Take Profit
function toggleTakeProfit() {
    const enableCheckbox = document.getElementById('enableTakeProfit');
    const takeProfitInput = document.getElementById('backtestTakeProfit');
    
    if (enableCheckbox.checked) {
        takeProfitInput.disabled = false;
        takeProfitInput.style.opacity = '1';
        log('✅ Take Profit activé', 'INFO');
    } else {
        takeProfitInput.disabled = true;
        takeProfitInput.style.opacity = '0.5';
        log('❌ Take Profit désactivé - Utilisation du trailing stop loss uniquement', 'INFO');
    }
}

// Mapping des timeframes d'analyse vers les timeframes de précision pour trailing stop
function getPrecisionTimeframe(analysisTimeframe) {
    const mapping = {
        '15m': '3m',   // Analyse 15min → Précision 3min
        '1h': '5m',    // Analyse 1h → Précision 5min
        '4h': '15m',   // Analyse 4h → Précision 15min
        '1d': '1h',    // Analyse 1d → Précision 1h
        '5m': '1m',    // Analyse 5min → Précision 1min
        '30m': '5m'    // Analyse 30min → Précision 5min
    };
    return mapping[analysisTimeframe] || '1m'; // Par défaut 1min si non trouvé
}

// Récupérer les données de précision pour le trailing stop
async function getPrecisionDataForTrailing(symbol, startTime, endTime, analysisTimeframe) {
    try {
        const precisionTimeframe = getPrecisionTimeframe(analysisTimeframe);
        
        // Calculer le nombre de bougies nécessaires
        const precisionMinutes = getTimeframeMinutes(precisionTimeframe);
        const totalMinutes = Math.ceil((endTime - startTime) / (60 * 1000));
        let limit = Math.ceil(totalMinutes / precisionMinutes);
        
        // Limiter à 1000 bougies maximum (limite API Binance)
        if (limit > 1000) {
            limit = 1000;
            log(`⚠️ Limitation précision trailing stop: ${limit} bougies ${precisionTimeframe} (max 1000)`, 'WARNING');
        }
        
        // Éviter les requêtes pour des périodes trop courtes
        if (limit < 2) {
            return [];
        }
        
        log(`📊 Récupération ${limit} bougies ${precisionTimeframe} pour précision trailing stop`, 'DEBUG');
        
        // Utiliser l'API Binance pour récupérer les données de précision
        const klines = await getBinanceKlineData(symbol, limit, precisionTimeframe);
        
        // Filtrer les données dans la plage de temps
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
    
    // Si le timeframe d'analyse est déjà le plus précis, pas besoin de données supplémentaires
    if (analysisTimeframe === precisionTimeframe) {
        return null;
    }
    
    const symbol = trade.symbol;
    const endTime = nextCandle ? nextCandle.timestamp : currentCandle.timestamp + (getTimeframeMinutes(analysisTimeframe) * 60 * 1000);
    
    log(`🔍 Vérification précision trailing stop: ${analysisTimeframe} → ${precisionTimeframe}`, 'DEBUG');
    
    const precisionData = await getPrecisionDataForTrailing(symbol, currentCandle.timestamp, endTime, analysisTimeframe);
    
    if (precisionData.length === 0) {
        log(`⚠️ Pas de données précision, utilisation logique standard`, 'WARNING');
        return null; // Pas de données, utiliser la logique standard
    }
    
    log(`📊 Analyse ${precisionData.length} bougies ${precisionTimeframe} pour trailing stop`, 'DEBUG');
    
    for (const precisionCandle of precisionData) {
        if (trade.side === 'LONG') { // Changed from trade.direction to trade.side
            // Mettre à jour le prix le plus haut
            if (precisionCandle.high > trade.highestPrice) {
                trade.highestPrice = precisionCandle.high;
                trade.trailingStopPrice = trade.highestPrice * (1 - backtestConfig.trailingStop / 100);
                log(`🔍 LONG - Nouveau high précision: ${trade.highestPrice.toFixed(4)}, Stop: ${trade.trailingStopPrice.toFixed(4)}`, 'DEBUG');
            }
            
            // Vérifier si le trailing stop est touché
            if (precisionCandle.low <= trade.trailingStopPrice) {
                log(`🎯 LONG - Stop déclenché précision ${precisionTimeframe}: ${precisionCandle.low.toFixed(4)} <= ${trade.trailingStopPrice.toFixed(4)}`, 'SUCCESS');
                return {
                    exitPrice: trade.trailingStopPrice,
                    exitTime: precisionCandle.timestamp,
                    reason: `Trailing Stop Loss (${precisionTimeframe} precision)`
                };
            }
        } else { // SHORT
            // Mettre à jour le prix le plus bas
            if (precisionCandle.low < trade.lowestPrice) {
                trade.lowestPrice = precisionCandle.low;
                trade.trailingStopPrice = trade.lowestPrice * (1 + backtestConfig.trailingStop / 100);
                log(`🔍 SHORT - Nouveau low précision: ${trade.lowestPrice.toFixed(4)}, Stop: ${trade.trailingStopPrice.toFixed(4)}`, 'DEBUG');
            }
            
            // Vérifier si le trailing stop est touché
            if (precisionCandle.high >= trade.trailingStopPrice) {
                log(`🎯 SHORT - Stop déclenché précision ${precisionTimeframe}: ${precisionCandle.high.toFixed(4)} >= ${trade.trailingStopPrice.toFixed(4)}`, 'SUCCESS');
                return {
                    exitPrice: trade.trailingStopPrice,
                    exitTime: precisionCandle.timestamp,
                    reason: `Trailing Stop Loss (${precisionTimeframe} precision)`
                };
            }
        }
    }
    
    return null;
}

// Rendre les fonctions accessibles globalement
window.startBacktest = startBacktest;
window.stopBacktest = stopBacktest;
window.exportBacktestResults = exportBacktestResults;
window.updateChartTimeframe = updateChartTimeframe;
window.updateSelectedPair = updateSelectedPair;
window.toggleTakeProfit = toggleTakeProfit;
window.optimizeMACD = optimizeMACD;

console.log('✅ Backtesting system loaded successfully');
