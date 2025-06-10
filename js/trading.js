// Trading Functions - MACD Strategy & Position Management

function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const minRequired = slowPeriod + signalPeriod + 10;
    if (prices.length < minRequired) {
        return { macd: null, signal: null, histogram: null, crossover: false };
    }
    
    function calculateEMA(data, period) {
        const k = 2 / (period + 1);
        const emaArray = new Array(data.length).fill(null);
        
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += data[i];
        }
        let prevEma = sum / period;
        emaArray[period - 1] = prevEma;
        
        for (let i = period; i < data.length; i++) {
            const ema = data[i] * k + prevEma * (1 - k);
            emaArray[i] = ema;
            prevEma = ema;
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
    
    const macdForSignal = [];
    let startIndex = -1;
    
    for (let i = 0; i < macdArray.length; i++) {
        if (macdArray[i] !== null) {
            if (startIndex === -1) startIndex = i;
            macdForSignal.push(macdArray[i]);
        }
    }
    
    let signalArray = new Array(prices.length).fill(null);
    
    if (macdForSignal.length >= signalPeriod) {
        const signalEMA = calculateEMA(macdForSignal, signalPeriod);
        
        for (let i = 0; i < signalEMA.length; i++) {
            if (signalEMA[i] !== null) {
                const originalIndex = startIndex + i;
                if (originalIndex < prices.length) {
                    signalArray[originalIndex] = signalEMA[i];
                }
            }
        }
    }
    
    // Prendre les TROIS dernières valeurs pour détecter un vrai croisement
    let currentMacd = null, previousMacd = null, previousMacd2 = null;
    let currentSignal = null, previousSignal = null, previousSignal2 = null;
    
    // Récupérer les 3 dernières valeurs MACD
    for (let i = macdArray.length - 1; i >= 0; i--) {
        if (macdArray[i] !== null) {
            if (currentMacd === null) {
                currentMacd = macdArray[i];
            } else if (previousMacd === null) {
                previousMacd = macdArray[i];
            } else if (previousMacd2 === null) {
                previousMacd2 = macdArray[i];
                break;
            }
        }
    }
    
    // Récupérer les 3 dernières valeurs Signal
    for (let i = signalArray.length - 1; i >= 0; i--) {
        if (signalArray[i] !== null) {
            if (currentSignal === null) {
                currentSignal = signalArray[i];
            } else if (previousSignal === null) {
                previousSignal = signalArray[i];
            } else if (previousSignal2 === null) {
                previousSignal2 = signalArray[i];
                break;
            }
        }
    }
    
    // Vérifier qu'on a toutes les valeurs nécessaires
    if (currentMacd === null || previousMacd === null || previousMacd2 === null ||
        currentSignal === null || previousSignal === null || previousSignal2 === null) {
        return { macd: currentMacd, signal: currentSignal, histogram: null, crossover: false };
    }
    
    const currentHistogram = currentMacd - currentSignal;
    const previousHistogram = previousMacd - previousSignal;
    const previousHistogram2 = previousMacd2 - previousSignal2;
    
    // CROISEMENT HAUSSIER STRICT :
    // 1. Les 2 périodes précédentes MACD était SOUS Signal (confirmation tendance baissière)
    // 2. Période précédente : MACD encore SOUS Signal
    // 3. Période actuelle : MACD CROISE AU-DESSUS de Signal
    // 4. Histogram passe de négatif à positif
    const strictCrossover = 
        (previousMacd2 < previousSignal2) &&     // Il y a 2 périodes : MACD < Signal
        (previousMacd < previousSignal) &&       // Période précédente : MACD < Signal  
        (currentMacd > currentSignal) &&         // Maintenant : MACD > Signal
        (previousHistogram < 0) &&               // Histogram était négatif
        (currentHistogram > 0) &&                // Histogram devient positif
        (currentHistogram > previousHistogram);  // Histogram s'améliore
    
    return {
        macd: currentMacd,
        signal: currentSignal,
        histogram: currentHistogram,
        crossover: strictCrossover,
        macdArray: macdArray,
        signalArray: signalArray,
        // Debug info
        previousMacd: previousMacd,
        previousMacd2: previousMacd2,
        previousSignal: previousSignal,
        previousSignal2: previousSignal2,
        previousHistogram: previousHistogram,
        previousHistogram2: previousHistogram2
    };
}

