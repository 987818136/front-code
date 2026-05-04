import chalk from 'chalk';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';

// 配置 marked 使用终端渲染器
marked.setOptions({
    renderer: new TerminalRenderer({
        // 自定义颜色样式
        code: chalk.yellow,
        codespan: chalk.yellowBright,
        heading: chalk.bold.cyan,
        firstHeading: chalk.bold.magenta.underline,
        strong: chalk.bold,
        em: chalk.italic,
        del: chalk.strikethrough,
        link: chalk.blue.underline,
        href: chalk.blue.underline,
        blockquote: chalk.gray,
        html: chalk.gray,
        list: chalk.white,
        listitem: chalk.white,
        table: chalk.white,
        paragraph: chalk.white,
        // 自定义表格样式
        tableOptions: {
            chars: {
                'top': '═',
                'top-mid': '╤',
                'top-left': '╔',
                'top-right': '╗',
                'bottom': '═',
                'bottom-mid': '╧',
                'bottom-left': '╚',
                'bottom-right': '╝',
                'left': '║',
                'left-mid': '╟',
                'mid': '─',
                'mid-mid': '┼',
                'right': '║',
                'right-mid': '╢',
                'middle': '│'
            }
        }
    })
});

export default {
    log(text, color) {
        const selectedColor = color || 'white';
        if (chalk[selectedColor]) {
            console.log(chalk[selectedColor](text));
        } else {
            console.log(chalk.white(text));
        }
    },

    /**
     * 渲染并输出 markdown 格式的文本
     * @param {string} markdownText - markdown 格式的文本
     */
    logMarkdown(markdownText) {
        if (!markdownText) return;
        console.log(marked.parse(markdownText));
    }
}