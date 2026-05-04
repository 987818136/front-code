import fs from 'fs';
import path from 'path';

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import mammoth from 'mammoth';
import * as lancedb from '@lancedb/lancedb';
import { createOpenAIClient } from '../request/index.js';
import { getUserHomeDir, getCurrentWorkingDir } from './pathUtils.js';

// 支持的文档扩展名，仅允许文本类文件,也就是只允许用的文档用这些格式
const ALLOWED_EXTENSIONS = ['.md', '.txt', '.docx'];


// 获取到目录下的所有文件，比如我们这样调用它 getFilesFromDir("user/.front/doc")
//就会获取到user目录下，.front下doc里的所有文件组成的数组
//比如 
// [C:\Users\Administrator\.front\doc\公司门店.txt,C:\Users\Administrator\.front\doc\考勤制度.docx]
export function getFilesFromDir(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(name => ALLOWED_EXTENSIONS.includes(path.extname(name).toLowerCase()))
        .map(name => path.join(dir, name));
}
/**
 * 读取一个或多个文件的内容
 * @param {string|string[]} filePaths - 文件路径，可以是单个路径字符串或路径数组
 * @returns {Promise<{path: string, content: string}[]>} 返回一个Promise，resolve为对象数组，每个对象包含 path（文件路径）和 content（文件内容）
 * @example
 * // 比如
 * const result = await readFileContent(["C:/docs/a.md", "C:/docs/b.docx"]);
 * // result: [
 * //   { path: "C:/docs/a.md", content: "# 标题\n正文..." },
 * //   { path: "C:/docs/b.docx", content: "docx文档提取的纯文本..." }
 * // ]
 */
export async function readFileContent(filePaths) {
    //检测是否是数组
    if (!Array.isArray(filePaths)) filePaths = [filePaths];
    return Promise.all(filePaths.map(async (filePath) => {
        //并发读取文件，避免串行一个个读耗时太久
        const ext = path.extname(filePath).toLowerCase();
        let content;
        if (ext === '.docx') {
            const result = await mammoth.extractRawText({ path: filePath });
            content = result.value;
        } else {
            content = fs.readFileSync(filePath, 'utf-8');
        }
        //最终每一个文件读取后，返回路径和内容，外层
        return { path: filePath, content };
    }));
}


// 调用大模型接口将文本转为向量
export async function getEmbeddings(text) {
    if (!text) return;
    const openai = createOpenAIClient();
    const response = await openai.embeddings.create({
        model: 'text-embedding-v4',
        input: text,
    });
    return response.data[0].embedding;
}

/**
 * 获取用户目录和当前工作目录下 .front/doc 文件夹中的所有文档内容
 *  
 */
export async function getAllRagFile() {
    //获取user目录和当前工作目录
    const userHomeDir = getUserHomeDir();
    const currentWorkingDir = getCurrentWorkingDir();
    //获取user目录和当前工作目录下的.front下的doc，这里放着所有本地文档
    const userDocDir = path.join(userHomeDir, '.front', 'doc');
    const currentDirDocDir = path.join(currentWorkingDir, '.front', 'doc');
    //分别获取到user下的所有文件，以及当前目录下的所有文件
    const userFiles = getFilesFromDir(userDocDir);
    const currentDirFiles = getFilesFromDir(currentDirDocDir);

    //如果有文件则读取所有内容
    const userDocArr = userFiles.length > 0 ? await readFileContent(userFiles) : [];
    const currentDirDocArr = currentDirFiles.length > 0 ? await readFileContent(currentDirFiles) : [];
    //userDocArr-为读取到的所有user目录下的文档
    //currentDirDocArr-为读取到的当前目录下的所有文档
    return { userDocArr, currentDirDocArr };
}
fs.writeFileSync("./files.json", JSON.stringify(await getAllRagFile()))




/**
 * 将文件内容数组转为向量
 */
export async function filesToEmbedding(fileArr) {
    if (!Array.isArray(fileArr) || fileArr.length === 0) return [];
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 40,
        chunkOverlap: 20,
    });
    // 并行切割所有文档内容
    //会得到一个二维数组，
    //splitResults-[[a文件切割后的结果],[b文件切割后的结果]]
    const splitResults = await Promise.all(
        fileArr.map(async (file) => {
            const chunks = await splitter.splitText(file.content);
            return chunks.map(chunk => ({
                text: chunk,
                path: file.path,
            }));
        })
    );

    // 展平所有文本块，二维平整为一维
    const allChunks = splitResults.flat();

    // 并行将所有文本块转为向量
    const embeddings = await Promise.all(
        allChunks.map(chunk => getEmbeddings(chunk.text))
    );

    // 组装最终结果
    return allChunks.map((chunk, index) => ({
        vector: embeddings[index],
        text: chunk.text,
        path: chunk.path,
    }));
}

