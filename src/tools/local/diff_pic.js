
import { createOpenAIClient, getAIResponse } from '../../request/index.js';
import { imageToBase64 } from '../../utils/fileHandle.js';
import fs from "fs"
export default {
    define: {
        name: "diff_pic",
        description: "用于比对设计图和测试截图的区别，工具会返回文字描述的具体区别点",
        inputSchema: {
            type: "object",
            properties: {
                design: {
                    type: "string",
                    description: "设计图所在的绝对路径"
                },
                screenshot: {
                    type: "string",
                    description: "截图所在的绝对路径",
                    default: false
                }
            },
            required: ["design", "screenshot"]
        }
    },
    async handle({ design, screenshot }) {
        const openai = createOpenAIClient();
        const designBase64 = await imageToBase64(design);
        const screenshotBase64 = await imageToBase64(screenshot);
        const message = [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "以下是设计图和测试截图，请比对测试截图和设计图有什么区别。忽略文本内容，列表长度内容这些差异。重点看ui布局，配色是否有差异，具体差多少px"
                    }
                ]
            },
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "这是设计图"
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: designBase64
                        }
                    }
                ]
            },
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "这是效果截图"
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: screenshotBase64
                        }
                    }
                ]
            }

        ]
        let response = await openai.chat.completions.create({
            model: 'qwen3.6-plus',
            messages: message,
        });
        const result = response.choices[0].message
        fs.writeFileSync("./record.json", JSON.stringify(result))
        return `图片对比结果如下：${result.content}`
    }
};
