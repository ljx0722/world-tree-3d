FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production WORLD_TREE_HOST=0.0.0.0 PORT=8123
COPY --chown=node:node index.html style.css *.js server.mjs ./
COPY --chown=node:node vendor/ ./vendor/
USER node
EXPOSE 8123
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.WORLD_TREE_PORT||process.env.PORT)+'/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
