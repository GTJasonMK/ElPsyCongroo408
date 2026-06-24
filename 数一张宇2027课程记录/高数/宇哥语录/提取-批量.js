var DONE_MAP_MASTER = {"30讲零基础 二、解析式的概念与运算04.mp4": "0基础通关", "30讲零基础 二、解析式的概念与运算05.mp4": "0基础通关", "30讲零基础基础知识结构01.mp4": "0基础通关", "30讲零基础 六、坐标系及其变换15.mp4": "0基础通关", "30讲零基础 三、方程与不等式06.mp4": "0基础通关", "30讲零基础 三、方程与不等式07.mp4": "0基础通关", "30讲零基础 三、方程与不等式08.mp4": "0基础通关", "30讲零基础 三、方程与不等式09.mp4": "0基础通关", "30讲零基础 四、函数10.mp4": "0基础通关", "30讲零基础 四、函数11.mp4": "0基础通关", "30讲零基础 四、函数12.mp4": "0基础通关", "30讲零基础 四、函数13.mp4": "0基础通关", "30讲零基础 五、数列及其单调性14.mp4": "0基础通关", "30讲零基础 一、基本逻辑02.mp4": "0基础通关", "30讲零基础一、基本逻辑03.mp4": "0基础通关", "基础30讲导学.mp4": "0基础通关", "第1讲 二、函数的图像04.mp4": "高等数学/第一讲", "第1讲 二、函数的图像05.mp4": "高等数学/第一讲", "第1讲 函数极限与连续基础知识结构01.mp4": "高等数学/第一讲", "第1讲 三、函数极限的概念与特性06.mp4": "高等数学/第一讲", "第1讲 三、函数极限的概念与性质07.mp4": "高等数学/第一讲", "第1讲 三、函数极限的概念与性质08.mp4": "高等数学/第一讲", "第1讲 三、函数极限的概念与性质09.mp4": "高等数学/第一讲", "第1讲 三、函数极限的概念与性质10.mp4": "高等数学/第一讲", "第1讲 三、函数极限的概念与性质11.mp4": "高等数学/第一讲", "第1讲 四、计算12.mp4": "高等数学/第一讲", "第1讲 四、计算13.mp4": "高等数学/第一讲", "第1讲 四、计算14.mp4": "高等数学/第一讲", "第1讲 五、函数的连续与间断15.mp4": "高等数学/第一讲", "第1讲 一、函数的概念与特性02.mp4": "高等数学/第一讲", "第1讲 一、函数的概念与特性03.mp4": "高等数学/第一讲", "第2讲 基础内容精讲02.mp4": "高等数学/第二讲", "第2讲 基础内容精讲03.mp4": "高等数学/第二讲", "第2讲 基础内容精讲04.mp4": "高等数学/第二讲", "第2讲 基础内容精讲05.mp4": "高等数学/第二讲", "第2讲 基础内容精讲06.mp4": "高等数学/第二讲", "第2讲 数列极限基础知识结构01.mp4": "高等数学/第二讲", "第3讲 基础内容精讲02.mp4": "高等数学/第三讲", "第3讲 基础内容精讲03.mp4": "高等数学/第三讲", "第3讲 基础内容精讲04.mp4": "高等数学/第三讲", "第3讲 一元函数微分学的概念基础知识结构01.mp4": "高等数学/第三讲", "第4讲 基础内容精讲02.mp4": "高等数学/第四讲", "第4讲 基础内容精讲03.mp4": "高等数学/第四讲", "第4讲 基础内容精讲04.mp4": "高等数学/第四讲", "第4讲 一元函数微分学的计算基础知识结构01.mp4": "高等数学/第四讲", "第5讲 八、作函数图像09.mp4": "高等数学/第五讲", "第5讲 二、单调性与极值的判别03.mp4": "高等数学/第五讲", "第5讲 九、曲率及曲率半径（仅数学一、数学二）10.mp4": "高等数学/第五讲", "第5讲 六、渐近线07.mp4": "高等数学/第五讲", "第5讲 七、最值或取值范围08.mp4": "高等数学/第五讲", "第5讲 三、凹凸性与拐点的概念04.mp4": "高等数学/第五讲", "第5讲 四、凹凸性与拐点的判别05.mp4": "高等数学/第五讲", "第5讲 五、极值点与拐点的重要结论06.mp4": "高等数学/第五讲", "第5讲 一、极值的定义02.mp4": "高等数学/第五讲", "第5讲 一元函数微分学的应用（一）基础知识结构01.mp4": "高等数学/第五讲", "第6讲 二、微分等式05.mp4": "高等数学/第六讲", "第6讲 三、微分不等式06.mp4": "高等数学/第六讲", "第6讲 一元函数微分学的应用（二）基础知识结构01.mp4": "高等数学/第六讲", "第6讲 一、中值定理02.mp4": "高等数学/第六讲", "第6讲 一、中值定理03.mp4": "高等数学/第六讲", "第6讲 一、中值定理04.mp4": "高等数学/第六讲"};

