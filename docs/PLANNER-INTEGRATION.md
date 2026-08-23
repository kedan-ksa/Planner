# Planner Integration

Microsoft Graph مع OAuth delegated permissions. التسلسل: اتصال → اختيار Plans → Mapping → SyncJob. المفاتيح الخارجية فريدة، لذلك تكون upserts بلا تكرار. لا تُسجل الرموز أو محتوى Planner الحساس، ويجب تشفير refresh/access tokens بمفتاح خارج قاعدة البيانات قبل الإنتاج. يوصى بتشغيل worker دوري بقفل موزع ومعالجة 429 عبر Retry-After.

