const ROOMS = ["그룹스터디룸 1", "그룹스터디룸 2", "세미나실", "화학실험실", "물리실험실"];
const PERIODS = ["1교시", "2교시", "3교시", "4교시", "5교시", "6교시", "7교시"];
const STUDENT_ID_PATTERN = /^\d{4}$/;
const MIN_PASSWORD_LENGTH = 6;

const reservations = [
  { room: "그룹스터디룸 1", period: "5교시", purpose: "수학 문제 풀이", members: "2201 이서연", teacher: "" },
  { room: "그룹스터디룸 2", period: "2교시", purpose: "팀 프로젝트 회의", members: "2203 박민준, 2204 최유진", teacher: "" },
  { room: "화학실험실", period: "4교시", purpose: "화학실험 보고서 작성", members: "2207 김의현", teacher: "김선생" },
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
  let selected = null;

  function isBooked(room, period) {
    return reservations.some((r) => r.room === room && r.period === period);
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
    const reservation = reservations.find((r) => r.room === room && r.period === period);
    if (!reservation) return;

    selected = { room, period };

    const title = document.createElement("h3");
    title.textContent = `${room} · ${period}`;

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
      room: data.get("room"),
      period: data.get("period"),
      purpose: data.get("purpose").trim(),
      members: data.get("members").trim(),
      teacher: data.get("teacher").trim(),
    };

    if (isBooked(reservation.room, reservation.period)) {
      setMessage(message, `${reservation.room} ${reservation.period}는 이미 신청되어 있습니다.`, "error");
      return;
    }

    reservations.push(reservation);
    renderTable();
    form.reset();
    setMessage(message, `${reservation.room} ${reservation.period} 신청이 완료되었습니다.`, "success");
  });

  fillOptions(form.elements["room"], ROOMS);
  fillOptions(form.elements["period"], PERIODS);
  renderTable();
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
      return fail(studentId, "학번은 숫자 4자리로 입력해 주세요. (예: 2207)");
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
