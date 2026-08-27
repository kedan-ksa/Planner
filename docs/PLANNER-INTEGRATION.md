# Planner Integration

Microsoft Graph مع OAuth delegated permissions. التسلسل: دخول Microsoft → تفعيل الاتصال → قراءة `/me/planner/plans` → ربط Plan بمبادرة → مزامنة Tasks → SyncJob وSyncLog. المفاتيح الخارجية فريدة، لذلك تكون upserts بلا تكرار.

الأذونات المستخدمة: `Tasks.Read` لقراءة Planner، و`Files.Read.All` و`Sites.Read.All` لعرض ملفات SharePoint المتاحة للمستخدم، و`offline_access` لتجديد رمز الوصول. يجب منح Admin Consent في Entra ثم إعادة تسجيل الدخول.

تبقى المحاور والأهداف والمؤشرات والتقارير مصدرها المنصة. Planner مصدر تنفيذ المهام فقط. لا تُطبع الرموز في السجلات، وتبقى أسرار التطبيق في Cloudflare/GitHub Secrets. يوصى لاحقًا بتشفير refresh/access tokens على مستوى التطبيق وتشغيل مزامنة مجدولة بقفل موزع ومعالجة `429 Retry-After`.
