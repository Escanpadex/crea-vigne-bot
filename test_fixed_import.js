// 🧪 TEST IMPORT CORRIGÉ - Copiez-collez dans la console

async function testFixedImport() {
    console.log('🧪 Test de l\'import corrigé...');
    
    // Vider les positions actuelles pour test propre
    const originalPositions = [...openPositions];
    openPositions.length = 0;
    console.log('🔄 Positions vidées pour test propre');
    
    try {
        // Lancer l'import avec la correction
        await window.importExistingPositions();
        
        console.log(`✅ Import terminé: ${openPositions.length} positions importées`);
        
        // Afficher les positions importées
        openPositions.forEach((pos, index) => {
            console.log(`\n📍 Position ${index + 1} importée:`);
            console.log(`   Symbol: ${pos.symbol}`);
            console.log(`   Side: ${pos.side}`);
            console.log(`   Size: ${pos.size} USDT`);
            console.log(`   Entry Price: ${pos.entryPrice}`);
            console.log(`   Current Price: ${pos.currentPrice}`);
            console.log(`   Unrealized PnL: ${pos.unrealizedPnL} USDT`);
            console.log(`   PnL %: ${pos.pnlPercentage.toFixed(2)}%`);
            console.log(`   Target PnL: ${pos.targetPnL}%`);
        });
        
        // Vérifier l'affichage
        const positionCountEl = document.getElementById('positionCount');
        if (positionCountEl) {
            console.log(`\n📊 Affichage: ${positionCountEl.textContent} positions montrées`);
            
            if (positionCountEl.textContent == openPositions.length) {
                console.log('✅ Affichage correct !');
            } else {
                console.log('❌ Problème d\'affichage');
            }
        }
        
        return openPositions;
        
    } catch (error) {
        console.error('❌ Erreur lors du test:', error);
        // Restaurer les positions originales en cas d'erreur
        openPositions.splice(0, openPositions.length, ...originalPositions);
        return [];
    }
}

testFixedImport();
