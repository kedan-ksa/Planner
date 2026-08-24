# منصة كدان للأداء والمبادرات الاستراتيجية

منصة عربية مؤسسية لشركة كدان تجمع التنفيذ من Microsoft Planner وتربطه بالمحاور والأهداف والمبادرات والمؤشرات والتقارير والاعتمادات. النطاق الرسمي للمنصة هو `portal.kedan.com.sa`.

## Architecture

Next.js App Router + TypeScript، PostgreSQL/Prisma، Auth.js مع Microsoft Entra ID، وطبقات مستقلة للخدمات والحسابات والتكامل. المنصة هي مصدر البيانات الاستراتيجية، بينما Planner مصدر التنفيذ والمهام فقط.

## Local development

1. انسخ `.env.example` إلى `.env` وأدخل القيم المحلية.
2. شغّل `docker compose up -d db`.
3. شغّل `npm install` ثم `npm run db:migrate` و`npm run db:seed`.
4. شغّل `npm run dev` وافتح `http://localhost:3000`.

حسابات العرض لا تُنشأ إلا عبر seed في بيئة غير Production. أوامر الجودة: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Microsoft registration

أنشئ App Registration أحادي المستأجر، أضف redirect URI `/api/auth/callback/microsoft-entra-id`، ومنح Microsoft Graph المطلوبة بموافقة مسؤول المستأجر. لا تحفظ الأسرار في Git؛ استخدم GitHub Environment Secrets.

## Delivery flow

`feature/* → pull request → develop → staging → main → production`. يبني مسار الإنتاج صورة Docker ويدفعها إلى GHCR، ثم يمكنه استدعاء webhook لخادم الشركة.

راجع مجلد `docs/` للتفاصيل التشغيلية والمعمارية.