/**
 * 将向量结果数组存储到 LanceDB
 * @param {'user'|'current'} type - 存储类型，user 表示用户目录，current 表示当前项目目录
 * @param {Array<{vector: number[], text: string, path: string}>} vectors - 向量结果数组
 */
export async function storeIn(type, vectors) {
    if (!Array.isArray(vectors) || vectors.length === 0) return;
    //根据是user目录下的文档，还是当前项目下的文档，连接到不同位置
    //核心就是当前项目下的存到当前项目下的.front下的langce-db文件夹
    //user下的存到user下的.front下的langce-db文件夹
    let dbPath;
    if (type === 'user') {
        dbPath = path.join(getUserHomeDir(), '.front', 'langcedb-data');
    } else if (type === 'current') {
        dbPath = path.join(getCurrentWorkingDir(), '.front', 'langcedb-data');
    } else {
        throw new Error('type must be "user" or "current"');
    }

    if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(dbPath, { recursive: true });
    }
    //连接路径
    const db = await lancedb.connect(dbPath);
    //获取当前所有table
    const tableNames = await db.tableNames();
    const tableName = 'doc-table';//目标要存的table
    //检测是否table已经存在
    if (tableNames.includes(tableName)) {
        //存在则加入
        const table = await db.openTable(tableName);
        await table.add(vectors, { mode: 'append' });
    } else {
        //不存在则创建
        await db.createTable(tableName, vectors);
    }
}

/**
 * 根据文件名在两个 doc 目录中查找文件，找到后读取、切割、向量化并存储
 * @param {string} fileName - 文件名（可带扩展名）
 */
export async function searchFileAndStoreIn(fileName) {
    const userHomeDir = getUserHomeDir();
    const currentWorkingDir = getCurrentWorkingDir();
    const userDocDir = path.join(userHomeDir, '.front', 'doc');
    const currentDocDir = path.join(currentWorkingDir, '.front', 'doc');

    const targets = [];

    // 在 user 目录下查找
    if (fs.existsSync(userDocDir)) {
        const userFilePath = path.join(userDocDir, fileName);
        if (fs.existsSync(userFilePath)) {
            targets.push({ type: 'user', path: userFilePath });
        }
    }

    // 在当前项目目录下查找
    if (fs.existsSync(currentDocDir)) {
        const currentFilePath = path.join(currentDocDir, fileName);
        if (fs.existsSync(currentFilePath)) {
            targets.push({ type: 'current', path: currentFilePath });
        }
    }

    if (targets.length === 0) return;

    // 读取 -> 切割 -> 向量化 -> 存储
    const fileContents = await readFileContent(targets.map(t => t.path));
    const vectors = await filesToEmbedding(fileContents);

    // 按类型分组存储
    for (const target of targets) {
        const typeVectors = vectors.filter(v => v.path === target.path);
        if (typeVectors.length > 0) {
            await storeIn(target.type, typeVectors);
        }
    }
}

/**
 * 读取所有文档并转为向量后存入 LanceDB
 */
export async function storeAllFilesIn() {
    //获取到user和当前目录下的所有文件
    const { userDocArr, currentDirDocArr } = await getAllRagFile();
    //确认有内容
    if (userDocArr.length > 0) {
        //把user的内容转化为向量，然后存入
        const userVectors = await filesToEmbedding(userDocArr);
        await storeIn('user', userVectors);
    }

    if (currentDirDocArr.length > 0) {

        const currentVectors = await filesToEmbedding(currentDirDocArr);
        await storeIn('current', currentVectors);
    }
}

/**
 * 接收查询字符串，转为向量后在 user 和当前项目目录的 LanceDB 中搜索相似文档
 * @param {string} queryText - 查询文本
 * @returns {Promise<string[]>} 合并后的检索结果文本数组，最多6条
 */
export async function searchLocalVector(queryText) {
    if (!queryText || typeof queryText !== 'string') return [];

    const vector = await getEmbeddings(queryText);
    if (!vector || !Array.isArray(vector)) return [];

    const userDbPath = path.join(getUserHomeDir(), '.front', 'langcedb-data');
    const currentDbPath = path.join(getCurrentWorkingDir(), '.front', 'langcedb-data');

    let userResults = [];
    let currentResults = [];

    // 搜索 user 目录下的 lancedb
    if (fs.existsSync(userDbPath)) {
        const db = await lancedb.connect(userDbPath);
        const tableNames = await db.tableNames();
        if (tableNames.includes('doc-table')) {
            const table = await db.openTable('doc-table');
            userResults = await table.search(vector).limit(3).toArray();
        }
    }

    // 搜索当前项目目录下的 lancedb
    if (fs.existsSync(currentDbPath)) {
        const db = await lancedb.connect(currentDbPath);
        const tableNames = await db.tableNames();
        if (tableNames.includes('doc-table')) {
            const table = await db.openTable('doc-table');
            currentResults = await table.search(vector).limit(3).toArray();
        }
    }

    return [...userResults, ...currentResults].map(r => r.text);
}

