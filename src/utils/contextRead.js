import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { getNowMemory } from './memoryUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function readSystem() {
    const docPath = path.join(__dirname, '../docs/systemDoc.md');
    let content = fs.readFileSync(docPath, 'utf-8');

    const systemInfo = `${os.type()} ${os.release()} ${os.arch()}`;
    const workPath = process.cwd();

    content = content.replace('${systemInfo}', systemInfo);
    content = content.replace('${workPath}', workPath);

    return content;
}
export function getUserContext() {
    const templatePath = path.join(__dirname, '../docs/userContext.md');
    let content = fs.readFileSync(templatePath, 'utf-8');

    const userFrontPath = path.join(os.homedir(), '.front', '.front.md');
    let userContent = '';
    let userPath = '';
    if (fs.existsSync(userFrontPath)) {
        userPath = userFrontPath;
        userContent = fs.readFileSync(userFrontPath, 'utf-8');
    }

    const projectFrontPath = path.join(process.cwd(), '.front.md');
    let projectContent = '';
    let projectPath = '';
    if (fs.existsSync(projectFrontPath)) {
        projectPath = projectFrontPath;
        projectContent = fs.readFileSync(projectFrontPath, 'utf-8');
    }

    const { projectMemory, userMemory } = getNowMemory();

    content = content.replace(/\${userPath}/g, userPath);
    content = content.replace(/\${userContent}/g, userContent);
    content = content.replace(/\${projectPath}/g, projectPath);
    content = content.replace(/\${projectContent}/g, projectContent);
    content = content.replace(/\${userMemory}/g, userMemory);
    content = content.replace(/\${projectMemory}/g, projectMemory);

    return content;
}

export function readRules() {
    const rulesMap = new Map();

    function parseRuleHeader(content) {
        const rules = [];
        const headerMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
        if (headerMatch) {
            const headerContent = headerMatch[1];
            // 找到 paths: 之后的所有行，直到下一个非缩进的键或结束
            const pathsSectionMatch = headerContent.match(/paths:\s*\n([\s\S]*?)(?=\n\S|$)/);
            if (pathsSectionMatch) {
                const pathsSection = pathsSectionMatch[1];
                // 提取所有以 - 开头的行
                const pathMatches = pathsSection.matchAll(/^\s*-\s*["']?([^"'\n]+)["']?\s*$/gm);
                for (const match of pathMatches) {
                    rules.push(match[1]);
                }
            }
        }
        return rules;
    }

    function loadRulesFromDir(dirPath) {
        if (!fs.existsSync(dirPath)) return;

        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
                const content = fs.readFileSync(filePath, 'utf-8');
                const rules = parseRuleHeader(content);
                rulesMap.set(file, {
                    content: content,
                    rules: rules
                });
            }
        }
    }

    const userRulesDir = path.join(os.homedir(), '.front', 'rules');
    loadRulesFromDir(userRulesDir);

    const projectRulesDir = path.join(process.cwd(), '.front', 'rules');
    loadRulesFromDir(projectRulesDir);

    return rulesMap;
}

export function getSkillHeaders() {
    const skillHeaders = [];

    function parseSkillHeader(content) {
        const headerMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
        if (headerMatch) {
            const headerContent = headerMatch[1].trim();
            // 提取name字段
            const nameMatch = headerContent.match(/name:\s*(\S+)/);
            const name = nameMatch ? nameMatch[1] : '';
            return { header: headerContent, name };
        }
        return null;
    }

    function loadSkillsFromDir(dirPath) {
        if (!fs.existsSync(dirPath)) return;

        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                const skillMdPath = path.join(filePath, 'SKILL.md');
                if (fs.existsSync(skillMdPath)) {
                    const content = fs.readFileSync(skillMdPath, 'utf-8');
                    const result = parseSkillHeader(content);
                    if (result) {
                        const { header, name } = result;
                        skillHeaders.push(`${header}\n\nSkill[${name}]文件地址: ${skillMdPath}`);
                    }
                }
            }
        }
    }

    const userSkillsDir = path.join(os.homedir(), '.front', 'skills');
    loadSkillsFromDir(userSkillsDir);

    const projectSkillsDir = path.join(process.cwd(), '.front', 'skills');
    loadSkillsFromDir(projectSkillsDir);

    const templatePath = path.join(__dirname, '../docs/skillTemplate.md');
    let content = fs.readFileSync(templatePath, 'utf-8');

    content = content.replace('${skillcontent}', skillHeaders.join('\n\n'));

    return content;
}
