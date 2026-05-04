import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

/**
 * 获取当前项目和用户目录下的 memory.md 内容并合并，文件不存在则创建空文件
 * @returns {{ projectMemory: string, userMemory: string }} 合并后的记忆对象
 */
export function getNowMemory() {
    const memoryPaths = {
        projectMemory: path.join(process.cwd(), '.front', 'memory', 'memory.md'),
        userMemory: path.join(os.homedir(), '.front', 'memory', 'memory.md')
    };

    const result = {};


    for (const [key, memoryPath] of Object.entries(memoryPaths)) {
        if (!fs.existsSync(memoryPath)) {
            fs.mkdirSync(path.dirname(memoryPath), { recursive: true });
            fs.writeFileSync(memoryPath, '', 'utf-8');
            result[key] = '';
        } else {
            result[key] = fs.readFileSync(memoryPath, 'utf-8');
        }
    }

    return result;
}

/**
 * 获取当前项目的历史对话记录
 * @param {number} maxCount - 最大获取的历史记录条数，默认50
 * @returns {Array} 历史记录数组
 */
export function getHistory(maxCount = 50) {

    const userDir = os.homedir();
    const projectName = path.basename(process.cwd());
    const projectHistoryDir = path.join(userDir, '.front', 'history', projectName);
    //projectHistoryDir就是获取到history下和当前项目同名的历史记录文件夹
    // 如果历史记录目录不存在，返回空数组
    if (!fs.existsSync(projectHistoryDir)) {
        return [];
    }

    // 获取所有 json 文件，并按文件名（时间戳）降序排列，最近的在前
    const files = fs.readdirSync(projectHistoryDir)
        .filter(file => file.endsWith('.json'))
        .sort((a, b) => {
            const tsA = parseInt(path.basename(a, '.json'), 10);
            const tsB = parseInt(path.basename(b, '.json'), 10);
            return tsB - tsA;
        });

    if (files.length === 0) {
        return [];
    }

    const result = [];
    // 前面已经根据文件的修改/创建时间进行了排序了，我们只需要直接按顺序遍历就行
    // 逐个读取文件，直到收集够 maxCount 条或文件读完
    for (const file of files) {
        const filePath = path.join(projectHistoryDir, file);
        try {
            //读取出记录
            const content = fs.readFileSync(filePath, 'utf-8');
            const records = JSON.parse(content);

            if (Array.isArray(records)) {
                result.push(...records);
                // 如果已经超过 maxCount，截取后返回
                if (result.length > maxCount) {
                    return result.slice(0, maxCount);
                }
            }
        } catch (error) {
            console.error(`读取历史记录文件失败: ${filePath}`, error);
            continue;
        }
    }

    // 文件读完也没满 maxCount，返回已有条数
    return result;
}

/**
 * 获取当前项目和用户目录下的 .front.md 内容并合并，文件不存在则创建空文件
 * @returns {{ projectContext: string, userContext: string }} 合并后的上下文对象
 */
export function getContext() {
    const contextPaths = {
        projectContext: path.join(process.cwd(), '.front.md'),
        userContext: path.join(os.homedir(), '.front', '.front.md')
    };

    const result = {};
    for (const [key, contextPath] of Object.entries(contextPaths)) {
        if (!fs.existsSync(contextPath)) {
            fs.mkdirSync(path.dirname(contextPath), { recursive: true });
            fs.writeFileSync(contextPath, '', 'utf-8');
            result[key] = '';
        } else {
            result[key] = fs.readFileSync(contextPath, 'utf-8');
        }
    }

    return result;
}

/**
 * 读取模板并替换占位符，生成完整的记忆提示内容
 * @returns {string} 替换后的模板文本
 */
export function getMemoryContent() {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const templatePath = path.join(__dirname, '..', 'docs', 'memoryTemplate.md');

    let template = fs.readFileSync(templatePath, 'utf-8');

    const { projectMemory, userMemory } = getNowMemory();
    const { projectContext, userContext } = getContext();
    const history = getHistory();

    template = template.replace(/\$\{projectMeory\}/g, projectMemory);
    template = template.replace(/\$\{userMeory\}/g, userMemory);
    template = template.replace(/\$\{projectMd\}/g, projectContext);
    template = template.replace(/\$\{userMd\}/g, userContext);
    template = template.replace(/\$\{record\}/g, JSON.stringify(history, null, 2));

    return template;
}

fs.writeFileSync("./record.json", JSON.stringify(getMemoryContent()))