# Deployment

الصورة مستقلة عن المزود. ضع reverse proxy أمام الحاوية لـHTTPS على `portal.kedan.com.sa`، وشغّل `prisma migrate deploy` كخطوة إصدار وحيدة قبل بدء النسخة الجديدة. استخدم health checks وrolling deployment وسجل صور غير قابل للتغيير.
