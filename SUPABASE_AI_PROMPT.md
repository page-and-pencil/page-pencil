# Supabase AI Assistant에게 보낼 프롬프트

> **상태: 1차·2차 모두 완료 (2026-11-01)**
> `push-hw` version 2 ACTIVE, JWT 검증 켜짐. 점검 ①~⑦ 전부 통과, force 차단 확인.
> 아래 내용은 기록용으로 남겨 둡니다 — 다시 보낼 필요 없습니다.

사용법
1. Supabase 대시보드 오른쪽 아래 **AI Assistant** 열기
2. 아래 `--- 복사 시작 ---` 부터 `--- 복사 끝 ---` 까지 붙여넣기
3. 중간의 `<<< PASTE index.ts HERE >>>` 자리에 **`supabase/functions/push-hw/index.ts` 파일 전체**(157줄, 첫 줄 `// Page & Pencil — 매일 숙제 푸시 알림`, 마지막 줄 `});`)를 붙여넣기
4. 전송

> 프롬프트가 요청하는 것: ① 현재 함수 목록과 시크릿 이름 확인 ② `push-hw` 배포 ③ 못 하면 이유와 정확한 수동 절차.
> **기존 보안 설정을 바꾸지 말라고 못박아 뒀습니다** — Supabase AI가 "친절하게" `push_subs`에 SELECT 정책을 추가하면 푸시 endpoint가 외부에 노출됩니다.

---

--- 복사 시작 ---

I need help deploying one Edge Function. Please read the context first — most of the setup is already done and working, so please do not change it.

## Goal

Deploy an Edge Function named **exactly `push-hw`** to this project. It sends a daily "homework remaining" Web Push notification.

## What is already set up and verified working (do NOT modify)

- Table `public.push_subs` — columns: `id text primary key`, `sid text`, `data jsonb`, `updated_at timestamptz`. RLS is enabled.
- `anon` and `authenticated` have **no direct privileges** on `push_subs`. This is intentional: `data->>'endpoint'` is a Web Push endpoint URL, and anyone who can read it can send notifications to that device.
- Two `SECURITY DEFINER` functions are the only write path, and both are verified working:
  - `public.pp_push_subscribe(p_id text, p_sid text, p_data jsonb)`
  - `public.pp_push_unsubscribe(p_id text)`
- View `public.push_subs_pub` exposes only `sid`, `role`, `name`, `updated_at` (no endpoint), granted to `anon`.
- A `pg_cron` job named `pp-hw-push` runs daily at `0 10 * * *` (UTC) and does `net.http_post` to `/functions/v1/push-hw` with the project's publishable (anon) key in the `Authorization` header.
- Edge Function secrets were added through the dashboard: `VAPID_PRIVATE_JWK`, `VAPID_PUBLIC`, `VAPID_SUBJECT`.

## Important constraints

1. **Do not add a SELECT policy on `push_subs`, and do not grant SELECT on it to `anon` or `authenticated`.** That would expose push endpoints. If you think the function needs read access, note that it uses `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS.
2. **Keep JWT verification enabled** on the function. The cron job sends a valid project key, so verification passes. Disabling it would let anyone trigger the function.
3. The function relies on `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, which Supabase injects automatically. Do not add them as secrets.
4. Do not rename the function. The cron job and the client both expect `push-hw`.

## The problem

I believe I deployed this function via the dashboard editor, but calling it returns 404:

```
POST https://pznpcewwdsbxwibpnapn.supabase.co/functions/v1/push-hw
→ 404
```

For comparison, an existing function in the same project responds normally:

```
POST https://pznpcewwdsbxwibpnapn.supabase.co/functions/v1/claude-proxy
→ 400  (its own validation error, so it exists)
```

I also tried these names and all returned 404: `push_hw`, `pushhw`, `pushHw`, `push-hw-1`, `hw-push`, `push`, `hello-world`, `my-function`, `notify`, `daily-push`, `send-push`.

## What I need from you

