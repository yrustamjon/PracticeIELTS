PracticeIELTS — HTML / CSS / JavaScript demo
==========================================

ISHLATISH (MAC / WINDOWS)
1. ZIP faylni to'liq oching (Extract / Unzip).
2. PracticeIELTS-demo papkasidagi index.html faylini ikki marta bosing.
3. Chrome, Safari yoki Edge orqali oching. Node, npm, Django va Docker kerak emas.

Agar brauzer lokal audio/xotirani cheklasa, papkada terminal oching:
  python3 -m http.server 5500
Keyin brauzerda http://localhost:5500 ni oching.

SINAB KO'RISH
- O'ng yuqoridagi O'quvchi / Admin tugmalari — ikki ko'rinish.
- O'quvchida: Listening materiallarini ishlash mumkin, qo'shish mumkin emas.
- Admin -> Yangi mock -> "Demo audio va savollarni ishlatish"
  -> "Mock + Practice tayyorlash" -> bo'laklarni tinglash
  -> "Mock + Practice nashr qilish".
- O'quvchi ko'rinishiga qayting. Kutubxonada yangi material paydo bo'ladi.
- Bitta material ichida Mock, Practice va Transkript rejimlari mavjud.
- Oson: qisqa chunk/gap, kutilayotgan SO'ZLAR SONI KO'RINADI.
- O'rta: bitta to'liq gap, so'zlar soni KO'RINMAYDI.
- Murakkab: 2-3 gap uzluksiz, so'zlar soni KO'RINMAYDI.
- Mock: 5 daqiqalik qisqa namuna, 8 savol, har part audio bir marta.
- Javobni tekshirish, xatolar, davom etish va natijalar ishlaydi.
- Reading, Writing va Speaking ikkala ko'rinishda ham "Kelajakda".
  Admin ham, o'quvchi ham ularga hozir kontent qo'sha olmaydi.

DEMO CHEGARALARI
- Bu mustaqil interfeys demo. Haqiqiy autentifikatsiya, backend va AI yo'q.
- Rol almashtirish — faqat ko'rinishni ko'rib chiqish uchun; xavfsizlik mexanizmi emas.
- Asl audio namunasi PracticeIELTS uchun yozilgan original inglizcha matndan
  FFmpeg/libflite yordamida sun'iy ovoz bilan tayyorlangan. Namuna uchun gap/chunk
  chegaralari aniq. Mualliflik IELTS kitoblari yoki audiosi ishlatilmagan.
- O'zingiz audio yuklashingiz ham mumkin: transkript va savollarni kiritasiz.
  Demo matnni gap/chunklarga bo'ladi, vaqtlarni matn uzunligi bo'yicha TAXMINAN
  taqsimlaydi. Bu haqiqiy speech-to-text yoki forced alignment emas.
  Haqiqiy platformada bu qism serverdagi transkripsiya/alignment bilan ishlashi kerak.
- Demo faqat qisqa javobli mock savollarini ko'rsatadi; to'liq 40 savollik IELTS
  yoki barcha savol turlari emas. Natija IELTS band bahosi sifatida ko'rsatilmaydi.
- Javoblar/materiallar shu brauzer localStorage xotirasida, yuklangan audio
  IndexedDB'da saqlanadi. Boshqa foydalanuvchilarga yoki serverga yuborilmaydi.
- Brauzer xotirasini tozalash demo ma'lumotlarini o'chiradi.
- Qaytadan boshlash: Demo haqida -> Demo ma'lumotlarini tozalash.
- Internet va tashqi kutubxonalar kerak emas. assets papkasini o'chirmang.

FAYLLAR
index.html      - sahifa
styles.css      - navy/teal dizayn va moslashuvchan ko'rinish
app.js          - navigatsiya, admin oqimi, mock va practice logikasi
demo-data.js    - original namunaviy material / vaqtlar / savollar
assets/listening-demo.mp3 - asl namuna audio
README.txt      - yo'riqnoma

Demo loyiha ichidagi demo/ papkasiga qo'shilgan.
Loyiha papkasida: open demo/index.html (Mac).
