import fs from 'fs'
import path from 'path'
import os from 'os'

/**
 * 将JSON写入到用户目录下的.front/history文件夹中
 * @param {object} jsonData - 要写入的JSON数据
 */
export function writeHistoryToFrontFile(data) {
    const jsonData = JSON.stringify(data);
    try {
        // 获取用户目录
        const userDir = os.homedir()

        // 构建 .front/history 目录路径
        const frontHistoryDir = path.join(userDir, '.front', 'history')

        // 获取当前项目所在目录的名称作为项目文件夹名
        const projectDir = process.cwd()
        const projectName = path.basename(projectDir)

        // 构建项目具体文件夹路径
        const projectHistoryDir = path.join(frontHistoryDir, projectName)

        // 递归创建目录（如果不存在）
        fs.mkdirSync(projectHistoryDir, { recursive: true })

        // 生成文件名（使用时间戳避免覆盖）
        const timestamp = Date.now()
        const fileName = `${timestamp}.json`
        const filePath = path.join(projectHistoryDir, fileName)

        // 写入JSON文件
        fs.writeFileSync(filePath, jsonData, 'utf-8')

        return filePath
    } catch (error) {
        console.error('写入history文件失败:', error)
        throw error
    }
}
