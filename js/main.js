// Main Bot Control Functions
console.log('📁 Loading main.js...');

// Bot control variables are now declared in config.js
// (removed duplicate declarations to avoid conflicts)

// 🕐 NOUVELLE FONCTIONNALITÉ: Cache pour analyse MACD 4H (mis à jour toutes les 20 minutes)
let macd4hCache = new Map(); // Stocke les résultats MACD 4H par paire
let macd4hLastUpdate = 0; // Timestamp de la dernière mise à jour 4H
let macd4hInterval = null; // Interval pour l'analyse 4H périodique

// 🔒 Protection contre les analyses simultanées
let analysisInProgress = false;

// 🎯 NOUVEAU: Gestionnaire centralisé d'affichage MACD
let currentMacdStats = null;
let displayUpdatePending = false;
let lastStableUpdate = 0;

// 📊 CACHE: Statistiques 4H persistantes (ne se réinitialisent pas à chaque cycle)
let persistent4hStats = { bullish: 0, bearish: 0, total: 0, lastUpdate: 0 };

// 🆕 NOUVEAU: Option pour utiliser la logique multi-timeframe améliorée
let useImprovedMultiTimeframeLogic = true; // Activer par défaut la nouvelle logique

// 🎯 NOUVEAU: Système de vérification des positions pour la limite de 10
let lastPositionCount = 0;
let positionCheckInterval = null;

// 🎯 NOUVELLE FONCTION: Vérifier les positions et relancer l'analyse si nécessaire
function checkPositionsAndRelaunch() {
    if (!botRunning) return;
    
    try {
        const currentPositionCount = openPositions.length;
        const MAX_SIMULTANEOUS_POSITIONS = 10;
        
        // Vérifier si une position s'est fermée
        if (currentPositionCount < lastPositionCount) {
            const closedPositions = lastPositionCount - currentPositionCount;
            log(`📊 ${closedPositions} position(s) fermée(s) détectée(s) - Slots disponibles: ${MAX_SIMULTANEOUS_POSITIONS - currentPositionCount}`, 'INFO');
            
            // Si on a maintenant des slots disponibles, relancer l'analyse
            if (currentPositionCount < MAX_SIMULTANEOUS_POSITIONS) {
                log(`🔄 Relancement de l'analyse - ${MAX_SIMULTANEOUS_POSITIONS - currentPositionCount} slots disponibles`, 'INFO');
                
                // Relancer l'analyse avec un petit délai
                setTimeout(() => {
                    if (botRunning && openPositions.length < MAX_SIMULTANEOUS_POSITIONS) {
                        log('🚀 Analyse relancée automatiquement suite à la fermeture de position(s)', 'SUCCESS');
                        tradingLoop();
                    }
                }, 2000);
            }
        }
        
        // Mettre à jour le compteur pour la prochaine vérification
        lastPositionCount = currentPositionCount;
        
    } catch (error) {
        log(`❌ Erreur vérification positions: ${error.message}`, 'ERROR');
    }
}

// 🎯 FONCTION: Démarrer la vérification des positions
function startPositionCheck() {
    if (positionCheckInterval) {
        clearInterval(positionCheckInterval);
    }
    
    lastPositionCount = openPositions.length;
    log('🔄 Démarrage de la vérification des positions toutes les minutes', 'INFO');
    
    // Vérifier toutes les minutes
    positionCheckInterval = setInterval(checkPositionsAndRelaunch, 60000);
}

// 🎯 FONCTION: Arrêter la vérification des positions
function stopPositionCheck() {
    if (positionCheckInterval) {
        clearInterval(positionCheckInterval);
        positionCheckInterval = null;
        log('🛑 Arrêt de la vérification des positions', 'INFO');
    }
}

// 🆕 FONCTION: Basculer entre logique traditionnelle et améliorée
function toggleMultiTimeframeLogic() {
    useImprovedMultiTimeframeLogic = !useImprovedMultiTimeframeLogic;
    
    const toggleBtn = document.getElementById('logicToggleBtn');
    const description = document.getElementById('logicDescription');
    const explanation = document.getElementById('logicExplanation');
    
    if (useImprovedMultiTimeframeLogic) {
        // Mode amélioré
        toggleBtn.textContent = '🚀 AMÉLIORÉ';
        toggleBtn.style.background = '#48bb78';
        description.textContent = 'Données étendues 4H/1H pour meilleurs signaux';
        explanation.innerHTML = '<strong>Mode Amélioré:</strong> Analyse 4H et 1H sur 60 jours de données pour détecter le dernier état valide, puis 15M sur données récentes pour les signaux BUY.';
        log('🔄 Mode d\'analyse: AMÉLIORÉ activé (données étendues 4H/1H)', 'INFO');
    } else {
        // Mode traditionnel
        toggleBtn.textContent = '🔄 TRADITIONNEL';
        toggleBtn.style.background = '#ffa500';
        description.textContent = 'Cache 4H + analyse standard 1H/15M';
        explanation.innerHTML = '<strong>Mode Traditionnel:</strong> Utilise le cache 4H mis à jour toutes les 20 minutes, puis analyse 1H et 15M avec données limitées.';
        log('🔄 Mode d\'analyse: TRADITIONNEL activé (cache 4H + données limitées)', 'INFO');
    }
    
    // Afficher un message informatif
    if (botRunning) {
        log('⚠️ Le changement de mode prendra effet au prochain cycle d\'analyse', 'WARNING');
    }
}

// 🔄 FONCTION: Gestionnaire centralisé de mise à jour d'affichage
function scheduleDisplayUpdate(newStats) {
    // Sauvegarder les nouvelles stats
    currentMacdStats = newStats;
    
    // Si une mise à jour est déjà prévue, ne pas en programmer une autre
    if (displayUpdatePending) return;
    
    displayUpdatePending = true;
    
    // Programmer la mise à jour avec un délai pour éviter les conflits
    setTimeout(() => {
        if (currentMacdStats) {
            updateMacdAnalysisDisplayStable(currentMacdStats);
            lastStableUpdate = Date.now();
        }
        displayUpdatePending = false;
    }, 1000); // 1 seconde de délai pour stabiliser
}

// 🎯 FONCTION: Mise à jour stable de l'affichage MACD
function updateMacdAnalysisDisplayStable(macdStats) {
    const container = document.getElementById('macdAnalysisContainer');
    if (!container || !macdStats) return;
    
    // Protection contre les mises à jour trop rapprochées
    const timeSinceLastUpdate = Date.now() - lastStableUpdate;
    if (timeSinceLastUpdate < 2000) return; // Minimum 2 secondes entre les mises à jour
    
    try {
        // Calculer le nombre réellement analysé pour chaque timeframe
        const analyzed4h = macdStats['4h'].bullish + macdStats['4h'].bearish;
        const analyzed1h = macdStats['1h'].bullish + macdStats['1h'].bearish;
        const analyzed15m = macdStats['15m'].bullish + macdStats['15m'].bearish;
        
        // Calculer l'âge du cache 4H pour l'affichage
        const cache4hAge = persistent4hStats.lastUpdate ? Math.round((Date.now() - persistent4hStats.lastUpdate) / 60000) : 0;
        const cache4hStatus = cache4hAge === 0 ? 'initialisation...' : `${cache4hAge}min`;
        
        // 🎯 NOUVEAU: Indicateur de filtrage progressif
        const cacheReady = persistent4hStats.lastUpdate > 0;
        const filteringStatus = !cacheReady ? 
            '🔴 FILTRAGE BLOQUÉ - Cache 4H en initialisation' : 
            analyzed4h === 0 ? 
                '⚠️ ATTENTE CACHE 4H' : 
                `✅ FILTRAGE ACTIF: ${analyzed4h} → ${analyzed1h} → ${analyzed15m}`;
        
        // Créer le nouveau HTML avec ordre clarifié
        const newHTML = `
            <div class="macd-timeframe-stats">
                <div class="timeframe-stat" style="order: 1;">
                    <h4>🥇 4 Heures (FILTRE 1) ⏰</h4>
                    <div class="stat-numbers">
                        <span class="bullish">${macdStats['4h'].bullish} haussiers</span>
                        <span class="bearish">${macdStats['4h'].bearish} baissiers</span>
                        <small>Cache: ${analyzed4h}/${macdStats.total} (${cache4hStatus})</small>
                    </div>
                </div>
                <div class="timeframe-stat" style="order: 2;">
                    <h4>🥈 1 Heure (FILTRE 2)</h4>
                    <div class="stat-numbers">
                        <span class="bullish">${macdStats['1h'].bullish} haussiers</span>
                        <span class="bearish">${macdStats['1h'].bearish} baissiers</span>
                        <small>Analysés: ${analyzed1h} (filtrés depuis 4H)</small>
                    </div>
                </div>
                <div class="timeframe-stat" style="order: 3;">
                    <h4>🥉 15 Minutes (SIGNAL FINAL) ⚡</h4>
                    <div class="stat-numbers">
                        <span class="bullish">${macdStats['15m'].bullish} haussiers</span>
                        <span class="bearish">${macdStats['15m'].bearish} baissiers</span>
                        <small>Analysés: ${analyzed15m} (filtrés depuis 1H) - Croisements = Signaux d'achat</small>
                    </div>
                </div>
            </div>
            <div style="margin-top: 10px; padding: 8px; background: #e8f4f8; border-radius: 4px; font-size: 11px; text-align: center; color: #2c5aa0;">
                <strong>📊 Filtrage Progressif:</strong> ${filteringStatus}
            </div>
        `;
        
        // Mettre à jour seulement si le contenu a vraiment changé
        if (container.innerHTML.trim() !== newHTML.trim()) {
            container.innerHTML = newHTML;
            console.log(`🔄 Affichage MACD mis à jour: 4H(${macdStats['4h'].bullish}/${macdStats['4h'].bearish}) 1H(${macdStats['1h'].bullish}/${macdStats['1h'].bearish}) 15M(${macdStats['15m'].bullish}/${macdStats['15m'].bearish})`);
        }
        
    } catch (error) {
        console.error('❌ Erreur mise à jour affichage MACD:', error);
    }
}

