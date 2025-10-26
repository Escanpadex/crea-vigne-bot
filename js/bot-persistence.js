// 💾 SYSTÈME DE PERSISTANCE DES POSITIONS DU BOT
// Ce module permet de sauvegarder et restaurer les positions gérées par le bot
console.log('📁 Loading bot-persistence.js...');

const BOT_PERSISTENCE_KEY = 'bot_managed_positions';

// Classe pour gérer la persistance des positions du bot
class BotPersistence {
    constructor() {
        this.botPositions = this.loadBotPositions();
        console.log(`✅ Bot Persistence initialisé avec ${this.botPositions.length} positions sauvegardées`);
    }

    // Charger les positions du bot depuis localStorage
    loadBotPositions() {
        try {
            const stored = localStorage.getItem(BOT_PERSISTENCE_KEY);
            if (stored) {
                const positions = JSON.parse(stored);
                console.log(`📂 ${positions.length} positions du bot chargées`);
                return positions;
            }
        } catch (error) {
            console.error('❌ Erreur chargement positions du bot:', error);
        }
        return [];
    }

    // Sauvegarder les positions du bot dans localStorage
    saveBotPositions(positions) {
        try {
            // Ne garder que les informations essentielles
            const positionsToSave = positions
                .filter(pos => pos.isBotManaged === true)
                .map(pos => ({
                    symbol: pos.symbol,
                    entryPrice: pos.entryPrice,
                    timestamp: pos.timestamp,
                    targetPnL: pos.targetPnL,
                    side: pos.side || 'LONG'
                }));

            localStorage.setItem(BOT_PERSISTENCE_KEY, JSON.stringify(positionsToSave));
            this.botPositions = positionsToSave;
            console.log(`💾 ${positionsToSave.length} positions du bot sauvegardées`);
            return true;
        } catch (error) {
            console.error('❌ Erreur sauvegarde positions du bot:', error);
            return false;
        }
    }

    // Ajouter une position à la liste des positions du bot
    addBotPosition(position) {
        if (!position || !position.symbol) return false;

        const posData = {
            symbol: position.symbol,
            entryPrice: position.entryPrice,
            timestamp: position.timestamp,
            targetPnL: position.targetPnL,
            side: position.side || 'LONG'
        };

        // Vérifier si la position n'existe pas déjà
        const exists = this.botPositions.find(p => 
            p.symbol === posData.symbol && 
            Math.abs(p.entryPrice - posData.entryPrice) < 0.0001
        );

        if (!exists) {
            this.botPositions.push(posData);
            this.saveBotPositions(this.botPositions);
            console.log(`➕ Position bot ajoutée: ${position.symbol}`);
            return true;
        }
        return false;
    }

    // Retirer une position de la liste des positions du bot
    removeBotPosition(symbol) {
        const initialLength = this.botPositions.length;
        this.botPositions = this.botPositions.filter(p => p.symbol !== symbol);
        
        if (this.botPositions.length < initialLength) {
            localStorage.setItem(BOT_PERSISTENCE_KEY, JSON.stringify(this.botPositions));
            console.log(`➖ Position bot retirée: ${symbol}`);
            return true;
        }
        return false;
    }

    // Vérifier si une position est gérée par le bot
    isBotManagedPosition(position) {
        if (!position || !position.symbol) return false;

        // Vérifier si la position correspond à une position sauvegardée du bot
        const match = this.botPositions.find(botPos => {
            const symbolMatch = botPos.symbol === position.symbol;
            
            // Tolérance de 0.1% sur le prix d'entrée pour gérer les variations d'arrondi
            const priceMatch = position.entryPrice && botPos.entryPrice &&
                Math.abs((position.entryPrice - botPos.entryPrice) / botPos.entryPrice) < 0.001;
            
            return symbolMatch && priceMatch;
        });

        return !!match;
    }

    // Nettoyer les positions du bot (supprimer toutes les positions sauvegardées)
    clearBotPositions() {
        this.botPositions = [];
        localStorage.removeItem(BOT_PERSISTENCE_KEY);
        console.log('🗑️ Toutes les positions du bot ont été supprimées');
        return true;
    }

    // Obtenir toutes les positions du bot sauvegardées
    getAllBotPositions() {
        return this.botPositions;
    }

    // Synchroniser avec les positions actuellement ouvertes
    syncWithOpenPositions(openPositions) {
        if (!openPositions || !Array.isArray(openPositions)) return;

        // Retirer les positions qui ne sont plus ouvertes
        const openSymbols = openPositions.map(p => p.symbol);
        const initialLength = this.botPositions.length;
        
        this.botPositions = this.botPositions.filter(botPos => 
            openSymbols.includes(botPos.symbol)
        );

        if (this.botPositions.length < initialLength) {
            localStorage.setItem(BOT_PERSISTENCE_KEY, JSON.stringify(this.botPositions));
            const removed = initialLength - this.botPositions.length;
            console.log(`🔄 Synchronisation: ${removed} position(s) fermée(s) retirée(s) du cache`);
        }
    }
}

// Créer une instance globale
window.botPersistence = new BotPersistence();

// Fonctions globales pour faciliter l'utilisation
window.saveBotPositions = function(positions) {
    return window.botPersistence.saveBotPositions(positions);
};

window.isBotManagedPosition = function(position) {
    return window.botPersistence.isBotManagedPosition(position);
};

window.addBotPositionToPersistence = function(position) {
    return window.botPersistence.addBotPosition(position);
};

window.removeBotPositionFromPersistence = function(symbol) {
    return window.botPersistence.removeBotPosition(symbol);
};

console.log('✅ Bot Persistence chargé et prêt à l\'emploi');

