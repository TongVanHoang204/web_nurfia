import { AppError } from '../middlewares/errorHandler.js';

export const TEAM_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'STAFF'] as const;
const ROLE_RANK: Record<string, number> = { OWNER: 4, ADMIN: 3, MANAGER: 2, STAFF: 1 };
export const effectiveRole = (user: { role: string; isOwner?: boolean }) =>
  user.role === 'ADMIN' && user.isOwner ? 'OWNER' : user.role;
export const hasFullAdminAccess = (role?: string) => role === 'OWNER' || role === 'ADMIN';

type Actor = { userId?: number; userRole?: string; userPermissions?: readonly string[] };
type Member = { id: number; role: string; isOwner?: boolean };

export const assertTeamManagement = (
  actor: Actor, target?: Member, nextRole?: string, permissions?: readonly string[],
) => {
  const actorRank = ROLE_RANK[actor.userRole || ''] || 0;
  if (!actorRank || (!hasFullAdminAccess(actor.userRole) && !actor.userPermissions?.includes('MANAGE_STAFF'))) {
    throw new AppError('Staff management access required.', 403);
  }
  if (target) {
    const role = effectiveRole(target);
    if (role === 'OWNER' || target.id === actor.userId || (ROLE_RANK[role] || 0) >= actorRank) {
      throw new AppError('You cannot modify your own account or an account of equal or higher authority.', 403);
    }
  }
  if (nextRole && (!ROLE_RANK[nextRole] || nextRole === 'OWNER' || ROLE_RANK[nextRole] >= actorRank)) {
    throw new AppError('You cannot assign this account role.', 403);
  }
  if (permissions && !hasFullAdminAccess(actor.userRole)
    && permissions.some(permission => !actor.userPermissions?.includes(permission))) {
    throw new AppError('You cannot grant permissions you do not hold.', 403);
  }
};

export const publicTeamMember = <T extends { role: string; isOwner?: boolean }>(user: T) => {
  const { isOwner: _isOwner, ...publicUser } = user;
  return { ...publicUser, role: effectiveRole(user) };
};
