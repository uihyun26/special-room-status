const PERIODS = ["1교시", "2교시", "3교시", "4교시", "5교시", "6교시", "7교시"];
const STUDENT_ID_PATTERN = /^[1-3][1-6](0[1-9]|[1-9]\d)$/;
const MIN_PASSWORD_LENGTH = 6;
const EMAIL_DOMAIN = "special-room.local";

function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const TODAY = formatDate(new Date());

function setMessage(element, text, type) {
  element.textContent = text;
  element.className = "form-message " + type;
}

function toEmail(studentId) {
  return `${studentId}@${EMAIL_DOMAIN}`;
}

function countMembers(members) {
  return members.split(",").map((m) => m.trim()).filter(Boolean).length;
}

async function setupNav() {
  const { data } = await db.auth.getSession();
  const user = data.session ? data.session.user : null;
  const link = document.querySelector('nav a[href="login.html"]');

  if (user && link) {
    link.textContent = `로그아웃 (${user.user_metadata.student_id})`;
    link.href = "#";
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      await db.auth.signOut();
      location.href = "index.html";
    });
  }
  return user;
}

async function initStatusPage(user) {
  const statusTable = document.getElementById("status-table");
  if (!statusTable) return;

  const form = document.querySelector(".apply-form");
  const message = document.getElementById("form-message");
  const detailPanel = document.getElementById("detail-panel");
  const viewDateInput = document.getElementById("view-date");
  const submitButton = form.querySelector('button[type="submit"]');

  let rooms = [];
  let reservations = [];
  let viewDate = TODAY;
  let selected = null;
  let loadToken = 0;

  function isBooked(room, period) {
    return reservations.some((r) => r.room === room && r.period === period);
  }

  function addDetailRow(list, label, value) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    list.append(dt, dd);
  }

  function hideDetail() {
    selected = null;
    detailPanel.hidden = true;
    detailPanel.innerHTML = "";
  }

  function closeDetail() {
    hideDetail();
    renderTable();
  }

  function showDetail(room, period) {
    const reservation = reservations.find((r) => r.room === room && r.period === period);
    if (!reservation) return;

    selected = { room, period };

    const title = document.createElement("h3");
    title.textContent = `${viewDate} · ${room} · ${period}`;

    const list = document.createElement("dl");
    addDetailRow(list, "신청자", reservation.members);
    addDetailRow(list, "인원", `${countMembers(reservation.members)}명`);
    addDetailRow(list, "목적", reservation.purpose);
    addDetailRow(list, "담당 교사", reservation.teacher || "없음");

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "secondary";
    closeButton.textContent = "닫기";
    closeButton.addEventListener("click", closeDetail);

    detailPanel.innerHTML = "";
    detailPanel.append(title, list, closeButton);
    detailPanel.hidden = false;
    renderTable();
  }

  function renderTable() {
    statusTable.innerHTML = "";

    const headRow = statusTable.createTHead().insertRow();
    ["특별실", ...PERIODS].forEach((text) => {
      const th = document.createElement("th");
      th.textContent = text;
      headRow.appendChild(th);
    });

    const body = statusTable.createTBody();
    rooms.forEach(({ name: room }) => {
      const row = body.insertRow();
      const roomCell = document.createElement("th");
      roomCell.textContent = room;
      row.appendChild(roomCell);

      PERIODS.forEach((period) => {
        const cell = row.insertCell();
        if (!isBooked(room, period)) return;

        cell.className = "booked";
        if (selected && selected.room === room && selected.period === period) {
          cell.classList.add("selected");
        }

        const button = document.createElement("button");
        button.type = "button";
        button.className = "booked-button";
        button.textContent = "신청됨";
        button.setAttribute("aria-label", `${room} ${period} 신청 내용 보기`);
        button.addEventListener("click", () => showDetail(room, period));
        cell.appendChild(button);
      });
    });
  }

  async function loadReservations() {
    const token = ++loadToken;
    const { data, error } = await db
      .from("reservations")
      .select("id, user_id, room_id, period, purpose, members, teacher")
      .eq("reserve_date", viewDate);

    if (token !== loadToken) return false;
    if (error) {
      setMessage(message, `신청 현황을 불러오지 못했습니다. (${error.message})`, "error");
      return false;
    }

    reservations = data.map((r) => {
      const room = rooms.find((x) => x.id === r.room_id);
      return {
        id: r.id,
        userId: r.user_id,
        room: room ? room.name : "",
        period: PERIODS[r.period - 1],
        purpose: r.purpose,
        members: r.members,
        teacher: r.teacher,
      };
    });
    return true;
  }

  async function setViewDate(date) {
    viewDate = date;
    viewDateInput.value = date;
    hideDetail();
    if (await loadReservations()) renderTable();
  }

  function fillOptions(select, items) {
    items.forEach((item) => {
      const option = document.createElement("option");
      option.value = item;
      option.textContent = item;
      select.appendChild(option);
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!user) {
      setMessage(message, "신청하려면 먼저 로그인해 주세요.", "error");
      return;
    }

    const data = new FormData(form);
    const room = rooms.find((r) => r.name === data.get("room"));
    const reserveDate = data.get("date");
    const periodLabel = data.get("period");

    if (reserveDate < TODAY) {
      setMessage(message, "지난 날짜는 신청할 수 없습니다.", "error");
      return;
    }

    submitButton.disabled = true;
    const { error } = await db.from("reservations").insert({
      room_id: room.id,
      reserve_date: reserveDate,
      period: PERIODS.indexOf(periodLabel) + 1,
      purpose: data.get("purpose").trim(),
      members: data.get("members").trim(),
      teacher: data.get("teacher").trim() || null,
    });
    submitButton.disabled = false;

    if (error) {
      const text =
        error.code === "23505"
          ? `${reserveDate} ${room.name} ${periodLabel}는 이미 신청되어 있습니다.`
          : `신청에 실패했습니다. (${error.message})`;
      setMessage(message, text, "error");
      return;
    }

    form.reset();
    form.elements["date"].value = reserveDate;
    await setViewDate(reserveDate);
    setMessage(message, `${reserveDate} ${room.name} ${periodLabel} 신청이 완료되었습니다.`, "success");
  });

  viewDateInput.min = TODAY;
  viewDateInput.addEventListener("change", () => {
    if (viewDateInput.value) setViewDate(viewDateInput.value);
  });

  form.elements["date"].min = TODAY;
  form.elements["date"].value = TODAY;
  fillOptions(form.elements["period"], PERIODS);

  const { data: roomRows, error: roomError } = await db
    .from("rooms")
    .select("id, name")
    .order("sort_order");

  if (roomError) {
    setMessage(message, `특별실 목록을 불러오지 못했습니다. (${roomError.message})`, "error");
    return;
  }

  rooms = roomRows;
  fillOptions(form.elements["room"], rooms.map((r) => r.name));
  await setViewDate(TODAY);

  if (!user) {
    setMessage(message, "신청하려면 로그인이 필요합니다.", "info");
  }
}

