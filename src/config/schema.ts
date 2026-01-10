import { z } from 'zod';

export const configSchema = z.object({
  github: z.object({
    owner: z.string().min(1, 'GitHub owner is required'),
    repo: z.string().min(1, 'GitHub repo is required'),
    token: z.string().regex(/^(ghp_|gho_|ghs_|ghu_|github_pat_)/, 'Invalid GitHub token format'),
    labels: z.array(z.string()).min(1, 'At least one label is required'),
    excludeLabels: z.array(z.string()).optional(),
  }),
  git: z.object({
    baseBranch: z.string().min(1),
    worktreeDir: z.string().min(1),
    branchPrefix: z.string(),
    commitMessageTemplate: z.string().optional(),
  }),
  claude: z.object({
    apiKey: z.string().regex(/^sk-ant-/, 'Invalid Anthropic API key format'),
    model: z.enum([
      'claude-sonnet-4-5-20250929',
      'claude-opus-4-5-20251101',
      'claude-3-5-haiku-20241022',
    ]),
    maxRetries: z.number().int().min(0).max(10).default(3),
    timeout: z.number().int().min(10000).max(600000).default(300000),
    temperature: z.number().min(0).max(1).default(0),
    maxTokens: z.number().int().min(1).max(8192).default(8000),
  }),
  workflow: z.object({
    autoReview: z.boolean().default(true),
    reviewIterations: z.number().int().min(0).max(5).default(2),
    autoCreatePR: z.boolean().default(true),
    autoPush: z.boolean().default(false),
    maxConcurrency: z.number().int().min(1).max(10).default(1),
    runTests: z.boolean().default(true),
    testCommand: z.string().default('npm test'),
    buildBeforeTest: z.boolean().default(true),
    buildCommand: z.string().default('npm run build'),
  }),
  logging: z
    .object({
      level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
      outputDir: z.string().default('logs'),
      maxFiles: z.number().int().default(30),
      maxSize: z.string().default('10m'),
    })
    .optional(),
});

export type ConfigSchema = z.infer<typeof configSchema>;
