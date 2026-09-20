# Authentication

Auth.js يدعم Microsoft Entra ID. الحساب المحلي اختيار تطويري خلف `LOCAL_AUTH_ENABLED`. التفويض الحقيقي في server actions/API باستخدام `auth()` وRBAC ونطاق الإدارة؛ إخفاء الواجهة ليس آلية حماية.

يُقبل حساب عضو مستأجر Entra المعتمد عندما يكون البريد أو `preferred_username` أو UPN من نطاق `COMPANY_DOMAIN`. لا ينشئ callback الخاص بـ `signIn` المستخدم بنفسه؛ ينشئه Auth.js أولًا ثم يربطه النظام بالمؤسسة داخل callback الخاص بـ JWT. هذا الترتيب ضروري لدعم أول دخول. الحسابات الضيفة (`acct=1`) والمستخدمون الموقوفون مرفوضون.
