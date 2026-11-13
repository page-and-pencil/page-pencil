// 검사가 여는 주소를 **한 곳에서** 만든다.
//
// 왜: 검사마다 'file:///' + encodeURI(ROOT + '/index.html') 로 주소를 지어 썼다.
//     윈도에서 ROOT 는 'C:\Users\…\page-pencil' 이라 역슬래시가 %5C 로 바뀌고,
//     크롬이 그 주소를 열지 못해 검사 스물몇 개가 한꺼번에 죽었다.
//     주소 짓기는 url.pathToFileURL 한 군데에만 둔다.
//
//   const { pageUrl, fileUrl } = require('./_page');
//   await page.goto(pageUrl());                       // 앱의 index.html
//   await page.goto(pageUrl('index.html', '?role=student'));
//   await page.goto(pageUrl(null, null, true));       // http://localhost:5500 으로
//   await page.goto(fileUrl(SCR + '/print.html'));    // 검사가 만든 파일
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const HTTP = process.env.PP_BASE_URL || 'http://localhost:5500';

// 아무 파일 경로 → file:// 주소 (공백·한글·역슬래시를 바르게 바꾼다)
function fileUrl(p) {
  return pathToFileURL(path.resolve(String(p || ''))).href;
}

// 저장소 안의 파일 → 주소. http 를 켜면 로컬 서버 주소로 만든다
// (file:// 은 IndexedDB 가 막혀 있어, 기기 보관을 보는 검사는 http 로 열어야 한다).
function pageUrl(rel, qs, http) {
  const r = String(rel || 'index.html').replace(/^[\\/]+/, '');
  const q = qs ? (String(qs)[0] === '?' ? String(qs) : '?' + qs) : '';
  if (http) return HTTP.replace(/\/+$/, '') + '/' + r.replace(/\\/g, '/') + q;
  return fileUrl(path.join(ROOT, r)) + q;
}

module.exports = { ROOT, HTTP, fileUrl, pageUrl };
