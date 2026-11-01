# Çocuklar İçin Yapay Zeka Okulu (AI Prompt School) - Yerel HTML Klonu

`https://prompts.chat/kids` projesinin kaynak kodu ve mimarisi tersine mühendislikle (reverse engineering) incelenerek oluşturulmuş **tamamen yerel, bağımsız ve sıfır harici bağımlılıklı HTML/CSS/JS klonudur**.

---

## 🌟 Proje Özellikleri

1. **Tam 19 Seviye ve 5 Dünya (Eksiksiz İçerik)**:
   - 🏡 **World 1: Başlangıç Köyü (Starter Village)** (1-1, 1-2, 1-3)
   - 🏰 **World 2: Netlik Kalesi (Clarity Castle)** (2-1, 2-2, 2-3, 2-4)
   - 🦇 **World 3: Bağlam Mağaraları (Context Caves)** (3-1, 3-2, 3-3, 3-4)
   - 🎨 **World 4: Yaratım Kanyonu (Creation Canyon)** (4-1, 4-2, 4-3, 4-4)
   - 👑 **World 5: Usta Dağı (Master Mountain)** (5-1, 5-2, 5-3, 5-4)

2. **İnteraktif Eğitici Mini Oyunlar ve Bileşenler**:
   - 💡 **Word Predictor (Kelime Tahmincisi)**: Yapay zekanın (LLM) bir sonraki kelimeyi nasıl tahmin ettiğini gösteren interaktif bulmaca.
   - 🎯 **Prompt Vs Mistake (İyi vs Kötü Prompt)**: Zayıf promptlar ile güçlü detaylı promptları karşılaştıran test.
   - 🧩 **Drag & Drop Prompt (Prompt Oluşturucu)**: Kelime bloklarını oklarla taşıyarak veya değiştirerek anlamlı bir prompt kurma.
   - ✨ **Magic Words (Sihirli Kelimeler)**: Prompt şablonlarına sihirli anahtar kelimeleri yerleştirme.
   - 🏥 **Prompt Doctor (Prompt Doktoru)**: Hasta ve zayıf promptların sorunlarını teşhis edip tedavi ederek sağlıklı prompta dönüştürme.
   - 🔍 **Prompt Parts (Prompt Parçaları)**: Rol, Görev, Bağlam ve Kısıtlama parçalarını tanıma.
   - 🐾 **Step By Step (Adım Adım Düşünme)**: "Let's think step by step" (Chain of Thought) tekniğinin yapay zekaya nasıl doğru mantık yürüttüğünü öğretme.
   - 🧪 **Prompt Lab (Prompt Laboratuvarı)**: İteratif prompt geliştirme ve yapay zeka simülasyon yanıtları.
   - 🎉 **Level Complete (Tebrik Ekranı)**: 3 yıldız ödülü, konfeti patlaması, başarı fanfarı ve sonraki seviyeyi açma.

3. **8-Bit Retro Piksel Tasarımı**:
   - `PixelRobot` Robot Arkadaşın (farklı ruh halleri: mutlu, düşünen, heyecanlı, kutlayan).
   - Gökyüzünde süzülen piksel bulut animasyonları.
   - Yol üzerinde giden animasyonlu retro piksel arabalar.
   - Gökyüzünde arkasında **"YAPAY ZEKA ÖĞREN!"** bayrağı dalgalanan pervaneli Cessna uçağı.
   - Piksel köşeli butonlar (`.pixel-btn`), paneller (`.pixel-panel`) ve özel gölgelendirmeler.

4. **8-Bit Retro Ses Efektleri & Arka Plan Müziği**:
   - Web Audio API ile sıfır harici dosya bağımlılığıyla çalışan retro ses efektleri (tıklama, jeton, başarı fanfarı, hata, robotik cikleme).
   - Orijinal `kids-music.mp3` arka plan müziği + tarayıcı CORS kısıtlamalarına karşı otomatik sentetik 8-bit chiptune yedek müzik motoru.

5. **Türkçe 🇹🇷 ve İngilizce 🇬🇧 Çift Dil Desteği**:
   - Ayarlar modalından tek tıkla dil değiştirilebilir.
   - Tüm ders içerikleri, robot diyalogları ve butonlar dinamik çevrilir.

6. **Kalıcı İlerleme Takibi (LocalStorage)**:
   - Kazanılan yıldızlar, açılan seviyeler ve tamamlanan bölümler tarayıcıda otomatik kaydedilir.

---

## 🚀 Nasıl Çalıştırılır?

### Yöntem 1: Doğrudan Dosyayı Açma (En Kolay)
Herhangi bir kurulum yapmadan doğrudan `index.html` dosyasına çift tıklayarak Chrome, Edge, Brave, Firefox veya Safari'de açabilirsiniz!

### Yöntem 2: PowerShell ile Yerel Sunucu Başlatma
Proje dizininde PowerShell ile:
```powershell
Get-Content -Encoding UTF8 .\server.ps1 -Raw | Invoke-Expression
```
veya
```powershell
powershell -ExecutionPolicy Bypass -File .\server.ps1
```
Sunucu başladığında tarayıcınız otomatik olarak `http://localhost:8080` adresinde açılacaktır.

---

## 📂 Dosya Yapısı

- `index.html`: Ana web sayfası şablonu ve gökyüzü animasyonları.
- `styles.css`: 8-bit retro piksel arayüz stilleri, butonlar ve responsive tasarım.
- `pixel-assets.js`: Robot, yıldızlar, araçlar, uçak, kale, ağaç SVG piksel çizimleri.
- `audio.js`: Web Audio API retro ses sentezleyici ve müzik yöneticisi.
- `levels-data.js`: 19 seviyenin tüm içerikleri, Türkçe ve İngilizce çevirileri ve dünya haritası verileri.
- `app.js`: SPA durum yöneticisi, ekran geçişleri, mini oyun mantıkları ve konfeti motoru.
- `kids-music.mp3`: Orijinal 8-bit arka plan müziği.
- `server.ps1`: Harici paket gerektirmeyen yerel PowerShell web sunucusu.

---

## 👥 Katkıda Bulunanlar

- **Orijinal Proje & Konsept**: [Fatih Kadir Akın](https://github.com/f) - [prompts.chat](https://prompts.chat/kids)
- **Tersine Mühendislik ile Yerel Sürüm**: [Abdurrahman Balı](https://github.com/abdbali)
