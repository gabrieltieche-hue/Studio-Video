# Lancer Video Agent Studio en ligne depuis la tablette

Le dépôt contient une interface React, un serveur Express, les API de projets/commentaires, FFmpeg et Playwright. Le script ci-dessous démarre l'application complète sur la tablette et l'expose avec un Cloudflare Quick Tunnel HTTPS temporaire. Cela ne crée aucun service cloud permanent et ne nécessite pas de compte Cloudflare.

## Une seule commande

Dans Termux, entre dans Ubuntu avec `config`, puis colle :

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/gabrieltieche-hue/Studio-Video/production-hardening/scripts/start-studio-online.sh)
```

Le script :
- clone ou met à jour la branche `production-hardening` dans `~/Studio-Video` ;
- vérifie Node.js 22+, installe les dépendances et construit l'interface ;
- installe FFmpeg si nécessaire ;
- génère une clé d'accès locale protégée par les permissions du fichier ;
- démarre le serveur en mode production sur le port 3000 ;
- ouvre un lien HTTPS temporaire `trycloudflare.com`.

Ouvre le lien HTTPS affiché. À la première requête, le navigateur demandera la clé affichée dans le terminal. Ne partage pas cette clé. Les API et fichiers vidéo sont protégés ; l'URL seule ne suffit pas à les consulter.

Garde le terminal ouvert : fermer Termux, tuer le processus ou redémarrer la tablette arrête le serveur et le tunnel. À chaque nouveau démarrage, Cloudflare génère une nouvelle URL.

## Points à connaître

- Cette URL est temporaire et conçue pour les tests/partages, pas pour un hébergement permanent.
- L'interface et les API REST fonctionnent sur la même origine ; le tunnel n'a pas besoin de SSE.
- Le tunnel Quick Tunnel ne fournit pas le serveur MCP à lui seul. L'application web est publiée ; le raccordement direct de l'outil ChatGPT VF doit rester distinct.
- Le script détecte un binaire/modèle Whisper déjà installé dans `~/whisper.cpp` ou `~/models`. S'ils n'existent pas, l'interface fonctionne mais la transcription doit être configurée séparément.
- Les médias, projets et clés sont stockés localement dans `~/Studio-Video/storage` et `~/Studio-Video/.studio-api-key`, jamais dans Git.

Pour arrêter : appuie sur Ctrl+C dans le terminal du lanceur.
