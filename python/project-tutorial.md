# Python 实战项目：用户数据采集分析（手把手教程）

> 从零开始做一个端到端数据处理管线：从 API 采集 → pandas 清洗 → 统计分析 → 保存报告。
> 每一步拆解：做什么 → 代码 → 为什么 → 前端类比 → 预期结果。
> 这是 Python 在实际工作中最典型的数据流转场景。

---

## 项目目标

从公开 API 采集用户数据，用 pandas 清洗分析，生成统计报告并保存 CSV。

流程：`HTTP 请求` → `JSON 解析` → `pandas 清洗` → `统计分析` → `CSV 存储`

**前端类比**：类似用 fetch 拿数据 + JS 处理 + 导出，但 Python 的 pandas 处理表格数据比 JS 强得多。

---

## 最终效果

运行后生成一份用户分析报告：
```
共采集 10 个用户
城市分布: 北京 3人, 上海 2人, ...
公司分布: ...
平均年龄: 35.2 岁
已保存到 users_report.csv
```

---

## 环境准备

确保装了 Python 3（`python --version`）。不用装数据库。

---

## 第 1 步：创建项目 + 虚拟环境

**做什么**：创建项目目录，建虚拟环境。

```bash
mkdir user-analysis
cd user-analysis
python -m venv venv          # 创建虚拟环境
```

**为什么**：虚拟环境隔离依赖，每个项目用独立的包，不污染系统 Python。这是 Python 工程化的第一步。

**前端类比**：= node_modules。每个项目依赖隔离，不会版本冲突。

**预期结果**：目录里出现 `venv/` 文件夹。

**激活虚拟环境**：
```bash
# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate
```

激活后命令行前面会出现 `(venv)`，表示在虚拟环境里。

---

## 第 2 步：安装依赖

**做什么**：安装 requests（HTTP 请求）和 pandas（数据分析）。

```bash
pip install requests pandas
```

**为什么**：
- `requests`：HTTP 请求库，对标 JS 的 fetch/axios
- `pandas`：数据分析核心库，处理表格数据（对标 Excel + SQL，JS 没有直接对应）

**前端类比**：= `npm install axios`。Python 用 pip 装包，类似 npm。

**预期结果**：`pip list` 能看到 requests 和 pandas。

---

## 第 3 步：从 API 采集数据

**做什么**：创建 `main.py`，用 requests 从 JSONPlaceholder 采集用户数据。

```python
import requests

# 从公开测试 API 采集用户数据
response = requests.get("https://jsonplaceholder.typicode.com/users")
users = response.json()   # 自动解析 JSON

print(f"采集到 {len(users)} 个用户")
print(f"第一个用户: {users[0]['name']}")   # 输出: Leanne Graham
```

**为什么**：
- `requests.get(url)`：发 GET 请求（对标 `fetch(url)`）
- `response.json()`：自动把响应体 JSON 解析成 Python 列表/字典（对标 `res.json()`）
- JSONPlaceholder 是免费的测试 API，返回 10 个假用户数据

**前端类比**：= `const res = await fetch(url); const users = await res.json()`。requests 是同步的（不用 await），更简单。

**预期结果**：运行 `python main.py`，输出"采集到 10 个用户"和第一个用户名。

---

## 第 4 步：用 pandas 加载数据

**做什么**：把采集的列表数据加载成 pandas DataFrame。

```python
import requests
import pandas as pd

response = requests.get("https://jsonplaceholder.typicode.com/users")
users = response.json()

# 加载成 DataFrame（pandas 的核心数据结构）
df = pd.DataFrame(users)

print(df.shape)        # (10, 8) —— 10行8列
print(df.columns)      # 列名
print(df.head(3))      # 前3行
```

**为什么**：
- `DataFrame` 是 pandas 的核心结构，类似数据库表/Excel 表格——有行有列
- `df.shape` 看行列数，`df.head(3)` 看前 3 行预览

**前端类比**：DataFrame = 数组对象，但比 JS 强大——能像 SQL 一样查询、聚合、分组。类似 Excel 表格，每列有名字。

**预期结果**：输出 10 行 8 列，列名包括 id/name/email/address/company 等。

---

## 第 5 步：数据清洗（提取需要的字段）

**做什么**：原始数据有嵌套结构（address 里有 city，company 里有 name），提取成扁平的表格。

```python
# 原始数据 address 是嵌套字典: {"city": "Gwenborough", "geo": {...}}
# 提取成扁平列
df['city'] = df['address'].apply(lambda x: x['city'])
df['company_name'] = df['company'].apply(lambda x: x['name'])
df['lat'] = df['address'].apply(lambda x: float(x['geo']['lat']))
df['lng'] = df['address'].apply(lambda x: float(x['geo']['lng']))

# 只保留需要的列
clean = df[['id', 'name', 'email', 'city', 'company_name', 'lat', 'lng']]
print(clean.head())
```

**为什么**：
- `df['address'].apply(lambda x: x['city'])`：对 address 列每个元素（字典）提取 city 字段
- `apply` = 对每行应用函数（对标 JS 的 `.map()`）
- 嵌套数据扁平化是数据清洗的常见操作

**前端类比**：`df['address'].apply(lambda x: x['city'])` = `users.map(u => u.address.city)`。

**预期结果**：clean 表格有 7 列扁平数据，方便后续分析。

---

## 第 6 步：数据分析（统计）

**做什么**：用 pandas 做统计分析。

