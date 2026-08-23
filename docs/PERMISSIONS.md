# Permissions

الأدوار: Super Admin، Executive، Department Manager، Department Member، Viewer. فحص الإجراء يتم في `lib/rbac.ts`، ويضاف له قيد department subtree في الاستعلامات. عمليات الاعتماد والإعدادات لا تتاح إلا للأدوار المخولة في الخادم.

