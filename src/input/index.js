import readline from 'readline';
import ansiEscapes from 'ansi-escapes';
import chalk from 'chalk';
import { getAllCommands, filterCommands } from '../commands/index.js';
import { scanFiles, filterFiles, scanDesignImages, filterImages } from '../files/index.js';

// 列表状态
let listState = {
  visible: false,
  type: null, // 'command' | 'file' | 'image'
  items: [],
  selectedIndex: 0,
  filterText: '',
  triggerPosition: 0,
  lastRenderedCount: 0
};

let rl = null;
let currentLine = '';
let cursorPos = 0;
let allFiles = [];
let allImages = [];
let resolveInput = null;

// 初始化所有文件列表
export function initFileCache() {
  allFiles = scanFiles();
  allImages = scanDesignImages();
}

/**
 * 创建增强的输入提示
 */
export function createEnhancedPrompt(interfaceInstance) {
  rl = interfaceInstance;

  // 禁用默认的行编辑监听
  rl.input.removeAllListeners('keypress');

  // 添加自定义键盘监听
  rl.input.on('keypress', (char, key) => {
    handleKeyPress(char, key);
  });
}

/**
 * 增强的 question 方法
 */
export function enhancedQuestion(prompt) {
  return new Promise((resolve) => {
    resolveInput = resolve;
    currentLine = '';
    cursorPos = 0;
    listState.visible = false;
    listState.type = null;

    process.stdout.write(prompt);
    rl.setPrompt(prompt);
    rl.prompt(true);
  });
}

/**
 * 处理按键
 */
function handleKeyPress(char, key) {
  if (listState.visible) {
    handleListKey(char, key);
  } else {
    handleNormalKey(char, key);
  }
}

/**
 * 处理正常模式按键
 */
function handleNormalKey(char, key) {
  if (key.name === 'return') {
    submitInput();
    return;
  }

  if (key.name === 'backspace') {
    if (cursorPos > 0) {
      currentLine = currentLine.slice(0, cursorPos - 1) + currentLine.slice(cursorPos);
      cursorPos--;
    }
    refreshLine();
    checkTrigger();
    return;
  }

  if (key.name === 'left') {
    if (cursorPos > 0) cursorPos--;
    refreshLine();
    return;
  }

  if (key.name === 'right') {
    if (cursorPos < currentLine.length) cursorPos++;
    refreshLine();
    return;
  }

  if (char && !key.ctrl && !key.meta) {
    currentLine = currentLine.slice(0, cursorPos) + char + currentLine.slice(cursorPos);
    cursorPos++;
    refreshLine();
    checkTrigger();
  }
}

/**
 * 检查是否触发 / 或 @ 或 #
 */
function checkTrigger() {
  const textBeforeCursor = currentLine.slice(0, cursorPos);

  // 检查 / 触发
  const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
  if (lastSlashIndex !== -1) {
    const beforeSlash = textBeforeCursor[lastSlashIndex - 1];
    if (!beforeSlash || beforeSlash === ' ') {
      const filterText = textBeforeCursor.slice(lastSlashIndex + 1);
      if (!filterText.includes(' ')) {
        showList('command', filterText, lastSlashIndex);
        return;
      }
    }
  }

  // 检查 @ 触发
  const lastAtindex = textBeforeCursor.lastIndexOf('@');
  if (lastAtindex !== -1) {
    const beforeAt = textBeforeCursor[lastAtindex - 1];
    if (!beforeAt || beforeAt === ' ') {
      const filterText = textBeforeCursor.slice(lastAtindex + 1);
      if (!filterText.includes(' ')) {
        showList('file', filterText, lastAtindex);
        return;
      }
    }
  }

  // 检查 # 触发
  const lastHashIndex = textBeforeCursor.lastIndexOf('#');
  if (lastHashIndex !== -1) {
    const beforeHash = textBeforeCursor[lastHashIndex - 1];
    if (!beforeHash || beforeHash === ' ') {
      const filterText = textBeforeCursor.slice(lastHashIndex + 1);
      if (!filterText.includes(' ')) {
        showList('image', filterText, lastHashIndex);
        return;
      }
    }
  }

  hideList();
}

/**
 * 显示列表
 */
function showList(type, filterText, triggerPosition) {
  listState.type = type;
  listState.filterText = filterText;
  listState.triggerPosition = triggerPosition;
  listState.selectedIndex = 0;

  if (type === 'command') {
    listState.items = filterCommands(filterText);
  } else if (type === 'image') {
    listState.items = filterImages(allImages, filterText);
  } else {
    listState.items = filterFiles(allFiles, filterText);
  }

  if (listState.items.length > 0) {
    listState.visible = true;
    renderList();
  } else {
    hideList();
  }
}

