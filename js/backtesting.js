// Backtesting System for Trading Strategies
console.log('📁 Loading backtesting.js...');

// Variables globales pour le backtesting
let backtestRunning = false;
let backtestData = null;
let backtestResults = null;
let backtestInterval = null;

// Configuration du backtesting
let backtestConfig = {
    strategy: 'macd',
    timeframe: '15m',
    duration: 7, // jours
    capital: 1000, // Capital fixe
    positionSize: 10, // pourcentage
    trailingStop: 1.5, // pourcentage
    takeProfit: 4, // pourcentage
    enableTakeProfit: true, // activer/désactiver le take profit
    macdParams: {
        fast: 12,
        slow: 26,
        signal: 9
    },
    rsiParams: {
        period: 14,
        oversold: 30,
        overbought: 70
    },
    emaParams: {
        fast: 9,
        slow: 21
    }
};

// Fonction pour récupérer les données klines depuis l'API Binance
async function getBinanceKlineData(symbol, limit = 500, interval = '15m') {
    try {
        // Conversion des timeframes pour Binance
        const binanceIntervals = {
            '1m': '1m',
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
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${limit}`;
        
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
            
            log(`📊 Binance: ${symbol} - ${klines.length} bougies ${interval} récupérées`, 'DEBUG');
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

// Récupérer les données 1 minute pour le trailing stop loss précis via API Binance
async function get1MinuteDataForTrailing(symbol, startTime, endTime) {
    try {
        // Calculer le nombre de minutes entre les deux timestamps
        const minutes = Math.ceil((endTime - startTime) / (60 * 1000));
        
        // Limiter strictement à 1000 et éviter les requêtes trop importantes
        let limit = Math.min(1000, minutes);
        
        // Pour éviter les requêtes trop fréquentes, limiter à maximum 240 minutes (4h)
        if (limit > 240) {
            limit = 240;
            log(`⚠️ Limitation trailing stop: ${minutes}min demandées, réduit à ${limit}min`, 'WARNING');
        }
        
        // Éviter les requêtes pour des périodes trop courtes
        if (limit < 1) {
            return [];
        }
        
        // Utiliser l'API Binance pour récupérer les données 1 minute
        const klines = await getBinanceKlineData(symbol, limit, '1m');
        
        // Filtrer les données dans la plage de temps
        return klines.filter(k => k.timestamp >= startTime && k.timestamp <= endTime);
    } catch (error) {
        console.error('Erreur récupération données 1min pour trailing stop:', error);
        return [];
    }
}

// Vérifier le trailing stop loss avec précision 1 minute pour timeframes supérieurs
async function checkTrailingStopPrecision(trade, currentCandle, nextCandle) {
    // Si le timeframe est déjà 1 minute, pas besoin de données supplémentaires
    if (backtestConfig.timeframe === '1min') {
        return null;
    }
    
    // Pour les timeframes élevés, simplifier en utilisant seulement les données de la bougie actuelle
    // Cela évite les requêtes API excessives tout en gardant une précision raisonnable
    const timeframeMinutes = getTimeframeMinutes(backtestConfig.timeframe);
    
    // Pour les timeframes > 1h, utiliser une approche simplifiée sans données 1min
    if (timeframeMinutes >= 60) {
        log(`📊 Trailing stop simplifié pour timeframe ${backtestConfig.timeframe} (évite requêtes API excessives)`, 'DEBUG');
        return null; // Utiliser la logique standard de checkOpenTrades
    }
    
    // Seulement pour les timeframes courts (15m, 30m), récupérer quelques données 1min
    const symbol = trade.symbol;
    const endTime = nextCandle ? nextCandle.timestamp : currentCandle.timestamp + (timeframeMinutes * 60 * 1000);
    
    // Limiter à maximum 30 minutes de données 1min pour éviter les erreurs API
    const maxMinutes = Math.min(30, timeframeMinutes);
    const limitedEndTime = currentCandle.timestamp + (maxMinutes * 60 * 1000);
    const actualEndTime = Math.min(endTime, limitedEndTime);
    
    const minuteData = await get1MinuteDataForTrailing(symbol, currentCandle.timestamp, actualEndTime);
    
    if (minuteData.length === 0) {
        return null; // Pas de données, utiliser la logique standard
    }
    
    for (const minuteCandle of minuteData) {
        if (trade.direction === 'LONG') {
            // Mettre à jour le prix le plus haut
            if (minuteCandle.high > trade.highestPrice) {
                trade.highestPrice = minuteCandle.high;
                trade.trailingStopPrice = trade.highestPrice * (1 - backtestConfig.trailingStop / 100);
            }
            
            // Vérifier si le trailing stop est touché
            if (minuteCandle.low <= trade.trailingStopPrice) {
                return {
                    exitPrice: trade.trailingStopPrice,
                    exitTime: minuteCandle.timestamp,
                    reason: 'Trailing Stop Loss (1min precision)'
                };
            }
        } else { // SHORT
            // Mettre à jour le prix le plus bas
            if (minuteCandle.low < trade.lowestPrice) {
                trade.lowestPrice = minuteCandle.low;
                trade.trailingStopPrice = trade.lowestPrice * (1 + backtestConfig.trailingStop / 100);
            }
            
            // Vérifier si le trailing stop est touché
            if (minuteCandle.high >= trade.trailingStopPrice) {
                return {
                    exitPrice: trade.trailingStopPrice,
                    exitTime: minuteCandle.timestamp,
                    reason: 'Trailing Stop Loss (1min precision)'
                };
            }
        }
    }
    
    return null;
}

// Gestion des paramètres de stratégie
function updateStrategyParams() {
    const strategy = document.getElementById('backtestStrategy').value;
    
    // Masquer tous les paramètres
    document.querySelectorAll('.strategy-params').forEach(el => {
        el.style.display = 'none';
    });
    
    // Afficher les paramètres de la stratégie sélectionnée
    switch(strategy) {
        case 'macd':
        case 'macd_multi':
            document.getElementById('macdParams').style.display = 'block';
            break;
        case 'rsi':
            document.getElementById('rsiParams').style.display = 'block';
            break;
        case 'ema_cross':
            document.getElementById('emaParams').style.display = 'block';
            break;
        case 'bollinger':
            // Pas de paramètres spécifiques pour Bollinger pour le moment
            break;
    }
}

// Fonction pour démarrer le backtesting
async function startBacktest() {
    if (backtestRunning) {
        log('⚠️ Un backtesting est déjà en cours', 'WARNING');
        return;
    }
    
    try {
        // Récupérer la configuration
        await updateBacktestConfig();
        
        // Valider la configuration
        if (!validateBacktestConfig()) {
            return;
        }
        
        // Récupérer la crypto sélectionnée
        const selectedSymbol = document.getElementById('chartSymbol').value;
        const symbol = selectedSymbol.split(':')[1]; // Enlever le préfixe BINANCE:
        
        backtestRunning = true;
        updateBacktestUI(true);
        
        log(`🚀 Démarrage du backtesting: ${symbol} - ${backtestConfig.strategy} - ${backtestConfig.duration} jours`, 'INFO');
        
        // Récupérer les données historiques
        await fetchBacktestData(symbol);
        
        if (!backtestData || backtestData.length === 0) {
            throw new Error('Impossible de récupérer les données historiques');
        }
        
        // Exécuter le backtesting
        await runBacktestStrategy();
        
        // Afficher les résultats
        displayBacktestResults();
        
        log('✅ Backtesting terminé avec succès', 'SUCCESS');
        
    } catch (error) {
        log(`❌ Erreur backtesting: ${error.message}`, 'ERROR');
        console.error('Erreur backtesting:', error);
    } finally {
        backtestRunning = false;
        updateBacktestUI(false);
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
    backtestConfig = {
        strategy: document.getElementById('backtestStrategy').value,
        timeframe: document.getElementById('backtestTimeframe').value,
        duration: parseInt(document.getElementById('backtestDuration').value),
        capital: 1000, // Capital fixe
        positionSize: parseFloat(document.getElementById('backtestPositionSize').value),
        trailingStop: parseFloat(document.getElementById('backtestTrailingStop').value),
        takeProfit: parseFloat(document.getElementById('backtestTakeProfit').value),
        enableTakeProfit: document.getElementById('enableTakeProfit').checked,
        macdParams: {
            fast: parseInt(document.getElementById('macdFast').value),
            slow: parseInt(document.getElementById('macdSlow').value),
            signal: parseInt(document.getElementById('macdSignal').value)
        },
        rsiParams: {
            period: parseInt(document.getElementById('rsiPeriod').value),
            oversold: parseInt(document.getElementById('rsiOversold').value),
            overbought: parseInt(document.getElementById('rsiOverbought').value)
        },
        emaParams: {
            fast: parseInt(document.getElementById('emaFast').value),
            slow: parseInt(document.getElementById('emaSlow').value)
        }
    };
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

// Récupérer les données historiques via API Binance
async function fetchBacktestData(symbol) {
    try {
        updateBacktestStatus('Récupération des données historiques via Binance...', 10);
        
        // Calculer le nombre de bougies nécessaires
        const timeframeMinutes = getTimeframeMinutes(backtestConfig.timeframe);
        const totalMinutes = backtestConfig.duration * 24 * 60;
        const candlesNeeded = Math.ceil(totalMinutes / timeframeMinutes) + 100; // +100 pour les indicateurs
        
        // Limiter à 1000 bougies maximum (limite API Binance)
        const limit = Math.min(candlesNeeded, 1000);
        
        log(`📊 Récupération de ${limit} bougies ${backtestConfig.timeframe} pour ${symbol} via Binance`, 'INFO');
        
        // Utiliser l'API Binance pour récupérer les données
        backtestData = await getBinanceKlineData(symbol, limit, backtestConfig.timeframe);
        
        if (backtestData.length === 0) {
            throw new Error('Aucune donnée historique récupérée depuis Binance');
        }
        
        // Log des premières et dernières données pour vérification
        log(`✅ ${backtestData.length} bougies récupérées depuis Binance pour le backtesting`, 'SUCCESS');
        log(`📊 Première bougie: ${new Date(backtestData[0].timestamp).toLocaleString()} - Prix: ${backtestData[0].close}`, 'DEBUG');
        log(`📊 Dernière bougie: ${new Date(backtestData[backtestData.length-1].timestamp).toLocaleString()} - Prix: ${backtestData[backtestData.length-1].close}`, 'DEBUG');
        
        updateBacktestStatus('Données Binance récupérées avec succès', 25);
        
    } catch (error) {
        throw new Error(`Erreur récupération données Binance: ${error.message}`);
    }
}

// Convertir timeframe en minutes
function getTimeframeMinutes(timeframe) {
    const mapping = {
        '5m': 5,
        '15m': 15,
        '1h': 60,
        '4h': 240,
        '1d': 1440
    };
    return mapping[timeframe] || 15;
}

// Exécuter la stratégie de backtesting
async function runBacktestStrategy() {
    updateBacktestStatus('Exécution de la stratégie...', 30);
    
    backtestResults = {
        trades: [],
        equity: [backtestConfig.capital],
        timestamps: [backtestData[0].timestamp],
        currentCapital: backtestConfig.capital,
        openTrades: [],
        stats: {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalProfit: 0,
            totalLoss: 0,
            maxDrawdown: 0,
            maxEquity: backtestConfig.capital
        }
    };
    
    // Calculer les indicateurs selon la stratégie
    let indicators = null;
    switch(backtestConfig.strategy) {
        case 'macd':
        case 'macd_multi':
            indicators = calculateMACDIndicators();
            break;
        case 'rsi':
            indicators = calculateRSIIndicators();
            break;
        case 'ema_cross':
            indicators = calculateEMAIndicators();
            break;
        case 'bollinger':
            indicators = calculateBollingerIndicators();
            break;
    }
    
    if (!indicators) {
        throw new Error('Impossible de calculer les indicateurs');
    }
    
    // Simuler les trades
    await simulateTrades(indicators);
    
    // Calculer les statistiques finales
    calculateFinalStats();
    
    updateBacktestStatus('Backtesting terminé', 100);
}

// Calculer MACD (fonction intégrée pour le backtesting)
function calculateMACDForBacktest(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (prices.length < slowPeriod + signalPeriod) {
        return {
            macdArray: new Array(prices.length).fill(null),
            signalArray: new Array(prices.length).fill(null)
        };
    }
    
    // Calculer les EMA
    const emaFast = calculateEMA(prices, fastPeriod);
    const emaSlow = calculateEMA(prices, slowPeriod);
    
    // Calculer la ligne MACD
    const macdArray = new Array(prices.length).fill(null);
    for (let i = slowPeriod - 1; i < prices.length; i++) {
        if (emaFast[i] !== null && emaSlow[i] !== null) {
            macdArray[i] = emaFast[i] - emaSlow[i];
        }
    }
    
    // Calculer la ligne de signal (EMA du MACD)
    const signalArray = new Array(prices.length).fill(null);
    const macdValidValues = [];
    
    // Collecter les valeurs MACD valides
    for (let i = slowPeriod - 1; i < prices.length; i++) {
        if (macdArray[i] !== null) {
            macdValidValues.push(macdArray[i]);
        }
    }
    
    // Calculer l'EMA de la ligne MACD
    if (macdValidValues.length >= signalPeriod) {
        const signalEMA = calculateEMA(macdValidValues, signalPeriod);
        
        // Mapper les valeurs de signal aux indices corrects
        let signalIndex = 0;
        for (let i = slowPeriod - 1; i < prices.length; i++) {
            if (macdArray[i] !== null) {
                if (signalIndex < signalEMA.length && signalEMA[signalIndex] !== null) {
                    signalArray[i] = signalEMA[signalIndex];
                }
                signalIndex++;
            }
        }
    }
    
    return {
        macdArray: macdArray,
        signalArray: signalArray
    };
}

// Calculer les indicateurs MACD
function calculateMACDIndicators() {
    const closes = backtestData.map(candle => candle.close);
    const macdData = calculateMACDForBacktest(closes, backtestConfig.macdParams.fast, backtestConfig.macdParams.slow, backtestConfig.macdParams.signal);
    
    log(`📊 MACD calculé: ${macdData.macdArray.filter(v => v !== null).length} valeurs valides`, 'DEBUG');
    
    return {
        type: 'macd',
        macd: macdData.macdArray,
        signal: macdData.signalArray,
        histogram: macdData.macdArray.map((macd, i) => {
            const signal = macdData.signalArray[i];
            return (macd !== null && signal !== null) ? macd - signal : null;
        })
    };
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
    const bollinger = calculateBollingerBands(closes, 20, 2);
    
    return {
        type: 'bollinger',
        upper: bollinger.upper,
        middle: bollinger.middle,
        lower: bollinger.lower
    };
}

// Simuler les trades
async function simulateTrades(indicators) {
    const totalCandles = backtestData.length;
    let progress = 30;
    let signalCount = { BUY: 0, SELL: 0, HOLD: 0 };
    
    log(`🔄 Début simulation: ${totalCandles} bougies, début à l'index 50`, 'INFO');
    
    for (let i = 50; i < totalCandles; i++) { // Commencer à 50 pour avoir assez de données pour les indicateurs
        const candle = backtestData[i];
        
        // Mettre à jour le progrès
        if (i % 10 === 0) {
            progress = 30 + ((i / totalCandles) * 60);
            updateBacktestStatus(`Analyse bougie ${i}/${totalCandles}`, progress);
        }
        
        // Vérifier les signaux d'entrée
        const signal = getEntrySignal(indicators, i);
        signalCount[signal]++;
        
        // Log des premiers signaux pour debug
        if (i < 60 && signal !== 'HOLD') {
            log(`🎯 Signal ${signal} détecté à l'index ${i} - Prix: ${candle.close}`, 'INFO');
        }
        
        if (signal === 'BUY' && backtestResults.openTrades.length === 0) {
            openTrade(candle, 'LONG');
        } else if (signal === 'SELL' && backtestResults.openTrades.length === 0) {
            openTrade(candle, 'SHORT');
        }
        
        // Vérifier les trades ouverts
        await checkOpenTrades(candle, i);
        
        // Mettre à jour l'équité
        updateEquity(candle);
        
        // Petit délai pour éviter de bloquer l'interface
        if (i % 50 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1));
        }
    }
    
    log(`📊 Résumé des signaux: BUY=${signalCount.BUY}, SELL=${signalCount.SELL}, HOLD=${signalCount.HOLD}`, 'INFO');
    log(`💼 Trades fermés: ${backtestResults.trades.length}`, 'INFO');
}