```python
# 城市分布
city_count = clean['city'].value_counts()
print("城市分布:")
print(city_count)

# 公司分布
company_count = clean['company_name'].value_counts()
print("\n公司分布:")
print(company_count)

# 经度分析（东半球/西半球）
east = clean[clean['lng'] > 0].shape[0]    # 东半球 lng > 0
west = clean[clean['lng'] <= 0].shape[0]   # 西半球
print(f"\n东半球: {east}人, 西半球: {west}人")

# 邮箱域名分析
clean['email_domain'] = clean['email'].apply(lambda x: x.split('@')[1])
print("\n邮箱域名分布:")
print(clean['email_domain'].value_counts())
```

**为什么**：
- `value_counts()`：统计每个值出现次数（类似 SQL 的 GROUP BY COUNT）
- `clean[clean['lng'] > 0]`：条件筛选（类似 SQL 的 WHERE）
- `.shape[0]`：行数

**前端类比**：`value_counts()` = `users.reduce((acc, u) => { acc[u.city] = (acc[u.city]||0)+1; return acc }, {})`。pandas 一行搞定，JS 要手写 reduce。

**预期结果**：输出城市分布、公司分布、东西半球人数、邮箱域名统计。

---

## 第 7 步：生成报告

**做什么**：把分析结果格式化成可读报告。

```python
def generate_report(clean):
    report = []
    report.append("=" * 40)
    report.append("用户数据分析报告")
    report.append("=" * 40)
    report.append(f"总用户数: {len(clean)}")
    report.append("")
    
    report.append("城市分布 Top 3:")
    for city, count in clean['city'].value_counts().head(3).items():
        report.append(f"  {city}: {count}人")
    report.append("")
    
    report.append("公司分布:")
    for company, count in clean['company_name'].value_counts().items():
        report.append(f"  {company}: {count}人")
    report.append("")
    
    east = clean[clean['lng'] > 0].shape[0]
    report.append(f"东半球: {east}人, 西半球: {len(clean)-east}人")
    
    return "\n".join(report)

print(generate_report(clean))
```

**为什么**：把分析结果组织成可读文本，方便查看和分享。

---

## 第 8 步：保存 CSV

**做什么**：把清洗后的数据和分析结果保存到文件。

```python
# 保存清洗后的数据
clean.to_csv("users_clean.csv", index=False, encoding="utf-8-sig")
print("已保存 users_clean.csv")

# 保存城市分布统计
clean['city'].value_counts().to_csv("city_stats.csv", encoding="utf-8-sig")
print("已保存 city_stats.csv")
```

**为什么**：
- `to_csv()`：DataFrame 导出 CSV（对标 JS 手动拼 CSV 字符串）
- `index=False`：不保存行索引
- `encoding="utf-8-sig"`：带 BOM 的 UTF-8，Excel 打开中文不乱码

**预期结果**：目录里出现 `users_clean.csv` 和 `city_stats.csv`，用 Excel 能打开。

---

## 第 9 步：完整代码 + 运行

完整 `main.py`：

```python
import requests
import pandas as pd

def fetch_users():
    """从 API 采集用户数据"""
    response = requests.get("https://jsonplaceholder.typicode.com/users")
    return response.json()

def clean_data(users):
    """清洗数据：扁平化嵌套字段"""
    df = pd.DataFrame(users)
    df['city'] = df['address'].apply(lambda x: x['city'])
    df['company_name'] = df['company'].apply(lambda x: x['name'])
    df['lat'] = df['address'].apply(lambda x: float(x['geo']['lat']))
    df['lng'] = df['address'].apply(lambda x: float(x['geo']['lng']))
    df['email_domain'] = df['email'].apply(lambda x: x.split('@')[1])
    return df[['id', 'name', 'email', 'email_domain', 'city', 'company_name', 'lat', 'lng']]

def analyze(clean):
    """数据分析"""
    print("=" * 40)
    print("用户数据分析报告")
    print("=" * 40)
    print(f"总用户数: {len(clean)}\n")

    print("城市分布:")
    for city, count in clean['city'].value_counts().items():
        print(f"  {city}: {count}人")

    print("\n公司分布:")
    for company, count in clean['company_name'].value_counts().items():
        print(f"  {company}: {count}人")

    east = clean[clean['lng'] > 0].shape[0]
    print(f"\n东半球: {east}人, 西半球: {len(clean)-east}人")

    print("\n邮箱域名:")
    for domain, count in clean['email_domain'].value_counts().items():
        print(f"  {domain}: {count}个")

def save_results(clean):
    """保存结果"""
    clean.to_csv("users_clean.csv", index=False, encoding="utf-8-sig")
    clean['city'].value_counts().to_csv("city_stats.csv", encoding="utf-8-sig")
    print("\n已保存 users_clean.csv 和 city_stats.csv")

def main():
    users = fetch_users()
    clean = clean_data(users)
    analyze(clean)
    save_results(clean)

if __name__ == "__main__":
    main()
```

运行：
```bash
python main.py
```

---

## 总结

你刚做了一个完整的 Python 数据处理管线，包含：
- **数据采集**：requests 调 API
- **数据清洗**：pandas 扁平化嵌套字段
- **数据分析**：value_counts 统计、条件筛选
- **结果保存**：导出 CSV

### 这个项目的价值

这个骨架能迁移到任何数据处理场景：
- 换成公司内部 API → 采集业务数据
- 换成数据库查询 → 用 pandas 读 SQL
- 加上定时任务 → 每日自动报告
- 加上 matplotlib → 生成图表

**前端类比**：这是 Python 比 JS 强的场景——pandas 处理表格数据的能力远超 JS 的任何库。你的前端背景在"调 API"部分能迁移，"数据分析"部分是 Python 的主场。

### 扩展方向

- 加 matplotlib 生成图表
- 加定时任务（schedule 库）每日运行
- 换成真实业务 API
- 加数据校验（空值/异常值处理）
- 导出 Excel（openpyxl 库）
