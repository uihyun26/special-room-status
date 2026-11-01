# 특별실 이용 현황 공유 및 확인 서비스

같은 시간·같은 장소에 특별실 신청이 겹쳐 불편을 겪는 학생들을 위해,
특별실 신청 현황을 시간표 형태로 모두에게 공유하고 중복 신청을 막아 주는 웹 서비스입니다.

- 사이트: https://special-room-status.vercel.app
- 제작: 2207 김의현 (정보과학 프로젝트, Claude Code 사용)

## 주요 기능

**메인 기능**
- 특별실 예약 신청과 신청 현황 공유: 날짜별 특별실 × 교시 표에 모든 이용자의 신청이 실시간으로 반영된다.

**서브 기능**
1. 회원가입 / 로그인: 학번(학년 1~3 + 반 1~6 + 번호 2자리)과 비밀번호로 가입·로그인한다.
2. 중복 신청 방지: 같은 날짜·특별실·교시는 DB 제약으로 두 번째 신청이 거부된다.
3. 신청 상세 보기: 표의 "신청됨" 칸을 누르면 신청자·인원·목적·담당 교사를 볼 수 있다.
4. 마이페이지: 내가 신청한 내역을 보고 오늘 이후 신청은 취소할 수 있다.

## 기술 스택
- 프론트엔드: HTML / CSS / JavaScript (프레임워크 없음)
- 백엔드·DB·인증: Supabase (PostgreSQL, Auth, Row Level Security)
- 배포: Vercel (GitHub main 브랜치에 push하면 자동 배포)

## 폴더 구조
```
index.html            신청 현황 표 + 신청하기 폼
login.html            로그인
signup.html           회원가입
mypage.html           내가 신청한 내역 / 취소
css/style.css         스타일
js/supabase-client.js Supabase 연결 설정 (공개용 키)
js/script.js          화면 동작과 Supabase 호출
supabase/schema.sql   DB 테이블과 접근 규칙(RLS)
```

## DB 설계
- `rooms`: 특별실 목록 (id, name, sort_order)
- `reservations`: 신청 정보 (user_id, room_id, reserve_date, period, purpose, members, teacher)
  - `unique (room_id, reserve_date, period)` 제약으로 같은 칸의 중복 신청을 DB가 막는다.
- 회원 정보는 Supabase Auth(`auth.users`)가 관리한다.
  - 학번은 학년이 바뀌면 달라지므로 계정의 기본키로 쓰지 않고, 기본키는 auth id를 쓴다.
  - 학번은 수정 가능한 사용자 정보(user_metadata)로 저장하고, 로그인용 이메일은 `학번@special-room.local` 형태로 변환한다.
- 접근 규칙(RLS): 현황은 누구나 조회, 신청과 취소는 로그인한 본인 것만 가능, 지난 날짜 신청 불가.

## 직접 실행해 보기
1. 사이트에 접속한다.
2. 회원가입에서 학번(예: 2207), 이름, 비밀번호(6자 이상)를 입력해 가입한다. (가입하면 자동으로 로그인된다.)
3. 메인 화면의 "신청하기"에서 날짜·특별실·교시·목적·명단을 입력해 신청한다.
4. 신청 현황 표에 "신청됨"이 표시되고, 누르면 상세 정보가 보인다.
5. 같은 칸에 다시 신청하면 "이미 신청되어 있습니다"라는 오류가 나온다.
6. 마이페이지에서 내 신청을 확인하고 "취소하기"로 취소한다.

## 개발 환경 메모
- DB는 `supabase/schema.sql`의 [1]~[9]를 Supabase SQL Editor에서 순서대로 실행해 만든다.
- 클라이언트 키는 공개용(publishable)이며, 데이터 보호는 RLS가 담당한다. service_role(secret) 키는 저장소에 넣지 않는다.
