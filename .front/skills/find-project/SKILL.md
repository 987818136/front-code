---
name: find-project
description: 当需要根据需求或者应用名称查找某个应用的时候，阅读此skill
---

# 操作步骤

1. 运行以下bash命令，拉取公司的项目记录文档，文档地址为https://docs.qq.com/doc/DWXR2Sm93dmZVQWFi。
该文档内记录了公司的每一个项目，以及他们的名字，git地址，还有项目的描述。

**注意**
一定不要修改，直接原封不动执行改bash命令

``` bash
curl -X GET 'https://docs.qq.com/openapi/doc/v3/300000000$YtvJowvfUAab' -H 'Access-Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbHQiOiI0ODIwMmNlZGQwMjk0YjU4OTNiY2Q5YzU0NDg5NGUzYiIsInR5cCI6MSwiZXhwIjoxNzc3NTU4OTIyLjkwMjgxNDksImlhdCI6MTc3NDk2NjkyMi45MDI4MTQ5LCJzdWIiOiJiZTNmN2ZhMmZmMzE0NmExOTljOGI5YzcyOThkMjc5NyJ9.d3nne5-6xhU0SIbFYqTuPcUkrO4gYLuscZrVADDC47g' -H 'Client-Id: 48202cedd0294b5893bcd9c544894e3b' -H 'Open-Id: be3f7fa2ff3146a199c8b9c7298d2797'
```

2. 拉取到文档内容，根据用户提问，判断哪个项目符合用户的要求，如果有多个项目符合用户要求，则让用户选择一个，并且给出项目文档地址。如果只要明确地一个项目符合要求，直接进行下一步

3. 当确认项目后，如果没有明确项目存放文件夹，询问用户项目通常存放在哪个文件夹。直到获得明确地项目存放文件夹在进行下一步

4. 当第三步完成，根据第三步提供的文件夹，查找文件夹里面是否已经存在和项目同名的文件夹，如果已经存在，则用vscode打开项目
 
5. 如果没有，则通过git clone 指令，去clone下来项目，项目的地址，在文档内容里有说明，注意，git地址为https地址。如果失败，给出地址，让用户手动git clone。不要自己去重试或者查找原因

6. 当项目打开，扫描项目一级目录下是否有readme.md文件。如果有，则结束。没有则把从文档上获取的项目相关信息，写入为readme.md

 