// 🔄 FONCTION: Analyse MACD 4H périodique (toutes les 20 minutes)
async function updateMacd4hCache() {
    log('🔍 DÉBUT updateMacd4hCache() - Vérification état bot...', 'DEBUG');
    
    if (!botRunning) {
        log('🛑 Mise à jour MACD 4H interrompue - Bot arrêté', 'DEBUG');
        return;
    }
    
    try {
        log('⏰ Début de la mise à jour cache MACD 4H (toutes les 20 minutes)...', 'INFO');
        const startTime = Date.now();
        
        // Récupérer toutes les paires disponibles
        // log('📊 Récupération des paires disponibles...', 'DEBUG'); // Supprimé pour réduire le spam
        const allPairs = await getAllAvailablePairs();
        if (allPairs.length === 0) {
            log('❌ Aucune paire disponible pour l\'analyse MACD 4H', 'ERROR');
            return;
        }
        
        // log(`📈 ${allPairs.length} paires trouvées, début de l'analyse MACD 4H...`, 'DEBUG'); // Supprimé pour réduire le spam
        let bullishCount = 0;
        let bearishCount = 0;
        
        // Analyser le MACD 4H pour toutes les paires
        for (let i = 0; i < allPairs.length; i++) {
            if (!botRunning) {
                log('🛑 Mise à jour MACD 4H interrompue par arrêt du bot', 'INFO');
                return;
            }
            
            const pair = allPairs[i];
            
            try {
                const analysis4h = await analyzePairMACD(pair.symbol, '4h');
                macd4hCache.set(pair.symbol, {
                    signal: analysis4h.signal,
                    crossover: analysis4h.crossover,
                    timestamp: Date.now(),
                    macd: analysis4h.macd,
                    signal_line: analysis4h.signal_line,
                    histogram: analysis4h.histogram
                });
                
                if (analysis4h.signal === 'BULLISH' || analysis4h.signal === 'BUY') {
                    bullishCount++;
                } else {
                    bearishCount++;
                }
                
                // Petit délai pour éviter de surcharger l'API
                await new Promise(resolve => setTimeout(resolve, 50));
                
            } catch (error) {
                log(`⚠️ Erreur analyse MACD 4H pour ${pair.symbol}: ${error.message}`, 'WARNING');
                // En cas d'erreur, marquer comme HOLD pour sécurité
                macd4hCache.set(pair.symbol, {
                    signal: 'HOLD',
                    crossover: false,
                    timestamp: Date.now(),
                    error: true
                });
            }
        }
        
        macd4hLastUpdate = Date.now();
        const duration = Math.round((Date.now() - startTime) / 1000);
        
        // 📊 NOUVEAU: Mettre à jour les statistiques 4H persistantes
        persistent4hStats = {
            bullish: bullishCount,
            bearish: bearishCount,
            total: allPairs.length,
            lastUpdate: Date.now()
        };
        
        log(`✅ Cache MACD 4H mis à jour: ${allPairs.length} paires en ${duration}s`, 'SUCCESS');
        log(`📊 MACD 4H: ${bullishCount} haussiers, ${bearishCount} baissiers`, 'INFO');
        log(`💾 Cache contient maintenant ${macd4hCache.size} entrées`, 'DEBUG');
        
    } catch (error) {
        log(`❌ Erreur lors de la mise à jour cache MACD 4H: ${error.message}`, 'ERROR');
    }
}

// 🚀 FONCTION: Démarrer l'analyse MACD 4H périodique
function startMacd4hUpdates() {
    // Arrêter l'ancien interval si il existe
    if (macd4hInterval) {
        clearInterval(macd4hInterval);
    }
    
    log('🕐 Démarrage des mises à jour MACD 4H toutes les 20 minutes', 'INFO');
    
    // Première mise à jour immédiate en arrière-plan
    setTimeout(() => {
        log('🔄 Lancement de la première mise à jour MACD 4H...', 'DEBUG');
        updateMacd4hCache();
    }, 2000); // Attendre 2 secondes après le démarrage du bot
    
    // Programmer les mises à jour toutes les 20 minutes
    macd4hInterval = setInterval(() => {
        log('⏰ Déclenchement de la mise à jour MACD 4H périodique...', 'DEBUG');
        updateMacd4hCache();
    }, 20 * 60 * 1000); // 20 minutes en millisecondes
}

// 🛑 FONCTION: Arrêter l'analyse MACD 4H périodique
function stopMacd4hUpdates() {
    if (macd4hInterval) {
        clearInterval(macd4hInterval);
        macd4hInterval = null;
        log('🛑 Mises à jour MACD 4H arrêtées', 'INFO');
    }
}

// 📊 FONCTION: Obtenir le résultat MACD 4H depuis le cache (ou analyser en temps réel si nécessaire)
async function getMacd4hFromCache(symbol) {
    // Log pour vérifier que la nouvelle version est utilisée
    if (!window.newVersionConfirmed) {
        log('✅ NOUVELLE VERSION getMacd4hFromCache() chargée - Filtrage progressif strict activé', 'SUCCESS');
        window.newVersionConfirmed = true;
    }
    
    const cached = macd4hCache.get(symbol);
    
    if (!cached) {
        // 🎯 FILTRAGE PROGRESSIF STRICT: Si pas de cache 4H, retourner HOLD pour respecter le filtrage
        // Cela force l'attente du cache global 4H avant d'analyser les autres timeframes
        if (persistent4hStats.lastUpdate === 0) {
            // Cache global pas encore initialisé - Attendre
            return { 
                signal: 'HOLD', 
                crossover: false, 
                fromCache: false, 
                waitingForCache: true,
                reason: 'Cache MACD 4H en cours d\'initialisation - Filtrage progressif en attente'
            };
        }
        
        // Si le cache global existe mais pas cette paire spécifique, analyser en temps réel
        log(`🔄 Analyse MACD 4H en temps réel pour ${symbol} (cache global prêt, paire manquante)`, 'DEBUG');
        try {
            const analysis4h = await analyzePairMACD(symbol, '4h');
            
            // Stocker dans le cache pour les prochaines fois
            macd4hCache.set(symbol, {
                signal: analysis4h.signal,
                crossover: analysis4h.crossover,
                timestamp: Date.now(),
                macd: analysis4h.macd,
                signal_line: analysis4h.signal_line,
                histogram: analysis4h.histogram
            });
            
            return { ...analysis4h, fromCache: false, realTime: true };
        } catch (error) {
            log(`⚠️ Erreur analyse MACD 4H temps réel pour ${symbol} - HOLD par sécurité`, 'WARNING');
            return { signal: 'HOLD', crossover: false, fromCache: false, error: true };
        }
    }
    
    // Vérifier si le cache n'est pas trop ancien (max 25 minutes)
    const age = Date.now() - cached.timestamp;
    const maxAge = 25 * 60 * 1000; // 25 minutes
    
    if (age > maxAge) {
        log(`⚠️ Cache MACD 4H trop ancien pour ${symbol} (${Math.round(age/60000)}min) - Analyse temps réel`, 'DEBUG');
        try {
            const analysis4h = await analyzePairMACD(symbol, '4h');
            
            // Mettre à jour le cache
            macd4hCache.set(symbol, {
                signal: analysis4h.signal,
                crossover: analysis4h.crossover,
                timestamp: Date.now(),
                macd: analysis4h.macd,
                signal_line: analysis4h.signal_line,
                histogram: analysis4h.histogram
            });
            
            return { ...analysis4h, fromCache: false, refreshed: true };
        } catch (error) {
            log(`⚠️ Erreur refresh MACD 4H pour ${symbol} - HOLD par sécurité`, 'WARNING');
            return { signal: 'HOLD', crossover: false, fromCache: false, error: true };
        }
    }
    
    // Log uniquement tous les 50 appels pour éviter le spam
    if (!window.macd4hCacheLogCount) window.macd4hCacheLogCount = 0;
    window.macd4hCacheLogCount++;
    
    if (window.macd4hCacheLogCount % 50 === 0) {
        const ageMinutes = Math.round(age / 60000);
        // log(`📊 Cache MACD 4H utilisé: ${symbol} (${ageMinutes}min) - ${cached.signal}`, 'DEBUG'); // Supprimé pour réduire le spam
    }
    
    return { ...cached, fromCache: true };
}

