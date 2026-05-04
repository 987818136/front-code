import fs from 'fs';
import path from 'path';
import { minimatch } from 'minimatch';

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const MAX_MATCHES = 100;
const MAX_FILES = 500;
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

function isTextFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const binaryExts = new Set([
        '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
        '.mp3', '.mp4', '.wav', '.avi', '.mov',
        '.zip', '.rar', '.7z', '.tar', '.gz',
        '.exe', '.dll', '.so', '.dylib',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx',
        '.woff', '.woff2', '.ttf', '.eot',
        '.lock', '.sum'
    ]);
    return !binaryExts.has(ext);
}

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

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default {
    define: {
        name: "grep",
        description: "在当前项目中全局搜索文件内容，基于 Node.js 实现，跨平台兼容（支持 Windows / macOS / Linux）。支持正则或字符串匹配，可按 glob 过滤文件类型，自动跳过 node_modules、.git、二进制文件等。本工具只用于搜索相关代码，不用其他搜索。如果要进行搜索，一定要使用此工具，不要自行用bash命令解决",
        inputSchema: {
            type: "object",
            properties: {
                pattern: {
                    type: "string",
                    description: "搜索的正则表达式或普通字符串"
                },
                path: {
                    type: "string",
                    description: "搜索的根目录，默认为当前工作目录"
                },
                glob: {
                    type: "string",
                    description: "文件过滤模式，例如 '*.js' 或 'src/**/*.ts'，可选"
                },
                output_mode: {
                    type: "string",
                    enum: ["files_with_matches", "content"],
                    description: "files_with_matches: 仅返回匹配的文件路径；content: 返回匹配行及前后上下文"
                }
            },
            required: ["pattern"]
        }
    },
    handle({ pattern, path: searchPath, glob, output_mode = "content" }) {
        const root = searchPath ? path.resolve(searchPath) : process.cwd();

        if (!fs.existsSync(root)) {
            return `搜索路径不存在: ${root}`;
        }

        let regex;
        try {
            regex = new RegExp(pattern, 'gm');
        } catch {
            // 如果 pattern 不是合法正则，则按字面量转义后匹配
            regex = new RegExp(escapeRegExp(pattern), 'gm');
        }

        const matches = [];
        let filesScanned = 0;

        try {
            for (const filePath of walkDir(root)) {
                if (filesScanned >= MAX_FILES) break;

                if (!isTextFile(filePath)) continue;
                if (glob && !minimatch(filePath, glob, { matchBase: true })) continue;

                const stat = fs.statSync(filePath);
                if (stat.size > MAX_FILE_SIZE) continue;

                filesScanned++;
                const content = fs.readFileSync(filePath, 'utf-8');
                const relativePath = path.relative(root, filePath);

                if (output_mode === "files_with_matches") {
                    regex.lastIndex = 0;
                    if (regex.test(content)) {
                        matches.push(relativePath);
                        if (matches.length >= MAX_MATCHES) break;
                    }
                } else {
                    const lines = content.split(/\r?\n/);
                    const matchedLines = [];
                    for (let i = 0; i < lines.length; i++) {
                        regex.lastIndex = 0;
                        if (regex.test(lines[i])) {
                            const start = Math.max(0, i - 1);
                            const end = Math.min(lines.length, i + 2);
                            matchedLines.push({
                                line: i + 1,
                                context: lines.slice(start, end).join('\n')
                            });
                        }
                    }
                    if (matchedLines.length > 0) {
                        matches.push({ file: relativePath, lines: matchedLines });
                        if (matches.length >= MAX_MATCHES) break;
                    }
                }
            }
        } catch (err) {
            return `搜索出错: ${err.message}`;
        }

        if (matches.length === 0) {
            return `未找到匹配项（已扫描 ${filesScanned} 个文件）。`;
        }

        if (output_mode === "files_with_matches") {
            return `找到 ${matches.length} 个匹配文件（已扫描 ${filesScanned} 个文件）：\n${matches.join('\n')}`;
        }

        const parts = [];
        parts.push(`找到 ${matches.length} 个文件包含匹配（已扫描 ${filesScanned} 个文件）：`);
        for (const m of matches) {
            parts.push(`\n--- ${m.file} ---`);
            for (const l of m.lines) {
                parts.push(`第 ${l.line} 行:`);
                parts.push(l.context);
            }
        }
        return parts.join('\n');
    }
};
