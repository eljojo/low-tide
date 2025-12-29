{
  description = "Low Tide - self-hosted media download manager";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    playwright.url = "github:pietdevries94/playwright-web-flake";
    playwright.inputs.nixpkgs.follows = "nixpkgs";
    playwright.inputs.flake-utils.follows = "flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, playwright }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [
            (final: prev: {
              inherit (playwright.packages.${system}) playwright-test playwright-driver;
            })
          ];
        };

        nixosModules.low-tide = import ./nixos/module.nix;

        frontend = pkgs.buildNpmPackage {
          pname = "low-tide-frontend";
          version = "0.0.1";
          src = ./.;

          # npmDepsHash = pkgs.lib.fakeHash; # keep for development purposes
          npmDepsHash = "sha256-tDH5Gx/pc7saixp7y2MG+Cna/wIpHKsdj8yfsXRJ7gI";
          # remember to keep in sync with hash for e2e-tests package

          dontBuild = true;

          installPhase = ''
            make build-frontend
            mkdir -p $out/static
            cp -r static $out/
          '';
        };

        low-tide = pkgs.buildGoModule {
          pname = "low-tide";
          version = "1.0.0";
          src = ./.;

          # vendorHash = pkgs.lib.fakeHash; # keep for development purposes
          vendorHash = "sha256-Wtv1FSrs1EuPVZYUynwh8Q6/tYPEvMGQP0dwCUxG4EI=";

          preBuild = ''
            cp -r ${frontend}/static .
          '';

          subPackages = [ "." ];

          nativeBuildInputs = [ pkgs.pkg-config pkgs.curl ];
          buildInputs = [ pkgs.sqlite ];

          env = {
            CGO_ENABLED = "1";
          };
        };

        dockerImage = pkgs.dockerTools.buildLayeredImage {
          name = "low-tide";
          tag = "latest";
          contents = [
            pkgs.yt-dlp
            pkgs.ffmpeg
            pkgs.python3
            pkgs.cacert
          ];
          config = {
            Cmd = [ "${low-tide}/bin/low-tide" ];
            ExposedPorts = {
              "8080/tcp" = { };
            };
            Env = [
              "LOWTIDE_CONFIG=/app/config/config.yaml"
            ];
            WorkingDir = "/app";
          };
          # Add default config and structure
          extraCommands = ''
            mkdir -p app/config data/downloads
            sed -e 's|db_path:.*|db_path: "/data/lowtide.db"|' \
                -e 's|downloads_dir:.*|downloads_dir: "/data/downloads"|' \
                ${./config/config.yaml} > app/config/config.yaml
          '';
        };

      in
      {
        packages = {
          default = low-tide;
          container = dockerImage;
          e2e-tests = pkgs.buildNpmPackage {
            pname = "low-tide-e2e";
            version = "1.0.0";
            src = ./.;

            npmDepsHash = "sha256-tDH5Gx/pc7saixp7y2MG+Cna/wIpHKsdj8yfsXRJ7gI";

            nativeBuildInputs = [
              low-tide
              pkgs.curl
              pkgs.playwright-test
              pkgs.playwright-driver
            ];

            env = {
              PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
              PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
            };

            dontNpmBuild = true;

            buildPhase = ''
              # Remove the npm-installed playwright to avoid conflicts with the Nix-provided one
              rm -rf node_modules/@playwright node_modules/.bin/playwright
              ln -s ${pkgs.playwright-test}/bin/playwright node_modules/.bin/playwright

              ln -s ${low-tide}/bin/low-tide low-tide
              echo "Running Playwright E2E tests..."
              ${pkgs.playwright-test}/bin/playwright test
            '';

            installPhase = ''
              mkdir -p $out
              if [ -d e2e/tmp/playwright-report ]; then
                cp -r e2e/tmp/playwright-report/* $out/
              fi
            '';
          };
        };

        checks = {
          # The main package already runs Go integration tests in its checkPhase
          go-tests = low-tide;
          e2e-tests = self.packages.${system}.e2e-tests;
        };

        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.go
            pkgs.nodejs
            pkgs.esbuild
            pkgs.sqlite
            pkgs.yt-dlp
            pkgs.ffmpeg
            pkgs.curl
            pkgs.typescript
            pkgs.playwright-test
          ];
          shellHook = ''
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
            export PLAYWRIGHT_BROWSERS_PATH="${pkgs.playwright-driver.browsers}"
          '';
        };
      }
    );
}
