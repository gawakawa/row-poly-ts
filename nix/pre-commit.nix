_: {
  perSystem =
    { config, pkgs, ... }:
    {
      pre-commit.settings.hooks = {
        treefmt.enable = true;
        statix.enable = true;
        deadnix.enable = true;
        actionlint.enable = true;
        zizmor = {
          enable = true;
          args = [ "--offline" ];
        };
        oxlint = {
          enable = true;
          name = "oxlint";
          extraPackages = [ config.nodejsPackage ]; # tsgolint (type-aware) needs node
          entry = toString (
            pkgs.writeShellScript "oxlint-entry" ''
              source ${config.packages.nodeModulesSetup}
              exec ${pkgs.oxlint}/bin/oxlint
            ''
          );
          files = "\\.(ts|tsx|js|jsx)$";
          pass_filenames = false;
        };
        workflow-timeout = {
          enable = true;
          name = "Check workflow timeout-minutes";
          package = pkgs.check-jsonschema;
          entry = "${pkgs.check-jsonschema}/bin/check-jsonschema --builtin-schema github-workflows-require-timeout";
          files = "\\.github/workflows/.*\\.ya?ml$";
        };
      };
    };
}
