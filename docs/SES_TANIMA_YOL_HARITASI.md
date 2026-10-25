# Ses tanıma: yapıldıklar ve sıradaki adımlar

Hedef: Selim'in okuduğu harf, hece ve kelimeyi doğru tanımak; doğru okuyanı yanlış cezalandırmamak, yanlış okuyanı doğru saymamak.
Güvenlik önceliği: şüphede veliye sor (`uncertain`).

## Şu an çalışan katmanlar

| Katman | Dosya | Ne yapar | Cihaz |
|---|---|---|---|
| Fonetik hakem | `js/judge.js` | Chrome'un metnini hedef ve komşu hecelerle ses benzerliğine göre karşılaştırır | Chrome/Edge |
| Hata öğrenme | `js/learn.js` | Chrome'un sürekli yaptığı hatayı (ka→kah) veli onayıyla öğrenir | Chrome/Edge |
| Selim'in sesi | `js/templates.js`, `js/dsp.js` | MFCC + DTW ile onaylı okumaları saklar, yeni okumayı karşılaştırır | Hepsi (iPad dahil) |
| Hazır ses + VTLN | `js/dsp.js` (`classifyWarped`) | Robot referans sesine, frekans ekseni ölçekleyerek (çocuk/yetişkin formant farkı) eşler | Hepsi |
| Karar birleştirme | `js/verify.js` | Hepsini tek karara indirir; en az 2 rakip örneği, yakınlık kapısı, tek örnekte sıkı eşik | Hepsi |
| Ses kalitesi kapısı | `js/mic.js`, `app.js` | Ses gelmedi / bozuldu / gürültülü ise yargılamadan yeniden okutur | Hepsi |

## Ölçülenler (sentetik; gerçek çocuk sesi daha değişkendir)

- **Selim'in sesi, öğrenme eğrisi** (`tools/benchmark_learning.js`): hece başına 2 örnekle ~%98 otomatik doğru, yanlışı doğru sayma %0 (rakip örnekleri varken).
- **Soğuk başlangıç, VTLN** (`tools/benchmark_kids.js`): tek hazır referans sese karşı çocuk benzeri okuma, 10 hecelik havuzda %86 → %95, 72 hecede %63 → %81.
  Güven eşiği 0,25'te kararların ~%99'u doğru; bu yüzden iPad'de (Chrome tanıyıcı yok) güçlü eşleşme "doğru" sayılır, ama bu kararlar şablon olarak kaydedilmez.

## Sıradaki seçenekler (öneri sırasıyla)

### 1. Gerçek veriyle ayar (1–2 gün kullanım, kod az)
Ayarlar → tanıma günlüğünü indir. Günlükte hedef, duyulan metin, karar ve gerekçe var. Buradan: Chrome'un en sık karıştırdığı heceler,
eşiklerin (0,08 / 0,15 / 0,25 / yakınlık kapısı) gerçek çocuk sesinde doğru ayarı. **En değerli ve en ucuz adım.** Beklenen kazanç: yanlış kabul/ret oranlarının gerçek ölçümü.

### 2. Konuşma gömmesi (embedding) + yakın komşu (orta, ~1 hafta)
MFCC+DTW yerine küçük bir ses modelinin (wav2vec2/Whisper kodlayıcısı, int8) gömmesi: farklı konuşmacılarda çok daha iyi genelleme, bu yüzden
soğuk başlangıç (hazır ses → çocuk) ve iPad'de büyük kazanç. Selim'in örnekleri aynen kullanılır (k-NN). Gereken: 40–100 MB model dosyası
(çevrimdışı önbellek), onnxruntime-web/transformers.js. **Bu ortamdan model indirilemediği için yazıp test edemedim**; senin cihazında ölçmek gerekir.
Risk: iPad'de ilk yükleme ve bellek; Safari WASM sınırları.

### 3. Whisper ile "olabilirlik" puanlama (orta/zor)
Serbest yazıya çevirmek yerine hedefi ve rakipleri modele *puanlatmak* (hangi hece bu sesi en olası üretir). Tek heceler için serbest çeviriden
çok daha güvenilir. Model ve hızlandırma gerekir (seçenek 2 ile aynı altyapı).

### 4. Fonem düzeyinde geri bildirim (zor, pedagojik kazanç büyük)
CTC tabanlı Türkçe model ile hizalama: "k sesini söyledin ama ardından e'yi yuttun" gibi. Okuma öğretiminde asıl değer burada; model boyutu ve doğruluk riski var.

### 5. Hece hece okuma desteği (küçük/orta)
Birinci sınıf çocuğu kelimeyi duraklayarak okur ("ka… lem"). Konuşmayı enerjiyle parçalara bölüp her parçayı hecesiyle eşlemek;
şu an uzun sessizlik toleransı ve birleştirilmiş sözcük eşleştirmesi var.

### 6. Veri toplama (opsiyonel, gizlilik izniyle)
Onaylı okumaların ses kayıtlarını (yalnızca cihazda) biriktirip dışa aktarmak; ileride gerçek bir modeli ince ayar etmek için. Şimdilik saklanmıyor (yalnızca öznitelik).

## Önerilen yol
1 → birkaç gün gerçek kullanım → 2 (iPad için en çok işe yarayan) → gerekirse 5.
