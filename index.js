'use strict';

const http = require('node:http');
const { createApp } = require('./src/app');

const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';

const { handler } = createApp();
const server = http.createServer(handler);

server.listen(PORT, HOST, () => {
  // Structured-ish log line so the platform can surface a start timestamp.
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'listening',
      service: 'todo-app',
      host: HOST,
      port: PORT,
      startedAt: new Date().toISOString(),
    }),
  );
});

function shutdown(signal) {
  console.log(JSON.stringify({ level: 'info', event: 'shutdown', signal }));
  server.close(() => process.exit(0));
  // Do not hang forever on keep-alive connections.
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