function initAuthPage(user) {
  const authForm = document.querySelector(".auth-form");
  if (!authForm) return;

  if (user) {
    location.replace("index.html");
    return;
  }

  const isSignup = Boolean(authForm.elements["passwordConfirm"]);
  const authMessage = document.getElementById("auth-message");
  const submitButton = authForm.querySelector('button[type="submit"]');

  function fail(field, text) {
    setMessage(authMessage, text, "error");
    if (field) field.focus();
  }

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const studentId = authForm.elements["studentId"];
    const password = authForm.elements["password"];
    const id = studentId.value.trim();

    if (!STUDENT_ID_PATTERN.test(id)) {
      return fail(studentId, "학번 형식이 올바르지 않습니다. 학년(1~3)+반(1~6)+번호(2자리)로 입력해 주세요. (예: 2207)");
    }

    if (isSignup) {
      const name = authForm.elements["name"];
      const passwordConfirm = authForm.elements["passwordConfirm"];

      if (!name.value.trim()) {
        return fail(name, "이름을 입력해 주세요.");
      }
      if (password.value.length < MIN_PASSWORD_LENGTH) {
        return fail(password, `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`);
      }
      if (password.value !== passwordConfirm.value) {
        return fail(passwordConfirm, "비밀번호가 서로 일치하지 않습니다.");
      }

      submitButton.disabled = true;
      const { data, error } = await db.auth.signUp({
        email: toEmail(id),
        password: password.value,
        options: { data: { student_id: id, name: name.value.trim() } },
      });
      submitButton.disabled = false;

      if (error) {
        const text = /already registered/i.test(error.message)
          ? "이미 가입된 학번입니다. 로그인해 주세요."
          : `회원가입에 실패했습니다. (${error.message})`;
        return fail(null, text);
      }
      if (!data.session) {
        return fail(null, "가입은 되었지만 자동 로그인에 실패했습니다. 로그인 페이지에서 로그인해 주세요.");
      }

      location.href = "index.html";
      return;
    }

    if (!password.value) {
      return fail(password, "비밀번호를 입력해 주세요.");
    }

    submitButton.disabled = true;
    const { error } = await db.auth.signInWithPassword({
      email: toEmail(id),
      password: password.value,
    });
    submitButton.disabled = false;

    if (error) {
      const text = /invalid login credentials/i.test(error.message)
        ? "학번 또는 비밀번호가 올바르지 않습니다."
        : `로그인에 실패했습니다. (${error.message})`;
      return fail(null, text);
    }

    location.href = "index.html";
  });
}

