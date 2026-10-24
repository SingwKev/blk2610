# BLNK (블랭크) — Netlify에 올리는 방법 (HTML 드래그 X → GitHub 연동 O)

## 왜 `index.html` 드래그앤드롭으로는 안 되나요?
- 예전에 해보신 **폴더 드래그앤드롭(Netlify Drop)** 방식은 서버 기능이 없는 단순 소개 페이지(`index.html`) 전용입니다.
- 우리 사이트는 **실시간으로 네이버 서버에 접속해 방문자·글자수·검색순위를 긁어오는 백엔드 서버 기능**과 **질문·답변을 저장하는 DB 기능**이 들어있는 **Next.js 웹 애플리케이션**입니다.
- 하지만 걱정하실 필요 없습니다! **Netlify도 GitHub만 연결하면 Next.js 서버 앱을 무료로 자동 변환해서 올려줍니다.** (`netlify.toml` 설정 파일을 이미 넣어두었습니다.)

---

## 실제로 Netlify에 인터넷 주소로 띄우는 3단계 (10분 완성)

### 1단계: 무료 DB 주소(`DATABASE_URL`) 한 줄 먼저 발급받기
질문/답변과 랭킹을 저장할 무료 데이터베이스 주소를 하나 만듭니다.
1. **Neon** (https://neon.tech) 접속 → 구글 또는 GitHub 아이디로 무료 로그인
2. **`New Project`** 클릭 → 이름 아무거나(예: `blnk`) 적고 **`Create`** 클릭
3. 화면 중앙에 바로 뜨는 `postgresql://...` 로 시작하는 긴 주소(**Connection string**) 옆의 **`Copy`** 버튼을 눌러 복사해 둡니다!

---

### 2단계: 내 코드 파일들을 GitHub 비공개 저장소에 올리기
Netlify가 코드를 읽어갈 수 있도록 GitHub에 파일들을 담아둡니다.
1. 이 화면에서 프로젝트 코드를 **ZIP 다운로드** 받아 내 컴퓨터에 압축을 풉니다.
   *(폴더 안에 `.env` 파일이나 `node_modules` 폴더가 있다면 그 두 개만 삭제하세요.)*
2. **GitHub** (https://github.com) 로그인 → 우측 상단 `+` → **`New repository`** 클릭
3. 이름에 `blnk-site` 입력 → **`Private`** 선택 → **`Create repository`** 클릭
4. 다음 화면의 **`uploading an existing file`** 파란 글씨 클릭
5. 압축 푼 파일 전체(`src` 폴더, `package.json`, `netlify.toml`, `next.config.ts` 등)를 마우스로 드래그해 끌어다 놓고 맨 아래 **`Commit changes`** 클릭!

---

### 3단계: Netlify에서 GitHub 연결하고 사이트 오픈하기!
폴더를 직접 드래그하는 대신 **GitHub에서 가져오기** 버튼을 누릅니다!
1. **Netlify** (https://app.netlify.com) 로그인
2. **`Add new site`** (또는 `Add new project`) 버튼 클릭 → **`Import an existing project`** 클릭! *(절대 Deploy manually 드래그 칸에 넣지 마세요!)*
3. **`GitHub`** 아이콘 클릭 → 방금 올린 **`blnk-site`** 선택
4. 빌드 설정은 제가 넣어둔 `netlify.toml` 덕분에 자동으로 채워집니다 (`npm run build` / `.next`).
5. 아래쪽 **`Add environment variables` (환경변수 추가)** 버튼 클릭 → **`New variable`** 클릭:
   - **Key**: `DATABASE_URL`
   - **Value**: 1단계(Neon)에서 복사해 둔 `postgresql://...` 주소 붙여넣기
6. 맨 아래 **`Deploy blnk-site`** 버튼 클릭!

---

## 끝! 이제 어떻게 되나요?
- 약 1~2분 동안 Netlify의 클라우드 컴퓨터가 알아서 코드를 빌드한 뒤 `https://원하는이름.netlify.app` 인터넷 주소를 열어줍니다!
- 그 주소로 첫 접속하는 순간, 코드가 자동으로 DB 테이블을 만들고 실제 네이버 블로그 진단과 질문 게시판이 100% 작동합니다.
