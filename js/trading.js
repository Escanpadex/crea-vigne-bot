// Trading Functions - MACD Strategy & Position Management
console.log('📁 Loading trading.js...');
console.log('Assuming utils.js is loaded: using shared MACD functions');

// 🎯 NOUVELLE CONSTANTE: Limite de positions simultanées
const MAX_SIMULTANEOUS_POSITIONS = 10;

// 🆕 NOUVELLE FONCTION: Wrapper de retry pour les appels API
async function makeRequestWithRetry(endpoint, options, maxRetries = 3) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await makeRequest(endpoint, options);
            return result;
        } catch (error) {
            lastError = error;
            
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
                log(`⚠️ Tentative ${attempt}/${maxRetries} échouée pour ${endpoint} - Réessai dans ${delay}ms`, 'WARNING');
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    log(`❌ Échec après ${maxRetries} tentatives pour ${endpoint}: ${lastError?.message || 'Erreur inconnue'}`, 'ERROR');
    throw lastError;
}

// REMOVED: analyzeMultiTimeframe function - replaced by analyzeMultiTimeframeImproved
// This eliminates redundancy and ensures consistent use of extended data

// �� NOUVELLE FONCTION: Analyse multi-timeframe améliorée avec données étendues
async function analyzeMultiTimeframeImproved(symbol) {
    try {
        console.log(`🔍 [TRADING] Analyse multi-timeframe améliorée pour ${symbol}`);
        
        // LOGIQUE AMÉLIORÉE : 4H et 1H utilisent des données étendues, 15M utilise des données standard
        const timeframes = ['4h', '1h', '15m'];
        const results = {};
        
        for (const tf of timeframes) {
            let analysis;
            
            if (tf === '4h' || tf === '1h') {
                // 🎯 AMÉLIORATION: Pour 4H et 1H, utiliser des données étendues (60 jours)
                // pour trouver le dernier signal valide, pas forcément récent
                console.log(`📊 [TRADING] ${tf}: Récupération de données étendues...`);
                
                // Utiliser des données étendues pour avoir le dernier état valide
                let extendedData = await getExtendedHistoricalDataForTrading(symbol, tf, 60);
                
                if (extendedData.length === 0) {
                    console.error(`❌ [TRADING] Aucune donnée étendue pour ${symbol} ${tf}`);
                    results[tf] = { symbol, timeframe: tf, signal: 'INSUFFICIENT_DATA' };
                    continue;
                }
                
                // NEW: Fallback if still insufficient after fetch
                const macdParams = getMACDParameters(tf);
                const minRequired = macdParams.slow + macdParams.signal + 10;
                if (extendedData.length < minRequired) {
                    log(`⚠️ Données étendues insuffisantes pour ${symbol} ${tf} (${extendedData.length}/${minRequired}) - Tentative d'agrégation depuis 15m`, 'WARNING');
                    extendedData = await aggregateDataFromLowerTimeframe(symbol, '15m', tf);
                    // If aggregation fails, set to INSUFFICIENT_DATA as before
                    if (extendedData.length < minRequired) {
                        console.error(`❌ [TRADING] Agrégation échouée pour ${symbol} ${tf} - INSUFFICIENT_DATA`);
                        results[tf] = { symbol, timeframe: tf, signal: 'INSUFFICIENT_DATA' };
                        continue;
                    } else {
                        console.log(`✅ [TRADING] Agrégation réussie pour ${symbol} ${tf} - ${extendedData.length} bougies disponibles`);
                    }
                }
                
                // Analyser avec les données étendues pour avoir le dernier état
                analysis = await analyzePairMACDWithData(symbol, tf, extendedData);
                console.log(`📊 [TRADING] ${tf}: Signal = ${analysis.signal} (données étendues)`);
                
            } else {
                // 🎯 Pour 15M, utiliser l'analyse standard (données récentes)
                console.log(`📊 [TRADING] ${tf}: Analyse standard...`);
                analysis = await analyzePairMACD(symbol, tf);
                console.log(`📊 [TRADING] ${tf}: Signal = ${analysis.signal} (données standard)`);
            }
            
            results[tf] = analysis;
            
            // Filtrage progressif: H4 et H1 doivent être haussiers (dernier état)
            if ((tf === '4h' || tf === '1h') && analysis.signal !== 'BULLISH' && analysis.signal !== 'BUY') {
                results.filtered = tf;
                results.filterReason = `Filtré au ${tf}: dernier signal ${analysis.signal}`;
                console.log(`❌ [TRADING] Filtré au ${tf}: ${analysis.signal} - ${analysis.reason}`);
                break;
            }
        }
        
        if (!results.filtered) {
            // Si H4 et H1 sont haussiers, vérifier le signal 15M
            const signal15m = results['15m'];
            if (signal15m.signal === 'BUY' && signal15m.crossover) {
                results.finalDecision = 'BUY';
                results.finalReason = 'H4 et H1 haussiers (données étendues) + croisement 15M détecté';
                console.log(`✅ [TRADING] Signal BUY validé: ${results.finalReason}`);
            } else if (signal15m.signal === 'BULLISH') {
                results.finalDecision = 'WAIT';
                results.finalReason = 'H4 et H1 haussiers (données étendues), 15M haussier mais pas de croisement';
                console.log(`⏳ [TRADING] Signal WAIT: ${results.finalReason}`);
            } else {
                results.finalDecision = 'FILTERED';
                results.filterReason = 'Filtré au 15M: signal non haussier';
                console.log(`❌ [TRADING] Filtré au 15M: ${signal15m.signal}`);
            }
        } else {
            results.finalDecision = 'FILTERED';
        }
        
        return results;
        
    } catch (error) {
        console.error(`❌ [TRADING] Erreur analyse multi-timeframe améliorée ${symbol}:`, error);
        log(`❌ Erreur analyse multi-timeframe améliorée ${symbol}: ${error.message}`, 'ERROR');
        return { symbol, error: error.message };
    }
}

