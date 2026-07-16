{ flake-parts-lib, ... }:
{
  options.perSystem = flake-parts-lib.mkPerSystemOption (
    { lib, ... }:
    {
      options.pnpmPackage = lib.mkOption {
        type = lib.types.package;
        description = "The pnpm package used throughout the project.";
      };
      options.nodejsPackage = lib.mkOption {
        type = lib.types.package;
        description = "The Node.js package used throughout the project.";
      };
    }
  );

  config.perSystem =
    { pkgs, ... }:
    {
      pnpmPackage = pkgs.pnpm_10;
      nodejsPackage = pkgs.nodejs_24;
    };
}
