import {describe,it,expect} from 'vitest';import {Role} from '@prisma/client';import {can} from '../lib/rbac';
describe('RBAC',()=>{it('restricts technical settings',()=>{expect(can(Role.SUPER_ADMIN,'configure')).toBe(true);expect(can(Role.EXECUTIVE,'configure')).toBe(false)});it('allows department manager submissions',()=>expect(can(Role.DEPARTMENT_MANAGER,'submit')).toBe(true));});

