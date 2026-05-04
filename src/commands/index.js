// 指令定义和注册中心
import logger from "../utils/logger.js";
import { getUserHomeDir, getCurrentWorkingDir } from "../utils/pathUtils.js";
import { storeAllFilesIn, searchFileAndStoreIn } from "../utils/ragHandle.js";
import { getMemoryContent } from "../utils/memoryUtils.js";
import { createOpenAIClient, getAIResponse } from "../request/index.js";
import toolResult from "../tools/index.js";
import ora from "ora";
import fs from 'fs';
import path from 'path';

// 内置系统指令
const builtinCommandHandlers = {
  '/help': {
    description: '显示帮助信息',
    execute: ({ messages, promptUser }) => {
      logger.log('', 'white');
      logger.log('可用指令：', 'cyan');
      logger.log('  /help     - 显示帮助信息', 'white');
      logger.log('  /clear    - 清空对话历史', 'white');
      logger.log('  /context  - 显示当前对话上下文摘要', 'white');
      logger.log('  /vector [file] - 将所有本地文档或指定文件向量化并存入数据库', 'white');
      logger.log('  /memory   - 调用大模型生成并保存记忆文件', 'white');
      logger.log('  /exit     - 退出程序', 'white');
      logger.log('  /quit     - 退出程序', 'white');
      logger.log('  /a <msg>  - 直接发送消息给大模型（去掉 /a 前缀）', 'white');
      logger.log('  /ask <msg>- 同 /a', 'white');
      logger.log('', 'white');
      logger.log('自定义指令：', 'cyan');
      const customCmds = getAllCustomCommands();
      if (customCmds.length === 0) {
        logger.log('  (暂无自定义指令)', 'gray');
      } else {
        customCmds.forEach(cmd => {
          logger.log(`  ${cmd.name.padEnd(10)} - ${cmd.description}`, 'white');
        });
      }
      logger.log('', 'white');
      logger.log('使用技巧：', 'cyan');
      logger.log('  输入 / 显示指令列表，↑↓选择，Tab确认', 'white');
      logger.log('  输入 @ 显示文件列表，选择后文件内容会自动附加', 'white');
      logger.log('  输入 # 显示 .front/design 下的图片，选中后会作为图片发送给大模型', 'white');
      logger.log('', 'white');
      promptUser();
      return true; // 阻断类：返回 true 表示已处理，不发送给大模型
    }
  },
  '/clear': {
    description: '清空对话历史',
    execute: ({ messages, promptUser }) => {
      messages.length = 0;
      logger.log('对话历史已清空', 'green');
      promptUser();
      return true;
    }
  },
  '/context': {
    description: '显示当前对话上下文摘要',
    execute: ({ messages, promptUser }) => {
      const count = messages.length;
      if (count === 0) {
        return '当前没有对话历史';
      }
      let summary = `当前对话共有 ${count} 条消息：\n`;
      messages.forEach((msg, idx) => {
        let contentText = '';
        if (typeof msg.content === 'string') {
          contentText = msg.content;
        } else if (Array.isArray(msg.content)) {
          // 视觉消息: 取出 text 部分，并提示图片数量
          const textParts = msg.content.filter(p => p.type === 'text').map(p => p.text);
          const imageCount = msg.content.filter(p => p.type === 'image_url').length;
          contentText = textParts.join(' ') + (imageCount > 0 ? ` [含${imageCount}张图片]` : '');
        }
        const preview = contentText.substring(0, 50) + (contentText.length > 50 ? '...' : '');
        summary += `  ${idx + 1}. [${msg.role}] ${preview}\n`;
      });
      // 非阻断类：返回字符串，该字符串会附加给大模型
      return summary;
    }
  },
  '/exit': {
    description: '退出程序',
    execute: ({ rl, messages }) => {
      logger.log('', 'white');
      logger.log('再见！感谢使用 AI 终端助手。👋', 'yellow');
      logger.log('', 'white');
      rl.close();
      return true;
    }
  },
  '/quit': {
    description: '退出程序',
    execute: ({ rl, messages }) => {
      logger.log('', 'white');
      logger.log('再见！感谢使用 AI 终端助手。👋', 'yellow');
      logger.log('', 'white');
      rl.close();
      return true;
    }
  },
  '/vector': {
    description: '将所有本地文档向量化并存入数据库，或指定单个文件 /vector <file>',
    execute: async ({ promptUser, args }) => {
      try {
        if (args) {
          await searchFileAndStoreIn(args);
          logger.log(`文件 ${args} 向量化完成`, 'green');
        } else {
          await storeAllFilesIn();
          logger.log('文档向量化完成', 'green');
        }
      } catch (err) {
        logger.log(`向量化失败: ${err.message}`, 'red');
      }
      promptUser();
      return true;
    }
  },
  '/memory': {
    description: '生成记忆 - 调用大模型分析上下文并写入记忆文件',
    execute: async ({ promptUser }) => {
      const spinner = ora('AI 正在生成记忆...').start();
      try {
        // 1. 获取要发给大模型的记忆模板内容
        const memoryContent = getMemoryContent();

        // 2. 创建 openai 客户端
        const openai = createOpenAIClient();

        // 3. 构建只携带 memory 工具的 toolResult
        const memoryToolResult = {
          tools: toolResult.tools.filter(tool => tool.name === 'memorySave'),
          toolNameMap: toolResult.toolNameMap
        };

        // 4. 构造消息：内容携带第一步的结果
        const memoryMessages = [{ role: 'user', content: memoryContent }];

        // 5. 请求大模型接口
        await getAIResponse({
          openai,
          //工具只有mermory_save
          toolResult: memoryToolResult,
          contextMessageList: [],
          messages: memoryMessages,
          spinner
        });

        spinner.stop();
        logger.log('记忆生成完成', 'green');
      } catch (err) {
        spinner.stop();
        logger.log(`生成记忆失败: ${err.message}`, 'red');
      }
      promptUser();
      return true; // 阻断类：返回 true 表示已处理，不发送给大模型
    }
  }
};

