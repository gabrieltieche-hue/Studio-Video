# Video Agent Studio

Studio de montage et de production vidéo piloté par IA. Interface React, serveur
Express, FFmpeg, Playwright et transcription Whisper locale. Conçu pour produire
des formats verticaux 9:16 (faceless explainer, split-screen clips) avec une
timeline multi-pistes et un export de retours exploitable par un LLM.

**Démo locale :** `http://127.0.0.1:3000` après `npm run dev`.

---

## Fonctionnalités

- **Timeline multi-pistes** : clips, overlays, sous-titres, audio, motion.
- **Player 9:16** avec contrôles de lecture et inspection d'éléments.
- **Transcription Whisper** : word-level timestamps via `whisper.cpp`.
- **Montage assisté** : split-screen, recadrage, suppression de silences,
  normalisation audio, export de l'edit decision list.
- **Motion components** : capture navigateur Playwright vers PNG/MP4.
- **Contact sheet** et export de prompt de retours pour ChatGPT / MCP.
- **Projets, versions, commentaires** : stockage local ou bucket monté.

## Stack

| Couche | Choix |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, lucide-react, motion |
| Backend | Node.js 22+, Express, `tsx` |
| Média | FFmpeg / FFprobe, Playwright, whisper.cpp |
| IA | Google GenAI (optionnel), MCP |
| Déploiement | Docker, Google Cloud Run |

## Démarrage

Prérequis : Node.js ≥ 22, FFmpeg, et idéalement `whisper.cpp` + un modèle
`ggml-base.bin` pour la transcription.

```bash
npm install
cp .env.example .env
npm run dev
```

Ouvrir <http://127.0.0.1:3000>. Sans clé `STUDIO_API_KEY`, le serveur local
fonctionne sans authentification ; en production, la clé est obligatoire.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur Express + Vite en développement |
| `npm run build` | Build du frontend |
| `npm start` | Serveur de production |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Tests Node (`tsx --test`) |

## Architecture

```text
server.ts                 API Express, auth, projets, médias, MCP
src/
  components/             timeline, player, modales, recorder, sidebar
  server/ffmpegEngine.ts  probes, cuts, rendus, normalisation
  server/storageManager.ts projets, versions, feedbacks, uploads
  types/studio.ts         contrat de données partagé
storage/                  données runtime (ignoré par Git)
```

Le serveur sert l'API et le frontend sur la même origine. Les fichiers médias et
les projets vivent sous `STORAGE_DIR`, jamais dans Git.

## Configuration

| Variable | Rôle |
|---|---|
| `PORT` | Port HTTP (3000 en local, 8080 dans l'image Docker) |
| `STORAGE_DIR` | Racine des projets et médias |
| `MAX_VIDEO_UPLOAD_BYTES` | Taille maximale d'un upload |
| `STUDIO_API_KEY` | Clé d'accès aux API et aux médias |
| `ALLOWED_ORIGINS` | Origines CORS autorisées (liste séparée par virgules) |
| `WHISPER_CLI_PATH`, `WHISPER_MODEL_PATH` | Binaire et modèle Whisper |
| `GOOGLE_API_KEY` / GenAI | Fonctions IA optionnelles |

Les secrets se placent dans Secret Manager en production. Ne jamais committer
`.env`, `.studio-api-key`, `storage/` ni un média utilisateur.

## Production

L'image Docker épingle Playwright, FFmpeg et whisper.cpp ; elle cible Cloud Run
avec un bucket Cloud Storage monté sur `/mnt/video-agent-studio`.

```bash
docker build -t video-agent-studio .
docker run -p 8080:8080 -e STUDIO_API_KEY=... -v "$PWD/storage:/data" video-agent-studio
```

Points de vigilance avant une exposition publique :

- authentification et autorisation des routes projets / uploads / médias ;
- limites de taille, validation MIME, quotas et nettoyage ;
- écritures atomiques et verrouillage des projets JSON ;
- chemins FFmpeg passés en tableaux d'arguments, sans interpolation shell ;
- vérification `ffprobe` de chaque rendu avant de marquer un job terminé.

Le détail de l'état réel et des chantiers restants est dans
[`PRODUCTION_READINESS.md`](PRODUCTION_READINESS.md).

## Limites connues

Le dépôt ne prétend pas que toutes les fonctions d'édition sont prêtes pour la
production. La transcription, le rendu final, la capture motion et l'export
doivent être validés de bout en bout sur une instance équipée. Les données de
démonstration et les médias ne sont pas versionnés.

## Sécurité

- Clé d'accès générée localement, permissions de fichier restrictives.
- CORS n'est pas une authentification.
- Aucun secret, aucune vidéo source et aucune donnée utilisateur dans Git.
- En cas de fuite de clé : rotation immédiate, puis purge de l'historique.