// Obtenir le signal d'entrée selon la stratégie
function getEntrySignal(indicators, index) {
    switch(backtestConfig.strategy) {
        case 'macd':
        case 'macd_multi':
            return getMACDSignal(indicators, index);
        case 'rsi':
            return getRSISignal(indicators, index);
        case 'ema_cross':
            return getEMASignal(indicators, index);
        case 'bollinger':
            return getBollingerSignal(indicators, index);
        default:
            return 'HOLD';
    }
}

// Signal MACD
function getMACDSignal(indicators, index) {
    const macd = indicators.macd[index];
    const signal = indicators.signal[index];
    const prevMacd = indicators.macd[index - 1];
    const prevSignal = indicators.signal[index - 1];
    
    // Log de debug pour les premières bougies
    if (index < 55 && index % 10 === 0) {
        log(`🔍 MACD Debug [${index}]: MACD=${macd?.toFixed(6)}, Signal=${signal?.toFixed(6)}, Prev MACD=${prevMacd?.toFixed(6)}, Prev Signal=${prevSignal?.toFixed(6)}`, 'DEBUG');
    }
    
    if (macd === null || signal === null || prevMacd === null || prevSignal === null) {
        return 'HOLD';
    }
    
    // Croisement haussier
    if (prevMacd <= prevSignal && macd > signal) {
        log(`🟢 Signal BUY détecté [${index}]: MACD=${macd.toFixed(6)} > Signal=${signal.toFixed(6)}`, 'SUCCESS');
        return 'BUY';
    }
    
    // Croisement baissier
    if (prevMacd >= prevSignal && macd < signal) {
        log(`🔴 Signal SELL détecté [${index}]: MACD=${macd.toFixed(6)} < Signal=${signal.toFixed(6)}`, 'SUCCESS');
        return 'SELL';
    }
    
    return 'HOLD';
}

