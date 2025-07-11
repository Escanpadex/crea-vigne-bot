// Trading Functions - MACD Strategy & Position Management
console.log('📁 Loading trading.js...');
console.log('Assuming utils.js is loaded: using shared MACD functions');

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
        
        let finalStopLossId = null;
        let stopLossCreated = false;
        
        if (stopLossResult && stopLossResult.code === '00000') {
            finalStopLossId = stopLossResult.data.orderId;
            stopLossCreated = true;
            log(`✅ Stop Loss initial créé: ${symbol} @ ${initialStopPrice.toFixed(4)} (-1%)`, 'SUCCESS');
            log(`🆔 Stop Loss ID: ${finalStopLossId}`, 'INFO');
        } else {
            log(`❌ ÉCHEC stop loss initial ${symbol}: ${stopLossResult?.msg || 'Erreur API'}`, 'ERROR');
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
                log(`Synchronisation des positions effectuée`);
            }
        }
    } catch (error) {
        log(`❌ Erreur vérification status positions: ${error.message}`, 'ERROR');
    }
}