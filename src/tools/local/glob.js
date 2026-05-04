import fs from 'fs';
import path from 'path';
import { minimatch } from 'minimatch';

const MAX_RESULTS = 1000;
const IGNORE_DIRS = new Set([
    'node_modules',
    '.git',
    '.svn',
    '.hg',
    'dist',
    'build',
    '.next',
    '.nuxt',
    'coverage',
    '.cache',
    '.output'
]);

function* walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
                yield* walkDir(path.join(dir, entry.name));
            }
        } else if (entry.isFile()) {
            yield path.join(dir, entry.name);
        }
    }
}

export default {
    define: {
        name: "glob",
        description: "根据 glob 模式查找文件，例如 '*.js' 或 'src/**/*.ts'，返回匹配的文件路径列表。当你需要查看项目结构，寻找相关文件，一定使用此工具，不要用bash工具",
        inputSchema: {
            type: "object",
            properties: {
                pattern: {
                    type: "string",
                    description: "glob 匹配模式，例如 '*.js'、'src/**/*.ts'"
                },
                search_path: {
                    type: "string",
                    description: "搜索的根目录，默认为当前工作目录"
                }
            },
            required: ["pattern"]
        }
    },
    handle({ pattern, search_path }) {
        const root = search_path ? path.resolve(search_path) : process.cwd();

        if (!fs.existsSync(root)) {
            return `搜索路径不存在: ${root}`;
        }

        if (!fs.statSync(root).isDirectory()) {
            return `搜索路径不是目录: ${root}`;
        }

        const matches = [];

        try {
            for (const filePath of walkDir(root)) {
                const relativePath = path.relative(root, filePath);
                if (minimatch(relativePath, pattern, { matchBase: true })) {
                    matches.push(relativePath);
                    if (matches.length >= MAX_RESULTS) {
                        break;
                    }
                }
            }
        } catch (err) {
            return `搜索出错: ${err.message}`;
        }

        if (matches.length === 0) {
            return `未找到匹配 '${pattern}' 的文件。`;
        }

        const truncated = matches.length >= MAX_RESULTS ? `（结果已截断，最多返回 ${MAX_RESULTS} 条）` : '';
        return `找到 ${matches.length} 个匹配文件${truncated}：\n${matches.join('\n')}`;
    }
};
