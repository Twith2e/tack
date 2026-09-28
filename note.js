const { app, BrowserWindow } = require("electron");

const createWindow = () => {
  const preload = __dirname + "/preload.js";
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload,
    },
  });

  console.log("preload", preload);

  win.loadFile("index.html");
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
