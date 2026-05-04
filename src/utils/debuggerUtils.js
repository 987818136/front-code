import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';
import { chromium } from 'playwright';

/**
 * 轮询 CDP 端点的 /json/version,直到返回 200 或超时。
 * 用于确认 spawn 出来的浏览器子进程已经把远程调试端口监听起来。
 *
 * @param {string} cdpEndpoint - 例如 http://localhost:9222
 * @param {number} [timeoutMs=10000]
 * @returns {Promise<boolean>}
 */
function waitForCdpReady(cdpEndpoint, timeoutMs = 10000) {
    const url = `${cdpEndpoint}/json/version`;
    const start = Date.now();
    return new Promise((resolve) => {
        const next = () => {
            if (Date.now() - start >= timeoutMs) return resolve(false);
            setTimeout(tryOnce, 200);
        };
        const tryOnce = () => {
            const req = http.get(url, (res) => {
                res.resume();
                if (res.statusCode === 200) return resolve(true);
                next();
            });
            req.on('error', next);
            req.setTimeout(500, () => {
                req.destroy();
                next();
            });
        };
        tryOnce();
    });
}

/**
 * 连接到已运行的 chromium 浏览器(需开启远程调试端口)，
 * 监听已打开页面的 console 输出，若无错误则截图保存到 .front/screenshot。
 *
 * 前提：浏览器需以 --remote-debugging-port=9222 启动。例如：
 *   Windows: chrome.exe --remote-debugging-port=9222 --user-data-dir=C:\chrome-debug
 *   macOS:   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
 *
 * 注意：只能捕获到连接之后产生的 console；连接之前已打印的内容无法读取。
 * 若需要完整 console，可将 reload 设为 true 让目标页面重新加载。
 *
 * @param {object} [options]
 * @param {string}        [options.cdpEndpoint='http://localhost:9222'] - CDP 端点
 * @param {string|RegExp} [options.urlMatch]                            - 匹配目标 page 的 url；不传则使用最后聚焦的页面
 * @param {boolean}       [options.reload=false]                        - 是否刷新目标页面以捕获完整 console
 * @param {number}        [options.listenDuration=3000]                 - 不刷新时监听 console 的时长(ms)
 * @param {string}        [options.screenshotDir='.front/screenshot']   - 截图保存目录
 * @param {boolean}       [options.fullPage=true]                       - 是否整页截图
 * @returns {Promise<{success: boolean, message: string, errors: string[], logs: string[], screenshotPath: string|null, pageUrl: string|null}>}
 */
export async function captureRunningBrowser(options = {}) {
    // 步骤1: 解析传入参数，未传则使用默认值
    const {
        cdpEndpoint = 'http://localhost:9222',
        urlMatch,
        reload = false,
        listenDuration = 3000,
        screenshotDir = '.front/screenshot',
        fullPage = true,
    } = options;

    // 步骤2: 通过 CDP 连接到已启动的 Chromium 浏览器
    let browser;
    try {
        browser = await chromium.connectOverCDP(cdpEndpoint);
    } catch (err) {
        return {
            success: false,
            message: `无法连接到 chromium: ${err.message}。请确认浏览器已以 --remote-debugging-port=9222 启动。`,
            errors: [err.message],
            logs: [],
            screenshotPath: null,
            pageUrl: null,
        };
    }

    // 步骤3: 获取浏览器中所有已打开的页面
    const pages = browser.contexts().flatMap((ctx) => ctx.pages());
    if (pages.length === 0) {
        await browser.close();
        return {
            success: false,
            message: '未找到任何已打开的页面',
            errors: ['no pages'],
            logs: [],
            screenshotPath: null,
            pageUrl: null,
        };
    }

    // 步骤4: 根据 urlMatch 定位目标页面，未匹配则默认取最后一个页面
    let page = pages[pages.length - 1];
    if (urlMatch) {
        const matched = pages.find((p) =>
            typeof urlMatch === 'string' ? p.url().includes(urlMatch) : urlMatch.test(p.url())
        );
        if (matched) page = matched;
    }

    // 步骤5: 注册 console 和 pageerror 事件监听，收集日志与错误
    const consoleErrors = [];
    const consoleLogs = [];
    const pageErrors = [];

    const onConsole = (msg) => {
        const text = `[${msg.type()}] ${msg.text()}`;
        consoleLogs.push(text);
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    };
    const onPageError = (err) => pageErrors.push(err.message);

    page.on('console', onConsole);
    page.on('pageerror', onPageError);

    // 步骤6: 若 reload 为 true 则刷新页面以捕获完整 console，否则静默监听一段时间
    try {
        if (reload) {
            await page.reload({ waitUntil: 'networkidle' });
        } else {
            await new Promise((resolve) => setTimeout(resolve, listenDuration));
        }
    } finally {
        // 监听结束后移除事件绑定，避免内存泄漏
        page.off('console', onConsole);
        page.off('pageerror', onPageError);
    }

    // 步骤7: 汇总收集到的所有错误（console error + 未捕获异常）
    const pageUrl = page.url();
    const allErrors = [...consoleErrors, ...pageErrors];

    // 步骤8: 若存在错误，关闭浏览器并返回错误结果（不截图）
    if (allErrors.length > 0) {
        await browser.close();
        return {
            success: false,
            message: `页面存在错误:\n${allErrors.join('\n')}`,
            errors: allErrors,
            logs: consoleLogs,
            screenshotPath: null,
            pageUrl,
        };
    }

    // 步骤9: 确保截图保存目录存在
    const absDir = path.resolve(screenshotDir);
    if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true });

    // 步骤10: 生成带时间戳的文件名并执行截图
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(absDir, `screenshot-${ts}.png`);
    await page.screenshot({ path: screenshotPath, fullPage });

    // 步骤11: 关闭浏览器连接
    await browser.close();

    // 步骤12: 返回成功结果，包含截图路径与日志
    return {
        success: true,
        message: `检查通过，无控制台错误。截图已保存至: ${screenshotPath}`,
        errors: [],
        logs: consoleLogs,
        screenshotPath,
        pageUrl,
    };
}

