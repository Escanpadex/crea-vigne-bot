# 🚀 Bot Trading Bitget Futures - Stratégie MACD Multi-Timeframes

## ✨ Stratégie Optimisée (Mise à Jour)

### 📊 Analyse Multi-Timeframes avec Filtrage Progressif

Le bot utilise une approche révolutionnaire avec **filtrage progressif optimisé** :

**🔍 Analyse Complète :**
- Scanner **TOUTES** les cryptos disponibles sur Bitget (volume > 1M USDT)
- Filtrage progressif sur 3 timeframes : **4H → 1H → 15M**

**⚡ Processus de Filtrage Optimisé :**

1. **4 Heures** : Analyse MACD sur timeframe 4H
   - ✅ Si MACD haussier → Passer au timeframe suivant
   - ❌ Si MACD baissier → Crypto écartée

2. **1 Heure** : Analyse MACD sur timeframe 1H (seulement si 4H validé)
   - ✅ Si MACD haussier → Passer au timeframe suivant
   - ❌ Si MACD baissier → Crypto écartée

3. **15 Minutes** ⚡ **(TIMEFRAME FINAL)** : Analyse MACD sur timeframe 15M (seulement si 1H validé)
   - 🎯 Si **croisement haussier MACD** détecté → **OUVERTURE POSITION**
   - ⏳ Si MACD haussier sans croisement → Attendre le croisement
   - ❌ Si MACD baissier → Crypto écartée

### 📈 Interface Utilisateur Améliorée

**Section "Analyse MACD" remplace "TOP 30 Volume" :**
- Affichage en temps réel des statistiques par timeframe
- Format : "X sur Y haussiers" et "X sur Y baissiers"
- Exemple : "150 sur 600 haussiers" et "450 sur 600 baissiers"

### 🎯 Avantages de la Stratégie Optimisée

1. **Couverture Maximale** : Analyse de toutes les opportunités du marché
2. **Filtrage Intelligent** : Élimination précoce des cryptos non-prometteuses  
3. **Confirmation Multi-Timeframes** : H4 et H1 haussiers requis
4. **Performance Optimisée** : Suppression du timeframe 5M pour réduire le bruit
5. **Signaux Plus Fiables** : 15M comme timeframe final pour des signaux plus robustes
6. **Moins de Faux Signaux** : Réduction significante des entrées prématurées

## 🧪 Système de Backtesting Intégré

### ✨ Nouvelles Fonctionnalités

**🔧 Interface Modernisée :**
- Section TradingView agrandie (700px de hauteur)
- Sélecteur de timeframe pour le graphique (5m, 15m, 1h, 4h, 1d)
- Suppression de la section "Historique Croisements MACD" (remplacée par le backtesting)

**📊 Système de Backtesting Complet :**
- **Stratégies Multiples** : MACD, RSI, EMA Crossover, Bandes de Bollinger
- **Paramètres Configurables** : Personnalisation complète de chaque stratégie
- **Timeframes Variés** : Tests sur 5m, 15m, 1h, 4h, 1d
- **Durées Flexibles** : 24h, 48h, 7 jours, 30 jours, 90 jours
- **Gestion des Risques** : Stop Loss et Take Profit configurables

**📈 Métriques de Performance :**
- Profit/Perte total (% et USDT)
- Win Rate (taux de réussite)
- Nombre de trades
- Sharpe Ratio
- Maximum Drawdown
- Durée moyenne des trades

**💾 Export et Analyse :**
- Export des résultats en JSON
- Historique détaillé des trades
- Graphique de performance (en développement)

### 🎮 Utilisation du Backtesting

1. **Sélection de la Crypto** : Choisir la paire dans le sélecteur TradingView
2. **Configuration de la Stratégie** :
   - Type : MACD, RSI, EMA, Bollinger
   - Paramètres spécifiques (Fast, Slow, Signal pour MACD)
3. **Configuration du Test** :
   - Timeframe d'analyse
   - Durée du test
   - Capital initial
   - Taille de position (%)
   - Stop Loss et Take Profit (%)
4. **Lancement** : Cliquer sur "🚀 Lancer le Backtesting"
5. **Analyse** : Consulter les résultats et exporter si nécessaire

### ⚙️ Configuration

**Paramètres inchangés :**
- Capital : 1-20% du solde
- Levier : 2x à 10x
- Stop Loss : Trailing stop maison
- Gestion des positions : Automatique

**Nouveaux éléments :**
- Analyse de 600+ paires de cryptos
- Cycle d'analyse : 1 minute
- Filtrage intelligent multi-timeframes

### 🚀 Utilisation

1. **Connexion** : Cliquez sur le bouton "🔗 API"
2. **Configuration** : Ajustez capital, levier, stop loss
3. **Démarrage** : Cliquez sur "▶️ Démarrer"
4. **Surveillance** : Observez les statistiques MACD en temps réel

### 📊 Monitoring

L'interface affiche :
- Progression de l'analyse (crypto X/Y)
- Statistiques par timeframe en temps réel
- Positions ouvertes et leur P&L
- Logs détaillés de l'activité du bot

---

## 🔧 Fonctionnalités Techniques

- **API Bitget** : Futures USDT
- **Indicateur** : MACD adaptatif par timeframe :
  - **4H** : MACD(12, 26, 9) - Paramètres standards
  - **1H** : MACD(30, 50, 20) - Plus réactif pour tendances moyennes
  - **15M** : MACD(30, 50, 40) - Signal lissé pour réduire le bruit
- **Timeframes** : 4H, 1H, 15M *(timeframe 5M supprimé)*
- **Données** : 200-350 bougies par analyse selon timeframe
- **Protection** : Stop loss trailing automatique
- **Synchronisation** : Positions temps réel

---

*Bot développé pour maximiser les opportunités de trading avec une approche systématique et multi-timeframes.*