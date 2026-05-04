import fs from 'fs'
import path from 'path'
import { getUserHomeDir, getCurrentWorkingDir } from '../../utils/pathUtils.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

/**
 * 获取MCP配置
 * 从用户目录和项目目录读取 .front/settings.json 配置文件并合并
 * @returns {Array} 合并后的MCP服务器配置数组
 */
export function getMcpConfig() {
    const readConfig = (dir) => {
        const configPath = path.join(dir, '.front', 'settings.json')
        try {
            if (fs.existsSync(configPath)) {
                const content = fs.readFileSync(configPath, 'utf-8')
                const config = JSON.parse(content)
                return config.mcpServer || {}
            }
        } catch (error) {
        }
        return {}
    }

    const userConfig = readConfig(getUserHomeDir())
    const projectConfig = readConfig(getCurrentWorkingDir())

    // 合并配置，项目配置优先覆盖用户配置
    const mergedConfig = { ...userConfig, ...projectConfig }

    // 转换为数组并添加name字段
    return Object.entries(mergedConfig).map(([name, server]) => ({
        ...server,
        name
    }))
}


/**
 * 连接所有MCP服务并获取工具列表
 * 每个工具名称会加上服务名前缀，方便通过工具名找到对应的客户端
 * @returns {Object} 包含tools数组和mcpNameMapClient映射对象
 */
export async function linkMcpAndListTool(targetList, targetMap) {
    const mcpList = getMcpConfig()
    //映射工具名和客户端的
    // const mcpNameMapClient = {}
    //工具列表
    // const mcpToolList = []

    for (const mcpServer of mcpList) {
        try {
            const { type, name, url, headers = {}, command, args, env = {} } = mcpServer
            const client = new Client({
                name: "frontcode-mcp-client",
                version: "1.0.0"
            })

            let transport = null

            // 根据type创建对应的transport
            if (type === 'http' || type === 'streamablehttp') {
                transport = new StreamableHTTPClientTransport(url, {
                    requestInit: {
                        headers
                    }
                })
            } else if (type === 'sse') {
                transport = new SSEClientTransport(new URL(url), {
                    requestInit: {
                        headers
                    }
                })
            } else if (type === 'stdio') {
                transport = new StdioClientTransport({
                    command,
                    args,
                    env
                })
            }

            // 如果不支持的类型，跳过
            if (!transport) {
                continue
            }

            // 连接MCP服务
            await client.connect(transport)
            // 获取服务上的工具列表
            const mcpTools = await client.listTools()
            // 处理每个工具，添加服务名前缀
            mcpTools.tools.forEach(tool => {
                const prefixedToolName = `${name}__${tool.name}`
                const toolWithPrefix = {
                    ...tool,
                    name: prefixedToolName
                }
                // 建立工具名到客户端的映射
                targetMap[prefixedToolName] = client
                targetList.push(toolWithPrefix)
            })

        } catch (error) {
            // 单个服务连接失败不中断，继续连接下一个
        }
    }

}

