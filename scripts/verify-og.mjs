const base = process.argv[2] ?? "http://localhost:3000";
const shareId = process.argv[3] ?? "UeTf5umTcclN";
const pageUrl = `${base}/set/${shareId}`;
const response = await fetch(pageUrl, { headers: { "user-agent": "Twitterbot/1.0" } });
const html = await response.text();

function meta(key) {
  const tags = html.match(/<meta\s+[^>]*>/g) ?? [];
  const tag = tags.find(value => value.includes(`property="${key}"`) || value.includes(`name="${key}"`));
  return tag?.match(/content="([^"]*)"/)?.[1]?.replaceAll("&amp;", "&") ?? null;
}

const result = {
  status: response.status,
  title: meta("og:title"),
  description: meta("og:description"),
  image: meta("og:image"),
  twitterCard: meta("twitter:card"),
  twitterTitle: meta("twitter:title"),
  twitterDescription: meta("twitter:description"),
  twitterImage: meta("twitter:image"),
};

function localAssetUrl(value) {
  const asset = new URL(value);
  const target = new URL(base);
  if (target.hostname === "localhost" || target.hostname === "127.0.0.1") {
    asset.protocol = target.protocol;
    asset.host = target.host;
  }
  return asset.toString();
}

if (result.image) {
  const imageResponse = await fetch(localAssetUrl(result.image));
  const bytes = new Uint8Array(await imageResponse.arrayBuffer());
  result.imageStatus = imageResponse.status;
  result.imageType = imageResponse.headers.get("content-type");
  result.pngSignature = Array.from(bytes.slice(0, 8)).join(",") === "137,80,78,71,13,10,26,10";
  result.imageBytes = bytes.byteLength;
}

if (result.twitterImage) {
  const twitterImageResponse = await fetch(localAssetUrl(result.twitterImage));
  const twitterBytes = new Uint8Array(await twitterImageResponse.arrayBuffer());
  result.twitterImageStatus = twitterImageResponse.status;
  result.twitterImageType = twitterImageResponse.headers.get("content-type");
  result.twitterPngSignature = Array.from(twitterBytes.slice(0, 8)).join(",") === "137,80,78,71,13,10,26,10";
}

console.log(JSON.stringify(result, null, 2));

if (
  response.status !== 200 ||
  result.title !== "私を彩る9つのゲーム音楽 | My9GameMusic" ||
  result.description !== null ||
  result.twitterCard !== "summary_large_image" ||
  !result.image ||
  !result.twitterImage ||
  result.imageStatus !== 200 ||
  result.imageType !== "image/png" ||
  !result.pngSignature ||
  result.twitterImageStatus !== 200 ||
  result.twitterImageType !== "image/png" ||
  !result.twitterPngSignature
) process.exitCode = 1;