// Signal RSI
function getRSISignal(indicators, index) {
    const rsi = indicators.rsi[index];
    const prevRsi = indicators.rsi[index - 1];
    
    if (rsi === null || prevRsi === null) {
        return 'HOLD';
    }
    
    // Sortie de survente
    if (prevRsi <= backtestConfig.rsiParams.oversold && rsi > backtestConfig.rsiParams.oversold) {
        return 'BUY';
    }
    
    // Sortie de surachat
    if (prevRsi >= backtestConfig.rsiParams.overbought && rsi < backtestConfig.rsiParams.overbought) {
        return 'SELL';
    }
    
    return 'HOLD';
}

// Signal EMA
function getEMASignal(indicators, index) {
    const emaFast = indicators.emaFast[index];
    const emaSlow = indicators.emaSlow[index];
    const prevEmaFast = indicators.emaFast[index - 1];
    const prevEmaSlow = indicators.emaSlow[index - 1];
    
    if (emaFast === null || emaSlow === null || prevEmaFast === null || prevEmaSlow === null) {
        return 'HOLD';
    }
    
    // Croisement haussier
    if (prevEmaFast <= prevEmaSlow && emaFast > emaSlow) {
        return 'BUY';
    }
    
    // Croisement baissier
    if (prevEmaFast >= prevEmaSlow && emaFast < emaSlow) {
        return 'SELL';
    }
    
    return 'HOLD';
}

