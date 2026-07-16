# CLAUDE.md

- `README.md` — Project overview and usage
- `CONTRIBUTING.md` — Developer guide: commands and workflow
- `docs/DESIGN.md` — Design and architecture

## Updating dependencies

After changing dependencies, run `nix flake check` and copy the correct hash from the `got:` line in the error output into `nix/node-modules.nix`.
