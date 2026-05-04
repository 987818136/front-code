

import { launchBrowserForCapture, captureRunningBrowser } from '../../utils/debuggerUtils.js';

export default {
    define: {
        name: "debugger_page",
        description: "当用户需要调试时，调用此工具。自动打开chroma加载用户页面地址，工具会返回页面的控制台信息或者截图地址",
        inputSchema: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "项目http地址"
                }
            },
            required: ['url']
        }
    },
    async handle({ url }) {
        await launchBrowserForCapture(url);
        const result = await captureRunningBrowser()
        return `测试结果如下：${JSON.stringify(result)}`
    }
};
