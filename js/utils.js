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

// NEW: Update version timestamp
function updateVersionTimestamp() {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    const timestamp = `${day}/${month}/${year} ${hours}:${minutes}`;
    
    const versionElement = document.querySelector('.version');
    if (versionElement) {
        versionElement.textContent = `🕐 Dernière MAJ: ${timestamp}`;
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

function fillApiKeys() {
    // Remplir automatiquement les champs avec les clés API prédéfinies
    document.getElementById('apiKey').value = 'bg_a6cefdfb426b44f00fa74ac0203a5049';
    document.getElementById('secretKey').value = '0bddf82631180ae2d38d9e0ad6470480a71382e53166944b40b0223b7e65dbcc';
    document.getElementById('passphrase').value = 'Charmant16320Charmant16320';
    
    log('🔑 Clés API automatiquement remplies', 'SUCCESS');
    
    // Optionnel: sauvegarder et tester automatiquement
    saveKeys();
} 