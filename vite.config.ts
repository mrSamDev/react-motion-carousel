import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import LoggerPlugin from "./plugins/logger.ts";
import FlagsPlugin, { getFlags } from "./plugins/flags.ts";

const flags = getFlags();

// https://vite.dev/config/

export default defineConfig(({ command }) => {
  let options = {};
  if (command === "build") {
    options = {
      esbuild: {
        drop: ["console"],
      },
    };
  }

  return {
    plugins: [react(), FlagsPlugin(), LoggerPlugin({ flags })],
    ...options,
  };
});
