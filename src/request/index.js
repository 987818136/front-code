import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { getUserHomeDir, getCurrentWorkingDir } from '../utils/pathUtils.js';
import chalk from 'chalk';
import { transformToOpenAi } from '../tools/util.js';
import { excuteTool } from '../tools/index.js';
/**
 * 读取配置文件
 * 优先读取当前终端目录下的 .front/settings.json，如果没有则读取用户目录下的
 * @returns {Object} 配置对象
 */
function readConfig() {
    const configFileName = 'settings.json';
    const configDirName = '.front';

    // 尝试读取当前终端目录下的配置
    const cwdConfigPath = path.join(getCurrentWorkingDir(), configDirName, configFileName);
    if (fs.existsSync(cwdConfigPath)) {
        try {
            const content = fs.readFileSync(cwdConfigPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            console.warn(`读取当前目录配置文件失败: ${error.message}`);
        }
    }

    // 尝试读取用户目录下的配置
    const homeConfigPath = path.join(getUserHomeDir(), configDirName, configFileName);
    if (fs.existsSync(homeConfigPath)) {
        try {
            const content = fs.readFileSync(homeConfigPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            console.warn(`读取用户目录配置文件失败: ${error.message}`);
        }
    }

    return {};
}
const config = readConfig();
// 创建 OpenAI 客户端
export function createOpenAIClient() {

    return new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL
    });
}

// 调用 OpenAI API 获取回复
export async function getAIResponse(questionObj) {

    const { messages, openai, model, toolResult, contextMessageList, spinner } = questionObj
    fs.writeFileSync("./record.json", JSON.stringify(messages))
    try {

        // 添加用户消息到历史
        let response = await openai.chat.completions.create({
            model: model || config.model || 'qwen3.6-plus',
            messages: [...contextMessageList, ...messages],
            temperature: 0.7,
            //给入前根据协议转化
            tools: transformToOpenAi(toolResult.tools)
        });

        let aiMessage = response.choices[0].message;
        //ai回复插入到messages里
        messages.push(aiMessage)
        // 检查是否有工具调用
        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
            // 有交互式工具时先停止 spinner，避免顶掉终端输入
            if (spinner) {
                spinner.stop();
            }

            // 执行所有工具调用
            for (const toolCall of aiMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);
                //通知用户开始执行某个工具
                console.log(chalk.green("开始执行工具:" + functionName))
                //自己调用太麻烦，直接用excuteTool

                const excuteResult = await excuteTool(functionName, functionArgs)
                // 添加工具响应到消息
                messages.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    content: excuteResult
                });
            }
            //因为引用类型的特点，messages我们通过push 修改，已经改变，可以直接传递再次调用
            await getAIResponse(questionObj);

        }
        //直接返回整个消息
        return messages;
    } catch (error) {
        console.error('\n调用 OpenAI API 出错:', error.message);
        if (error.response) {
            console.error('错误详情:', error.response.data);
        }
        messages.push({ role: 'assistant', content: '抱歉，我暂时无法回答您的问题，请检查 API 配置或网络连接。' });
        return messages;
    }
}