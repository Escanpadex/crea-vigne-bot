// 🧪 CODE DE DEBUG TEMPORAIRE - Copiez-collez dans la console

async function debugImportPositions() {
    console.log('🧪 Debug import positions...');
    console.log(`📊 État initial: ${openPositions ? openPositions.length : 'openPositions undefined'} positions`);
    
    // Vérifier les fonctions disponibles
    console.log('🔍 Fonctions disponibles:');
    console.log(`importExistingPositions: ${typeof window.importExistingPositions}`);
    console.log(`makeRequest: ${typeof makeRequest}`);
    console.log(`updatePositionsDisplay: ${typeof updatePositionsDisplay}`);
    
    // Vérifier les éléments DOM
    const positionCountEl = document.getElementById('positionCount');
    const positionsListEl = document.getElementById('positionsList');
    console.log(`📊 Éléments DOM:`);
    console.log(`positionCount: ${positionCountEl ? 'TROUVÉ' : 'NON TROUVÉ'}`);
    console.log(`positionsList: ${positionsListEl ? 'TROUVÉ' : 'NON TROUVÉ'}`);
    
    if (positionCountEl) {
        console.log(`Valeur actuelle du compteur: "${positionCountEl.textContent}"`);
    }
    
    // Test de l'import si disponible
    if (typeof window.importExistingPositions === 'function') {
        try {
            console.log('🔄 Lancement de l\'import...');
            await window.importExistingPositions();
            console.log(`📊 État après import: ${openPositions ? openPositions.length : 'openPositions undefined'} positions`);
        } catch (error) {
            console.error('❌ Erreur import:', error);
        }
    } else {
        console.log('❌ Fonction importExistingPositions non disponible');
    }
}

// Lancer le debug
debugImportPositions();
