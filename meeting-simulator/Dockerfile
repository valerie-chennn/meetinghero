# ==================== Stage 1: 构建阶段 ====================
# 安装所有依赖，构建前端静态文件
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 native 模块编译所需工具（better-sqlite3 需要）
RUN apk add --no-cache python3 make g++

# 先复制 package.json，利用 Docker layer cache
# 只有 package.json 变化时才重新 npm install
COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# 安装所有依赖（含 devDependencies，前端构建需要）
RUN npm run install:all

# 复制源码
COPY server/ ./server/
COPY client/ ./client/

# 构建前端静态文件，输出到 client/dist/
RUN cd client && npm run build


# ==================== Stage 2: 生产运行阶段 ====================
# 只包含运行所需的文件，镜像体积最小
FROM node:20-alpine AS production

WORKDIR /app

# 安装编译工具（better-sqlite3 在 production install 时仍需要编译）
RUN apk add --no-cache python3 make g++

# 只复制 server 的 package.json 并安装生产依赖
COPY server/package.json ./server/
RUN cd server && npm install --omit=dev

# 删除编译工具，减小镜像体积
RUN apk del python3 make g++ && rm -rf /tmp/*

# 安装 ffmpeg（用于 TTS 响度归一化 loudnorm）
# alpine 的 ffmpeg 包包含 loudnorm filter，大小约 60MB
# 切换到腾讯云 alpine 镜像（内网直连，秒下载），避开 dl-cdn.alpinelinux.org 境外慢
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.tencentyun.com|g' /etc/apk/repositories && \
    apk add --no-cache ffmpeg

# 从 builder 阶段复制 server 源码和前端构建产物
COPY --from=builder /app/server/ ./server/
COPY --from=builder /app/client/dist ./client/dist/

# 声明数据目录为可挂载卷（SQLite 数据库持久化）
VOLUME ["/app/server/data"]

# 暴露端口
EXPOSE 3001

# 启动服务
CMD ["node", "server/index.js"]
