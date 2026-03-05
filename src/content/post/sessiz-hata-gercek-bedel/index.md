---
title: "Sessiz Hata, Gerçek Bedel: Numerik Hataların Gerçek Yüzü"
description: "Nümerik hata çökerek değil kandırarak zarar verir. Sistem ayakta kalır, sonuç üretir ama ürettiği sonuç gerçeği temsil etmez."
publishDate: "05 Mar 2026"
coverImage:
  src: "./cover.webp"
  alt: "Nümerik Güvenlik Cover Image"
tags: ["numeric-safety", "production", "csharp", "distributed-systems", "architecture"]
---

## Crash Eden Sisteme Güvenebiliriz

Belki bu başlık biraz akıl karıştırıcı olabilir ama gerçekten öyle. Exception atan sisteme güvenebiliriz, çünkü bize sorunun nerede olduğunu söyler ve yanlış şekilde çalışmaktansa, çalışmayı durdurur. Fakat sonuç yanlış da olsa, mantıklı görünen ama yanlış sonuç üreten sistem daha tehlikelidir.

İşte nümerik hata tam olarak böyle bir problemdir; çökerek değil kandırarak zarar verir. Sistem ayakta kalır, sonuç üretir ve hatta güven verir. Ama ürettiği sonuç gerçeği temsil etmez. Nümerik hata çoğu zaman "sessiz failure"dır: sistem çökmez ama doğruluk kaybeder.

## Eğer Hatayı Doğru Tanımlarsak, Risk Politikamızı Doğru Belirleriz

Nümerik hata production'da bir matematik probleminden ziyade bir risk yönetim problemi olarak görülmelidir.

### Mutlak Hata

"50 kuruş eksik bakiye" ya da "5 ms gecikme" gibi durumlar birim bazlı sapmalardır. Bu farklar küçük olabilir, fakat biriktikçe sistem davranışını etkileyip değiştirebilir.

### Bağıl Hata

Hatanın büyüklüğünü ölçeğe göre değerlendiririz ve ölçeğe göre risk hesaplaması yaparız. Örneğin 10 milyonluk bir işlemde 5 TL önemsiz bir hata olabilir, fakat 20 TL'lik bir işlemde 5 TL hata büyük bir sıkıntı olduğunu gösterir.

### Yaklaşık Bağıl Hata

Gerçek değerin bilinmediği bir production ortamında, bir algoritmanın kendi içinde kendisini sorgulama biçimidir. Bir dinamik fiyatlandırma algoritmasını düşünün; ilk tahmini 100₺, ikincisi 400₺, üçüncüsü 20₺ ise bu sistem savruluyordur sonucuna varılır. "Yaklaşık Bağıl Hata" sayesinde sistem gerçekten çözüme mi gidiyor, yoksa sadece hesap yapıyor gibi mi görünüyor onu anlıyoruz.

### Maksimum Hata

Production ortamında sistemler ortalama davranışa göre değil, uç senaryolara göre crash eder. Sistemin ortalama durumda ne kadar iyi olduğundan ziyade en kötü durumda ne olacağının cevabını maksimum hata olarak buluruz. Bu yanıtı SLA tehdidi olarak da okuyabiliriz.

## Kodun İçindeki Risk

Buraya kadar anlattığımız bu hatalar, kullandığımız programlama dillerinin ve işlemcilerin sayıları temsil etme biçiminin doğal bir sonucudur. Biz bir değişken tanımladığımızda sadece veri saklamayız. Aslında o verinin maruz kalacağı hata modelini de seçeriz.

### Kod Çalışıyor Ama Matematik Yanlış

En basit haliyle şu kodu ve çıktısını bir düşünelim:

```csharp
Console.WriteLine(0.1 + 0.2 == 0.3);
Console.WriteLine(0.1 + 0.2);
```

```text
False
0.30000000000000004
```

Buradaki durum bir bug değil, IEEE 754 tasarımıdır. Bizim günlük hayatta kullandığımız sayılar çoğunlukla 10 tabanlı olsa da bunları bilgisayarda 2 tabanlı olarak temsil etmeye çalışıyoruz. Yukarıdaki kodda da beklediğimizin aksine bir sonuç çıkmasının sebebi budur. Yani bilgisayar `0.1` sayısını binary sistemde tam olarak saklayamaz.

IEEE 754'ün görevlerini hemen hemen şu şekilde özetleyebiliriz:

- Floating point'lerin nasıl temsil edileceğini tanımlar
- Yuvarlama kurallarını belirler
- Hatalı davranışları belirli bir standarta koyar
- Ortaya çıkan sonucun işleyişi bozmamasını ve deterministik olmasını sağlar

Sistem tasarımında her şeyin bir trade-off olduğunu unutmayalım. Bu standardın da bazı bedelleri var. If bloklarında aradığımız kesin eşitlik yüzünden sistem arkada yuvarlama hatalarıyla (rounding errors) uğraşır. Production'da bu durum, bir indirim kodunun uygulanamaması ya da bir limitin hatalı şekilde aşılması demektir.

### Veri Tipiyle Birlikte Risk Politikasını Seçiyoruz

Yukarıda yaptığımız işlemi şimdi iki farklı veri tipiyle düşünelim:

