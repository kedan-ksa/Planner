# Reporting

التقرير مرتبط بفترة وحالته: Draft → In Progress → Ready for Review → Submitted → Approved/Returned → Archived. حاليًا يتحقق الإرسال من الملخص التنفيذي والإنجازات والخطوات القادمة (3 أحرف على الأقل لكل حقل). نسبة الاكتمال تخص هذه الحقول الثلاثة فقط، ولا تعني التحقق من المبادرات أو المؤشرات أو المرفقات. نموذج التقرير النهائي لم يُستلم بعد.
# Template-ready report content

Reports store normalized content fields (summary, achievements, challenges, recommendations, and next steps) plus `templateKey` and `templateData`. This allows a later supplied Word/PDF/Excel model to be mapped without changing the report workflow or losing historical content.

Submitting a department report creates the configured approval chain for that department. Approval steps must be completed in order. Returning or rejecting any step returns the report to the department; approving the final step marks the report approved.

Editing is locked while ready for review, submitted, approved, or archived. Ready-for-review reports can return to preparation. Submission and approval decisions lock the report row to serialize transitions. Resubmissions retain prior decisions and create a new round. An assigned pending reviewer may preview the submitted report within the same organization, without gaining editing rights outside their department scope.

Only REPORT workflows can currently be created. Configure exactly one active workflow per department with explicit approvers; ambiguous role resolution and self-approval are rejected. If no workflow exists, executive/super-admin direct review remains available. Existing unsupported workflow records are retained, not deleted.

Preview supports browser printing and PDF via the browser print dialog; it is not a dedicated server-side PDF/Excel export engine.
