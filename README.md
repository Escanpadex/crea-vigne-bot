# 🚀 Bot Trading Bitget Futures - Stratégie MACD

Bot de trading automatisé pour Bitget Futures utilisant la stratégie MACD sur les TOP 30 cryptomonnaies par volume.

## 📁 Structure du Projet

```
crea-vigne-bot/
├── index.html              # Interface web principale (propre, référence les fichiers séparés)
├── index.html.backup       # Sauvegarde de l'ancien fichier monolithique
├── styles/
│   └── main.css            # Tous les styles CSS
├── js/
│   ├── config.js           # Configuration et variables globales
│   ├── utils.js            # Fonctions utilitaires (logs, formatage, stats)
│   ├── api.js              # Fonctions API Bitget (connexion, balance, requêtes)
│   ├── trading.js          # Logique de trading (MACD, positions, stop loss)
│   └── main.js             # Contrôle principal du bot (démarrage, arrêt, boucles)
└── README.md               # Documentation du projet
```

## ✨ Caractéristiques

- **Stratégie MACD** : Détection de croisements haussiers sur timeframe 5 minutes
- **TOP 30 Volume** : Surveillance automatique des 30 cryptomonnaies les plus liquides
- **Trailing Stop** : Système de stop loss trailing maison plus fiable que l'API Bitget
- **Interface moderne** : Design responsive avec gradients et glassmorphism
- **Logs en temps réel** : Suivi détaillé de toutes les opérations

## 🛠️ Installation

1. Clonez le projet
2. Ouvrez `index.html` dans votre navigateur web
3. Configurez vos clés API Bitget Futures
4. Démarrez le bot !

## ⚙️ Configuration

- **Capital** : 1-20% du capital total par position
- **Levier** : 2x à 10x (2x recommandé)
- **Trailing Stop** : 0.5% à 5% de recul maximum autorisé

## 🔒 Sécurité

- Stop Loss automatique (-1% initial)
- Trailing stop adaptatif toutes les 30 secondes
- Gestion des erreurs API
- Limitation du capital par position

## 📊 Fonctionnalités

- Test de connexion API
- Scanner TOP 30 automatique
- Analyse MACD temps réel
- Gestion positions multiples
- Mise à jour PnL en continu
- Statistiques de performance

## 🚨 Avertissement

Ce bot est fourni à des fins éducatives. Le trading de cryptomonnaies comporte des risques importants. Utilisez uniquement des fonds que vous pouvez vous permettre de perdre.

---

**Version** : Bot MACD TOP 30 - Dernière mise à jour automatique