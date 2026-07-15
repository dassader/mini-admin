import { createReadStream, existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const FIRMWARE_FILES = new Set(['firmware.bin', 'firmware.img', 'app.bin']);

function serveDistFirmware(): Plugin {
  return {
    name: 'serve-dist-firmware',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const fileName = basename(new URL(request.url ?? '/', 'http://localhost').pathname);
        if (!FIRMWARE_FILES.has(fileName)) {
          next();
          return;
        }

        const filePath = resolve(process.cwd(), 'dist', fileName);
        if (!existsSync(filePath)) {
          response.statusCode = 404;
          response.end('Firmware image not found');
          return;
        }

        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/octet-stream');
        response.setHeader('Cache-Control', 'no-store');
        createReadStream(filePath).pipe(response);
      });
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [serveDistFirmware(), react(), viteSingleFile()],
  build: {
    emptyOutDir: true,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
