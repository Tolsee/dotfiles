// Preloaded by codex-review through NODE_OPTIONS. Node resolves
// process.execPath to the versioned Homebrew Cellar path, and the Codex plugin
// spawns its broker with spawn(process.execPath), so a `brew upgrade node`
// that deletes the old Cellar folder mid-run makes that spawn fail with
// ENOENT. Point execPath at the stable, unresolved path the wrapper chose.
if (process.env.CODEX_REVIEW_NODE) {
  process.execPath = process.env.CODEX_REVIEW_NODE;
}