```csharp
double totalDouble = 0.1 + 0.2;
decimal totalDecimal = 0.1m + 0.2m;
```

Burada `double` veri tipi, binary floating point mantığıyla çalışır. Decimal'e göre hızlıdır ve daha geniş aralık sunar. Fakat bizlerin 10 tabanlı mantıkla kurguladığı her şeyi yaklaşık olarak temsil eder. Decimal ise tüm performans maliyetlerine rağmen 10 tabanlı çalışır ve sonuçları yaklaşık değil, öngörülebilirdir.

Bu fark sadece finansa ya da belli bir domaine özgü değildir. Fiyat, oran, limit, skor ya da eşik değer gibi insanın 10'lu mantıkla kurduğu değerlerin hepsinde yanlış tip seçimi sistemi sessizce bozabilir.

### Eşitlik Değil, Tolerans Düşün

Floating point sayılarla çalışırken `a == b` yazmak, production ortamındaki en tehlikeli kontrollerden biridir. Matematiksel olarak aynı görünen bu ifadeler birebir aynı şekilde temsil edilemeyebilir. Bu yüzden bu eşitlik, biz hiç farkına varmadan yanlış kararlar üretebilir. Bu tür durumlarda şu yaklaşımı kullanmak yaygındır:

```csharp
if (Math.Abs(a - b) < epsilon)
```

Fakat bu yaklaşım küçük sayılarda işe yarasa da, büyük ölçekli verilerde patlar. Çünkü toleransımız her yerde aynı olamaz. Yazının başında da dediğimiz gibi, küçük bir fark dediğimiz değer bazı sistemlerde önemsizken bazılarında doğrudan yanlış kararları tetikleyebilir.

Bu yüzden ölçeklenebilir bir toleransla hareket etmek, yani sabit bir eşik yerine bağıl tolerans üzerinden kurgulanan bir karşılaştırma bizi daha doğru bir sonuca yakınlaştıracaktır.

```csharp
bool AlmostEqual(double a, double b, double relativeTolerance)
{
    return Math.Abs(a - b) <= relativeTolerance * Math.Max(Math.Abs(a), Math.Abs(b));
}
```

Bu sayede epsilonu artık bir sayı olarak değil, bir oran olarak görüyor ve domain'in ne kadar bir sapmayı kabul edeceğine karar veriyoruz.

## Gerçek Dünyada Hatalar Yalnız Yaşamaz

### Servisler Arasında Büyüyen Bir Hata

Tek bir uygulamada, tek bir makinede ortaya çıkan nümerik bir hata kendi bölgesinde izole kalabilir. Fakat dağıtık bir sistemde böyle bir şeyin çok daha zor olduğunun farkındayız. Hata servisler arasında taşınır, kalıcı hale gelir ve başka sistemler için bir girdi haline gelir. Örneğin bir servis indirimi hesaplar, diğeri vergi ekler, bir başkası ise sonucu veritabanına yazar. Her biri önemsiz görünen küçük sapmalar oluşturur.

Fakat sapmalar kalıcı hale getirilerek, cache'lere dağılarak ya da bir ML modeline training datası olarak zincir boyunca büyürler. Bu noktadan sonra durum bir sistem hatası olmaktan çıkmış, sistemin bozuk gerçekliği haline gelmiştir. Bu durumu "silent corruption" olarak adlandırabiliriz.

### Peki Hatanın Sahibi Kim?

Eğer bu durum bir event-driven yapıda ise daha da görünmez hale gelir. Yalnızca bir kere aşağıdaki gibi bir değer event payload'ı ile taşınırsa, queue'lara yazılır, birden fazla consumer tarafından işlenir ve farklı db'lere farklı tablolara yazılabilir.

```json
{ "amount": 100.00000000002 }
```

Bu durumda geçin "hata var mı" sorusunu, "hatayı ilk kim üretti" sorusunu sormak bile çok zor hale gelir.

## Gerçek Bedeller

Sapmalar her zaman bir log satırında ya da bir unit test'te kalmaz. Bazen sonuçları çok daha gerçek ve ağırdır.

1991'de Körfez Savaşı'nda Patriot hava savunma sisteminde, zaman hesabındaki küçük bir yuvarlama hatası sistem açık kaldıkça birikti. Yazının başında tanımladığımız mutlak hata gibi, tek başına önemsiz ama zamanla sistemi işlevsiz hale getiren bir sapmaya dönüştü. Sonuçta radar hedefi yanlış yerde aradı ve gelen füze engellenemedi.

1982'de ise Vancouver Borsası'nda endeks değeri her işlemde truncate edilerek hesaplandı. Sistem çökmedi, hata mesajı vermedi; 22 ay boyunca sorunsuz çalışıyor gibi göründü. Fakat endeks gerçek değerinden sessizce 500 puan aşağı kaymıştı. Bu da yazının en başında bahsettiğimiz crash etmeyen ama doğruluğunu kaybeden sistemin ta kendisiydi.

Bu örneklerin asıl korkutucu yanı, nümerik sapmaların yalnızca yanlış bir sonuç üretmesiyle kalmayıp, sistemin gerçeklikle kurduğu ilişkiyi de bozmasıdır.
