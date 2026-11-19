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
  const findPeriodSelect = document.getElementById("find-period");
  const freeRooms = document.getElementById("free-rooms");
  const membersInput = form.elements["members"];
  const groupSelect = document.getElementById("group-select");
  const groupName = document.getElementById("group-name");
  const groupSaveButton = document.getElementById("group-save");
  const groupDeleteButton = document.getElementById("group-delete");
  const groupMessage = document.getElementById("group-message");

  let rooms = [];
  let groups = [];
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
      if (text === findPeriodSelect.value) th.classList.add("focus-col");
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
        if (period === findPeriodSelect.value) cell.classList.add("focus-col");
        if (!isBooked(room, period)) return;

        cell.classList.add("booked");
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

    renderFreeRooms();
  }

  function useRoom(room, period) {
    form.elements["date"].value = viewDate;
    form.elements["room"].value = room;
    form.elements["period"].value = period;
    document.getElementById("apply-section").scrollIntoView({ behavior: "smooth" });
    form.elements["purpose"].focus({ preventScroll: true });
  }

  function renderFreeRooms() {
    freeRooms.innerHTML = "";
    const period = findPeriodSelect.value;
    if (!period) return;

    const free = rooms.filter((r) => !isBooked(r.name, period));

    const title = document.createElement("p");
    title.className = "free-title";
    title.textContent = free.length
      ? `${viewDate} ${period}에 비어 있는 특별실 ${free.length}곳 (누르면 신청 폼에 자동으로 채워집니다)`
      : `${viewDate} ${period}에는 비어 있는 특별실이 없습니다.`;
    freeRooms.appendChild(title);

    const list = document.createElement("div");
    list.className = "free-list";
    free.forEach(({ name }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "free-room-button";
      button.textContent = `${name} 신청하기`;
      button.addEventListener("click", () => useRoom(name, period));
      list.appendChild(button);
    });
    freeRooms.appendChild(list);
  }

  function renderGroups(selectedId) {
    groupSelect.innerHTML = "";
    groupSelect.appendChild(new Option("그룹 선택 (선택 사항)", ""));
    groups.forEach((g) => groupSelect.appendChild(new Option(g.name, String(g.id))));
    if (selectedId !== undefined) groupSelect.value = String(selectedId);
  }

  async function loadGroups(selectedId) {
    if (!user) return;
    const { data, error } = await db.from("member_groups").select("id, name, members").order("name");
    if (error) {
      setMessage(groupMessage, `그룹을 불러오지 못했습니다. (${error.message})`, "error");
      return;
    }
    groups = data;
    renderGroups(selectedId);
  }

  async function saveGroup() {
    const name = groupName.value.trim();
    const members = membersInput.value.trim();

    if (!name) {
      setMessage(groupMessage, "그룹 이름을 입력해 주세요.", "error");
      groupName.focus();
      return;
    }
    if (!members) {
      setMessage(groupMessage, "저장할 사용 인원 명단을 먼저 입력해 주세요.", "error");
      membersInput.focus();
      return;
    }

    groupSaveButton.disabled = true;
    const { data, error } = await db.from("member_groups").insert({ name, members }).select("id").single();
    groupSaveButton.disabled = false;

    if (error) {
      const text =
        error.code === "23505"
          ? "같은 이름의 그룹이 이미 있습니다. 다른 이름을 입력해 주세요."
          : `그룹 저장에 실패했습니다. (${error.message})`;
      setMessage(groupMessage, text, "error");
      return;
    }

    groupName.value = "";
    await loadGroups(data.id);
    setMessage(groupMessage, `"${name}" 그룹을 저장했습니다.`, "success");
  }

  async function deleteGroup() {
    const group = groups.find((g) => String(g.id) === groupSelect.value);
    if (!group) {
      setMessage(groupMessage, "삭제할 그룹을 먼저 선택해 주세요.", "error");
      return;
    }
    if (!window.confirm(`"${group.name}" 그룹을 삭제할까요?`)) return;

    groupDeleteButton.disabled = true;
    const { error } = await db.from("member_groups").delete().eq("id", group.id);
    groupDeleteButton.disabled = false;

    if (error) {
      setMessage(groupMessage, `그룹 삭제에 실패했습니다. (${error.message})`, "error");
      return;
    }
    await loadGroups();
    setMessage(groupMessage, `"${group.name}" 그룹을 삭제했습니다.`, "success");
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
    const teacherName = data.get("teacher").trim();

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
    const notice = teacherName ? ` ${teacherName} 선생님의 교사 알림함에 표시됩니다.` : "";
    setMessage(message, `${reserveDate} ${room.name} ${periodLabel} 신청이 완료되었습니다.${notice}`, "success");
  });

  viewDateInput.min = TODAY;
  viewDateInput.addEventListener("change", () => {
    if (viewDateInput.value) setViewDate(viewDateInput.value);
  });

  findPeriodSelect.addEventListener("change", renderTable);

  groupSelect.addEventListener("change", () => {
    const group = groups.find((g) => String(g.id) === groupSelect.value);
    if (!group) return;
    membersInput.value = group.members;
    setMessage(groupMessage, `"${group.name}" 그룹의 명단을 불러왔습니다.`, "info");
  });
  groupSaveButton.addEventListener("click", saveGroup);
  groupDeleteButton.addEventListener("click", deleteGroup);
  groupName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveGroup();
    }
  });

  form.elements["date"].min = TODAY;
  form.elements["date"].value = TODAY;
  fillOptions(form.elements["period"], PERIODS);
  fillOptions(findPeriodSelect, PERIODS);

  if (user) {
    await loadGroups();
  } else {
    [groupSelect, groupName, groupSaveButton, groupDeleteButton].forEach((el) => (el.disabled = true));
    setMessage(groupMessage, "로그인하면 자주 쓰는 인원 명단을 그룹으로 저장해 둘 수 있습니다.", "info");
  }

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

  const { data: rooms, error: roomError } = await db.from("rooms").select("id, name").order("sort_order");
  if (roomError) {
    setMessage(message, `특별실 목록을 불러오지 못했습니다. (${roomError.message})`, "error");
    return;
  }

  function addField(form, labelText, control) {
    const label = document.createElement("label");
    label.append(labelText, control);
    form.appendChild(label);
    return control;
  }

  function makeSelect(items, value) {
    const select = document.createElement("select");
    items.forEach(({ text, val }) => select.appendChild(new Option(text, String(val))));
    select.value = String(value);
    return select;
  }

  function renderEditForm(item, card) {
    const form = document.createElement("form");
    form.className = "edit-form";

    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.min = TODAY;
    dateInput.value = item.reserve_date;
    dateInput.required = true;

    const roomSelect = makeSelect(rooms.map((r) => ({ text: r.name, val: r.id })), item.room_id);
    const periodSelect = makeSelect(
      PERIODS.map((p, i) => ({ text: p, val: i + 1 })),
      item.period
    );

    const purposeInput = document.createElement("input");
    purposeInput.type = "text";
    purposeInput.value = item.purpose;
    purposeInput.required = true;

    const membersInput = document.createElement("textarea");
    membersInput.rows = 2;
    membersInput.value = item.members;
    membersInput.required = true;

    const teacherInput = document.createElement("input");
    teacherInput.type = "text";
    teacherInput.value = item.teacher || "";

    addField(form, "날짜", dateInput);
    addField(form, "특별실", roomSelect);
    addField(form, "교시", periodSelect);
    addField(form, "목적", purposeInput);
    addField(form, "사용 인원 명단", membersInput);
    addField(form, "담당 교사 (있는 경우)", teacherInput);

    const buttons = document.createElement("div");
    buttons.className = "edit-actions";
    const saveButton = document.createElement("button");
    saveButton.type = "submit";
    saveButton.className = "primary";
    saveButton.textContent = "저장";
    const cancelEdit = document.createElement("button");
    cancelEdit.type = "button";
    cancelEdit.className = "secondary";
    cancelEdit.textContent = "수정 취소";
    cancelEdit.addEventListener("click", () => loadList());
    buttons.append(saveButton, cancelEdit);
    form.appendChild(buttons);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (dateInput.value < TODAY) {
        setMessage(message, "지난 날짜로는 수정할 수 없습니다.", "error");
        return;
      }

      saveButton.disabled = true;
      const { data, error } = await db
        .from("reservations")
        .update({
          reserve_date: dateInput.value,
          room_id: Number(roomSelect.value),
          period: Number(periodSelect.value),
          purpose: purposeInput.value.trim(),
          members: membersInput.value.trim(),
          teacher: teacherInput.value.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .select("id");
      saveButton.disabled = false;

      if (error) {
        const text =
          error.code === "23505"
            ? "수정하려는 날짜·특별실·교시는 이미 다른 신청이 있습니다."
            : `수정에 실패했습니다. (${error.message})`;
        setMessage(message, text, "error");
        return;
      }
      if (data.length === 0) {
        setMessage(message, "수정할 수 없는 신청입니다. (본인 신청이 아니거나 이미 지난 신청)", "error");
        return;
      }

      await loadList();
      setMessage(message, "신청이 수정되었습니다.", "success");
    });

    card.classList.add("editing");
    card.innerHTML = "";
    card.appendChild(form);
    purposeInput.focus();
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
      const actions = document.createElement("div");
      actions.className = "my-actions";

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "secondary";
      editButton.textContent = "수정하기";
      editButton.addEventListener("click", () => renderEditForm(item, card));

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

      actions.append(editButton, cancelButton);
      card.appendChild(actions);
    }
    return card;
  }

  async function loadList() {
    const { data, error } = await db
      .from("reservations")
      .select("id, reserve_date, room_id, period, purpose, members, teacher, rooms(name)")
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

async function initTeacherPage() {
  const form = document.getElementById("teacher-form");
  if (!form) return;

  const input = form.elements["teacher"];
  const list = document.getElementById("teacher-list");
  const message = document.getElementById("teacher-message");

  function readStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // 저장이 막힌 환경에서는 "새 신청" 표시 기준만 기억하지 못한다.
    }
  }

  async function load(name) {
    list.innerHTML = "";
    message.textContent = "";
    message.className = "form-message";

    const { data, error } = await db
      .from("reservations")
      .select("id, reserve_date, period, purpose, members, teacher, created_at, updated_at, rooms(name)")
      .not("teacher", "is", null)
      .gte("reserve_date", TODAY)
      .order("reserve_date")
      .order("period");

    if (error) {
      setMessage(message, `알림을 불러오지 못했습니다. (${error.message})`, "error");
      return;
    }

    const mine = data.filter((r) => r.teacher.includes(name));
    if (mine.length === 0) {
      setMessage(message, `"${name}" 선생님이 담당 교사로 지정된 오늘 이후의 신청이 없습니다.`, "info");
      return;
    }

    const seenKey = `teacherSeen:${name}`;
    const lastSeen = Number(readStorage(seenKey) || 0);
    let newest = lastSeen;
    let freshCount = 0;

    mine.forEach((r) => {
      const created = Date.parse(r.created_at);
      const updated = Date.parse(r.updated_at);
      let badge = "";
      if (created > lastSeen) badge = "새 신청";
      else if (updated > lastSeen && updated > created) badge = "수정됨";
      if (badge) freshCount += 1;
      newest = Math.max(newest, created, updated);

      const card = document.createElement("div");
      card.className = "my-item";

      const info = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = `${r.reserve_date} ${PERIODS[r.period - 1]} · ${r.rooms.name}`;
      if (badge) {
        const tag = document.createElement("span");
        tag.className = "badge";
        tag.textContent = badge;
        title.append(" ", tag);
      }
      const detail = document.createElement("p");
      detail.textContent = `${r.purpose} / 신청자: ${r.members}`;
      info.append(title, detail);
      card.appendChild(info);
      list.appendChild(card);
    });

    writeStorage(seenKey, String(newest));
    writeStorage("teacherName", name);
    setMessage(
      message,
      freshCount
        ? `"${name}" 선생님께 새로 들어오거나 수정된 신청이 ${freshCount}건 있습니다.`
        : `"${name}" 선생님의 신청 ${mine.length}건입니다. 새로 들어온 신청은 없습니다.`,
      freshCount ? "success" : "info"
    );
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) {
      setMessage(message, "선생님 성함을 입력해 주세요.", "error");
      input.focus();
      return;
    }
    load(name);
  });

  const saved = readStorage("teacherName");
  if (saved) {
    input.value = saved;
    await load(saved);
  }
}

(async function init() {
  const user = await setupNav();
  await initStatusPage(user);
  initAuthPage(user);
  await initMyPage(user);
  await initTeacherPage();
})();
