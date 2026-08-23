# Architecture

النظام Modular Monolith في البداية: واجهة وAPI في Next.js، PostgreSQL عبر Prisma، وخدمات خارجية معزولة تحت `services/`. حدود الوحدات: Strategy, Execution, KPI, Reporting, Approval, Risk, Notification, Integration, Identity. يمكن فصل Workers للمزامنة والتذكيرات لاحقًا دون تغيير نموذج الأعمال.

