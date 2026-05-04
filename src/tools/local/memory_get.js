import { getNowMemory } from '../../utils/memoryUtils.js';

export default {
    define: {
        name: "memoryGet",
        description: "读取项目级和用户级记忆内容",
        inputSchema: {
            type: "object",
            properties: {},
            required: []
        }
    },
    handle() {
        const { projectMemory, userMemory } = getNowMemory();
        return `项目级记忆为${projectMemory}，用户级记忆为${userMemory}`;
    }
};
