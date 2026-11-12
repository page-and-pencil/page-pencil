// 모든 검사 파일의 첫 줄에서 부른다.
// 막음 장치(_guard_preload.js)가 켜지지 않은 채로 돌면 **여기서 멈춘다**.
//
// 왜: 2026-11-12, 쓰기를 막지 않은 검사 스크립트가 실제 item_bank 에 문항을 7줄씩 넣었다.
//     그때 막음 장치는 저장소에 있었지만, 그 스크립트가 거치지 않았던 것이 문제였다.
//     이제는 '거치지 않으면 돌지 않는다'.
if (!global.__PP_GUARD_ARMED) {
  console.error('\n🛑 막음 장치 없이 검사를 돌릴 수 없습니다.');
  console.error('   node tests/run.js            — 전부 돌리기');
  console.error('   node tests/run.js verify_iso — 하나만 돌리기');
  console.error('   (직접 돌리려면: node --require ./tests/_guard_preload.js tests/verify_xxx.js)');
  process.exit(2);
}
module.exports = global.__PP_GUARD;
