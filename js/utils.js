// Utility functions

function log(message, type = 'INFO') {
    const logs = document.getElementById('logs');
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] [${type}] ${message}<br>`;
    
    // Ajouter le nouveau log
    logs.innerHTML += logMessage;
    
    // Limiter à 100 logs maximum
    const logLines = logs.innerHTML.split('<br>').filter(line => line.trim() !== '');
    if (logLines.length > 100) {
        // Garder seulement les 100 derniers logs
        const recentLogs = logLines.slice(-100);
        logs.innerHTML = recentLogs.join('<br>') + '<br>';
    }
    
    logs.scrollTop = logs.scrollHeight;
}

function clearLogs() {
    document.getElementById('logs').innerHTML = '';
}

function formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}

function updateStats() {
    document.getElementById('totalScans').textContent = botStats.totalScans;
    document.getElementById('totalSignals').textContent = botStats.totalSignals;
    document.getElementById('totalOpenPositions').textContent = openPositions.length;
    
    if (botStartTime) {
        const elapsed = Date.now() - botStartTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        document.getElementById('botUptime').textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

function saveKeys() {
    const keys = {
        apiKey: document.getElementById('apiKey').value,
        secretKey: document.getElementById('secretKey').value,
        passphrase: document.getElementById('passphrase').value
    };
    
    if (keys.apiKey && keys.secretKey && keys.passphrase) {
        config.apiKey = keys.apiKey;
        config.secretKey = keys.secretKey;
        config.passphrase = keys.passphrase;
        
        log('🔑 Clés API sauvegardées avec succès', 'SUCCESS');
        
        // Test de connexion automatique
        testConnection();
    } else {
        alert('Veuillez remplir tous les champs API');
    }
}

// NEW: Function to load API keys from config
function loadApiKeys() {
    try {
        const apiKeyField = document.getElementById('apiKey');
        const secretKeyField = document.getElementById('secretKey');
        const passphraseField = document.getElementById('passphrase');
        
        if (apiKeyField && secretKeyField && passphraseField) {
            apiKeyField.value = config.apiKey;
            secretKeyField.value = config.secretKey;
            passphraseField.value = config.passphrase;
            
            log('🔑 Clés API chargées avec succès depuis la configuration', 'SUCCESS');
            log(`✅ API Key: ${config.apiKey.substring(0, 10)}...`, 'INFO');
            log(`✅ Secret Key: ${config.secretKey.substring(0, 10)}...`, 'INFO');
            log(`✅ Passphrase: ${config.passphrase.substring(0, 5)}...`, 'INFO');
            
            // Mise à jour automatique de la config locale
            config.apiKey = config.apiKey;
            config.secretKey = config.secretKey;
            config.passphrase = config.passphrase;
            
            log('🎯 Clés prêtes pour utilisation - Vous pouvez maintenant tester la connexion', 'SUCCESS');
        } else {
            log('❌ Erreur: Champs API non trouvés dans le DOM', 'ERROR');
        }
    } catch (error) {
        log(`❌ Erreur lors du chargement des clés: ${error.message}`, 'ERROR');
    }
} 