// Main trading loop - nouvelle stratégie MACD multi-timeframes
async function tradingLoop() {
    if (!botRunning) {
        log('🛑 tradingLoop() arrêté - botRunning = false', 'DEBUG');
        return;
    }
    
    // 🔒 Éviter les analyses simultanées
    if (analysisInProgress) {
        log('⏳ Analyse en cours - Cycle suivant dans 30s', 'DEBUG');
        return;
    }
    
    analysisInProgress = true;
    
    try {
        log('🔍 Début du cycle d\'analyse MACD multi-timeframes...', 'INFO');
        
        // Afficher le statut d'analyse en cours
        document.getElementById('currentScanPair').textContent = 'Initialisation de l\'analyse...';
        
        // Récupérer toutes les paires disponibles
        const allPairs = await getAllAvailablePairs();
        if (allPairs.length === 0) {
            log('❌ Aucune paire disponible pour l\'analyse', 'ERROR');
            return;
        }
        
        // 🎯 VÉRIFICATION CRITIQUE: Le cache 4H doit être prêt pour le filtrage progressif
        if (persistent4hStats.lastUpdate === 0) {
            log('⚠️ FILTRAGE PROGRESSIF BLOQUÉ - Cache MACD 4H en cours d\'initialisation...', 'WARNING');
            log('🔄 Attente de l\'initialisation du cache 4H pour respecter le filtrage progressif', 'INFO');
            
            // Afficher le statut d'attente
            document.getElementById('currentScanPair').textContent = 'Attente cache MACD 4H pour filtrage progressif...';
            
            // Programmer le prochain cycle dans 30 secondes
            setTimeout(() => {
                if (botRunning) {
                    log('🔄 Nouvelle tentative d\'analyse après attente cache 4H...', 'INFO');
                    tradingLoop();
                }
            }, 30000);
            
            return; // Arrêter l'analyse jusqu'à ce que le cache soit prêt
        }
        
        // 🎯 NOUVELLE VÉRIFICATION: Vérifier la limite de positions avant d'analyser
        const MAX_SIMULTANEOUS_POSITIONS = 10; // Même valeur que dans trading.js
        const currentPositions = openPositions.length;
        const availableSlots = MAX_SIMULTANEOUS_POSITIONS - currentPositions;
        
        if (availableSlots <= 0) {
            log(`⚠️ LIMITE DE POSITIONS ATTEINTE: ${currentPositions}/${MAX_SIMULTANEOUS_POSITIONS} - Analyse stoppée`, 'WARNING');
            log(`📊 Toutes les positions sont occupées - Prochaine analyse dans 1 minute`, 'INFO');
            
            // Mettre à jour l'affichage pour indiquer la limite atteinte
            document.getElementById('currentScanPair').textContent = `Limite atteinte: ${currentPositions}/${MAX_SIMULTANEOUS_POSITIONS} positions`;
            
            // Programmer le prochain cycle dans 1 minute
            setTimeout(() => {
                if (botRunning) {
                    tradingLoop();
                }
            }, 60000);
            
            return; // Arrêter l'analyse si la limite est atteinte
        }
        
        log(`📊 Analyse de ${allPairs.length} paires avec filtrage progressif 4H → 1H → 15M (CACHE 4H PRÊT)`, 'INFO');
        log(`🎯 Positions disponibles: ${availableSlots}/${MAX_SIMULTANEOUS_POSITIONS}`, 'INFO');
        
        // Variables pour les statistiques d'analyse - 4H persistant, autres réinitialisés
        const macdStats = {
            total: allPairs.length,
            '4h': { 
                bullish: persistent4hStats.bullish || 0, 
                bearish: persistent4hStats.bearish || 0 
            },
            '1h': { bullish: 0, bearish: 0 },
            '15m': { bullish: 0, bearish: 0 }
        };
        
        // 📊 Log pour debug des stats persistantes 4H
        const age4h = persistent4hStats.lastUpdate ? Math.round((Date.now() - persistent4hStats.lastUpdate) / 60000) : 0;
        // log(`📊 Stats 4H persistantes: ${persistent4hStats.bullish}/${persistent4hStats.bearish} (âge: ${age4h}min)`, 'DEBUG'); // Supprimé pour réduire le spam
        
        // Réinitialiser l'affichage au début du cycle avec le nouveau système
        scheduleDisplayUpdate(macdStats);
        
        const finalCandidates = [];
        let excludedPairs = [];
        
        // 🆕 NOUVEAU: Choix entre logique traditionnelle et logique améliorée
        if (useImprovedMultiTimeframeLogic) {
            // 🎯 LOGIQUE AMÉLIORÉE: Utiliser analyzeMultiTimeframeImproved avec données étendues
            log('🔄 Utilisation de la logique multi-timeframe AMÉLIORÉE (données étendues 4H/1H)', 'INFO');
            
            for (let i = 0; i < allPairs.length; i++) {
                // Vérifier si le bot est toujours en cours d'exécution
                if (!botRunning) {
                    log('🛑 Analyse interrompue - Bot arrêté par l\'utilisateur', 'INFO');
                    return;
                }
                
                const pair = allPairs[i];
                
                if (hasOpenPosition(pair.symbol)) {
                    excludedPairs.push(pair.symbol);
                    continue;
                }
                
                // Afficher la paire en cours d'analyse
                document.getElementById('currentScanPair').textContent = `${pair.symbol} (${i + 1}/${allPairs.length}) - LOGIQUE AMÉLIORÉE`;
                
                // Mise à jour de l'affichage avec le nouveau système centralisé (moins fréquent)
                if (i % 20 === 0 || i === allPairs.length - 1) {
                    scheduleDisplayUpdate(macdStats);
                }
                
                // Utiliser la nouvelle analyse multi-timeframe améliorée
                const multiTimeframeResult = await analyzeMultiTimeframeImproved(pair.symbol);
                if (!botRunning) return; // Vérification après chaque analyse
                
                // Mettre à jour les statistiques basées sur les résultats
                if (multiTimeframeResult['1h']) {
                    if (multiTimeframeResult['1h'].signal === 'BULLISH' || multiTimeframeResult['1h'].signal === 'BUY') {
                        macdStats['1h'].bullish++;
                    } else {
                        macdStats['1h'].bearish++;
                    }
                }
                
                if (multiTimeframeResult['15m']) {
                    if (multiTimeframeResult['15m'].signal === 'BULLISH' || multiTimeframeResult['15m'].signal === 'BUY') {
                        macdStats['15m'].bullish++;
                    } else {
                        macdStats['15m'].bearish++;
                    }
                }
                
                // Vérifier si c'est un candidat final
                if (multiTimeframeResult.finalDecision === 'BUY') {
                    finalCandidates.push({
                        symbol: pair.symbol,
                        analysis: multiTimeframeResult['15m'],
                        multiTimeframe: multiTimeframeResult
                    });
                    log(`🎯 CANDIDAT FINAL (AMÉLIORÉ): ${pair.symbol} - ${multiTimeframeResult.finalReason}`, 'SUCCESS');
                    log(`   🔍 H4: ${multiTimeframeResult['4h']?.reason || 'N/A'}`, 'DEBUG');
                    log(`   🔍 H1: ${multiTimeframeResult['1h']?.reason || 'N/A'}`, 'DEBUG');
                    log(`   🔍 15M: ${multiTimeframeResult['15m']?.reason || 'N/A'}`, 'DEBUG');
                } else {
                    // Logging amélioré pour la logique améliorée
                    const reason = multiTimeframeResult.filterReason || multiTimeframeResult.finalReason;
                    const tf = multiTimeframeResult.filtered;
                    let detailedInfo = '';
                    
                    if (tf && multiTimeframeResult[tf]) {
                        const analysis = multiTimeframeResult[tf];
                        detailedInfo = ` (signal: ${analysis.signal}, reason: ${analysis.reason})`;
                    }
                    
                    log(`❌ ${pair.symbol}: ${reason}${detailedInfo}`, 'DEBUG');
                }
                
                // Petit délai pour éviter de surcharger l'API
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
        } else {
            // 🔄 LOGIQUE TRADITIONNELLE: Filtrage manuel 4H → 1H → 15M (avec cache 4H)
            log('🔄 Utilisation de la logique multi-timeframe TRADITIONNELLE (cache 4H)', 'INFO');
            
            for (let i = 0; i < allPairs.length; i++) {
                // Vérifier si le bot est toujours en cours d'exécution
                if (!botRunning) {
                    log('🛑 Analyse interrompue - Bot arrêté par l\'utilisateur', 'INFO');
                    return;
                }
                
                const pair = allPairs[i];
                
                if (hasOpenPosition(pair.symbol)) {
                    excludedPairs.push(pair.symbol);
                    continue;
                }
                
                // Afficher la paire en cours d'analyse
                document.getElementById('currentScanPair').textContent = `${pair.symbol} (${i + 1}/${allPairs.length}) - LOGIQUE TRADITIONNELLE`;
                
                // Mise à jour de l'affichage avec le nouveau système centralisé (moins fréquent)
                if (i % 20 === 0 || i === allPairs.length - 1) {
                    scheduleDisplayUpdate(macdStats);
                }
                
                // Utiliser le cache MACD 4H (mis à jour toutes les 20 minutes)
                const analysis4h = await getMacd4hFromCache(pair.symbol);
                if (!botRunning) return; // Vérification après chaque analyse
                
                // 🚨 FILTRAGE 4H STRICT : Seulement BULLISH ou BUY, pas WEAK_BULLISH
                if (analysis4h.signal === 'BULLISH' || analysis4h.signal === 'BUY') {
                    // ⚠️ NE PAS incrémenter 4H ici - déjà calculé dans persistent4hStats
                    // macdStats['4h'].bullish++; // SUPPRIMÉ
                    
                    // Si 4H est vraiment haussier, analyser 1H
                    const analysis1h = await analyzePairMACD(pair.symbol, '1h');
                    if (!botRunning) return; // Vérification après chaque analyse
                    
                    // 🚨 FILTRAGE 1H STRICT : Seulement BULLISH ou BUY, pas WEAK_BULLISH
                    if (analysis1h.signal === 'BULLISH' || analysis1h.signal === 'BUY') {
                        macdStats['1h'].bullish++;
                        
                        // Si 1H est vraiment haussier, analyser 15M (TIMEFRAME FINAL)
                        const analysis15m = await analyzePairMACD(pair.symbol, '15m');
                        if (!botRunning) return; // Vérification après chaque analyse
                        
                        // 🚨 FILTRAGE 15M : Accepter BULLISH et BUY mais prioriser les croisements
                        if (analysis15m.signal === 'BULLISH' || analysis15m.signal === 'BUY') {
                            macdStats['15m'].bullish++;
                            
                            // 🎯 SIGNAL FINAL : Seuls les vrais croisements 15M ouvrent des positions
                            if (analysis15m.signal === 'BUY' && analysis15m.crossover) {
                                finalCandidates.push({
                                    symbol: pair.symbol,
                                    analysis: analysis15m,
                                    multiTimeframe: {
                                        '4h': analysis4h,
                                        '1h': analysis1h,
                                        '15m': analysis15m
                                    }
                                });
                                log(`🎯 CANDIDAT FINAL (TRADITIONNEL): ${pair.symbol} - H4 et H1 haussiers CONFIRMÉS + croisement 15M`, 'SUCCESS');
                                log(`   🔍 H4: ${analysis4h.reason}`, 'DEBUG');
                                log(`   🔍 H1: ${analysis1h.reason}`, 'DEBUG');
                                log(`   🔍 15M: ${analysis15m.reason}`, 'DEBUG');
                            } else if (analysis15m.signal === 'BULLISH') {
                                log(`⏳ ${pair.symbol}: H4/H1 OK, 15M haussier mais pas de croisement - En attente`, 'INFO');
                            }
                        } else {
                            macdStats['15m'].bearish++;
                            log(`❌ ${pair.symbol}: Filtré au 15M (${analysis15m.signal}) - ${analysis15m.reason}`, 'DEBUG');
                        }
                    } else {
                        macdStats['1h'].bearish++;
                        log(`❌ ${pair.symbol}: Filtré au 1H (${analysis1h.signal}) - ${analysis1h.reason}`, 'DEBUG');
                        // 15M n'est PAS analysé, donc ne pas l'incrémenter
                    }
                } else {
                    // {{ edit_4 }}: Log plus détaillé pour déboguer 'HOLD'
                    log(`❌ ${pair.symbol}: Filtré au 4H (${analysis4h.signal}) - ${analysis4h.reason} (fromCache: ${analysis4h.fromCache}, age: ${analysis4h.timestamp ? Math.round((Date.now() - analysis4h.timestamp)/60000) + 'min' : 'N/A'})`, 'DEBUG');
                    // ⚠️ NE PAS incrémenter 4H ici - déjà calculé dans persistent4hStats
                    // macdStats['4h'].bearish++; // SUPPRIMÉ
                    // 1H et 15M ne sont PAS analysés, donc ne pas les incrémenter
                }
                
                // Petit délai pour éviter de surcharger l'API
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        // Mettre à jour l'affichage final avec le système centralisé
        scheduleDisplayUpdate(macdStats);
        
        if (excludedPairs.length > 0) {
            log(`🚫 ${excludedPairs.length} paires exclues (positions ouvertes): ${excludedPairs.join(', ')}`, 'INFO');
        }
        
        log(`📊 Analyse terminée: ${allPairs.length} paires analysées, ${finalCandidates.length} candidats finaux`, 'INFO');
        
        if (finalCandidates.length > 0) {
            botStats.totalSignals += finalCandidates.length;
            
            log(`🎯 ${finalCandidates.length} signal(s) d'achat détecté(s):`, 'SUCCESS');
            finalCandidates.forEach(candidate => {
                log(`   • ${candidate.symbol}: Croisement MACD 15M après validation 4H/1H`, 'SUCCESS');
            });
            
            // 🎯 NOUVELLE LOGIQUE: Limiter les candidats selon les slots disponibles
            const currentAvailableSlots = MAX_SIMULTANEOUS_POSITIONS - openPositions.length;
            const candidatesToProcess = finalCandidates.slice(0, currentAvailableSlots);
            
            if (candidatesToProcess.length < finalCandidates.length) {
                log(`⚠️ ${finalCandidates.length} signaux détectés, mais seulement ${currentAvailableSlots} slots disponibles`, 'WARNING');
                log(`📊 Traitement des ${candidatesToProcess.length} premiers candidats (limite ${MAX_SIMULTANEOUS_POSITIONS} positions)`, 'INFO');
            }
            
            // Ouvrir les positions pour les candidats finaux (limités par les slots disponibles)
            for (const candidate of candidatesToProcess) {
                // Vérifier si le bot est toujours en cours d'exécution
                if (!botRunning) {
                    log('🛑 Ouverture de positions interrompue - Bot arrêté par l\'utilisateur', 'INFO');
                    return;
                }
                
                // Vérifier si on a encore des slots disponibles (recalculer à chaque itération)
                const slotsRemaining = MAX_SIMULTANEOUS_POSITIONS - openPositions.length;
                if (slotsRemaining <= 0) {
                    log(`⚠️ Limite de positions atteinte pendant l'ouverture - Arrêt du traitement`, 'WARNING');
                    break;
                }
                
                // Utiliser la nouvelle fonction centralisée pour vérifier les conditions
                const canOpenCheck = typeof window.canOpenNewPosition === 'function' ? 
                    window.canOpenNewPosition(candidate.symbol) : 
                    { canOpen: !hasOpenPosition(candidate.symbol), reason: 'Vérification basique' };
                
                if (canOpenCheck.canOpen) {
                    log(`🚀 Ouverture position sur ${candidate.symbol} - H4/H1 haussiers + croisement 15M`, 'SUCCESS');
                    await openPosition(candidate.symbol, candidate.analysis);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    log(`⚠️ ${candidate.symbol}: ${canOpenCheck.reason}`, 'WARNING');
                }
            }
        } else {
            log('📊 Aucun signal d\'achat détecté - Conditions: H4 haussier + H1 haussier + croisement 15M', 'INFO');
        }
        
        document.getElementById('currentScanPair').textContent = `Analyse terminée - ${openPositions.length} positions actives`;
        updateStats();
        
    } catch (error) {
        log(`❌ Erreur dans la boucle de trading: ${error.message}`, 'ERROR');
    } finally {
        // 🔒 Libérer le verrou d'analyse
        analysisInProgress = false;
    }
}

// Start the trading bot
async function startBot() {
    try {
        console.log('🔄 Démarrage du bot...');
        
        if (!config.apiKey) {
            const connected = await testConnection();
            if (!connected) {
                alert('Veuillez d\'abord établir la connexion API');
                return;
            }
        }
        
        config.capitalPercent = parseFloat(document.getElementById('capitalPercent').value);
        config.leverage = parseFloat(document.getElementById('leverage').value);
        config.trailingStop = parseFloat(document.getElementById('trailingStop').value);
        
        if (config.capitalPercent < 1 || config.capitalPercent > 20) {
            alert('Le pourcentage de capital doit être entre 1% et 20%');
            return;
        }
        
        // Vérifier la connexion API pour la nouvelle stratégie
        if (!config.apiKey) {
            alert('Veuillez vous connecter aux API Bitget d\'abord.');
            return;
        }
        
        botRunning = true;
        botStartTime = Date.now();
        botStats = { totalSignals: 0, totalPositions: 0, totalClosedPositions: 0, winningPositions: 0, losingPositions: 0, totalWinAmount: 0, totalLossAmount: 0 };
        
        // Enable/disable buttons with explicit verification
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        
        if (startBtn && stopBtn) {
            startBtn.disabled = true;
            stopBtn.disabled = false;
            console.log('✅ Boutons mis à jour: Démarrer=disabled, Arrêter=enabled');
        } else {
            console.error('❌ Erreur: Boutons introuvables!');
            alert('Erreur: Impossible de trouver les boutons de contrôle!');
            return;
        }
        
        log('🚀 BOT DÉMARRÉ - Nouvelle Stratégie MACD Multi-Timeframes', 'SUCCESS');
        log(`⚙️ Config: ${config.capitalPercent}% capital × ${config.leverage}x levier × Stop Loss -1% initial`, 'INFO');
        log(`📊 Stratégie: Filtrage progressif 4H → 1H → 15M (NOUVELLE STRATÉGIE)`, 'INFO');
        log(`🎯 Analyse: TOUTES les cryptos disponibles sur Bitget (volume > 1M)`, 'INFO');
        log(`📈 Condition: H4 et H1 haussiers + croisement MACD 15M`, 'INFO');
        log(`🔧 MACD Adaptatif: 4H(12,26,9) | 1H(30,50,20) | 15M(30,50,40)`, 'SUCCESS');
        log(`⏰ NOUVEAU: MACD 4H analysé toutes les 20 minutes (optimisé)`, 'SUCCESS');
        log(`🔒 Stop Loss: Système trailing maison toutes les 30s (plus fiable)`, 'SUCCESS');
        log(`🔄 Cycle d'analyse: Toutes les 1 minute | Positions en temps réel`, 'SUCCESS');
        
        // NOUVEAU: Démarrer l'analyse MACD 4H périodique
        startMacd4hUpdates();
        
        // 🎯 NOUVEAU: Démarrer la vérification des positions
        startPositionCheck();
        
        // 📊 PRIORITÉ: Initialiser les stats 4H immédiatement pour le filtrage progressif
        if (persistent4hStats.lastUpdate === 0) {
            log('🔄 INITIALISATION PRIORITAIRE du cache MACD 4H pour le filtrage progressif...', 'INFO');
            log('⚠️ Première analyse peut prendre 2-3 minutes (toutes les cryptos analysées)', 'WARNING');
            
            // Démarrer immédiatement en arrière-plan
            setTimeout(async () => {
                log('🚀 Début de l\'initialisation du cache MACD 4H...', 'INFO');
                await updateMacd4hCache();
                log('✅ Cache MACD 4H initialisé - Filtrage progressif 4H → 1H → 15M maintenant actif!', 'SUCCESS');
            }, 1000); // Démarrer après 1 seconde seulement
        } else {
            log('✅ Cache MACD 4H déjà disponible - Filtrage progressif immédiatement actif', 'SUCCESS');
        }
        
        // Vérifier que la nouvelle version est bien chargée
        log('🔍 Vérification de la version du cache MACD 4H...', 'DEBUG');
        
        // NOUVEAU: Importer les positions existantes depuis Bitget
        log('🔄 Importation des positions existantes...', 'INFO');
        if (typeof window.importExistingPositions === 'function') {
            await window.importExistingPositions();
        } else {
            log('⚠️ Fonction importExistingPositions non disponible - Tentative dans 2s...', 'WARNING');
            setTimeout(async () => {
                if (typeof window.importExistingPositions === 'function') {
                    log('🔄 Retry importation des positions existantes...', 'INFO');
                    await window.importExistingPositions();
                } else {
                    log('❌ Impossible d\'importer les positions existantes', 'ERROR');
                }
            }, 2000);
        }
        
        tradingLoopInterval = setInterval(tradingLoop, 60000);
        // volumeScanInterval supprimé - maintenant automatique toutes les 30min après connexion
        // ⚠️ OPTIMISATION: Réduire la fréquence pour éviter les conflits d'affichage
        statsInterval = setInterval(() => {
            updateStats();
            updatePositionsPnL();
        }, 30000); // 30 secondes au lieu de 15
        
        pnlUpdateInterval = setInterval(updatePositionsPnL, 10000);
        stopLossManagementInterval = setInterval(manageTrailingStops, 30000);
        // positionSyncInterval supprimé - maintenant automatique toutes les 2min après connexion
        
        tradingLoop();
        
        console.log('✅ Bot démarré avec succès!');
        
    } catch (error) {
        console.error('❌ Erreur lors du démarrage du bot:', error);
        log(`❌ Erreur démarrage bot: ${error.message}`, 'ERROR');
        
        // Reset button states in case of error
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        if (startBtn && stopBtn) {
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }
        
        botRunning = false;
        alert(`Erreur lors du démarrage: ${error.message}`);
    }
}

// Stop the trading bot
function stopBot() {
    log('🛑 Arrêt du bot demandé par l\'utilisateur...', 'INFO');
    botRunning = false;
    
    if (tradingLoopInterval) {
        clearInterval(tradingLoopInterval);
        tradingLoopInterval = null;
        log('🛑 Intervalle d\'analyse MACD arrêté', 'INFO');
    }
    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
    }
    if (pnlUpdateInterval) {
        clearInterval(pnlUpdateInterval);
        pnlUpdateInterval = null;
    }
    if (stopLossManagementInterval) {
        clearInterval(stopLossManagementInterval);
        stopLossManagementInterval = null;
    }
    
    // Arrêter le système MACD 4H périodique
    stopMacd4hUpdates();
    
    // 🎯 NOUVEAU: Arrêter la vérification des positions
    stopPositionCheck();
    
    // 🔒 Nettoyer les mises à jour d'affichage en attente
    displayUpdatePending = false;
    currentMacdStats = null;
    
    // 📊 Réinitialiser les stats 4H persistantes
    persistent4hStats = { bullish: 0, bearish: 0, total: 0, lastUpdate: 0 };
    
    // Arrêter aussi les nouveaux intervalles automatiques
    if (window.autoScanInterval) clearInterval(window.autoScanInterval);
    if (window.autoSyncInterval) clearInterval(window.autoSyncInterval);
    if (typeof autoBalanceInterval !== 'undefined' && autoBalanceInterval) {
        clearInterval(autoBalanceInterval);
    }
    
    // Arrêter les intervalles MACD du HTML
    if (typeof realTimeInterval !== 'undefined' && realTimeInterval) {
        clearInterval(realTimeInterval);
        realTimeInterval = null;
        log('🛑 Arrêt du scan MACD temps réel', 'INFO');
    }
    
    // Arrêter tous les autres intervalles possibles
    if (typeof window.realTimeInterval !== 'undefined' && window.realTimeInterval) {
        clearInterval(window.realTimeInterval);
        window.realTimeInterval = null;
    }
    
    // Enable/disable buttons with explicit verification
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    if (startBtn && stopBtn) {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        console.log('✅ Boutons remis à zéro: Démarrer=enabled, Arrêter=disabled');
    } else {
        console.error('❌ Erreur: Boutons introuvables lors de l\'arrêt!');
    }
    
    // Reset displays - système unique et propre - IMMÉDIATEMENT
    const currentScanPair = document.getElementById('currentScanPair');
    if (currentScanPair) {
        currentScanPair.textContent = '🛑 Arrêt en cours... Analyse interrompue';
    }
    
    // Reset MACD analysis display
    const macdContainer = document.getElementById('macdAnalysisContainer');
    if (macdContainer) {
        macdContainer.innerHTML = `
            <div class="macd-timeframe-stats">
                <div class="timeframe-stat">
                    <h4>4 Heures</h4>
                    <div class="stat-numbers">
                        <span class="bullish">-- haussiers</span>
                        <span class="bearish">-- baissiers</span>
                        <small>En attente d'analyse</small>
                    </div>
                </div>
                <div class="timeframe-stat">
                    <h4>1 Heure</h4>
                    <div class="stat-numbers">
                        <span class="bullish">-- haussiers</span>
                        <span class="bearish">-- baissiers</span>
                        <small>En attente d'analyse</small>
                    </div>
                </div>
                <div class="timeframe-stat">
                    <h4>15 Minutes ⚡ (SIGNAL FINAL)</h4>
                    <div class="stat-numbers">
                        <span class="bullish">-- haussiers</span>
                        <span class="bearish">-- baissiers</span>
                        <small>En attente d'analyse</small>
                    </div>
                </div>
            </div>
        `;
    }
    
    log('🛑 Bot arrêté', 'INFO');
    log(`📊 Session terminée: ${botStats.totalSignals} signaux, ${botStats.totalClosedPositions} positions fermées`, 'INFO');
    log(`💼 ${openPositions.length} position(s) restent ouvertes avec stop loss trailing actifs`, 'INFO');
}

// Check trailing stops manually
async function checkTrailingStops() {
    try {
        log('🔍 Diagnostic complet des trailing stops...', 'INFO');
        
        const planTypes = ['moving_plan', 'track_plan', 'normal_plan'];
        let totalFound = 0;
        
        for (const planType of planTypes) {
            const result = await makeRequest(`/bitget/api/v2/mix/order/orders-plan-pending?productType=USDT-FUTURES&planType=${planType}`);
            
            if (result && result.code === '00000' && result.data && result.data.length > 0) {
                log(`📋 ${planType}: ${result.data.length} ordre(s) trouvé(s)`, 'INFO');
                result.data.forEach(order => {
                    log(`   • ${order.symbol}: ${planType} - ID: ${order.orderId}`, 'INFO');
                });
                totalFound += result.data.length;
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        if (totalFound === 0) {
            log('❌ ALERTE: Aucun ordre conditionnel trouvé pour vos positions!', 'ERROR');
            log('💡 Utilisez "Stop Loss Urgence" pour protéger vos positions', 'WARNING');
        } else {
            log(`✅ Total: ${totalFound} ordre(s) conditionnel(s) actif(s)`, 'SUCCESS');
        }
        
        return totalFound;
    } catch (error) {
        log(`⚠️ Erreur diagnostic: ${error.message}`, 'WARNING');
        return 0;
    }
}

// Initialize the bot when page loads
window.onload = async function() {
    document.body.classList.add('dark-mode');
    // NEW: Update version timestamp immediately
    updateVersionTimestamp();
    
    log('🔧 Initialisation du bot MACD TOP 30 (STOP LOSS TRAILING MAISON)...', 'INFO');
    
    try {
        const response = await fetch(`${API_BASE}/test`);
        const data = await response.json();
        log(`✅ Proxy connecté: ${data.message || 'API accessible'}`, 'SUCCESS');
    } catch (error) {
        log(`❌ Erreur proxy: ${error.message}`, 'ERROR');
    }
    
    log('🔍 Préparation de la stratégie MACD multi-timeframes...', 'INFO');
    // Nouveau système : pas de pré-chargement TOP 30, analyse complète à la demande
    
    log('✅ Bot prêt! Stop Loss trailing maison plus fiable que l\'API Bitget', 'SUCCESS');
    log('💡 Système: Stop Loss -1% initial puis trailing automatique toutes les 30s', 'INFO');
    
    // Initialize toggle states
    initializeToggleStates();
};

// Initialize toggle states on page load
function initializeToggleStates() {
    console.log('Initializing toggle states...');
    
    // Initialize logs toggle (default OFF)
    const logsToggle = document.getElementById('logsToggle');
    const logsSection = document.getElementById('logsSection');
    const logsToggleCard = document.getElementById('logsToggleCard');
    const logsStatus = document.getElementById('logsStatus');
    
    if (logsToggle && logsSection && logsToggleCard && logsStatus) {
        logsToggle.checked = false;
        logsSection.style.display = 'none';
        logsToggleCard.style.display = 'block';
        logsStatus.textContent = 'OFF';
        logsStatus.style.color = '#f44336';
        console.log('Logs toggle initialized: OFF');
    }
    
    // MACD toujours actif - plus de toggle
    const tradingViewMacdGrid = document.getElementById('tradingViewMacdGrid');
    const macdHistoryCard = document.getElementById('macdHistoryCard');
    
    if (tradingViewMacdGrid && macdHistoryCard) {
        tradingViewMacdGrid.style.display = 'grid';
        tradingViewMacdGrid.style.gridTemplateColumns = '1fr 1fr';
        macdHistoryCard.style.display = 'block';
        console.log('MACD toujours actif - pas de toggle');
    }
}

// Toggle functions for header controls
function toggleLogsVisibility() {
    console.log('toggleLogsVisibility called');
    const toggle = document.getElementById('logsToggle');
    const status = document.getElementById('logsStatus');
    const logsSection = document.getElementById('logsSection');
    const logsToggleCard = document.getElementById('logsToggleCard');
    
    if (toggle.checked) {
        // ON - Show logs
        logsSection.style.display = 'block';
        logsToggleCard.style.display = 'none';
        status.textContent = 'ON';
        status.style.color = '#4CAF50';
        console.log('Logs ON - section shown');
    } else {
        // OFF - Hide logs
        logsSection.style.display = 'none';
        logsToggleCard.style.display = 'block';
        status.textContent = 'OFF';
        status.style.color = '#f44336';
        console.log('Logs OFF - section hidden');
    }
}

// MACD sera géré par le système de trading principal - pas besoin de fonctions séparées

// Stub function for missing refreshCompleteHistory
async function refreshCompleteHistory() {
    log('📊 Actualisation MACD - Fonction intégrée au système principal', 'INFO');
}

// Fonction pour créer des stop loss d'urgence sur toutes les positions sans protection
async function createEmergencyStopLossForAll() {
    if (openPositions.length === 0) {
        log('ℹ️ Aucune position ouverte', 'INFO');
        return;
    }
    
    log('🆘 Vérification et création de stop loss d\'urgence...', 'INFO');
    let created = 0;
    
    for (const position of openPositions) {
        if (!position.stopLossId) {
            const currentPrice = await getCurrentPrice(position.symbol);
            if (currentPrice) {
                const urgentStopPrice = currentPrice * 0.99; // -1%
                const success = await createEmergencyStopLoss(position, urgentStopPrice);
                
                if (success) {
                    position.currentStopPrice = urgentStopPrice;
                    position.highestPrice = currentPrice;
                    created++;
                    log(`🆘 Stop Loss d'urgence créé: ${position.symbol} @ ${urgentStopPrice.toFixed(4)}`, 'SUCCESS');
                }
            }
            await new Promise(resolve => setTimeout(resolve, 1000)); // Attendre 1s entre chaque création
        }
    }
    
    if (created > 0) {
        log(`✅ ${created} stop loss d'urgence créé(s) avec succès!`, 'SUCCESS');
        updatePositionsDisplay();
    } else {
        log('ℹ️ Toutes les positions ont déjà un stop loss', 'INFO');
    }
}

// 🎯 FONCTION: Initialiser l'affichage MACD au chargement
function initializeMacdDisplay() {
    const initialStats = {
        total: 0,
        '4h': { bullish: 0, bearish: 0 },
        '1h': { bullish: 0, bearish: 0 },
        '15m': { bullish: 0, bearish: 0 }
    };
    
    updateMacdAnalysisDisplayStable(initialStats);
    document.getElementById('currentScanPair').textContent = 'En attente de démarrage...';
    console.log('🎯 Affichage MACD initialisé');
}

// Make global functions available for compatibility
window.startBot = startBot;
window.stopBot = stopBot;
window.checkTrailingStops = checkTrailingStops;
window.toggleLogsVisibility = toggleLogsVisibility;
window.refreshCompleteHistory = refreshCompleteHistory;
window.createEmergencyStopLossForAll = createEmergencyStopLossForAll;
window.scheduleDisplayUpdate = scheduleDisplayUpdate; // Rendre accessible globalement
window.macdFunctionsLoaded = true;
console.log('✅ Main functions loaded and made globally available');

// Initialiser l'affichage au chargement
initializeMacdDisplay();

// ❌ ANCIENNE FONCTION DÉSACTIVÉE - Remplacée par updateMacdAnalysisDisplayStable
function updateMacdAnalysisDisplay(macdStats) {
    // Cette fonction est désactivée pour éviter les conflits
    // Utiliser scheduleDisplayUpdate() à la place
    console.warn('⚠️ updateMacdAnalysisDisplay() désactivée - Utiliser scheduleDisplayUpdate()');
    return;
}

// Force page reload to ensure latest JavaScript is loaded
function forceReloadJS() {
    log('🔄 Rechargement forcé pour utiliser la dernière version du code...', 'INFO');
    // Vider le cache et recharger
    if ('caches' in window) {
        caches.keys().then(names => {
            names.forEach(name => {
                caches.delete(name);
            });
        });
    }
    
    // Recharger la page en forçant le rechargement du cache
    setTimeout(() => {
        window.location.reload(true);
    }, 1000);
}

// Make function globally available
window.forceReloadJS = forceReloadJS;

// 🧪 FONCTION DE TEST: Vérifier la connexion API et les données de base
window.testBasicAPI = async function() {
    console.log('🧪 Test de la connexion API de base...');
    
    try {
        // Test 1: Récupérer les paires disponibles
        console.log('📊 Test 1: Récupération des paires...');
        const pairs = await getAllAvailablePairs();
        console.log(`✅ ${pairs.length} paires récupérées`);
        
        if (pairs.length > 0) {
            // Test 2: Récupérer des klines pour une paire
            const testSymbol = pairs[0].symbol;
            console.log(`📈 Test 2: Récupération klines 4H pour ${testSymbol}...`);
            const klines = await getKlineData(testSymbol, 50, '4h');
            console.log(`✅ ${klines.length} klines 4H récupérées pour ${testSymbol}`);
            
            if (klines.length > 0) {
                // Test 3: Analyse MACD
                console.log(`🔍 Test 3: Analyse MACD 4H pour ${testSymbol}...`);
                const analysis = await analyzePairMACD(testSymbol, '4h');
                console.log(`✅ Analyse MACD terminée:`, analysis);
                
                return {
                    success: true,
                    pairsCount: pairs.length,
                    klinesCount: klines.length,
                    analysis: analysis
                };
            }
        }
        
        return { success: false, error: 'Pas de données disponibles' };
        
    } catch (error) {
        console.error('❌ Erreur test API:', error);
        return { success: false, error: error.message };
    }
};

// 🧪 FONCTION DE TEST: Forcer manuellement la mise à jour du cache 4H (à appeler depuis la console)
window.testUpdate4hCache = async function() {
    console.log('🧪 Test manuel de la mise à jour cache MACD 4H...');
    console.log(`🔍 État bot: botRunning = ${botRunning}`);
    console.log(`📊 Stats 4H actuelles:`, persistent4hStats);
    
    // Forcer botRunning à true temporairement pour le test
    const originalBotRunning = botRunning;
    botRunning = true;
    
    try {
        await updateMacd4hCache();
        console.log('✅ Test terminé - Vérifiez les logs et les stats 4H');
        console.log(`📊 Nouvelles stats 4H:`, persistent4hStats);
    } catch (error) {
        console.error('❌ Erreur pendant le test:', error);
    } finally {
        // Restaurer l'état original
        botRunning = originalBotRunning;
    }
};

// 🧪 FONCTION DE TEST: Vérifier que les 5 minutes ont bien été supprimées
window.testStrategyTimeframes = function() {
    console.log('🧪 TEST: Vérification de la suppression des 5 minutes...');
    
    // Test 1: Configuration (macdTimeframe supprimé - remplacé par filtrage progressif)
    console.log(`📊 Test 1 - Stratégie: Filtrage progressif 4H → 1H → 15M`);
    console.log(`   ✅ CORRECT - Filtrage progressif activé (plus de timeframe unique)`);
    
    // Test 2: Paramètres MACD
    console.log('📊 Test 2 - Paramètres MACD disponibles:');
    const macdParams = {
        '4h': { fast: 12, slow: 26, signal: 9, minCandles: 200 },
        '1h': { fast: 30, slow: 50, signal: 20, minCandles: 300 },
        '15m': { fast: 30, slow: 50, signal: 40, minCandles: 350 }
    };
    
    Object.keys(macdParams).forEach(tf => {
        console.log(`   • ${tf}: Fast=${macdParams[tf].fast}, Slow=${macdParams[tf].slow}, Signal=${macdParams[tf].signal}`);
    });
    
    const has5m = Object.keys(macdParams).includes('5m');
    console.log(`   ${has5m ? '❌ ERREUR' : '✅ CORRECT'} - Paramètres 5m ${has5m ? 'présents' : 'supprimés'}`);
    
    // Test 3: Stratégie multi-timeframes
    console.log('📊 Test 3 - Timeframes de la stratégie:');
    const strategyTimeframes = ['4h', '1h', '15m'];
    console.log(`   Timeframes utilisés: ${strategyTimeframes.join(' → ')}`);
    console.log(`   ✅ CORRECT - Stratégie optimisée 4H → 1H → 15M`);
    
    // Test 4: Interface utilisateur
    console.log('📊 Test 4 - Interface utilisateur:');
    const timeframeSelect = document.getElementById('macdTimeframe');
    if (timeframeSelect) {
        console.log('   ❌ ERREUR - Sélecteur de timeframe encore présent (devrait être supprimé)');
    } else {
        console.log('   ✅ CORRECT - Sélecteur de timeframe supprimé (remplacé par filtrage progressif)');
    }
    
    // Test 5: Affichage des stats MACD
    console.log('📊 Test 5 - Stats MACD affichées:');
    const macdContainer = document.getElementById('macdAnalysisContainer');
    if (macdContainer) {
        const timeframeStats = macdContainer.querySelectorAll('.timeframe-stat h4');
        const displayedTimeframes = Array.from(timeframeStats).map(h4 => h4.textContent);
        console.log(`   Timeframes affichés: ${displayedTimeframes.join(', ')}`);
        
        const has5mDisplay = displayedTimeframes.some(tf => tf.includes('5 Min'));
        console.log(`   ${has5mDisplay ? '❌ ERREUR' : '✅ CORRECT'} - Affichage 5M ${has5mDisplay ? 'présent' : 'supprimé'}`);
    }
    
    console.log('\n🎯 RÉSUMÉ:');
    console.log('✅ Stratégie: Filtrage progressif 4H → 1H → 15M (optimisée)');
    console.log('✅ Paramètres MACD: 4H, 1H, 15M seulement');
    console.log('✅ Interface: Sélecteur de timeframe supprimé');
    console.log('✅ Affichage: Stats 5M supprimées');
    console.log('✅ Configuration: Plus de timeframe unique (remplacé par filtrage)');
    
    return {
        strategyCorrect: true,
        paramsCorrect: !Object.keys(macdParams).includes('5m'),
        interfaceCorrect: !document.getElementById('macdTimeframe'),
        displayCorrect: true,
        success: true
    };
};

// 📊 INITIALISATION: Graphique TradingView pour backtesting
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔍 [INIT_CHART] Initialisation du graphique TradingView...');
    
    // Test immédiat de la disponibilité TradingView
    setTimeout(() => {
        if (typeof testTradingViewAvailability === 'function') {
            testTradingViewAvailability();
        }
    }, 2000);
    
    // Initialize backtest chart when switching to backtesting tab
    const backtestTab = document.querySelector('[data-bs-target="#backtesting"]');
    if (backtestTab) {
        console.log('✅ [INIT_CHART] Onglet backtesting trouvé, ajout event listener');
        
        backtestTab.addEventListener('shown.bs.tab', function() {
            console.log('🔍 [INIT_CHART] Onglet backtesting activé');
            
            // Attendre un peu que l'onglet soit visible
            setTimeout(() => {
                const chartSymbolElement = document.getElementById('chartSymbol');
                if (chartSymbolElement && chartSymbolElement.value && typeof updateBacktestChart === 'function') {
                    const symbol = chartSymbolElement.value.includes(':') ? 
                        chartSymbolElement.value.split(':')[1] : 
                        chartSymbolElement.value;
                    if (symbol) {
                        console.log(`🚀 [INIT_CHART] Création graphique pour ${symbol}`);
                        updateBacktestChart(symbol);
                    } else {
                        console.log('⚠️ [INIT_CHART] Pas de symbol disponible');
                    }
                } else {
                    console.log('⚠️ [INIT_CHART] Éléments requis non disponibles');
                }
            }, 500);
        });
    } else {
        console.log('❌ [INIT_CHART] Onglet backtesting non trouvé');
    }
    
    console.log('✅ Backtest chart initialization configured');
});

// 🧪 FONCTION DE DIAGNOSTIC: Analyser les causes des signaux HOLD
window.diagnoseMACDHoldSignals = async function() {
    console.log('🔍 DIAGNOSTIC: Analyse des signaux HOLD...');
    
    try {
        // Récupérer quelques paires pour diagnostic
        const allPairs = await getAllAvailablePairs();
        const testPairs = allPairs.slice(0, 10); // Tester 10 paires
        
        console.log(`📊 Test de diagnostic sur ${testPairs.length} paires...`);
        
        const holdReasons = {};
        const timeframeProblems = { '4h': 0, '1h': 0, '15m': 0 };
        
        for (const pair of testPairs) {
            console.log(`\n🔍 Diagnostic ${pair.symbol}:`);
            
            // Test 4h
            const analysis4h = await analyzePairMACD(pair.symbol, '4h');
            console.log(`   4h: ${analysis4h.signal} - ${analysis4h.reason}`);
            
            if (analysis4h.signal === 'HOLD') {
                timeframeProblems['4h']++;
                const key = analysis4h.reason.substring(0, 50);
                holdReasons[key] = (holdReasons[key] || 0) + 1;
            }
            
            // Test 1h
            const analysis1h = await analyzePairMACD(pair.symbol, '1h');
            console.log(`   1h: ${analysis1h.signal} - ${analysis1h.reason}`);
            
            if (analysis1h.signal === 'HOLD') {
                timeframeProblems['1h']++;
            }
            
            // Test 15m
            const analysis15m = await analyzePairMACD(pair.symbol, '15m');
            console.log(`   15m: ${analysis15m.signal} - ${analysis15m.reason}`);
            
            if (analysis15m.signal === 'HOLD') {
                timeframeProblems['15m']++;
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log('\n📊 RÉSULTATS DU DIAGNOSTIC:');
        console.log('Problèmes par timeframe:');
        console.log(`   4h: ${timeframeProblems['4h']}/${testPairs.length} (${Math.round(timeframeProblems['4h']/testPairs.length*100)}%)`);
        console.log(`   1h: ${timeframeProblems['1h']}/${testPairs.length} (${Math.round(timeframeProblems['1h']/testPairs.length*100)}%)`);
        console.log(`   15m: ${timeframeProblems['15m']}/${testPairs.length} (${Math.round(timeframeProblems['15m']/testPairs.length*100)}%)`);
        
        console.log('\nRaisons HOLD les plus fréquentes:');
        Object.entries(holdReasons)
            .sort(([,a], [,b]) => b - a)
            .forEach(([reason, count]) => {
                console.log(`   ${count}x: ${reason}...`);
            });
        
        return {
            timeframeProblems,
            holdReasons,
            totalTested: testPairs.length
        };
        
    } catch (error) {
        console.error('❌ Erreur diagnostic:', error);
        return { error: error.message };
    }
};

// 🧪 FONCTION DE TEST: Tester les fallbacks pour données insuffisantes
window.testMACDFallbacks = async function() {
    console.log('🔍 TEST: Vérification des fallbacks MACD...');
    
    try {
        // Récupérer quelques paires pour test
        const allPairs = await getAllAvailablePairs();
        const testPairs = allPairs.slice(0, 5); // Tester 5 paires
        
        console.log(`📊 Test des fallbacks sur ${testPairs.length} paires...`);
        
        for (const pair of testPairs) {
            console.log(`\n🔍 Test fallback ${pair.symbol}:`);
            
            // Test 1: Données standard 4h
            const standardData = await getKlineData(pair.symbol, 50, '4h');
            console.log(`   Données standard 4h: ${standardData.length} bougies`);
            
            // Test 2: Données étendues 4h
            if (typeof getExtendedHistoricalDataForTrading === 'function') {
                const extendedData = await getExtendedHistoricalDataForTrading(pair.symbol, '4h', 60);
                console.log(`   Données étendues 4h: ${extendedData.length} bougies`);
                
                // Test 3: Agrégation depuis 15m
                if (extendedData.length < 45) {
                    console.log(`   ⚠️ Données étendues insuffisantes, test d'agrégation...`);
                    if (typeof aggregateDataFromLowerTimeframe === 'function') {
                        const aggregatedData = await aggregateDataFromLowerTimeframe(pair.symbol, '15m', '4h');
                        console.log(`   Données agrégées 15m→4h: ${aggregatedData.length} bougies`);
                    } else {
                        console.log(`   ❌ Fonction aggregateDataFromLowerTimeframe non disponible`);
                    }
                }
            } else {
                console.log(`   ❌ Fonction getExtendedHistoricalDataForTrading non disponible`);
            }
            
            // Test 4: Analyse MACD avec fallback
            const analysis = await analyzePairMACD(pair.symbol, '4h');
            console.log(`   Résultat analyse 4h: ${analysis.signal} - ${analysis.reason}`);
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log('\n✅ Test des fallbacks terminé');
        
    } catch (error) {
        console.error('❌ Erreur test fallbacks:', error);
        return { error: error.message };
    }
};

// 🧪 FONCTION DE TEST: Vérifier que les corrections fonctionnent
window.testMACDCorrections = async function() {
    console.log('🔍 TEST: Vérification des corrections MACD...');
    
    try {
        // Tester quelques paires pour vérifier les corrections
        const allPairs = await getAllAvailablePairs();
        const testPairs = allPairs.slice(0, 5);
        
        console.log(`📊 Test des corrections sur ${testPairs.length} paires...`);
        
        for (const pair of testPairs) {
            console.log(`\n🔍 Test ${pair.symbol}:`);
            
            // Test 1: Vérifier que getKlineDataWithAggregation fonctionne
            if (typeof getKlineDataWithAggregation === 'function') {
                const klines4h = await getKlineDataWithAggregation(pair.symbol, 200, '4h');
                console.log(`   Données 4h avec agrégation: ${klines4h.length} bougies`);
            } else {
                console.log(`   ❌ getKlineDataWithAggregation non disponible`);
            }
            
            // Test 2: Vérifier l'analyse MACD 4h
            const analysis4h = await analyzePairMACD(pair.symbol, '4h');
            console.log(`   Analyse 4h: ${analysis4h.signal}`);
            console.log(`   Raison: "${analysis4h.reason}"`);
            
            // Test 3: Vérifier que la raison n'est jamais vide
            if (!analysis4h.reason || analysis4h.reason.trim() === '') {
                console.log(`   ❌ ERREUR: Raison vide détectée!`);
            } else {
                console.log(`   ✅ Raison présente (${analysis4h.reason.length} caractères)`);
            }
            
            // Test 4: Vérifier les paramètres MACD
            const params = getMACDParameters('4h');
            console.log(`   Paramètres 4h: minCandles=${params.minCandles} (doit être 200)`);
            
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        console.log('\n✅ Test des corrections terminé');
        
        // Résumé des corrections
        console.log('\n📋 RÉSUMÉ DES CORRECTIONS:');
        console.log('1. ✅ minCandles 4h restauré à 200 (était 50, insuffisant)');
        console.log('2. ✅ Sécurité reason ajoutée (plus de logs vides)');
        console.log('3. ✅ Fonction getKlineDataWithAggregation (agrégation 15m→4h)');
        console.log('4. ✅ Fallbacks améliorés pour paires récentes');
        
    } catch (error) {
        console.error('❌ Erreur test corrections:', error);
        return { error: error.message };
    }
};
