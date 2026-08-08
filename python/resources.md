# Python 机器学习完整学习资料清单

> 配合 `python-ai-ml-roadmap.md` 使用。按路线图 4 阶段组织，每份资料标注类型、费用、难度与推荐理由。
> 标注 [前端友好] 的资源对有 JS 背景的学习者更易上手。

---

## 环境与工具（开始前必装）

| 资源 | 类型 | 费用 | 说明 |
|------|------|------|------|
| Miniconda | 环境管理 | 免费 | Python 环境隔离，比 Anaconda 轻量。每个项目用独立环境，避免包冲突 |
| VS Code + Python 插件 | 编辑器 | 免费 | 你已熟悉，装 Python + Pylance + Jupyter 插件即可 |
| Jupyter Notebook | 交互环境 | 免费 | 数据科学标配，逐单元格运行，即时看结果。对标前端的浏览器控制台 |
| Google Colab | 云端环境 | 免费（含 GPU） | 无需本地配置，直接跑 notebook。深度学习阶段免装 GPU，最省事的起步方式 [前端友好] |

---

## 阶段 1 · Python 语法基础（Day 1-15）

### 主线教材

| 资源 | 类型 | 费用 | 难度 | 推荐理由 |
|------|------|------|------|----------|
| 《Python编程：从入门到实践》(Python Crash Course) | 书 | 付费 | 入门 | 最经典的 Python 入门书，前半语法后半三个实战项目。Eric Matthes 著，中文版人民邮电出版社 |
| Automate the Boring Stuff with Python | 书/网站 | 免费在线 | 入门 | 实战驱动，直接用 Python 解决办公自动化。automatetheboringstuff.com [前端友好] |
| 廖雪峰 Python 教程 | 网站 | 免费 | 入门 | 中文免费教程，简洁实用。liaoxuefeng.com，适合快速过语法 |

### 辅助练习

| 资源 | 类型 | 费用 | 用途 |
|------|------|------|------|
| LeetCode（Python Easy） | 题库 | 免费 | 用 Python 刷简单题，练语法手感 |
| Python 官方文档 Tutorial | 文档 | 免费 | docs.python.org，权威速查 |

### 阶段 1 前端类比速查

| Python 概念 | 前端对应 | 关键差异 |
|-------------|---------|---------|
| 缩进 | 花括号 {} | 缩进即作用域，缩进错直接报错 |
| list | Array | Python list 可混合类型，但数值计算用 numpy |
| dict | Object / Map | Python dict 有序（3.7+），键必须是不可变类型 |
| 列表推导式 | Array.map+filter | `[x*2 for x in arr if x>0]` 一行搞定 |
| 虚拟环境 venv | node_modules | 每个项目独立环境，避免全局污染 |

---

## 阶段 2 · 数据科学栈 + 数学基础（Day 17-60）

### 数据科学库

| 资源 | 类型 | 费用 | 难度 | 推荐理由 |
|------|------|------|------|----------|
| Kaggle Learn | 免费微课 | 免费 | 入门 | kaggle.com/learn，每个微课 4-5 小时，涵盖 Python/Pandas/ML。交互式，边学边练 [前端友好] |
| 《Python数据科学手册》| 书/网站 | 免费在线 | 中级 | Jake VanderPlas 著，numpy/pandas/matplotlib/sklearn 一本通。jakevdp.github.io/PythonDataScienceHandbook |
| pandas 官方文档 | 文档 | 免费 | - | pandas.pydata.org，重点看 "10 Minutes to pandas" 和 Cookbook |
| numpy 官方文档 | 文档 | 免费 | - | numpy.org，重点看 "NumPy for absolute beginners" |

### 数学基础（前端最大瓶颈，务必重视）

| 资源 | 类型 | 费用 | 难度 | 推荐理由 |
|------|------|------|------|----------|
| 3Blue1Brown · 线性代数的本质 | 视频 | 免费 | 入门 | YouTube/Bilibili 搜索。可视化讲解向量/矩阵/特征值，建立直觉而非死记公式。强烈推荐，最适合视觉型学习者 [前端友好] |
| 3Blue1Brown · 微积分的本质 | 视频 | 免费 | 入门 | 同上系列，讲导数/链式法则，为理解梯度下降打基础 [前端友好] |
| 3Blue1Brown · 神经网络 | 视频 | 免费 | 入门 | 可视化讲神经网络如何工作，阶段 3 前必看 [前端友好] |
| 可汗学院 (Khan Academy) | 网站 | 免费 | 入门 | 中学/大学数学补课，哪个知识点不懂就查哪个。zh.khanacademy.org |
| 《统计学习方法》李航 | 书 | 付费 | 中级 | 经典 ML 数学基础，阶段 3 配合西瓜书使用。理论较深，选读 |

