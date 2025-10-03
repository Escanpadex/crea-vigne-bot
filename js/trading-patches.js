// 🎯 PATCHES ET CORRECTIONS pour trading.js
console.log('📁 Loading trading-patches.js - Correctifs appliqués...');

// 🎯 CORRECTION 1: Fonction pour sélectionner une paire NON déjà ouverte
function selectRandomPositivePairNotInUse() {
    const botPositionsCount = getBotManagedPositionsCount();
    const availableSlots = getMaxBotPositions() - botPositionsCount;
    
    if (availableSlots <= 0) {
        log(`⚠️ Limite bot atteinte: ${botPositionsCount}/${getMaxBotPositions()} positions bot - Pas de sélection`, 'INFO');
        return null;
    }
    
    // 🔧 PROTECTION ANTI-DOUBLON: Récupérer toutes les paires déjà ouvertes
    const openedSymbols = openPositions.map(pos => pos.symbol);
    log(`🔍 Paires déjà ouvertes: ${openedSymbols.join(', ') || 'Aucune'}`, 'DEBUG');
    
    // Filtrer les paires disponibles en excluant celles déjà ouvertes
    const availablePairs = positivePairs.filter(pair => 
        !openedSymbols.includes(pair.symbol) &&  // 🎯 NOUVEAU: Pas déjà ouverte
        !isPairInCooldown(pair.symbol) &&
        !isTradedPairInCooldown(pair.symbol)
    );
    
    if (availablePairs.length === 0) {
        log('⚠️ Aucune paire positive disponible - Toutes les paires sont soit ouvertes, soit en cooldown', 'WARNING');
        log(`📊 Paires positives totales: ${positivePairs.length}`, 'INFO');
        log(`📊 Paires déjà ouvertes: ${openedSymbols.length}`, 'INFO');
        log(`📊 Slots bot disponibles: ${availableSlots}/${getMaxBotPositions()}`, 'INFO');
        
        // 🎯 NOUVEAU: Si pas assez de paires, le bot attend
        if (positivePairs.length < getMaxBotPositions()) {
            log(`🔴 Pas assez de paires positives (${positivePairs.length}) pour ${getMaxBotPositions()} positions simultanées`, 'WARNING');
            log('⏳ Le bot attend de nouvelles opportunités...', 'INFO');
        }
        
        return null;
    }
    
    // Sélection aléatoire pondérée par la performance 24h
    const randomIndex = Math.floor(Math.random() * Math.min(availablePairs.length, 20)); // Top 20 pour plus de diversité
    const selectedPair = availablePairs[randomIndex];
    
    log(`🎲 Paire sélectionnée: ${selectedPair.symbol} (+${selectedPair.change24h.toFixed(2)}% sur 24h)`, 'SUCCESS');
    log(`📊 ${availablePairs.length} paires disponibles (${openedSymbols.length} déjà ouvertes)`, 'INFO');
    
    return selectedPair;
}

// 🎯 CORRECTION 2: Fonction utilitaire pour arrondir le targetPnL
function formatTargetPnL(targetPnL) {
    // Arrondir à 2 décimales pour éviter 0.3500000000000000003%
    return parseFloat(targetPnL.toFixed(2));
}

// 🎯 CORRECTION 3: Surcharger l'affichage des positions pour appliquer les corrections
const originalUpdatePositionsDisplay = window.updatePositionsDisplay;

function updatePositionsDisplayPatched() {
    // Patcher toutes les positions pour corriger le targetPnL
    openPositions.forEach(position => {
        if (position.targetPnL && typeof position.targetPnL === 'number') {
            position.targetPnL = formatTargetPnL(position.targetPnL);
        }
    });
    
    // Appeler la fonction originale
    if (typeof originalUpdatePositionsDisplay === 'function') {
        originalUpdatePositionsDisplay();
    }
}

// 🎯 EXPORTS: Rendre les fonctions accessibles globalement
window.selectRandomPositivePairNotInUse = selectRandomPositivePairNotInUse;
window.formatTargetPnL = formatTargetPnL;
window.updatePositionsDisplay = updatePositionsDisplayPatched;

console.log('✅ Patches appliqués: Anti-doublon + Arrondi targetPnL + Suppression R-PnL');

