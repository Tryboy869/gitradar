# 🌌 GitRadar - GitHub Intelligence Layer

> **Découverte intelligente de l'open-source**  
> L'IA qui comprend GitHub et trouve les projets parfaits pour toi

---

## 📋 Vue d'Ensemble

**GitRadar** résout un problème fondamental de l'écosystème open-source : **la découvrabilité**.

Des millions de projets GitHub sont invisibles car :
- ❌ La recherche GitHub est limitée aux mots-clés exacts
- ❌ Les petits projets utiles sont noyés par les projets viraux
- ❌ Aucune personnalisation selon le profil développeur
- ❌ Les projets stables mais inactifs sont considérés "morts"

### 💡 Notre Solution

**GitRadar** utilise l'IA pour analyser intelligemment les repos GitHub et recommander les projets selon :
- ✅ **Utilité réelle** (pas juste les stars)
- ✅ **Contexte utilisateur** (stack, objectifs, niveau)
- ✅ **Analyse sémantique** des README
- ✅ **Catégorisation intelligente** automatique

---

## 🚀 Fonctionnalités

### 🔍 Mode Exploration Manuelle
- Recherche sémantique avancée
- Filtres multi-critères (langage, catégorie, utilité)
- Tri intelligent (utilité, stars, récent)
- Découverte par domaine

### 🤖 Assistant IA
- Recommandations personnalisées
- "Dis-moi ce que tu veux construire"
- Stack Builder automatique
- Analyse d'intention

### 📊 Intelligence Repos
- **Utility Score** : Score de 0 à 10 basé sur documentation, activité, communauté
- **Catégorisation auto** : Authentication, Database, API, etc.
- **Production-ready detection** : Stable vs Experimental
- **Tech Stack extraction** : Technologies détectées automatiquement

### 🔐 Authentification
- Inscription/Connexion JWT
- Profil utilisateur personnalisé
- Préférences sauvegardées

---

## 🏗️ Architecture Technique

### NEXUS AXION 3.5
Architecture à **3 fichiers** maximum :

```
gitradar/
├── index.html          # Frontend (HTML + CSS + JS)
├── api.js              # 🔀 API Gateway (Point d'entrée)
├── scanner.js          # 🤖 Backend (Scan + IA + DB)
├── package.json        # Dépendances
├── .env                # Variables (JAMAIS commit)
└── README.md           # Documentation
```

### Stack Technologique

**Frontend** :
- HTML5 + CSS3 (Vanilla, zéro framework)
- JavaScript pur (pas de build step)
- Design moderne (gradients, glassmorphism)

**Backend** :
- Node.js 18+ (ESM modules)
- Express.js (API Gateway)
- LibSQL/Turso (2 databases)
- JWT Authentication
- GitHub API v3

**Base de Données** :
- **Turso DB 1** : Utilisateurs (email, password, préférences)
- **Turso DB 2** : Repos GitHub (métadonnées + analyse IA)

**IA** :
- Analyse sémantique README
- Extraction métadonnées intelligente
- Scoring utilité multi-critères
- Détection catégories automatique

---

## 📦 Installation

### 1. Prérequis

```bash
node >= 18.0.0
npm ou yarn
```

### 2. Cloner le Projet

```bash
git clone https://github.com/Tryboy869/gitradar.git
cd gitradar
```

### 3. Installer Dépendances

```bash
npm install
```

### 4. Configuration Variables

Copier `.env.example` en `.env` :

```bash
cp .env.example .env
```

Remplir les variables dans `.env` :

```bash
# GitHub Token (créer sur https://github.com/settings/tokens)
GITHUB_TOKEN=ghp_votre_token_ici

# Turso Database URLs (créer sur https://turso.tech)
TURSO_USERS_URL=libsql://gitradar-users-xxx.turso.io
TURSO_USERS_TOKEN=votre_token_users

TURSO_REPOS_URL=libsql://gitradar-repos-xxx.turso.io
TURSO_REPOS_TOKEN=votre_token_repos

# JWT Secret (générer aléatoirement)
JWT_SECRET=votre-secret-complexe-ici
```

### 5. Créer Databases Turso

```bash
# Installer Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Créer DB Users
turso db create gitradar-users
turso db tokens create gitradar-users

# Créer DB Repos
turso db create gitradar-repos
turso db tokens create gitradar-repos

# Copier les URLs et tokens dans .env
```

### 6. Lancer le Projet

```bash
npm start
```

Ouvrir http://localhost:3000