### 阶段 2 里程碑资源

- Kaggle Titanic 数据集（kaggle.com/c/titanic）—— 完成你的第一份 EDA 报告

---

## 阶段 3 · 经典 ML + 深度学习（Day 62-120）

### 经典机器学习（sklearn）

| 资源 | 类型 | 费用 | 难度 | 推荐理由 |
|------|------|------|------|----------|
| 《机器学习》周志华（西瓜书） | 书 | 付费 | 中级 | 中文 ML 经典教材，概念体系完整。清华大学出版社。理论偏多，配合实践看 |
| scikit-learn 官方文档 | 文档 | 免费 | - | scikit-learn.org，含大量示例和用户指南，最好的 ML 实战参考 |
| Kaggle Learn · Intermediate ML | 微课 | 免费 | 中级 | kaggle.com/learn，讲特征工程/交叉验证/调参，直接对标实战 |

### 深度学习（PyTorch）

| 资源 | 类型 | 费用 | 难度 | 推荐理由 |
|------|------|------|------|----------|
| 《动手学深度学习》(d2l.ai) | 书/网站 | 免费在线 | 中级 | 李沐著，PyTorch 版。中文免费，zh.d2l.ai。理论+代码+可运行 notebook，业界公认最佳入门 [强烈推荐] |
| PyTorch 官方教程 | 文档 | 免费 | 中级 | pytorch.org/tutorials，从 60 分钟入门到各类模型，官方出品 |
| fast.ai 课程 | 视频 | 免费 | 中级 | course.fast.ai，顶级实战课，自顶向下教学法，先跑通模型再讲原理 [前端友好] |
| 《深度学习》(Deep Learning) | 书 | 付费 | 高级 | Ian Goodfellow 著，理论圣经。选读，阶段 3 不必通读 |

### 阶段 3 里程碑资源

- Kaggle 房价预测（kaggle.com/c/house-prices-advanced-regression-techniques）—— 回归实战
- MNIST 手写数字（PyTorch 官方教程自带）—— 你的第一个神经网络

---

## 阶段 4 · 项目实战（Day 122-140）

| 资源 | 类型 | 费用 | 用途 |
|------|------|------|------|
| Kaggle 竞赛 | 平台 | 免费 | 真实数据集+排行榜，选一个入门赛做端到端项目 |
| UCI ML Repository | 数据集 | 免费 | archive.ics.uci.edu，经典数据集库 |
| HuggingFace 课程 | 网站 | 免费 | huggingface.co/learn，NLP/Transformer 进阶，想做 LLM 方向必看 |
| Papers With Code | 网站 | 免费 | paperswithcode.com，论文+复现代码，进阶研究用 |

---

## 进阶方向（路线图完成后选学）

| 方向 | 资源 | 说明 |
|------|------|------|
| LLM / 大模型应用 | HuggingFace Transformers | huggingface.co/learn/natural-language-processing-course |
| 计算机视觉 | PyTorch torchvision + 《动手学深度学习》CV 章节 | 图像分类/检测 |
| 模型部署 | FastAPI 官方文档 + 《机器学习工程》(ML Engineering) | 把模型变成 API，你的前端背景在这里是优势 |
| MLOps | MLflow / DVC | 模型版本管理与流水线 |

---

## 资源使用建议

1. **主线 + 辅助**：每个阶段选 1 本主线教材通读，其余作为查阅参考，不要全买全看
2. **免费优先**：Kaggle Learn + d2l.ai + 3Blue1Brown 三套免费资源已覆盖 80% 内容，付费书按需补
3. **视频 vs 文字**：数学概念看视频（3Blue1Brown），代码操作看文字+notebook，效率最高
4. **Colab 起步**：深度学习阶段先用 Google Colab 跑通，别急着配本地 GPU 环境
5. **中文 vs 英文**：概念理解优先中文（廖雪峰/西瓜书/d2l.ai 中文版），查 API 用英文官方文档

---

## 资源费用汇总

| 类别 | 免费资源 | 付费资源（按需） |
|------|---------|-----------------|
| Python 入门 | Automate the Boring Stuff / 廖雪峰 / Kaggle Learn | 《Python Crash Course》|
| 数据科学 | 《Python数据科学手册》在线版 / pandas+numpy 文档 | - |
| 数学基础 | 3Blue1Brown / 可汗学院 | 《统计学习方法》|
| 经典 ML | scikit-learn 文档 / Kaggle Learn | 《机器学习》周志华 |
| 深度学习 | d2l.ai / PyTorch 教程 / fast.ai | 《深度学习》Goodfellow（选读）|

> 全程用免费资源完全走得通，付费书是锦上添花。
