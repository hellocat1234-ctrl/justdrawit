// npm run share — แชร์เกมให้เพื่อนที่อยู่คนละที่ผ่านอินเทอร์เน็ตชั่วคราว (Cloudflare quick tunnel)
//   - ถ้ายังไม่ได้เปิดเกม (พอร์ต 3000) สคริปต์นี้เปิดให้เอง
//   - เปิดอุโมงค์ไปที่ http://localhost:3000 แล้วพิมพ์ลิงก์ https://xxxx.trycloudflare.com ให้ส่งเพื่อน
//   - ลิงก์ใช้ได้เฉพาะตอนสคริปต์นี้ยังรันอยู่ กด Ctrl+C = ปิดอุโมงค์ (และปิดเกมที่สคริปต์เปิดให้) ลิงก์ตายทันที
//   - ต้องมีโปรแกรม cloudflared (macOS: brew install cloudflared) ไม่ต้องสมัครบัญชี
const { spawn, spawnSync } = require("child_process");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, "..");
const children = [];

function stopAll(code = 0) {
  for (const c of children) if (!c.killed) c.kill();
  process.exit(code);
}
process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

function hasCloudflared() {
  const r = spawnSync(process.platform === "win32" ? "where" : "which", ["cloudflared"], { stdio: "ignore" });
  return r.status === 0;
}

async function serverUp() {
  try {
    return (await fetch(`http://localhost:${PORT}/test.html`, { signal: AbortSignal.timeout(1500) })).ok;
  } catch {
    return false;
  }
}

async function main() {
  if (!hasCloudflared()) {
    console.error(
      "❌ ไม่พบโปรแกรม cloudflared\n" +
        "   macOS:   brew install cloudflared\n" +
        "   อื่นๆ:    https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/\n" +
        "   (ใช้ฟรี ไม่ต้องสมัครบัญชี) ติดตั้งแล้วรัน npm run share ใหม่",
    );
    process.exit(1);
  }

  if (await serverUp()) {
    console.log(`✓ เกมเปิดอยู่แล้วที่พอร์ต ${PORT}`);
  } else {
    console.log(`▶ ยังไม่ได้เปิดเกม — เปิดให้ที่พอร์ต ${PORT}`);
    const srv = spawn(process.execPath, ["server/index.js"], { cwd: ROOT, stdio: ["ignore", "inherit", "inherit"] });
    children.push(srv);
    srv.on("exit", (code) => {
      console.error(`\n❌ server ปิดตัว (code ${code}) — ปิดอุโมงค์ด้วย`);
      stopAll(1);
    });
    for (let i = 0; i < 100 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 200));
    if (!(await serverUp())) {
      console.error("❌ เปิดเกมไม่ขึ้นภายใน 20 วินาที");
      stopAll(1);
    }
  }

  console.log("▶ กำลังเปิดอุโมงค์ไปที่อินเทอร์เน็ต (รอสักครู่)...");
  const tunnel = spawn("cloudflared", ["tunnel", "--no-autoupdate", "--url", `http://localhost:${PORT}`], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(tunnel);

  let shown = false;
  let tail = "";
  const onData = (buf) => {
    const text = buf.toString();
    tail = (tail + text).slice(-2000);
    const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i.exec(tail);
    if (m && !shown) {
      shown = true;
      const line = "═".repeat(Math.max(46, m[0].length + 6));
      console.log(
        `\n${line}\n  ส่งลิงก์นี้ให้เพื่อน (เปิดในเบราว์เซอร์ได้เลย):\n\n     ${m[0]}\n\n` +
          `  • ใช้ได้ตราบที่หน้าต่างนี้ยังเปิดอยู่ · กด Ctrl+C เพื่อปิดลิงก์\n  • ลิงก์เปลี่ยนใหม่ทุกครั้งที่รัน และใครมีลิงก์ก็เข้าได้ — อย่าโพสต์ที่สาธารณะ\n${line}\n`,
      );
    }
  };
  tunnel.stdout.on("data", onData);
  tunnel.stderr.on("data", onData);
  tunnel.on("exit", (code) => {
    console.error(`\n❌ อุโมงค์ปิดตัว (code ${code}) ${shown ? "" : "— ยังไม่ได้ลิงก์ ลองรันใหม่ หรือเช็คอินเทอร์เน็ต"}`);
    stopAll(1);
  });
  setTimeout(() => {
    if (!shown) console.warn("… ยังรอลิงก์อยู่ (ถ้านานเกิน 30 วินาที เช็คอินเทอร์เน็ต หรือกด Ctrl+C แล้วลองใหม่)");
  }, 15000).unref();
}

main();
