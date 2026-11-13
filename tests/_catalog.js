// 기출 카탈로그를 읽는 곳. **실제 카탈로그 파일은 저장소에 넣지 않는다.**
//
//   PP_EXAM_CATALOG=…/catalog.json  이 있으면 그 파일을 읽고,
//   없으면 tests/fixtures/exam_catalog_fake.json (가짜 30줄) 을 읽는다.
//
// 가짜 줄에는 실제 학교·시험 이름도, 실제 링크도 없다.
// 가짜로 돌 때는 '줄 수가 많아야 보이는 것'(쪽 나눠 받기 등)을 보는 검사가 느슨해질 수 있다 —
// 그런 검사는 isFake() 로 그 대목을 건너뛴다.
const fs = require('fs');
const path = require('path');

const FAKE = path.join(__dirname, 'fixtures', 'exam_catalog_fake.json');
const ENV = String(process.env.PP_EXAM_CATALOG || '').trim();

function catalogPath() {
  if (ENV && fs.existsSync(ENV)) return ENV;
  return FAKE;
}
function isFake() { return catalogPath() === FAKE; }
function examCatalog() {
  const p = catalogPath();
  const rows = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!Array.isArray(rows) || !rows.length) throw new Error('기출 카탈로그가 비었습니다: ' + p);
  return rows;
}

module.exports = { examCatalog, catalogPath, isFake, FAKE };
