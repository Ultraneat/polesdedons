import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

const middlewareBlock = `  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
`;

// Remove it from its current position
code = code.replace(middlewareBlock, "");

// Insert it before httpServer.listen
const targetListen = `  httpServer.listen(PORT, "0.0.0.0", () => {`;
code = code.replace(targetListen, middlewareBlock + "\n" + targetListen);

fs.writeFileSync('server.ts', code);
