import { select } from '@inquirer/prompts';

export default {
    define: {
        name: "select",
        description: "在终端向用户展示一个选项列表，等待用户选择一个选项，返回用户选择的值",
        inputSchema: {
            type: "object",
            properties: {
                message: {
                    type: "string",
                    description: "要显示给用户的选择提示文本"
                },
                choices: {
                    type: "array",
                    description: "选项列表，每个选项包含 name（显示文本）和 value（返回值）",
                    items: {
                        type: "object",
                        properties: {
                            name: {
                                type: "string",
                                description: "选项在终端显示的文本"
                            },
                            value: {
                                type: "string",
                                description: "用户选择该选项后返回的值"
                            }
                        },
                        required: ["name", "value"]
                    }
                }
            },
            required: ["message", "choices"]
        }
    },
    async handle({ message, choices }) {
        const answer = await select({
            message,
            choices
        });
        return `用户选择了: ${answer}`;
    }
};
