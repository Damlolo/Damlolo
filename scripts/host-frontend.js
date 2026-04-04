const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "frontend");
const port = Number(process.env.PORT || 4173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

http
  .createServer((req, res) => {
    const reqPath = req.url === "/" ? "/index.html" : req.url;
    const abs = path.normalize(path.join(root, reqPath));
    if (!abs.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(abs, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(abs);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(port, () => {
    console.log(`Frontend hosted at http://localhost:${port}`);
  });
