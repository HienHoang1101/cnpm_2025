const http = require('http');

const ports = [5000,5001,5002,5003,5004,5007];

const servers = [];

ports.forEach((port) => {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', port }));
      return;
    }
    if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(`# HELP mock_service_up Mock up metric for port ${port}\nmock_service_up{port="${port}"} 1\n`);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`Mock server listening on http://127.0.0.1:${port}`);
  });

  servers.push(server);
});

process.on('SIGINT', () => {
  console.log('Shutting down mocks...');
  servers.forEach(s => s.close());
  process.exit(0);
});
