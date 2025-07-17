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
    if (num === null || num === undefined || isNaN(num)) return '0.00';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}

function updateStats() {
    const MAX_SIMULTANEOUS_POSITIONS = 10; // Même valeur que dans trading.js
    const availableSlots = MAX_SIMULTANEOUS_POSITIONS - openPositions.length;
    
    document.getElementById('totalSignals').textContent = botStats.totalSignals;
    document.getElementById('totalOpenPositions').textContent = `${openPositions.length}/${MAX_SIMULTANEOUS_POSITIONS}`;
    document.getElementById('totalClosedPositions').textContent = botStats.totalClosedPositions;
    document.getElementById('winningPositions').textContent = `${botStats.winningPositions} (+${botStats.totalWinAmount.toFixed(0)}$)`;
    document.getElementById('losingPositions').textContent = `${botStats.losingPositions} (-${Math.abs(botStats.totalLossAmount).toFixed(0)}$)`;
    
    // 🎯 NOUVEAU: Log informatif sur les positions disponibles (seulement quand le bot tourne)
    if (typeof botRunning !== 'undefined' && botRunning && availableSlots > 0) {
        // Log seulement toutes les 5 minutes pour éviter le spam
        if (!window.lastPositionInfoLog || Date.now() - window.lastPositionInfoLog > 300000) {
            log(`📊 Positions disponibles: ${availableSlots}/${MAX_SIMULTANEOUS_POSITIONS} slots libres`, 'INFO');
            window.lastPositionInfoLog = Date.now();
        }
    }
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

// 🎯 NOUVELLE FONCTION: Afficher un résumé des positions disponibles
function showPositionSummary() {
    const MAX_SIMULTANEOUS_POSITIONS = 10;
    const currentPositions = openPositions.length;
    const availableSlots = MAX_SIMULTANEOUS_POSITIONS - currentPositions;
    
    console.log('📊 ========== RÉSUMÉ DES POSITIONS ==========');
    console.log(`🔢 Positions ouvertes: ${currentPositions}/${MAX_SIMULTANEOUS_POSITIONS}`);
    console.log(`✅ Slots disponibles: ${availableSlots}`);
    console.log(`⚠️ Limite atteinte: ${availableSlots === 0 ? 'OUI' : 'NON'}`);
    
    if (currentPositions > 0) {
        console.log('\n📋 Positions ouvertes:');
        openPositions.forEach((position, index) => {
            const pnl = position.unrealizedPnL || 0;
            const pnlSign = pnl >= 0 ? '+' : '';
            const duration = Math.floor((Date.now() - new Date(position.timestamp).getTime()) / 60000);
            
            console.log(`  ${index + 1}. ${position.symbol} - ${pnlSign}${pnl.toFixed(2)}$ - ${duration}min`);
        });
    }
    
    if (availableSlots > 0) {
        console.log(`\n🚀 Le bot peut ouvrir ${availableSlots} nouvelle(s) position(s)`);
    } else {
        console.log('\n🛑 Limite atteinte - Le bot attend qu\'une position se ferme');
    }
    
    console.log('==========================================');
    
    return {
        total: MAX_SIMULTANEOUS_POSITIONS,
        current: currentPositions,
        available: availableSlots,
        limitReached: availableSlots === 0
    };
}

// Fonction: Paramètres MACD adaptés par timeframe
function getMACDParameters(timeframe) {
    const parameters = {
        // {{ edit_2_FIXED }}: Corriger minCandles pour 4h - 50 bougies 15m = seulement 12 bougies 4h (insuffisant!)
        // Pour 4h: minRequired=45, donc besoin de 45*4=180 bougies 15m minimum pour l'agrégation
        '4h': { fast: 12, slow: 26, signal: 9, minCandles: 200 },  // Restauré à 200 pour avoir assez de données
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
    
    if (currentMacd == null || currentSignal == null) {
        return { macd: currentMacd, signal: currentSignal, histogram: null, crossover: false };
    }
    
    const currentHistogram = currentMacd - currentSignal;
    const previousHistogram = (previousMacd !== null && previousSignal !== null) ? previousMacd - previousSignal : null;
    const previousHistogram2 = (previousMacd2 !== null && previousSignal2 !== null) ? previousMacd2 - previousSignal2 : null;
    
    let strictCrossover = false;
    
    if (previousMacd != null && previousSignal != null) {
        const wasBelow = previousMacd <= previousSignal;
        const nowAbove = currentMacd > currentSignal;
        const histogramImproving = previousHistogram != null && currentHistogram > previousHistogram;
        
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
    
    if (macdData.previousMacd != null) {
        console.log(`   Previous MACD: ${macdData.previousMacd?.toFixed(6) || 'null'}`);
        console.log(`   Previous Signal: ${macdData.previousSignal?.toFixed(6) || 'null'}`);
        console.log(`   Previous Histogram: ${macdData.previousHistogram?.toFixed(6) || 'null'}`);
    }
}

async function analyzePairMACD(symbol, timeframe = '15m') {
    try {
        // 🎯 Récupérer les paramètres MACD spécifiques au timeframe
        const macdParams = getMACDParameters(timeframe);
        
        // 🔄 Récupérer plus de bougies selon les paramètres MACD (avec agrégation automatique pour 4h)
        let klines = await getKlineDataWithAggregation(symbol, macdParams.minCandles, timeframe);
        
        const minRequired = macdParams.slow + macdParams.signal + 10;
        
        // {{ edit_3 }}: Si données insuffisantes, tenter un fallback avec plus de données ou agrégation (inspiré de la mémoire)
        if (klines.length < minRequired && timeframe === '4h') {
            log(`⚠️ Données 4h insuffisantes pour ${symbol} (${klines.length}/${minRequired}) - Tentative de récupération étendue`, 'WARNING');
            klines = await getExtendedHistoricalDataForTrading(symbol, '4h', 60);  // Fonction de trading.js pour données étendues
            if (klines.length < minRequired) {
                // Fallback final : Agrégation depuis 15m
                klines = await aggregateDataFromLowerTimeframe(symbol, '15m', '4h');
                if (klines.length < minRequired) {
                    return { symbol, signal: 'HOLD', strength: 0, reason: `Données insuffisantes même après fallback: ${klines.length}/${minRequired}`, timeframe };
                }
            }
            log(`✅ Fallback réussi pour ${symbol} 4h: ${klines.length} bougies disponibles`, 'SUCCESS');
        } else if (klines.length < minRequired) {
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
        let reason = `⏳ Calcul MACD en cours... Données insuffisantes pour ${symbol} (${timeframe}) (candles: ${klines.length})`; // Valeur par défaut
        
        if (macdData.macd == null || macdData.signal == null || macdData.histogram == null) {
            reason = `⏳ Calcul MACD en cours... Données insuffisantes pour ${symbol} (${timeframe}) (candles: ${klines.length})`;
        } else {
            // 🚨 NOUVELLE LOGIQUE CORRIGÉE : Analyse de tendance plus stricte
            const currentHistogram = macdData.histogram;
            const previousHistogram = macdData.previousHistogram;
            const previousHistogram2 = macdData.previousHistogram2;
            
            // Vérifier la tendance de l'histogramme sur 3 périodes
            let histogramTrend = 'NEUTRAL';
            if (previousHistogram != null && previousHistogram2 != null) {
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
        
        // 🔧 SÉCURITÉ: S'assurer que reason n'est jamais vide
        if (!reason || reason.trim() === '') {
            reason = `📊 MACD ${timeframe} analysé - Signal: ${macdSignal}, MACD: ${macdData.macd?.toFixed(6) || 'N/A'}, Signal: ${macdData.signal?.toFixed(6) || 'N/A'}, Histogram: ${macdData.histogram?.toFixed(6) || 'N/A'}`;
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

// 🎯 NOUVELLE FONCTION: Forcer le relancement de l'analyse si des positions sont disponibles
function forceAnalysisIfAvailable() {
    const MAX_SIMULTANEOUS_POSITIONS = 10;
    const availableSlots = MAX_SIMULTANEOUS_POSITIONS - openPositions.length;
    
    if (!botRunning) {
        console.log('❌ Le bot n\'est pas en cours d\'exécution');
        return false;
    }
    
    if (availableSlots <= 0) {
        console.log('⚠️ Aucun slot disponible - Limite de positions atteinte');
        return false;
    }
    
    console.log(`🚀 Forçage de l'analyse - ${availableSlots} slots disponibles`);
    
    // Relancer l'analyse
    setTimeout(() => {
        if (typeof tradingLoop === 'function') {
            tradingLoop();
        } else {
            console.log('❌ Fonction tradingLoop non disponible');
        }
    }, 1000);
    
    return true;
}

// 🆕 FONCTION AMÉLIORÉE: Récupérer des données 4h avec agrégation automatique si nécessaire
async function getKlineDataWithAggregation(symbol, limit, timeframe) {
    try {
        // Pour les timeframes autres que 4h, utiliser la fonction standard
        if (timeframe !== '4h') {
            return await getKlineData(symbol, limit, timeframe);
        }
        
        // Pour 4h: d'abord essayer de récupérer directement
        let klines = await getKlineData(symbol, limit, timeframe);
        
        // Si on n'a pas assez de données 4h, essayer l'agrégation depuis 15m
        if (klines.length < limit * 0.8) { // Si on a moins de 80% des données demandées
            console.log(`⚠️ Données 4h insuffisantes pour ${symbol} (${klines.length}/${limit}) - Tentative d'agrégation depuis 15m`);
            
            // Calculer combien de bougies 15m on a besoin pour obtenir 'limit' bougies 4h
            const needed15mCandles = limit * 4 * 1.2; // 20% de marge
            const data15m = await getKlineData(symbol, Math.min(needed15mCandles, 1000), '15m');
            
            if (data15m.length >= limit * 4) {
                // Agréger les données 15m en 4h
                const aggregated4h = [];
                for (let i = 0; i < data15m.length; i += 4) {
                    const chunk = data15m.slice(i, i + 4);
                    if (chunk.length === 4) {
                        const aggregatedCandle = {
                            timestamp: chunk[0].timestamp,
                            open: chunk[0].open,
                            high: Math.max(...chunk.map(c => c.high)),
                            low: Math.min(...chunk.map(c => c.low)),
                            close: chunk[chunk.length - 1].close,
                            volume: chunk.reduce((sum, c) => sum + c.volume, 0)
                        };
                        aggregated4h.push(aggregatedCandle);
                    }
                }
                
                console.log(`✅ Agrégation réussie pour ${symbol}: ${data15m.length} bougies 15m → ${aggregated4h.length} bougies 4h`);
                return aggregated4h.slice(-limit); // Retourner les 'limit' dernières bougies
            }
        }
        
        return klines;
        
    } catch (error) {
        console.error(`❌ Erreur récupération données avec agrégation ${symbol} ${timeframe}:`, error);
        // Fallback vers la fonction standard
        return await getKlineData(symbol, limit, timeframe);
    }
}

// Exported for use in backtesting and main
window.analyzePairMACD = analyzePairMACD;
window.calculateMACD = calculateMACD;
window.getMACDParameters = getMACDParameters;
window.showPositionSummary = showPositionSummary;
window.forceAnalysisIfAvailable = forceAnalysisIfAvailable; 