async function analyzePairMACD(symbol) {
    try {
        // Augmenter le nombre de bougies pour un calcul plus précis
        const klines = await getKlineData(symbol, 150); // 150 bougies au lieu de 100
        
        if (klines.length < 80) {
            return { symbol, signal: 'HOLD', strength: 0, reason: 'Données insuffisantes' };
        }
        
        const closePrices = klines.map(k => k.close);
        const currentPrice = closePrices[closePrices.length - 1];
        const volume24h = klines.slice(-288).reduce((sum, k) => sum + k.volume, 0);
        
        const macdData = calculateMACD(closePrices);
        
        let macdSignal = 'HOLD';
        let signalStrength = 0;
        let reason = '';
        
        if (macdData.macd === null || macdData.signal === null) {
            reason = `⏳ Calcul MACD en cours... Données insuffisantes pour ${symbol}`;
        } else if (macdData.crossover && macdData.histogram > 0) {
            macdSignal = 'BUY';
            signalStrength = Math.abs(macdData.histogram) * 1000;
            reason = `🔥 CROISEMENT HAUSSIER STRICT CONFIRMÉ! 
                     MACD: ${macdData.macd.toFixed(6)} > Signal: ${macdData.signal.toFixed(6)} 
                     | Histogram: ${macdData.histogram.toFixed(6)} 
                     | Prev MACD: ${macdData.previousMacd.toFixed(6)} < Prev Signal: ${macdData.previousSignal.toFixed(6)}`;
        } else if (macdData.macd > macdData.signal) {
            reason = `📈 MACD au-dessus Signal mais PAS de croisement récent. MACD: ${macdData.macd.toFixed(6)}, Signal: ${macdData.signal.toFixed(6)}`;
        } else {
            reason = `📊 MACD en dessous Signal. MACD: ${macdData.macd.toFixed(6)}, Signal: ${macdData.signal.toFixed(6)}`;
        }
        
        return {
            symbol,
            signal: macdSignal,
            strength: signalStrength,
            price: currentPrice,
            volume24h: volume24h,
            macd: macdData.macd,
            macdSignal: macdData.signal,
            histogram: macdData.histogram,
            crossover: macdData.crossover,
            reason: reason,
            // Debug data
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
        log(`❌ ERREUR ANALYSE ${symbol}: ${error.message}`, 'ERROR');
        console.error(`Erreur analyse MACD ${symbol}:`, error);
        return { symbol, signal: 'HOLD', strength: 0, reason: `Erreur: ${error.message}` };
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
    // Vérifications préalables
    if (hasOpenPosition(symbol)) {
        log(`⚠️ Position déjà ouverte sur ${symbol}`, 'WARNING');
        return false;
    }
    
    // NEW: Vérifier le cooldown
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
        
        // NEW: Ajouter immédiatement au cooldown
        addPairToCooldown(symbol);
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const initialStopPrice = analysis.price * 0.99;
        
        const stopLossData = {
            planType: "normal_plan",
            symbol: symbol,
            productType: "USDT-FUTURES",
            marginMode: "isolated",
            marginCoin: "USDT",
            size: quantity,
            triggerPrice: initialStopPrice.toString(),
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
        });
        
        openPositions = openPositions.filter(localPos => 
            apiSymbols.includes(localPos.symbol)
        );
        
        updatePositionsDisplay();
    }
    
    return apiPositions;
}

