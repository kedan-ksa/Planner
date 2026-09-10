# Permissions

الأدوار: Super Admin، Executive، Department Manager، Department Member، Viewer. فحص الإجراء يتم في `lib/rbac.ts`، وفحص ظهور الصفحة في `lib/access-control.ts`، ويضاف قيد الإدارة والأقسام التابعة عبر `lib/department-scope.ts` إلى استعلامات الخادم.

- Super Admin: كل الوحدات والبيانات والإعدادات والتكاملات والمستخدمون.
- Executive: مؤشرات الشركة والتقارير والمخاطر والاعتمادات، دون الإعدادات التقنية.
- Department Manager: نطاق إدارته والأقسام التابعة، مع تحديث البيانات وإرسال التقارير.
- Department Member: تحديث مهامه المسندة، وإعداد التقارير ضمن نطاق إدارته. يمكنه دخول مركز الاعتمادات لاتخاذ القرار فقط في الطلب المسند إليه، ولا يعتمد طلبه بنفسه.
- Viewer: قراءة الخطة والنتائج فقط.

إخفاء رابط في الواجهة ليس تفويضًا؛ كل صفحة وServer Action تتحقق من الدور والنطاق مجددًا في الخادم.
# Administrative hierarchy and approval scope

- Every user can belong to one department and can have a direct manager.
- Every department can have a parent department and a department manager.
- Department managers can view and update their department and all descendant departments.
- Department members can update only tasks assigned internally to them or assigned to their Microsoft account in Planner.
- Executives remain read-only for operational data and act through approval requests.
- Super administrators configure users, departments, task assignment, workflows, and all system settings.

Authorization is enforced in server actions and route handlers. Hiding a control in the UI is never treated as authorization.

Approval workflows are configured per department and entity type. Supported step resolvers are a named user, a role, the requester's direct manager, and the department manager.

The current workflow editor supports REPORT only. Task assignment is checked before pagination; a member can see an assigned task in another department of the same organization. Viewer and executive roles cannot update task progress, even when assigned. User activation and role are reloaded from the database on each authorized request.
