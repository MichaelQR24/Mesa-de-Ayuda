import { SafeUser } from '../repositories/user.repository.js';

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
    }
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: SafeUser;
  }
}

export {};