// Signal Bollinger
function getBollingerSignal(indicators, index) {
    const price = backtestData[index].close;
    const upper = indicators.upper[index];
    const lower = indicators.lower[index];
    const prevPrice = backtestData[index - 1].close;
    const prevLower = indicators.lower[index - 1];
    const prevUpper = indicators.upper[index - 1];
    
    if (upper === null || lower === null || prevUpper === null || prevLower === null) {
        return 'HOLD';
    }
    
    // Rebond sur la bande inférieure
    if (prevPrice <= prevLower && price > lower) {
        return 'BUY';
    }
    
    // Rebond sur la bande supérieure
    if (prevPrice >= prevUpper && price < upper) {
        return 'SELL';
    }
    
    return 'HOLD';
}

// Ouvrir un trade
function openTrade(candle, direction) {
    const positionValue = backtestResults.currentCapital * (backtestConfig.positionSize / 100);
    const quantity = positionValue / candle.close;
    
    const trade = {
        id: Date.now(),
        symbol: document.getElementById('chartSymbol').value.split(':')[1],
        direction: direction,
        entryPrice: candle.close,
        entryTime: candle.timestamp,
        quantity: quantity,
        positionValue: positionValue,
        // Trailing Stop Loss
        trailingStopPrice: direction === 'LONG' ? 
            candle.close * (1 - backtestConfig.trailingStop / 100) : 
            candle.close * (1 + backtestConfig.trailingStop / 100),
        highestPrice: direction === 'LONG' ? candle.close : candle.close,
        lowestPrice: direction === 'SHORT' ? candle.close : candle.close,
        takeProfit: backtestConfig.enableTakeProfit ? (direction === 'LONG' ? 
            candle.close * (1 + backtestConfig.takeProfit / 100) : 
            candle.close * (1 - backtestConfig.takeProfit / 100)) : null
    };
    
    backtestResults.openTrades.push(trade);
    const takeProfitText = trade.takeProfit ? `, TP: ${backtestConfig.takeProfit}%` : ', TP: Désactivé';
    log(`📈 Ouverture trade ${direction}: ${trade.symbol} @ ${trade.entryPrice.toFixed(4)} (Trailing Stop: ${backtestConfig.trailingStop}%${takeProfitText})`, 'INFO');
    log(`🔍 Trade ouvert - Stop initial: ${trade.trailingStopPrice.toFixed(4)}`, 'DEBUG');
}

