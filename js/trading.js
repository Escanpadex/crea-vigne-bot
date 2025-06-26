// Trading Functions - MACD Strategy & Position Management
console.log('📁 Loading trading.js...');

// 🎯 FONCTION: Paramètres MACD adaptés par timeframe
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
    
    const ema12Array = calculateEMA(prices, fastPeriod);
    const ema26Array = calculateEMA(prices, slowPeriod);
    
    const macdArray = prices.map((price, idx) => {
        const ema12 = ema12Array[idx];
        const ema26 = ema26Array[idx];
        if (ema12 === null || ema26 === null) return null;
        return ema12 - ema26;
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

// 🔧 FONCTION DE DIAGNOSTIC MACD (pour vérifier les corrections)
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
        } else if (macdData.crossover && macdData.histogram > 0) {
            macdSignal = 'BUY';
            signalStrength = Math.abs(macdData.histogram) * 1000;
            reason = `🔥 CROISEMENT HAUSSIER ${timeframe} (${macdParams.fast},${macdParams.slow},${macdParams.signal})! 
                     MACD: ${macdData.macd.toFixed(6)} > Signal: ${macdData.signal.toFixed(6)} 
                     | Histogram: ${macdData.histogram.toFixed(6)}`;
        } else if (macdData.macd > macdData.signal) {
            macdSignal = 'BULLISH';
            reason = `📈 MACD ${timeframe} (${macdParams.fast},${macdParams.slow},${macdParams.signal}) au-dessus Signal. MACD: ${macdData.macd.toFixed(6)}, Signal: ${macdData.signal.toFixed(6)}`;
        } else {
            macdSignal = 'BEARISH';
            reason = `📉 MACD ${timeframe} (${macdParams.fast},${macdParams.slow},${macdParams.signal}) en dessous Signal. MACD: ${macdData.macd.toFixed(6)}, Signal: ${macdData.signal.toFixed(6)}`;
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

async function analyzeMultiTimeframe(symbol) {
    try {
        // NOUVELLE LOGIQUE: H4 → H1 → 15M (plus de 5M)
        const timeframes = ['4h', '1h', '15m'];
        const results = {};
        
        for (const tf of timeframes) {
            const analysis = await analyzePairMACD(symbol, tf);
            results[tf] = analysis;
            
            // Filtrage progressif: H4 et H1 doivent être haussiers
            if ((tf === '4h' || tf === '1h') && analysis.signal !== 'BULLISH' && analysis.signal !== 'BUY') {
                results.filtered = tf;
                results.filterReason = `Filtré au ${tf}: ${analysis.signal}`;
                break;
            }
        }
        
        if (!results.filtered) {
            // Si H4 et H1 sont haussiers, vérifier le signal 15M
            const signal15m = results['15m'];
            if (signal15m.signal === 'BUY' && signal15m.crossover) {
                results.finalDecision = 'BUY';
                results.finalReason = 'H4 et H1 haussiers + croisement 15M détecté';
            } else if (signal15m.signal === 'BULLISH') {
                results.finalDecision = 'WAIT';
                results.finalReason = 'H4 et H1 haussiers, 15M haussier mais pas de croisement';
            } else {
                results.finalDecision = 'FILTERED';
                results.filterReason = 'Filtré au 15M: signal non haussier';
            }
        } else {
            results.finalDecision = 'FILTERED';
        }
        
        return results;
        
    } catch (error) {
        log(`❌ Erreur analyse multi-timeframe ${symbol}: ${error.message}`, 'ERROR');
        return { symbol, error: error.message };
    }
}

function calculatePositionSize() {
    const maxPositionValue = (balance.totalEquity * config.capitalPercent / 100) * config.leverage;
    return Math.max(maxPositionValue, 10);
}

function hasOpenPosition(symbol) {
    return openPositions.some(pos => pos.symbol === symbol && pos.status === 'OPEN');
}

async function openPosition(symbol, analysis) {
    if (hasOpenPosition(symbol)) {
        log(`⚠️ Position déjà ouverte sur ${symbol}`, 'WARNING');
        return false;
    }
    
    if (isPairInCooldown(symbol)) {
        const remainingMinutes = getRemainingCooldown(symbol);
        log(`⏰ ${symbol} en cooldown encore ${remainingMinutes} minutes`, 'WARNING');
        return false;
    }
    
    const positionValue = calculatePositionSize();
    if (positionValue < 10) {
        log(`⚠️ Capital insuffisant pour ouvrir position sur ${symbol}`, 'WARNING');
        return false;
    }
    
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
        
        addPairToCooldown(symbol);
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const currentPrice = await getCurrentPrice(symbol);
        const priceToUse = currentPrice || analysis.price;
        const initialStopPrice = priceToUse * 0.99;
        
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
        const stopLossResult = await makeRequest('/bitget/api/v2/mix/order/place-plan-order', {
            method: 'POST',
            body: JSON.stringify(stopLossData)
        });
        
        if (stopLossResult && stopLossResult.code === '00000') {
            log(`✅ Stop Loss initial créé: ${symbol} @ ${initialStopPrice.toFixed(4)} (-1%)`, 'SUCCESS');
            log(`🆔 Stop Loss ID: ${stopLossResult.data.orderId}`, 'INFO');
        } else {
            log(`❌ ÉCHEC stop loss ${symbol}: ${stopLossResult?.msg || 'Erreur API'}`, 'ERROR');
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
            stopLossId: stopLossResult?.data?.orderId || null,
            currentStopPrice: initialStopPrice,
            highestPrice: analysis.price,
            reason: analysis.reason
        };
        
        openPositions.push(position);
        botStats.totalPositions++;
        
        log(`🚀 Position complète: ${symbol} LONG ${positionValue.toFixed(2)} USDT @ ${analysis.price.toFixed(4)}`, 'SUCCESS');
        log(`🎯 Raison: ${analysis.reason}`, 'INFO');
        
        if (stopLossResult?.data?.orderId) {
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

async function syncLocalPositions() {
    const apiPositions = await fetchActivePositionsFromAPI();
    const apiSymbols = apiPositions.map(pos => pos.symbol);
    
    const removedPositions = openPositions.filter(localPos => 
        !apiSymbols.includes(localPos.symbol)
    );
    
    if (removedPositions.length > 0) {
        removedPositions.forEach(pos => {
            log(`🔚 Position fermée détectée: ${pos.symbol} (Stop Loss déclenché)`, 'SUCCESS');
            
            botStats.totalClosedPositions++;
            const pnl = pos.unrealizedPnL || 0;
            
            if (pnl > 0) {
                botStats.winningPositions++;
                botStats.totalWinAmount += pnl;
                log(`🟢 Position gagnante: +${pnl.toFixed(2)}$ (Total: ${botStats.winningPositions} gagnantes)`, 'SUCCESS');
            } else if (pnl < 0) {
                botStats.losingPositions++;
                botStats.totalLossAmount += pnl;
                log(`🔴 Position perdante: ${pnl.toFixed(2)}$ (Total: ${botStats.losingPositions} perdantes)`, 'WARNING');
            }
        });
        
        openPositions = openPositions.filter(localPos => 
            apiSymbols.includes(localPos.symbol)
        );
        
        updatePositionsDisplay();
        updateStats();
    }
    
    return apiPositions;
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
        
        const result = await makeRequest('/bitget/api/v2/mix/order/place-plan-order', {
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
        
        const apiPositions = await syncLocalPositions();
        
        for (const position of openPositions) {
            if (!position.stopLossId) {
                log(`⚠️ ${position.symbol}: Pas de stop loss configuré - Création automatique...`, 'WARNING');
                
                const currentPrice = await getCurrentPrice(position.symbol);
                if (currentPrice) {
                    const urgentStopPrice = currentPrice * 0.99;
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
            
            const newStopPrice = position.highestPrice * 0.99;
            
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
        container.innerHTML = '<div style="text-align: center; color: #666; padding: 15px; font-size: 12px;">Aucune position ouverte</div>';
        return;
    }
    
    container.innerHTML = '';
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

// 🧪 FONCTION DE TEST: Tester les nouveaux paramètres MACD par timeframe
async function testMACDParameters() {
    console.log('🧪 Test des paramètres MACD adaptatifs par timeframe...');
    
    const testSymbol = 'BTCUSDT';
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

async function checkPositionsStatus() {
    if (openPositions.length === 0) return;
    
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
                    log(`🔚 Position fermée MANUELLEMENT détectée: ${closedPos.symbol}`, 'WARNING');
                    log(`💰 ${closedPos.symbol} fermée par l'utilisateur sur Bitget`, 'INFO');
                    
                    botStats.totalClosedPositions++;
                    const pnl = closedPos.unrealizedPnL || 0;
                    
                    if (pnl > 0) {
                        botStats.winningPositions++;
                        botStats.totalWinAmount += pnl;
                        log(`🟢 Position gagnante (manuelle): +${pnl.toFixed(2)}$ (Total: ${botStats.winningPositions} gagnantes)`, 'SUCCESS');
                    } else if (pnl < 0) {
                        botStats.losingPositions++;
                        botStats.totalLossAmount += pnl;
                        log(`🔴 Position perdante (manuelle): ${pnl.toFixed(2)}$ (Total: ${botStats.losingPositions} perdantes)`, 'WARNING');
                    }
                    
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
                await refreshBalance();
                
                log(`📊 ${closedPositions.length} position(s) fermée(s) manuellement - Synchronisation effectuée`, 'SUCCESS');
                log(`🔄 Bot peut maintenant analyser à nouveau ces paires`, 'INFO');
                updateStats();
            }
            
            for (const localPos of openPositions) {
                const apiPos = apiPositions.find(pos => pos.symbol === localPos.symbol);
                if (apiPos) {
                    localPos.currentPrice = parseFloat(apiPos.markPrice);
                    localPos.unrealizedPnL = parseFloat(apiPos.unrealizedPL || 0);
                    localPos.pnlPercentage = ((localPos.currentPrice - localPos.entryPrice) / localPos.entryPrice) * 100;
                    
                    if (localPos.currentPrice > localPos.highestPrice) {
                        localPos.highestPrice = localPos.currentPrice;
                    }
                }
            }
            
            updatePositionsDisplay();
        }
    } catch (error) {
        log(`⚠️ Erreur vérification positions: ${error.message}`, 'WARNING');
    }
} 