1. **List every Edge Function that exists in this project right now**, with its name and status. I want to know whether `push-hw` exists under a different name or failed to save.
2. **List the names of the Edge Function secrets** currently set (names only, not values). I want to confirm `VAPID_PRIVATE_JWK`, `VAPID_PUBLIC`, `VAPID_SUBJECT` are all there and spelled correctly.
3. **Deploy the function below as `push-hw`** (Deno / TypeScript, runs on `Deno.serve` via `std/http`). If you cannot deploy it yourself, tell me plainly that you cannot, and give me the exact click-by-click steps plus the most likely reason my earlier attempt produced nothing.
4. After deploying, **invoke it once with the body `{}`** and show me the raw JSON response. Expected shape:
   ```json
   { "today": "YYYY-MM-DD", "force": false, "sent": 0, "total": 0, "result": [] }
   ```
   `total` is the number of subscribed devices, which is 0 right now — that is expected and not an error.
5. If deployment or invocation errors, show me the **full error text and the function logs**, and tell me what to change. Do not silently rewrite the code: if you must change it, show me a diff and explain why.

## Function code

```ts
<<< PASTE index.ts HERE >>>
```

--- 복사 끝 ---

---

## 답변을 받은 뒤

AI가 알려준 **함수 목록**과 **시크릿 이름**, 그리고 오류 메시지를 저(Claude Code)에게 알려주세요.
`node verify_push.js` 로 제가 다시 끝까지 점검하겠습니다.

## 주의

- AI가 `push_subs`에 **SELECT 정책을 추가하자고 하면 거절**하세요. 푸시 endpoint가 노출됩니다.
- AI가 **JWT 검증을 끄자고 하면 거절**하세요. 외부에서 아무나 알림을 보낼 수 있게 됩니다.
- AI가 코드를 고쳐야 한다고 하면, **바꾼 내용을 먼저 보여달라고** 하세요. 그 내용을 저에게 알려주시면 로컬 파일도 같이 맞추겠습니다.

---

## 2차 요청 — force 우회 차단 반영 (2026-11-01)

1차 배포는 성공했습니다. 다만 AI가 지적한 대로 `{"force":true}` 를 공개 키로도 보낼 수 있어
하루 1회 제한을 우회할 수 있었습니다. 그 부분을 고쳤으니 **같은 이름으로 재배포**만 하면 됩니다.

--- 복사 시작 ---

Thanks — the deployment worked. You were right about the `force` bypass: with JWT verification on,
anyone holding the project client key could POST `{"force":true}` and skip the once-per-day guard.

I have fixed it in the code: `force` is now honored only when the caller presents the
`SUPABASE_SERVICE_ROLE_KEY` as the bearer token. The scheduler calls with the client key, so it
takes the normal path (one notification per device per day). A refused attempt is reported back as
`forceDenied` in the JSON response.

Please **redeploy the same function `push-hw`** with the updated code below. Same constraints as before:
keep JWT verification enabled, do not rename it, and do not touch the database (no new policies, and
do not grant SELECT on `push_subs` — `data->>'endpoint'` must stay private).

Two follow-up questions:

1. You noted that a modern `sb_publishable_...` key is not a JWT and would fail verification. I checked
   the key this project hands to the browser: it decodes as a JWT with `role: anon`, `iss: supabase`,
   issued 2026-05-27 and expiring 2036-05-26. So it is a legacy anon JWT and should pass verification.
   Can you confirm the `pp-hw-push` cron job is firing without auth errors? Please show
   `select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'pp-hw-push') order by start_time desc limit 5;`

2. You flagged RLS as disabled on `students`, `lessons`, `tests`, `readings`, `logs`, `notices`,
   `settings`. That is the app's existing design (a static client talks to PostgREST with the anon key),
   so please do not change it now. I only want to know: is there a `settings` RLS policy already present
   from a previous migration? Just report what exists — make no changes.

Updated function code:

```ts
<<< PASTE index.ts HERE >>>
```

--- 복사 끝 ---