/**
 * 以 detached 子进程方式启动一个开启远程调试端口的 Chromium,并打开指定页面。
 *
 * 与 playwright 的 chromium.launch() 不同,这里用 child_process.spawn + detached + unref(),
 * 让浏览器作为独立进程运行,本函数 await 完即可让调用方进程正常退出,
 * 适合作为一次性指令被调用的场景。后续可由 captureRunningBrowser 通过返回的
 * cdpEndpoint 连接到该浏览器获取 console / 截图。
 *
 * @param {string} url - 要加载的页面地址
 * @param {object} [options]
 * @param {boolean} [options.headless=false]              - 是否无头模式
 * @param {number}  [options.remoteDebuggingPort=9222]    - 远程调试端口
 * @param {string}  [options.userDataDir]                 - 用户数据目录(不传则使用临时目录,避免与本机 Chrome 冲突)
 * @param {string}  [options.executablePath]              - Chromium 可执行文件路径(不传则使用 playwright 内置 chromium)
 * @param {number}  [options.readyTimeout=10000]          - 等待 CDP 端口就绪的超时(ms)
 * @returns {Promise<{success: boolean, message: string, cdpEndpoint: string|null, pid: number|null}>}
 */
export async function launchBrowserForCapture(url, options = {}) {
    const {
        headless = false,
        remoteDebuggingPort = 9222,
        userDataDir,
        executablePath,
        readyTimeout = 10000,
    } = options;

    // 步骤1: 准备 chrome 启动参数
    const args = [
        `--remote-debugging-port=${remoteDebuggingPort}`,
        '--no-first-run',
        '--no-default-browser-check',
    ];
    if (headless) args.push('--headless=new');

    // 步骤2: 处理用户数据目录;未指定则使用临时目录,避免与本机已运行的 Chrome 冲突
    const dataDir = userDataDir
        ? path.resolve(userDataDir)
        : path.join(os.tmpdir(), `chrome-debug-${remoteDebuggingPort}-${Date.now()}`);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    args.push(`--user-data-dir=${dataDir}`);

    if (url) args.push(url);

    // 步骤3: 解析浏览器可执行路径,优先用调用方传入,否则用 playwright 内置 chromium
    const chromePath = executablePath || chromium.executablePath();
    if (!chromePath || !fs.existsSync(chromePath)) {
        return {
            success: false,
            message: `未找到可用的 Chromium 可执行文件: ${chromePath}`,
            cdpEndpoint: null,
            pid: null,
        };
    }

    // 步骤4: 以 detached 子进程启动浏览器,unref() 后本进程不会再被该子进程阻塞
    const child = spawn(chromePath, args, {
        detached: true,
        stdio: 'ignore',
    });
    child.unref();

    // 步骤5: 轮询 CDP 端点,确认浏览器已把远程调试端口监听起来
    const cdpEndpoint = `http://localhost:${remoteDebuggingPort}`;
    const ready = await waitForCdpReady(cdpEndpoint, readyTimeout);
    if (!ready) {
        return {
            success: false,
            message: `浏览器启动后等待 CDP 端口 ${remoteDebuggingPort} 就绪超时(${readyTimeout}ms)`,
            cdpEndpoint,
            pid: child.pid ?? null,
        };
    }

    // 步骤6: 返回结果(不返回 browser/page 对象,使本函数可在指令场景下用完即退)
    return {
        success: true,
        message: `浏览器已启动并打开 ${url || 'about:blank'}`,
        cdpEndpoint,
        pid: child.pid ?? null,
    };
}
//自动打开浏览器，只有这样打开的，才能去获取控制台输出，以及截图。你手动的是不行的
// await launchBrowserForCapture("http://localhost:5173/about");
// console.log(fs.writeFileSync("./record.json", JSON.stringify(await captureRunningBrowser())))