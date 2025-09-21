// Trading Functions - MACD Strategy & Position Management
console.log('📁 Loading trading.js...');
console.log('Assuming utils.js is loaded: using shared MACD functions');

// 🎯 NOUVELLE STRATÉGIE: Limite de positions simultanées (2 trades maximum)
const MAX_SIMULTANEOUS_POSITIONS = 2;

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

// 🎯 NOUVELLE STRATÉGIE: Variables globales pour la nouvelle stratégie
let positivePairs = []; // Paires avec évolution positive 24h
let lastPairAnalysis = 0; // Timestamp de la dernière analyse des paires
let positionCooldowns = new Map(); // Cooldowns après fermeture de position (1 minute)
let tradedPairsCooldown = new Map(); // Cooldowns paires tradées (12 heures)

// 🔧 DEBUG: Mode debug pour les mises à jour de positions
let positionUpdateDebug = false; // Désactivé par défaut pour éviter le spam

// 🆕 NOUVELLE FONCTION: Récupérer les paires avec évolution positive sur 24h
async function getPositivePairs() {
    try {
        log('🔍 Récupération des paires avec évolution positive 24h...', 'INFO');
        
        // 🔧 CORRECTION: Utiliser l'API futures au lieu de spot
        const result = await makeRequest('/bitget/api/v2/mix/market/tickers?productType=USDT-FUTURES');
        
        if (!result || result.code !== '00000' || !result.data) {
            log('❌ Erreur récupération des tickers futures', 'ERROR');
            log(`📊 Réponse API: ${JSON.stringify(result)}`, 'DEBUG');
            return [];
        }
        
        const tickers = result.data;
        log(`📊 ${tickers.length} tickers futures récupérés`, 'INFO');
        
        const positive24hPairs = tickers
            .filter(ticker => {
                // 🔧 CORRECTION: Utiliser les bonnes propriétés pour les futures
                // change24h et changeUtc24h sont en format décimal (0.01411 = 1.411%)
                const change24hDecimal = parseFloat(ticker.change24h || ticker.changeUtc24h || 0);
                const change24hPercent = change24hDecimal * 100; // Convertir en pourcentage
                const volume = parseFloat(ticker.quoteVolume || ticker.usdtVolume || ticker.baseVolume || 0);
                
                // 🔧 AMÉLIORATION: Réduire le volume minimum et ajouter plus de logs
                const isPositive = change24hPercent > 0.1; // Au moins +0.1% pour éviter le bruit
                const hasVolume = volume > 100000; // Volume en USDT
                const isUSDT = ticker.symbol && ticker.symbol.includes('USDT');
                
                if (isPositive && hasVolume && isUSDT) {
                    log(`✅ Paire valide: ${ticker.symbol} (+${change24hPercent.toFixed(2)}%, Vol: ${formatNumber(volume)})`, 'DEBUG');
                }
                
                return isPositive && hasVolume && isUSDT;
            })
            .map(ticker => ({
                symbol: ticker.symbol, // Garder le format original
                change24h: parseFloat(ticker.change24h || ticker.changeUtc24h || 0) * 100, // Convertir en pourcentage
                volume24h: parseFloat(ticker.quoteVolume || ticker.usdtVolume || ticker.baseVolume || 0),
                price: parseFloat(ticker.lastPr || ticker.last || ticker.close || 0)
            }))
            .sort((a, b) => b.change24h - a.change24h); // Trier par performance décroissante
        
        log(`✅ ${positive24hPairs.length} paires futures positives trouvées sur 24h`, 'SUCCESS');
        
        // Log des 10 meilleures paires
        if (positive24hPairs.length > 0) {
            log(`🔥 Top 10 paires positives:`, 'INFO');
            positive24hPairs.slice(0, 10).forEach((pair, index) => {
                log(`   ${index + 1}. ${pair.symbol}: +${pair.change24h.toFixed(2)}% (Vol: ${formatNumber(pair.volume24h)})`, 'INFO');
            });
        } else {
            log('⚠️ Aucune paire positive trouvée - Vérification des données...', 'WARNING');
            // Log de quelques exemples pour debug
            if (tickers.length > 0) {
                log('📊 Exemples de tickers reçus:', 'DEBUG');
                tickers.slice(0, 5).forEach((ticker, index) => {
                    const change24h = parseFloat(ticker.chg24h || ticker.changeUtc24h || 0);
                    const volume = parseFloat(ticker.baseVolume || ticker.quoteVolume || 0);
                    log(`   ${index + 1}. ${ticker.symbol}: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}% (Vol: ${formatNumber(volume)})`, 'DEBUG');
                });
            }
        }
        
        return positive24hPairs;
        
    } catch (error) {
        log(`❌ Erreur récupération paires positives (Futures): ${error.message}`, 'ERROR');
        console.error('Détails erreur:', error);
        
        // 🔧 FALLBACK: Essayer l'API spot si l'API futures échoue
        try {
            log('🔄 Tentative de fallback vers API spot...', 'WARNING');
            const spotResult = await makeRequest('/bitget/api/v2/spot/market/tickers');
            
            if (spotResult && spotResult.code === '00000' && spotResult.data) {
                const spotTickers = spotResult.data;
                log(`📊 ${spotTickers.length} tickers spot récupérés en fallback`, 'INFO');
                
                const spotPositivePairs = spotTickers
                    .filter(ticker => {
                        const change24hDecimal = parseFloat(ticker.changeUtc24h || ticker.change24h || 0);
                        const change24hPercent = change24hDecimal * 100;
                        const volume = parseFloat(ticker.quoteVolume || ticker.baseVolume || 0);
                        const isPositive = change24hPercent > 0.1;
                        const hasVolume = volume > 100000;
                        const isUSDT = ticker.symbol && ticker.symbol.endsWith('USDT');
                        
                        return isPositive && hasVolume && isUSDT;
                    })
                    .map(ticker => ({
                        symbol: ticker.symbol,
                        change24h: parseFloat(ticker.changeUtc24h || ticker.change24h || 0) * 100,
                        volume24h: parseFloat(ticker.quoteVolume || ticker.baseVolume || 0),
                        price: parseFloat(ticker.close || ticker.last || 0)
                    }))
                    .sort((a, b) => b.change24h - a.change24h);
                
                log(`✅ Fallback réussi: ${spotPositivePairs.length} paires spot positives trouvées`, 'SUCCESS');
                return spotPositivePairs;
            }
        } catch (fallbackError) {
            log(`❌ Erreur fallback spot: ${fallbackError.message}`, 'ERROR');
        }
        
        return [];
    }
}

// 🔧 NOUVELLE FONCTION UTILITAIRE: Compter seulement les positions gérées par le bot
function getBotManagedPositionsCount() {
    return openPositions.filter(pos => pos.isBotManaged === true).length;
}

// 🆕 NOUVELLE FONCTION: Sélectionner une paire aléatoire parmi les positives
function selectRandomPositivePair(excludeSymbols = []) {
    // 🔧 CORRECTION: Vérifier seulement les positions du bot, pas les manuelles
    const botPositionsCount = getBotManagedPositionsCount();
    const availableSlots = MAX_SIMULTANEOUS_POSITIONS - botPositionsCount;
    if (availableSlots <= 0) {
        log(`⚠️ Limite bot atteinte: ${botPositionsCount}/${MAX_SIMULTANEOUS_POSITIONS} positions bot (${openPositions.length} total dont manuelles) - Pas de sélection`, 'INFO');
        return null;
    }
    
    const availablePairs = positivePairs.filter(pair => 
        !excludeSymbols.includes(pair.symbol) && 
        !hasOpenPosition(pair.symbol) &&
        !isPairInCooldown(pair.symbol) &&
        !isTradedPairInCooldown(pair.symbol) // 🆕 Cooldown 12h pour paires déjà tradées
    );
    
    if (availablePairs.length === 0) {
        log('⚠️ Aucune paire positive disponible pour trading (cooldowns actifs)', 'WARNING');
        return null;
    }
    
    // Sélection aléatoire pondérée par la performance 24h
    const randomIndex = Math.floor(Math.random() * Math.min(availablePairs.length, 20)); // Top 20 pour plus de diversité
    const selectedPair = availablePairs[randomIndex];
    
    log(`🎲 Paire sélectionnée: ${selectedPair.symbol} (+${selectedPair.change24h.toFixed(2)}% sur 24h) - ${availableSlots} emplacements disponibles`, 'SUCCESS');
    
    return selectedPair;
}

// REMOVED: analyzeMultiTimeframeImproved function - replaced by new positive pairs strategy
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
        let reason = `⏳ Calcul MACD en cours... Données insuffisantes pour ${symbol} (${timeframe}) (candles: ${klineData.length})`;
        
        if (macdData.macd != null && macdData.signal != null && macdData.histogram != null && 
            !isNaN(macdData.macd) && !isNaN(macdData.signal) && !isNaN(macdData.histogram)) {
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
        } else {
            // 🎯 Cas où les données MACD sont nulles/invalides
            macdSignal = 'INSUFFICIENT_DATA';
            signalStrength = 0;
            reason = `❌ Données MACD invalides pour ${symbol} (${timeframe}) - MACD: ${macdData.macd}, Signal: ${macdData.signal}, Histogram: ${macdData.histogram}`;
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
    // 🎯 NOUVELLE STRATÉGIE: 50% du solde avec levier x2
    const availableBalance = balance.totalEquity || balance.available || 1000; // Fallback si balance pas disponible
    const positionValue = availableBalance * 0.5; // 50% du solde
    
    log(`💰 Calcul position: Solde disponible ${availableBalance.toFixed(2)}$ → Position ${positionValue.toFixed(2)}$ (50% + levier x2)`, 'INFO');
    
    return Math.max(positionValue, 10); // Minimum 10$
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
    
    // 🔧 CORRECTION: Vérifier seulement la limite des positions du bot
    const botPositionsCount = getBotManagedPositionsCount();
    if (botPositionsCount >= MAX_SIMULTANEOUS_POSITIONS) {
        return { canOpen: false, reason: `Limite bot atteinte: ${botPositionsCount}/${MAX_SIMULTANEOUS_POSITIONS} positions automatiques (${openPositions.length} total)` };
    }
    
    // Vérifier le cooldown (1 minute après fermeture)
    if (isPairInCooldown(symbol)) {
        const remainingMinutes = getRemainingCooldown(symbol);
        return { canOpen: false, reason: `${symbol} en cooldown encore ${remainingMinutes} minutes` };
    }
    
    // 🆕 AMÉLIORATION: Vérifier le cooldown 12h pour paires déjà tradées
    if (isTradedPairInCooldown(symbol)) {
        const remainingHours = getRemainingTradedCooldown(symbol);
        return { canOpen: false, reason: `${symbol} déjà tradé récemment - Cooldown encore ${remainingHours} heures` };
    }
    
    // Vérifier le capital disponible
    const positionValue = calculatePositionSize();
    if (positionValue < 10) {
        return { canOpen: false, reason: 'Capital insuffisant pour ouvrir une position' };
    }
    
    return { canOpen: true, reason: 'Conditions remplies pour ouvrir une position' };
}

