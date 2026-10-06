import type { Role } from '../shared/constants';

export interface SessionUser {
  id: number;
  username: string;
  nama: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}
