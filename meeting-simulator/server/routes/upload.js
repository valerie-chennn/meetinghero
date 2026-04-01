/**
 * 文件上传解析路由
 * 支持 PDF 和 TXT 文件，提取文本内容返回给前端
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');

// 最大提取字符数，避免超出 AI 上下文窗口
const MAX_TEXT_LENGTH = 8000;

// 文件大小上限：5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// multer 内存存储配置：文件不写磁盘，直接存 buffer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    // 校验 MIME 类型和扩展名
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    const allowed = ['.pdf', '.txt'];
    if (!allowed.includes(ext)) {
      return cb(new Error(`不支持的文件格式：${ext}，仅支持 .pdf 和 .txt`));
    }
    cb(null, true);
  },
});

/**
 * POST /api/upload/parse
 * 接收文件，提取纯文本后返回
 * 请求体：multipart/form-data，字段名 file
 * 响应：{ text: string }
 */
router.post('/parse', (req, res, next) => {
  // 先用 multer 处理文件上传
  upload.single('file')(req, res, async (err) => {
    // multer 错误处理（文件过大、格式不对等）
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `文件超过 5MB 限制，请压缩后重试` });
      }
      return res.status(400).json({ error: err.message });
    }

    // 没有文件
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    const { buffer, originalname, mimetype } = req.file;
    const ext = originalname.toLowerCase().slice(originalname.lastIndexOf('.'));

    console.log(`[Upload/Parse] 收到文件: ${originalname}, 大小: ${(buffer.length / 1024).toFixed(1)}KB`);

    try {
      let text = '';

      if (ext === '.pdf' || mimetype === 'application/pdf') {
        // PDF：用 pdf-parse 提取文本
        const parsed = await pdfParse(buffer);
        text = parsed.text || '';

        if (!text.trim()) {
          return res.status(422).json({ error: 'PDF 文件无法提取文本，可能是扫描件或图片 PDF' });
        }
      } else if (ext === '.txt' || mimetype === 'text/plain') {
        // TXT：直接解码 buffer
        text = buffer.toString('utf-8');
      } else {
        return res.status(400).json({ error: `不支持的文件格式，仅支持 .pdf 和 .txt` });
      }

      // 清理多余空白，截取前 8000 字符
      const cleanText = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      const truncated = cleanText.length > MAX_TEXT_LENGTH
        ? cleanText.slice(0, MAX_TEXT_LENGTH) + '\n...(内容已截取)'
        : cleanText;

      console.log(`[Upload/Parse] 提取成功，字符数: ${truncated.length}`);

      return res.json({ text: truncated });
    } catch (parseErr) {
      console.error('[Upload/Parse] 解析失败:', parseErr.message);
      return res.status(422).json({ error: `文件解析失败：${parseErr.message}` });
    }
  });
});

module.exports = router;