// Vérifier les trades ouverts avec trailing stop loss
async function checkOpenTrades(candle, candleIndex) {
    const tradesToRemove = [];
    
    // Log debug pour les premiers trades
    if (backtestResults.openTrades.length > 0 && candleIndex < 70) {
        log(`🔍 Vérification ${backtestResults.openTrades.length} trades ouverts à l'index ${candleIndex}`, 'DEBUG');
    }
    
    for (let i = 0; i < backtestResults.openTrades.length; i++) {
        const trade = backtestResults.openTrades[i];
        let shouldClose = false;
        let exitReason = '';
        let exitPrice = 0;
        let exitTime = candle.timestamp;
        
        if (trade.direction === 'LONG') {
            // Mettre à jour le prix le plus haut atteint
            if (candle.high > trade.highestPrice) {
                trade.highestPrice = candle.high;
                // Ajuster le trailing stop loss
                trade.trailingStopPrice = trade.highestPrice * (1 - backtestConfig.trailingStop / 100);
                
                // Log debug pour le premier trade
                if (candleIndex < 70) {
                    log(`🔍 LONG - Nouveau high: ${trade.highestPrice.toFixed(4)}, Stop ajusté: ${trade.trailingStopPrice.toFixed(4)}`, 'DEBUG');
                }
            }
            
            // Vérifier take profit en premier (si activé)
            if (trade.takeProfit !== null && candle.high >= trade.takeProfit) {
                shouldClose = true;
                exitReason = 'Take Profit';
                exitPrice = trade.takeProfit;
            }
            // Vérifier trailing stop loss
            else if (candle.low <= trade.trailingStopPrice) {
                shouldClose = true;
                exitReason = 'Trailing Stop Loss';
                exitPrice = trade.trailingStopPrice;
                
                if (candleIndex < 70) {
                    log(`🔍 LONG - Stop déclenché: Low=${candle.low.toFixed(4)} <= Stop=${trade.trailingStopPrice.toFixed(4)}`, 'DEBUG');
                }
            }
            
        } else { // SHORT
            // Mettre à jour le prix le plus bas atteint
            if (candle.low < trade.lowestPrice) {
                trade.lowestPrice = candle.low;
                // Ajuster le trailing stop loss
                trade.trailingStopPrice = trade.lowestPrice * (1 + backtestConfig.trailingStop / 100);
                
                // Log debug pour le premier trade
                if (candleIndex < 70) {
                    log(`🔍 SHORT - Nouveau low: ${trade.lowestPrice.toFixed(4)}, Stop ajusté: ${trade.trailingStopPrice.toFixed(4)}`, 'DEBUG');
                }
            }
            
            // Vérifier take profit en premier (si activé)
            if (trade.takeProfit !== null && candle.low <= trade.takeProfit) {
                shouldClose = true;
                exitReason = 'Take Profit';
                exitPrice = trade.takeProfit;
            }
            // Vérifier trailing stop loss
            else if (candle.high >= trade.trailingStopPrice) {
                shouldClose = true;
                exitReason = 'Trailing Stop Loss';
                exitPrice = trade.trailingStopPrice;
                
                if (candleIndex < 70) {
                    log(`🔍 SHORT - Stop déclenché: High=${candle.high.toFixed(4)} >= Stop=${trade.trailingStopPrice.toFixed(4)}`, 'DEBUG');
                }
            }
        }
        
        if (shouldClose) {
            trade.exitPrice = exitPrice;
            closeTrade(trade, exitTime, exitReason);
            tradesToRemove.push(i);
        }
    }
    
    // Retirer les trades fermés (en ordre inverse pour éviter les problèmes d'index)
    for (let i = tradesToRemove.length - 1; i >= 0; i--) {
        backtestResults.openTrades.splice(tradesToRemove[i], 1);
    }
}