async function initMyPage(user) {
  const list = document.getElementById("my-list");
  if (!list) return;

  const message = document.getElementById("my-message");

  if (!user) {
    list.textContent = "로그인하면 내가 신청한 내역을 볼 수 있습니다.";
    return;
  }

  function renderItem(item) {
    const card = document.createElement("div");
    card.className = "my-item";

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${item.reserve_date} ${PERIODS[item.period - 1]} · ${item.rooms.name}`;
    const detail = document.createElement("p");
    detail.textContent = `${item.purpose} / ${item.members}${item.teacher ? ` / 담당 교사 ${item.teacher}` : ""}`;
    info.append(title, detail);
    card.appendChild(info);

    if (item.reserve_date >= TODAY) {
      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "secondary";
      cancelButton.textContent = "취소하기";
      cancelButton.addEventListener("click", async () => {
        if (!window.confirm(`${item.reserve_date} ${item.rooms.name} 신청을 취소할까요?`)) return;

        cancelButton.disabled = true;
        const { error } = await db.from("reservations").delete().eq("id", item.id);
        if (error) {
          cancelButton.disabled = false;
          setMessage(message, `취소에 실패했습니다. (${error.message})`, "error");
          return;
        }
        await loadList();
        setMessage(message, "신청이 취소되었습니다.", "success");
      });
      card.appendChild(cancelButton);
    }
    return card;
  }

  async function loadList() {
    const { data, error } = await db
      .from("reservations")
      .select("id, reserve_date, period, purpose, members, teacher, rooms(name)")
      .eq("user_id", user.id)
      .order("reserve_date", { ascending: false })
      .order("period");

    list.innerHTML = "";
    if (error) {
      setMessage(message, `신청 내역을 불러오지 못했습니다. (${error.message})`, "error");
      return;
    }
    if (data.length === 0) {
      list.textContent = "신청한 내역이 없습니다.";
      return;
    }
    data.forEach((item) => list.appendChild(renderItem(item)));
  }

  await loadList();
}

(async function init() {
  const user = await setupNav();
  await initStatusPage(user);
  initAuthPage(user);
  await initMyPage(user);
})();