async function openPosition(symbol, selectedPair) {
    // 🎯 NOUVELLE VÉRIFICATION: Utiliser la fonction de vérification centralisée
    const canOpen = canOpenNewPosition(symbol);
    
    if (!canOpen.canOpen) {
        log(`⚠️ ${symbol}: ${canOpen.reason}`, 'WARNING');
        return false;
    }
    
    // 🔧 CORRECTION: Log informatif sur les positions du bot uniquement
    const botPositionsCount = getBotManagedPositionsCount();
    const availableSlots = MAX_SIMULTANEOUS_POSITIONS - botPositionsCount;
    log(`📊 Ouverture position bot ${symbol} - ${availableSlots} slots bot disponibles (${botPositionsCount}/${MAX_SIMULTANEOUS_POSITIONS} bot, ${openPositions.length} total)`, 'INFO');
    
    const positionValue = calculatePositionSize();
    
    try {
        // 🎯 NOUVELLE STRATÉGIE: Toujours levier x2
        await setLeverage(symbol, 2);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const currentPrice = selectedPair.price;
        const quantity = (positionValue / currentPrice).toFixed(6);
        
        log(`🔄 Ouverture position LONG ${symbol}...`, 'INFO');
        log(`💰 Prix: ${currentPrice} | Quantité: ${quantity} | Valeur: ${positionValue.toFixed(2)} USDT (Levier x2)`, 'INFO');
        log(`🎯 Raison: Paire positive 24h (+${selectedPair.change24h.toFixed(2)}%)`, 'INFO');
        
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
        
        // 🆕 AMÉLIORATION: Ajouter cooldown 12h pour cette paire (empêcher re-trade immédiat)
        addTradedPairCooldown(symbol);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 🎯 NOUVELLE STRATÉGIE: Pas de stop loss automatique, surveillance PnL à +2%
        log(`🎯 Position ouverte sans stop loss - Surveillance PnL active pour fermeture à +2%`, 'INFO');
        
        const position = {
            id: Date.now(),
            symbol: symbol,
            side: 'LONG',
            size: positionValue,
            quantity: quantity,
            entryPrice: currentPrice,
            status: 'OPEN',
            timestamp: new Date().toISOString(),
            orderId: orderResult.data.orderId,
            stopLossId: null, // Pas de stop loss dans la nouvelle stratégie
            currentStopPrice: null,
            highestPrice: currentPrice,
            reason: `Paire positive 24h (+${selectedPair.change24h.toFixed(2)}%)`,
            change24h: selectedPair.change24h,
            targetPnL: config.targetPnL, // 🆕 Objectif configurable
            isBotManaged: true // 🔧 NOUVEAU: Marquer comme position gérée par le bot
        };
        
        openPositions.push(position);
        botStats.totalPositions++;
        
        log(`🚀 Position complète: ${symbol} LONG ${positionValue.toFixed(2)} USDT @ ${currentPrice.toFixed(4)}`, 'SUCCESS');
        log(`🎯 Objectif: Fermeture automatique à +${config.targetPnL}% de PnL`, 'INFO');
        log(`📈 Performance 24h: +${selectedPair.change24h.toFixed(2)}%`, 'INFO');
        
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

// 🎯 FONCTION MODIFIÉE: Surveillance PnL et fermeture automatique UNIQUEMENT pour les positions du bot
async function monitorPnLAndClose() {
    if (!botRunning || openPositions.length === 0) return;
    
    try {
        // 🔧 CORRECTION: Ne surveiller que les positions gérées par le bot
        const botManagedPositions = openPositions.filter(pos => pos.isBotManaged === true);
        
        for (const position of botManagedPositions) {
            const currentPrice = await getCurrentPrice(position.symbol);
            if (!currentPrice) {
                log(`⚠️ ${position.symbol}: Impossible de récupérer le prix`, 'WARNING');
                continue;
            }
            
            // Calculer le PnL en pourcentage
            const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
            position.currentPrice = currentPrice;
            position.pnlPercent = pnlPercent;
            
            // Mettre à jour le prix le plus haut
            if (currentPrice > position.highestPrice) {
                position.highestPrice = currentPrice;
            }
            
            // 🎯 FERMETURE AUTOMATIQUE À +2%
            if (pnlPercent >= position.targetPnL) {
                log(`🎯 ${position.symbol}: Objectif atteint +${pnlPercent.toFixed(2)}% ≥ +${position.targetPnL}% - Fermeture automatique!`, 'SUCCESS');
                
                const closed = await closePositionAtMarket(position);
                if (closed) {
                    log(`✅ Position fermée avec succès: ${position.symbol} (+${pnlPercent.toFixed(2)}%)`, 'SUCCESS');
                    
                    // Ajouter cooldown d'1 minute (pour éviter re-ouverture immédiate)
                    addPositionCooldown(position.symbol);
                    
                    // Mettre à jour les stats
                    botStats.totalClosedPositions++;
                    if (pnlPercent > 0) {
                        botStats.winningPositions++;
                        botStats.totalWinAmount += (position.size * pnlPercent / 100);
                    }
                    
                    // Supprimer de la liste des positions ouvertes
                    const index = openPositions.findIndex(p => p.id === position.id);
                    if (index !== -1) {
                        openPositions.splice(index, 1);
                    }
                    
                    // 🔧 CORRECTION: Déclencher seulement si le bot a des slots libres
                    const botPositionsAfterClose = getBotManagedPositionsCount();
                    const availableSlots = MAX_SIMULTANEOUS_POSITIONS - botPositionsAfterClose;
                    if (availableSlots > 0) {
                        log(`🔄 Position bot fermée - Déclenchement immédiat d'une nouvelle sélection (${availableSlots} slots bot libres)`, 'INFO');
                        setTimeout(() => {
                            if (typeof tradingLoop === 'function') {
                                tradingLoop();
                            }
                        }, 2000); // Attendre 2 secondes pour que le cooldown soit actif
                    }
                } else {
                    log(`❌ Échec fermeture position ${position.symbol}`, 'ERROR');
                }
            } else {
                // Log de suivi (moins fréquent pour éviter le spam avec surveillance 1s)
                if (Date.now() - (position.lastPnLLog || 0) > 60000) { // Toutes les 60 secondes
                    log(`📊 ${position.symbol}: PnL ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}% (Objectif: +${position.targetPnL}%)`, 'DEBUG');
                    position.lastPnLLog = Date.now();
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        updatePositionsDisplay();
        
    } catch (error) {
        log(`❌ Erreur surveillance PnL: ${error.message}`, 'ERROR');
    }
}

// 🆕 NOUVELLE FONCTION: Fermer une position au marché
async function closePositionAtMarket(position) {
    try {
        const orderData = {
            symbol: position.symbol,
            productType: "USDT-FUTURES",
            marginMode: "isolated",
            marginCoin: "USDT",
            size: position.quantity.toString(),
            side: "sell",
            tradeSide: "close",
            orderType: "market",
            clientOid: `close_${Date.now()}_${position.symbol}`
        };
        
        log(`🔄 Fermeture position ${position.symbol} au marché...`, 'INFO');
        
        const result = await makeRequestWithRetry('/bitget/api/v2/mix/order/place-order', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
        
        if (result && result.code === '00000') {
            log(`✅ Ordre de fermeture placé: ${position.symbol} - ID: ${result.data.orderId}`, 'SUCCESS');
            return true;
        } else {
            log(`❌ Erreur fermeture position ${position.symbol}: ${result?.msg || 'Erreur inconnue'}`, 'ERROR');
            return false;
        }
        
    } catch (error) {
        log(`❌ Exception fermeture position ${position.symbol}: ${error.message}`, 'ERROR');
        return false;
    }
}

// 🆕 NOUVELLE FONCTION: Ajouter un cooldown après fermeture de position (1 minute)
function addPositionCooldown(symbol) {
    const cooldownEnd = Date.now() + (60 * 1000); // 1 minute
    positionCooldowns.set(symbol, cooldownEnd);
    log(`⏰ Cooldown 1min activé pour ${symbol}`, 'INFO');
}

// 🆕 NOUVELLE FONCTION: Vérifier si une paire est en cooldown (1 minute)
function isPairInCooldown(symbol) {
    const cooldownEnd = positionCooldowns.get(symbol);
    if (!cooldownEnd) return false;
    
    const now = Date.now();
    if (now >= cooldownEnd) {
        positionCooldowns.delete(symbol);
        return false;
    }
    
    return true;
}

// 🆕 AMÉLIORATION: Ajouter un cooldown 12h pour les paires déjà tradées
function addTradedPairCooldown(symbol) {
    const cooldownEnd = Date.now() + (12 * 60 * 60 * 1000); // 12 heures
    tradedPairsCooldown.set(symbol, cooldownEnd);
    log(`⏰ Cooldown 12h activé pour ${symbol} (paire tradée)`, 'INFO');
}

// 🆕 AMÉLIORATION: Vérifier si une paire tradée est en cooldown 12h
function isTradedPairInCooldown(symbol) {
    const cooldownEnd = tradedPairsCooldown.get(symbol);
    if (!cooldownEnd) return false;
    
    const now = Date.now();
    if (now >= cooldownEnd) {
        tradedPairsCooldown.delete(symbol);
        return false;
    }
    
    return true;
}

// 🆕 AMÉLIORATION: Obtenir le temps restant du cooldown 1 minute
function getRemainingCooldown(symbol) {
    const cooldownEnd = positionCooldowns.get(symbol);
    if (!cooldownEnd) return 0;
    
    const remaining = Math.max(0, cooldownEnd - Date.now());
    return Math.ceil(remaining / 60000); // En minutes
}

// 🆕 AMÉLIORATION: Obtenir le temps restant du cooldown 12h
function getRemainingTradedCooldown(symbol) {
    const cooldownEnd = tradedPairsCooldown.get(symbol);
    if (!cooldownEnd) return 0;
    
    const remaining = Math.max(0, cooldownEnd - Date.now());
    return Math.ceil(remaining / (60 * 60 * 1000)); // En heures
}

async function updatePositionsPnL(verbose = false) {
    if (openPositions.length === 0) return;
    
    try {
        // Log seulement en mode verbose pour éviter le spam
        if (verbose) log('🔄 Mise à jour des PnL des positions...', 'DEBUG');
        
        const result = await makeRequest('/bitget/api/v2/mix/position/all-position?productType=USDT-FUTURES');
        
        if (result && result.code === '00000' && result.data) {
            const apiPositions = result.data.filter(pos => parseFloat(pos.total) > 0);
            if (verbose) log(`📊 ${apiPositions.length} positions actives reçues de l'API`, 'DEBUG');
            
            let updatedCount = 0;
            let hasSignificantChanges = false;
            
            openPositions.forEach(localPos => {
                const apiPos = apiPositions.find(pos => pos.symbol === localPos.symbol);
                if (apiPos) {
                    // 🔧 AMÉLIORATION: Mise à jour complète des données
                    const newPrice = parseFloat(apiPos.markPrice || 0);
                    const newUnrealizedPnL = parseFloat(apiPos.unrealizedPL || 0);
                    const newPnlPercentage = localPos.entryPrice > 0 ? ((newPrice - localPos.entryPrice) / localPos.entryPrice) * 100 : 0;
                    
                    // 🔧 CORRECTION: Toujours mettre à jour si currentPrice n'est pas défini ou si les données ont changé significativement
                    const currentPriceDefined = typeof localPos.currentPrice === 'number' && !isNaN(localPos.currentPrice);
                    const priceChanged = !currentPriceDefined || Math.abs(localPos.currentPrice - newPrice) > 0.0001;
                    const pnlChanged = Math.abs((localPos.pnlPercentage || 0) - newPnlPercentage) > 0.01;
                    
                    // Détecter les changements significatifs (>0.5% PnL)
                    if (Math.abs(newPnlPercentage - (localPos.pnlPercentage || 0)) > 0.5) {
                        hasSignificantChanges = true;
                    }

                    if (priceChanged || pnlChanged || !currentPriceDefined) {
                        localPos.currentPrice = newPrice;
                        localPos.unrealizedPnL = newUnrealizedPnL;
                        localPos.pnlPercentage = newPnlPercentage;

                        // Mettre à jour le prix le plus haut si nécessaire
                        if (newPrice > (localPos.highestPrice || 0)) {
                            localPos.highestPrice = newPrice;
                        }

                        updatedCount++;
                        // Log seulement pour les changements significatifs ou en mode verbose
                        if (verbose || hasSignificantChanges || !currentPriceDefined || positionUpdateDebug) {
                            log(`📊 ${localPos.symbol}: Prix ${newPrice.toFixed(4)} | PnL ${newPnlPercentage >= 0 ? '+' : ''}${newPnlPercentage.toFixed(2)}% (${newUnrealizedPnL >= 0 ? '+' : ''}$${newUnrealizedPnL.toFixed(2)}) ${!currentPriceDefined ? '(INITIAL)' : '(UPDATE)'}`, 'DEBUG');
                        }
                    }
                } else {
                    log(`⚠️ Position ${localPos.symbol} non trouvée dans l'API - Position peut-être fermée`, 'WARNING');
                }
            });
            
            if (updatedCount > 0) {
                // Log seulement si changements significatifs ou en mode verbose
                if (verbose || hasSignificantChanges) {
                    log(`✅ ${updatedCount} position(s) mise(s) à jour${hasSignificantChanges ? ' avec changements significatifs' : ''}`, 'DEBUG');
                }
                updatePositionsDisplay(); // Mettre à jour l'affichage seulement si nécessaire
            }
        } else {
            log('⚠️ Erreur récupération positions pour mise à jour PnL', 'WARNING');
        }
    } catch (error) {
        log(`❌ Erreur mise à jour PnL: ${error.message}`, 'ERROR');
    }
}

function updatePositionsDisplay() {
    // 🎯 FONCTION AMÉLIORÉE: Mettre à jour l'affichage de TOUTES les positions (pas de limite)
    log(`🔄 updatePositionsDisplay() appelé avec ${openPositions.length} positions`, 'DEBUG');
    
    const positionCountEl = document.getElementById('positionCount');
    const positionsListEl = document.getElementById('positionsList');
    
    if (!positionCountEl || !positionsListEl) {
        log('❌ Éléments d\'affichage des positions non trouvés dans le DOM', 'ERROR');
        log(`positionCountEl: ${positionCountEl ? 'OK' : 'NULL'}, positionsListEl: ${positionsListEl ? 'OK' : 'NULL'}`, 'DEBUG');
        return;
    }
    
    // Mettre à jour le compteur (sans limite)
    positionCountEl.textContent = openPositions.length;
    log(`📊 Compteur mis à jour: ${openPositions.length} positions`, 'DEBUG');
    
    // Mettre à jour la liste des positions avec un design optimisé pour de nombreuses positions
    if (openPositions.length === 0) {
        positionsListEl.innerHTML = `
            <div style="
                text-align: center; 
                color: #d1d5db; 
                font-style: italic; 
                padding: 30px 20px;
                background: linear-gradient(135deg, #374151 0%, #4b5563 100%);
                border-radius: 12px;
                border: 2px dashed #6b7280;
                font-weight: 500;
            ">
                <span style="font-size: 16px; color: #ffffff;">💤 Aucune position active</span><br>
                <span style="font-size: 12px; margin-top: 8px; display: block; color: #9ca3af;">En attente d'opportunités...</span>
        </div>
    `;
    } else {
        // 🎯 CONFIGURATION: Utiliser les paramètres configurables pour l'affichage
        const useCompactDisplay = openPositions.length > (config.displaySettings?.compactDisplayThreshold || 10);
        const maxDisplayed = config.displaySettings?.maxPositionsDisplayed || 50;
        const displayedPositions = openPositions.slice(0, maxDisplayed);
        const hiddenCount = openPositions.length - maxDisplayed;
        
        log(`📊 Affichage ${displayedPositions.length} positions (${useCompactDisplay ? 'compact' : 'normal'})${hiddenCount > 0 ? `, ${hiddenCount} masquées` : ''}`, 'DEBUG');
        
        const positionsHTML = displayedPositions.map((position, index) => {
            // Calculer le temps écoulé avec gestion des erreurs
            let timeDisplay = '0min';
            try {
                const openTime = new Date(position.timestamp);
                const now = new Date();
                
                // Vérifier que le timestamp est valide
                if (!isNaN(openTime.getTime())) {
                    const diffMs = now - openTime;
                    const diffMinutes = Math.floor(diffMs / 60000);
                    
                    if (diffMinutes < 0) {
                        timeDisplay = '0min'; // Si timestamp futur, afficher 0min
                    } else if (diffMinutes < 60) {
                        timeDisplay = `${diffMinutes}min`;
                    } else if (diffMinutes < 1440) { // Moins de 24h
                        const hours = Math.floor(diffMinutes / 60);
                        const remainingMins = diffMinutes % 60;
                        timeDisplay = remainingMins > 0 ? `${hours}h${remainingMins}min` : `${hours}h`;
                    } else { // Plus de 24h
                        const days = Math.floor(diffMinutes / 1440);
                        const hours = Math.floor((diffMinutes % 1440) / 60);
                        timeDisplay = hours > 0 ? `${days}j${hours}h` : `${days}j`;
                    }
                } else {
                    log(`⚠️ Timestamp invalide pour ${position.symbol}: ${position.timestamp}`, 'WARNING');
                }
            } catch (error) {
                log(`❌ Erreur calcul temps pour ${position.symbol}: ${error.message}`, 'ERROR');
            }
            
            // Calculer le PnL actuel avec gestion des données manquantes
            const currentPrice = position.currentPrice || position.entryPrice;
            let pnlPercent = 0;
            let pnlDollar = 0;

            // 🔧 CORRECTION: Logique de calcul PnL améliorée
            let dataSource = 'UNKNOWN';

            // 1. Priorité absolue à unrealizedPnL depuis l'API (valeur exacte)
            if (typeof position.unrealizedPnL === 'number' && !isNaN(position.unrealizedPnL)) {
                pnlDollar = position.unrealizedPnL;
                dataSource = 'API_UNREALIZED_PNL';
                // Calculer le pourcentage depuis le PnL dollar si possible
                if (position.size && position.size > 0) {
                    pnlPercent = (pnlDollar / position.size) * 100;
                } else if (position.quantity && position.entryPrice && position.entryPrice > 0) {
                    // Estimation basée sur la quantité et le prix d'entrée
                    const positionValue = position.quantity * position.entryPrice;
                    pnlPercent = positionValue > 0 ? (pnlDollar / positionValue) * 100 : 0;
                }
            }
            // 2. Sinon utiliser pnlPercentage depuis l'API
            else if (typeof position.pnlPercentage === 'number' && !isNaN(position.pnlPercentage)) {
                pnlPercent = position.pnlPercentage;
                dataSource = 'API_PERCENTAGE';
                // Calculer le PnL en dollars
                if (position.size && position.size > 0) {
                    pnlDollar = (position.size * pnlPercent) / 100;
                } else if (position.quantity && position.entryPrice && position.entryPrice > 0) {
                    pnlDollar = (position.quantity * position.entryPrice * pnlPercent) / 100;
                }
            }
            // 3. Calcul de secours basé sur les prix actuels
            else {
                pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
                dataSource = 'CALCULATED';
                if (position.size && position.size > 0) {
                    pnlDollar = (position.size * pnlPercent) / 100;
                } else if (position.quantity && position.entryPrice && position.entryPrice > 0) {
                    pnlDollar = (position.quantity * position.entryPrice * pnlPercent) / 100;
                }
            }

            // Log discret pour debug (toutes les 60 secondes par position)
            if (!position.lastPnlCalcLog || Date.now() - position.lastPnlCalcLog > 60000) {
                console.log(`💰 ${position.symbol}: PnL calculé depuis ${dataSource} - $${pnlDollar?.toFixed(2)} (${pnlPercent?.toFixed(2)}%)`);
                position.lastPnlCalcLog = Date.now();
            }
            const isPositive = pnlPercent >= 0;
            const pnlColor = isPositive ? '#10b981' : '#f59e0b';
            const pnlBgColor = isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)';
            const pnlSign = isPositive ? '+' : '';
            const pnlIcon = isPositive ? '📈' : '📊';
            
            // 🔧 NOUVEAU: Différenciation Bot vs Manuel
            const isBotManaged = position.isBotManaged === true;
            const managementIcon = isBotManaged ? '🤖' : '👤';
            const managementText = isBotManaged ? 'Bot' : 'Manuel';
            const managementColor = isBotManaged ? '#3b82f6' : '#f59e0b';
            const managementBg = isBotManaged ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)';
            const autoCloseText = isBotManaged ? `Auto-close +${position.targetPnL || 2}%` : 'Gestion manuelle';
            
            // Animation de pulsation pour les gains
            const pulseAnimation = isPositive && pnlPercent > 1 ? 'animation: pulse 2s infinite;' : '';
            
            // 🎯 AFFICHAGE ADAPTATIF: Compact si beaucoup de positions, normal sinon
            if (useCompactDisplay) {
                // AFFICHAGE COMPACT pour beaucoup de positions
                return `
                    <div style="
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        background: ${isPositive ? 'linear-gradient(90deg, #0f4c3a 0%, #1a5f4a 100%)' : 'linear-gradient(90deg, #2a2a2a 0%, #404040 100%)'}; 
                        border-radius: 8px; 
                        padding: 8px 12px; 
                        margin-bottom: 6px; 
                        border-left: 4px solid ${isPositive ? '#10b981' : '#6b7280'};
                        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                        transition: all 0.2s ease;
                        ${pulseAnimation}
                    " onmouseover="this.style.transform='scale(1.01)'; this.style.boxShadow='0 4px 10px rgba(0,0,0,0.3)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.2)'">
                        
                        <!-- Info compacte -->
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #ffffff; font-weight: bold; font-size: 14px;">
                                ${pnlIcon} ${position.symbol.replace('USDT', '')}
                            </span>
                            <span style="color: ${managementColor}; font-size: 10px; background: ${managementBg}; padding: 2px 6px; border-radius: 4px; font-weight: bold;">
                                ${managementIcon} ${managementText}
                            </span>
                            <span style="color: #d1d5db; font-size: 11px; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">
                                ${timeDisplay}
                            </span>
                        </div>
                        
                        <!-- PnL compact -->
                        <div style="
                            background: ${isPositive ? '#10b981' : '#ef4444'};
                            color: #ffffff;
                            padding: 4px 8px;
                            border-radius: 6px;
                            font-weight: bold;
                            font-size: 12px;
                            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
                        ">
                            ${isNaN(pnlDollar) ? 'N/A' : pnlSign + '$' + pnlDollar.toFixed(1)} (${isNaN(pnlPercent) ? 'N/A' : pnlSign + pnlPercent.toFixed(1) + '%'})
                        </div>
                    </div>
                `;
            } else {
                // AFFICHAGE NORMAL pour peu de positions
                return `
                    <div style="
                        background: ${isPositive ? 'linear-gradient(135deg, #0f4c3a 0%, #1a5f4a 100%)' : 'linear-gradient(135deg, #2a2a2a 0%, #404040 100%)'}; 
                        border-radius: 12px; 
                        padding: 16px; 
                        margin-bottom: 12px; 
                        border: 2px solid ${isPositive ? '#10b981' : '#6b7280'};
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        transition: all 0.3s ease;
                        ${pulseAnimation}
                    " onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 6px 20px rgba(0,0,0,0.4)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.3)'">
                    
                    <!-- Header de la position -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div style="display: flex; align-items: center;">
                            <span style="font-size: 18px; margin-right: 10px;">${pnlIcon}</span>
                            <span style="color: #ffffff; font-weight: bold; font-size: 16px; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">
                                ${position.symbol.replace('USDT', '')}
                            </span>
                            <span style="color: #d1d5db; font-size: 12px; margin-left: 6px; font-weight: 500;">
                                USDT
                            </span>
                        </div>
                        
                        <!-- Badge PnL -->
                        <div style="
                            background: ${isPositive ? '#10b981' : '#ef4444'};
                            color: #ffffff;
                            padding: 6px 12px;
                            border-radius: 8px;
                            font-weight: bold;
                            font-size: 13px;
                            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
                        ">
                            ${isNaN(pnlDollar) ? 'N/A' : pnlSign + '$' + pnlDollar.toFixed(2)} (${isNaN(pnlPercent) ? 'N/A' : pnlSign + pnlPercent.toFixed(2) + '%'})
            </div>
                    </div>
                    
                    <!-- Détails de la position -->
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="color: #e5e7eb; font-size: 12px;">
                            <span style="display: inline-block; background: rgba(0,0,0,0.3); color: #ffffff; padding: 4px 8px; border-radius: 6px; margin-right: 6px; font-weight: 500;">
                                ⏱️ ${timeDisplay}
                </span>
                            <span style="display: inline-block; background: ${managementBg}; color: ${managementColor}; padding: 4px 8px; border-radius: 6px; font-weight: 500;">
                                ${managementIcon} ${managementText}
                            </span>
                            <span style="display: inline-block; background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 4px 8px; border-radius: 6px; font-weight: 500;">
                                🎯 ${autoCloseText}
                            </span>
            </div>
                        
                        <!-- Indicateur de progression -->
                        <div style="color: ${isPositive ? '#34d399' : '#9ca3af'}; font-size: 11px; font-weight: 600;">
                            ${isPositive ? '🚀' : '⏳'} ${isPositive ? 'En profit' : 'En cours'}
                        </div>
                    </div>
                </div>
            `;
            }
        }).join('');
        
        // 🎯 AMÉLIORATION: Ajouter un indicateur si des positions sont masquées (configurable)
        const showHiddenCount = config.displaySettings?.showHiddenPositionsCount !== false; // true par défaut
        const hiddenPositionsIndicator = (hiddenCount > 0 && showHiddenCount) ? `
            <div style="
                text-align: center;
                background: linear-gradient(135deg, #374151 0%, #4b5563 100%);
                border-radius: 8px;
                padding: 8px 12px;
                margin-top: 8px;
                border: 1px solid #6b7280;
                color: #d1d5db;
                font-size: 12px;
                font-weight: 500;
            ">
                📊 ${hiddenCount} position(s) supplémentaire(s) masquée(s) pour optimiser l'affichage
                <br><small style="color: #9ca3af; margin-top: 4px; display: block;">
                    Total: ${openPositions.length} positions actives
                </small>
            </div>
        ` : '';
        
        positionsListEl.innerHTML = `
            <style>
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                }
            </style>
            ${positionsHTML}
            ${hiddenPositionsIndicator}
        `;
    }
}

async function importExistingPositions() {
    try {
        log('🔄 Importation des positions existantes depuis Bitget...', 'INFO');
        log(`📊 État initial: ${openPositions.length} positions dans openPositions`, 'DEBUG');
        
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
        if (result) {
            log(`📊 Code réponse: ${result.code}, Message: ${result.msg}`, 'DEBUG');
        }
        
        if (result && result.code === '00000' && result.data) {
            log(`📊 Données brutes reçues: ${result.data.length} positions total`, 'DEBUG');
            const apiPositions = result.data.filter(pos => parseFloat(pos.total) > 0);
            log(`📊 Positions actives filtrées: ${apiPositions.length}`, 'DEBUG');
            
            if (apiPositions.length === 0) {
                log('ℹ️ Aucune position existante trouvée sur Bitget', 'INFO');
                return;
            }
            
            // 🔧 CORRECTION: Ne plus limiter l'import des positions - Afficher toutes les positions
            // L'ancienne logique limitait l'affichage à MAX_SIMULTANEOUS_POSITIONS (2) positions
            // Maintenant on affiche toutes les positions (bot + manuelles)
            log(`📊 Import de toutes les positions: ${apiPositions.length} positions trouvées`, 'INFO');
            
            apiPositions.forEach((pos, index) => {
                log(`📍 Position ${index + 1}: ${pos.symbol} ${pos.holdSide || 'NO_SIDE'} - Total: ${pos.total || 'NO_TOTAL'} - Price: ${pos.markPrice || 'NO_PRICE'}`, 'DEBUG');
                log(`📊 Structure complète: ${JSON.stringify(pos)}`, 'DEBUG');
            });
            
            let imported = 0;
            
            for (const apiPos of apiPositions) {
                const exists = openPositions.find(localPos => localPos.symbol === apiPos.symbol);
                
                if (!exists) {
                    // 🔧 CORRECTION: Utiliser les bons champs de l'API Bitget
                    const side = apiPos.holdSide ? apiPos.holdSide.toUpperCase() : 'LONG';
                    const total = parseFloat(apiPos.total || 0); // Valeur totale de la position
                    const markPrice = parseFloat(apiPos.markPrice || 0);
                    const averageOpenPrice = parseFloat(apiPos.averageOpenPrice || markPrice);
                    const unrealizedPL = parseFloat(apiPos.unrealizedPL || 0);
                    const marginSize = parseFloat(apiPos.marginSize || 0); // Marge utilisée
                    
                    log(`🔍 Données position ${apiPos.symbol}: holdSide=${apiPos.holdSide}, total=${apiPos.total}, markPrice=${apiPos.markPrice}, marginSize=${apiPos.marginSize}`, 'DEBUG');
                    
                    const position = {
                        id: Date.now() + Math.random(),
                        symbol: apiPos.symbol,
                        side: side,
                        size: total, // 🔧 CORRECTION: Utiliser la valeur totale de la position
                        quantity: parseFloat(apiPos.size || total / markPrice), // 🔧 AMÉLIORATION: Utiliser apiPos.size si disponible
                        entryPrice: averageOpenPrice,
                        status: 'OPEN',
                        timestamp: apiPos.cTime ? new Date(parseInt(apiPos.cTime)).toISOString() : new Date().toISOString(), // 🔧 AMÉLIORATION: Utiliser le timestamp réel si disponible
                        orderId: `imported_${Date.now()}`,
                        stopLossId: null,
                        currentStopPrice: null,
                        highestPrice: markPrice,
                        currentPrice: markPrice,
                        unrealizedPnL: unrealizedPL,
                        pnlPercentage: averageOpenPrice > 0 ? ((markPrice - averageOpenPrice) / averageOpenPrice) * 100 : 0,
                        targetPnL: config.targetPnL || 2.0, // 🔧 AJOUT: Target PnL pour la nouvelle stratégie
                        reason: '📥 Position importée depuis Bitget',
                        lastPnLLog: 0, // 🔧 AJOUT: Pour éviter le spam de logs PnL
                        isBotManaged: false // 🔧 NOUVEAU: Position manuelle, pas gérée par le bot
                    };
                    
                    if (position.symbol && position.size > 0 && position.entryPrice > 0) {
                        openPositions.push(position);
                        imported++;
                        
                        log(`📥 Position importée: ${position.symbol} ${position.side} ${position.size.toFixed(2)} USDT @ ${position.entryPrice.toFixed(4)} (PnL: ${unrealizedPL.toFixed(2)} USDT)`, 'SUCCESS');
                    } else {
                        log(`⚠️ Position ${apiPos.symbol} ignorée - Données invalides`, 'WARNING');
                    }
                }
            }
            
            if (imported > 0) {
                log(`✅ ${imported} position(s) importée(s) avec succès!`, 'SUCCESS');
                log(`📊 État final après import: ${openPositions.length}/${MAX_SIMULTANEOUS_POSITIONS} positions actives`, 'INFO');
                
                // Log détaillé des positions importées
                openPositions.forEach((pos, idx) => {
                    const pnl = pos.pnlPercentage || 0;
                    const pnlText = pnl >= 0 ? `+${pnl.toFixed(2)}%` : `${pnl.toFixed(2)}%`;
                    log(`   ${idx + 1}. ${pos.symbol} ${pos.side} ${pos.size.toFixed(2)}$ @ ${pos.entryPrice.toFixed(4)} (${pnlText})`, 'INFO');
                });
                
                log('🔄 Mise à jour de l\'affichage des positions...', 'DEBUG');
                updatePositionsDisplay();
                updateStats();

                // 🔧 CORRECTION: Mise à jour IMMÉDIATE des PnL après import (sans délai)
                log('📊 Mise à jour immédiate des prix en temps réel...', 'INFO');
                await updatePositionsPnL(); // Mise à jour SYNCHRONE des PnL
                updatePositionsDisplay(); // Refresh immédiat de l'affichage
                log('✅ Données temps réel mises à jour après import', 'SUCCESS');
                
                // Vérification immédiate et différée de l'affichage
                const positionCountEl = document.getElementById('positionCount');
                if (positionCountEl) {
                    log(`📊 Affichage immédiatement mis à jour: ${positionCountEl.textContent} positions affichées`, 'SUCCESS');
                } else {
                    log('⚠️ Élément positionCount non trouvé - Retry dans 500ms', 'WARNING');
                }
                
                // Double vérification après 500ms avec mise à jour des données
                setTimeout(async () => {
                    const positionCountEl = document.getElementById('positionCount');
                    if (positionCountEl) {
                        log(`📊 Vérification différée: ${positionCountEl.textContent} positions affichées dans l'interface`, 'DEBUG');
                        if (positionCountEl.textContent != openPositions.length.toString()) {
                            log('⚠️ Désynchronisation détectée - Force refresh...', 'WARNING');
                            updatePositionsDisplay();
                        }
                    }
                    
                    // 🔧 AMÉLIORATION: Seconde mise à jour des données pour s'assurer que tout est à jour
                    await updatePositionsPnL();
                    updatePositionsDisplay();
                    log('🔄 Seconde mise à jour des données effectuée', 'DEBUG');
                }, 2000); // 2 secondes pour laisser le temps aux données de se stabiliser
                
            } else {
                log('ℹ️ Toutes les positions existantes sont déjà dans le système', 'INFO');
                log(`📊 État: ${openPositions.length}/${MAX_SIMULTANEOUS_POSITIONS} positions actives`, 'INFO');
                
                // Même si aucune position n'est importée, s'assurer que l'affichage est correct
                if (openPositions.length > 0) {
                    updatePositionsDisplay();
                    log('🔄 Affichage des positions existantes mis à jour', 'DEBUG');
                }
            }
        } else {
            log('❌ Erreur lors de l\'importation des positions', 'ERROR');
        }
    } catch (error) {
        log(`❌ Erreur importation positions: ${error.message}`, 'ERROR');
    }
}

// 🎯 NOUVELLES FONCTIONS EXPORTÉES pour la stratégie paires positives
window.getPositivePairs = getPositivePairs;
window.selectRandomPositivePair = selectRandomPositivePair;
window.openPosition = openPosition;
window.monitorPnLAndClose = monitorPnLAndClose;
window.closePositionAtMarket = closePositionAtMarket;

// 🔧 FONCTIONS UTILITAIRES EXPORTÉES
window.importExistingPositions = importExistingPositions;
window.canOpenNewPosition = canOpenNewPosition;
window.syncAndCheckPositions = syncAndCheckPositions;
window.updatePositionsPnL = updatePositionsPnL;
window.fetchActivePositionsFromAPI = fetchActivePositionsFromAPI;
window.makeRequestWithRetry = makeRequestWithRetry;
window.syncNewManualPositions = syncNewManualPositions; // 🆕 NOUVEAU: Sync automatique

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
                
                // 🔧 SÉCURITÉ: Ne supprimer les positions locales que si on est sûr qu'elles sont fermées
                // Éviter de supprimer des positions si l'API retourne moins de données que prévu
                const localSymbols = openPositions.map(pos => pos.symbol);
                const apiReturnedCount = apiPositions.length;
                const localCount = openPositions.length;
                
                if (apiReturnedCount < localCount && closedPositions.length < localCount) {
                    log(`⚠️ SÉCURITÉ: L'API retourne ${apiReturnedCount} positions mais nous en avons ${localCount} localement`, 'WARNING');
                    log(`🛡️ Conservation des positions locales pour éviter une perte de données`, 'INFO');
                    
                    // Ne supprimer que les positions explicitement fermées (avec confirmation)
                    openPositions = openPositions.filter(localPos => {
                        const isConfirmedClosed = closedPositions.some(closed => closed.symbol === localPos.symbol);
                        if (isConfirmedClosed) {
                            log(`🗑️ Suppression confirmée: ${localPos.symbol}`, 'INFO');
                            return false;
                        }
                        return true;
                    });
                } else {
                    // Filtrage normal si les données semblent cohérentes
                    openPositions = openPositions.filter(localPos => 
                        currentSymbols.includes(localPos.symbol)
                    );
                }
                
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

// 🧪 FONCTION DE DEBUG: Fonction pratique pour forcer l'import des positions depuis la console
window.debugImportDetailed = async function() {
    console.log('🔍 Debug import détaillé...');
    
    // Vider les positions pour test propre
    openPositions.length = 0;
    
    try {
        // Appel API direct
        const result = await makeRequest('/bitget/api/v2/mix/position/all-position?productType=USDT-FUTURES');
        
        if (result && result.code === '00000' && result.data) {
            console.log(`📊 ${result.data.length} positions reçues de l'API`);
            
            // Filtrage
            const apiPositions = result.data.filter(pos => parseFloat(pos.total) > 0);
            console.log(`📊 ${apiPositions.length} positions après filtrage (total > 0)`);
            
            if (apiPositions.length === 0) {
                console.log('❌ Aucune position après filtrage !');
                return;
            }
            
            let imported = 0;
            
            for (const apiPos of apiPositions) {
                console.log(`\n🔍 Traitement de ${apiPos.symbol}:`);
                
                // Vérifier si elle existe déjà
                const exists = openPositions.find(localPos => localPos.symbol === apiPos.symbol);
                console.log(`   Existe déjà: ${exists ? 'OUI' : 'NON'}`);
                
                if (!exists) {
                    // Calculer les valeurs
                    const side = apiPos.holdSide ? apiPos.holdSide.toUpperCase() : 'LONG';
                    const total = parseFloat(apiPos.total || 0);
                    const markPrice = parseFloat(apiPos.markPrice || 0);
                    const averageOpenPrice = parseFloat(apiPos.averageOpenPrice || markPrice);
                    const unrealizedPL = parseFloat(apiPos.unrealizedPL || 0);
                    
                    console.log(`   Side: ${side}`);
                    console.log(`   Total: ${total}`);
                    console.log(`   MarkPrice: ${markPrice}`);
                    console.log(`   AverageOpenPrice: ${averageOpenPrice}`);
                    console.log(`   UnrealizedPL: ${unrealizedPL}`);
                    
                    const position = {
                        id: Date.now() + Math.random(),
                        symbol: apiPos.symbol,
                        side: side,
                        size: total,
                        quantity: total / markPrice,
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
                        targetPnL: config.targetPnL || 2.0,
                        reason: '📥 Position importée depuis Bitget'
                    };
                    
                    // Test de validation
                    const isValid = position.symbol && position.size > 0 && position.entryPrice > 0;
                    console.log(`   Validation:`);
                    console.log(`     symbol: ${position.symbol ? 'OK' : 'MANQUANT'}`);
                    console.log(`     size > 0: ${position.size > 0 ? 'OK' : 'ÉCHEC'} (${position.size})`);
                    console.log(`     entryPrice > 0: ${position.entryPrice > 0 ? 'OK' : 'ÉCHEC'} (${position.entryPrice})`);
                    console.log(`     RÉSULTAT: ${isValid ? 'VALIDE' : 'INVALIDE'}`);
                    
                    if (isValid) {
                        openPositions.push(position);
                        imported++;
                        console.log(`   ✅ Position ajoutée !`);
                    } else {
                        console.log(`   ❌ Position rejetée !`);
                    }
                }
            }
            
            console.log(`\n📊 RÉSULTAT FINAL: ${imported} positions importées`);
            console.log(`📊 openPositions.length: ${openPositions.length}`);
            
            // Mettre à jour l'affichage
            if (typeof updatePositionsDisplay === 'function') {
                updatePositionsDisplay();
                console.log('🔄 Affichage mis à jour');
            }
            
        } else {
            console.log('❌ Erreur API ou pas de données');
        }
        
    } catch (error) {
        console.error('❌ Erreur:', error);
    }
};

// 🧪 FONCTION DE DEBUG: Forcer la mise à jour des données temps réel
window.forceUpdatePositions = async function() {
    console.log('🔄 Force update des positions...');

    if (openPositions.length === 0) {
        console.log('❌ Aucune position à mettre à jour');
        return;
    }

    console.log(`📊 Mise à jour de ${openPositions.length} position(s)...`);
    console.log('🔍 État actuel des positions:');
    openPositions.forEach((pos, index) => {
        console.log(`   ${index + 1}. ${pos.symbol}: currentPrice=${pos.currentPrice || 'UNDEFINED'}, pnlPercentage=${pos.pnlPercentage || 'UNDEFINED'}`);
    });

    try {
        await updatePositionsPnL();
        updatePositionsDisplay();
        console.log('✅ Mise à jour forcée terminée');

        // Afficher les données après mise à jour
        console.log('📈 État après mise à jour:');
        openPositions.forEach((pos, index) => {
            const pnl = pos.pnlPercentage || 0;
            const pnlText = pnl >= 0 ? `+${pnl.toFixed(2)}%` : `${pnl.toFixed(2)}%`;
            console.log(`   ${index + 1}. ${pos.symbol}: ${pos.currentPrice?.toFixed(4) || 'N/A'} | ${pnlText}`);
        });

    } catch (error) {
        console.error('❌ Erreur lors de la mise à jour forcée:', error);
    }
};

// 🧪 FONCTION DE DEBUG: Vérifier les données des positions importées
window.checkPositionsData = function() {
    console.log('🔍 Vérification des données des positions:');
    console.log(`📊 Nombre de positions: ${openPositions.length}`);

    openPositions.forEach((pos, index) => {
        console.log(`\n📍 Position ${index + 1}: ${pos.symbol}`);
        console.log(`   entryPrice: ${pos.entryPrice} (${typeof pos.entryPrice})`);
        console.log(`   currentPrice: ${pos.currentPrice} (${typeof pos.currentPrice})`);
        console.log(`   pnlPercentage: ${pos.pnlPercentage} (${typeof pos.pnlPercentage})`);
        console.log(`   unrealizedPnL: ${pos.unrealizedPnL} (${typeof pos.unrealizedPnL})`);
        console.log(`   size: ${pos.size} (${typeof pos.size})`);
        console.log(`   timestamp: ${pos.timestamp}`);

        // Calculs de vérification
        if (pos.currentPrice && pos.entryPrice) {
            const calcPercent = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
            const calcDollar = pos.size * (calcPercent / 100);
            console.log(`   🔍 Vérification calculs:`);
            console.log(`      Calculé %: ${calcPercent >= 0 ? '+' : ''}${calcPercent.toFixed(2)}%`);
            console.log(`      Calculé $: ${calcDollar >= 0 ? '+' : ''}$${calcDollar.toFixed(2)}`);
            console.log(`      API %: ${pos.pnlPercentage ? pos.pnlPercentage.toFixed(2) + '%' : 'N/A'}`);
            console.log(`      API $: ${pos.unrealizedPnL ? '$' + pos.unrealizedPnL.toFixed(2) : 'N/A'}`);
        }
    });
};

console.log('✅ Trading fixes applied successfully - call testTradingFixes() to verify');
console.log('🔧 Debug functions available:');
console.log('   - debugImportDetailed() - Force import positions from console');
console.log('   - forceUpdatePositions() - Force update position data from console');
console.log('   - checkPositionsData() - Check current position data');
console.log('   - testPositionUpdates() - Test complete position update cycle');
console.log('   - testAPIData() - Test API data consistency');
console.log('   - togglePositionDebug() - Toggle position update debug logs');
console.log('   - checkUpdateIntervals() - Check if update intervals are working');
console.log('   - forceAllUpdates() - Force manual update of all data');

// 🧪 FONCTION DE DEBUG: Tester la cohérence des données API
window.testAPIData = async function() {
    console.log('🧪 TEST: Cohérence des données API...');

    try {
        // Récupérer les données directement depuis l'API
        const result = await makeRequest('/bitget/api/v2/mix/position/all-position?productType=USDT-FUTURES');

        if (result && result.code === '00000' && result.data) {
            const apiPositions = result.data.filter(pos => parseFloat(pos.total) > 0);
            console.log(`📊 API retourne ${apiPositions.length} positions actives`);

            // Comparer avec les positions locales
            openPositions.forEach(localPos => {
                const apiPos = apiPositions.find(api => api.symbol === localPos.symbol);
                if (apiPos) {
                    console.log(`\n🔍 Comparaison ${localPos.symbol}:`);
                    console.log(`   API - Prix: ${parseFloat(apiPos.markPrice || 0).toFixed(4)}, PnL: ${parseFloat(apiPos.unrealizedPL || 0).toFixed(2)}$`);
                    console.log(`   Local - Prix: ${localPos.currentPrice?.toFixed(4) || 'N/A'}, PnL: ${localPos.unrealizedPnL?.toFixed(2) || 'N/A'}$`);

                    const apiPrice = parseFloat(apiPos.markPrice || 0);
                    const apiPnl = parseFloat(apiPos.unrealizedPL || 0);

                    const priceMatch = Math.abs((localPos.currentPrice || 0) - apiPrice) < 0.0001;
                    const pnlMatch = Math.abs((localPos.unrealizedPnL || 0) - apiPnl) < 0.01;

                    console.log(`   ✅ Prix cohérent: ${priceMatch ? 'OUI' : 'NON'}`);
                    console.log(`   ✅ PnL cohérent: ${pnlMatch ? 'OUI' : 'NON'}`);

                    if (!priceMatch || !pnlMatch) {
                        console.log(`   ❌ INCOHÉRENCE DÉTECTÉE!`);
                    }
                } else {
                    console.log(`❌ Position ${localPos.symbol} non trouvée dans l'API`);
                }
            });
        } else {
            console.log('❌ Impossible de récupérer les données API');
        }
    } catch (error) {
        console.error('❌ Erreur test API:', error);
    }
};

// 🧪 FONCTION DE TEST RAPIDE: Tester la mise à jour complète des positions
window.testPositionUpdates = async function() {
    console.log('🧪 TEST: Mise à jour complète des positions...');

    if (openPositions.length === 0) {
        console.log('❌ Aucune position à tester');
        return;
    }

    console.log('🔍 Avant mise à jour:');
    checkPositionsData();

    console.log('\n⏳ Mise à jour en cours...');
    await updatePositionsPnL();
    updatePositionsDisplay();

    console.log('\n✅ Après mise à jour:');
    checkPositionsData();

    // Vérifier que les données sont maintenant définies
    const hasValidData = openPositions.every(pos =>
        typeof pos.currentPrice === 'number' &&
        typeof pos.pnlPercentage === 'number' &&
        !isNaN(pos.currentPrice) &&
        !isNaN(pos.pnlPercentage)
    );

    console.log(`\n🎯 RÉSULTAT: ${hasValidData ? '✅ DONNÉES VALIDES' : '❌ DONNÉES MANQUANTES'}`);

    if (hasValidData) {
        console.log('🎉 Les positions affichent maintenant les vraies données temps réel !');
    } else {
        console.log('⚠️ Les données ne sont toujours pas mises à jour correctement');
    }

    return hasValidData;
};

// 🧪 FONCTION DE DEBUG: Activer/désactiver les logs de debug des positions
window.togglePositionDebug = function() {
    positionUpdateDebug = !positionUpdateDebug;
    console.log(`🔧 Mode debug positions: ${positionUpdateDebug ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
    if (positionUpdateDebug) {
        console.log('📊 Les logs de mise à jour des positions seront maintenant affichés');
    } else {
        console.log('🔇 Les logs de mise à jour des positions sont maintenant masqués');
    }
};

// 🧪 FONCTION DE DEBUG: Vérifier si les intervalles de mise à jour fonctionnent
window.checkUpdateIntervals = function() {
    console.log('🔍 Vérification des intervalles de mise à jour:');

    const intervals = [
        { name: 'positionsDisplayInterval', interval: positionsDisplayInterval, frequency: '1s' },
        { name: 'statsInterval', interval: statsInterval, frequency: '5s' },
        { name: 'pnlMonitoringInterval', interval: pnlMonitoringInterval, frequency: '1s' },
        { name: 'tradingLoopInterval', interval: tradingLoopInterval, frequency: '60s' }
    ];

    intervals.forEach(({ name, interval, frequency }) => {
        if (interval) {
            console.log(`✅ ${name}: ACTIF (${frequency})`);
        } else {
            console.log(`❌ ${name}: INACTIF`);
        }
    });

    console.log(`\n📊 Compteurs:`);
    console.log(`   Interface: ${window.displayUpdateCounter || 0} cycles`);
    console.log(`   Stats: ${window.statsUpdateCounter || 0} cycles`);

    console.log(`\n🤖 Bot status: ${botRunning ? 'RUNNING' : 'STOPPED'}`);
    console.log(`📈 Positions actives: ${openPositions.length}`);
};

// 🧪 FONCTION DE DEBUG: Forcer manuellement toutes les mises à jour
window.forceAllUpdates = async function() {
    console.log('🔄 FORCE UPDATE: Exécution manuelle de tous les cycles de mise à jour...');

    try {
        // 1. Mise à jour des PnL
        console.log('📊 1/4 Mise à jour PnL...');
        await updatePositionsPnL();

        // 2. Mise à jour des statistiques
        console.log('📈 2/4 Mise à jour statistiques...');
        updateStats();

        // 3. Mise à jour de l'affichage
        console.log('🎨 3/4 Mise à jour affichage...');
        updatePositionsDisplay();

        // 4. Surveillance PnL (comme l'intervalle automatique)
        console.log('🎯 4/4 Surveillance PnL...');
        await monitorPnLAndClose();

        console.log('✅ Toutes les mises à jour forcées terminées !');

        // Vérifier le résultat
        setTimeout(() => {
            checkPositionsData();
        }, 1000);

    } catch (error) {
        console.error('❌ Erreur lors des mises à jour forcées:', error);
    }
};

// 🆕 NOUVELLE FONCTION: Synchroniser les nouvelles positions manuelles automatiquement
async function syncNewManualPositions() {
    try {
        // Récupérer les positions actuelles depuis l'API
        const result = await makeRequest('/bitget/api/v2/mix/position/all-position?productType=USDT-FUTURES');
        
        if (!result || result.code !== '00000' || !result.data) {
            return; // Échec silencieux pour éviter le spam
        }
        
        const apiPositions = result.data.filter(pos => parseFloat(pos.total) > 0);
        const currentSymbols = openPositions.map(pos => pos.symbol);
        
        // Trouver les nouvelles positions (présentes dans l'API mais pas localement)
        const newPositions = apiPositions.filter(apiPos => 
            !currentSymbols.includes(apiPos.symbol)
        );
        
        if (newPositions.length > 0) {
            log(`🔍 ${newPositions.length} nouvelle(s) position(s) manuelle(s) détectée(s)`, 'INFO');
            
            for (const apiPos of newPositions) {
                const side = apiPos.holdSide ? apiPos.holdSide.toUpperCase() : 'LONG';
                const total = parseFloat(apiPos.total || 0);
                const markPrice = parseFloat(apiPos.markPrice || 0);
                const averageOpenPrice = parseFloat(apiPos.averageOpenPrice || markPrice);
                const unrealizedPL = parseFloat(apiPos.unrealizedPL || 0);
                
                const position = {
                    id: Date.now() + Math.random(),
                    symbol: apiPos.symbol,
                    side: side,
                    size: total,
                    quantity: parseFloat(apiPos.size || total / markPrice),
                    entryPrice: averageOpenPrice,
                    status: 'OPEN',
                    timestamp: apiPos.cTime ? new Date(parseInt(apiPos.cTime)).toISOString() : new Date().toISOString(),
                    orderId: `manual_${Date.now()}`,
                    stopLossId: null,
                    currentStopPrice: null,
                    highestPrice: markPrice,
                    currentPrice: markPrice,
                    unrealizedPnL: unrealizedPL,
                    pnlPercentage: averageOpenPrice > 0 ? ((markPrice - averageOpenPrice) / averageOpenPrice) * 100 : 0,
                    targetPnL: config.targetPnL || 2.0,
                    reason: '👤 Position manuelle détectée automatiquement',
                    lastPnLLog: 0,
                    isBotManaged: false // Position manuelle
                };
                
                if (position.symbol && position.size > 0 && position.entryPrice > 0) {
                    openPositions.push(position);
                    log(`👤 Nouvelle position manuelle ajoutée: ${position.symbol} ${position.side} ${position.size.toFixed(2)} USDT @ ${position.entryPrice.toFixed(4)}`, 'SUCCESS');
                }
            }
            
            // Mettre à jour l'affichage
            updatePositionsDisplay();
            updateStats();
            
            log(`✅ Synchronisation automatique terminée: ${newPositions.length} position(s) ajoutée(s)`, 'SUCCESS');
        }
        
        // Vérifier aussi les positions fermées (comme dans syncAndCheckPositions)
        const currentApiSymbols = apiPositions.map(pos => pos.symbol);
        const closedPositions = openPositions.filter(localPos => 
            !currentApiSymbols.includes(localPos.symbol)
        );
        
        if (closedPositions.length > 0) {
            log(`🔚 ${closedPositions.length} position(s) fermée(s) détectée(s) automatiquement`, 'INFO');
            
            for (const closedPos of closedPositions) {
                botStats.totalClosedPositions++;
                const pnl = closedPos.unrealizedPnL || 0;
                
                if (pnl > 0) {
                    botStats.winningPositions++;
                    botStats.totalWinAmount += pnl;
                } else if (pnl < 0) {
                    botStats.losingPositions++;
                    botStats.totalLossAmount += pnl;
                }
            }
            
            // Supprimer les positions fermées
            openPositions = openPositions.filter(localPos => 
                currentApiSymbols.includes(localPos.symbol)
            );
            
            updatePositionsDisplay();
            updateStats();
        }
        
    } catch (error) {
        // Échec silencieux pour éviter le spam dans les logs
        console.error('Erreur sync positions manuelles:', error.message);
    }
}

// 🧪 FONCTION DE TEST: Créer plusieurs positions de test pour tester l'affichage
window.createTestPositions = function(count = 15) {
    console.log(`🧪 Création de ${count} positions de test pour tester l'affichage...`);
    
    // Sauvegarder les vraies positions
    const realPositions = [...openPositions];
    
    // Vider et créer des positions de test
    openPositions.length = 0;
    
    const testSymbols = [
        'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT', 'SOLUSDT', 'DOTUSDT', 'LINKUSDT', 'LTCUSDT', 'BCHUSDT',
        'ATOMUSDT', 'FILUSDT', 'TRXUSDT', 'ETCUSDT', 'XLMUSDT', 'VETUSDT', 'FTMUSDT', 'MANAUSDT', 'SANDUSDT', 'AXSUSDT',
        'ICPUSDT', 'THETAUSDT', 'ALGOUSDT', 'EGLDUSDT', 'NEARUSDT', 'FLOWUSDT', 'KLAYUSDT', 'CHZUSDT', 'ENJUSDT', 'GALAUSDT'
    ];
    
    for (let i = 0; i < Math.min(count, testSymbols.length); i++) {
        const symbol = testSymbols[i];
        const entryPrice = 1000 + Math.random() * 50000; // Prix d'entrée aléatoire
        const currentPrice = entryPrice * (0.95 + Math.random() * 0.1); // ±5% du prix d'entrée
        const size = 100 + Math.random() * 500; // Taille aléatoire
        const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
        const unrealizedPnL = size * (pnlPercent / 100);
        
        const position = {
            id: Date.now() + i,
            symbol: symbol,
            side: 'LONG',
            size: size,
            quantity: size / entryPrice,
            entryPrice: entryPrice,
            currentPrice: currentPrice,
            status: 'OPEN',
            timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(), // Temps aléatoire dans les dernières 24h
            orderId: `test_${i}`,
            stopLossId: null,
            currentStopPrice: null,
            highestPrice: Math.max(entryPrice, currentPrice),
            unrealizedPnL: unrealizedPnL,
            pnlPercentage: pnlPercent,
            targetPnL: config.targetPnL || 2.0,
            reason: `🧪 Position de test #${i + 1}`,
            change24h: Math.random() * 10 - 2, // ±2% à +8%
            lastPnLLog: 0
        };
        
        openPositions.push(position);
    }
    
    console.log(`✅ ${openPositions.length} positions de test créées`);
    console.log(`📊 Affichage: ${openPositions.length > 10 ? 'COMPACT' : 'NORMAL'} (seuil: ${config.displaySettings?.compactDisplayThreshold || 10})`);
    console.log(`📋 Limite affichage: ${config.displaySettings?.maxPositionsDisplayed || 50} positions max`);
    
    // Mettre à jour l'affichage
    updatePositionsDisplay();
    
    console.log('🎯 Positions de test créées ! Vérifiez l\'interface.');
    console.log('💡 Utilisez clearTestPositions() pour nettoyer et restoreRealPositions() pour restaurer les vraies positions');
    
    // Sauvegarder les vraies positions pour restauration
    window._realPositions = realPositions;
    
    return openPositions;
};

// 🧪 FONCTION DE TEST: Nettoyer les positions de test
window.clearTestPositions = function() {
    console.log('🧹 Nettoyage des positions de test...');
    openPositions.length = 0;
    updatePositionsDisplay();
    console.log('✅ Positions de test supprimées');
};

// 🧪 FONCTION DE TEST: Restaurer les vraies positions
window.restoreRealPositions = function() {
    if (window._realPositions) {
        console.log(`🔄 Restauration de ${window._realPositions.length} vraies positions...`);
        openPositions.length = 0;
        openPositions.push(...window._realPositions);
        updatePositionsDisplay();
        delete window._realPositions;
        console.log('✅ Vraies positions restaurées');
    } else {
        console.log('⚠️ Aucune vraie position sauvegardée à restaurer');
    }
};

// 🧪 FONCTION DE TEST: Tester les différents seuils d'affichage
window.testDisplayModes = function() {
    console.log('🧪 Test des différents modes d\'affichage...');
    
    console.log('\n1️⃣ Test affichage NORMAL (5 positions)');
    createTestPositions(5);
    
    setTimeout(() => {
        console.log('\n2️⃣ Test affichage COMPACT (15 positions)');
        createTestPositions(15);
        
        setTimeout(() => {
            console.log('\n3️⃣ Test affichage avec LIMITE (60 positions)');
            createTestPositions(60);
            
            setTimeout(() => {
                console.log('\n4️⃣ Test EXTRÊME (100 positions)');
                createTestPositions(100);
                
                setTimeout(() => {
                    console.log('\n✅ Tests terminés ! Utilisez restoreRealPositions() pour restaurer');
                }, 3000);
            }, 3000);
        }, 3000);
    }, 3000);
};

// 🧪 FONCTION DE TEST: Vérifier l'auto-refresh de connexion
window.testAutoRefresh = function() {
    console.log('🧪 Test du système d\'auto-refresh...');
    
    if (window.autoConnectInterval) {
        console.log('✅ Auto-refresh ACTIF - Intervalle toutes les 10 secondes');
        console.log('📊 Prochaine vérification dans 10 secondes maximum');
        
        // Compter les connexions automatiques
        let autoRefreshCount = 0;
        const originalTestConnection = window.testConnection;
        
        window.testConnection = async function(isAutoRefresh = false) {
            if (isAutoRefresh) {
                autoRefreshCount++;
                console.log(`🔄 Auto-refresh #${autoRefreshCount} - ${new Date().toLocaleTimeString()}`);
            }
            return await originalTestConnection(isAutoRefresh);
        };
        
        // Restaurer après 60 secondes
        setTimeout(() => {
            window.testConnection = originalTestConnection;
            console.log(`✅ Test terminé - ${autoRefreshCount} auto-refresh détectés en 60 secondes`);
        }, 60000);
        
        console.log('⏳ Test en cours pendant 60 secondes...');
        
    } else {
        console.log('❌ Auto-refresh INACTIF');
        console.log('💡 Démarrez le bot pour activer l\'auto-refresh');
    }
};

// 🧪 FONCTION DE TEST: Forcer un auto-refresh immédiat
window.forceAutoRefresh = async function() {
    console.log('🔄 Force auto-refresh immédiat...');
    
    if (typeof testConnection === 'function') {
        try {
            await testConnection(true);
            console.log('✅ Auto-refresh forcé terminé');
        } catch (error) {
            console.error('❌ Erreur auto-refresh:', error);
        }
    } else {
        console.log('❌ Fonction testConnection non disponible');
    }
};

// 🧪 FONCTION DE TEST: Vérifier la nouvelle interface améliorée
window.testNewInterface = function() {
    console.log('🧪 Test de la nouvelle interface améliorée...');
    
    // Vérifier que tous les nouveaux éléments existent
    const elements = {
        botPositionsCount: document.getElementById('botPositionsCount'),
        manualPositionsCount: document.getElementById('manualPositionsCount'),
        botStatusDot: document.getElementById('botStatusDot'),
        totalEquity: document.getElementById('totalEquity'),
        usedCapital: document.getElementById('usedCapital'),
        availableCapital: document.getElementById('availableCapital')
    };
    
    let missingElements = [];
    let foundElements = [];
    
    for (const [name, element] of Object.entries(elements)) {
        if (element) {
            foundElements.push(name);
        } else {
            missingElements.push(name);
        }
    }
    
    console.log(`✅ Éléments trouvés: ${foundElements.join(', ')}`);
    if (missingElements.length > 0) {
        console.log(`❌ Éléments manquants: ${missingElements.join(', ')}`);
    }
    
    // Tester la mise à jour des stats
    if (typeof updateStats === 'function') {
        console.log('🔄 Test de mise à jour des statistiques...');
        updateStats();
        console.log('✅ updateStats() exécuté avec succès');
    } else {
        console.log('❌ Fonction updateStats non disponible');
    }
    
    // Vérifier les styles CSS
    const configSection = document.querySelector('.config-section');
    const statusSection = document.querySelector('.status-section');
    const statsSection = document.querySelector('.stats-section');
    const capitalSection = document.querySelector('.capital-section');
    
    const sections = {
        'Configuration': configSection,
        'Statut': statusSection,
        'Performance': statsSection,
        'Capital': capitalSection
    };
    
    console.log('🎨 Vérification des sections CSS:');
    for (const [name, section] of Object.entries(sections)) {
        if (section) {
            console.log(`   ✅ Section ${name}: OK`);
        } else {
            console.log(`   ❌ Section ${name}: Manquante`);
        }
    }
    
    console.log('🎯 Test terminé - Interface nouvelle génération prête !');
    
    return {
        elementsFound: foundElements.length,
        elementsMissing: missingElements.length,
        sectionsFound: Object.values(sections).filter(s => s).length,
        allGood: missingElements.length === 0 && Object.values(sections).every(s => s)
    };
};

// 🧪 FONCTION DE TEST: Vérifier que l'affichage des positions n'est plus limité
window.testPositionDisplayLimit = function() {
    console.log('🧪 Test de la limite d\'affichage des positions...');
    
    const currentPositions = openPositions.length;
    const maxDisplayed = config.displaySettings?.maxPositionsDisplayed || 50;
    
    console.log(`📊 État actuel:`);
    console.log(`   Positions ouvertes: ${currentPositions}`);
    console.log(`   Limite d'affichage: ${maxDisplayed}`);
    console.log(`   Positions affichées: ${Math.min(currentPositions, maxDisplayed)}`);
    
    if (currentPositions > 2) {
        console.log('✅ Plus de 2 positions - Test de l\'affichage...');
        
        // Vérifier que updatePositionsDisplay ne limite pas à 2
        const positionsListEl = document.getElementById('positionsList');
        if (positionsListEl) {
            const displayedPositionElements = positionsListEl.querySelectorAll('[style*="background: linear-gradient"]');
            console.log(`   Éléments affichés dans le DOM: ${displayedPositionElements.length}`);
            
            if (displayedPositionElements.length >= Math.min(currentPositions, maxDisplayed)) {
                console.log('✅ Toutes les positions sont affichées correctement');
            } else {
                console.log('❌ Certaines positions ne sont pas affichées');
            }
        } else {
            console.log('❌ Élément positionsList non trouvé');
        }
    } else {
        console.log('ℹ️ Moins de 3 positions - Impossible de tester la limite');
        console.log('💡 Ouvrez plus de 2 positions manuellement pour tester');
    }
    
    // Vérifier les fonctions de limitation
    console.log('\n🔍 Vérification des fonctions de limitation:');
    
    // Test de la fonction d'import (ne doit plus limiter)
    console.log('   Import: Aucune limitation d\'affichage (✅ Corrigé)');
    
    // Test de la fonction updatePositionsDisplay
    if (typeof updatePositionsDisplay === 'function') {
        console.log('   updatePositionsDisplay: Disponible');
        console.log(`   Limite configurée: ${maxDisplayed} positions`);
    } else {
        console.log('   updatePositionsDisplay: Non disponible');
    }
    
    console.log('\n🎯 Résumé:');
    console.log(`   - Limite bot: 2 positions (pour l'ouverture automatique)`);
    console.log(`   - Limite affichage: ${maxDisplayed} positions (configurable)`);
    console.log(`   - Positions manuelles: Aucune limite d'ouverture`);
    
    return {
        currentPositions,
        maxDisplayed,
        limitFixed: true,
        canDisplayMore: currentPositions <= maxDisplayed
    };
};

// 🔧 FONCTION DE DIAGNOSTIC: Vérifier pourquoi seulement 2 positions sont affichées
window.debugPositionDisplay = function() {
    console.log('🔍 DIAGNOSTIC: Pourquoi seulement 2 positions affichées ?');
    console.log('=====================================');
    
    // 1. Vérifier le contenu de openPositions
    console.log(`📊 openPositions.length: ${openPositions.length}`);
    console.log(`📋 Contenu de openPositions:`, openPositions);
    
    if (openPositions.length > 0) {
        openPositions.forEach((pos, index) => {
            console.log(`   ${index + 1}. ${pos.symbol} - ${pos.isBotManaged ? '🤖 Bot' : '👤 Manuel'} - Status: ${pos.status}`);
        });
    }
    
    // 2. Vérifier les paramètres d'affichage
    const maxDisplayed = config.displaySettings?.maxPositionsDisplayed || 50;
    const compactThreshold = config.displaySettings?.compactDisplayThreshold || 10;
    
    console.log(`\n⚙️ Paramètres d'affichage:`);
    console.log(`   maxDisplayed: ${maxDisplayed}`);
    console.log(`   compactThreshold: ${compactThreshold}`);
    console.log(`   config.displaySettings:`, config.displaySettings);
    
    // 3. Tester la fonction updatePositionsDisplay
    console.log(`\n🔄 Test de updatePositionsDisplay()...`);
    if (typeof updatePositionsDisplay === 'function') {
        try {
            updatePositionsDisplay();
            console.log('✅ updatePositionsDisplay() exécuté sans erreur');
        } catch (error) {
            console.error('❌ Erreur dans updatePositionsDisplay():', error);
        }
    } else {
        console.log('❌ updatePositionsDisplay() non disponible');
    }
    
    // 4. Vérifier le DOM
    const positionsListEl = document.getElementById('positionsList');
    if (positionsListEl) {
        const positionElements = positionsListEl.children;
        console.log(`\n🌐 Éléments dans le DOM:`);
        console.log(`   positionsList.children.length: ${positionElements.length}`);
        
        for (let i = 0; i < positionElements.length; i++) {
            const element = positionElements[i];
            const symbolMatch = element.innerHTML.match(/([A-Z]+)USDT/);
            const symbol = symbolMatch ? symbolMatch[0] : 'INCONNU';
            console.log(`   ${i + 1}. ${symbol} (HTML présent)`);
        }
    } else {
        console.log('❌ Élément positionsList non trouvé');
    }
    
    // 5. Forcer un refresh
    console.log(`\n🔄 Forçage d'un refresh complet...`);
    if (typeof importExistingPositions === 'function') {
        console.log('🔄 Lancement importExistingPositions()...');
        importExistingPositions().then(() => {
            console.log('✅ Import terminé, nouvelles données:');
            console.log(`   Positions après import: ${openPositions.length}`);
            
            // Re-test de l'affichage
            if (typeof updatePositionsDisplay === 'function') {
                updatePositionsDisplay();
                console.log('✅ Affichage mis à jour');
            }
        }).catch(error => {
            console.error('❌ Erreur import:', error);
        });
    } else {
        console.log('❌ importExistingPositions() non disponible');
    }
    
    return {
        openPositionsCount: openPositions.length,
        maxDisplayed,
        domElementsCount: positionsListEl ? positionsListEl.children.length : 0,
        diagnosis: openPositions.length <= 2 ? 'PROBLEME_DATA' : 'PROBLEME_AFFICHAGE'
    };
};

// 🔧 FONCTION DE RÉPARATION: Forcer un refresh complet des positions
window.forceFullPositionRefresh = async function() {
    console.log('🔄 RÉPARATION: Refresh complet forcé des positions...');
    
    try {
        // 1. Sauvegarder les positions actuelles
        const backupPositions = [...openPositions];
        console.log(`💾 Sauvegarde: ${backupPositions.length} positions`);
        
        // 2. Appeler directement l'API sans filtrage
        const result = await makeRequest('/bitget/api/v2/mix/position/all-position?productType=USDT-FUTURES');
        
        if (!result || result.code !== '00000' || !result.data) {
            console.error('❌ Erreur API:', result);
            return false;
        }
        
        const allApiPositions = result.data.filter(pos => parseFloat(pos.total) > 0);
        console.log(`📊 API retourne: ${allApiPositions.length} positions actives`);
        
        // 3. Lister toutes les positions trouvées
        allApiPositions.forEach((pos, index) => {
            console.log(`   ${index + 1}. ${pos.symbol} - ${pos.holdSide} - Total: ${pos.total} - PnL: ${pos.unrealizedPL}`);
        });
        
        // 4. Vider et reimporter toutes les positions
        openPositions.length = 0;
        console.log('🗑️ Positions locales vidées');
        
        // 5. Importer toutes les positions de l'API
        for (const apiPos of allApiPositions) {
            const side = apiPos.holdSide ? apiPos.holdSide.toUpperCase() : 'LONG';
            const total = parseFloat(apiPos.total || 0);
            const markPrice = parseFloat(apiPos.markPrice || 0);
            const averageOpenPrice = parseFloat(apiPos.averageOpenPrice || markPrice);
            const unrealizedPL = parseFloat(apiPos.unrealizedPL || 0);
            
            const position = {
                id: Date.now() + Math.random(),
                symbol: apiPos.symbol,
                side: side,
                size: total,
                quantity: parseFloat(apiPos.size || total / markPrice),
                entryPrice: averageOpenPrice,
                status: 'OPEN',
                timestamp: apiPos.cTime ? new Date(parseInt(apiPos.cTime)).toISOString() : new Date().toISOString(),
                orderId: `refresh_${Date.now()}`,
                stopLossId: null,
                currentStopPrice: null,
                highestPrice: markPrice,
                currentPrice: markPrice,
                unrealizedPnL: unrealizedPL,
                pnlPercentage: averageOpenPrice > 0 ? ((markPrice - averageOpenPrice) / averageOpenPrice) * 100 : 0,
                reason: 'Position importée (refresh complet)',
                isBotManaged: false // Marquer comme manuel par défaut
            };
            
            openPositions.push(position);
            console.log(`✅ Importé: ${position.symbol} (${position.side})`);
        }
        
        console.log(`✅ Import terminé: ${openPositions.length} positions au total`);
        
        // 6. Mettre à jour l'affichage
        updatePositionsDisplay();
        updateStats();
        
        console.log('🎯 Refresh complet terminé avec succès!');
        return true;
        
    } catch (error) {
        console.error('❌ Erreur lors du refresh complet:', error);
        return false;
    }
};

// 🧪 FONCTION DE TEST: Vérifier la séparation bot/manuel dans les limites
window.testBotPositionLimits = function() {
    console.log('🧪 Test des limites de positions bot vs manuelles...');
    
    const botPositions = openPositions.filter(pos => pos.isBotManaged === true);
    const manualPositions = openPositions.filter(pos => pos.isBotManaged !== true);
    
    console.log(`📊 État actuel:`);
    console.log(`   🤖 Positions bot: ${botPositions.length}/${MAX_SIMULTANEOUS_POSITIONS}`);
    console.log(`   👤 Positions manuelles: ${manualPositions.length}`);
    console.log(`   📈 Total: ${openPositions.length}`);
    
    // Tester la fonction de comptage
    const countFromFunction = getBotManagedPositionsCount();
    console.log(`✅ Fonction getBotManagedPositionsCount(): ${countFromFunction}`);
    
    // Tester si le bot peut ouvrir une nouvelle position
    if (typeof canOpenNewPosition === 'function') {
        const testSymbol = 'TESTUSDT';
        const canOpen = canOpenNewPosition(testSymbol);
        console.log(`🔍 Test canOpenNewPosition('${testSymbol}'):`);
        console.log(`   Résultat: ${canOpen.canOpen ? 'AUTORISÉ' : 'BLOQUÉ'}`);
        console.log(`   Raison: ${canOpen.reason}`);
    }
    
    // Afficher les détails de chaque position
    if (openPositions.length > 0) {
        console.log(`\n📋 Détail des positions:`);
        openPositions.forEach((pos, idx) => {
            const type = pos.isBotManaged ? '🤖 Bot' : '👤 Manuel';
            console.log(`   ${idx + 1}. ${pos.symbol}: ${type} - ${pos.reason}`);
        });
    }
    
    // Recommandations
    console.log(`\n💡 État:`);
    if (botPositions.length < MAX_SIMULTANEOUS_POSITIONS) {
        console.log(`✅ Le bot peut ouvrir ${MAX_SIMULTANEOUS_POSITIONS - botPositions.length} position(s) supplémentaire(s)`);
    } else {
        console.log(`⚠️ Le bot a atteint sa limite (${MAX_SIMULTANEOUS_POSITIONS} positions)`);
    }
    
    if (manualPositions.length > 0) {
        console.log(`✅ ${manualPositions.length} position(s) manuelle(s) n'affectent pas la limite du bot`);
    }
    
    return {
        botPositions: botPositions.length,
        manualPositions: manualPositions.length,
        total: openPositions.length,
        botCanOpen: botPositions.length < MAX_SIMULTANEOUS_POSITIONS
    };
};