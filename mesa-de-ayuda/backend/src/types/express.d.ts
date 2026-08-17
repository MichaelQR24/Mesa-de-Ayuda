import { SafeUser } from '../repositories/user.repository.js';

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
      requestId?: string;
    }
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: SafeUser;
    requestId?: string;
  }
}

export {};