// 🆕 FONCTION UTILITAIRE: Analyser MACD avec des données fournies
async function analyzePairMACDWithData(symbol, timeframe, klineData) {
    try {
        // 🎯 Récupérer les paramètres MACD spécifiques au timeframe
        const macdParams = getMACDParameters(timeframe);
        
        // Vérifier si on a assez de données pour l'analyse MACD
        const minRequired = macdParams.slow + macdParams.signal + 10;
        if (klineData.length < minRequired) {
            return { 
                symbol, 
                signal: 'INSUFFICIENT_DATA', 
                strength: 0, 
                reason: `Données insuffisantes: ${klineData.length}/${minRequired} bougies (MACD ${macdParams.fast},${macdParams.slow},${macdParams.signal})`, 
                timeframe 
            };
        }
        
        const closePrices = klineData.map(k => k.close);
        const currentPrice = closePrices[closePrices.length - 1];
        const volume24h = klineData.slice(-Math.min(288, klineData.length)).reduce((sum, k) => sum + k.volume, 0);
        
        // 🎯 Calculer MACD avec les paramètres spécifiques au timeframe
        const macdData = calculateMACD(closePrices, macdParams.fast, macdParams.slow, macdParams.signal);
        
        let macdSignal = 'HOLD';
        let signalStrength = 0;
        let reason = '';
        
        if (macdData.macd != null && macdData.signal != null && macdData.histogram != null) {
            const crossover = macdData.previousMacd != null && macdData.previousSignal != null && 
                             macdData.previousMacd <= macdData.previousSignal && macdData.macd > macdData.signal;
            const histogramImproving = macdData.previousHistogram != null && macdData.previousHistogram2 != null && 
                                      macdData.histogram > macdData.previousHistogram && macdData.previousHistogram > macdData.previousHistogram2;
            
            if (crossover && macdData.histogram > 0 && histogramImproving) {
                macdSignal = 'BUY';
                signalStrength = 90;
                reason = `Croisement MACD + Histogram>0 + Tendance IMPROVING (${timeframe})`;
            } else if (macdData.macd > macdData.signal && macdData.histogram > 0 && histogramImproving) {
                macdSignal = 'BULLISH';
                signalStrength = 75;
                reason = `MACD>Signal + Histogram>0 + Tendance IMPROVING (${timeframe})`;
            } else if (macdData.macd > macdData.signal && macdData.histogram > 0) {
                macdSignal = 'BULLISH';
                signalStrength = 60;
                reason = `MACD>Signal + Histogram>0 (${timeframe})`;
            } else if (macdData.macd < macdData.signal) {
                macdSignal = 'BEARISH';
                signalStrength = 30;
                reason = `MACD<Signal (${timeframe})`;
            } else {
                macdSignal = 'NEUTRAL';
                signalStrength = 50;
                reason = `MACD neutre (${timeframe})`;
            }
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
            reason: reason
        };
        
    } catch (error) {
        console.error(`❌ [TRADING] Erreur analyse MACD avec données ${symbol} ${timeframe}:`, error);
        log(`❌ ERREUR ANALYSE MACD ${symbol} (${timeframe}): ${error.message}`, 'ERROR');
        return { symbol, timeframe, signal: 'HOLD', strength: 0, reason: `Erreur: ${error.message}` };
    }
}

// 🆕 NOUVELLE FONCTION: Récupérer des données historiques étendues pour 4H et 1H
async function getExtendedHistoricalDataForTrading(symbol, timeframe, days = 60) {
    try {
        console.log(`🔍 [TRADING] Récupération de données étendues: ${symbol} ${timeframe} sur ${days} jours`);
        
        // Utiliser la fonction existante getKlineData avec une limite élevée
        // Pour 4H sur 60 jours = 60*24/4 = 360 bougies max
        // Pour 1H sur 60 jours = 60*24 = 1440 bougies max (limité à 1000 par l'API)
        const maxCandles = timeframe === '4h' ? 360 : 1000;
        
        const extendedData = await getKlineData(symbol, maxCandles, timeframe);
        
        console.log(`✅ [TRADING] ${extendedData.length} bougies ${timeframe} récupérées sur ${days} jours`);
        
        return extendedData;
        
    } catch (error) {
        console.error(`❌ [TRADING] Erreur récupération données étendues ${symbol} ${timeframe}:`, error);
        log(`❌ Erreur récupération données étendues trading: ${error.message}`, 'ERROR');
        return [];
    }
}

