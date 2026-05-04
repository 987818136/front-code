export default class LocalClient {
    constructor() {
        //准备一个tools的map，用来储存所有的本地工具
        this.tools = new Map();
    }
    //调用该方法，把你本地的tool对象 传进来
    registerTool(tool) {
        this.tools.set(tool.define.name, tool);
    }
    //调用工具-工具名字，工具参数
    //arguments是关键字，严格模式报错，所以别名为args
    async callTool({ name, arguments: args }) {
        const tool = this.tools.get(name);
        try {
            const content = await tool.handle(args);
            //返回我们模仿mcp服务callTool标准返回，
            return {
                content: [
                    {
                        type: 'text',
                        text: content
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error: ${error.message}`
                    }
                ],
                isError: true
            };
        }
    }

    listTools() {
        return {
            tools: Array.from(this.tools.values()).map(tool => tool.define)
        };
    }
}

