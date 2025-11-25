# Planificateur Recharge Kia EV6

## ✅ Fonctionnalités
- Formulaire SoC initial, SoC minimum, horizon (1j/2j/3j/1 semaine)
- Planification avec règles: borne ≤300m, priorité DC ≥150kW, AC si DC absente
- Intégration OpenChargeMap pour bornes réelles
- IA intégrée via HuggingFace API
- PWA utilisable sur iPhone

## 680 Déploiement sur GitHub Pages
1. Crée un repo GitHub et push ces fichiers.
2. Active GitHub Pages (Settings → Pages → Branch main).
3. Accède à https://<ton-user>.github.io/<repo>.

## 511 Configuration IA (HuggingFace)
1. Crée un compte: https://huggingface.co/join
2. Va dans Settings → Access Tokens → New Token (Read).
3. Copie la clé et remplace `TA_CLE_API_ICI` dans app.js.
4. Modèle recommandé: Mistral-7B-Instruct-v0.1
   API URL: https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1

## 310 Configuration OpenChargeMap
- API URL: https://api.openchargemap.io/v3/poi
- Paramètres: latitude, longitude, distance=0.3, maxresults=5, minpowerkw=150
- Ajoute ta clé API si nécessaire (OpenChargeMap est gratuit mais peut demander un token).

## ✅ Utilisation
- Ouvre la webapp sur iPhone, ajoute à l'écran d'accueil.
- Saisis SoC départ, SoC min retour, horizon.
- Clique Planifier → IA propose stratégie optimisée avec bornes réelles.
