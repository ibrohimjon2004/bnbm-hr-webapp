# bnbm-hr-webapp
BNBM Central Asia HR Telegram Web App

Frontend endi vakansiyalarni `/api/vacancies` dan oladi va fotosurat, javoblar hamda rozilikni `/api/applications` ga yuboradi. Telegram `initData` har bir so‘rovning `X-Telegram-Init-Data` sarlavhasida yuboriladi. Token frontendga yozilmaydi.

## Ishga tushirish va joylashtirish

Ushbu `index.html` ning aynan bir xil nusxasi `bnbm-hr-server/static/index.html` da mavjud va FastAPI uni `/` orqali beradi. Frontend o‘zgartirilganda serverdagi nusxani ham yangilang.

Mavjud `https://bnbm-hr-webapp.onrender.com` statik manzili ham ishlaydi: u API so‘rovlarini `https://bnbm-hr-server.onrender.com` ga yuboradi. Backend aynan shu frontend origin uchun CORS ruxsatini beradi; Telegram autentifikatsiyasi o‘zgarmaydi. Shu holatda BotFather’dagi mavjud Mini App URL’ini almashtirish shart emas. Backend manzili o‘zgarsa, `API_BASE` ni ikkala HTML nusxasida yangilang; frontend manzili o‘zgarsa, backenddagi CORS originni ham yangilang.

1. `bnbm-hr-server` ni Python web-service sifatida joylashtiring: `pip install -r requirements.txt`, so‘ng `uvicorn server:app --host 0.0.0.0 --port $PORT`.
2. Hostingning muhit sozlamalarida `BOT_TOKEN` va administratorning `ADMIN_ID` qiymatini kiriting. Tokenni HTML yoki Git fayllariga yozmang.
3. BotFather orqali Mini App URL manzilini Python web-service HTTPS manziliga qo‘yish mumkin. Mavjud yuqoridagi statik manzil bilan ishlayotgan ilova esa URL o‘zgartirishsiz API’ga ulanadi.
4. Ilovani Telegram botidagi Mini App tugmasi orqali oching. Oddiy brauzer yoki noto‘g‘ri Telegram sessiyasida anketa ochilmaydi.

Server tasdiqlamaguncha muvaffaqiyat xabari chiqmaydi. Muvaffaqiyatdan so‘ng ariza raqami ko‘rsatiladi. Xato bo‘lsa, javoblar va fotosurat qayta urinish uchun xotirada qoladi; ular brauzer omboriga yozilmaydi.

## Brauzer regressiya tekshiruvi

Python backend virtual muhiti, Node.js, `playwright` paketi va Chromium kerak. Test serveri faqat vaqtinchalik SQLite bazadan va test uchun autentifikatsiya almashtirishidan foydalanadi; uni hostingga ishga tushirmang.

1. `bnbm-hr-server` ichida: `.venv/bin/python tests/serve_browser_fixture.py`.
2. `bnbm-hr-webapp` ichida: `node tests/submission.cjs`. Chromium boshqa joyda bo‘lsa `CHROMIUM_PATH` ni belgilang; standart yo‘l `/usr/bin/chromium`.
   Mavjud statik origin ulanishi uchun: `node tests/static-origin.cjs`.
3. Tekshiruv tugagach test serverini `Ctrl+C` bilan to‘xtating.

Test Telegramdan tashqaridagi kirish, dinamik savollar, til almashtirish, rozilik, xatodan keyingi qayta urinish, fotosuratni yuborish va ikki marta bosilganda bitta so‘rov ketishini tekshiradi. Haqiqiy Telegram autentifikatsiyasi yoki xabar yetkazilishi bu testda tekshirilmaydi.
