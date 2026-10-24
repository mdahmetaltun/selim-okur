# Selim Okur - 1. Sınıf Türkçe Okuma Uygulaması 📖

Ses temelli cümle yöntemine uygun okuma dersi: **ses → hece → kelime → cümle**. Harf sırası Selim'in ders kitabına göre
(`a n e t i l o k u r ı m …`, `js/curriculum.js`). Giriş ekranında kitapta öğrenilen **son harfe** dokunmak yeterli.

## Nasıl çalışır

- **Ders:** Yeni harfin sesi, o harfli heceler, kelimeler ve kısa cümleler. Her adımda "Dinle", "Oku" (mikrofon) ve veli onayı.
- **Dinleme (üç katman):**
  1. Tarayıcı konuşma tanıma (Chrome/Edge) → `js/judge.js` ile hedef ve komşu hecelere göre ses benzerliği.
  2. Çevrimdışı ses eşleştirme (MFCC + DTW, `js/dsp.js`): Selim doğru okudukça (ya da veli onayladıkça) sesi şablon olarak
     saklanır; birkaç okumadan sonra tanıma belirgin iyileşir. Model indirmez, iPad'de de çalışır.
  3. Veli onayı: emin olunmayan her durumda sorulur; çocuk yanlış cezalandırılmaz. Karar birleştirme: `js/verify.js`.
- **Ses:** Harf sesleri, heceler, kelimeler ve cümleler `audio/` altında hazır. Veli **Seslerim** ekranından kendi sesiyle
  kaydedebilir; kayıt her zaman önceliklidir.
- **Mikrofon testi:** Ayarlar → Mikrofon ve Tanıma.

## Çalıştırma

```bash
node server.js          # http://localhost:3000 (mikrofon için localhost yeterli)
npm test                # birim testleri
```

## Araçlar (`tools/`)

| Komut | Ne yapar |
|---|---|
| `node tools/make_audio.js [--cvc-through=m] [--voice=tr+f3] [--force]` | `espeak-ng` + `ffmpeg` ile `audio/` üretir. Daha doğal bir TTS kullanacaksan aynı dosya adlarıyla `audio/<tür>/<ad>.mp3` koy. |
| `node tools/benchmark_synth.js m` | Ses eşleştirmenin sentetik ölçümü (farklı espeak sesleri = farklı konuşmacı). |
| `python3 tools/build_artifact.py <klasör> --letters=12` | Tek dosyalı yayın sürümü. |

Sentetik ölçüm (72 hece): 1 yabancı şablonla %43, 2 şablonla %86, 3 şablonla %99 doğru. Bu, yöntemin kaba tutarlılığıdır; gerçek
çocuk sesiyle doğruluk için Ayarlar'dan tanıma günlüğünü indirip inceleyin.

## iPad / telefon

Mikrofon için HTTPS gerekir. `.github/workflows/pages.yml` ile GitHub Pages'e yayınlanır (repo ayarlarında Pages kaynağı
"GitHub Actions" olmalı, `main` dalına gönderince yayınlanır). Safari'de "Ana Ekrana Ekle" ile uygulama gibi açılır ve çevrimdışı çalışır.
iPad'de tarayıcı konuşma tanıma güvenilir olmadığı için yalnızca ses eşleştirme + veli onayı kullanılır.

## Yapı

`js/curriculum.js` müfredat · `js/judge.js` fonetik hakem · `js/dsp.js` MFCC/DTW · `js/verify.js` karar birleştirme ·
`js/mic.js` yakalama · `js/recognizer.js` dinleme ve şablonlar · `js/audio.js` ses bankası · `js/store.js` IndexedDB · `app.js` arayüz.
