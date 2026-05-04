import fs from 'fs';
import path from 'path';

export default {
    define: {
        name: "write_file",
        description: "将内容写入到指定文件路径，如果文件已存在则覆盖，如果目录不存在则自动创建。",
        inputSchema: {
            type: "object",
            properties: {
                file_path: {
                    type: "string",
                    description: "要写入的文件路径（绝对路径或相对路径）"
                },
                content: {
                    type: "string",
                    description: "要写入文件的内容"
                }
            },
            required: ["file_path", "content"]
        }
    },
    handle({ file_path, content }) {
        const resolvedPath = path.resolve(file_path);

        try {
            const dir = path.dirname(resolvedPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(resolvedPath, content, 'utf-8');
            return `文件写入成功: ${resolvedPath}`;
        } catch (err) {
            return `文件写入失败: ${err.message}`;
        }
    }
};
