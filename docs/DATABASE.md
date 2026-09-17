# Database

يحتوي `prisma/schema.prisma` على النماذج والعلاقات والفهارس. استخدم `npm run db:migrate` للتطوير و`npm run db:deploy` في الإنتاج. تحفظ قيم KPI تاريخيًا، وتحفظ كيانات Planner الخام منفصلة لضمان idempotency.

حقول الملكية اختيارية للبيانات القديمة، ويمكن تعيينها من الواجهة: `StrategicAxis.ownerId` و`StrategicObjective.ownerUserId` و`Initiative.ownerId` و`KPI.ownerId`. يجب أن ينتمي المالك إلى المؤسسة، وأن ينتمي مالك الهدف أو المبادرة أو المؤشر إلى الإدارة المالكة عند تحديدها. يحتفظ `KPIValueHistory` بكل قيمة وتاريخ ونسبة تحقيق بدل استبدال التاريخ السابق.

النشر الحالي يطبق التغييرات الإضافية عبر `prisma db push` في GitHub Actions قبل نشر Worker. لا تستخدم `db push` لإزالة أعمدة أو علاقات من الإنتاج دون خطة ترحيل ونسخة احتياطية.

يرتبط `Risk` الآن بعلاقات صريحة مع `Department` ومالك المعالجة `User`، ويسجل `createdAt` و`updatedAt`. يحسب الخادم `riskScore` من `probability × impact` ولا يقبل قيمة درجة يرسلها المتصفح.
