#!/usr/bin/env bash
#
# Builds the standalone `reviewist-export` binary via node's Single Executable
# Applications support: bundle to CommonJS, generate the SEA blob, inject it
# into a copy of the node binary.
set -euo pipefail

out=reviewist-export
fuse=NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

esbuild src/cli.ts --bundle --platform=node --format=cjs --outfile=build/cli.cjs
node --experimental-sea-config sea-config.json

# The node in the nix store is read-only, so the copy needs write permission
# before postject can patch the blob into it.
cp "$(command -v node)" "$out"
chmod u+w "$out"

postject "$out" NODE_SEA_BLOB build/sea-prep.blob --sentinel-fuse "$fuse"
