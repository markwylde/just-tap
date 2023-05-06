export type CreateTestFunction = (name: string, fn: (context: TestContext) => any | Promise<void>) => void;

export interface TestOptions {
  logger?: (line: string) => void;
  formatInfo?: (text: string) => string;
  formatSource?: (text: string) => string;
  formatDanger?: (text: string) => string;
  formatSuccess?: (text: string) => string;
  formatValue?: (text: any) => string;
  formatDiffNormal?: (text: string) => string;
  formatDiffAdded?: (text: string) => string;
  formatDiffRemoved?: (text: string) => string;
}

export interface TestContext {
  plan: (newPlan: number) => void;
  timeout: (newTimeout: number) => void;
  waitFor: (fn: () => any, timeout: number) => Promise<void>;
  pass: (message?: string) => void;
  fail: (message?: string) => void;
  throws: (fn: () => void, expected: any, message?: string) => void;
  notThrows: (fn: () => void, message?: string) => void;
  equal: (a: any, b: any, message?: string) => void;
  notEqual: (a: any, b: any, message?: string) => void;
  looseEqual: (a: any, b: any, message?: string) => void;
  notLooseEqual: (a: any, b: any, message?: string) => void;
  deepEqual: (a: any, b: any, message?: string) => void;
  notDeepEqual: (a: any, b: any, message?: string) => void;
  ok: (result: any, message?: string) => void;
  notOk: (result: any, message?: string) => void;
  match: (str: string, regex: RegExp, message?: string) => void;
  notMatch: (str: string, regex: RegExp, message?: string) => void;
}

export interface Test {
  name: string;
  fn: (context: TestContext) => void | Promise<void>;
  sourcePath?: string;
}

declare function createTest (name: string, fn: (context: TestContext) => any | Promise<void>): void;

declare namespace createTest {
  const only: (name: string, fn: (context: TestContext) => Promise<void> | void) => void;

  const skip: (name: string, fn: (context: TestContext) => Promise<void> | void) => void;

  const todo: (name: string, fn?: (context: TestContext) => Promise<void> | void) => void;
}

export default function createTestSuite(options?: TestOptions): {
  test: typeof createTest;
  run: (options?: { concurrency?: number }) => Promise<{
    success: boolean;
    passed: number;
    failed: number;
    ok: number;
    notOk: number;
    skipped: number;
    todo: number;
  }>;
};
