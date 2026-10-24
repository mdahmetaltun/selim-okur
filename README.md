# Selim Okur - 1. Sınıf Türkçe Okuma Uygulaması 📖

Ses temelli cümle yöntemine uygun okuma dersi: **ses → hece → kelime → cümle**. Harf sırası Selim'in ders kitabına göre
(`a n e t i l o k u r ı m …`, `js/curriculum.js`). Giriş ekranında kitapta öğrenilen **son harfe** dokunmak yeterli.

## Nasıl çalışır

- **Ders:** Yeni harfin sesi, o harfli heceler, kelimeler ve kısa cümleler. Her adımda "Dinle", "Oku" (mikrofon) ve veli onayı.
- **Dinleme (üç katman, zamanla öğrenir):**
  1. Tarayıcı konuşma tanıma (Chrome/Edge) → `js/judge.js` ile hedef ve komşu hecelere göre ses benzerliği.
  2. Çevrimdışı ses eşleştirme (MFCC + DTW, `js/dsp.js`): Selim doğru okudukça (ya da veli onayladıkça) sesi şablon olarak
     saklanır; birkaç okumadan sonra tanıma belirgin iyileşir. Model indirmez, iPad'de de çalışır.
  3. Veli onayı: emin olunmayan her durumda sorulur; çocuk yanlış cezalandırılmaz. Karar birleştirme: `js/verify.js`.
- **Ses:** Harf sesleri, heceler, kelimeler ve cümleler `audio/` altında hazır. Veli **Seslerim** ekranından kendi sesiyle
  kaydedebilir; kayıt her zaman önceliklidir.
- **Mikrofon testi:** Ayarlar → Mikrofon ve Tanıma.

## Zamanla öğrenme

Uygulama iki şeyi öğrenir; ikisi de yalnızca bu cihazda saklanır:

1. **Selim'in sesi.** Doğru okunan (otomatik ya da veli onaylı) her hece/harf/kelime bir ses örneği olur (en çok 8, en çeşitliler
   korunur). **🎙 Sesimi Tanıt** ile Selim 16 hece/harf okur, uygulama hepsini otomatik dinleyip örnek olarak saklar
   (yanlış okursa veli ↻ Tekrar'a basar, o örnek silinir). Tanıma kararı için kapılar: en az 2 rakip örneği, hedefe belirgin yakınlık
   ve Selim'in kendi tekrarlarının tipik değişkenliğine göre öğrenilen bir "yeterince yakın" sınırı.
2. **Tarayıcının hataları.** Chrome "ka"yı hep "kah" yazıyorsa ve veli doğru dediyse (ya da Selim'in sesi hedefi güçlü gösteriyorsa)
   o metin hedefin takma adı olur, sonraki seferde otomatik kabul edilir. Veli "tekrar" derse o metin o hedef için şüpheli sayılır.

Ayarlar'dan öğrenilenler silinebilir; Veli Paneli → *Tanıma Gelişimi* ilk yarı/son yarı otomatik doğru oranını gösterir.

`node tools/benchmark_learning.js m 3 [kapsama]` ile öğrenme eğrisi ölçülür (tanıyıcı yok, yalnızca Selim'in örnekleri; aynı konuşmacının
hız/perde farklı sentetik tekrarları). Örnek sonuçlar (72 hece, rakip hecelerin tamamının örneği varken):

| Hece başına örnek | Otomatik doğru | Doğruyu "yanlış" sayma | Yanlışı "doğru" sayma |
|---|---|---|---|
| 0 | %0 (veliye sorar) | %0 | %0 |
| 1 | %92 | %0 | %0 |
| 2 | %98 | %0,5 | %0 |
| 5 | %98 | %0,3 | %0 |

Rakip hecelerin yalnızca %30'unun örneği varken yanlış okumayı "doğru" sayma %0–2'ye çıkar; bu yüzden en az 2 rakip örneği şartı var.
Bunlar espeak tekrarlarıyla alınmış üst sınırlardır; gerçek çocuk sesi daha değişkendir, sınırlar kullanımla kendini ayarlar.

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
| `node tools/benchmark_learning.js m 3 [kapsama]` | Öğrenme eğrisi: hece başına örnek sayısına göre tanıma ve hata oranları. |
| `python3 tools/build_artifact.py <klasör> --letters=12` | Tek dosyalı yayın sürümü. |

Sentetik ölçüm (72 hece): 1 yabancı şablonla %43, 2 şablonla %86, 3 şablonla %99 doğru. Bu, yöntemin kaba tutarlılığıdır; gerçek
çocuk sesiyle doğruluk için Ayarlar'dan tanıma günlüğünü indirip inceleyin.

## iPad / telefon

Mikrofon için HTTPS gerekir. `.github/workflows/pages.yml` ile GitHub Pages'e yayınlanır (repo ayarlarında Pages kaynağı
"GitHub Actions" olmalı, `main` dalına gönderince yayınlanır). Safari'de "Ana Ekrana Ekle" ile uygulama gibi açılır ve çevrimdışı çalışır.
iPad'de tarayıcı konuşma tanıma güvenilir olmadığı için yalnızca ses eşleştirme + veli onayı kullanılır.

## Yapı

`js/curriculum.js` müfredat · `js/judge.js` fonetik hakem · `js/dsp.js` MFCC/DTW · `js/verify.js` karar birleştirme ·
`js/mic.js` yakalama · `js/recognizer.js` dinleme ve değerlendirme · `js/templates.js` ses örnekleri · `js/learn.js` tanıyıcı hatalarını öğrenme · `js/audio.js` ses bankası · `js/store.js` IndexedDB · `app.js` arayüz.
