// 🚀 API QUEUE SYSTEM - Gestion centralisée des requêtes API
// Prévient l'accumulation de requêtes simultanées avec 8-10 positions

console.log('📁 Loading api-queue.js...');

// 🎯 Configuration de la queue
const API_QUEUE_CONFIG = {
    maxConcurrentRequests: 3,      // Max 3 requêtes simultanées (au lieu de 20+)
    requestTimeout: 8000,           // Timeout 8s (au lieu de pas de limite)
    batchInterval: 500,             // Batch les petites requêtes ensemble
    cacheTTL: 3000,                 // Cache 3 secondes
};

// 📋 Classe pour gérer la queue
class APIQueue {
    constructor() {
        this.queue = [];
        this.running = 0;
        this.cache = new Map();
        this.cacheTimestamps = new Map();
        this.stats = {
            totalRequests: 0,
            totalErrors: 0,
            avgWaitTime: 0,
            maxQueueSize: 0
        };
    }
    
    // 🔑 Générer une clé de cache
    getCacheKey(endpoint, params = {}) {
        return `${endpoint}:${JSON.stringify(params)}`;
    }
    
    // ⚡ Obtenir du cache si valide
    getFromCache(cacheKey) {
        const timestamp = this.cacheTimestamps.get(cacheKey);
        if (timestamp && Date.now() - timestamp < API_QUEUE_CONFIG.cacheTTL) {
            return this.cache.get(cacheKey);
        }
        // Invalider si trop vieux
        if (timestamp) {
            this.cache.delete(cacheKey);
            this.cacheTimestamps.delete(cacheKey);
        }
        return null;
    }
    
    // 💾 Stocker en cache
    setCache(cacheKey, value) {
        this.cache.set(cacheKey, value);
        this.cacheTimestamps.set(cacheKey, Date.now());
    }
    
    // 📥 Ajouter une requête à la queue
    async enqueue(endpoint, options = {}, cacheKey = null) {
        // Vérifier le cache d'abord
        if (cacheKey) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                log(`💾 Cache HIT: ${endpoint}`, 'DEBUG');
                return cached;
            }
        }
        
        const request = { endpoint, options, cacheKey, createdAt: Date.now() };
        
        return new Promise((resolve, reject) => {
            request.resolve = resolve;
            request.reject = reject;
            
            this.queue.push(request);
            this.stats.totalRequests++;
            
            // Mettre à jour maxQueueSize
            if (this.queue.length > this.stats.maxQueueSize) {
                this.stats.maxQueueSize = this.queue.length;
            }
            
            // Si on dépasse 50 requêtes en queue, warning
            if (this.queue.length > 50) {
                console.warn(`⚠️ API Queue saturée: ${this.queue.length} requêtes en attente`);
            }
            
            this.processQueue();
        });
    }
    
    // ⚙️ Traiter la queue
    async processQueue() {
        while (this.running < API_QUEUE_CONFIG.maxConcurrentRequests && this.queue.length > 0) {
            const request = this.queue.shift();
            this.running++;
            
            // Calculer le temps d'attente
            const waitTime = Date.now() - request.createdAt;
            this.stats.avgWaitTime = (this.stats.avgWaitTime + waitTime) / 2;
            
            // Exécuter la requête avec timeout
            this.executeWithTimeout(request);
        }
    }
    
    // ⏱️ Exécuter avec timeout
    async executeWithTimeout(request) {
        try {
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Timeout ${API_QUEUE_CONFIG.requestTimeout}ms`)), 
                    API_QUEUE_CONFIG.requestTimeout)
            );
            
            const result = await Promise.race([
                makeRequest(request.endpoint, request.options),
                timeoutPromise
            ]);
            
            // Mettre en cache
            if (request.cacheKey) {
                this.setCache(request.cacheKey, result);
            }
            
            request.resolve(result);
        } catch (error) {
            this.stats.totalErrors++;
            log(`❌ API Error: ${request.endpoint} - ${error.message}`, 'ERROR');
            request.reject(error);
        } finally {
            this.running--;
            this.processQueue(); // Continuer avec la prochaine
        }
    }
    
    // 📊 Obtenir les stats
    getStats() {
        return {
            ...this.stats,
            queueSize: this.queue.length,
            running: this.running,
            cacheSize: this.cache.size
        };
    }
    
    // 🧹 Nettoyer le cache
    clearCache() {
        this.cache.clear();
        this.cacheTimestamps.clear();
    }
}

// 🌍 Instance globale de la queue
window.apiQueue = new APIQueue();

// 🎯 WRAPPERS optimisés pour les appels courants

// 1️⃣ Récupérer les prix de PLUSIEURS paires en une seule requête
async function getPricesForAllPositions(positions) {
    if (!positions || positions.length === 0) return {};
    
    const cacheKey = window.apiQueue.getCacheKey('prices', { count: positions.length });
    
    // Vérifier le cache d'abord
    const cached = window.apiQueue.getFromCache(cacheKey);
    if (cached) return cached;
    
    try {
        // Récupérer TOUTES les positions via une seule requête
        const result = await window.apiQueue.enqueue(
            '/bitget/api/v2/mix/position/all-position?productType=USDT-FUTURES',
            {},
            cacheKey
        );
        
        if (!result || result.code !== '00000' || !result.data) {
            return {};
        }
        
        // Construire un objet {symbol: prix} pour accès rapide
        const prices = {};
        result.data.forEach(pos => {
            if (pos.symbol) {
                prices[pos.symbol] = {
                    price: parseFloat(pos.markPrice || pos.indexPrice || 0),
                    unrealizedPnL: parseFloat(pos.unrealizedPnL || 0),
                    timestamp: Date.now()
                };
            }
        });
        
        return prices;
    } catch (error) {
        log(`❌ Erreur récupération des prix: ${error.message}`, 'ERROR');
        return {};
    }
}

// 2️⃣ Mettre à jour PnL pour TOUTES les positions en une requête
async function updateAllPositionsPnLBatch(positions) {
    if (!positions || positions.length === 0) return;
    
    try {
        const prices = await getPricesForAllPositions(positions);
        
        // Mettre à jour localement (pas d'appel API supplémentaire)
        positions.forEach(localPos => {
            if (prices[localPos.symbol]) {
                const priceData = prices[localPos.symbol];
                localPos.currentPrice = priceData.price;
                localPos.unrealizedPnL = priceData.unrealizedPnL;
                
                // Recalculer PnL %
                if (localPos.entryPrice && localPos.quantity) {
                    const initialValue = localPos.quantity * localPos.entryPrice;
                    localPos.pnlPercentage = (priceData.unrealizedPnL / initialValue) * 100;
                }
            }
        });
        
        return positions;
    } catch (error) {
        log(`❌ Erreur batch PnL: ${error.message}`, 'ERROR');
    }
}

// 3️⃣ Vérifier solde (une seule fois par 10 sec au lieu de toutes les 10s)
async function getBalanceOptimized() {
    const cacheKey = window.apiQueue.getCacheKey('balance');
    return await window.apiQueue.enqueue(
        '/bitget/api/v2/account/balance',
        {},
        cacheKey
    );
}

// ✅ Exporter les fonctions
window.getPricesForAllPositions = getPricesForAllPositions;
window.updateAllPositionsPnLBatch = updateAllPositionsPnLBatch;
window.getBalanceOptimized = getBalanceOptimized;

console.log('✅ API Queue system loaded - Max concurrent: ' + API_QUEUE_CONFIG.maxConcurrentRequests);