// Fermer un trade
function closeTrade(trade, exitTime, exitReason) {
    trade.exitTime = exitTime;
    trade.exitReason = exitReason;
    
    // Calculer le profit/perte
    let pnl = 0;
    if (trade.direction === 'LONG') {
        pnl = (trade.exitPrice - trade.entryPrice) * trade.quantity;
    } else {
        pnl = (trade.entryPrice - trade.exitPrice) * trade.quantity;
    }
    
    trade.pnl = pnl;
    trade.pnlPercent = (pnl / trade.positionValue) * 100;
    
    // Mettre à jour le capital
    backtestResults.currentCapital += pnl;
    
    // Mettre à jour les statistiques
    backtestResults.stats.totalTrades++;
    if (pnl > 0) {
        backtestResults.stats.winningTrades++;
        backtestResults.stats.totalProfit += pnl;
    } else {
        backtestResults.stats.losingTrades++;
        backtestResults.stats.totalLoss += Math.abs(pnl);
    }
    
    // Ajouter à l'historique
    backtestResults.trades.push(trade);
    
    log(`📉 Fermeture trade ${trade.direction}: ${trade.symbol} @ ${trade.exitPrice.toFixed(4)} (${exitReason}) - PnL: ${pnl.toFixed(2)} USDT`, 
         pnl > 0 ? 'SUCCESS' : 'WARNING');
}

