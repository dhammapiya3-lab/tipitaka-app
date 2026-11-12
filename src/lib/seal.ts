/**
 * 복사를 막아 둔 번역(allowCopy: false — 법구경 법현 스님 번역)의 본문 파일을 그대로 읽히지 않게 감싼다.
 * 사이트에서는 보이고, 자료 파일(/data/suttas/…/kor-beophyun.json)을 열면 읽을 수 없는 글자로 보인다.
 *
 * 암호가 아니다 — 앱이 풀 수 있으면 마음먹은 사람도 풀 수 있다. 자료 파일을 받아 그대로
 * 다른 곳에 옮겨 쓰는 일을 막는 정도의 울타리다. 변환(build-content)과 화면이 같이 쓴다.
 */

/** 경·판본마다 다른 열쇠 — 같은 글이라도 파일마다 다르게 보인다 */
function keyOf(suttaId: string, editionId: string): Uint8Array {
  return new TextEncoder().encode(`tipitaka|${suttaId}|${editionId}|dhammadāna`);
}

function xor(bytes: Uint8Array, key: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ key[i % key.length] ^ (i * 31) % 251;
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function seal(value: unknown, suttaId: string, editionId: string): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return toBase64(xor(bytes, keyOf(suttaId, editionId)));
}

/** 풀면 JSON 값. 형식 검사는 부르는 쪽에서 zod 로 한다. */
export function unseal(sealed: string, suttaId: string, editionId: string): unknown {
  const bytes = xor(fromBase64(sealed), keyOf(suttaId, editionId));
  return JSON.parse(new TextDecoder().decode(bytes));
}
