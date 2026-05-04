#!/usr/bin/env node
//整个项目的启动入口
import readline from 'readline';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createOpenAIClient, getAIResponse } from "./request/index.js"
import logger from "./utils/logger.js"
import { welcomeLog } from "./utils/init.js";
import { writeHistoryToFrontFile } from "./utils/fsHandle.js"
import { createEnhancedPrompt, enhancedQuestion, initFileCache } from "./input/index.js"
import { attachFilesToMessage, parseFileTags, matchRulesForFiles, parseImageTags, removeImageTags, getDesignImagePath } from "./files/index.js"
import { isCommand, executeCommand, removeCommandFromInput } from "./commands/index.js"
import { readSystem, getUserContext, readRules, getSkillHeaders } from './utils/contextRead.js'
import { searchLocalVector } from './utils/ragHandle.js'
import { imageToBase64 } from './utils/fileHandle.js'
import toolResult from "./tools/index.js"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 创建终端接口
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const openai = createOpenAIClient();
const rulesMap = readRules();
// 初始化文件缓存
initFileCache();

// 初始化增强输入
createEnhancedPrompt(rl);

// 项目启动时读取上下文
const systemMessage = { role: 'system', content: readSystem() };
const userContextMessage = { role: 'user', content: getUserContext() };
const userSkillMessage = { role: 'user', content: getSkillHeaders() };
// 对话历史记录
const messages = [];
welcomeLog()

// 处理用户输入
async function promptUser() {
    const input = await enhancedQuestion('问：');
    const trimmedInput = input.trim();

    // 处理空输入
    if (!trimmedInput) {
        promptUser();
        return;
    }

    // 检查并执行指令
    let commandResult = null;
    let inputToProcess = input; // 默认为原始输入
    if (isCommand(trimmedInput)) {
        const result = await executeCommand(trimmedInput, { messages, rl, promptUser });
        if (result === true) {
            // 阻断类指令：已处理，不发送给大模型
            return;
        } else if (typeof result === 'string') {
            // 非阻断类指令：保存结果，后续附加给大模型，并移除指令部分
            commandResult = result;
            inputToProcess = removeCommandFromInput(input);
        }
        // result === false 表示未识别的指令，继续正常处理
    }

    // 处理文件标签，读取文件内容
    let processedInput = attachFilesToMessage(inputToProcess);

    // 根据选中的文件匹配规则
    const selectedFiles = parseFileTags(inputToProcess);
    if (selectedFiles.length > 0) {
        const matchedRulesContent = matchRulesForFiles(selectedFiles, rulesMap);
        if (matchedRulesContent) {
            processedInput = `${processedInput}\n\n--- 匹配到的规则 ---\n${matchedRulesContent}`;
        }
    }

    // 如果有非阻断类指令的结果，附加到输入中
    if (commandResult) {
        processedInput = `${processedInput}\n\n--- 指令执行结果 ---\n${commandResult}`;
    }

    // 处理图片标签 #[xxx]，把图片转为 base64
    //inputToProcess-#[xx] 帮我把这个设计图转化为diamante
    //selectedImages  [ #[xx] ]
    const selectedImages = parseImageTags(inputToProcess);
    const imageContents = [];
    const imagePaths = [];
    if (selectedImages.length > 0) {
        // 从最终发给大模型的文本里去掉 #[xxx] 标签
        //帮我把这个设计图转化为diamante
        processedInput = removeImageTags(processedInput);
        for (const imageName of selectedImages) {
            try {
                const imagePath = getDesignImagePath(imageName);
                imagePaths.push(imagePath);
                const dataUrl = await imageToBase64(imagePath);
                imageContents.push({
                    type: 'image_url',
                    image_url: { url: dataUrl }
                });
            } catch (err) {
                logger.log(`读取图片失败 ${imageName}: ${err.message}`, 'red');
            }
        }
    }

    // 搜索本地向量库获取相关文本
    let extraMessages = null;

    const ragTexts = await searchLocalVector(trimmedInput);
    let ragMessage = { role: "user", content: "" };
    if (ragTexts && ragTexts.length > 0) {
        const ragContent = ragTexts.join('\n');
        const ragTemplatePath = path.join(__dirname, './docs/ragTemplate.md');
        let ragTemplate;
        ragTemplate = fs.readFileSync(ragTemplatePath, 'utf-8');
        ragMessage.content = ragTemplate.replace('${ragContent}', ragContent)
    }

    // 根据是否有图片决定 message 内容格式
    if (imageContents.length > 0) {
        // 把图片地址追加到文本后面
        const textWithImagePaths = imagePaths.length > 0
            ? `${processedInput}\n\n--- 附加图片 ---\n${imagePaths.map(p => `- ${p}`).join('\n')}`
            : processedInput;
        messages.push({
            role: 'user',
            content: [
                { type: 'text', text: textWithImagePaths },
                ...imageContents
            ]
        });
    } else {
        messages.push({ role: 'user', content: processedInput });
    }

    // 显示加载提示
    const spinner = ora('AI 正在思考...').start();

    // 回复改为回复整个当前消息记录
    const nowMessage = await getAIResponse({
        openai,
        toolResult,
        //上下文额外传入，由调用时拼接，这样不干扰messages
        contextMessageList: [systemMessage, userContextMessage, userSkillMessage, ragMessage],
        messages: messages,
        extraMessages,
        spinner
    });


    // 停止加载提示并显示回复
    spinner.stop();
    logger.log('AI: ', "green")
    //取出nowMessage的最后一个assistant返回
    const lastAssistantMessage = [...nowMessage].reverse().find(msg => msg.role === 'assistant');
    if (lastAssistantMessage) {
        logger.logMarkdown(lastAssistantMessage.content);
    }

    // 继续等待下一次输入
    promptUser();
}

// 全局兜底：避免任何未处理的 rejection 导致进程静默退出
process.on('unhandledRejection', (reason) => {
    console.error('\n未处理的 rejection:', reason);
    promptUser();
});

// 启动对话
promptUser();

// 处理程序退出
rl.on('close', () => {
    writeHistoryToFrontFile(messages);
    process.exit(0);
});

//读取user的全局.front.md
//读取当前项目的下的.front.md
//和模板
//