const { spawn } = require('child_process');
const fs = require('fs');

console.log('Starting debug runner...');
const logStream = fs.createWriteStream('debug_vite_runner.log', { flags: 'a' });

try {
    const child = spawn('npm', ['run', 'dev', '--', '--host'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: process.env // Inherit env
    });

    child.stdout.on('data', (data) => {
        logStream.write('[STDOUT] ' + data.toString());
    });

    child.stderr.on('data', (data) => {
        logStream.write('[STDERR] ' + data.toString());
    });

    child.on('error', (err) => {
        logStream.write('[ERROR] ' + err.toString() + '\n');
    });

    child.on('close', (code) => {
        logStream.write(`[EXIT] Exited with code ${code}\n`);
        logStream.end();
    });
} catch (e) {
    logStream.write('[EXCEPTION] ' + e.toString() + '\n');
    logStream.end();
}
