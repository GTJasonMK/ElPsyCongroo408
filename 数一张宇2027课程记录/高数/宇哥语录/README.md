# 启航教育视频文稿提取工具

## 使用方法

### 方法1：浏览器控制台运行（推荐）

1. 在视频页面按 `Ctrl+Shift+I` 或 `F12` 打开开发者工具
2. 切换到 Console（控制台）标签
3. 复制下面的代码并粘贴到控制台，按回车运行：

```javascript
(function(){const e=document.querySelector('[class*="transcript"], [class*="subtitle"], [class*="讲义"], [class*="文稿"]')||Array.from(document.querySelectorAll("div, section, article")).filter(t=>t.innerText&&t.innerText.length>500&&t.innerText.length<5e4).sort((t,n)=>n.innerText.length-t.innerText.length)[0];if(!e)return void console.error("❌ 未找到文稿内容");const t=e.innerText.trim(),n=(document.querySelector("h1, .video-title")||{innerText:document.title.split("-")[0]}).innerText.trim().replace(/[\/\\:*?"<>|]/g,"_"),o=`# ${n}\n\n提取时间：${new Date().toLocaleString("zh-CN")}\n视频链接：${window.location.href}\n\n---\n\n${t}\n\n---\n`,r=new Blob([o],{type:"text/markdown;charset=utf-8"}),c=URL.createObjectURL(r),i=document.createElement("a");i.href=c,i.download=`${n}.md`,i.style.display="none",document.body.appendChild(i),i.click(),document.body.removeChild(i),URL.revokeObjectURL(c),console.log(`✓ 文件已下载：${n}.md`),console.log("✓ 请将文件移动到：/home/fufu/Documents/ElPsyCongroo408/数一张宇2027课程记录/高数/零基础通关/宇哥课上语录"),navigator.clipboard.writeText(o).then(()=>console.log("✓ 内容已复制到剪贴板")).catch(()=>console.log("× 复制失败"))})();
```

4. 文件会自动下载到浏览器的默认下载文件夹
5. 将下载的文件移动到当前目录即可

### 方法2：书签工具（一键提取）

1. 新建一个浏览器书签
2. 名称设为：`提取文稿`
3. 网址填入以下内容（完整复制）：

```
javascript:(function(){const e=document.querySelector('[class*="transcript"], [class*="subtitle"], [class*="讲义"], [class*="文稿"]')||Array.from(document.querySelectorAll("div, section, article")).filter(t=>t.innerText&&t.innerText.length>500&&t.innerText.length<5e4).sort((t,n)=>n.innerText.length-t.innerText.length)[0];if(!e)return void alert("未找到文稿内容");const t=e.innerText.trim(),n=(document.querySelector("h1, .video-title")||{innerText:document.title.split("-")[0]}).innerText.trim().replace(/[\/\\:*?"<>|]/g,"_"),o=`# ${n}\n\n提取时间：${new Date().toLocaleString("zh-CN")}\n视频链接：${window.location.href}\n\n---\n\n${t}\n`,r=new Blob([o],{type:"text/markdown;charset=utf-8"}),c=URL.createObjectURL(r),i=document.createElement("a");i.href=c,i.download=`${n}.md`,document.body.appendChild(i),i.click(),document.body.removeChild(i),URL.revokeObjectURL(c),alert("文件已下载："+n+".md")})();
```

4. 以后在视频页面直接点击这个书签即可一键提取

### 方法3：自动保存脚本（需要浏览器扩展）

如果想要自动保存到指定目录，需要安装浏览器扩展如 Tampermonkey，然后运行自定义脚本。

## 文件组织

所有提取的文稿将保存在此目录下，按视频标题命名为 `.md` 文件。

## 注意事项

- 如果页面禁用了 F12，尝试在其他标签页打开控制台后切换回来
- 浏览器下载的文件默认在 `~/Downloads` 目录，需要手动移动到此处
- 提取的内容会同时复制到剪贴板（如果页面有焦点）