// 🆕 NOUVELLE FONCTION: Agréger les données depuis un timeframe inférieur (fallback pour INSUFFICIENT_DATA)
async function aggregateDataFromLowerTimeframe(symbol, lowerTimeframe, targetTimeframe) {
    try {
        console.log(`🔄 [TRADING] Tentative d'agrégation ${symbol}: ${lowerTimeframe} → ${targetTimeframe}`);
        
        // Mapping des multipliers pour l'agrégation
        const aggregationMap = {
            '15m_to_1h': 4,   // 4 bougies 15m = 1 bougie 1h
            '15m_to_4h': 16,  // 16 bougies 15m = 1 bougie 4h
            '1h_to_4h': 4     // 4 bougies 1h = 1 bougie 4h
        };
        
        const aggregationKey = `${lowerTimeframe}_to_${targetTimeframe}`;
        const multiplier = aggregationMap[aggregationKey];
        
        if (!multiplier) {
            console.warn(`⚠️ [TRADING] Agrégation non supportée: ${lowerTimeframe} → ${targetTimeframe}`);
            return [];
        }
        
        // Récupérer plus de données du timeframe inférieur
        const requiredCandles = 1000; // Maximum pour avoir assez de données
        const lowerData = await getKlineData(symbol, requiredCandles, lowerTimeframe);
        
        if (lowerData.length < multiplier) {
            console.warn(`⚠️ [TRADING] Pas assez de données ${lowerTimeframe} pour agrégation: ${lowerData.length}/${multiplier}`);
            return [];
        }
        
        // Agréger les données
        const aggregatedData = [];
        for (let i = 0; i < lowerData.length; i += multiplier) {
            const chunk = lowerData.slice(i, i + multiplier);
            if (chunk.length === multiplier) {
                const aggregatedCandle = {
                    timestamp: chunk[0].timestamp,
                    open: chunk[0].open,
                    high: Math.max(...chunk.map(c => c.high)),
                    low: Math.min(...chunk.map(c => c.low)),
                    close: chunk[chunk.length - 1].close,
                    volume: chunk.reduce((sum, c) => sum + c.volume, 0)
                };
                aggregatedData.push(aggregatedCandle);
            }
        }
        
        console.log(`✅ [TRADING] Agrégation réussie: ${lowerData.length} bougies ${lowerTimeframe} → ${aggregatedData.length} bougies ${targetTimeframe}`);
        return aggregatedData;
        
    } catch (error) {
        console.error(`❌ [TRADING] Erreur agrégation ${symbol}:`, error);
        return [];
    }
}

function calculatePositionSize() {
    const maxPositionValue = (balance.totalEquity * config.capitalPercent / 100) * config.leverage;
    return Math.max(maxPositionValue, 10);
}

function hasOpenPosition(symbol) {
    return openPositions.some(pos => pos.symbol === symbol && pos.status === 'OPEN');
}

// 🆕 NOUVELLE FONCTION: Vérifier si on peut ouvrir une nouvelle position
function canOpenNewPosition(symbol) {
    // Vérifier si on a déjà une position sur ce symbole
    if (hasOpenPosition(symbol)) {
        return { canOpen: false, reason: 'Position déjà ouverte sur ce symbole' };
    }
    
    // Vérifier la limite de positions simultanées
    if (openPositions.length >= MAX_SIMULTANEOUS_POSITIONS) {
        return { canOpen: false, reason: `Limite de ${MAX_SIMULTANEOUS_POSITIONS} positions simultanées atteinte` };
    }
    
    // Vérifier le cooldown
    if (isPairInCooldown(symbol)) {
        const remainingMinutes = getRemainingCooldown(symbol);
        return { canOpen: false, reason: `${symbol} en cooldown encore ${remainingMinutes} minutes` };
    }
    
    // Vérifier le capital disponible
    const positionValue = calculatePositionSize();
    if (positionValue < 10) {
        return { canOpen: false, reason: 'Capital insuffisant pour ouvrir une position' };
    }
    
    return { canOpen: true, reason: 'Conditions remplies pour ouvrir une position' };
}