// Mettre à jour l'équité
function updateEquity(candle) {
    let currentEquity = backtestResults.currentCapital;
    
    // Ajouter la valeur des trades ouverts
    backtestResults.openTrades.forEach(trade => {
        let unrealizedPnl = 0;
        if (trade.direction === 'LONG') {
            unrealizedPnl = (candle.close - trade.entryPrice) * trade.quantity;
        } else {
            unrealizedPnl = (trade.entryPrice - candle.close) * trade.quantity;
        }
        currentEquity += unrealizedPnl;
    });
    
    backtestResults.equity.push(currentEquity);
    backtestResults.timestamps.push(candle.timestamp);
    
    // Mettre à jour le drawdown maximum
    if (currentEquity > backtestResults.stats.maxEquity) {
        backtestResults.stats.maxEquity = currentEquity;
    }
    
    const drawdown = ((backtestResults.stats.maxEquity - currentEquity) / backtestResults.stats.maxEquity) * 100;
    if (drawdown > backtestResults.stats.maxDrawdown) {
        backtestResults.stats.maxDrawdown = drawdown;
    }
}

// Calculer les statistiques finales
function calculateFinalStats() {
    const stats = backtestResults.stats;
    
    // Win rate
    stats.winRate = stats.totalTrades > 0 ? (stats.winningTrades / stats.totalTrades) * 100 : 0;
    
    // Profit total
    stats.totalPnl = backtestResults.currentCapital - backtestConfig.capital;
    stats.totalPnlPercent = (stats.totalPnl / backtestConfig.capital) * 100;
    
    // Sharpe ratio simplifié
    const returns = [];
    for (let i = 1; i < backtestResults.equity.length; i++) {
        const dailyReturn = (backtestResults.equity[i] - backtestResults.equity[i-1]) / backtestResults.equity[i-1];
        returns.push(dailyReturn);
    }
    
    if (returns.length > 0) {
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);
        stats.sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
    } else {
        stats.sharpeRatio = 0;
    }
    
    // Durée moyenne des trades
    if (backtestResults.trades.length > 0) {
        const totalDuration = backtestResults.trades.reduce((sum, trade) => {
            return sum + (trade.exitTime - trade.entryTime);
        }, 0);
        stats.avgDuration = totalDuration / backtestResults.trades.length;
    } else {
        stats.avgDuration = 0;
    }
}