/**
 * 隐藏列表
 */
function hideList() {
  if (listState.visible) {
    clearList();
    listState.visible = false;
    listState.type = null;
    listState.lastRenderedCount = 0;
  }
}

/**
 * 处理列表模式按键
 */
function handleListKey(char, key) {
  if (key.name === 'escape') {
    hideList();
    return;
  }

  if (key.name === 'tab') {
    confirmSelection();
    return;
  }

  if (key.name === 'up') {
    if (listState.selectedIndex > 0) {
      listState.selectedIndex--;
      renderList();
    }
    return;
  }

  if (key.name === 'down') {
    if (listState.selectedIndex < listState.items.length - 1) {
      listState.selectedIndex++;
      renderList();
    }
    return;
  }

  if (key.name === 'return') {
    hideList();
    submitInput();
    return;
  }

  // 继续输入，更新筛选
  if (key.name === 'backspace') {
    if (cursorPos > listState.triggerPosition + 1) {
      currentLine = currentLine.slice(0, cursorPos - 1) + currentLine.slice(cursorPos);
      cursorPos--;
      refreshLine();
      checkTrigger();
    } else {
      hideList();
      handleNormalKey(char, key);
    }
    return;
  }

  if (char && !key.ctrl && !key.meta) {
    currentLine = currentLine.slice(0, cursorPos) + char + currentLine.slice(cursorPos);
    cursorPos++;
    refreshLine();
    checkTrigger();
  }
}

/**
 * 确认选择
 */
function confirmSelection() {
  if (!listState.visible || listState.items.length === 0) return;

  const selected = listState.items[listState.selectedIndex];
  const before = currentLine.slice(0, listState.triggerPosition);
  const after = currentLine.slice(cursorPos);

  if (listState.type === 'command') {
    const cmdName = selected.name;
    currentLine = before + cmdName + ' ' + after;
    cursorPos = before.length + cmdName.length + 1;
  } else if (listState.type === 'image') {
    currentLine = before + `#[${selected}] ` + after;
    cursorPos = before.length + `#[${selected}] `.length;
  } else {
    currentLine = before + `@[${selected}] ` + after;
    cursorPos = before.length + `@[${selected}] `.length;
  }

  hideList();
  refreshLine();
}

/**
 * 刷新当前行显示
 */
function refreshLine() {
  process.stdout.write(ansiEscapes.cursorLeft + ansiEscapes.eraseLine);
  process.stdout.write(rl.getPrompt() + currentLine);
  const moveTo = currentLine.length - cursorPos;
  if (moveTo > 0) {
    process.stdout.write(ansiEscapes.cursorBackward(moveTo));
  }
}

/**
 * 渲染列表
 */
function renderList() {
  if (listState.visible) {
    clearList();
  }

  if (!listState.visible) return;

  const maxItems = Math.min(listState.items.length, 8);
  listState.lastRenderedCount = maxItems;

  // 先换行，在输入行下方显示列表
  process.stdout.write('\n');

  for (let i = 0; i < maxItems; i++) {
    const item = listState.items[i];
    let lineText = '';

    if (listState.type === 'command') {
      lineText = `  ${item.name} - ${item.description}`;
    } else {
      lineText = `  ${item}`;
    }

    if (i === listState.selectedIndex) {
      process.stdout.write(chalk.bgBlue.white(lineText) + '\n');
    } else {
      process.stdout.write(lineText + '\n');
    }
  }

  // 移动光标回输入位置
  process.stdout.write(ansiEscapes.cursorUp(maxItems + 1));
}

/**
 * 清除列表显示
 */
function clearList() {
  const maxItems = listState.lastRenderedCount;
  if (!maxItems || maxItems <= 0) return;

  // 光标移到列表第一行（我们之前多换了一行）
  process.stdout.write(ansiEscapes.cursorDown(1));

  for (let i = 0; i < maxItems; i++) {
    process.stdout.write(ansiEscapes.eraseLine + ansiEscapes.cursorDown(1));
  }

  // 回到原来位置并清除那行多的换行
  process.stdout.write(ansiEscapes.cursorUp(maxItems + 1));
  process.stdout.write(ansiEscapes.eraseLine);
}

/**
 * 提交输入
 */
function submitInput() {
  hideList();
  process.stdout.write('\n');

  if (resolveInput) {
    const cb = resolveInput;
    resolveInput = null;
    cb(currentLine);
  }
}
