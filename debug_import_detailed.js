// 🔍 DEBUG IMPORT DÉTAILLÉ - Copiez-collez dans la console

async function debugImportDetailed() {
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
}

debugImportDetailed();
