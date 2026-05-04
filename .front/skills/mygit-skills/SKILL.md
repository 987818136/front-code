---
name: mygit-skills
description: 当用户让你进行git提交的时候，一定要遵循此skill的规则
---

# 操作步骤
1. 通过git add .把所有的文件加入暂存区。
2. 如果缓冲区有还有文件，继续执行第一步。当缓冲区没有文件时， 执行git commit -m"理由"。
**关于理由** 理由一定是fix/feat/debugger: 文本。fix为bug修复，feat为新增功能，debugger为调试。文本通过扫描用户的提交内容，自动生成

3. git commit 成功后，通过git push origin 分支名推送到远端。分支名，检查用户当前所在分支确认，如果所在分支不是main或者master，则直接把当前所在作为远端推送分支。
 
4. 前三步都完成后，把本次提交的理由，按一定格式写入到当前项目一级目录下的readme.md.具体格式为**YYYY:MM:DD HH:mm 用户名：提交理由**