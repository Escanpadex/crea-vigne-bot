// 🎯 FIX: Correction du double comptage des positions gagnantes/perdantes
console.log('📁 Loading stats-fix.js - Correctif comptage statistiques...');

// 🔧 TRACKING: Set pour tracker les positions déjà comptées dans les stats
let countedPositions = new Set(); // Stocke les IDs des positions déjà comptées

// 🎯 FONCTION: Réinitialiser le tracking au démarrage du bot
function resetStatsTracking() {
    countedPositions.clear();
    console.log('✅ Tracking des stats réinitialisé');
}

// 🎯 FONCTION: Vérifier si une position a déjà été comptée
function isPositionCounted(positionId) {
    return countedPositions.has(positionId);
}

// 🎯 FONCTION: Marquer une position comme comptée
function markPositionAsCounted(positionId) {
    countedPositions.add(positionId);
    console.log(`📊 Position ${positionId} marquée comme comptée`);
}

// 🎯 FONCTION CENTRALISÉE: Compter une position fermée (évite les doublons)
function countClosedPosition(position, pnl, source = 'unknown') {
    // Créer un ID unique pour la position
    const positionId = position.id || `${position.symbol}_${position.timestamp}`;
    
    // Vérifier si déjà comptée
    if (isPositionCounted(positionId)) {
        console.log(`⚠️ Position ${position.symbol} déjà comptée (source: ${source}) - Ignoré`);
        return false;
    }
    
    // Marquer comme comptée
    markPositionAsCounted(positionId);
    
    // Compter la position
    botStats.totalClosedPositions++;
    
    if (pnl > 0) {
        botStats.winningPositions++;
        botStats.totalWinAmount += Math.abs(pnl);
        log(`🟢 Position gagnante comptée: ${position.symbol} +${pnl.toFixed(2)}$ (Total: ${botStats.winningPositions} gagnantes) [Source: ${source}]`, 'SUCCESS');
    } else if (pnl < 0) {
        botStats.losingPositions++;
        botStats.totalLossAmount += pnl; // Déjà négatif
        log(`🔴 Position perdante comptée: ${position.symbol} ${pnl.toFixed(2)}$ (Total: ${botStats.losingPositions} perdantes) [Source: ${source}]`, 'WARNING');
    } else {
        log(`⚪ Position neutre comptée: ${position.symbol} ${pnl.toFixed(2)}$ [Source: ${source}]`, 'INFO');
    }
    
    return true;
}

// 🎯 DIAGNOSTIC: Afficher les stats de tracking
function showStatsTracking() {
    console.log('📊 ========== DIAGNOSTIC STATS TRACKING ==========');
    console.log(`Positions comptées: ${countedPositions.size}`);
    console.log(`Positions gagnantes: ${botStats.winningPositions}`);
    console.log(`Positions perdantes: ${botStats.losingPositions}`);
    console.log(`Total fermées: ${botStats.totalClosedPositions}`);
    console.log(`Somme check: ${botStats.winningPositions + botStats.losingPositions} (doit être ≤ ${botStats.totalClosedPositions})`);
    
    if (botStats.winningPositions + botStats.losingPositions > botStats.totalClosedPositions) {
        console.log('🚨 ERREUR DÉTECTÉE: Surcomptage des positions!');
    } else {
        console.log('✅ Comptage cohérent');
    }
    console.log('='.repeat(50));
}

// 🎯 EXPORTS
window.resetStatsTracking = resetStatsTracking;
window.isPositionCounted = isPositionCounted;
window.markPositionAsCounted = markPositionAsCounted;
window.countClosedPosition = countClosedPosition;
window.showStatsTracking = showStatsTracking;

// 🎯 PATCH: Intercepter le démarrage du bot pour réinitialiser le tracking
const originalStartBot = window.startBot;
if (typeof originalStartBot === 'function') {
    window.startBot = async function() {
        resetStatsTracking();
        return await originalStartBot();
    };
    console.log('✅ startBot patché pour réinitialiser le tracking');
}

console.log('✅ Stats-fix chargé: Protection anti-double-comptage active');