// Afficher les résultats du backtesting
function displayBacktestResults() {
    const stats = backtestResults.stats;
    
    // Afficher la section des résultats
    document.getElementById('backtestResults').style.display = 'block';
    
    // Mettre à jour les statistiques
    document.getElementById('backtestProfit').textContent = `${stats.totalPnlPercent >= 0 ? '+' : ''}${stats.totalPnlPercent.toFixed(2)}%`;
    document.getElementById('backtestProfit').className = `stat-value ${stats.totalPnlPercent >= 0 ? '' : 'negative'}`;
    
    document.getElementById('backtestTrades').textContent = stats.totalTrades;
    document.getElementById('backtestWinRate').textContent = `${stats.winRate.toFixed(1)}%`;
    document.getElementById('backtestSharpe').textContent = stats.sharpeRatio.toFixed(2);
    document.getElementById('backtestDrawdown').textContent = `${stats.maxDrawdown.toFixed(2)}%`;
    
    // Durée moyenne en heures
    const avgDurationHours = stats.avgDuration / (1000 * 60 * 60);
    document.getElementById('backtestAvgDuration').textContent = `${avgDurationHours.toFixed(1)}h`;
    
    // Afficher l'historique des trades
    displayTradeHistory();
    
    // Afficher le bouton d'export
    document.getElementById('exportBacktestBtn').style.display = 'block';
}

// Afficher l'historique des trades
function displayTradeHistory() {
    const historyDiv = document.getElementById('backtestTradeHistory');
    
    if (backtestResults.trades.length === 0) {
        historyDiv.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Aucun trade effectué</div>';
        return;
    }
    
    let html = '';
    backtestResults.trades.forEach(trade => {
        const isProfit = trade.pnl > 0;
        const duration = (trade.exitTime - trade.entryTime) / (1000 * 60 * 60); // en heures
        
        html += `
            <div class="trade-item ${isProfit ? 'profit' : 'loss'}">
                <div class="trade-info">
                    <div class="trade-symbol">${trade.symbol} ${trade.direction}</div>
                    <div class="trade-details">
                        Entrée: ${trade.entryPrice.toFixed(4)} → Sortie: ${trade.exitPrice.toFixed(4)} 
                        (${trade.exitReason}) - ${duration.toFixed(1)}h
                    </div>
                </div>
                <div class="trade-result ${isProfit ? 'profit' : 'loss'}">
                    ${isProfit ? '+' : ''}${trade.pnl.toFixed(2)} USDT
                    <br><small>(${trade.pnlPercent >= 0 ? '+' : ''}${trade.pnlPercent.toFixed(2)}%)</small>
                </div>
            </div>
        `;
    });
    
    historyDiv.innerHTML = html;
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
            strategy: backtestConfig.strategy,
            timeframe: backtestConfig.timeframe,
            duration: backtestConfig.duration,
            totalTrades: backtestResults.stats.totalTrades,
            winRate: backtestResults.stats.winRate,
            totalPnl: backtestResults.stats.totalPnl,
            totalPnlPercent: backtestResults.stats.totalPnlPercent,
            sharpeRatio: backtestResults.stats.sharpeRatio,
            maxDrawdown: backtestResults.stats.maxDrawdown
        }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backtesting_${data.summary.symbol}_${data.summary.strategy}_${Date.now()}.json`;
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
    document.getElementById('backtestStatusText').textContent = message;
    document.getElementById('backtestProgress').style.width = `${progress}%`;
    document.getElementById('backtestProgressText').textContent = `${progress}% terminé`;
}

// Fonction pour changer le timeframe du graphique
function updateChartTimeframe() {
    const timeframe = document.getElementById('chartTimeframe').value;
    
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

// Rendre les fonctions accessibles globalement
window.startBacktest = startBacktest;
window.stopBacktest = stopBacktest;
window.exportBacktestResults = exportBacktestResults;
window.updateChartTimeframe = updateChartTimeframe;
window.updateSelectedPair = updateSelectedPair;
window.toggleTakeProfit = toggleTakeProfit;

console.log('✅ Backtesting system loaded successfully');
