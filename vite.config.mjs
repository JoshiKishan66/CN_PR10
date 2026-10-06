import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const legacyScripts = ["sensorService.js", "history.js", "alerts.js", "charts.js", "app.js"];

export default {
  plugins: [
    {
      name: "copy-classic-app-scripts",
      apply: "build",
      async closeBundle() {
        const outputDirectory = resolve(process.cwd(), "dist/js");
        await mkdir(outputDirectory, { recursive: true });
        await Promise.all(legacyScripts.map((file) =>
          copyFile(resolve(process.cwd(), "js", file), resolve(outputDirectory, file))
        ));
      },
    },
  ],
};