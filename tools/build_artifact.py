#!/usr/bin/env python3
"""Tek dosyalı yayın sürümü: CSS/JS/yazı tipleri sayfanın içine gömülür, sesler tek bir paket dosyasında (audio/pack.mp3) gider.
Kullanım: python3 tools/build_artifact.py <çıktı-klasörü> [--letters=12]
Yalnızca ilk N harfin dersinde kullanılan ses dosyaları kopyalanır (yayın dosya sayısı sınırı için).
"""
import base64, json, os, re, shutil, subprocess, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1]
letters = int(next((a.split('=')[1] for a in sys.argv if a.startswith('--letters=')), 12))
rd = lambda p: open(os.path.join(root, p), encoding='utf-8').read()

# 1) Yayına girecek ses anahtarlarını müfredattan hesapla
keys = json.loads(subprocess.check_output(['node', '-e', f"""
const C=require('{root}/js/curriculum.js');const k=new Set(['ui/aferin','ui/harika','ui/tekrar','ui/oku']);
for(let n=2;n<={letters};n++){{C.buildLesson(C.LETTER_ORDER.slice(0,n),{{counts:{{hece:999,kelime:999,cumle:999}}}}).forEach(i=>k.add(i.key));}}
C.LETTER_ORDER.slice(0,{letters}).forEach(l=>k.add('ses/'+l));
C.wordsFor(C.LETTER_ORDER.slice(0,{letters})).forEach(w=>k.add('kelime/'+w.sequence));
C.generateSyllables(C.LETTER_ORDER.slice(0,{letters})).forEach(s=>k.add('hece/'+s.sequence));
C.sentencesFor(C.LETTER_ORDER.slice(0,{letters})).forEach(s=>k.add('cumle/'+C.slug(s.text)));
console.log(JSON.stringify([...k]));"""]))
full = set(json.loads(rd('audio/manifest.json'))['keys'])
keys = sorted(k for k in keys if k in full)

shutil.rmtree(out, ignore_errors=True)
os.makedirs(os.path.join(out, 'audio'))
index, blob = {}, bytearray()
for k in keys:
    data = open(os.path.join(root, 'audio', k + '.mp3'), 'rb').read()
    index[k] = [len(blob), len(data)]
    blob += data
open(os.path.join(out, 'audio', 'pack.mp3'), 'wb').write(blob)
json.dump({'voice': 'espeak', 'keys': keys, 'pack': 'audio/pack.mp3', 'index': index}, open(os.path.join(out, 'audio', 'manifest.json'), 'w'))

# 2) CSS: yazı tipleri data URI olarak gömülür
fonts = rd('fonts/fonts.css')
fonts = re.sub(r'url\(([^)]+\.woff2)\)', lambda m: 'url(data:font/woff2;base64,' + base64.b64encode(open(os.path.join(root, 'fonts', m.group(1)), 'rb').read()).decode() + ')', fonts)
css = fonts + '\n' + rd('style.css') + '\n' + rd('game.css')

# 3) Gövde: index.html'den <body> içeriği, script/link çıkarılır
html = rd('index.html')
body = re.search(r'<body[^>]*>(.*)</body>', html, re.S).group(1)
body = re.sub(r'<script.*?</script>', '', body, flags=re.S)

# 4) JS: sırayla gömülür
order = ['js/platform.js', 'js/curriculum.js', 'js/judge.js', 'js/dsp.js', 'js/verify.js', 'js/store.js', 'js/templates.js', 'js/learn.js', 'js/backup.js', 'js/mic.js', 'js/audio.js', 'js/recognizer.js', 'app.js']
js = '\n'.join(rd(p) for p in order)
assert '</script' not in js

page = f'<title>Selim Okur</title>\n<style>\n{css}\n</style>\n{body}\n<script>\n{js}\n</script>\n'
open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(page)
print(f'{len(keys)} ses ({len(blob)/1024:.0f} KB paket), sayfa {len(page)/1024:.0f} KB')
