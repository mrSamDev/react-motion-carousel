import fs from "fs";
import path from "path";
import { Plugin } from "vite";

export default function flags(): Plugin {
  let flagFile: string;

  return {
    name: "flag-plugin",

    configResolved(config) {
      flagFile = path.resolve(config.root, "../buildFlags.json");
    },

    configureServer(server) {
      server.watcher.add(flagFile);
    },

    async buildStart() {
      ///add the call to get prod config
    },

    handleHotUpdate({ file, server }) {
      if (file.includes("/buildFlags.json")) server.restart();
    },
  };
}

export function getFlags(): IFlags {
  const flagsPath = path.resolve(__dirname, "../buildFlags.json");
  const flags = JSON.parse(fs.readFileSync(flagsPath, "utf-8"));
  return flags;
}

interface ModuleConfig {
  name: string;
  modules: {
    exclude: string[];
    include: string[];
  };
}

export interface IFlags {
  [key: string]: ModuleConfig;
}
