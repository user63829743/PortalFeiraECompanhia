const state = { records: [], fairs: [], section: "overview" };
let sponsorSelectedFiles = [];
const ADMIN_UI_BUILD = "news-no-resumo-2026-08-18";
document.documentElement.dataset.adminBuild = ADMIN_UI_BUILD;
console.info(`[Portal das Feiras] Admin ${ADMIN_UI_BUILD}`);

const $ = (selector) => document.querySelector(selector);

const statusLabels = { analyzing: "Em análise", approved: "Aprovada", rejected: "Recusada", active: "Ativa" };
const statusClasses = { analyzing: "pending", approved: "active", rejected: "inactive", active: "active" };

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404 && url.startsWith("/api/feirantes/")) throw new Error("Servidor Admin desatualizado: feche o npm run start:all, abra esta pasta do projeto e execute novamente. A rota de exclusão de Feirantes não existe no processo atual.");
    throw new Error(data.error || "Não foi possível concluir a operação.");
  }
  return data;
}

function setMessage(message, isError = true) {
  const element = $("#loginMessage");
  element.textContent = message;
  element.className = `form-message ${isError ? "error" : ""}`;
}

function showToast(message, isError = false) {
  const element = $("#toast");
  element.textContent = message;
  element.className = `toast ${isError ? "error" : ""}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => element.classList.add("hidden"), 3500);
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function formatDocument(value) {
  const digits = onlyDigits(value);
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return value || "—";
}

function formatPhone(value) {
  const digits = onlyDigits(value);
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return value || "—";
}

function formatCep(value) {
  const digits = onlyDigits(value);
  if (digits.length === 8) return digits.replace(/(\d{5})(\d{3})/, "$1-$2");
  return value || "—";
}

const scheduleDayLabels = { segunda: "Seg", terca: "Ter", quarta: "Qua", quinta: "Qui", sexta: "Sex", sabado: "Sáb", domingo: "Dom" };

function parseSchedule(value) {
  try {
    const parsed = JSON.parse(value || "");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch { return null; }
}

function scheduleSummary(value) {
  const schedule = parseSchedule(value);
  if (!schedule) return value || "—";
  const formatTime = (time) => {
    const text = String(time || "").trim();
    const match = text.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return text || "—";
    return match[2] === "00" ? `${Number(match[1])}h` : `${Number(match[1])}h${match[2]}`;
  };
  return Object.entries(schedule).map(([day, rawItem]) => {
    const item = rawItem || {};
    if (item.status === "closed" || item.closed === true || item.fechado === true) return `${scheduleDayLabels[day] || day}: Fechado`;
    const open = item.open || item.abertura || "";
    const close = item.close || item.fechamento || "";
    return `${scheduleDayLabels[day] || day}: ${formatTime(open)} às ${formatTime(close)}`;
  }).join(" · ");
}

function collectSchedule() {
  const schedule = {};
  document.querySelectorAll("#fairForm .schedule-row").forEach((row) => {
    schedule[row.dataset.day] = {
      status: row.querySelector("[data-schedule-status]").value,
      open: row.querySelector("[data-schedule-open]").value,
      close: row.querySelector("[data-schedule-close]").value
    };
  });
  return JSON.stringify(schedule);
}

function populateSchedule(value) {
  const schedule = parseSchedule(value) || {};
  document.querySelectorAll("#fairForm .schedule-row").forEach((row) => {
    const item = schedule[row.dataset.day] || { status: "open", open: "", close: "" };
    row.querySelector("[data-schedule-status]").value = item.status === "closed" ? "closed" : "open";
    row.querySelector("[data-schedule-open]").value = item.open || "";
    row.querySelector("[data-schedule-close]").value = item.close || "";
    const disabled = item.status === "closed";
    row.querySelector("[data-schedule-open]").disabled = disabled;
    row.querySelector("[data-schedule-close]").disabled = disabled;
  });
}

function collectStallSchedule(form) {
  const rows = form.querySelectorAll("[data-stall-day]");
  const hasStructuredValue = Array.from(rows).some((row) => row.querySelector("[data-stall-schedule-status]").value === "closed" || row.querySelector("[data-stall-schedule-open]").value || row.querySelector("[data-stall-schedule-close]").value);
  if (!hasStructuredValue && form.dataset.legacyDaysHours && !parseSchedule(form.dataset.legacyDaysHours)) return form.dataset.legacyDaysHours;
  const schedule = {};
  rows.forEach((row) => {
    schedule[row.dataset.stallDay] = {
      status: row.querySelector("[data-stall-schedule-status]").value,
      open: row.querySelector("[data-stall-schedule-open]").value,
      close: row.querySelector("[data-stall-schedule-close]").value
    };
  });
  return JSON.stringify(schedule);
}

function populateStallSchedule(form, value) {
  const schedule = parseSchedule(value) || {};
  form.dataset.legacyDaysHours = value || "";
  form.querySelectorAll("[data-stall-day]").forEach((row) => {
    const item = schedule[row.dataset.stallDay] || { status: "open", open: "", close: "" };
    row.querySelector("[data-stall-schedule-status]").value = item.status === "closed" ? "closed" : "open";
    row.querySelector("[data-stall-schedule-open]").value = item.open || item.abertura || "";
    row.querySelector("[data-stall-schedule-close]").value = item.close || item.fechamento || "";
    const disabled = item.status === "closed";
    row.querySelector("[data-stall-schedule-open]").disabled = disabled;
    row.querySelector("[data-stall-schedule-close]").disabled = disabled;
  });
}

function bindStallScheduleControls(form) {
  form.querySelectorAll("[data-stall-schedule-status]").forEach((select) => select.addEventListener("change", () => {
    const row = select.closest("[data-stall-day]");
    const disabled = select.value === "closed";
    row.querySelector("[data-stall-schedule-open]").disabled = disabled;
    row.querySelector("[data-stall-schedule-close]").disabled = disabled;
  }));
}

function statusBadge(status) {
  return `<span class="badge ${statusClasses[status] || "pending"}"><span></span>${statusLabels[status] || status}</span>`;
}

function recordRow(record, compact = false) {
  return `<tr>
    <td><strong>${escapeHtml(record.businessName || record.name)}</strong><small>${escapeHtml(record.name)}</small></td>
    ${compact ? "" : `<td>${escapeHtml(formatDocument(record.document))}</td><td>${escapeHtml(formatPhone(record.phone))}</td>`}
    <td>${escapeHtml(record.category || "—")}</td>
    <td>${statusBadge(record.status)}</td>
    <td>${formatDate(record.createdAt)}</td>
    ${compact ? "" : `<td class="actions-cell"><button class="details-button" type="button" data-details-id="${record.id}">Ver detalhes</button><button class="details-button" type="button" data-edit-stall="${record.id}">Editar dados</button><select class="status-select" data-id="${record.id}" aria-label="Atualizar aprovação"><option value="analyzing" ${record.status === "analyzing" ? "selected" : ""}>Em análise</option><option value="rejected" ${record.status === "rejected" ? "selected" : ""}>Recusada</option></select><button class="text-danger" type="button" data-delete-registration="${record.id}">Excluir</button></td>`}
  </tr>`;
}

function tableMarkup(records, compact = false) {
  if (!records.length) return `<div class="empty"><strong>Nenhum cadastro encontrado</strong><span>Quando novos registros chegarem, eles aparecerão nesta área.</span></div>`;
  return `<div class="table-scroll"><table><thead><tr><th>Responsável / negócio</th>${compact ? "" : "<th>CPF / CNPJ</th><th>Telefone</th>"}<th>Categoria</th><th>Status</th><th>Recebido em</th>${compact ? "" : "<th>Ação</th>"}</tr></thead><tbody>${records.map((record) => recordRow(record, compact)).join("")}</tbody></table></div>`;
}

function feiranteRow(record) {
  return `<tr>
    <td><strong>${escapeHtml(record.name || "—")}</strong><small>${escapeHtml(record.businessName || "Sem empresa informada")}</small></td>
    <td>${escapeHtml(record.category || "—")}</td>
    <td>${escapeHtml(record.region || "—")}</td>
    <td class="feirante-hours-cell">${escapeHtml(scheduleSummary(record.daysHours))}</td>
    <td>${statusBadge(record.status)}</td>
    <td>${formatDate(record.updatedAt || record.createdAt)}</td>
    <td class="actions-cell"><button class="details-button" type="button" data-details-id="${record.id}">Ver detalhes</button><button class="details-button" type="button" data-edit-stall="${record.id}">Editar dados</button><select class="feirante-status-select" data-id="${record.id}" aria-label="Ativar ou inativar feirante"><option value="active" ${record.status === "active" ? "selected" : ""}>Ativa</option><option value="inactive" ${record.status === "inactive" ? "selected" : ""}>Inativa</option></select><button class="text-danger" type="button" data-delete-feirante="${record.id}">Excluir</button></td>
  </tr>`;
}

function feirantesTableMarkup(records) {
  if (!records.length) return `<div class="empty"><strong>Nenhum feirante aprovado encontrado</strong><span>Cadastros em análise e recusados ficam em Cadastros recebidos. Aprovados aparecem aqui.</span></div>`;
  return `<div class="table-scroll"><table><thead><tr><th>Feirante / negócio</th><th>Categoria</th><th>Região</th><th>Horários</th><th>Status</th><th>Atualizado em</th><th>Ações</th></tr></thead><tbody>${records.map(feiranteRow).join("")}</tbody></table></div>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

async function loadStats() {
  const stats = await api("/api/stats");
  $("#statsGrid").innerHTML = `<article class="stat-card"><span class="stat-icon red">∑</span><div><span>Total de cadastros</span><strong>${stats.total}</strong></div></article><article class="stat-card"><span class="stat-icon yellow">◷</span><div><span>Em análise</span><strong>${stats.analyzing}</strong></div></article><article class="stat-card"><span class="stat-icon green">✓</span><div><span>Aprovadas</span><strong>${stats.approved}</strong></div></article><article class="stat-card"><span class="stat-icon gray">×</span><div><span>Ativas no portal</span><strong>${stats.active}</strong></div></article>`;
}

async function loadRecords(target, searchId, statusId, compact = false, view = "all") {
  const search = encodeURIComponent($(searchId).value);
  const status = encodeURIComponent($(statusId).value);
  $(target).innerHTML = `<div class="loading">Carregando registros...</div>`;
  const data = await api(`/api/registrations?q=${search}&status=${status}&view=${view}`);
  state.records = data.records;
  $(target).innerHTML = tableMarkup(data.records, compact);
  if (!compact) {
    bindApprovalStatusSelects();
    bindDetailsButtons();
    bindDeleteRegistrationButtons();
  }
}

async function loadFeirantes() {
  const query = encodeURIComponent($("#feirantesSearch").value);
  const status = encodeURIComponent($("#feirantesStatus").value);
  $("#feirantesTable").innerHTML = `<div class="loading">Carregando feirantes...</div>`;
  const data = await api(`/api/feirantes?q=${query}&status=${status}`);
  state.records = data.feirantes;
  $("#feirantesTable").innerHTML = feirantesTableMarkup(data.feirantes);
  bindFeiranteStatusSelects();
  bindDeleteFeiranteButtons();
  bindDetailsButtons();
}

async function refreshAll() {
  try {
    await loadStats();
    await loadRecords("#recentTable", "#registrationsSearch", "#registrationsStatus", true);
  } catch (error) { showToast(error.message, true); }
}

function bindDetailsButtons() {
  document.querySelectorAll("[data-details-id]").forEach((button) => button.addEventListener("click", () => {
    const record = state.records.find((item) => String(item.id) === String(button.dataset.detailsId));
    if (record) openDetails(record);
  }));
  document.querySelectorAll("[data-edit-stall]").forEach((button) => button.addEventListener("click", () => {
    const record = state.records.find((item) => String(item.id) === String(button.dataset.editStall));
    if (record) openStallModal(record);
  }));
}

function detailField(label, value, multiline = false) {
  return `<div class="detail-field ${multiline ? "wide" : ""}"><span>${label}</span><strong>${escapeHtml(value || "—")}</strong></div>`;
}

function openDetails(record) {
  $("#detailsTitle").textContent = record.businessName || record.name || "Detalhes da banca";
  $("#detailsStatus").value = record.databaseStatus === "approved" ? "approved" : (record.status === "rejected" ? "rejected" : "analyzing");
  $("#detailsContent").innerHTML = `<div class="details-grid">
    ${detailField("ID do cadastro", record.id)}
    ${detailField("Consentimento", record.consentGiven === 1 || record.consentGiven === true ? "Autorizado" : "Não informado")}
    ${detailField("Responsável", record.name)}
    ${detailField("Empresa / negócio", record.businessName)}
    ${detailField("CPF / CNPJ", formatDocument(record.document))}
    ${detailField("E-mail", record.email)}
    ${detailField("Telefone", formatPhone(record.phone))}
    ${detailField("Região", record.region)}
    ${detailField("Categoria", record.category)}
    ${detailField("Dias e horários", record.daysHours)}
    ${detailField("Recebido em", formatDate(record.createdAt))}
    ${detailField("Última atualização", formatDate(record.updatedAt))}
    ${detailField("Descrição", record.description, true)}
  </div>`;
  $("#saveDetailsStatus").dataset.id = record.id;
  $("#editStallButton").dataset.id = record.id;
  $("#editStallButton").onclick = () => { closeDetails(); openStallModal(record); };
  $("#detailsModal").classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeDetails() {
  $("#detailsModal").classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function readImageDataUrl(file) {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
}

function readCompressedStallImageDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const maxDimension = 1600;
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("Não foi possível preparar a imagem."));
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function openStallModal(record) {
  const form = $("#stallForm");
  form.reset();
  form.elements.id.value = record?.id || "";
  form.elements.businessName.value = record?.businessName || "";
  form.elements.region.value = record?.region || "";
  form.elements.category.value = record?.category || "";
  form.elements.boothLocation.value = record?.boothLocation || "";
  form.elements.cep.value = record?.cep || "";
  form.elements.publicDescription.value = record?.publicDescription || record?.description || "";
  form.elements.description.value = record?.description || "";
  populateStallSchedule(form, record?.daysHours || "");
  form.elements.daysHours.value = record?.daysHours || "";
  form.elements.photo.value = "";
  form.elements.logo.value = "";
  $("#stallPhotoPreview").src = record?.photoUrl || "";
  $("#stallPhotoPreview").classList.toggle("hidden", !record?.photoUrl);
  $("#stallLogoPreview").src = record?.logoUrl || "";
  $("#stallLogoPreview").classList.toggle("hidden", !record?.logoUrl);
  $("#stallFormMessage").textContent = "";
  $("#stallModal").classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeStallModal() { $("#stallModal").classList.add("hidden"); document.body.classList.remove("modal-open"); }

async function saveStall(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  form.elements.daysHours.value = collectStallSchedule(form);
  const data = Object.fromEntries(new FormData(form).entries());
  const photo = form.elements.photo.files[0];
  const logo = form.elements.logo.files[0];
  for (const file of [photo, logo]) {
    if (file && file.size > 5 * 1024 * 1024) { $("#stallFormMessage").textContent = "Cada imagem deve ter no máximo 5 MB."; $("#stallFormMessage").className = "form-message error"; return; }
  }
  try {
    if (photo) data.photoDataUrl = await readCompressedStallImageDataUrl(photo);
    if (logo) data.logoDataUrl = await readCompressedStallImageDataUrl(logo);
  } catch {
    $("#stallFormMessage").textContent = "Não foi possível preparar uma das imagens. Escolha os arquivos novamente.";
    $("#stallFormMessage").className = "form-message error";
    return;
  }
  delete data.photo;
  delete data.logo;
  delete data.publicReady;
  const id = data.id; delete data.id;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  $("#stallFormMessage").textContent = "";
  try {
    await api(`/api/registrations/${id}/profile`, { method: "PATCH", body: JSON.stringify(data) });
    closeStallModal(); showToast("Dados da banca atualizados com sucesso.");
    await refreshAll();
    if (state.section === "feirantes") await loadFeirantes();
    if (state.section === "registrations") await loadRecords("#registrationsTable", "#registrationsSearch", "#registrationsStatus", false, "registrations");
  } catch (error) { $("#stallFormMessage").textContent = error.message; $("#stallFormMessage").className = "form-message error"; }
  finally { button.disabled = false; }
}

async function saveDetailsStatus() {
  const button = $("#saveDetailsStatus");
  const id = button.dataset.id;
  button.disabled = true;
  try {
    await api(`/api/registrations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: $("#detailsStatus").value }) });
    closeDetails();
    showToast("Status atualizado com sucesso.");
    await refreshAll();
    if (state.section === "feirantes") await loadFeirantes();
    if (state.section === "registrations") await loadRecords("#registrationsTable", "#registrationsSearch", "#registrationsStatus", false, "registrations");
  } catch (error) {
    showToast(error.message, true);
  } finally {
    button.disabled = false;
  }
}

function bindApprovalStatusSelects() {
  document.querySelectorAll(".status-select").forEach((select) => select.addEventListener("change", async () => {
    const id = select.dataset.id;
    select.disabled = true;
    try {
      await api(`/api/registrations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: select.value }) });
      showToast("Status do cadastro atualizado.");
      await refreshAll();
      if (state.section === "registrations") await loadRecords("#registrationsTable", "#registrationsSearch", "#registrationsStatus", false, "registrations");
    } catch (error) { showToast(error.message, true); select.disabled = false; }
  }));
}

