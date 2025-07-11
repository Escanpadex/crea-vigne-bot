// Utility functions
console.log('📁 Loading utils.js...');

function log(message, type = 'INFO') {
    const logs = document.getElementById('logs');
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] [${type}] ${message}<br>`;
    
    // Ajouter le nouveau log
    logs.innerHTML += logMessage;
    
    // Limiter à 100 logs maximum
    const logLines = logs.innerHTML.split('<br>').filter(line => line.trim() !== '');
    if (logLines.length > 100) {
        // Garder seulement les 100 derniers logs
        const recentLogs = logLines.slice(-100);
        logs.innerHTML = recentLogs.join('<br>') + '<br>';
    }
    
    logs.scrollTop = logs.scrollHeight;
}

function clearLogs() {
    document.getElementById('logs').innerHTML = '';
}

function formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}

function updateStats() {
    document.getElementById('totalSignals').textContent = botStats.totalSignals;
    document.getElementById('totalOpenPositions').textContent = openPositions.length;
    document.getElementById('totalClosedPositions').textContent = botStats.totalClosedPositions;
    document.getElementById('winningPositions').textContent = `${botStats.winningPositions} (+${botStats.totalWinAmount.toFixed(0)}$)`;
    document.getElementById('losingPositions').textContent = `${botStats.losingPositions} (-${Math.abs(botStats.totalLossAmount).toFixed(0)}$)`;
}

// NEW: Update version timestamp
function updateVersionTimestamp() {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    const timestamp = `${day}/${month}/${year} ${hours}:${minutes}`;
    
    const versionElement = document.querySelector('.version');
    if (versionElement) {
        versionElement.textContent = `🕐 Dernière MAJ: ${timestamp}`;
    }
}

function saveKeys() {
    const keys = {
        apiKey: document.getElementById('apiKey').value,
        secretKey: document.getElementById('secretKey').value,
        passphrase: document.getElementById('passphrase').value
    };
    
    if (keys.apiKey && keys.secretKey && keys.passphrase) {
        config.apiKey = keys.apiKey;
        config.secretKey = keys.secretKey;
        config.passphrase = keys.passphrase;
        
        log('🔑 Clés API sauvegardées avec succès', 'SUCCESS');
        
        // Test de connexion automatique
        testConnection();
    } else {
        alert('Veuillez remplir tous les champs API');
    }
} 

// 🎯 Shared MACD Utility Functions (extracted for consistency between backtesting and trading)

// Fonction: Paramètres MACD adaptés par timeframe
function getMACDParameters(timeframe) {
    const parameters = {
        '4h': { fast: 12, slow: 26, signal: 9, minCandles: 200 },
        '1h': { fast: 30, slow: 50, signal: 20, minCandles: 300 },
        '15m': { fast: 30, slow: 50, signal: 40, minCandles: 350 }
    };
    
    const params = parameters[timeframe] || parameters['4h'];
    console.log(`📊 MACD ${timeframe}: Fast=${params.fast}, Slow=${params.slow}, Signal=${params.signal}, MinCandles=${params.minCandles}`);
    return params;
}

function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const minRequired = slowPeriod + signalPeriod + 10;
    if (prices.length < minRequired) {
        console.warn(`⚠️ MACD: Données insuffisantes - Reçu: ${prices.length}, Requis: ${minRequired} (${fastPeriod},${slowPeriod},${signalPeriod})`);
        return { macd: null, signal: null, histogram: null, crossover: false };
    }
    
    function calculateEMA(data, period) {
        const k = 2 / (period + 1);
        const emaArray = new Array(data.length).fill(null);
        
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += data[i];
        }
        emaArray[period - 1] = sum / period;
        
        for (let i = period; i < data.length; i++) {
            emaArray[i] = data[i] * k + emaArray[i - 1] * (1 - k);
        }
        
        return emaArray;
    }
    
    const emaFastArray = calculateEMA(prices, fastPeriod);
    const emaSlowArray = calculateEMA(prices, slowPeriod);
    
    const macdArray = prices.map((price, idx) => {
        const emaFast = emaFastArray[idx];
        const emaSlow = emaSlowArray[idx];
        if (emaFast === null || emaSlow === null) return null;
        return emaFast - emaSlow;
    });
    
    const validMacdValues = [];
    let macdStartIndex = -1;
    
    for (let i = 0; i < macdArray.length; i++) {
        if (macdArray[i] !== null) {
            if (macdStartIndex === -1) macdStartIndex = i;
            validMacdValues.push(macdArray[i]);
        }
    }
    
    let signalArray = new Array(prices.length).fill(null);
    
    if (validMacdValues.length >= signalPeriod) {
        const signalEMA = calculateEMA(validMacdValues, signalPeriod);
        
        for (let i = 0; i < signalEMA.length; i++) {
            if (signalEMA[i] !== null && macdStartIndex + i < prices.length) {
                signalArray[macdStartIndex + i] = signalEMA[i];
            }
        }
    }
    
    let currentMacd = null, previousMacd = null, previousMacd2 = null;
    let currentSignal = null, previousSignal = null, previousSignal2 = null;
    
    for (let i = macdArray.length - 1; i >= 0 && previousMacd2 === null; i--) {
        if (macdArray[i] !== null) {
            if (currentMacd === null) {
                currentMacd = macdArray[i];
            } else if (previousMacd === null) {
                previousMacd = macdArray[i];
            } else {
                previousMacd2 = macdArray[i];
            }
        }
    }
    
    for (let i = signalArray.length - 1; i >= 0 && previousSignal2 === null; i--) {
        if (signalArray[i] !== null) {
            if (currentSignal === null) {
                currentSignal = signalArray[i];
            } else if (previousSignal === null) {
                previousSignal = signalArray[i];
            } else {
                previousSignal2 = signalArray[i];
            }
        }
    }
    
    if (currentMacd === null || currentSignal === null) {
        return { macd: currentMacd, signal: currentSignal, histogram: null, crossover: false };
    }
    
    const currentHistogram = currentMacd - currentSignal;
    const previousHistogram = (previousMacd !== null && previousSignal !== null) ? previousMacd - previousSignal : null;
    const previousHistogram2 = (previousMacd2 !== null && previousSignal2 !== null) ? previousMacd2 - previousSignal2 : null;
    
    let strictCrossover = false;
    
    if (previousMacd !== null && previousSignal !== null) {
        const wasBelow = previousMacd <= previousSignal;
        const nowAbove = currentMacd > currentSignal;
        const histogramImproving = previousHistogram !== null && currentHistogram > previousHistogram;
        
        strictCrossover = wasBelow && nowAbove && histogramImproving;
    }
    
    return {
        macd: currentMacd,
        signal: currentSignal,
        histogram: currentHistogram,
        crossover: strictCrossover,
        macdArray: macdArray,
        signalArray: signalArray,
        previousMacd: previousMacd,
        previousMacd2: previousMacd2,
        previousSignal: previousSignal,
        previousSignal2: previousSignal2,
        previousHistogram: previousHistogram,
        previousHistogram2: previousHistogram2
    };
}

// Fonction de diagnostic MACD
function debugMACDAnalysis(symbol, macdData, signal, timeframe) {
    if (window.macdDebugCount > 10) return; // Limiter les logs de debug
    
    if (!window.macdDebugCount) window.macdDebugCount = 0;
    window.macdDebugCount++;
    
    console.log(`🔍 DEBUG MACD ${symbol} (${timeframe}):`);
    console.log(`   MACD: ${macdData.macd?.toFixed(6) || 'null'}`);
    console.log(`   Signal: ${macdData.signal?.toFixed(6) || 'null'}`);
    console.log(`   Histogram: ${macdData.histogram?.toFixed(6) || 'null'}`);
    console.log(`   Crossover: ${macdData.crossover}`);
    console.log(`   Signal déterminé: ${signal}`);
    console.log(`   MACD > Signal: ${macdData.macd > macdData.signal}`);
    
    if (macdData.previousMacd !== null) {
        console.log(`   Previous MACD: ${macdData.previousMacd.toFixed(6)}`);
        console.log(`   Previous Signal: ${macdData.previousSignal?.toFixed(6) || 'null'}`);
        console.log(`   Previous Histogram: ${macdData.previousHistogram?.toFixed(6) || 'null'}`);
    }
}

async function analyzePairMACD(symbol, timeframe = '15m') {
    try {
        // 🎯 Récupérer les paramètres MACD spécifiques au timeframe
        const macdParams = getMACDParameters(timeframe);
        
        // 🔄 Récupérer plus de bougies selon les paramètres MACD
        const klines = await getKlineData(symbol, macdParams.minCandles, timeframe);
        
        // Vérifier si on a assez de données pour l'analyse MACD
        const minRequired = macdParams.slow + macdParams.signal + 10;
        if (klines.length < minRequired) {
            return { 
                symbol, 
                signal: 'HOLD', 
                strength: 0, 
                reason: `Données insuffisantes: ${klines.length}/${minRequired} bougies (MACD ${macdParams.fast},${macdParams.slow},${macdParams.signal})`, 
                timeframe 
            };
        }
        
        const closePrices = klines.map(k => k.close);
        const currentPrice = closePrices[closePrices.length - 1];
        const volume24h = klines.slice(-288).reduce((sum, k) => sum + k.volume, 0);
        
        // 🎯 Calculer MACD avec les paramètres spécifiques au timeframe
        const macdData = calculateMACD(closePrices, macdParams.fast, macdParams.slow, macdParams.signal);
        
        let macdSignal = 'HOLD';
        let signalStrength = 0;
        let reason = '';
        
        if (macdData.macd === null || macdData.signal === null) {
            reason = `⏳ Calcul MACD en cours... Données insuffisantes pour ${symbol} (${timeframe})`;
        } else {
            // 🚨 NOUVELLE LOGIQUE CORRIGÉE : Analyse de tendance plus stricte
            const currentHistogram = macdData.histogram;
            const previousHistogram = macdData.previousHistogram;
            const previousHistogram2 = macdData.previousHistogram2;
            
            // Vérifier la tendance de l'histogramme sur 3 périodes
            let histogramTrend = 'NEUTRAL';
            if (previousHistogram !== null && previousHistogram2 !== null) {
                const trend1 = currentHistogram > previousHistogram;
                const trend2 = previousHistogram > previousHistogram2;
                
                if (trend1 && trend2) {
                    histogramTrend = 'IMPROVING'; // Histogramme s'améliore sur 2 périodes
                } else if (!trend1 && !trend2) {
                    histogramTrend = 'DETERIORATING'; // Histogramme se détériore sur 2 périodes
                }
            }
            
            // 🎯 LOGIQUE STRICTE : Croisement récent ET momentum positif
            if (macdData.crossover && currentHistogram > 0 && histogramTrend === 'IMPROVING') {
                macdSignal = 'BUY';
                signalStrength = Math.abs(currentHistogram) * 1000;
                reason = `🔥 CROISEMENT HAUSSIER FORT ${timeframe}! MACD: ${macdData.macd.toFixed(6)} > Signal: ${macdData.signal.toFixed(6)}, Histogram: ${currentHistogram.toFixed(6)}, Tendance: ${histogramTrend}`;
            }
            // 🎯 LOGIQUE STRICTE : MACD au-dessus ET histogram positif ET tendance améliorante
            else if (macdData.macd > macdData.signal && currentHistogram > 0 && histogramTrend === 'IMPROVING') {
                macdSignal = 'BULLISH';
                signalStrength = Math.abs(currentHistogram) * 500;
                reason = `📈 MACD ${timeframe} HAUSSIER CONFIRMÉ - MACD: ${macdData.macd.toFixed(6)}, Signal: ${macdData.signal.toFixed(6)}, Histogram: ${currentHistogram.toFixed(6)}, Tendance: ${histogramTrend}`;
            }
            // 🎯 LOGIQUE STRICTE : Conditions haussières mais momentum faible
            else if (macdData.macd > macdData.signal && currentHistogram > 0) {
                macdSignal = 'WEAK_BULLISH';
                signalStrength = Math.abs(currentHistogram) * 100;
                reason = `📊 MACD ${timeframe} faiblement haussier - MACD: ${macdData.macd.toFixed(6)}, Signal: ${macdData.signal.toFixed(6)}, Histogram: ${currentHistogram.toFixed(6)}, Tendance: ${histogramTrend}`;
            }
            // 🚨 CLARIFICATION : Vraiment baissier
            else {
                macdSignal = 'BEARISH';
                signalStrength = 0;
                reason = `📉 MACD ${timeframe} BAISSIER - MACD: ${macdData.macd.toFixed(6)}, Signal: ${macdData.signal.toFixed(6)}, Histogram: ${currentHistogram.toFixed(6)}, Tendance: ${histogramTrend}`;
            }
        }
        
        // 🔧 Debug pour les premières analyses
        if (timeframe === '4h' && window.macdDebugCount < 5) {
            debugMACDAnalysis(symbol, macdData, macdSignal, timeframe);
        }
        
        return {
            symbol,
            timeframe,
            signal: macdSignal,
            strength: signalStrength,
            price: currentPrice,
            volume24h: volume24h,
            macd: macdData.macd,
            macdSignal: macdData.signal,
            histogram: macdData.histogram,
            crossover: macdData.crossover,
            reason: reason,
            debugData: {
                previousMacd: macdData.previousMacd,
                previousMacd2: macdData.previousMacd2,
                previousSignal: macdData.previousSignal,
                previousSignal2: macdData.previousSignal2,
                previousHistogram: macdData.previousHistogram,
                previousHistogram2: macdData.previousHistogram2
            }
        };
        
    } catch (error) {
        log(`❌ ERREUR ANALYSE ${symbol} (${timeframe}): ${error.message}`, 'ERROR');
        console.error(`Erreur analyse MACD ${symbol} (${timeframe}):`, error);
        return { symbol, timeframe, signal: 'HOLD', strength: 0, reason: `Erreur: ${error.message}` };
    }
}

// Exported for use in backtesting and main
window.analyzePairMACD = analyzePairMACD;
window.calculateMACD = calculateMACD;
window.getMACDParameters = getMACDParameters; 