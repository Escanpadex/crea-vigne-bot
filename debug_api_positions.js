// 🔍 DEBUG API POSITIONS - Copiez-collez dans la console

async function debugAPIPositions() {
    console.log('🔍 Debug API positions Bitget...');
    
    try {
        // Test direct de l'API
        console.log('📡 Appel API: /bitget/api/v2/mix/position/all-position?productType=USDT-FUTURES');
        const result = await makeRequest('/bitget/api/v2/mix/position/all-position?productType=USDT-FUTURES');
        
        console.log('📊 Réponse complète de l\'API:');
        console.log(result);
        
        if (result) {
            console.log(`📋 Code: ${result.code}`);
            console.log(`📋 Message: ${result.msg}`);
            console.log(`📋 Data: ${result.data ? 'Présent' : 'Absent'}`);
            
            if (result.data) {
                console.log(`📊 Nombre total de positions: ${result.data.length}`);
                
                // Afficher toutes les positions brutes
                result.data.forEach((pos, index) => {
                    console.log(`\n📍 Position ${index + 1}:`);
                    console.log(`   Symbol: ${pos.symbol}`);
                    console.log(`   Total: ${pos.total} (parsed: ${parseFloat(pos.total)})`);
                    console.log(`   Side: ${pos.side}`);
                    console.log(`   Size: ${pos.size}`);
                    console.log(`   ContractSize: ${pos.contractSize}`);
                    console.log(`   MarkPrice: ${pos.markPrice}`);
                    console.log(`   UnrealizedPL: ${pos.unrealizedPL}`);
                    console.log(`   Objet complet:`, pos);
                });
                
                // Test du filtrage
                console.log('\n🔍 Test du filtrage (parseFloat(pos.total) > 0):');
                const filteredPositions = result.data.filter(pos => {
                    const total = parseFloat(pos.total);
                    const isActive = total > 0;
                    console.log(`   ${pos.symbol}: total=${pos.total}, parsed=${total}, active=${isActive}`);
                    return isActive;
                });
                
                console.log(`\n✅ Positions actives après filtrage: ${filteredPositions.length}`);
                
                // Test avec d'autres champs
                console.log('\n🔍 Test avec d\'autres champs pour détecter les positions actives:');
                const alternativeFilters = [
                    { name: 'size > 0', filter: pos => parseFloat(pos.size || 0) > 0 },
                    { name: 'contractSize > 0', filter: pos => parseFloat(pos.contractSize || 0) > 0 },
                    { name: 'unrealizedPL exists', filter: pos => pos.unrealizedPL !== undefined && pos.unrealizedPL !== null },
                    { name: 'side exists', filter: pos => pos.side && pos.side !== '' }
                ];
                
                alternativeFilters.forEach(({name, filter}) => {
                    const count = result.data.filter(filter).length;
                    console.log(`   ${name}: ${count} positions`);
                });
                
            } else {
                console.log('❌ Pas de données dans la réponse');
            }
        } else {
            console.log('❌ Réponse API nulle');
        }
        
    } catch (error) {
        console.error('❌ Erreur lors du debug API:', error);
    }
}

// Lancer le debug
debugAPIPositions();
