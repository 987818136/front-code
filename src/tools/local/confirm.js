import { confirm } from '@inquirer/prompts';

export default {
    define: {
        name: "confirm",
        description: "在终端向用户发起一个确认提问，等待用户输入 yes 或 no，返回用户的确认结果",
        inputSchema: {
            type: "object",
            properties: {
                message: {
                    type: "string",
                    description: "要显示给用户的确认提示文本"
                },
                default: {
                    type: "boolean",
                    description: "默认选项，true 表示默认选中 yes，false 表示默认选中 no",
                    default: false
                }
            },
            required: ["message"]
        }
    },
    async handle({ message, default: defaultValue = false }) {
        const answer = await confirm({
            message,
            default: defaultValue
        });
        return answer ? "用户已确认 (yes)" : "用户已取消 (no)";
    }
};
