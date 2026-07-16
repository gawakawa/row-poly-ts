---
paths:
  - 'package.json'
---

When managing dependencies, use `pnpm` commands instead of editing package.json directly.

After adding or updating dependencies, update the `fetchPnpmDeps` hash in `nix/node-modules.nix`:

1. Run `nix flake check` — it will fail with a hash mismatch error
2. Copy the hash from the `got:` line in the error output
3. Replace the `hash` value in `nix/node-modules.nix` with the new hash
