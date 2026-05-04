/**
 * 将MCP工具格式转换为OpenAI工具格式
 * @param {Object} mcpTools - MCP工具列表
 * @returns {Array} OpenAI格式的工具数组
 */
export function transformToOpenAi(tools) {
    return tools.map(tool => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
        }
    }))
}
