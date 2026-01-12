import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';
import { config as dotenvConfig } from 'dotenv';
import { configSchema } from './schema.js';
import type { Config } from '../types/config.js';

// .envファイルを読み込み
dotenvConfig();

/**
 * 設定ファイルを読み込む
 */
export async function loadConfig(configPath: string = 'claude-runner.yaml'): Promise<Config> {
  // 設定ファイルのパスを解決
  const resolvedPath = path.resolve(process.cwd(), configPath);

  // ファイルの存在確認
  try {
    await fs.access(resolvedPath);
  } catch {
    throw new Error(`設定ファイルが見つかりません: ${resolvedPath}`);
  }

  // YAMLファイルを読み込み
  const fileContent = await fs.readFile(resolvedPath, 'utf-8');
  const rawConfig = yaml.parse(fileContent);

  // 環境変数を展開
  const expandedConfig = expandEnvVars(rawConfig);

  // バリデーション
  try {
    const validatedConfig = configSchema.parse(expandedConfig);
    return validatedConfig as Config;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`設定ファイルのバリデーションエラー: ${error.message}`);
    }
    throw error;
  }
}

/**
 * オブジェクト内の環境変数を展開
 * ${VAR_NAME} 形式を環境変数の値に置換
 */
function expandEnvVars(obj: any): any {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{([^}]+)\}/g, (_match, varName) => {
      const value = process.env[varName];
      if (value === undefined) {
        throw new Error(`環境変数 ${varName} が設定されていません`);
      }
      return value;
    });
  }

  if (Array.isArray(obj)) {
    return obj.map(expandEnvVars);
  }

  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, expandEnvVars(value)])
    );
  }

  return obj;
}
