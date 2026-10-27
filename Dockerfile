FROM node:24-alpine AS development
RUN npm install -g npm@12 && npm cache clean --force
WORKDIR /app
COPY --chown=node:node . .
ENTRYPOINT ["/app/docker/dev/entrypoint"]
CMD ["npm", "test"]
