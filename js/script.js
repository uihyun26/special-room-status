const ROOMS = ["그룹스터디룸 1", "그룹스터디룸 2", "세미나실", "화학실험실", "물리실험실"];
const PERIODS = ["1교시", "2교시", "3교시", "4교시", "5교시", "6교시", "7교시"];
const STUDENT_ID_PATTERN = /^[1-3][1-6](0[1-9]|[1-9]\d)$/;
const MIN_PASSWORD_LENGTH = 6;

function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const TODAY = formatDate(new Date());

const reservations = [
  { date: TODAY, room: "그룹스터디룸 1", period: "5교시", purpose: "수학 문제 풀이", members: "2201 이서연", teacher: "" },
  { date: TODAY, room: "그룹스터디룸 2", period: "2교시", purpose: "팀 프로젝트 회의", members: "2203 박민준, 2204 최유진", teacher: "" },
  { date: TODAY, room: "화학실험실", period: "4교시", purpose: "화학실험 보고서 작성", members: "2207 김의현", teacher: "김선생" },
];

function setMessage(element, text, type) {
  element.textContent = text;
  element.className = "form-message " + type;
}

const statusTable = document.getElementById("status-table");

if (statusTable) {
  const form = document.querySelector(".apply-form");
  const message = document.getElementById("form-message");
  const detailPanel = document.getElementById("detail-panel");
  const viewDateInput = document.getElementById("view-date");
  let viewDate = TODAY;
  let selected = null;

  function isBooked(date, room, period) {
    return reservations.some((r) => r.date === date && r.room === room && r.period === period);
  }

  function countMembers(members) {
    return members.split(",").map((m) => m.trim()).filter(Boolean).length;
  }

  function addDetailRow(list, label, value) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    list.append(dt, dd);
  }

  function closeDetail() {
    selected = null;
    detailPanel.hidden = true;
    detailPanel.innerHTML = "";
    renderTable();
  }

  function showDetail(room, period) {
    const reservation = reservations.find((r) => r.date === viewDate && r.room === room && r.period === period);
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
    ROOMS.forEach((room) => {
      const row = body.insertRow();
      const roomCell = document.createElement("th");
      roomCell.textContent = room;
      row.appendChild(roomCell);

      PERIODS.forEach((period) => {
        const cell = row.insertCell();
        if (!isBooked(viewDate, room, period)) return;

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

  function fillOptions(select, items) {
    items.forEach((item) => {
      const option = document.createElement("option");
      option.value = item;
      option.textContent = item;
      select.appendChild(option);
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const reservation = {
      date: data.get("date"),
      room: data.get("room"),
      period: data.get("period"),
      purpose: data.get("purpose").trim(),
      members: data.get("members").trim(),
      teacher: data.get("teacher").trim(),
    };

    if (reservation.date < TODAY) {
      setMessage(message, "지난 날짜는 신청할 수 없습니다.", "error");
      return;
    }

    if (isBooked(reservation.date, reservation.room, reservation.period)) {
      setMessage(
        message,
        `${reservation.date} ${reservation.room} ${reservation.period}는 이미 신청되어 있습니다.`,
        "error"
      );
      return;
    }

    reservations.push(reservation);
    form.reset();
    form.elements["date"].value = reservation.date;
    setViewDate(reservation.date);
    setMessage(
      message,
      `${reservation.date} ${reservation.room} ${reservation.period} 신청이 완료되었습니다.`,
      "success"
    );
  });

  function setViewDate(date) {
    viewDate = date;
    viewDateInput.value = date;
    closeDetail();
  }

  viewDateInput.min = TODAY;
  viewDateInput.addEventListener("change", () => {
    if (viewDateInput.value) setViewDate(viewDateInput.value);
  });

  form.elements["date"].min = TODAY;
  form.elements["date"].value = TODAY;
  fillOptions(form.elements["room"], ROOMS);
  fillOptions(form.elements["period"], PERIODS);
  setViewDate(TODAY);
}

const authForm = document.querySelector(".auth-form");

if (authForm) {
  const isSignup = Boolean(authForm.elements["passwordConfirm"]);
  const authMessage = document.getElementById("auth-message");

  function fail(field, text) {
    setMessage(authMessage, text, "error");
    field.focus();
  }

  authForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const studentId = authForm.elements["studentId"];
    const password = authForm.elements["password"];

    if (!STUDENT_ID_PATTERN.test(studentId.value.trim())) {
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

      authForm.reset();
      setMessage(authMessage, "입력 확인이 완료되었습니다. 실제 계정 생성은 DB 연동 단계에서 구현됩니다.", "success");
      return;
    }

    if (!password.value) {
      return fail(password, "비밀번호를 입력해 주세요.");
    }

    authForm.reset();
    setMessage(authMessage, "입력 확인이 완료되었습니다. 실제 로그인은 DB 연동 단계에서 구현됩니다.", "success");
  });
}
