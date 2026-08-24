import { Role } from "@prisma/client";
declare module "next-auth" { interface Session { user:{id:string;role:Role;departmentId?:string|null;organizationId?:string|null;name?:string|null;email?:string|null;image?:string|null} } }
declare module "next-auth/jwt" { interface JWT { role?:Role;departmentId?:string|null;organizationId?:string|null } }
