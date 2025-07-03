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
    capital: 1000,
    positionSize: 10, // pourcentage
    stopLoss: 2, // pourcentage
    takeProfit: 4, // pourcentage
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
        capital: parseFloat(document.getElementById('backtestCapital').value),
        positionSize: parseFloat(document.getElementById('backtestPositionSize').value),
        stopLoss: parseFloat(document.getElementById('backtestStopLoss').value),
        takeProfit: parseFloat(document.getElementById('backtestTakeProfit').value),
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
    if (backtestConfig.capital < 100) {
        alert('Le capital initial doit être d\'au moins 100 USDT');
        return false;
    }
    
    if (backtestConfig.positionSize < 1 || backtestConfig.positionSize > 100) {
        alert('La taille de position doit être entre 1% et 100%');
        return false;
    }
    
    if (backtestConfig.stopLoss < 0.1 || backtestConfig.stopLoss > 10) {
        alert('Le stop loss doit être entre 0.1% et 10%');
        return false;
    }
    
    if (backtestConfig.takeProfit < 0.1 || backtestConfig.takeProfit > 20) {
        alert('Le take profit doit être entre 0.1% et 20%');
        return false;
    }
    
    return true;
}

// Récupérer les données historiques
async function fetchBacktestData(symbol) {
    try {
        updateBacktestStatus('Récupération des données historiques...', 10);
        
        // Calculer le nombre de bougies nécessaires
        const timeframeMinutes = getTimeframeMinutes(backtestConfig.timeframe);
        const totalMinutes = backtestConfig.duration * 24 * 60;
        const candlesNeeded = Math.ceil(totalMinutes / timeframeMinutes) + 100; // +100 pour les indicateurs
        
        // Limiter à 1000 bougies maximum (limite API)
        const limit = Math.min(candlesNeeded, 1000);
        
        log(`📊 Récupération de ${limit} bougies ${backtestConfig.timeframe} pour ${symbol}`, 'INFO');
        
        // Utiliser la fonction existante getKlineData
        backtestData = await getKlineData(symbol, limit, backtestConfig.timeframe);
        
        if (backtestData.length === 0) {
            throw new Error('Aucune donnée historique récupérée');
        }
        
        log(`✅ ${backtestData.length} bougies récupérées pour le backtesting`, 'SUCCESS');
        updateBacktestStatus('Données récupérées avec succès', 25);
        
    } catch (error) {
        throw new Error(`Erreur récupération données: ${error.message}`);
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

// Calculer les indicateurs MACD
function calculateMACDIndicators() {
    const closes = backtestData.map(candle => candle.close);
    const macdData = calculateMACD(closes, backtestConfig.macdParams.fast, backtestConfig.macdParams.slow, backtestConfig.macdParams.signal);
    
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
    
    for (let i = 50; i < totalCandles; i++) { // Commencer à 50 pour avoir assez de données pour les indicateurs
        const candle = backtestData[i];
        
        // Mettre à jour le progrès
        if (i % 10 === 0) {
            progress = 30 + ((i / totalCandles) * 60);
            updateBacktestStatus(`Analyse bougie ${i}/${totalCandles}`, progress);
        }
        
        // Vérifier les signaux d'entrée
        const signal = getEntrySignal(indicators, i);
        
        if (signal === 'BUY' && backtestResults.openTrades.length === 0) {
            openTrade(candle, 'LONG');
        } else if (signal === 'SELL' && backtestResults.openTrades.length === 0) {
            openTrade(candle, 'SHORT');
        }
        
        // Vérifier les trades ouverts
        checkOpenTrades(candle);
        
        // Mettre à jour l'équité
        updateEquity(candle);
        
        // Petit délai pour éviter de bloquer l'interface
        if (i % 50 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1));
        }
    }
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
    
    if (macd === null || signal === null || prevMacd === null || prevSignal === null) {
        return 'HOLD';
    }
    
    // Croisement haussier
    if (prevMacd <= prevSignal && macd > signal) {
        return 'BUY';
    }
    
    // Croisement baissier
    if (prevMacd >= prevSignal && macd < signal) {
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
        stopLoss: direction === 'LONG' ? 
            candle.close * (1 - backtestConfig.stopLoss / 100) : 
            candle.close * (1 + backtestConfig.stopLoss / 100),
        takeProfit: direction === 'LONG' ? 
            candle.close * (1 + backtestConfig.takeProfit / 100) : 
            candle.close * (1 - backtestConfig.takeProfit / 100)
    };
    
    backtestResults.openTrades.push(trade);
    log(`📈 Ouverture trade ${direction}: ${trade.symbol} @ ${trade.entryPrice.toFixed(4)}`, 'INFO');
}

// Vérifier les trades ouverts
function checkOpenTrades(candle) {
    backtestResults.openTrades = backtestResults.openTrades.filter(trade => {
        let shouldClose = false;
        let exitReason = '';
        
        if (trade.direction === 'LONG') {
            if (candle.low <= trade.stopLoss) {
                shouldClose = true;
                exitReason = 'Stop Loss';
                trade.exitPrice = trade.stopLoss;
            } else if (candle.high >= trade.takeProfit) {
                shouldClose = true;
                exitReason = 'Take Profit';
                trade.exitPrice = trade.takeProfit;
            }
        } else { // SHORT
            if (candle.high >= trade.stopLoss) {
                shouldClose = true;
                exitReason = 'Stop Loss';
                trade.exitPrice = trade.stopLoss;
            } else if (candle.low <= trade.takeProfit) {
                shouldClose = true;
                exitReason = 'Take Profit';
                trade.exitPrice = trade.takeProfit;
            }
        }
        
        if (shouldClose) {
            closeTrade(trade, candle.timestamp, exitReason);
            return false; // Retirer le trade de la liste
        }
        
        return true; // Garder le trade ouvert
    });
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

// Rendre les fonctions accessibles globalement
window.startBacktest = startBacktest;
window.stopBacktest = stopBacktest;
window.exportBacktestResults = exportBacktestResults;
window.updateChartTimeframe = updateChartTimeframe;

console.log('✅ Backtesting system loaded successfully');
