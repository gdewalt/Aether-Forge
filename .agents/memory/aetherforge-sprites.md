---
name: Aetherforge unit sprites via object storage
description: How large user-supplied sprite art was integrated without bloating the git repo, and the async sprite-load DOM-patch pattern this required.
---

## Storage approach

Large binary art assets (hundreds of MB) should not go into the git repo. When a user supplies bulk image assets (e.g. via a shareable download link) to be shown in an app:

1. Download and optimize once (resize to the actual max on-screen display size, strip metadata, use max PNG compression) before uploading anywhere — this can cut size by ~85-90% with no visible quality loss if the display size is much smaller than the source.
2. Upload the optimized assets directly into the Replit Object Storage bucket (via a one-off Node script using the same GCS-sidecar credential pattern as the object-storage skill's `objectStorage.ts` template), not into git.
3. Serve them through a trimmed-down copy of the object-storage skill's public-object route (`GET /storage/public-objects/*filePath`) in whichever server artifact is available — skip the presigned-upload endpoint/OpenAPI codegen entirely if uploads are one-off/agent-driven rather than end-user-driven.
4. Point client code at the server's route through the shared proxy path prefix (e.g. `/api/storage/public-objects/...`), not a relative/local static path.

**Why:** keeps the repo small while still giving the app real art; avoids re-implementing upload/ACL machinery that isn't needed when there's no end-user upload flow.

## Async sprite load in innerHTML-based UIs

If the game/app renders via synchronous `innerHTML` string templates (no virtual DOM), an image that must be fetched over the network will not be loaded yet at first render — the naive approach (check a "loaded" flag, fall back to a placeholder) permanently shows the placeholder because nothing re-renders when the image finishes loading later.

**Fix pattern:** tag the placeholder markup with a `data-*` attribute identifying the asset, and in the image's `onload` handler, query the live DOM for any elements still showing that attribute and patch them in-place (`el.outerHTML = ...`) with the real content. This avoids needing to track/re-invoke whichever function originally rendered the current screen (which is often one of many call sites in innerHTML-based codebases).

**How to apply:** any time you're adding lazily-loaded remote assets (images, etc.) into a codebase that renders via `innerHTML` and has no central re-render/redraw hook, use the tag-and-patch approach rather than assuming the first render will already have the asset ready.
