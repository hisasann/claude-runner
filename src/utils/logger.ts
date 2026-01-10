import winston from 'winston';
import path from 'path';
import fs from 'fs';
import type { LoggingConfig } from '../types/config.js';

let logger: winston.Logger;

/**
 * ロガーを初期化
 */
export function initLogger(config?: LoggingConfig): winston.Logger {
  const level = config?.level || 'info';
  const outputDir = config?.outputDir || 'logs';

  // ログディレクトリを作成
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 日付フォーマット
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  logger = winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),
    transports: [
      // コンソール出力
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp }) => {
            return `${timestamp} ${level}: ${message}`;
          })
        ),
      }),
      // ファイル出力
      new winston.transports.File({
        filename: path.join(outputDir, `claude-runner-${timestamp}.log`),
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        maxsize: parseMaxSize(config?.maxSize || '10m'),
        maxFiles: config?.maxFiles || 30,
      }),
      // エラーログ専用
      new winston.transports.File({
        filename: path.join(outputDir, `error-${timestamp}.log`),
        level: 'error',
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      }),
    ],
  });

  return logger;
}

/**
 * ロガーを取得
 */
export function getLogger(): winston.Logger {
  if (!logger) {
    // デフォルトロガーを初期化
    return initLogger();
  }
  return logger;
}

/**
 * maxSize文字列をバイト数に変換
 * 例: "10m" -> 10 * 1024 * 1024
 */
function parseMaxSize(maxSize: string): number {
  const match = maxSize.match(/^(\d+)([kmg]?)$/i);
  if (!match) {
    return 10 * 1024 * 1024; // デフォルト10MB
  }

  const [, num, unit] = match;
  const size = parseInt(num!, 10);

  switch (unit!.toLowerCase()) {
    case 'k':
      return size * 1024;
    case 'm':
      return size * 1024 * 1024;
    case 'g':
      return size * 1024 * 1024 * 1024;
    default:
      return size;
  }
}

// デフォルトエクスポート
export default { initLogger, getLogger };