// 兼容不带 / 的退出命令
const aliasHandlers = {
  'exit': '/exit',
  'quit': '/quit'
};

// 缓存自定义指令
let customCommandCache = null;
let customCommandLastLoad = 0;
const CACHE_TTL = 5000; // 5秒缓存

/**
 * 从指定目录加载自定义指令
 * @param {string} baseDir - 基础目录（用户目录或项目目录）
 * @returns {Map} 指令映射
 */
function loadCustomCommandsFromDir(baseDir) {
  const commands = new Map();
  const commandsDir = path.join(baseDir, '.front', 'commands');

  if (!fs.existsSync(commandsDir)) {
    return commands;
  }

  try {
    // 遍历 commands 目录下的子文件夹
    //subdirs - ["E:\aiagent\6-2 支持指令和选定文件\code\.front\commands\abc","E:\aiagent\6-2 支持指令和选定文件\code\.front\commands\a1"]
    const subdirs = fs.readdirSync(commandsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const subdir of subdirs) {
      const subdirPath = path.join(commandsDir, subdir);

      // 查找子文件夹内的 md 文件
      /*
      files=-["E:\aiagent\6-2 支持指令和选定文件\code\.front\commands\abc\a.md",
      "E:\aiagent\6-2 支持指令和选定文件\code\.front\commands\a1\c.md"]
      */
      const files = fs.readdirSync(subdirPath, { withFileTypes: true })
        .filter(dirent => dirent.isFile() && dirent.name.endsWith('.md'))
        .map(dirent => dirent.name);

      for (const file of files) {
        //cmdName - /abc:a
        const cmdName = `/${subdir}:${path.basename(file, '.md')}`;
        const filePath = path.join(subdirPath, file);

        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          // 从内容第一行提取描述（如果第一行以 # 开头）
          let description = `自定义指令 (${subdir}/${file})`;
          const firstLine = content.trim().split('\n')[0];
          if (firstLine && firstLine.startsWith('#')) {
            description = firstLine.replace(/^#+\s*/, '').trim();
          }

          commands.set(cmdName, {
            description,
            filePath,
            content
          });
        } catch (err) {
          logger.log(`  读取指令文件失败: ${filePath}`, 'red');
        }
      }
    }
  } catch (err) {
    logger.log(`  扫描自定义指令目录失败: ${commandsDir}`, 'red');
  }

  return commands;
}

/**
 * 加载所有自定义指令
 * @returns {Map} 合并后的指令映射
 */
