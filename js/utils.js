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

function toggleLogs() {
    const logsSection = document.getElementById('logsSection');
    const logsToggleCard = document.getElementById('logsToggleCard');
    
    if (logsSection.style.display === 'none') {
        logsSection.style.display = 'block';
        logsToggleCard.style.display = 'none';
    } else {
        logsSection.style.display = 'none';
        logsToggleCard.style.display = 'block';
    }
}

function updateTopVolumeCount() {
    const selectedCount = parseInt(document.getElementById('topVolumeCount').value);
    const title = document.getElementById('topVolumeTitle');
    const settings = document.getElementById('currentSettings');
    const timeframe = document.getElementById('macdTimeframe').value;
    
    // Mettre à jour la configuration
    config.topVolumeCount = selectedCount;
    
    if (title) {
        title.textContent = `📈 TOP ${selectedCount} Volume (Surveillance)`;
    }
    
    if (settings) {
        settings.textContent = `📈 ${timeframe} | TOP ${selectedCount}`;
    }
    
    log(`⚙️ Configuration mise à jour: TOP ${selectedCount} Volume`, 'INFO');
    
    // Si connecté, relancer le scan avec le nouveau nombre
    if (document.getElementById('connectionStatus').classList.contains('online')) {
        log(`🔄 Relancement du scan avec TOP ${selectedCount}...`, 'INFO');
        if (typeof scanTop30Volume === 'function') {
            scanTop30Volume();
        }
    }
}

function updateMacdTimeframe() {
    const timeframe = document.getElementById('macdTimeframe').value;
    const topCount = document.getElementById('topVolumeCount').value;
    const settings = document.getElementById('currentSettings');
    
    // Mettre à jour la configuration
    config.macdTimeframe = timeframe;
    
    if (settings) {
        settings.textContent = `📈 ${timeframe} | TOP ${topCount}`;
    }
    
    log(`⚙️ Timeframe MACD mis à jour: ${timeframe}`, 'INFO');
}

function formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}

function updateStats() {
    document.getElementById('totalSignals').textContent = botStats.totalSignals;
    document.getElementById('totalOpenPositions').textContent = openPositions.length;
    document.getElementById('totalClosedPositions').textContent = botStats.totalClosedPositions;
    document.getElementById('winningPositions').textContent = `${botStats.winningPositions} (+${botStats.totalWinAmount.toFixed(0)}$)`;
    document.getElementById('losingPositions').textContent = `${botStats.losingPositions} (-${Math.abs(botStats.totalLossAmount).toFixed(0)}$)`;
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