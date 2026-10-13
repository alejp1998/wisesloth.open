/**
 * Express Application Type Definitions
 * Custom type extensions for the Express app
 */

import { Session, SessionData } from 'express-session';

/**
 * User object stored in session
 */
export interface SessionUser {
  id: string;
  username: string;
  name: string;
  desc: string;
  email?: string;
  isAdmin: boolean;
  isEditor: boolean;
  iFollowIds?: string[];
  followMeIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Extended Session Data
 */
declare module 'express-session' {
  interface SessionData {
    user: SessionUser | null;
    chosenLanguage: string;
    chosenTheme: 'light' | 'dark';
    flashError?: string;
    flashSuccess?: string;
  }
}

/**
 * Extended Request object
 */
declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
      log?: import('pino').Logger;
    }

    interface Locals {
      nonce?: string;
      languagesDict?: Record<string, string>;
      faqsList?: Array<{ question: string; answer: string }>;
      tipsList?: string[];
      formatTimeLeft?: (date: Date) => string;
      formatTimeAgo?: (date: Date) => string;
      paginateControl?: {
        html: string;
        totalItems: number;
        totalPages: number;
        pageFirstItemIndex: number;
        pageLastItemIndex: number;
        pageNo: number;
      };
      url?: string;
      session?: Session & Partial<SessionData>;
      isLoggedIn?: boolean;
      isAdmin?: boolean;
      lang?: string;
      theme?: string;
    }
  }
}

/**
 * API Response types
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: unknown;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Test model interface
 */
export interface ITest {
  id: string;
  userId: number;
  name: string;
  description?: string;
  visibility: 'public' | 'unlisted' | 'private';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Quiz model interface
 */
export interface IQuiz {
  id: string;
  testId: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Test Result model interface
 */
export interface ITestResult {
  id: string;
  userId: number;
  testId: number;
  score: number;
  nQuestions: number;
  nSeconds: number;
  hits: number;
  fails: number;
  omissions: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User statistics
 */
export interface UserStats {
  nTries: number;
  nSeconds: number;
  userHits: number;
  userFails: number;
  userOmissions: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  ttl: number;
  prefix: string;
}

/**
 * Logger levels
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Application Error
 */
export interface AppErrorOptions {
  message: string;
  statusCode?: number;
  isOperational?: boolean;
}

export {};
