/**
 * Kalıcı depo (IndexedDB): veli kayıtları (ses blob'ları) ve Selim'in ses şablonları.
 * IndexedDB yoksa/engellenmişse bellek içi çalışır (sayfa kapanınca kaybolur).
 */
const Store = (() => {
    const DB = 'selim-okur-v1';
    let dbp = null;
    const mem = { voice: new Map(), templates: new Map() };

    function open() {
        if (dbp) return dbp;
        dbp = new Promise((resolve) => {
            try {
                const req = indexedDB.open(DB, 1);
                req.onupgradeneeded = () => {
                    req.result.createObjectStore('voice', { keyPath: 'key' });
                    req.result.createObjectStore('templates', { keyPath: 'label' });
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
                req.onblocked = () => resolve(null);
            } catch (e) { resolve(null); }
        });
        return dbp;
    }

    const get = (storeName, key) => open().then((db) => new Promise((resolve) => {
        if (!db) return resolve(mem[storeName].get(key) || null);
        try {
            const r = db.transaction(storeName).objectStore(storeName).get(key);
            r.onsuccess = () => resolve(r.result || null);
            r.onerror = () => resolve(null);
        } catch (e) { resolve(null); }
    }));

    const put = (storeName, value, keyField) => open().then((db) => new Promise((resolve) => {
        if (!db) { mem[storeName].set(value[keyField], value); return resolve(true); }
        try {
            const t = db.transaction(storeName, 'readwrite');
            t.objectStore(storeName).put(value);
            t.oncomplete = () => resolve(true);
            t.onerror = () => resolve(false);
        } catch (e) { resolve(false); }
    }));

    const del = (storeName, key) => open().then((db) => new Promise((resolve) => {
        if (!db) { mem[storeName].delete(key); return resolve(true); }
        try {
            const t = db.transaction(storeName, 'readwrite');
            t.objectStore(storeName).delete(key);
            t.oncomplete = () => resolve(true);
            t.onerror = () => resolve(false);
        } catch (e) { resolve(false); }
    }));

    const all = (storeName) => open().then((db) => new Promise((resolve) => {
        if (!db) return resolve([...mem[storeName].values()]);
        try {
            const r = db.transaction(storeName).objectStore(storeName).getAll();
            r.onsuccess = () => resolve(r.result || []);
            r.onerror = () => resolve([]);
        } catch (e) { resolve([]); }
    }));

    return {
        getVoice: (key) => get('voice', key),
        putVoice: (key, blob) => put('voice', { key, blob }, 'key'),
        delVoice: (key) => del('voice', key),
        allVoiceKeys: () => all('voice').then((rows) => rows.map((r) => r.key)),
        getTemplates: (label) => get('templates', label),
        putTemplates: (label, feats) => put('templates', { label, feats }, 'label'),
        delTemplates: (label) => del('templates', label),
        allTemplates: () => all('templates'),
        clearTemplates: () => all('templates').then((rows) => Promise.all(rows.map((r) => del('templates', r.label))))
    };
})();
