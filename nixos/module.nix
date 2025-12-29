{ lib, config, pkgs, ... }:
let
  cfg = config.services.low-tide;
in
{
  options.services.low-tide = {
    enable = lib.mkEnableOption "Low Tide media download manager";

    package = lib.mkOption {
      type = lib.types.package;
      default = pkgs.low-tide;
      description = "low-tide package to run (usually from a flake input).";
    };

    user = lib.mkOption { type = lib.types.str; default = "lowtide"; };
    group = lib.mkOption { type = lib.types.str; default = "lowtide"; };

    dataDir = lib.mkOption { type = lib.types.path; default = "/var/lib/low-tide"; };
    configFile = lib.mkOption { type = lib.types.path; default = "/etc/low-tide/config.yaml"; };

    extraPackages = lib.mkOption {
      type = lib.types.listOf lib.types.package;
      default = [ ];
      description = "Extra packages added to PATH for the service.";
    };

    environment = lib.mkOption {
      type = lib.types.attrsOf lib.types.str;
      default = { };
      description = "Extra environment variables for the service.";
    };
  };

  config = lib.mkIf cfg.enable {
    users.groups.${cfg.group} = { };
    users.users.${cfg.user} = {
      isSystemUser = true;
      group = cfg.group;
      home = cfg.dataDir;
      createHome = true;
    };

    systemd.services.low-tide = {
      description = "Low Tide";
      after = [ "network-online.target" ];
      wants = [ "network-online.target" ];
      wantedBy = [ "multi-user.target" ];

      serviceConfig = {
        User = cfg.user;
        Group = cfg.group;

        WorkingDirectory = cfg.dataDir;
        ExecStart = "${cfg.package}/bin/low-tide";

        Restart = "on-failure";
        RestartSec = "2s";

        NoNewPrivileges = true;
        PrivateTmp = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        ReadWritePaths = [ cfg.dataDir ];
        ReadOnlyPaths = [ cfg.configFile ];
      };

      preStart = ''
        mkdir -p "${cfg.dataDir}/config" "${cfg.dataDir}/state" "${cfg.dataDir}/cache"
      '';

      environment =
        {
          LOWTIDE_CONFIG = cfg.configFile;
          HOME = cfg.dataDir;
          XDG_CONFIG_HOME = "${cfg.dataDir}/config";
          XDG_STATE_HOME  = "${cfg.dataDir}/state";
          XDG_CACHE_HOME  = "${cfg.dataDir}/cache";
        }
        // cfg.environment;

      systemd.tmpfiles.rules =
        let
          home = cfg.dataDir;
          u = cfg.user;
          g = cfg.group;
        in
        [
          "d ${home} 0750 ${u} ${g} - -"
          "d ${home}/config 0750 ${u} ${g} - -"
        ];

      path = [ pkgs.yt-dlp pkgs.ffmpeg pkgs.curl pkgs.axel pkgs.sqlite ] ++ cfg.extraPackages;
    };
  };
}
