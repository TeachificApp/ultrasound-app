// Test the live scraper against the vascular cross-training URL
import { htmlToBlocks } from "./server/routers/pageScraperRouter.js";

const url = "https://www.allaboutultrasound.net/vascular-cross-training";
console.log("Fetching:", url);

const res = await fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  },
  signal: AbortSignal.timeout(15000),
});

const html = await res.text();
console.log("HTML length:", html.length);

const blocks = htmlToBlocks(html, url);
console.log("\n=== BLOCKS GENERATED ===");
console.log("Total blocks:", blocks.length);
console.log();

for (let i = 0; i < blocks.length; i++) {
  const b = blocks[i];
  let summary = "";
  switch (b.type) {
    case "hero": summary = `headline="${b.data.headline?.substring(0,50)}" imageUrl=${b.data.imageUrl ? "YES" : "NO"}`; break;
    case "text": summary = `html="${b.data.html?.substring(0,60)}..."`; break;
    case "image": summary = `url="${b.data.url?.substring(0,60)}"`; break;
    case "checklist": summary = `${b.data.items?.length} items: [${b.data.items?.slice(0,2).map(s => typeof s === 'string' ? s.substring(0,30) : `${s.crossed?'❌':'✓'} ${s.text?.substring(0,25)}`).join(", ")}...]`; break;
    case "bullets": summary = `${b.data.items?.length} items: [${b.data.items?.slice(0,2).map(s => s.substring(0,30)).join(", ")}...]`; break;
    case "cta": summary = `buttonText="${b.data.buttonText}" url="${b.data.buttonUrl?.substring(0,40)}"`; break;
    case "two_column": summary = `leftRatio=${b.data.leftRatio} left="${b.data.leftHtml?.substring(0,40)}..." right="${b.data.rightHtml?.substring(0,40)}..."`; break;
    case "three_column": summary = `col1="${b.data.col1Html?.substring(0,30)}..." col2="${b.data.col2Html?.substring(0,30)}..." col3="${b.data.col3Html?.substring(0,30)}..."`; break;
    case "column_layout": {
      const lb = b.data.leftBlocks || [];
      const rb = b.data.rightBlocks || [];
      summary = `leftBlocks=[${lb.map(x => x.type).join(",")}] rightBlocks=[${rb.map(x => x.type).join(",")}]`;
      break;
    }
    default: summary = JSON.stringify(b.data).substring(0, 80);
  }
  console.log(`${i+1}. [${b.type}] ${summary}`);
  if (b.type === "two_column" && b.data.leftHtml?.includes("checklist")) {
    console.log("   LEFT HTML:", b.data.leftHtml?.substring(0, 300));
  }
}