---

## 🌐 Déploiement (Render/Railway)

### Configuration Render

**Build Command** :
```bash
npm install
```

**Start Command** :
```bash
node api.js
```

**Variables d'Environnement** :
- `GITHUB_TOKEN`
- `TURSO_USERS_URL`
- `TURSO_USERS_TOKEN`
- `TURSO_REPOS_URL`
- `TURSO_REPOS_TOKEN`
- `JWT_SECRET`

**⚠️ Ne PAS ajouter `PORT` !** (géré automatiquement)

### Checklist Pré-Déploiement

- [ ] Tous fichiers à la racine (vérifier avec `ls`)
- [ ] `package.json` avec `"main": "api.js"`
- [ ] `.env` dans `.gitignore`
- [ ] Variables configurées sur Render
- [ ] `git push` fait

---

## 📊 Scan Automatique

GitRadar scanne automatiquement **5000 repos toutes les 12h** :

**Top 5 Langages 2025** :
1. 🐍 **Python** (10,000 repos)
2. 🟨 **JavaScript** (10,000 repos)
3. 🔷 **TypeScript** (8,000 repos)
4. 🔵 **Go** (6,000 repos)
5. 🦀 **Rust** (6,000 repos)

**Total** : 40,000 repos indexés

### Critères de Scan

✅ **Inclus** :
- Stars > 50
- README.md présent (> 100 caractères)
- Pas archivé
- Langages TOP 5

❌ **Exclus** :
- Pas de README
- Archivé
- < 50 stars
- README < 100 caractères

---

## 🎯 Utilisation

### Mode Manuel

1. **Rechercher** : Saisir mots-clés (ex: "authentication JWT")
2. **Filtrer** : Choisir langage, catégorie, tri
3. **Explorer** : Cliquer sur repos pour ouvrir GitHub

### Mode IA

1. **Décrire** : "Je veux créer un SaaS avec auth et paiements"
2. **Recevoir** : Recommandations personnalisées automatiques
3. **Construire** : Stack complet suggéré

---

## 🧠 Intelligence IA

### Analyse Automatique

Chaque repo scanné est analysé pour extraire :

```json
{
  "category": "authentication",
  "use_case": "JWT auth for Node.js APIs",
  "problem_solved": "Avoid writing auth boilerplate",
  "target_audience": "backend_developers",
  "tech_stack": ["nodejs", "jwt", "express"],
  "utility_score": 8.7,
  "complexity": "intermediate",
  "production_ready": true,
  "best_for": "lightweight_auth"
}
```

### Utility Score (0-10)

Calculé selon :
- ⭐ **Stars** : Popularité communauté
- 📖 **Documentation** : Qualité README
- 🔄 **Activité** : Mises à jour récentes
- 👥 **Communauté** : Issues/PRs
- 🏗️ **Maturité** : Stabilité projet

---

## 🤝 Contribution

### Besoin d'Aide ?

Ouvrir une **Issue** : https://github.com/Tryboy869/gitradar/issues

### Proposer Améliorations

1. Fork le projet
2. Créer branche (`git checkout -b feature/amazing`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing`)
5. Ouvrir Pull Request

---

## 👤 Auteur

**Abdoul Anzize DAOUDA**  
CEO - Nexus Studio

📧 Email : anzizdaouda0@gmail.com  
🏢 Studio : nexusstudio100@gmail.com  
🐙 GitHub : [@Tryboy869](https://github.com/Tryboy869)

---

## 📄 Licence

MIT License - Libre d'utilisation pour projets personnels et commerciaux.

---

## 🌟 Roadmap

### Phase 1 (Actuelle)
- ✅ Scan TOP 5 langages
- ✅ Recherche manuelle
- ✅ Assistant IA basique
- ✅ Auth utilisateurs

### Phase 2 (Q1 2026)
- [ ] Collections dynamiques
- [ ] Graphe relations repos
- [ ] Comparaison projets
- [ ] Extension Chrome

### Phase 3 (Q2 2026)
- [ ] API publique
- [ ] CLI tool
- [ ] Intégration VS Code
- [ ] Notifications projets

---

## 🙏 Remerciements

- **GitHub** : API publique
- **Turso** : Database edge computing
- **Render** : Hébergement fiable
- **Communauté** : Feedback précieux

---

**🌌 GitRadar - Construis l'impossible. Simplement.**

> "L'open-source mérite d'être découvert intelligemment."  
> - Anzize DAOUDA, 2025