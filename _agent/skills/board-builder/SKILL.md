---
name: board-builder
description: GitHub API와 Vercel 서버리스 API를 사용하는 정적 게시판 홈페이지를 생성하고 관리한다.
---

# Board Builder

## Scope

- 루트 정적 HTML 페이지와 `db.js`를 사용한다.
- 게시글은 `data/posts.json`에 저장하고 GitHub Contents API로 커밋한다.
- 브라우저에는 GitHub 소유자와 저장소를 공개 설정 파일에서 읽고, 토큰은 `/api/config` 환경 변수에서 읽는다.
- `public/` 폴더를 만들지 않는다.

## Required pages

`index.html`, `news.html`, `news-detail.html`, `news-write.html`, `admin.html`, `db.js`, `api/config.js`, `config/git_config.json`, `data/posts.json`, `vercel.json`.

## Safety

- 토큰을 파일, HTML, 로그, 커밋에 기록하지 않는다.
- 마크다운은 먼저 HTML 이스케이프하고 허용된 링크 프로토콜만 렌더링한다.
- 관리자 상태는 `sessionStorage`로만 유지한다.
