# 编码规范

## 语言规范
- 代码注释使用中文
- Git 提交信息使用中文
- 文档使用中文
- 变量名、函数名、类名使用英文，遵循语言惯例

## 命名约定
- JavaScript/TypeScript: camelCase（变量/函数），PascalCase（类/组件）
- Python: snake_case（变量/函数），PascalCase（类）
- CSS: kebab-case
- 文件名: kebab-case 或语言惯例
- 常量: UPPER_SNAKE_CASE

## 代码组织
- 每个文件只做一件事
- 相关功能放在同一目录
- 公共工具放在 `utils/` 或 `lib/`
- 类型定义放在 `types/`
- 配置文件放在项目根目录

## 错误处理
- 不忽略异常，至少记录日志
- 使用自定义错误类型区分错误类别
- API 返回统一的错误格式
- 前端展示用户友好的错误信息

## 测试要求
- 关键业务逻辑必须有单元测试
- API 接口必须有集成测试
- 测试覆盖率目标: 核心模块 >= 80%
- 测试文件命名: `*.test.ts` 或 `*.spec.ts`

## Git 规范
- 提交信息格式: `<类型>: <描述>`
- 类型: feat(新功能), fix(修复), refactor(重构), docs(文档), test(测试), chore(杂务)
- 每次提交只做一件事
- 提交前确保测试通过