function bindFeiranteStatusSelects() {
  document.querySelectorAll(".feirante-status-select").forEach((select) => select.addEventListener("change", async () => {
    const id = select.dataset.id;
    select.disabled = true;
    try {
      await api(`/api/feirantes/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: select.value }) });
      showToast(select.value === "active" ? "Feirante ativado no portal." : "Feirante inativado.");
      await refreshAll();
      if (state.section === "feirantes") await loadFeirantes();
    } catch (error) { showToast(error.message, true); select.disabled = false; }
  }));
}

function bindDeleteFeiranteButtons() {
  document.querySelectorAll("[data-delete-feirante]").forEach((button) => button.addEventListener("click", async () => {
    const id = button.dataset.deleteFeirante;
    const record = state.records.find((item) => String(item.id) === String(id));
    if (!record || !window.confirm(`Excluir definitivamente o feirante "${record.name || record.businessName}"?`)) return;
    button.disabled = true;
    try {
      await api(`/api/feirantes/${id}`, { method: "DELETE" });
      showToast("Feirante excluído do portal.");
      await refreshAll();
      if (state.section === "feirantes") await loadFeirantes();
    } catch (error) { showToast(error.message, true); button.disabled = false; }
  }));
}

function bindDeleteRegistrationButtons() {
  document.querySelectorAll("[data-delete-registration]").forEach((button) => button.addEventListener("click", async () => {
    const id = button.dataset.deleteRegistration;
    const record = state.records.find((item) => String(item.id) === String(id));
    if (!record || !window.confirm(`Excluir o cadastro de "${record.name || record.businessName}"?`)) return;
    button.disabled = true;
    try {
      await api(`/api/registrations/${id}`, { method: "DELETE" });
      showToast("Cadastro excluído.");
      await refreshAll();
      if (state.section === "registrations") await loadRecords("#registrationsTable", "#registrationsSearch", "#registrationsStatus", false, "registrations");
    } catch (error) { showToast(error.message, true); button.disabled = false; }
  }));
}

function fairRow(fair) {
  return `<tr>
    <td><div class="fair-row-main">${fair.photoUrl ? `<img class="fair-thumb" src="${escapeHtml(fair.photoUrl)}" alt="">` : `<span class="fair-thumb-placeholder">F</span>`}<span><strong>${escapeHtml(fair.name)}</strong><small>${escapeHtml(fair.region)}</small></span></div></td>
    <td>${escapeHtml(fair.cep ? `${formatCep(fair.cep)}${fair.address ? ` · ${fair.address}` : ""}` : (fair.address || "—"))}</td>
    <td class="fair-hours-cell">${escapeHtml(scheduleSummary(fair.daysHours))}</td>
    <td>${statusBadge(fair.status)}</td>
    <td>${fair.isFeatured && fair.status === "active" ? '<span class="status-badge active">Destaque</span>' : '<span class="muted">—</span>'}</td>
    <td>${formatDate(fair.updatedAt || fair.createdAt)}</td>
    <td class="actions-cell"><button class="details-button" type="button" data-edit-fair="${fair.id}">Editar</button><button class="text-danger" type="button" data-delete-fair="${fair.id}">Excluir</button></td>
  </tr>`;
}

function fairsTableMarkup(fairs) {
  if (!fairs.length) return `<div class="empty"><strong>Nenhuma feira encontrada</strong><span>Cadastre a primeira feira para começar a organizar o portal.</span></div>`;
  return `<div class="table-scroll"><table><thead><tr><th>Feira / região</th><th>CEP / endereço</th><th>Dias e horários</th><th>Status</th><th>Destaque</th><th>Atualizada em</th><th>Ações</th></tr></thead><tbody>${fairs.map(fairRow).join("")}</tbody></table></div>`;
}

async function loadFairs() {
  const query = encodeURIComponent($("#fairsSearch").value);
  const status = encodeURIComponent($("#fairsStatus").value);
  $("#fairsTable").innerHTML = `<div class="loading">Carregando feiras...</div>`;
  const data = await api(`/api/fairs?q=${query}&status=${status}`);
  state.fairs = data.fairs;
  $("#fairsTable").innerHTML = fairsTableMarkup(data.fairs);
  document.querySelectorAll("[data-edit-fair]").forEach((button) => button.addEventListener("click", () => {
    const fair = state.fairs.find((item) => String(item.id) === String(button.dataset.editFair));
    if (fair) openFairModal(fair);
  }));
  document.querySelectorAll("[data-delete-fair]").forEach((button) => button.addEventListener("click", async () => {
    const fair = state.fairs.find((item) => String(item.id) === String(button.dataset.deleteFair));
    if (!fair || !window.confirm(`Excluir a feira "${fair.name}"?`)) return;
    try {
      await api(`/api/fairs/${fair.id}`, { method: "DELETE" });
      showToast("Feira excluída com sucesso.");
      await loadFairs();
    } catch (error) { showToast(error.message, true); }
  }));
}

function openFairModal(fair = null) {
  const form = $("#fairForm");
  form.reset();
  form.elements.id.value = fair?.id || "";
  form.elements.name.value = fair?.name || "";
  form.elements.region.value = fair?.region || "";
  form.elements.address.value = fair?.address || "";
  form.elements.cep.value = formatCep(fair?.cep || "").replace("—", "");
  form.elements.daysHours.value = fair?.daysHours || "";
  populateSchedule(fair?.daysHours || "");
  form.elements.status.value = fair?.status || "active";
  if (form.elements.isFeatured) form.elements.isFeatured.checked = fair?.isFeatured === true;
  form.elements.description.value = fair?.description || "";
  form.elements.photo.value = "";
  const preview = $("#fairPhotoPreview");
  preview.src = fair?.photoUrl || "";
  preview.classList.toggle("hidden", !fair?.photoUrl);
  $("#fairModalTitle").textContent = fair ? "Editar feira" : "Nova feira";
  $("#fairFormMessage").textContent = "";
  $("#fairModal").classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeFairModal() {
  $("#fairModal").classList.add("hidden");
  document.body.classList.remove("modal-open");
}

async function saveFair(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  form.elements.daysHours.value = collectSchedule();
  const wantsFeatured = Boolean(form.elements.isFeatured?.checked) && form.elements.status.value === "active";
  const currentFeaturedCount = state.fairs.filter((item) => item.isFeatured && item.status === "active" && String(item.id) !== String(form.elements.id.value)).length;
  if (wantsFeatured && currentFeaturedCount >= 3) {
    $("#fairFormMessage").textContent = "Já existem três feiras ativas em destaque. Desmarque outra antes de destacar esta.";
    $("#fairFormMessage").className = "form-message error";
    return;
  }
  const data = Object.fromEntries(new FormData(form).entries());
  const photo = form.elements.photo.files[0];
  if (photo) {
    if (photo.size > 5 * 1024 * 1024) { $("#fairFormMessage").textContent = "A foto deve ter no máximo 5 MB."; $("#fairFormMessage").className = "form-message error"; return; }
    data.photoDataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(photo); });
  }
  delete data.photo;
  const id = data.id;
  delete data.id;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  $("#fairFormMessage").textContent = "";
  try {
    await api(id ? `/api/fairs/${id}` : "/api/fairs", { method: id ? "PATCH" : "POST", body: JSON.stringify(data) });
    closeFairModal();
    showToast(id ? "Feira atualizada com sucesso." : "Feira cadastrada com sucesso.");
    if (state.section === "fairs") await loadFairs();
  } catch (error) {
    $("#fairFormMessage").textContent = error.message;
    $("#fairFormMessage").className = "form-message error";
  } finally { button.disabled = false; }
}

function sponsorRow(sponsor) {
  const placementLabels = { home_bottom: "Home", home_split: "Home — grade", home_top: "Topo", feirantes_inline: "Feirantes", news_sidebar: "Notícias", news_sidebar_top: "Notícias — lateral superior", news_sidebar_bottom: "Notícias — lateral inferior", all: "Todas" };
  const modeLabel = sponsor.displayMode === "rotate" ? `Alterna ${sponsor.rotationSeconds || 8}s` : sponsor.displayMode === "divided" ? "Divide lado a lado" : "Fixo";
  return `<tr><td><div class="sponsor-row-main"><img class="sponsor-thumb" src="${escapeHtml(sponsor.imageUrl)}" alt="Banner de ${escapeHtml(sponsor.name)}"><span><strong>${escapeHtml(sponsor.name)}</strong><small>${escapeHtml(sponsor.campaignGroup || "default")} · ordem ${sponsor.displayOrder}</small></span></div></td><td>${escapeHtml(placementLabels[sponsor.placement] || sponsor.placement || "Home")}</td><td>${escapeHtml(modeLabel)}</td><td>${statusBadge(sponsor.status)}</td><td>${formatDate(sponsor.updatedAt || sponsor.createdAt)}</td><td class="actions-cell"><button class="details-button" type="button" data-edit-sponsor="${sponsor.id}">Editar</button><button class="text-danger" type="button" data-delete-sponsor="${sponsor.id}">Excluir</button></td></tr>`;
}

function sponsorsTableMarkup(sponsors) {
  if (!sponsors.length) return `<div class="empty"><strong>Nenhum patrocinador encontrado</strong><span>Cadastre um banner para começar a exibir publicidade na Home.</span></div>`;
  return `<div class="table-scroll"><table><thead><tr><th>Patrocinador</th><th>Posição</th><th>Exibição</th><th>Status</th><th>Atualizado em</th><th>Ações</th></tr></thead><tbody>${sponsors.map(sponsorRow).join("")}</tbody></table></div>`;
}

async function loadSponsors() {
  const query = encodeURIComponent($("#sponsorsSearch").value);
  const status = encodeURIComponent($("#sponsorsStatus").value);
  $("#sponsorsTable").innerHTML = `<div class="loading">Carregando patrocinadores...</div>`;
  const data = await api(`/api/sponsors?q=${query}&status=${status}`);
  state.sponsors = data.sponsors;
  $("#sponsorsTable").innerHTML = sponsorsTableMarkup(data.sponsors);
  document.querySelectorAll("[data-edit-sponsor]").forEach((button) => button.addEventListener("click", () => { const sponsor = state.sponsors.find((item) => String(item.id) === String(button.dataset.editSponsor)); if (sponsor) openSponsorModal(sponsor); }));
  document.querySelectorAll("[data-delete-sponsor]").forEach((button) => button.addEventListener("click", async () => { const sponsor = state.sponsors.find((item) => String(item.id) === String(button.dataset.deleteSponsor)); if (!sponsor || !window.confirm(`Excluir o patrocinador "${sponsor.name}"?`)) return; try { await api(`/api/sponsors/${sponsor.id}`, { method: "DELETE" }); showToast("Patrocinador excluído com sucesso."); await loadSponsors(); } catch (error) { showToast(error.message, true); } }));
}

function toLocalDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function currentLocalDateTime() { return toLocalDateTime(new Date()); }
function localDateTimeToIso(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
function setNewsToday() {
  const input = document.querySelector('#newsForm [name="publishedAt"]');
  if (input) input.value = currentLocalDateTime();
}

function renderSponsorPreview(existingUrl = "") {
  const gallery = $("#sponsorPreviewGallery");
  if (!gallery) return;
  const urls = sponsorSelectedFiles.length ? sponsorSelectedFiles.map((file) => URL.createObjectURL(file)) : (existingUrl ? [existingUrl] : []);
  gallery.innerHTML = urls.map((url, index) => `<img src="${escapeHtml(url)}" alt="Pré-visualização do banner ${index + 1}">`).join('');
  gallery.classList.toggle("hidden", !urls.length);
}

function syncSponsorFileInput() {
  const input = $("#sponsorImageInput");
  if (!input) return;
  const transfer = new DataTransfer();
  sponsorSelectedFiles.slice(0, 4).forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
  const count = $("#sponsorFileCount");
  const list = $("#sponsorFileList");
  if (count) count.textContent = sponsorSelectedFiles.length ? `${sponsorSelectedFiles.length} imagem${sponsorSelectedFiles.length === 1 ? '' : 's'} selecionada${sponsorSelectedFiles.length === 1 ? '' : 's'}` : "Nenhuma imagem selecionada";
  if (list) list.innerHTML = sponsorSelectedFiles.map((file, index) => `<div class="sponsor-file-item"><span>${escapeHtml(file.name)}</span><button type="button" data-remove-sponsor-file="${index}" aria-label="Remover ${escapeHtml(file.name)}">×</button></div>`).join('');
  list?.querySelectorAll('[data-remove-sponsor-file]').forEach((button) => button.addEventListener('click', () => { sponsorSelectedFiles.splice(Number(button.dataset.removeSponsorFile), 1); syncSponsorFileInput(); }));
}

function openSponsorModal(sponsor = null) {
  const form = $("#sponsorForm");
  sponsorSelectedFiles = [];
  form.reset();
  form.elements.id.value = sponsor?.id || "";
  form.elements.name.value = sponsor?.name || "";
  form.elements.targetUrl.value = sponsor?.targetUrl || "";
  form.elements.status.value = sponsor?.status || "active";
  form.elements.displayOrder.value = sponsor?.displayOrder ?? 0;
  form.elements.placement.value = sponsor?.placement || "home_bottom";
  form.elements.campaignGroup.value = sponsor?.campaignGroup || "default";
  form.elements.displayMode.value = sponsor?.displayMode || "fixed";
  form.elements.rotationSeconds.value = sponsor?.rotationSeconds ?? 8;
  form.elements.startsAt.value = toLocalDateTime(sponsor?.startsAt);
  form.elements.endsAt.value = toLocalDateTime(sponsor?.endsAt);
  form.elements.image.required = !sponsor;
  form.elements.image.value = "";
  syncSponsorFileInput();
  renderSponsorPreview(sponsor?.imageUrl || "");
  $("#sponsorModalTitle").textContent = sponsor ? "Editar patrocinador" : "Novo patrocinador";
  $("#sponsorFormMessage").textContent = "";
  $("#sponsorModal").classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeSponsorModal() { $("#sponsorModal").classList.add("hidden"); document.body.classList.remove("modal-open"); }

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
}

async function saveSponsor(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form).entries());
  const files = [...(form.elements.image.files || [])];
  const id = data.id;
  delete data.id;
  delete data.image;
  if (!id && (!files.length || files.length > 4)) { $("#sponsorFormMessage").textContent = "Selecione de 1 a 4 banners para o grupo."; $("#sponsorFormMessage").className = "form-message error"; return; }
  if (files.some((file) => file.size > 5 * 1024 * 1024)) { $("#sponsorFormMessage").textContent = "Cada banner deve ter no máximo 5 MB."; $("#sponsorFormMessage").className = "form-message error"; return; }
  if (files.reduce((total, file) => total + file.size, 0) > 12 * 1024 * 1024) { $("#sponsorFormMessage").textContent = "O conjunto de banners deve ter no máximo 12 MB."; $("#sponsorFormMessage").className = "form-message error"; return; }
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    let createdCount = 0;
    if (id) {
      if (files[0]) data.imageDataUrl = await fileToDataUrl(files[0]);
      await api(`/api/sponsors/${id}`, { method: "PATCH", body: JSON.stringify(data) });
      for (let index = 1; index < files.length; index += 1) {
        const item = { ...data, displayOrder: Number(data.displayOrder || 0) + index, imageDataUrl: await fileToDataUrl(files[index]) };
        await api("/api/sponsors", { method: "POST", body: JSON.stringify(item) });
        createdCount += 1;
      }
    } else {
      const firstOrder = Number(data.displayOrder || 0);
      for (let index = 0; index < files.length; index += 1) {
        const item = { ...data, displayOrder: firstOrder + index, imageDataUrl: await fileToDataUrl(files[index]) };
        await api("/api/sponsors", { method: "POST", body: JSON.stringify(item) });
        createdCount += 1;
      }
    }
    closeSponsorModal(); showToast(id ? (createdCount ? `Patrocinador atualizado e ${createdCount} banner${createdCount === 1 ? '' : 's'} adicional${createdCount === 1 ? '' : 'is'} cadastrado${createdCount === 1 ? '' : 's'}.` : "Patrocinador atualizado com sucesso.") : `${files.length} banner${files.length === 1 ? '' : 's'} cadastrado${files.length === 1 ? '' : 's'} com sucesso.`); await loadSponsors();
  } catch (error) { $("#sponsorFormMessage").textContent = error.message; $("#sponsorFormMessage").className = "form-message error"; } finally { button.disabled = false; }
}

function newsRow(article) {
  return `<tr><td><div class="news-row-main">${article.imageUrl ? `<img class="news-thumb" src="${escapeHtml(article.imageUrl)}" alt="">` : `<span class="news-thumb-placeholder">N</span>`}<span><strong>${escapeHtml(article.title)}</strong><small>${escapeHtml(article.category)}</small></span></div></td><td>${statusBadge(article.status === "published" ? "active" : "inactive")}</td><td>${formatDate(article.publishedAt || article.updatedAt)}</td><td class="actions-cell"><button class="details-button" type="button" data-edit-news="${article.id}">Editar</button><button class="text-danger" type="button" data-delete-news="${article.id}">Excluir</button></td></tr>`;
}

function newsTableMarkup(articles) {
  if (!articles.length) return `<div class="empty"><strong>Nenhuma notícia encontrada</strong><span>Crie uma notícia para publicar conteúdo na Home.</span></div>`;
  return `<div class="table-scroll"><table><thead><tr><th>Notícia</th><th>Status</th><th>Publicação</th><th>Ações</th></tr></thead><tbody>${articles.map(newsRow).join("")}</tbody></table></div>`;
}

async function loadNews() {
  const query = encodeURIComponent($("#newsSearch").value);
  const status = encodeURIComponent($("#newsStatus").value);
  $("#newsTable").innerHTML = `<div class="loading">Carregando notícias...</div>`;
  const data = await api(`/api/news?q=${query}&status=${status}`);
  state.news = data.articles;
  $("#newsTable").innerHTML = newsTableMarkup(data.articles);
  document.querySelectorAll("[data-edit-news]").forEach((button) => button.addEventListener("click", () => { const article = state.news.find((item) => String(item.id) === String(button.dataset.editNews)); if (article) openNewsModal(article); }));
  document.querySelectorAll("[data-delete-news]").forEach((button) => button.addEventListener("click", async () => { const article = state.news.find((item) => String(item.id) === String(button.dataset.deleteNews)); if (!article || !window.confirm(`Excluir a notícia "${article.title}"?`)) return; try { await api(`/api/news/${article.id}`, { method: "DELETE" }); showToast("Notícia excluída com sucesso."); await loadNews(); } catch (error) { showToast(error.message, true); } }));
}

function openNewsModal(article = null) {
  const form = $("#newsForm");
  form.reset();
  form.elements.id.value = article?.id || "";
  form.elements.title.value = article?.title || "";
  form.elements.location.value = article?.location || "Distrito Federal";
  form.elements.category.value = article?.category || "Portal das Feiras";
  form.elements.author.value = article?.author || "Redação";
  form.elements.content.value = article?.content || "";
  form.elements.status.value = article?.status || "draft";
  form.elements.publishedAt.value = toLocalDateTime(article?.publishedAt);
  form.elements.image.value = "";
  form.elements.image.required = !article;
  $("#newsPreview").src = article?.imageUrl || "";
  $("#newsPreview").classList.toggle("hidden", !article?.imageUrl);
  $("#newsModalTitle").textContent = article ? "Editar notícia" : "Nova notícia";
  $("#newsFormMessage").textContent = "";
  $("#newsModal").classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeNewsModal() { $("#newsModal").classList.add("hidden"); document.body.classList.remove("modal-open"); }

async function saveNews(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form).entries());
  const image = form.elements.image.files[0];
  if (image) {
    if (image.size > 5 * 1024 * 1024) { $("#newsFormMessage").textContent = "A imagem deve ter no máximo 5 MB."; $("#newsFormMessage").className = "form-message error"; return; }
    data.imageDataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(image); });
  }
  delete data.image;
  if (data.publishedAt) data.publishedAt = localDateTimeToIso(data.publishedAt);
  const id = data.id;
  delete data.id;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try { await api(id ? `/api/news/${id}` : "/api/news", { method: id ? "PATCH" : "POST", body: JSON.stringify(data) }); closeNewsModal(); showToast(id ? "Notícia atualizada com sucesso." : "Notícia salva com sucesso."); await loadNews(); } catch (error) { $("#newsFormMessage").textContent = error.message; $("#newsFormMessage").className = "form-message error"; } finally { button.disabled = false; }
}

function showSection(section) {
  state.section = section;
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.section === section));
  document.querySelectorAll(".section-view").forEach((view) => view.classList.add("hidden"));
  $(`#${section}Section`).classList.remove("hidden");
  $("#sectionTitle").textContent = section === "overview" ? "Visão geral" : section === "feirantes" ? "Feirantes" : section === "fairs" ? "Feiras cadastradas" : section === "sponsors" ? "Patrocinadores" : section === "news" ? "Notícias" : "Cadastros recebidos";
  if (section === "feirantes") loadFeirantes().catch((error) => showToast(error.message, true));
  if (section === "registrations") loadRecords("#registrationsTable", "#registrationsSearch", "#registrationsStatus", false, "registrations").catch((error) => showToast(error.message, true));
  if (section === "fairs") loadFairs().catch((error) => showToast(error.message, true));
  if (section === "sponsors") loadSponsors().catch((error) => showToast(error.message, true));
  if (section === "news") loadNews().catch((error) => showToast(error.message, true));
}

async function openApp(username) {
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  $("#adminName").textContent = username || "Administrador";
  await refreshAll();
}

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  setMessage("");
  try { const data = await api("/api/login", { method: "POST", body: JSON.stringify(Object.fromEntries(form)) }); await openApp(data.username); }
  catch (error) { setMessage(error.message); button.disabled = false; }
});

$("#logoutButton").addEventListener("click", async () => { await api("/api/logout", { method: "POST" }); location.reload(); });
$("#saveDetailsStatus").addEventListener("click", saveDetailsStatus);
$("#stallForm").addEventListener("submit", saveStall);
bindStallScheduleControls($("#stallForm"));
$("#stallForm").elements.photo.addEventListener("change", (event) => { const file = event.currentTarget.files[0]; const preview = $("#stallPhotoPreview"); if (!file) { preview.classList.add("hidden"); return; } preview.src = URL.createObjectURL(file); preview.classList.remove("hidden"); });
$("#stallForm").elements.logo.addEventListener("change", (event) => { const file = event.currentTarget.files[0]; const preview = $("#stallLogoPreview"); if (!file) { preview.classList.add("hidden"); return; } preview.src = URL.createObjectURL(file); preview.classList.remove("hidden"); });
$("#newFairButton").addEventListener("click", () => openFairModal());
$("#fairForm").addEventListener("submit", saveFair);
$("#sponsorForm").addEventListener("submit", saveSponsor);
$("#newSponsorButton").addEventListener("click", () => openSponsorModal());
$("#newsForm").addEventListener("submit", saveNews);
$("#newNewsButton").addEventListener("click", () => openNewsModal());
$("#newsForm [data-news-today]").addEventListener("click", setNewsToday);
$("#newsForm").elements.image.addEventListener("change", (event) => { const file = event.currentTarget.files[0]; const preview = $("#newsPreview"); if (!file) { preview.classList.add("hidden"); return; } preview.src = URL.createObjectURL(file); preview.classList.remove("hidden"); });
$("#refreshNews").addEventListener("click", () => loadNews().catch((error) => showToast(error.message, true)));
["#newsSearch"].forEach((id) => $(id).addEventListener("keydown", (event) => { if (event.key === "Enter") $("#refreshNews").click(); }));
$("#newsStatus").addEventListener("change", () => $("#refreshNews").click());
$("#sponsorChooseFiles").addEventListener("click", () => $("#sponsorImageInput").click());
$("#sponsorImageInput").addEventListener("change", (event) => {
  const incoming = [...event.currentTarget.files];
  const known = new Set(sponsorSelectedFiles.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  incoming.forEach((file) => { const key = `${file.name}:${file.size}:${file.lastModified}`; if (!known.has(key) && sponsorSelectedFiles.length < 4) { sponsorSelectedFiles.push(file); known.add(key); } });
  syncSponsorFileInput();
  renderSponsorPreview();
});
$("#fairForm").elements.cep.addEventListener("input", (event) => {
  const digits = onlyDigits(event.target.value).slice(0, 8);
  event.target.value = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
});
document.querySelectorAll("#fairForm [data-schedule-status]").forEach((select) => select.addEventListener("change", (event) => {
  const row = event.currentTarget.closest(".schedule-row");
  const disabled = event.currentTarget.value === "closed";
  row.querySelector("[data-schedule-open]").disabled = disabled;
  row.querySelector("[data-schedule-close]").disabled = disabled;
}));
$("#fairForm").elements.photo.addEventListener("change", (event) => { const file = event.currentTarget.files[0]; const preview = $("#fairPhotoPreview"); if (!file) { preview.classList.add("hidden"); return; } preview.src = URL.createObjectURL(file); preview.classList.remove("hidden"); });
document.querySelectorAll("[data-close-details]").forEach((element) => element.addEventListener("click", closeDetails));
document.querySelectorAll("[data-close-stall]").forEach((element) => element.addEventListener("click", closeStallModal));
document.querySelectorAll("[data-close-fair]").forEach((element) => element.addEventListener("click", closeFairModal));
document.querySelectorAll("[data-close-sponsor]").forEach((element) => element.addEventListener("click", closeSponsorModal));
document.querySelectorAll("[data-close-news]").forEach((element) => element.addEventListener("click", closeNewsModal));
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeDetails(); closeStallModal(); closeFairModal(); closeSponsorModal(); closeNewsModal(); } });
  document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => showSection(button.dataset.section)));
document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => showSection(button.dataset.go)));

$("#refreshFeirantes").addEventListener("click", () => loadFeirantes().catch((error) => showToast(error.message, true)));
$("#refreshRegistrations").addEventListener("click", () => loadRecords("#registrationsTable", "#registrationsSearch", "#registrationsStatus", false, "registrations").catch((error) => showToast(error.message, true)));
$("#refreshFairs").addEventListener("click", () => loadFairs().catch((error) => showToast(error.message, true)));
$("#refreshSponsors").addEventListener("click", () => loadSponsors().catch((error) => showToast(error.message, true)));
["#feirantesSearch", "#registrationsSearch", "#fairsSearch", "#sponsorsSearch"].forEach((id) => $(id).addEventListener("keydown", (event) => { if (event.key === "Enter") event.currentTarget.closest("section").querySelector(".button.outline").click(); }));
["#feirantesStatus", "#registrationsStatus", "#fairsStatus", "#sponsorsStatus"].forEach((id) => $(id).addEventListener("change", (event) => event.currentTarget.closest("section").querySelector(".button.outline").click()));

api("/api/me").then((data) => data.authenticated && openApp(data.username)).catch(() => { });
