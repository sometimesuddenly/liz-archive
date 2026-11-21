// index.html 안의 YouTube 영상 ID를 모아 YouTube API로 조회한 뒤 videos.json 으로 저장합니다.
// 사용: YT_API_KEY=키 node scripts/fetch-videos.mjs   (기본 입력 파일: index.html)
import fs from "node:fs";

const KEY = process.env.YT_API_KEY;
const SRC = process.env.SRC || "index.html";
const OUT = process.env.OUT || "videos.json";

const html = fs.readFileSync(SRC, "utf8");

// 1) 유튜브 주소 형태 (youtu.be/ID, shorts/ID, live/ID, watch?v=ID, embed/ID)
// 2) 따옴표로 시작하는 11자리 ID (예: "M59NYdZCyWE" 또는 "M59NYdZCyWE | 설명")
const ids = new Set();
for (const m of html.matchAll(/(?:youtu\.be\/|\/shorts\/|\/live\/|\/embed\/|[?&]v=)([\w-]{11})/g)) ids.add(m[1]);
for (const m of html.matchAll(/["']([\w-]{11})(?=["']|\s*\|)/g)) {
  if (/[A-Z0-9_-]/.test(m[1])) ids.add(m[1]); // description 같은 일반 단어는 제외
}
const list = [...ids];
console.log(`영상 ID ${list.length}개 → API 호출 ${Math.ceil(list.length / 50)}회`);

if (!KEY) {
  console.error("YT_API_KEY 환경변수가 없습니다.");
  process.exit(1);
}

const out = {};
for (let i = 0; i < list.length; i += 50) {
  const chunk = list.slice(i, i + 50).join(",");
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${chunk}&key=${KEY}`;
  const res = await fetch(url);
  const d = await res.json();
  if (d.error) {
    console.error("API 오류:", JSON.stringify(d.error));
    process.exit(1); // 실패하면 기존 videos.json 을 그대로 둡니다
  }
  for (const v of d.items || []) {
    const t = v.snippet.thumbnails || {};
    const thumb = (t.maxres || t.standard || t.high || t.medium || {}).url || "";
    out[v.id] = {
      title: v.snippet.title,
      publishedAt: v.snippet.publishedAt,
      thumb,
      viewCount: v.statistics ? v.statistics.viewCount : "0",
      duration: v.contentDetails.duration,
    };
  }
}

if (Object.keys(out).length === 0) {
  console.error("조회된 영상이 0개라 저장하지 않습니다.");
  process.exit(1);
}
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`${Object.keys(out).length}개 영상을 ${OUT} 에 저장했습니다.`);