function loadAllCustomCommands() {
  const now = Date.now();
  if (customCommandCache && (now - customCommandLastLoad < CACHE_TTL)) {
    return customCommandCache;
  }

  const allCommands = new Map();

  // 先加载用户目录的指令
  const userDir = getUserHomeDir();
  const userCommands = loadCustomCommandsFromDir(userDir);
  userCommands.forEach((value, key) => {
    allCommands.set(key, value);
  });

  // 再加载当前项目目录的指令（会覆盖同名的用户目录指令）
  const projectDir = getCurrentWorkingDir();
  const projectCommands = loadCustomCommandsFromDir(projectDir);
  projectCommands.forEach((value, key) => {
    allCommands.set(key, value);
  });

  customCommandCache = allCommands;
  customCommandLastLoad = now;
  return allCommands;
}

/**
 * 获取所有自定义指令
 */
function getAllCustomCommands() {
  const commands = loadAllCustomCommands();

  return Array.from(commands.entries()).map(([name, { description }]) => ({
    name,
    description
  }));
}

/**
 * 获取所有指令（内置 + 自定义）
 */
export function getAllCommands() {

  const builtin = Object.entries(builtinCommandHandlers).map(([name, { description }]) => ({
    name,
    description
  }));
  const custom = getAllCustomCommands();
  return [...builtin, ...custom];
}

/**
 * 筛选指令
 * @param {string} prefix - 前缀（不含 /）
 */
export function filterCommands(prefix) {
  const commands = getAllCommands();
  if (!prefix) return commands;
  const lowerPrefix = prefix.toLowerCase();
  return commands.filter(cmd =>
    cmd.name.toLowerCase().startsWith('/' + lowerPrefix)
  );
}

/**
 * 检查是否是指令
 */
export function isCommand(text) {
  const parts = text.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  if (command.startsWith('/')) {
    // 先检查内置指令
    if (builtinCommandHandlers[command]) return true;
    // 再检查自定义指令
    const customCommands = loadAllCustomCommands();
    if (customCommands.has(command)) return true;
    return false;
  }
  // 检查别名
  return !!aliasHandlers[command];
}

/**
 * 从输入中移除指令部分，保留其他内容
 * @param {string} input - 用户输入
 * @returns {string} - 移除指令后的内容
 */
export function removeCommandFromInput(input) {
  const parts = input.trim().split(/\s+/);
  let command = parts[0].toLowerCase();

  // 处理别名
  if (aliasHandlers[command]) {
    command = aliasHandlers[command];
  }

  // 检查内置指令
  if (builtinCommandHandlers[command]) {
    return input.trim().substring(command.length).trim();
  }

  // 检查自定义指令
  const customCommands = loadAllCustomCommands();
  if (customCommands.has(command)) {
    return input.trim().substring(command.length).trim();
  }

  return input;
}

/**
 * 执行指令
 * @param {string} input - 用户输入
 * @param {object} context - 上下文对象 { messages, rl, promptUser }
 * @returns {boolean|string|object} - 返回 true（阻断）、字符串（非阻断，附加给大模型）、{passthrough: true, content: '...'}（透传内容）或 false（未处理）
 */
export async function executeCommand(input, context) {
  const parts = input.trim().split(/\s+/);
  let command = parts[0].toLowerCase();

  // 处理别名
  if (aliasHandlers[command]) {
    command = aliasHandlers[command];
  }

  // 检查内置指令
  const builtinHandler = builtinCommandHandlers[command];
  if (builtinHandler) {
    // 透传指令：返回去掉前缀后的内容
    if (builtinHandler.passthrough) {
      const content = input.trim().substring(command.length).trim();
      return { passthrough: true, content };
    }
    // 普通指令：执行 execute
    const args = input.trim().substring(command.length).trim();
    return builtinHandler.execute({ ...context, args });
  }

  // 检查自定义指令（非阻断，返回 md 文件内容）
  const customCommands = loadAllCustomCommands();
  const customCmd = customCommands.get(command);
  if (customCmd) {
    // 重新读取文件以获取最新内容
    try {
      const latestContent = fs.readFileSync(customCmd.filePath, 'utf-8');
      return latestContent;
    } catch (err) {
      logger.log(`读取自定义指令文件失败: ${customCmd.filePath}`, 'red');
      return customCmd.content; // 返回缓存的内容
    }
  }

  return false;
}
