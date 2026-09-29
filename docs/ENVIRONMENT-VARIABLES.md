# Environment variables

`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, Azure tenant/client values، Graph scopes، `APP_URL`, `APP_DOMAIN`, `COMPANY_NAME`, و`CRON_SECRET`. تحفظ القيم الفعلية في secret manager أو GitHub Environments، وليس في المستودع.

متغيرات ضبط PostgreSQL الاختيارية:

- `DB_POOL_MAX=10`: اتصالات كل عملية Node/Docker. لا يرفع عشوائيًا؛ يجب أن يكون مجموع جميع نسخ التطبيق أقل من حد PostgreSQL مع هامش للإدارة والنسخ الاحتياطي.
- `DB_CONNECTION_TIMEOUT_MS=10000`: أقصى انتظار لفتح اتصال.
- `DB_STATEMENT_TIMEOUT_MS=10000`: أقصى زمن لتنفيذ عبارة في PostgreSQL.
- `DB_QUERY_TIMEOUT_MS=15000`: أقصى زمن ينتظره عميل التطبيق للاستعلام.
- `DB_LOCK_TIMEOUT_MS=5000`: أقصى انتظار للقفل قبل إطلاق إعادة المحاولة الآمنة.
- `DB_IDLE_TRANSACTION_TIMEOUT_MS=15000`: إنهاء المعاملة التي بقيت مفتوحة بلا عمل.
