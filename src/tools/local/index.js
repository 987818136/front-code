
import LocalClient from './LocalClient.js';
import skill from './skill.js';
import bash from './bash.js';
import grep from './grep.js';
import read_file from './read_file.js';
import write_file from './write_file.js';
import glob from './glob.js';
import confirm from './confirm.js';
import select from './select.js';
import memory_save from './memory_save.js';
import memory_get from './memory_get.js';
import diff_pic from "./diff_pic.js"
import debugger_page from "./debugger_page.js"
// console.log(await debugger_page.handle({
//     url: "http://localhost:5173/about"
// }))
export default function getLocalTool() {
    const localClient = new LocalClient();
    localClient.registerTool(skill);
    localClient.registerTool(bash);
    localClient.registerTool(grep);
    localClient.registerTool(read_file);
    localClient.registerTool(write_file);
    localClient.registerTool(glob);
    localClient.registerTool(confirm);
    localClient.registerTool(select);
    localClient.registerTool(memory_save);
    localClient.registerTool(memory_get);
    localClient.registerTool(debugger_page);
    localClient.registerTool(diff_pic);


    const localTools = localClient.listTools();
    //遍历localTools形成map映射
    const localMap = {};
    localTools.tools.forEach((tool) => {
        localMap[tool.name] = localClient
    })
    return {
        localTools: localTools.tools,
        localMap
    }
}