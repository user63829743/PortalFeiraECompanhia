const form = document.querySelector("#formulario-cadastro");
const errorBox = document.querySelector("#mensagem-erro");
const statusBox = document.querySelector("#status-envio");
const successBox = document.querySelector("#sucesso");
const proofBox = document.querySelector("#comprovante-inscricao");
const submitButton = form.querySelector('button[type="submit"]');

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function showStatus(message) {
  statusBox.textContent = message;
  statusBox.hidden = false;
}

function formatCpfCnpj(value) {
  const digits = value.replace(/\D/g, "").slice(0, 14);

  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function formatCep(value) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.replace(/(\d{5})(\d)/, "$1-$2");
}

const cepInput = form.querySelector('[name="cep"]');
cepInput.maxLength = 9;
cepInput.addEventListener("input", () => {
  cepInput.value = formatCep(cepInput.value);
});

const documentInput = form.querySelector('[name="cpfCnpj"]');
documentInput.maxLength = 18;
documentInput.addEventListener("input", () => {
  documentInput.value = formatCpfCnpj(documentInput.value);
});

const phoneInput = form.querySelector('[name="phone"]');
phoneInput.maxLength = 15;
phoneInput.addEventListener("input", () => {
  phoneInput.value = formatPhone(phoneInput.value);
});

const categorySelect = form.querySelector('[name="category"]');
const categoryOtherGroup = form.querySelector('#categoriaOutroGrupo');
const categoryOtherInput = form.querySelector('[name="categoryOther"]');

function toggleOtherCategory() {
  const isOther = categorySelect.value === "Outros";
  categoryOtherGroup.hidden = !isOther;
  categoryOtherGroup.style.display = isOther ? "" : "none";
  categoryOtherInput.required = isOther;
  if (!isOther) categoryOtherInput.value = "";
}

categorySelect.addEventListener("change", toggleOtherCategory);
toggleOtherCategory();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  statusBox.hidden = true;

  if (location.protocol === "file:") {
    return showError("Não foi possível enviar sua inscrição agora. Tente novamente em alguns instantes.");
  }

  if (!form.reportValidity()) return;

  const data = Object.fromEntries(new FormData(form).entries());
  if (data.category === "Outros") data.category = String(data.categoryOther || "").trim();
  delete data.categoryOther;
  data.cpfCnpj = data.cpfCnpj.replace(/\D/g, "");
  data.phone = data.phone.replace(/\D/g, "");
  data.cep = String(data.cep || "").replace(/\D/g, "");
  data.consentGiven = form.consentGiven.checked;
  if (!data.consentGiven) return showError("É necessário aceitar o uso dos dados para análise da inscrição.");

  submitButton.disabled = true;
  submitButton.textContent = "Enviando inscrição...";
  showStatus("Enviando sua inscrição. Aguarde...");
  try {
    const response = await fetch("/api/cadastros", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const rawResponse = await response.text();
    let result = {};
    try {
      result = rawResponse ? JSON.parse(rawResponse) : {};
    } catch {
      throw new Error("Não foi possível enviar sua inscrição agora. Tente novamente em alguns instantes.");
    }
    if (!response.ok) {
      throw new Error("Não foi possível enviar sua inscrição agora. Tente novamente em alguns instantes.");
    }
    const code = result.registration?.id ? `#${result.registration.id}` : "confirmado";
    proofBox.textContent = `Inscrição enviada com sucesso! Recebemos seus dados e nossa equipe entrará em contato em breve. Protocolo de atendimento: ${code}.`;
    form.hidden = true;
    successBox.hidden = false;
    statusBox.hidden = true;
  } catch (error) {
    showError(error.message || "Não foi possível enviar sua inscrição agora. Tente novamente em alguns instantes.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Enviar cadastro da banca";
  }
});

document.querySelector("#novo-cadastro").addEventListener("click", () => {
  form.reset();
  successBox.hidden = true;
  form.hidden = false;
  statusBox.hidden = true;
  errorBox.hidden = true;
});