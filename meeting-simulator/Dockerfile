FROM node:20-alpine AS production

WORKDIR /app

# 安装编译工具（better-sqlite3 在 production install 时仍需要编译）
RUN apk add --no-cache python3 make g++

# 只复制 server 的 package.json 并安装生产依赖
COPY server/package.json ./server/
RUN cd server && npm install --omit=dev

# 删除编译工具，减小镜像体积
RUN apk del python3 make g++ && rm -rf /tmp/*

# 复制 API 源码
COPY server/ ./server/

# 声明数据目录为可挂载卷（SQLite 数据库持久化）
VOLUME ["/app/server/data"]

# 暴露端口
EXPOSE 3001

# 启动服务
CMD ["node", "server/index.js"]
