// electron-wait-for-vite.js

import { spawn } from 'child_process';
import { createServer } from 'vite';

const vitePort = 5173;

async function startViteAndElectron() {
    try {
        // 1. Запуск Vite в режиме разработки
        const viteServer = await createServer({
            server: { port: vitePort }
        });

        await viteServer.listen();
        console.log(`Vite server running on http://localhost:${vitePort}`);

        // 2. Настройка Electron
        process.env.NODE_ENV = 'development';

        // Определяем путь к исполняемому файлу Electron
        // 'electron' - работает, если он установлен глобально или находится в PATH.
        // Более надежный способ - использовать путь из node_modules.
        
        // Для простоты и кроссплатформенности, давайте явно используем 'electron'
        // но изменим аргументы.
        
        // Аргументы: 
        // Первый аргумент '.' указывает Electron запустить main.js из текущей папки.
        const electronProcess = spawn('electron', ['.'], {
            stdio: 'inherit',
            shell: true // Это может помочь в некоторых окружениях Windows
        });

        electronProcess.on('error', (err) => {
            console.error('Ошибка запуска Electron:', err);
            viteServer.close();
            process.exit(1);
        });

        electronProcess.on('close', (code) => {
            console.log(`Electron process exited with code ${code}`);
            viteServer.close();
            process.exit(code);
        });

    } catch (e) {
        console.error('Ошибка в скрипте запуска:', e);
        process.exit(1);
    }
}

startViteAndElectron();