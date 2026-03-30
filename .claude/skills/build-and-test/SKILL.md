---
name: build-and-test
description: 构建项目并运行测试，报告结果
user-invocable: true
allowed-tools: Bash, Read, Grep
context: fork
---

# 构建与测试

构建当前项目并运行所有测试，报告执行结果。

## 步骤

1. 检测项目类型和构建工具：

```bash
ls package.json Makefile Cargo.toml go.mod pom.xml build.gradle pyproject.toml 2>/dev/null
```

2. 根据检测结果执行对应的构建和测试命令：

- **Node.js** (package.json): `npm install && npm test`
- **Python** (pyproject.toml): `pip install -e . && pytest`
- **Go** (go.mod): `go build ./... && go test ./...`
- **Rust** (Cargo.toml): `cargo build && cargo test`
- **Java/Gradle** (build.gradle): `./gradlew build test`
- **Java/Maven** (pom.xml): `mvn compile test`
- **Make** (Makefile): `make && make test`

3. 收集测试结果，生成中文报告：

```markdown
## 构建与测试报告

### 构建状态
[成功 / 失败]

### 测试结果
- 通过: X 个
- 失败: X 个
- 跳过: X 个

### 失败详情
[如有失败，列出详细信息]

### 建议
[改进建议]
```

当前 Git 状态：
```
!`git status --short 2>/dev/null || echo "非 Git 仓库"`
```
