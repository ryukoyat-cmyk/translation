# 문서 통번역 (Document Translation MVP)

PDF 파일 또는 URL로 대용량 문서를 자동 번역하는 Next.js 웹앱입니다.

## 주요 기능

- PDF 업로드 또는 URL 입력으로 문서 제공
- 텍스트 자동 추출 (PDF: pdf-parse, URL: @mozilla/readability)
- 문서 자동 청크 분할 (제목/단락 기준, 최대 1500자)
- OpenAI gpt-4o-mini를 이용한 순차 번역 (문맥 포함)
- 실시간 진행률 표시 (SSE 스트리밍)
- 웹 미리보기 (원문 / 번역 초안 / 후처리본 탭)
- 후검수·용어통일 (별도 버튼)
- 실패 청크 재시도
- DOCX 다운로드 (초안 / 후처리본)

## 실행 방법

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.example`을 복사하여 `.env.local`을 생성하고 값을 입력합니다.

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-...
```

### 3. Supabase DB 설정

Supabase 대시보드의 SQL Editor에서 `db/schema.sql`을 실행합니다.

```bash
# 또는 Supabase CLI 사용
supabase db push
```

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인합니다.

## 파일 구조

```
app/
  page.tsx                    # 업로드/설정 페이지
  layout.tsx                  # 루트 레이아웃
  globals.css                 # 전역 스타일
  jobs/[id]/page.tsx          # 진행/결과 페이지
  api/
    jobs/
      route.ts                # POST /api/jobs
      [id]/
        route.ts              # GET /api/jobs/:id
        process/route.ts      # POST /api/jobs/:id/process (SSE)
        retry/route.ts        # POST /api/jobs/:id/retry
        postprocess/route.ts  # POST /api/jobs/:id/postprocess (SSE)
        result/route.ts       # GET /api/jobs/:id/result
        export/route.ts       # GET /api/jobs/:id/export
components/
  ProgressBar.tsx             # 진행률 바
  TranslationPreview.tsx      # 번역 미리보기
lib/
  supabase.ts                 # Supabase 클라이언트 및 DB 헬퍼
  extractor.ts                # PDF/URL 텍스트 추출
  chunker.ts                  # 텍스트 청크 분할
  translator.ts               # OpenAI 번역
  postprocessor.ts            # 후검수 처리
  docx-generator.ts           # DOCX 생성
types/
  index.ts                    # TypeScript 타입 정의
db/
  schema.sql                  # 데이터베이스 스키마
```

## 번역 설정

| 설정 | 옵션 |
|------|------|
| 번역 방향 | 영어→한국어, 한국어→영어 |
| 번역 스타일 | 직역, 자연스러운 번역, 학술 문체, 실무/공문 |
| 용어집 | `원어=번역어` 형식으로 한 줄씩 입력 |

## 환경변수

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 익명 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 롤 키 (서버 전용) |
| `OPENAI_API_KEY` | OpenAI API 키 |