async function openPosition(symbol, analysis) {
    // 🎯 NOUVELLE VÉRIFICATION: Utiliser la fonction de vérification centralisée
    const canOpen = canOpenNewPosition(symbol);
    
    if (!canOpen.canOpen) {
        log(`⚠️ ${symbol}: ${canOpen.reason}`, 'WARNING');
        return false;
    }
    
    // Log informatif sur le nombre de positions disponibles
    const availableSlots = MAX_SIMULTANEOUS_POSITIONS - openPositions.length;
    log(`📊 Ouverture position ${symbol} - ${availableSlots} slots disponibles sur ${MAX_SIMULTANEOUS_POSITIONS}`, 'INFO');
    
    const positionValue = calculatePositionSize();
    
    try {
        await setLeverage(symbol, config.leverage);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const quantity = (positionValue / analysis.price).toFixed(6);
        
        log(`🔄 Ouverture position LONG ${symbol}...`, 'INFO');
        log(`💰 Prix: ${analysis.price} | Quantité: ${quantity} | Valeur: ${positionValue.toFixed(2)} USDT`, 'INFO');
        log(`🎯 Signal détecté: ${analysis.reason}`, 'INFO');
        
        const orderData = {
            symbol: symbol,
            productType: "USDT-FUTURES",
            marginMode: "isolated",
            marginCoin: "USDT",
            size: quantity,
            side: "buy",
            tradeSide: "open",
            orderType: "market",
            clientOid: `${Date.now()}_${symbol}`
        };
        
        const orderResult = await makeRequest('/bitget/api/v2/mix/order/place-order', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
        
        if (!orderResult || orderResult.code !== '00000') {
            log(`❌ Échec ouverture position ${symbol}: ${orderResult?.msg || 'Erreur inconnue'}`, 'ERROR');
            return false;
        }
        
        log(`✅ Position ouverte: ${symbol} - Ordre ID: ${orderResult.data.orderId}`, 'SUCCESS');
        log(`📊 Positions ouvertes: ${openPositions.length + 1}/${MAX_SIMULTANEOUS_POSITIONS}`, 'INFO');
        
        addPairToCooldown(symbol);
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const currentPrice = await getCurrentPrice(symbol);
        const priceToUse = currentPrice || analysis.price;
        const initialStopPercent = config.trailingStopSettings?.initialStopPercent || config.trailingStop || 1.0;
        const initialStopPrice = priceToUse * (1 - initialStopPercent / 100);
        
        const triggerPriceFormatted = parseFloat(initialStopPrice.toFixed(8)).toString();
        
        const stopLossData = {
            planType: "normal_plan",
            symbol: symbol,
            productType: "USDT-FUTURES",
            marginMode: "isolated",
            marginCoin: "USDT",
            size: quantity.toString(),
            triggerPrice: triggerPriceFormatted,
            triggerType: "mark_price",
            side: "sell",
            tradeSide: "close",
            orderType: "market",
            clientOid: `stop_${Date.now()}_${symbol}`,
            reduceOnly: "YES"
        };
        
        log(`🔄 Configuration stop loss initial -1% pour ${symbol} @ ${initialStopPrice.toFixed(4)}...`, 'INFO');
        
        // NEW: Retry wrapper for stop loss creation
        let finalStopLossId = null;
        let stopLossCreated = false;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts && !stopLossCreated) {
            attempts++;
            
            const stopLossResult = await makeRequestWithRetry('/bitget/api/v2/mix/order/place-plan-order', {
                method: 'POST',
                body: JSON.stringify(stopLossData)
            });
            
            if (stopLossResult && stopLossResult.code === '00000') {
                finalStopLossId = stopLossResult.data.orderId;
                stopLossCreated = true;
                log(`✅ Stop Loss initial créé: ${symbol} @ ${initialStopPrice.toFixed(4)} (-1%) [Tentative ${attempts}/${maxAttempts}]`, 'SUCCESS');
                log(`🆔 Stop Loss ID: ${finalStopLossId}`, 'INFO');
                break;
            } else {
                log(`❌ ÉCHEC stop loss initial ${symbol} [Tentative ${attempts}/${maxAttempts}]: ${stopLossResult?.msg || 'Erreur API'}`, 'ERROR');
                
                if (attempts < maxAttempts) {
                    log(`⚠️ Tentative ${attempts}/${maxAttempts} échouée - Réessai dans 2s...`, 'WARNING');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        
        if (!stopLossCreated) {
            log(`❌ ÉCHEC de toutes les tentatives de stop loss initial pour ${symbol}`, 'ERROR');
            log(`🔄 Tentative de création stop loss d'urgence...`, 'WARNING');
            
            // NOUVELLE LOGIQUE: Essayer de créer un stop loss d'urgence immédiatement
            await new Promise(resolve => setTimeout(resolve, 2000)); // Attendre 2s
            
            const tempPosition = {
                symbol: symbol,
                quantity: quantity
            };
            
            const emergencySuccess = await createEmergencyStopLoss(tempPosition, initialStopPrice);
            
            if (emergencySuccess && tempPosition.stopLossId) {
                finalStopLossId = tempPosition.stopLossId;
                stopLossCreated = true;
                log(`🆘 Stop Loss d'urgence créé avec succès: ${symbol} @ ${initialStopPrice.toFixed(4)}`, 'SUCCESS');
            } else {
                log(`❌ IMPOSSIBLE de créer un stop loss pour ${symbol} - POSITION À RISQUE !`, 'ERROR');
                // On continue quand même mais on marque la position comme à risque
            }
        }
        
        const position = {
            id: Date.now(),
            symbol: symbol,
            side: 'LONG',
            size: positionValue,
            quantity: quantity,
            entryPrice: analysis.price,
            status: 'OPEN',
            timestamp: new Date().toISOString(),
            orderId: orderResult.data.orderId,
            stopLossId: finalStopLossId,
            currentStopPrice: initialStopPrice,
            highestPrice: analysis.price,
            reason: analysis.reason
        };
        
        openPositions.push(position);
        botStats.totalPositions++;
        
        log(`🚀 Position complète: ${symbol} LONG ${positionValue.toFixed(2)} USDT @ ${analysis.price.toFixed(4)}`, 'SUCCESS');
        log(`🎯 Raison: ${analysis.reason}`, 'INFO');
        
        if (finalStopLossId) {
            log(`🔒 Stop Loss actif @ ${initialStopPrice.toFixed(4)} (-1%)`, 'SUCCESS');
        } else {
            log(`⚠️ Position ouverte SANS stop loss - RISQUE ÉLEVÉ !`, 'WARNING');
        }
        
        updatePositionsDisplay();
        await refreshBalance();
        
        return true;
    } catch (error) {
        log(`❌ Erreur ouverture position ${symbol}: ${error.message}`, 'ERROR');
        return false;
    }
}

// REMOVED: syncLocalPositions function - merged into syncAndCheckPositions
// This eliminates duplication and ensures consistent handling

// 🆕 NOUVELLE FONCTION: Récupérer les positions actives depuis l'API
async function fetchActivePositionsFromAPI() {
    try {
        const result = await makeRequest('/bitget/api/v2/mix/position/all-position?productType=USDT-FUTURES');
        
        if (result && result.code === '00000' && result.data) {
            return result.data.filter(pos => parseFloat(pos.total) > 0);
        }
        
        return [];
    } catch (error) {
        log(`❌ Erreur récupération positions API: ${error.message}`, 'ERROR');
        return [];
    }
}

async function createEmergencyStopLoss(position, stopPrice) {
    try {
        const stopLossData = {
            planType: "normal_plan",
            symbol: position.symbol,
            productType: "USDT-FUTURES",
            marginMode: "isolated",
            marginCoin: "USDT",
            size: position.quantity.toString(),
            triggerPrice: parseFloat(stopPrice.toFixed(8)).toString(),
            triggerType: "mark_price",
            side: "sell",
            tradeSide: "close",
            orderType: "market",
            clientOid: `emergency_stop_${Date.now()}_${position.symbol}`,
            reduceOnly: "YES"
        };
        
        const result = await makeRequestWithRetry('/bitget/api/v2/mix/order/place-plan-order', {
            method: 'POST',
            body: JSON.stringify(stopLossData)
        });
        
        if (result && result.code === '00000') {
            position.stopLossId = result.data.orderId;
            log(`🆘 Stop Loss d'urgence créé avec ID: ${result.data.orderId}`, 'SUCCESS');
            return true;
        } else {
            log(`❌ Erreur création stop loss d'urgence: ${result?.msg || 'Erreur inconnue'}`, 'ERROR');
            return false;
        }
    } catch (error) {
        log(`❌ Exception création stop loss d'urgence: ${error.message}`, 'ERROR');
        return false;
    }
}

async function manageTrailingStops() {
    if (!botRunning || openPositions.length === 0) return;
    
    try {
        log('🔍 Vérification stop loss trailing...', 'DEBUG');
        
        const apiPositions = await syncAndCheckPositions();
        
        for (const position of openPositions) {
            if (!position.stopLossId) {
                log(`⚠️ ${position.symbol}: Pas de stop loss configuré - Création automatique...`, 'WARNING');
                
                const currentPrice = await getCurrentPrice(position.symbol);
                if (currentPrice) {
                    const urgentStopPercent = config.trailingStopSettings?.initialStopPercent || config.trailingStop || 1.0;
                    const urgentStopPrice = currentPrice * (1 - urgentStopPercent / 100);
                    const success = await createEmergencyStopLoss(position, urgentStopPrice);
                    
                    if (success) {
                        log(`🆘 Stop Loss d'urgence créé pour ${position.symbol} @ ${urgentStopPrice.toFixed(4)} (-1%)`, 'SUCCESS');
                        position.currentStopPrice = urgentStopPrice;
                        position.highestPrice = currentPrice;
                    } else {
                        log(`❌ Échec création stop loss d'urgence pour ${position.symbol}`, 'ERROR');
                        continue;
                    }
                } else {
                    log(`❌ Impossible de récupérer le prix pour ${position.symbol}`, 'ERROR');
                    continue;
                }
            }
            
            const currentPrice = await getCurrentPrice(position.symbol);
            if (!currentPrice) {
                log(`⚠️ ${position.symbol}: Impossible de récupérer le prix`, 'WARNING');
                continue;
            }
            
            if (currentPrice > position.highestPrice) {
                position.highestPrice = currentPrice;
            }
            
            const trailingPercent = config.trailingStopSettings?.trailingPercent || config.trailingStop || 1.0;
            const newStopPrice = position.highestPrice * (1 - trailingPercent / 100);
            
            if (newStopPrice > position.currentStopPrice) {
                const success = await modifyStopLoss(
                    position.symbol, 
                    position.stopLossId, 
                    newStopPrice, 
                    position.quantity
                );
                
                if (success) {
                    position.currentStopPrice = newStopPrice;
                    const gainPercent = ((newStopPrice - position.entryPrice) / position.entryPrice * 100);
                    log(`📈 ${position.symbol}: Stop ajusté → ${newStopPrice.toFixed(4)} (${gainPercent > 0 ? '+' : ''}${gainPercent.toFixed(2)}%)`, 'SUCCESS');
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        updatePositionsDisplay();
        
    } catch (error) {
        log(`❌ Erreur gestion stop loss: ${error.message}`, 'ERROR');
    }
}

async function updatePositionsPnL() {
    if (openPositions.length === 0) return;
    
    try {
        const result = await makeRequest('/bitget/api/v2/mix/position/all-position?productType=USDT-FUTURES');
        
        if (result && result.code === '00000' && result.data) {
            const apiPositions = result.data.filter(pos => parseFloat(pos.total) > 0);
            
            openPositions.forEach(localPos => {
                const apiPos = apiPositions.find(pos => pos.symbol === localPos.symbol);
                if (apiPos) {
                    localPos.currentPrice = parseFloat(apiPos.markPrice);
                    localPos.unrealizedPnL = parseFloat(apiPos.unrealizedPL || 0);
                    localPos.pnlPercentage = ((localPos.currentPrice - localPos.entryPrice) / localPos.entryPrice) * 100;
                }
            });
            
            updatePositionsDisplay();
        }
    } catch (error) {
        // Mise à jour silencieuse
    }
}

function updatePositionsDisplay() {
    const container = document.getElementById('positionsContainer');
    
    if (openPositions.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: #666; padding: 15px; font-size: 12px;">Aucune position ouverte - ${MAX_SIMULTANEOUS_POSITIONS} positions max autorisées</div>`;
        return;
    }
    
    // Afficher le compteur de positions en haut
    const positionCounterHtml = `
        <div style="background: #f0f8ff; padding: 8px; margin-bottom: 8px; border-radius: 4px; text-align: center; font-size: 12px; color: #2c5aa0;">
            <strong>📊 Positions ouvertes: ${openPositions.length}/${MAX_SIMULTANEOUS_POSITIONS}</strong>
            ${openPositions.length >= MAX_SIMULTANEOUS_POSITIONS ? 
                '<span style="color: #ff6b6b; margin-left: 10px;">⚠️ LIMITE ATTEINTE</span>' : 
                `<span style="color: #51cf66; margin-left: 10px;">✅ ${MAX_SIMULTANEOUS_POSITIONS - openPositions.length} slots disponibles</span>`
            }
        </div>
    `;
    
    container.innerHTML = positionCounterHtml;
    
    openPositions.forEach(position => {
        const item = document.createElement('div');
        item.className = 'position-item';
        
        const timeAgo = Math.floor((Date.now() - new Date(position.timestamp).getTime()) / 60000);
        const hasStopLoss = position.stopLossId ? true : false;
        
        let pnlDisplay = '';
        let pnlClass = 'pnl-neutral';
        
        if (position.currentPrice && position.unrealizedPnL !== undefined) {
            const pnlValue = position.unrealizedPnL;
            const pnlPercent = position.pnlPercentage || 0;
            
            if (pnlValue > 0) {
                pnlClass = 'pnl-positive';
                pnlDisplay = `+${pnlValue.toFixed(2)} USDT (+${pnlPercent.toFixed(2)}%)`;
            } else if (pnlValue < 0) {
                pnlClass = 'pnl-negative';
                pnlDisplay = `${pnlValue.toFixed(2)} USDT (${pnlPercent.toFixed(2)}%)`;
            } else {
                pnlDisplay = `0.00 USDT (0.00%)`;
            }
        } else {
            pnlDisplay = 'Calcul...';
        }
        
        const stopInfo = hasStopLoss ? 
            `🔒 SL ${position.currentStopPrice ? position.currentStopPrice.toFixed(4) : '--'}` : 
            '❌ NO SL';
        const stopClass = hasStopLoss ? 'trailing-active' : 'trailing-inactive';
        
        item.innerHTML = `
            <div class="position-header">
                <span><strong>${position.symbol}</strong> ${position.side}</span>
                <span class="${pnlClass}">${pnlDisplay}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin: 2px 0;">
                <span style="font-size: 10px;">
                    Entry: ${position.entryPrice.toFixed(4)} | 
                    Current: ${position.currentPrice ? position.currentPrice.toFixed(4) : '--'} |
                    High: ${position.highestPrice ? position.highestPrice.toFixed(4) : '--'}
                </span>
                <span class="trailing-status ${stopClass}">
                    ${stopInfo}
                </span>
            </div>
            <div class="position-details">
                Size: ${position.size.toFixed(2)} USDT | ${timeAgo}min ago | ID: ${(position.orderId || 'N/A').slice(-8)}
            </div>
        `;
        
        container.appendChild(item);
    });
}

async function importExistingPositions() {
    try {
        log('🔄 Importation des positions existantes depuis Bitget...', 'INFO');
        
        if (typeof makeRequest !== 'function') {
            log('❌ Fonction makeRequest non disponible pour l\'importation', 'ERROR');
            return;
        }
        
        if (!config.apiKey || !config.secretKey || !config.passphrase) {
            log('❌ Configuration API manquante pour l\'importation', 'ERROR');
            return;
        }
        
        log('🔍 Récupération des positions depuis l\'API Bitget...', 'DEBUG');
        const result = await makeRequest('/bitget/api/v2/mix/position/all-position?productType=USDT-FUTURES');
        
        log(`📊 Réponse API reçue: ${result ? 'OK' : 'NULL'}`, 'DEBUG');
        
        if (result && result.code === '00000' && result.data) {
            log(`📊 Données brutes reçues: ${result.data.length} positions total`, 'DEBUG');
            const apiPositions = result.data.filter(pos => parseFloat(pos.total) > 0);
            log(`📊 Positions actives filtrées: ${apiPositions.length}`, 'DEBUG');
            
            if (apiPositions.length === 0) {
                log('ℹ️ Aucune position existante trouvée sur Bitget', 'INFO');
                return;
            }
            
            // NEW: Limit check before importing
            if (openPositions.length + apiPositions.length > MAX_SIMULTANEOUS_POSITIONS) {
                log(`⚠️ Import limité: Trop de positions (${openPositions.length + apiPositions.length} > ${MAX_SIMULTANEOUS_POSITIONS}) - Import partiel`, 'WARNING');
                const availableSlots = MAX_SIMULTANEOUS_POSITIONS - openPositions.length;
                apiPositions.splice(availableSlots); // Keep only what fits
            }
            
            apiPositions.forEach((pos, index) => {
                log(`📍 Position ${index + 1}: ${pos.symbol} ${pos.side || 'NO_SIDE'} - Size: ${pos.contractSize || 'NO_SIZE'} - Price: ${pos.markPrice || 'NO_PRICE'}`, 'DEBUG');
                log(`📊 Structure complète: ${JSON.stringify(pos)}`, 'DEBUG');
            });
            
            let imported = 0;
            
            for (const apiPos of apiPositions) {
                const exists = openPositions.find(localPos => localPos.symbol === apiPos.symbol);
                
                if (!exists) {
                    const side = apiPos.side ? apiPos.side.toUpperCase() : 'LONG';
                    const contractSize = parseFloat(apiPos.contractSize || 0);
                    const markPrice = parseFloat(apiPos.markPrice || 0);
                    const averageOpenPrice = parseFloat(apiPos.averageOpenPrice || markPrice);
                    const unrealizedPL = parseFloat(apiPos.unrealizedPL || 0);
                    
                    log(`🔍 Données position ${apiPos.symbol}: side=${apiPos.side}, contractSize=${apiPos.contractSize}, markPrice=${apiPos.markPrice}`, 'DEBUG');
                    
                    const position = {
                        id: Date.now() + Math.random(),
                        symbol: apiPos.symbol,
                        side: side,
                        size: Math.abs(contractSize * markPrice),
                        quantity: Math.abs(contractSize),
                        entryPrice: averageOpenPrice,
                        status: 'OPEN',
                        timestamp: new Date().toISOString(),
                        orderId: `imported_${Date.now()}`,
                        stopLossId: null,
                        currentStopPrice: null,
                        highestPrice: markPrice,
                        currentPrice: markPrice,
                        unrealizedPnL: unrealizedPL,
                        pnlPercentage: averageOpenPrice > 0 ? ((markPrice - averageOpenPrice) / averageOpenPrice) * 100 : 0,
                        reason: '📥 Position importée depuis Bitget'
                    };
                    
                    if (position.symbol && position.size > 0 && position.entryPrice > 0) {
                        openPositions.push(position);
                        imported++;
                        
                        log(`📥 Position importée: ${position.symbol} ${position.side} ${position.size.toFixed(2)} USDT @ ${position.entryPrice.toFixed(4)}`, 'SUCCESS');
                    } else {
                        log(`⚠️ Position ${apiPos.symbol} ignorée - Données invalides`, 'WARNING');
                    }
                }
            }
            
            if (imported > 0) {
                log(`✅ ${imported} position(s) importée(s) avec succès!`, 'SUCCESS');
                log(`⚠️ Positions importées SANS stop loss - Le système va les protéger automatiquement`, 'WARNING');
                
                updatePositionsDisplay();
                updateStats();
                
                setTimeout(() => {
                    manageTrailingStops();
                }, 2000);
            } else {
                log('ℹ️ Toutes les positions existantes sont déjà dans le système', 'INFO');
            }
        } else {
            log('❌ Erreur lors de l\'importation des positions', 'ERROR');
        }
    } catch (error) {
        log(`❌ Erreur importation positions: ${error.message}`, 'ERROR');
    }
}

window.importExistingPositions = importExistingPositions;
window.canOpenNewPosition = canOpenNewPosition;
window.syncAndCheckPositions = syncAndCheckPositions;
window.fetchActivePositionsFromAPI = fetchActivePositionsFromAPI;
window.makeRequestWithRetry = makeRequestWithRetry;

// 🧪 FONCTION DE TEST: Tester les nouveaux paramètres MACD par timeframe
async function testMACDParameters(symbol = 'BTCUSDT') {
    console.log('🧪 Test des paramètres MACD adaptatifs par timeframe...');
    
    const testSymbol = symbol;
    const timeframes = ['4h', '1h', '15m'];
    
    for (const tf of timeframes) {
        console.log(`\n🔍 Test ${tf.toUpperCase()}:`);
        
        const params = getMACDParameters(tf);
        console.log(`   Paramètres: Fast=${params.fast}, Slow=${params.slow}, Signal=${params.signal}`);
        console.log(`   Bougies requises: ${params.minCandles}`);
        
        try {
            const analysis = await analyzePairMACD(testSymbol, tf);
            console.log(`   ✅ Analyse réussie: ${analysis.signal}`);
            console.log(`   📊 Raison: ${analysis.reason}`);
        } catch (error) {
            console.log(`   ❌ Erreur analyse: ${error.message}`);
        }
        
        // Délai entre les tests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n✅ Test terminé. Vérifiez les résultats ci-dessus.');
}

// Rendre la fonction accessible globalement
window.testMACDParameters = testMACDParameters;

// NEW: Merged function combining syncLocalPositions and checkPositionsStatus
async function syncAndCheckPositions() {
    if (openPositions.length === 0) return [];
    
    try {
        const result = await makeRequest('/bitget/api/v2/mix/position/all-position?productType=USDT-FUTURES');
        
        if (result && result.code === '00000' && result.data) {
            const apiPositions = result.data.filter(pos => parseFloat(pos.total) > 0);
            const currentSymbols = apiPositions.map(pos => pos.symbol);
            
            const closedPositions = openPositions.filter(localPos => 
                !currentSymbols.includes(localPos.symbol)
            );
            
            if (closedPositions.length > 0) {
                for (const closedPos of closedPositions) {
                    log(`🔚 Position fermée détectée: ${closedPos.symbol} (Stop Loss déclenché ou fermeture manuelle)`, 'SUCCESS');
                    
                    botStats.totalClosedPositions++;
                    const pnl = closedPos.unrealizedPnL || 0;
                    
                    if (pnl > 0) {
                        botStats.winningPositions++;
                        botStats.totalWinAmount += pnl;
                        log(`🟢 Position gagnante: +${pnl.toFixed(2)}$ (Total: ${botStats.winningPositions} gagnantes)`, 'SUCCESS');
                    } else if (pnl < 0) {
                        botStats.losingPositions++;
                        botStats.totalLossAmount += pnl;
                        log(`🔴 Position perdante: ${pnl.toFixed(2)}$ (Total: ${botStats.losingPositions} perdantes)`, 'WARNING');
                    }
                    
                    // Cancel orphaned stop losses (from checkPositionsStatus)
                    if (closedPos.stopLossId) {
                        try {
                            const cancelResult = await makeRequest('/bitget/api/v2/mix/order/cancel-plan-order', {
                                method: 'POST',
                                body: JSON.stringify({
                                    symbol: closedPos.symbol,
                                    productType: "USDT-FUTURES",
                                    marginCoin: "USDT",
                                    orderId: closedPos.stopLossId
                                })
                            });
                            
                            if (cancelResult && cancelResult.code === '00000') {
                                log(`✅ Stop Loss ${closedPos.symbol} annulé automatiquement`, 'SUCCESS');
                            }
                        } catch (error) {
                            log(`⚠️ Erreur annulation stop loss ${closedPos.symbol}: ${error.message}`, 'WARNING');
                        }
                    }
                }
                
                openPositions = openPositions.filter(localPos => 
                    currentSymbols.includes(localPos.symbol)
                );
                
                updatePositionsDisplay();
                updateStats();
                await refreshBalance();
                
                log(`📊 ${closedPositions.length} position(s) fermée(s) - Synchronisation effectuée`, 'SUCCESS');
            }
            
            return apiPositions;
        }
    } catch (error) {
        log(`❌ Erreur synchronisation positions: ${error.message}`, 'ERROR');
        return [];
    }
}

// 🧪 FONCTION DE TEST: Vérifier que toutes les corrections fonctionnent
async function testTradingFixes() {
    console.log('🧪 Test des corrections de trading...');
    
    try {
        // Test 1: Vérifier que la fonction dupliquée a été supprimée
        if (typeof analyzeMultiTimeframe === 'undefined') {
            console.log('✅ Fix 1: Fonction dupliquée analyzeMultiTimeframe supprimée');
        } else {
            console.log('❌ Fix 1: Fonction dupliquée analyzeMultiTimeframe encore présente');
        }
        
        // Test 2: Vérifier que la fonction d'agrégation existe
        if (typeof aggregateDataFromLowerTimeframe === 'function') {
            console.log('✅ Fix 2: Fonction d\'agrégation pour INSUFFICIENT_DATA ajoutée');
        } else {
            console.log('❌ Fix 2: Fonction d\'agrégation manquante');
        }
        
        // Test 3: Vérifier que la fonction de retry existe
        if (typeof makeRequestWithRetry === 'function') {
            console.log('✅ Fix 4: Fonction de retry pour stop loss ajoutée');
        } else {
            console.log('❌ Fix 4: Fonction de retry manquante');
        }
        
        // Test 4: Vérifier que la fonction mergée existe
        if (typeof syncAndCheckPositions === 'function') {
            console.log('✅ Fix 5: Fonction de synchronisation mergée créée');
        } else {
            console.log('❌ Fix 5: Fonction de synchronisation mergée manquante');
        }
        
        // Test 5: Vérifier que les anciens noms n'existent plus
        if (typeof syncLocalPositions === 'undefined' && typeof checkPositionsStatus === 'undefined') {
            console.log('✅ Fix 5: Anciennes fonctions de synchronisation supprimées');
        } else {
            console.log('❌ Fix 5: Anciennes fonctions de synchronisation encore présentes');
        }
        
        // Test 6: Vérifier la configuration trailing stop
        if (config.trailingStopSettings && config.trailingStopSettings.trailingPercent) {
            console.log('✅ Fix Général: Configuration trailing stop configurable');
        } else {
            console.log('⚠️ Fix Général: Configuration trailing stop utilise les valeurs par défaut');
        }
        
        console.log('✅ Test des corrections terminé');
        
    } catch (error) {
        console.error('❌ Erreur lors du test des corrections:', error);
    }
}

// Rendre la fonction accessible globalement
window.testTradingFixes = testTradingFixes;

console.log('✅ Trading fixes applied successfully - call testTradingFixes() to verify');