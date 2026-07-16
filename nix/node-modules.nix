_: {
  perSystem =
    { config, pkgs, ... }:
    let
      pnpm = config.pnpmPackage;
      nodejs = config.nodejsPackage;
      src = ./..;

      pnpmDeps = pkgs.fetchPnpmDeps {
        pname = "pnpm-project-deps";
        version = "1.0.0";
        inherit src pnpm;
        fetcherVersion = 3;
        hash = "sha256-7bjUgtF/CPdfVWV+EsVXYNFvULfPktS9jfA6Dsl3YT4=";
      };

      nodeModules = pkgs.stdenvNoCC.mkDerivation {
        name = "pnpm-project-node-modules";
        inherit src pnpmDeps;

        nativeBuildInputs = [
          nodejs
          pkgs.pnpmConfigHook
          pnpm
        ];

        dontBuild = true;

        installPhase = ''
          runHook preInstall
          cp -r node_modules $out
          runHook postInstall
        '';
      };
    in
    {
      # Prebuilt node_modules; consumers symlink this instead of installing.
      packages.nodeModules = nodeModules;

      # `source`-able snippet: writable node_modules, entries symlinked from
      # the store above (no re-download). Needed over a plain `ln -sfn`
      # whenever a consumer also writes new entries under node_modules
      # (e.g. a tool's own cache directory).
      packages.nodeModulesSetup = pkgs.writeShellScript "node-modules-setup" ''
        (
          shopt -s dotglob nullglob

          # node_modules must be a real directory. Clear it first if it's a
          # symlink (dangling, or the old top-level `ln -sfn` style) or a
          # plain file, so `[ ! -d node_modules ]` below reflects reality.
          if [ -L node_modules ] || { [ -e node_modules ] && [ ! -d node_modules ]; }; then
            rm -f node_modules
          fi

          if [ ! -d node_modules ]; then
            mkdir node_modules
            entries=(${nodeModules}/*)
            if [ ''${#entries[@]} -gt 0 ]; then
              ln -s -t node_modules -- "''${entries[@]}"
            fi
          fi
        )
      '';
    };
}
