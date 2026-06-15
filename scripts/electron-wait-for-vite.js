// electron-wait-for-vite.js

import { spawn } from 'child_process';
import { createServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const vitePort = 5173;

function getElectronBinary() {
    const distDir = path.join(projectRoot, 'node_modules', 'electron', 'dist');

    if (process.platform === 'win32') {
        return path.join(distDir, 'electron.exe');
    }

    if (process.platform === 'darwin') {
        return path.join(distDir, 'Electron.app', 'Contents', 'MacOS', 'Electron');
    }

    return path.join(distDir, 'electron');
}

async function startViteAndElectron() {
    try {
        const viteServer = await createServer({
            configFile: path.join(projectRoot, 'vite.config.ts'),
            server: {
                port: vitePort,
                strictPort: true,
            },
        });

        await viteServer.listen();
        const devServerUrl = `http://localhost:${vitePort}`;
        console.log(`Vite server running on ${devServerUrl}`);

        const electronBinary = getElectronBinary();
        const electronProcess = spawn(electronBinary, ['.'], {
            cwd: projectRoot,
            stdio: 'inherit',
            env: {
                ...process.env,
                NODE_ENV: 'development',
                VITE_DEV_SERVER_URL: devServerUrl,
            },
        });

        electronProcess.on('error', (err) => {
            console.error('Ошибка запуска Electron:', err);
            viteServer.close();
            process.exit(1);
        });

        electronProcess.on('close', (code) => {
            console.log(`Electron process exited with code ${code}`);
            viteServer.close();
            process.exit(code ?? 0);
        });
    } catch (e) {
        console.error('Ошибка в скрипте запуска:', e);
        process.exit(1);
    }
}

startViteAndElectron();
