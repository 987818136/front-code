import os from 'os';

/**
 * 获取用户电脑的 user 目录
 * @returns {string} 用户目录的绝对路径
 */
export function getUserHomeDir() {
  return os.homedir();
}

/**
 * 获取当前终端所在的工作目录
 * @returns {string} 当前工作目录的绝对路径
 */
export function getCurrentWorkingDir() {
  return process.cwd();
}
