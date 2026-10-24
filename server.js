const http = require('http');
const fs = require('fs');
const path = require('path');
const { generateSyllablePool, getNextChallenge } = require('./src/syllable_generator');
const { initialGameState } = require('./src/game_state_manager');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg'
};

const server = http.createServer((req, res) => {
    const responseJson = (status, data) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    };

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    if (req.method === 'GET' && pathname === '/api/status') {
        return responseJson(200, {
            status: 'running',
            level: 1,
            score: 0,
            gameState: 'AWAITING_START',
            message: 'Game is initialized and ready for challenges.'
        });
    }

    if (req.method === 'POST' && pathname === '/api/challenge') {
        const knownLetters = ['A', 'M', 'O'];
        const syllables = generateSyllablePool(knownLetters);
        const targetSyllable = getNextChallenge(syllables);

        if (!targetSyllable) {
            return responseJson(500, { error: "No syllables generated." });
        }

        return responseJson(200, {
            sequence: targetSyllable.sequence,
            difficulty: targetSyllable.difficulty,
            message: 'Pronunciation required. (Simulated voice input expected)'
        });
    }

    // Serve static files
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') {
        safePath = '/index.html';
    }

    const filePath = path.join(__dirname, safePath);

    // Prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('403 Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('404 Not Found');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Selim Okur UI running at http://localhost:${PORT}`);
    console.log(`====================================================`);
});