async function manageTrailingStops() {
    if (!botRunning || openPositions.length === 0) return;
    
    try {
        log('🔍 Vérification stop loss trailing...', 'DEBUG');
        
        const apiPositions = await syncLocalPositions();
        
        for (const position of openPositions) {
            if (!position.stopLossId) {
                log(`⚠️ ${position.symbol}: Pas de stop loss configuré`, 'WARNING');
                continue;
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
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="${pnlClass}">${pnlDisplay}</span>
                    <button class="btn-close-position" onclick="closePosition('${position.symbol}')" title="Fermer cette position">
                        ❌ Fermer
                    </button>
                </div>
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

// Improved function to check if positions were manually closed on Bitget
async function checkPositionsStatus() {
    if (openPositions.length === 0) return;
    
    try {
        // Récupérer les positions actives depuis l'API Bitget
        const result = await makeRequest('/bitget/api/v2/mix/position/all-position?productType=USDT-FUTURES');
        
        if (result && result.code === '00000' && result.data) {
            const apiPositions = result.data.filter(pos => parseFloat(pos.total) > 0);
            const currentSymbols = apiPositions.map(pos => pos.symbol);
            
            // Détecter les positions fermées manuellement
            const closedPositions = openPositions.filter(localPos => 
                !currentSymbols.includes(localPos.symbol)
            );
            
            // Si des positions ont été fermées manuellement
            if (closedPositions.length > 0) {
                for (const closedPos of closedPositions) {
                    log(`🔚 Position fermée MANUELLEMENT détectée: ${closedPos.symbol}`, 'WARNING');
                    log(`💰 ${closedPos.symbol} fermée par l'utilisateur sur Bitget`, 'INFO');
                    
                    // Annuler le stop loss associé si il existe encore
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
                
                // Supprimer les positions fermées de la liste locale
                openPositions = openPositions.filter(localPos => 
                    currentSymbols.includes(localPos.symbol)
                );
                
                updatePositionsDisplay();
                await refreshBalance();
                
                log(`📊 ${closedPositions.length} position(s) fermée(s) manuellement - Synchronisation effectuée`, 'SUCCESS');
                log(`🔄 Bot peut maintenant analyser à nouveau ces paires`, 'INFO');
            }
            
            // Mettre à jour les PnL des positions restantes
            for (const localPos of openPositions) {
                const apiPos = apiPositions.find(pos => pos.symbol === localPos.symbol);
                if (apiPos) {
                    localPos.currentPrice = parseFloat(apiPos.markPrice);
                    localPos.unrealizedPnL = parseFloat(apiPos.unrealizedPL || 0);
                    localPos.pnlPercentage = ((localPos.currentPrice - localPos.entryPrice) / localPos.entryPrice) * 100;
                    
                    // Mettre à jour le prix le plus haut pour le trailing stop
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

// Close a position manually with confirmation
async function closePosition(symbol) {
    const position = openPositions.find(pos => pos.symbol === symbol);
    if (!position) {
        log(`❌ Position ${symbol} introuvable`, 'ERROR');
        return;
    }
    
    const confirmation = confirm(`Voulez-vous vraiment fermer la position ${symbol} ?\n\nPnL actuel: ${position.unrealizedPnL ? position.unrealizedPnL.toFixed(2) : '--'} USDT\nEntry: ${position.entryPrice.toFixed(4)}\nCurrent: ${position.currentPrice ? position.currentPrice.toFixed(4) : '--'}`);
    
    if (!confirmation) {
        log(`🚫 Fermeture position ${symbol} annulée par l'utilisateur`, 'INFO');
        return;
    }
    
    try {
        log(`🔄 Fermeture position ${symbol}...`, 'INFO');
        
        // Obtenir la taille exacte de la position depuis l'API
        const positionResult = await makeRequest('/bitget/api/v2/mix/position/all-position?productType=USDT-FUTURES');
        let exactSize = position.quantity;
        
        if (positionResult && positionResult.code === '00000' && positionResult.data) {
            const apiPosition = positionResult.data.find(pos => pos.symbol === symbol && parseFloat(pos.total) > 0);
            if (apiPosition) {
                exactSize = Math.abs(parseFloat(apiPosition.total));
            }
        }
        
        // Fermer la position avec un ordre market opposé
        const closeOrderData = {
            symbol: symbol,
            productType: "USDT-FUTURES",
            marginMode: "crossed",
            marginCoin: "USDT",
            size: exactSize.toString(),
            side: position.side === 'long' ? 'sell' : 'buy', // Ordre opposé pour fermer
            orderType: "market",
            timeInForceValue: "normal",
            reduceOnly: true
        };
        
        const closeResult = await makeRequest('/bitget/api/v2/mix/order/place-order', {
            method: 'POST',
            body: JSON.stringify(closeOrderData)
        });
        
        if (closeResult && closeResult.code === '00000') {
            log(`✅ ${symbol}: Ordre de fermeture passé avec succès`, 'SUCCESS');
            log(`📤 Ordre ID: ${closeResult.data.orderId}`, 'INFO');
            
            // Annuler le stop loss associé
            if (position.stopLossId) {
                try {
                    const cancelResult = await makeRequest('/bitget/api/v2/mix/order/cancel-plan-order', {
                        method: 'POST',
                        body: JSON.stringify({
                            symbol: symbol,
                            productType: "USDT-FUTURES",
                            marginCoin: "USDT",
                            orderId: position.stopLossId
                        })
                    });
                    
                    if (cancelResult && cancelResult.code === '00000') {
                        log(`✅ Stop Loss ${symbol} annulé automatiquement`, 'SUCCESS');
                    }
                } catch (error) {
                    log(`⚠️ Erreur annulation stop loss ${symbol}: ${error.message}`, 'WARNING');
                }
            }
            
            // Supprimer la position de la liste locale
            const positionIndex = openPositions.findIndex(pos => pos.symbol === symbol);
            if (positionIndex > -1) {
                openPositions.splice(positionIndex, 1);
            }
            
            // Supprimer le cooldown
            if (pairCooldowns[symbol]) {
                delete pairCooldowns[symbol];
                log(`🔄 Cooldown ${symbol} supprimé - Analyse autorisée immédiatement`, 'INFO');
            }
            
            updatePositionsDisplay();
            await refreshBalance();
            
            log(`💰 Position ${symbol} fermée avec succès par l'utilisateur`, 'SUCCESS');
            
        } else {
            const errorMsg = closeResult?.msg || 'Erreur inconnue lors de la fermeture';
            log(`❌ Erreur fermeture ${symbol}: ${errorMsg}`, 'ERROR');
            alert(`Erreur lors de la fermeture de ${symbol}:\n${errorMsg}`);
        }
        
    } catch (error) {
        log(`❌ Erreur critique fermeture ${symbol}: ${error.message}`, 'ERROR');
        alert(`Erreur critique lors de la fermeture de ${symbol}:\n${error.message}`);
    }
}

