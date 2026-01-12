import fs from 'fs/promises';
import path from 'path';
import type { Tool } from '@anthropic-ai/sdk/resources/messages.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export interface ToolExecutor {
  name: string;
  execute: (input: any, workingDir: string) => Promise<string>;
}

/**
 * ファイル操作ツールの定義
 */
export const FILE_TOOLS: Tool[] = [
  {
    name: 'read_file',
    description:
      'Read the contents of a file at the specified path. Returns the file contents as a string. Use this to examine existing code before making changes.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The relative path to the file to read (e.g., "src/utils/add.ts")',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description:
      'Write content to a file at the specified path. Creates the file if it does not exist, or overwrites it if it does. Parent directories will be created automatically.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The relative path to the file to write (e.g., "src/utils/add.ts")',
        },
        content: {
          type: 'string',
          description: 'The content to write to the file',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_directory',
    description:
      'List all files and directories in the specified directory. Returns a list of file/directory names.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The relative path to the directory to list (e.g., "src" or ".")',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'create_directory',
    description:
      'Create a directory at the specified path. Parent directories will be created automatically.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The relative path to the directory to create (e.g., "src/utils")',
        },
      },
      required: ['path'],
    },
  },
];

/**
 * ツール実行関数のマップ
 */
export const TOOL_EXECUTORS: Record<string, ToolExecutor> = {
  read_file: {
    name: 'read_file',
    execute: async (input: { path: string }, workingDir: string): Promise<string> => {
      const filePath = path.join(workingDir, input.path);
      logger.debug(`Reading file: ${filePath}`);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        logger.info(`Tool: read_file - ${input.path} (${content.length} bytes)`);
        return content;
      } catch (error: any) {
        const errorMsg = `Failed to read file: ${error.message}`;
        logger.error(errorMsg);
        return errorMsg;
      }
    },
  },

  write_file: {
    name: 'write_file',
    execute: async (
      input: { path: string; content: string },
      workingDir: string
    ): Promise<string> => {
      const filePath = path.join(workingDir, input.path);
      logger.debug(`Writing file: ${filePath}`);

      try {
        // 親ディレクトリを作成
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        // ファイルを書き込み
        await fs.writeFile(filePath, input.content, 'utf-8');

        logger.info(`Tool: write_file - ${input.path} (${input.content.length} bytes)`);
        return `Successfully wrote ${input.content.length} bytes to ${input.path}`;
      } catch (error: any) {
        const errorMsg = `Failed to write file: ${error.message}`;
        logger.error(errorMsg);
        return errorMsg;
      }
    },
  },

  list_directory: {
    name: 'list_directory',
    execute: async (input: { path: string }, workingDir: string): Promise<string> => {
      const dirPath = path.join(workingDir, input.path);
      logger.debug(`Listing directory: ${dirPath}`);

      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const formatted = entries
          .map((entry) => {
            const type = entry.isDirectory() ? 'DIR' : 'FILE';
            return `[${type}] ${entry.name}`;
          })
          .join('\n');

        logger.info(`Tool: list_directory - ${input.path} (${entries.length} entries)`);
        return formatted || '(empty directory)';
      } catch (error: any) {
        const errorMsg = `Failed to list directory: ${error.message}`;
        logger.error(errorMsg);
        return errorMsg;
      }
    },
  },

  create_directory: {
    name: 'create_directory',
    execute: async (input: { path: string }, workingDir: string): Promise<string> => {
      const dirPath = path.join(workingDir, input.path);
      logger.debug(`Creating directory: ${dirPath}`);

      try {
        await fs.mkdir(dirPath, { recursive: true });
        logger.info(`Tool: create_directory - ${input.path}`);
        return `Successfully created directory: ${input.path}`;
      } catch (error: any) {
        const errorMsg = `Failed to create directory: ${error.message}`;
        logger.error(errorMsg);
        return errorMsg;
      }
    },
  },
};

/**
 * ツールを実行
 */
export async function executeTool(
  toolName: string,
  toolInput: any,
  workingDir: string
): Promise<string> {
  const executor = TOOL_EXECUTORS[toolName];

  if (!executor) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  return await executor.execute(toolInput, workingDir);
}
