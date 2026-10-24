# Selim Okur - 1. Sınıf Türkçe Okuma Eğitimi Uygulaması 📖

1. Sınıf öğrencileri için tasarlanmış, MEB müfredatına ve ses temelli okuma yöntemine uygun gamified (oyunlaştırılmış) Türkçe okuma eğitimi web uygulaması.

## ✨ Özellikler

- **Ders kitabı sırası:** Harfler Selim'in kitabındaki sırayla (`a n e t i l o k u r ı m …`) dizilir; son öğrenilen harfe dokunmak yeterlidir. Sıra `js/curriculum.js` içinde ayarlanır (ilk 12 harf kitaptan, kalanı tahmini).
- **Fonetik hakem:** `js/judge.js`, ses tanıyıcının metnini hedef ve komşu hecelerle ses benzerliğine göre karşılaştırır; emin değilse veliye sorar.
- **1. Sınıf Uyumlu Harf & Hece Formatı:** Çocukların defterlerinde öğrendiği küçük harf odaklı yapı (`a, e, l, m` & `el, al, ma...`). Büyük/Küçük harf geçiş desteği.
- **Gerçek Ses Tanıma (Web Speech API):** Çocuğun mikrofondan okuduğu heceyi Türkçe dil desteğiyle canlı tanıma ve değerlendirme.
- **Veli Onayı Modu & Hızlı Navigasyon:** Veli tek tıkla (`✅ Evet, Bildi`) onaylayabilir, sistem tebrik edip otomatik bir sonraki heceye geçer veya kart üzerindeki oklarla (`◀` / `▶`) serbestçe ilerlenebilir.
- **Kelime Kurma Oyunu:** Öğrenilen hecelerle etkileşimli kelime tamamlama.
- **Veli İlerleme Paneli:** Hangi harflerin ve hecelerin öğrenildiğini takip eden başarı ve istatistik paneli.
- **Başarı Belgesi:** Tamamlanan hedefler için yazdırılabilir dijital sertifika.

## 🚀 Çalıştırma

Projeyi yerel ortamda çalıştırmak için:

```bash
# Sunucuyu başlatın
node server.js
```

Tarayıcınızda açın:
`http://localhost:3000`

## 🛠 Teknolojiler

- HTML5, CSS3 (Modern Responsive Tasarım & Animasyonlar)
- Vanilla JavaScript
- Web Speech Recognition API (`tr-TR`)
- Web Audio API (Ses efektleri & synthesizer)
- Node.js (Statik sunucu & minimal API)
