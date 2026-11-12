# Production deployment notes

## Storage: required before production use

The application writes videos, thumbnails, projects, transcripts, feedback, versions and render jobs under `STORAGE_DIR`.

- Local development: leave `STORAGE_DIR` unset; the default is the repository's `storage/` directory.
- Cloud Run: create a Google Cloud Storage bucket and mount it at `/mnt/video-agent-studio`.
- Set the Cloud Run environment variable `STORAGE_DIR=/mnt/video-agent-studio`.
- Grant the Cloud Run service account the minimum bucket permissions required to read and write objects.
- Keep the bucket private. Do not grant public access to uploaded source videos or project files.
- Do not use the same project directory for concurrent edits from multiple Cloud Run instances without adding application-level locking/version checks. Cloud Storage FUSE does not provide file locking for concurrent writes to the same file.

The application can use the mounted directory with ordinary Node.js filesystem calls. Cloud Run supports Cloud Storage bucket volume mounts; see the official guide:
https://cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts

Example deployment flag (replace placeholders):

```bash
gcloud run services update SERVICE_NAME \
  --add-volume mount-path=/mnt/video-agent-studio,type=cloud-storage,bucket=BUCKET_NAME,readonly=false \
  --add-volume-mount volume=video-storage,mount-path=/mnt/video-agent-studio \
  --update-env-vars STORAGE_DIR=/mnt/video-agent-studio
```

Check the generated command against the current Cloud Run CLI version and service configuration before executing it. The Cloud Console volume editor is also supported.

## Important implementation status

This branch removes demo projects and committed sample media, and makes the storage root configurable. It does **not** claim that every editing feature is production-ready.

Before public production use, the following still require implementation and end-to-end tests:

1. Replace the placeholder transcription path with a real Whisper engine invocation and verified word-level timestamps. Never report a successful Whisper transcription if no model was run.
2. Make `prepare_short` actually render silence cuts and audio normalization; persist the resulting edit decision list and output media.
3. Make `capture_motion_component` call the real browser capture/render function, then verify the generated PNG/MP4 exists and is non-empty.
4. Make the final render consume the saved edit specification, source time ranges, split-screen layout, motion assets, subtitles, music and SFX. Verify output duration, dimensions, audio streams and file size with ffprobe before marking the job completed.
5. Replace shell-interpolated FFmpeg/FFprobe commands with argument-array process execution. Validate all file paths and reject remote URLs resolving to private, loopback, link-local or metadata IP ranges.
6. Add authentication and authorization to project, upload, feedback, media and MCP endpoints. CORS is not authentication.
7. Use atomic writes and version/locking checks for project JSON. For multi-instance production, consider a database for project metadata and Cloud Storage for large media assets.
8. Add upload size limits, MIME/container validation, quotas, cleanup policies, structured logs, health checks and automated tests.
9. Configure the Cloud Run container image with pinned FFmpeg/FFprobe, Chromium/Playwright and a verified Whisper binary/model. A package.json dependency alone does not install these system binaries.

## Git hygiene

The `storage/` directory is runtime data, not source code. It is ignored by Git. Keep videos, renders, credentials and user data out of commits. Rotate any credential that was ever committed; deleting it from the latest tree does not erase it from Git history.
