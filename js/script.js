const ROOMS = ["그룹스터디룸 1", "그룹스터디룸 2", "세미나실", "화학실험실", "물리실험실"];
const PERIODS = ["1교시", "2교시", "3교시", "4교시", "5교시", "6교시", "7교시"];

const reservations = [
  { room: "그룹스터디룸 1", period: "5교시", purpose: "수학 문제 풀이", members: "2201 이서연", teacher: "" },
  { room: "그룹스터디룸 2", period: "2교시", purpose: "팀 프로젝트 회의", members: "2203 박민준, 2204 최유진", teacher: "" },
  { room: "화학실험실", period: "4교시", purpose: "화학실험 보고서 작성", members: "2207 김의현", teacher: "김선생" },
];

const statusTable = document.getElementById("status-table");

if (statusTable) {
  const form = document.querySelector(".apply-form");
  const message = document.getElementById("form-message");

  function isBooked(room, period) {
    return reservations.some((r) => r.room === room && r.period === period);
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
        if (isBooked(room, period)) {
          cell.className = "booked";
          cell.textContent = "신청됨";
        }
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

  function showMessage(text, type) {
    message.textContent = text;
    message.className = "form-message " + type;
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
      showMessage(`${reservation.room} ${reservation.period}는 이미 신청되어 있습니다.`, "error");
      return;
    }

    reservations.push(reservation);
    renderTable();
    form.reset();
    showMessage(`${reservation.room} ${reservation.period} 신청이 완료되었습니다.`, "success");
  });

  fillOptions(form.elements["room"], ROOMS);
  fillOptions(form.elements["period"], PERIODS);
  renderTable();
}
