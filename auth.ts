import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
const providers = [MicrosoftEntraID({clientId:process.env.AZURE_AD_CLIENT_ID??"",clientSecret:process.env.AZURE_AD_CLIENT_SECRET??"",issuer:`https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID??"common"}/v2.0`,authorization:{params:{scope:process.env.MICROSOFT_GRAPH_SCOPE}}})];
if(process.env.LOCAL_AUTH_ENABLED==="true") providers.push(Credentials({credentials:{email:{},password:{}},authorize:async(raw)=>{const parsed=z.object({email:z.string().email(),password:z.string().min(8)}).safeParse(raw);if(!parsed.success)return null;const user=await db.user.findUnique({where:{email:parsed.data.email}});if(!user?.passwordHash||!user.active||!(await compare(parsed.data.password,user.passwordHash)))return null;return {id:user.id,name:user.name,email:user.email};}}) as never);
export const {handlers,auth,signIn,signOut}=NextAuth({adapter:PrismaAdapter(db),providers,session:{strategy:"jwt"},callbacks:{jwt:async({token,user})=>{if(user){const stored=await db.user.findUnique({where:{id:user.id!},select:{role:true,departmentId:true,organizationId:true}});token.role=stored?.role;token.departmentId=stored?.departmentId;token.organizationId=stored?.organizationId;}return token;},session:async({session,token})=>{if(session.user){session.user.id=token.sub!;Object.assign(session.user,{role:token.role,departmentId:token.departmentId,organizationId:token.organizationId});}return session;}},pages:{signIn:"/login"}});

