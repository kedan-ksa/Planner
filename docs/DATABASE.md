# Database

يحتوي `prisma/schema.prisma` على النماذج والعلاقات والفهارس. استخدم `npm run db:migrate` للتطوير و`npm run db:deploy` في الإنتاج. تحفظ قيم KPI تاريخيًا، وتحفظ كيانات Planner الخام منفصلة لضمان idempotency.

