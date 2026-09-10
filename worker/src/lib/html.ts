// /join 与 /admin 是 Worker 自己服务端渲染的 HTML（不是 Astro 页面，见 CLAUDE.md 架构备忘），
// 所以拿不到 Astro 站编译出的 global.css（它的 @fontsource 导入需要 Vite 处理，
// 静态 Worker 页面没有构建步骤）。这里手抄一份最核心的设计令牌 + 系统字体兜底，
// 做到"看起来是同一份刊物"，但不追求跟公开站字体像素级一致——这是有意的简化，
// 换取 Worker 端零构建依赖。真要做到完全一致，需要把 global.css 拆出一份不含
// 自托管字体的纯变量版本，两边都能引用；目前规模下没必要。
const BASE_STYLE = `
:root{
  --paper:#F9F7F1; --paper-panel:#FDFCFA; --ink:#14170E; --ink-meta:rgba(20,23,14,.70);
  --accent-deep:oklch(.21 .05 158); --accent-bright:oklch(.80 .11 152); --rule:oklch(.36 .075 152 / .22);
  --on-deep:#F0F4EB; --on-deep-meta:rgba(240,244,235,.68);
  --mono:ui-monospace,'SFMono-Regular',Consolas,monospace;
  --serif:Georgia,'Noto Serif SC',serif;
}
*{box-sizing:border-box;}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--serif);font-weight:300;}
a{color:var(--accent-deep);}
.shell{max-width:720px;margin:0 auto;padding:40px 24px 80px;}
.masthead{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid var(--accent-deep);padding-bottom:14px;margin-bottom:24px;}
.masthead h1{font-size:26px;font-weight:400;margin:0;}
.masthead span{font-family:var(--mono);font-size:10px;color:var(--ink-meta);}
.panel{background:var(--accent-deep);color:var(--on-deep);padding:20px 24px;margin-bottom:20px;}
.panel a{color:var(--accent-bright);}
form{display:flex;flex-direction:column;gap:12px;max-width:360px;}
label{display:flex;flex-direction:column;gap:6px;font-family:var(--mono);font-size:10.5px;color:var(--ink-meta);}
input,textarea{font-family:var(--serif);font-size:14px;padding:8px 10px;border:1px solid var(--rule);background:var(--paper-panel);color:var(--ink);}
button{align-self:flex-start;padding:8px 16px;background:var(--accent-deep);color:var(--on-deep);border:0;font-family:var(--mono);font-size:11px;cursor:pointer;}
table{border-collapse:collapse;width:100%;font-family:var(--mono);font-size:12px;}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--rule);}
th{font-size:9.5px;text-transform:uppercase;color:var(--ink-meta);}
.stat-row{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:24px;}
.stat{padding:14px 18px;border:1px solid var(--rule);min-width:110px;}
.stat b{display:block;font-size:26px;font-weight:300;font-family:var(--serif);}
.stat span{font-family:var(--mono);font-size:9.5px;color:var(--ink-meta);}
.badge{display:inline-block;padding:1px 7px;border:1px solid var(--rule);font-family:var(--mono);font-size:10px;}
`;

export function renderPage(title: string, bodyHtml: string, opts: { admin?: boolean } = {}): Response {
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${escapeHtml(title)}</title>
<style>${BASE_STYLE}${
    opts.admin
      ? // 深色主题不能只换背景色：--ink-meta/--rule 这两个变量本来是给浅色纸准备的深色值，
        // 标签文字、表头、统计数字下面那行小字、普通链接全都读这两个变量，
        // 不重新定义的话在黑底上要么看不清、要么直接看不见。
        `:root{--ink-meta:rgba(236,238,232,.68);--rule:rgba(236,238,232,.14);}
body{background:#0e0f0d;color:#ECEEE8;}
a{color:var(--accent-bright);}
.panel{background:#131412;}
input,textarea{background:#171815;color:#ECEEE8;border-color:rgba(236,238,232,.22);}
th,td{border-color:rgba(236,238,232,.14);}`
      : ''
  }</style>
</head>
<body>
<div class="shell">${bodyHtml}</div>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