(async function() {
  console.log('=== v9 ===\n');
  var DOWNLOADED = {};
  Object.keys(DONE_MAP_MASTER).forEach(function(k) {
    DOWNLOADED[k] = true;
    DOWNLOADED[k.replace(/\s+/g,' ')] = true;
  });
  var BATCH = 5;
  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
  function clickTab(text) {
    var all = Array.from(document.querySelectorAll('.tab-item'));
    var tab = all.find(function(el) { return (el.innerText||'').trim()===text && el.offsetParent; });
    if (tab) { tab.click(); return true; }
    return false;
  }
  function realClick(el) {
    el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
    el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
    el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  }
  function getTranscript() {
    var el = document.querySelector('.manuscript');
    if (el) return el.innerText.trim();
    el = document.querySelector('.section');
    if (el && el.innerText.length>300) return el.innerText.trim();
    el = document.querySelector('.tab-content');
    if (el) return el.innerText.replace(/^课程总结\s*章节速览\s*课件\s*文稿\s*/,'').replace(/\n{3,}/g,'\n\n').trim();
    return null;
  }
  function cleanTitle(raw) {
    var t = raw.trim().split('\n')[0] || '';
    t = t.replace(/\s*\d{1,2}:\d{2}(:\d{2})?\s*$/,'');
    t = t.replace(/^\d+[.、]\s*/,'');
    return t.replace(/[\/\\:*?"<>|]/g,'_');
  }
  function getTitle() {
    var el = document.querySelector('.record--content--title');
    if (el) return el.innerText.trim().replace(/[\/\\:*?"<>|]/g,'_');
    el = document.querySelector('.learn--tree__content--active section');
    if (el) return cleanTitle(el.innerText);
    return '_未命名_';
  }
  function downloadFile(name, content) {
    return new Promise(function(resolve) {
      var b = new Blob([content],{type:'text/markdown;charset=utf-8'});
      var u = URL.createObjectURL(b);
      var a = document.createElement('a');
      a.href = u; a.download = name; a.style.display='none';
      document.body.appendChild(a); a.click();
      setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(u);b=null;resolve();},2000);
    });
  }
  function isDone(title) {
    if (DOWNLOADED[title]) return true;
    if (DOWNLOADED[title.replace(/\s+/g,' ')]) return true;
    return false;
  }
  function readDirMap() {
    var map = {};
    var chapter = '';
    var sub = document.querySelector('.sub-menu');
    if (!sub) return map;
    Array.from(sub.children).forEach(function(c) {
      if (c.classList.contains('title')) chapter = c.innerText.trim();
      else if (c.classList.contains('learn--tree__sub')) {
        var subChap = '';
        Array.from(c.children).forEach(function(sc) {
          if (sc.classList.contains('title')) subChap = sc.innerText.trim();
          else {
            sc.querySelectorAll('.learn--tree__content').forEach(function(li) {
              var sec = li.querySelector('section.title-name-progress');
              var txt = sec ? sec.innerText.trim() : (li.innerText||'').trim();
              var t = cleanTitle(txt);
              var d = chapter;
              if (subChap) d += '/' + subChap;
              map[t] = d;
            });
          }
        });
      }
    });
    return map;
  }

  clickTab('章节目录');
  await sleep(1500);
  var dirMap = readDirMap();

  var items = document.querySelectorAll('.learn--tree__content');
  var courses = Array.from(items).map(function(li,i) {
    var sec = li.querySelector('section.title-name-progress');
    var txt = sec ? sec.innerText.trim() : (li.innerText||'').trim();
    var t = cleanTitle(txt);
    return { index:i, title:t, dir:dirMap[t]||'未分类' };
  });

  var toDo = courses.filter(function(c) { return !isDone(c.title); });
  console.log('共 ' + courses.length + ' | 已完成: ' + (courses.length-toDo.length) + ' | 待处理: ' + toDo.length + '\n');
  if (!toDo.length) { console.log('全部已完成'); return; }

  var ok=0, fail=0, lastText='';

  for (var i=0; i<toDo.length; i++) {
    var c = toDo[i];
    if (ok && ok%BATCH===0) { console.log('\n--- 暂停3秒 ---\n'); await sleep(3000); }

    clickTab('章节目录');
    await sleep(1200);

    var curItems = document.querySelectorAll('.learn--tree__content');
    if (c.index >= curItems.length) { fail++; continue; }
    var li = curItems[c.index];
    var sec = li.querySelector('section.title-name-progress');
    if (!sec) { fail++; continue; }

    console.log('[' + Object.keys(DOWNLOADED).length + '/' + courses.length + '] ' + c.title + ' [' + c.dir + ']');

    realClick(sec);
    await sleep(3500);

    if (!clickTab('AI助学')) { console.log('  无AI助学'); fail++; continue; }
    await sleep(800);
    if (!clickTab('文稿')) { console.log('  无文稿'); fail++; continue; }
    await sleep(1500);

    var text = getTranscript();
    if (!text) { console.log('  文稿空'); fail++; continue; }
    if (lastText && text.slice(0,80)===lastText.slice(0,80)) { console.log('  重复'); fail++; continue; }
    lastText = text;

    var ft = getTitle();
    var md = '# ' + ft + '\n\n**提取时间**: ' + new Date().toLocaleString('zh-CN') + '\n**视频链接**: ' + location.href + '\n\n---\n\n## 文稿内容\n\n' + text + '\n\n---\n\n*批量自动提取*\n';

    var fn = c.dir.replace(/\//g,'_') + '__' + ft + '.md';
    await downloadFile(fn, md);

    var nt = ft.replace(/\s+/g,' ');
    DOWNLOADED[ft] = true; DOWNLOADED[nt] = true;
    console.log('  已下载: ' + fn + ' (' + text.length + '字)');
    ok++;
    await sleep(800);
  }

  console.log('\n成功: ' + ok + ' | 失败: ' + fail);
})();
