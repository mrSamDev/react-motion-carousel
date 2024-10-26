import path from "path";
import { Plugin } from "vite";
import { IFlags } from "./flags";

export default function conditionalLoggerPlugin({ flags }: { flags: IFlags }): Plugin {
  const filePath = path.resolve(__dirname, `../src/features/logger/${flags.logger.name}.ts`);
  ///DDDDD
  return {
    name: "logger-module",
    enforce: "pre",
    config() {
      // Setup alias in config
      return {
        resolve: {
          alias: {
            logger: filePath, // dynamically set logger alias
          },
        },
        optimizeDeps: {
          exclude: ["logger"], // Prevent Vite from pre-bundling `logger`
        },
      };
    },
    resolveId(source) {
      if (source === "logger") {
        return filePath; // return path explicitly for `logger`
      }
      return null;
    },
  };
}
