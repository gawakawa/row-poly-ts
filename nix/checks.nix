_: {
  perSystem =
    { config, pkgs, ... }:
    {
      checks.tests = pkgs.stdenvNoCC.mkDerivation {
        name = "tests";
        src = ./..;

        nativeBuildInputs = [
          config.nodejsPackage
          config.pnpmPackage
        ];

        dontBuild = true;

        doCheck = true;
        checkPhase = ''
          runHook preCheck
          export HOME="$(mktemp -d)" # sandbox's default $HOME isn't writable
          # Run from $HOME, not the project dir, while disabling pnpm's
          # package-manager auto-management: relevant if a future
          # "packageManager" field is added to package.json, so pnpm never
          # tries to fetch/verify a pinned version over the network from
          # inside the sandboxed build.
          (cd "$HOME" && pnpm config set manage-package-manager-versions false)
          source ${config.packages.nodeModulesSetup}
          pnpm test
          runHook postCheck
        '';

        installPhase = ''
          runHook preInstall
          touch $out
          runHook postInstall
        '';
      };
    };
}
