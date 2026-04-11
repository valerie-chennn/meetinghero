FROM node:20-alpine AS production

WORKDIR /app

# 只复制 server 的 package.json 并安装生产依赖
COPY server/package.json ./server/
RUN cd server && npm install --omit=dev

# 复制 API 源码
COPY server/ ./server/

# 暴露端口
EXPOSE 3001

# 启动服务
CMD ["node", "server/index.js"]
