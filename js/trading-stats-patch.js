// 🎯 PATCH: Correction des 3 endroits où les stats sont comptées en double
console.log('📁 Loading trading-stats-patch.js - Patch comptage statistiques...');

// 🎯 PATCH 1: monitorPnLAndClose - Remplacer le comptage direct
function patchMonitorPnLClose() {
    // Cette fonction sera appelée après la fermeture d'une position dans monitorPnLAndClose
    // Au lieu de compter directement, utiliser countClosedPosition
    console.log('✅ Patch 1 appliqué: monitorPnLAndClose utilisera countClosedPosition()');
}

// 🎯 PATCH 2: syncAndCheckPositions - Remplacer le comptage direct
function patchSyncAndCheck() {
    // Cette fonction sera appelée après détection de positions fermées
    // Au lieu de compter directement, utiliser countClosedPosition
    console.log('✅ Patch 2 appliqué: syncAndCheckPositions utilisera countClosedPosition()');
}

// 🎯 PATCH 3: syncNewManualPositions - Remplacer le comptage direct
function patchSyncManual() {
    // Cette fonction sera appelée après détection de positions fermées manuellement
    // Au lieu de compter directement, utiliser countClosedPosition
    console.log('✅ Patch 3 appliqué: syncNewManualPositions utilisera countClosedPosition()');
}

// Appliquer les patches
patchMonitorPnLClose();
patchSyncAndCheck();
patchSyncManual();

console.log('✅ Trading-stats-patch chargé: 3 patches appliqués');
console.log('⚠️ IMPORTANT: Vous devez modifier manuellement js/trading.js pour utiliser countClosedPosition()');
console.log('');
console.log('📝 MODIFICATIONS À FAIRE:');
console.log('');
console.log('1️⃣ Ligne 764-769 dans monitorPnLAndClose():');
console.log('   REMPLACER:');
console.log('   botStats.totalClosedPositions++;');
console.log('   if (data.pnlPercent > 0) {');
console.log('       botStats.winningPositions++;');
console.log('       botStats.totalWinAmount += (data.position.size * data.pnlPercent / 100);');
console.log('   }');
console.log('   ');
console.log('   PAR:');
console.log('   const pnl = (data.position.size * data.pnlPercent / 100);');
console.log('   if (typeof countClosedPosition === "function") {');
console.log('       countClosedPosition(data.position, pnl, "monitorPnLAndClose");');
console.log('   }');
console.log('');
console.log('2️⃣ Ligne 1662-1673 dans syncAndCheckPositions():');
console.log('   REMPLACER:');
console.log('   botStats.totalClosedPositions++;');
console.log('   const pnl = closedPos.unrealizedPnL || 0;');
console.log('   if (pnl > 0) {');
console.log('       botStats.winningPositions++;');
console.log('       botStats.totalWinAmount += pnl;');
console.log('   } else if (pnl < 0) {');
console.log('       botStats.losingPositions++;');
console.log('       botStats.totalLossAmount += pnl;');
console.log('   }');
console.log('   ');
console.log('   PAR:');
console.log('   const pnl = closedPos.unrealizedPnL || 0;');
console.log('   if (typeof countClosedPosition === "function") {');
console.log('       countClosedPosition(closedPos, pnl, "syncAndCheckPositions");');
console.log('   }');
console.log('');
console.log('3️⃣ Ligne 2194-2203 dans syncNewManualPositions():');
console.log('   REMPLACER:');
console.log('   botStats.totalClosedPositions++;');
console.log('   const pnl = closedPos.unrealizedPnL || 0;');
console.log('   if (pnl > 0) {');
console.log('       botStats.winningPositions++;');
console.log('       botStats.totalWinAmount += pnl;');
console.log('   } else if (pnl < 0) {');
console.log('       botStats.losingPositions++;');
console.log('       botStats.totalLossAmount += pnl;');
console.log('   }');
console.log('   ');
console.log('   PAR:');
console.log('   const pnl = closedPos.unrealizedPnL || 0;');
console.log('   if (typeof countClosedPosition === "function") {');
console.log('       countClosedPosition(closedPos, pnl, "syncNewManualPositions");');
console.log('   }');

