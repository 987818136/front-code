import fs from 'fs';
import path from 'path';

const MAX_READ_SIZE = 1024 * 1024; // 1MB

export default {
    define: {
        name: "read_file",
        description: "读取指定本地文件的内容，支持通过 offset 和 limit 控制读取范围.你可以用他读取当前工作目录下的任何文件。",
        inputSchema: {
            type: "object",
            properties: {
                file_path: {
                    type: "string",
                    description: "要读取的文件绝对路径或相对路径"
                },
                offset: {
                    type: "integer",
                    description: "开始读取的行号（从1开始），可选，默认从第1行开始"
                },
                limit: {
                    type: "integer",
                    description: "最多读取的行数，可选，默认读取全部"
                }
            },
            required: ["file_path"]
        }
    },
    handle({ file_path, offset = 1, limit }) {
        const resolvedPath = path.resolve(file_path);

        if (!fs.existsSync(resolvedPath)) {
            return `文件不存在: ${resolvedPath}`;
        }

        const stat = fs.statSync(resolvedPath);
        if (!stat.isFile()) {
            return `路径不是文件: ${resolvedPath}`;
        }

        if (stat.size > MAX_READ_SIZE) {
            return `文件大小超过 ${MAX_READ_SIZE} 字节限制，无法读取。请使用其他方式处理大文件。`;
        }

        try {
            const content = fs.readFileSync(resolvedPath, 'utf-8');
            const lines = content.split(/\r?\n/);
            const startLine = Math.max(1, offset);
            const startIndex = startLine - 1;

            if (startIndex >= lines.length) {
                return `文件共 ${lines.length} 行，指定的 offset ${offset} 超出范围。`;
            }

            const endIndex = limit ? Math.min(lines.length, startIndex + limit) : lines.length;
            const selectedLines = lines.slice(startIndex, endIndex);

            const resultLines = [];
            for (let i = 0; i < selectedLines.length; i++) {
                resultLines.push(`${startLine + i}: ${selectedLines[i]}`);
            }

            return resultLines.join('\n');
        } catch (err) {
            return `读取文件失败: ${err.message}`;
        }
    }
};
