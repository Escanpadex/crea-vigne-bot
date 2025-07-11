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

// Variables globales pour le backtesting
let backtestRunning = false;
let backtestData = null;
let backtestResults = null;
let backtestInterval = null;
let equityChart = null;
let extended4hData = null;
let extended1hData = null;

// Configuration du backtesting (simplifiée)
let backtestConfig = {
    timeframe: '15m', // Base for simulation
    duration: 7, // jours
    capital: 1000, // Capital fixe
    positionSize: 10, // pourcentage
    trailingStop: 1.5, // pourcentage
    takeProfit: 4, // pourcentage
    enableTakeProfit: true, // activer/désactiver le take profit
};

// NOUVELLE FONCTION : Copie exacte de la fonction analyzeMultiTimeframe du trading principal
// 🔧 CORRECTION: Analyse multi-timeframe avec données étendues pour 4H et 1H
async function analyzeMultiTimeframeForBacktest(symbol, historicalData, candleIndex) {
    try {
        console.log(`🔍 [DEBUG] Analyse multi-timeframe pour ${symbol} à l'index ${candleIndex}`);
        
        const currentTime = historicalData[candleIndex].timestamp;
        const results = {};
        
        // ÉTAPE 1 : Analyser le dernier signal 4H connu (peut être en dehors des 7 jours)
        const data4h = extended4hData.filter(c => c.timestamp <= currentTime);
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
        const data1h = extended1hData.filter(c => c.timestamp <= currentTime);
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

// NOUVELLE FONCTION : Trouver le dernier signal dans un timeframe
async function findLastSignalInTimeframe(symbol, timeframe, data) {
    try {
        let lastSignal = null;
        let lastSignalIndex = -1;
        
        // Parcourir les données de la fin vers le début pour trouver le dernier signal
        for (let i = data.length - 1; i >= 50; i--) {
            const analysis = await analyzePairMACDForBacktest(symbol, timeframe, data.slice(0, i + 1));
            
            // Si on trouve un signal clair (BUY, BULLISH, ou BEARISH), c'est le dernier signal
            if (analysis.signal === 'BUY' || analysis.signal === 'BULLISH' || analysis.signal === 'BEARISH') {
                lastSignal = analysis;
                lastSignalIndex = i;
                break;
            }
        }
        
        // Si aucun signal trouvé, considérer comme neutre
        if (!lastSignal) {
            lastSignal = { signal: 'NEUTRAL', reason: 'Aucun signal clair trouvé' };
            lastSignalIndex = data.length - 1;
        }
        
        lastSignal.signalIndex = lastSignalIndex;
        return lastSignal;
        
    } catch (error) {
        console.error(`❌ [DEBUG] Erreur findLastSignalInTimeframe ${timeframe}:`, error);
        return { signal: 'NEUTRAL', reason: `Erreur: ${error.message}`, signalIndex: -1 };
    }
}

// NOUVELLE FONCTION : Vérifier si un nouveau signal haussier est apparu après un signal baissier
async function checkForNewBullishSignal(symbol, timeframe, data, lastSignalIndex) {
    try {
        // Chercher un nouveau signal haussier après le dernier signal baissier
        for (let i = lastSignalIndex + 1; i < data.length; i++) {
            const analysis = await analyzePairMACDForBacktest(symbol, timeframe, data.slice(0, i + 1));
            
            // Si on trouve un signal haussier (BUY ou BULLISH), c'est un nouveau signal
            if (analysis.signal === 'BUY' || analysis.signal === 'BULLISH') {
                analysis.signalIndex = i;
                console.log(`✅ [DEBUG] Nouveau signal haussier ${timeframe} trouvé à l'index ${i}: ${analysis.signal}`);
                return analysis;
            }
        }
        
        return null; // Aucun nouveau signal haussier trouvé
        
    } catch (error) {
        console.error(`❌ [DEBUG] Erreur checkForNewBullishSignal ${timeframe}:`, error);
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

// NOUVELLE FONCTION : Paramètres MACD adaptés par timeframe (IDENTIQUES AU TRADING)
function getMACDParametersForBacktest(timeframe) {
    const parameters = {
        '4h': { fast: 12, slow: 26, signal: 9, minCandles: 200 },
        '1h': { fast: 30, slow: 50, signal: 20, minCandles: 300 },
        '15m': { fast: 30, slow: 50, signal: 40, minCandles: 350 }
    };
    
    const params = parameters[timeframe] || parameters['4h'];
    log(`📊 MACD ${timeframe} (Backtesting): Fast=${params.fast}, Slow=${params.slow}, Signal=${params.signal}`, 'DEBUG');
    return params;
}

// Fonction pour récupérer les données klines depuis l'API Binance
async function getBinanceKlineData(symbol, limit = 500, interval = '15m', startTime, endTime) {
    try {
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
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (Array.isArray(data)) {
            const klines = data.map(candle => ({
                timestamp: parseInt(candle[0]),
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                volume: parseFloat(candle[5])
            }));
            
            log(`📊 Binance: ${symbol} - ${klines.length} bougies ${interval} récupérées`, 'INFO');
            return klines;
        } else {
            log(`❌ Erreur API Binance: ${data.msg || 'Réponse invalide'}`, 'ERROR');
            return [];
        }
    } catch (error) {
        log(`❌ Erreur réseau Binance ${symbol}: ${error.message}`, 'ERROR');
        return [];
    }
}

// Fonctions supprimées - utilisaient des appels API inutiles
// La nouvelle logique utilise uniquement la stratégie fixe identique au trading principal

// Fonction pour démarrer le backtesting
async function startBacktest() {
    if (backtestRunning) {
        log('⚠️ Un backtesting est déjà en cours', 'WARNING');
        return;
    }
    
    try {
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
    } finally {
        backtestRunning = false;
        updateBacktestUI(false);
        // Nettoyer les données étendues
        extended4hData = null;
        extended1hData = null;
    }
}

// Fonction pour arrêter le backtesting
function stopBacktest() {
    if (!backtestRunning) return;
    
    backtestRunning = false;
    if (backtestInterval) {
        clearInterval(backtestInterval);
        backtestInterval = null;
    }
    
    updateBacktestUI(false);
    log('⏹️ Backtesting arrêté par l\'utilisateur', 'INFO');
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
        console.log('🔍 [DEBUG] Début runBacktestWithTradingLogic...');
        
        updateBacktestStatus('Exécution du backtesting avec stratégie identique au trading...', 55);
        
        // Initialiser les variables de simulation
        let equity = backtestConfig.capital;
        let openTrades = [];
        let closedTrades = [];
        let equityHistory = [];
        let totalSignals = 0;
        let buySignals = 0;
        let filteredSignals = 0;
        
        console.log(`✅ [DEBUG] Variables initialisées - Capital: ${equity}, Config:`, backtestConfig);
        
        // Vérifier les données historiques
        if (!backtestData || backtestData.length === 0) {
            console.error('❌ [DEBUG] backtestData est null ou vide');
            throw new Error('Données historiques manquantes');
        }
        
        console.log(`✅ [DEBUG] ${backtestData.length} bougies disponibles pour le backtesting`);
        
        // Parcourir les données historiques
        for (let i = 50; i < backtestData.length; i++) {
            const currentCandle = backtestData[i];
            
            if (!currentCandle) {
                console.error(`❌ [DEBUG] Bougie manquante à l'index ${i}`);
                continue;
            }
            
            // Mettre à jour le progrès de façon plus fluide
            const progress = Math.round((i / backtestData.length) * 100);
            if (i % 10 === 0) { // Mettre à jour tous les 10 index pour éviter trop de mises à jour
                updateBacktestStatus(`Analyse des données... Bougie ${i}/${backtestData.length} (${progress}%)`, 55 + (progress * 0.4));
            }
            
            // Analyser le signal multi-timeframe (identique au trading)
            const analysis = await analyzeMultiTimeframeForBacktest(
                backtestData[0].symbol || 'BTCUSDT', 
                backtestData.slice(0, i + 1),
                i // Passer l'index de la bougie actuelle
            );
            
            totalSignals++;
            
            if (!analysis) {
                console.error(`❌ [DEBUG] Analyse manquante à l'index ${i}`);
                continue;
            }
            
            // Debug des signaux
            if (analysis.finalDecision === 'BUY') {
                buySignals++;
                console.log(`✅ [DEBUG] Signal BUY détecté à l'index ${i} - Raison: ${analysis.finalReason}`);
            } else if (analysis.finalDecision === 'FILTERED') {
                filteredSignals++;
                if (i % 50 === 0) { // Log moins fréquent pour éviter le spam
                    console.log(`❌ [DEBUG] Signal filtré à l'index ${i} - Raison: ${analysis.filterReason}`);
                }
            }
            
            // Ouvrir une position si signal BUY et pas de position ouverte
            if (analysis.finalDecision === 'BUY' && openTrades.length === 0) {
                const positionSize = (equity * backtestConfig.positionSize / 100);
                const quantity = positionSize / currentCandle.close;
                
                const trade = {
                    id: Date.now(),
                    symbol: backtestData[0].symbol || 'BTCUSDT',
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
                console.log(`🚀 [DEBUG] Position ouverte à l'index ${i}: Prix=${trade.entryPrice.toFixed(4)}, Quantité=${trade.quantity.toFixed(6)}`);
                log(`🚀 Position ouverte: ${trade.symbol} LONG @ ${trade.entryPrice.toFixed(4)} - Raison: ${trade.reason}`, 'SUCCESS');
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
                    
                    console.log(`📊 [DEBUG] Position fermée à l'index ${i}: ${closeReason}, PnL=${pnl.toFixed(2)}$`);
                    log(`📊 Position fermée: ${trade.symbol} - ${closeReason} - PnL: ${pnl.toFixed(2)}$ (${pnlPercent.toFixed(2)}%)`, 
                        pnl > 0 ? 'SUCCESS' : 'WARNING');
                }
            }
            
            // Enregistrer l'équité
            equityHistory.push({
                timestamp: currentCandle.timestamp,
                equity: equity,
                drawdown: Math.max(0, (backtestConfig.capital - equity) / backtestConfig.capital * 100)
            });
        }
        
        // Fermer les positions ouvertes à la fin
        console.log(`🔍 [DEBUG] Fermeture des positions ouvertes: ${openTrades.length}`);
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
        
        // Statistiques de debug
        console.log(`📊 [DEBUG] Statistiques d'analyse:`);
        console.log(`  - Total signaux analysés: ${totalSignals}`);
        console.log(`  - Signaux BUY: ${buySignals}`);
        console.log(`  - Signaux filtrés: ${filteredSignals}`);
        console.log(`  - Positions ouvertes: ${closedTrades.length}`);
        
        // Calculer les résultats finaux
        console.log(`🔍 [DEBUG] Calcul des résultats finaux - ${closedTrades.length} trades fermés`);
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
            filteredSignals: filteredSignals
        };
        
        console.log('✅ [DEBUG] Résultats finaux calculés:', backtestResults);
        
        updateBacktestStatus('Backtesting terminé avec succès !', 100);
        
    } catch (error) {
        console.error('❌ [DEBUG] Erreur dans runBacktestWithTradingLogic:', error);
        log(`❌ Erreur lors du backtesting: ${error.message}`, 'ERROR');
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
    const ctx = document.getElementById('equityCurveChart').getContext('2d');
    
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
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: false
                }
            }
        }
    });
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
    document.getElementById('startBacktestBtn').style.display = running ? 'none' : 'block';
    document.getElementById('stopBacktestBtn').style.display = running ? 'block' : 'none';
    document.getElementById('backtestStatus').style.display = running ? 'block' : 'none';
    
    // Désactiver les contrôles pendant l'exécution
    document.querySelectorAll('#backtestingCard input, #backtestingCard select').forEach(el => {
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
    // Gérer le changement de stratégie
    const strategySelect = document.getElementById('backtestStrategy');
    if (strategySelect) {
        strategySelect.addEventListener('change', updateStrategyParams);
        // Initialiser l'affichage des paramètres
        updateStrategyParams();
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
window.optimizeMACD = optimizeMACD; // Add this line to make optimizeMACD accessible

console.log('✅ Backtesting system loaded successfully');

// CORRECTION TEMPORAIRE - Désactiver la précision
window.checkTrailingStopPrecision_DISABLED = true;
