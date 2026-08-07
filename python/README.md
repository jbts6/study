# Python 本地课程

这是一个面向个人学习的本地 Python 课程入口。主线课程来自
[Asabeneh/30-Days-Of-Python](https://github.com/Asabeneh/30-Days-Of-Python)，优先使用仓库中的中文目录，并保留英文内容作为缺失章节的回退。

课程页面支持：

- 30 天章节导航和完成进度保存；
- Markdown 阅读、Python 代码编辑和浏览器内运行；
- `trekhleb/learn-python` 与 `gregmalcolm/python_koans` 补充练习。

## 首次同步

上游源码和生成文件只供本地学习使用，不会进入父仓库：

- `python/upstream/`：本地上游仓库，已被 `.gitignore` 忽略；
- `python/basics-course/generated/`：页面使用的生成课程数据，已被忽略；
- `python/basics-course/legacy/index.html`：原有课程页面的本地备份。

在仓库根目录执行：

```bash
cd python
node basics-course/sync-course.mjs
```

同步脚本会在 `python/upstream/30-Days-Of-Python` 不存在时克隆上游，之后更新上游并生成 `basics-course/generated/lessons.js`。上游目录名、中文目录结构或网络访问发生变化时，脚本会保留已有生成文件并报告错误。

## 启动课程

课程页面需要通过静态服务器打开，不能直接双击 HTML 文件：

```bash
cd python
python -m http.server 8000 --bind 127.0.0.1
```

然后打开：

<http://127.0.0.1:8000/basics-course/>

页面首次运行代码时会从 CDN 加载 Pyodide 0.26.2，因此需要网络访问。课程阅读和进度保存不依赖运行器；如果 CDN 不可用，页面仍会显示课程内容和错误状态。浏览器运行器不访问本机文件，也不会回退到本机 Python。

若页面提示缺少课程数据，先停止静态服务器，在 `python/` 目录重新执行：

```bash
node basics-course/sync-course.mjs
```

再刷新页面。

## 确定性检查

在仓库根目录执行：

```bash
node --check python/basics-course/sync-course.mjs
node --check python/basics-course/app.js
node --check python/basics-course/runner.js
node --check python/basics-course/store.js
node --test python/basics-course/*.test.mjs
```

## 浏览器验收清单

桌面 1440x900：

- 第 1 天可以加载，切换第 15 天和第 30 天；
- Python 代码可以运行并显示输出；
- 标记完成后刷新页面，当前章节和完成进度仍在；
- 编辑代码、切换章节再返回，草稿仍然恢复。

移动 390x844：

- 可以打开和关闭课程目录；
- 可以切换章节，代码区在视口内滚动，不撑破页面；
- 运行按钮保持可点击，输出区不会遮挡正文。

错误状态：

- 临时移走 `basics-course/generated/lessons.js` 后刷新，应显示同步命令；
- 禁止 CDN 请求后刷新，应显示 Python 运行时错误，但课程正文仍可阅读。

