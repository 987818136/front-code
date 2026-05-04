import logger from "./logger.js"
export function welcomeLog() {
    // 显示欢迎信息
    logger.log('', 'white');
    logger.log('  ╭──────────────────────────────────────╮', 'cyan');
    logger.log('  │                                      │', 'cyan');
    logger.log('  │           😊  欢迎使用！             │', 'yellow');
    logger.log('  │                                      │', 'cyan');
    logger.log('  │       AI 终端助手已启动              │', 'green');
    logger.log('  │                                      │', 'cyan');
    logger.log('  ╰──────────────────────────────────────╯', 'cyan');
    logger.log('', 'white');
    logger.log('输入您的问题，我会尽力帮助您！', 'white');
    logger.log('输入 "exit" 或 "quit" 退出程序', 'gray');
    logger.log('', 'white');
}