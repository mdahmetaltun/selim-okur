#!/usr/bin/env python3
"""Yayın klasörü: iPad/telefon için HTTPS bir adrese (GitHub Pages, Netlify, Cloudflare Pages) konacak dosyalar.
Kullanım: python3 tools/build_site.py [çıktı-klasörü: site]
"""
import os, shutil, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, sys.argv[1] if len(sys.argv) > 1 else 'site')
shutil.rmtree(out, ignore_errors=True)
os.makedirs(out)
for name in ['index.html', 'app.js', 'style.css', 'game.css', 'sw.js', 'manifest.json']:
    shutil.copy(os.path.join(root, name), out)
for d in ['js', 'fonts', 'icons', 'audio']:
    shutil.copytree(os.path.join(root, d), os.path.join(out, d))
size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(out) for f in fs)
print(f'{out} hazır ({size / 1048576:.1f} MB). Bu klasörü HTTPS bir adrese koy; iPad Safari ile aç.')
