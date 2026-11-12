#!/usr/bin/env bash
set -Eeuo pipefail

REPO_URL="https://github.com/gabrieltieche-hue/Studio-Video.git"
BRANCH="production-hardening"
APP_DIR="${STUDIO_APP_DIR:-$HOME/Studio-Video}"
PORT="${PORT:-3000}"
LOCAL_URL="http://127.0.0.1:${PORT}"

say() { printf '\n[Video Agent Studio] %s\n' "$*"; }
die() { printf '\nERREUR: %s\n' "$*" >&2; exit 1; }

for cmd in git curl tar openssl find; do
  command -v "$cmd" >/dev/null 2>&1 || die "Commande manquante: $cmd"
done
command -v node >/dev/null 2>&1 || die "Node.js n'est pas installé dans cet environnement Ubuntu. Dans Termux, installe nodejs-lts puis relance depuis Ubuntu."
command -v npm >/dev/null 2>&1 || die "npm est absent. Réinstalle Node.js LTS dans Termux puis relance."
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
(( NODE_MAJOR >= 22 )) || die "Node.js 22 ou plus récent est requis (version actuelle: $(node -v))."

if [[ ! -d "$APP_DIR/.git" ]]; then
  if [[ -e "$APP_DIR" ]]; then
    die "Le dossier $APP_DIR existe mais n'est pas un dépôt Git. Définis STUDIO_APP_DIR=$HOME/Studio-Video-live pour utiliser un dossier séparé."
  fi
  say "Téléchargement de l'application depuis GitHub (branche $BRANCH)…"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  say "Mise à jour du dépôt local…"
  git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
fi
cd "$APP_DIR"

if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
  if [[ "$(id -u)" -eq 0 ]] && command -v apt-get >/dev/null 2>&1; then
    say "Installation de FFmpeg…"
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y ffmpeg
  else
    die "FFmpeg/FFprobe manquent. Dans Ubuntu, installe-les avec: apt-get update && apt-get install -y ffmpeg"
  fi
fi

say "Installation des dépendances Node.js…"
npm install --no-audit --no-fund

say "Construction de l'interface web…"
npm run build

mkdir -p "$HOME/.local/bin"
if ! command -v cloudflared >/dev/null 2>&1; then
  case "$(uname -m)" in
    aarch64|arm64) CF_ARCH="arm64" ;;
    x86_64|amd64) CF_ARCH="amd64" ;;
    *) die "Architecture non prise en charge pour cloudflared: $(uname -m)" ;;
  esac
  say "Installation du client Cloudflare Tunnel ($CF_ARCH)…"
  CF_TMP="$(mktemp)"
  trap 'rm -f "$CF_TMP"' EXIT
  curl -fL --retry 3 "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}" -o "$CF_TMP"
  install -m 0755 "$CF_TMP" "$HOME/.local/bin/cloudflared"
  rm -f "$CF_TMP"
  trap - EXIT
  export PATH="$HOME/.local/bin:$PATH"
fi

KEY_FILE="$APP_DIR/.studio-api-key"
# Rotate the local bearer secret on each fresh launch. This invalidates any key
# that may have appeared in a shared terminal log or conversation.
(umask 077; openssl rand -hex 32 > "$KEY_FILE") || die "Impossible de générer la clé d'accès. Vérifie qu'OpenSSL est installé."
STUDIO_API_KEY="$(cat "$KEY_FILE")"
chmod 600 "$KEY_FILE"

# If the local Whisper build/model already exists, wire it in automatically.
WHISPER_CLI_PATH="${WHISPER_CLI_PATH:-$(command -v whisper-cli 2>/dev/null || true)}"
if [[ -z "$WHISPER_CLI_PATH" ]]; then
  for candidate in "$HOME/whisper.cpp/build/bin/whisper-cli" "$HOME/whisper.cpp/build/bin/main"; do
    [[ -x "$candidate" ]] && WHISPER_CLI_PATH="$candidate" && break
  done
fi
WHISPER_MODEL_PATH="${WHISPER_MODEL_PATH:-}"
if [[ -z "$WHISPER_MODEL_PATH" ]]; then
  for folder in "$HOME/whisper.cpp/models" "$HOME/models"; do
    if [[ -d "$folder" ]]; then
      WHISPER_MODEL_PATH="$(find "$folder" -maxdepth 2 -type f \( -name 'ggml-base*.bin' -o -name 'ggml-small*.bin' \) -print -quit 2>/dev/null || true)"
      [[ -n "$WHISPER_MODEL_PATH" ]] && break
    fi
  done
fi

say "Démarrage du serveur protégé sur $LOCAL_URL…"
if curl -fsS "$LOCAL_URL/healthz" >/dev/null 2>&1; then
  say "Un serveur répond déjà sur le port $PORT. Je ne démarre pas un doublon."
  die "Arrête l'ancien serveur ou choisis PORT=3001, puis relance."
fi

export NODE_ENV=production PORT STUDIO_API_KEY
export STORAGE_DIR="${STORAGE_DIR:-$APP_DIR/storage}"
[[ -n "$WHISPER_CLI_PATH" ]] && export WHISPER_CLI_PATH
[[ -n "$WHISPER_MODEL_PATH" ]] && export WHISPER_MODEL_PATH

"$APP_DIR/node_modules/.bin/tsx" "$APP_DIR/server.ts" > "$APP_DIR/studio-server.log" 2>&1 &
SERVER_PID=$!
printf '%s\n' "$SERVER_PID" > "$APP_DIR/studio-server.pid"

cleanup() {
  say "Arrêt du tunnel et du serveur…"
  kill "$SERVER_PID" >/dev/null 2>&1 || true
  rm -f "$APP_DIR/studio-server.pid"
}
trap cleanup INT TERM EXIT

READY=0
for _ in $(seq 1 45); do
  if curl -fsS "$LOCAL_URL/healthz" >/dev/null 2>&1; then READY=1; break; fi
  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    tail -n 80 "$APP_DIR/studio-server.log" >&2 || true
    die "Le serveur s'est arrêté pendant le démarrage."
  fi
  sleep 1
done
[[ "$READY" -eq 1 ]] || { tail -n 80 "$APP_DIR/studio-server.log" >&2 || true; die "Le serveur n'a pas répondu sur le port $PORT."; }

say "Serveur local opérationnel."
say "Interface locale: $LOCAL_URL"
say "La clé d'accès sera demandée à la première ouverture du studio."
say "Nouvelle clé d'accès générée; l'ancienne est invalidée."
say "Pour la saisir dans le navigateur, lis-la localement dans un second terminal avec :"
printf 'cat %q\n' "$KEY_FILE"
say "Ne colle jamais cette clé dans ChatGPT, GitHub ou un message partagé."
say "Ouverture du tunnel HTTPS temporaire. Copie l'adresse trycloudflare.com affichée ci-dessous."
say "Garde ce terminal ouvert. Ctrl+C arrête le serveur et le lien public."
say "Whisper: $([[ -n "$WHISPER_CLI_PATH" && -n "$WHISPER_MODEL_PATH" ]] && echo 'binaire et modèle détectés' || echo "non configuré dans cet environnement; le studio s'ouvrira, mais la transcription sera indisponible")"

cloudflared tunnel --no-autoupdate --url "$LOCAL_URL"
