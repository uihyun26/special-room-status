// 공개용(publishable) 키라서 코드에 있어도 된다. 데이터 보호는 DB의 RLS 정책이 담당한다.
// service_role(secret) 키는 절대 여기에 넣지 말 것.
const SUPABASE_URL = "https://ycqdjlbvkkedoohubeyq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_-5H8X8rr3eOq9ZMZGBFRBg_CKdv2-1b";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
