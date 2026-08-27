import {describe,it,expect} from 'vitest';import {Role} from '@prisma/client';import {can} from '../lib/rbac';
import { canView } from '../lib/access-control';
describe('RBAC',()=>{it('restricts technical settings',()=>{expect(can(Role.SUPER_ADMIN,'configure')).toBe(true);expect(can(Role.EXECUTIVE,'configure')).toBe(false)});it('allows department manager submissions',()=>expect(can(Role.DEPARTMENT_MANAGER,'submit')).toBe(true));});

describe('navigation access', () => {
  it('lets every signed-in role discover its Microsoft plans while users stay admin-only', () => {
    expect(canView(Role.SUPER_ADMIN, 'integrations')).toBe(true);
    expect(canView(Role.EXECUTIVE, 'integrations')).toBe(true);
    expect(canView(Role.DEPARTMENT_MEMBER, 'integrations')).toBe(true);
    expect(canView(Role.VIEWER, 'integrations')).toBe(true);
    expect(canView(Role.DEPARTMENT_MANAGER, 'users')).toBe(false);
  });

  it('keeps approvals executive and reports available to departments', () => {
    expect(canView(Role.EXECUTIVE, 'approvals')).toBe(true);
    expect(canView(Role.DEPARTMENT_MANAGER, 'approvals')).toBe(false);
    expect(canView(Role.DEPARTMENT_MEMBER, 'reports')).toBe(true);
  });
});
