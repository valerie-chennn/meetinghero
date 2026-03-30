/**
 * Azure OpenAI 服务封装
 * 提供与 Azure OpenAI API 交互的核心方法
 */

const https = require('https');
const http = require('http');

/**
 * 解析 OpenAI 返回内容中的 JSON
 * 处理可能被 markdown code block 包裹的情况
 * @param {string} content - OpenAI 返回的原始文本
 * @returns {object} 解析后的 JSON 对象
 */
function parseJsonFromContent(content) {
  // 去除首尾空白
  let text = content.trim();

  // 处理 markdown code block 包裹：```json ... ``` 或 ``` ... ```
  const codeBlockMatch = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    // 尝试提取第一个完整的 JSON 对象
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error(`JSON 解析失败: ${err.message}\n原始内容前200字符: ${text.substring(0, 200)}`);
  }
}

/**
 * 调用 Azure OpenAI Chat Completions API
 * @param {Array} messages - 消息数组 [{role, content}]
 * @param {object} options - 可选参数
 * @param {number} options.temperature - 温度，默认 0.7
 * @param {number} options.maxTokens - 最大 token 数，默认 4096
 * @returns {Promise<string>} 返回模型回复的文本内容
 */
async function callOpenAI(messages, options = {}) {
  const {
    temperature = 0.7,
    maxTokens = 4096,
  } = options;

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';

  if (!endpoint || !apiKey || !deploymentName) {
    throw new Error('Azure OpenAI 环境变量未配置，请检查 AZURE_OPENAI_ENDPOINT、AZURE_OPENAI_API_KEY、AZURE_OPENAI_DEPLOYMENT_NAME');
  }

  // 构造请求体（新版模型使用 max_completion_tokens）
  const requestBody = JSON.stringify({
    messages,
    temperature,
    max_completion_tokens: maxTokens,
  });

  // 解析 endpoint URL
  const endpointUrl = new URL(
    `/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`,
    endpoint
  );

  return new Promise((resolve, reject) => {
    const isHttps = endpointUrl.protocol === 'https:';
    const lib = isHttps ? https : http;

    const reqOptions = {
      hostname: endpointUrl.hostname,
      port: endpointUrl.port || (isHttps ? 443 : 80),
      path: endpointUrl.pathname + endpointUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
        'Content-Length': Buffer.byteLength(requestBody),
      },
    };

    const req = lib.request(reqOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);

          // 检查 HTTP 错误状态
          if (res.statusCode >= 400) {
            const errMsg = parsed.error?.message || JSON.stringify(parsed);
            reject(new Error(`Azure OpenAI API 错误 (${res.statusCode}): ${errMsg}`));
            return;
          }

          // 提取回复内容
          const content = parsed.choices?.[0]?.message?.content;
          if (!content) {
            reject(new Error('Azure OpenAI 返回内容为空'));
            return;
          }

          resolve(content);
        } catch (err) {
          reject(new Error(`解析 Azure OpenAI 响应失败: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Azure OpenAI 请求失败: ${err.message}`));
    });

    // 设置 60 秒超时
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Azure OpenAI 请求超时（60秒）'));
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * 调用 OpenAI 并解析 JSON 响应
 * @param {Array} messages - 消息数组
 * @param {object} options - 可选参数
 * @returns {Promise<object>} 解析后的 JSON 对象
 */
async function callOpenAIJson(messages, options = {}) {
  const content = await callOpenAI(messages, options);
  return parseJsonFromContent(content);
}

module.exports = {
  callOpenAI,
  callOpenAIJson,
  parseJsonFromContent,
};
