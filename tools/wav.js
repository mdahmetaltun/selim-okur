// Minimal 16-bit PCM mono WAV okuyucu (araçlar ve testler için)
const fs = require('node:fs');
function readWav(file) {
    const b = fs.readFileSync(file);
    let off = 12, rate = 22050, data = null;
    while (off + 8 <= b.length) {
        const id = b.toString('ascii', off, off + 4), size = b.readUInt32LE(off + 4);
        if (id === 'fmt ') rate = b.readUInt32LE(off + 12);
        if (id === 'data') { data = b.subarray(off + 8, off + 8 + Math.min(size, b.length - off - 8)); break; }
        off += 8 + size + (size % 2);
    }
    const x = new Float32Array(Math.floor(data.length / 2));
    for (let i = 0; i < x.length; i++) x[i] = data.readInt16LE(i * 2) / 32768;
    return { samples: x, rate };
}
module.exports = { readWav };
