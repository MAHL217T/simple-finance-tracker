import { hasPin, unlockWithPin, registerPin } from "./storage.js";

const authDialog = document.getElementById("auth-dialog");
const authForm = document.getElementById("auth-form");
const authPinInput = document.getElementById("auth-pin");
const authTitle = document.getElementById("auth-title");
const authMessage = document.getElementById("auth-message");
const authError = document.getElementById("auth-error");
const authCancelBtn = document.getElementById("auth-cancel");

let mode = "login"; // login | setup
let unlocked = false;
let onUnlockCallback = null;

function setMode(nextMode) {
  mode = nextMode;
  if (mode === "setup") {
    authTitle.textContent = "Buat PIN Baru";
    authMessage.textContent = "Buat PIN 4 digit untuk mengamankan data kamu.";
  } else {
    authTitle.textContent = "Masukkan PIN";
    authMessage.textContent = "Masukkan PIN 4 digit untuk membuka aplikasi.";
  }
  authError.textContent = "";
  authPinInput.value = "";
}

function restrictPinInput(event) {
  const filtered = event.target.value.replace(/\D+/g, "");
  event.target.value = filtered.slice(0, 4);
}

async function handleSubmit(event) {
  event.preventDefault();
  const pin = authPinInput.value.trim();
  if (pin.length !== 4) {
    authError.textContent = "PIN harus terdiri dari 4 digit.";
    return;
  }
  try {
    if (mode === "setup") {
      await registerPin(pin);
      unlocked = true;
      authDialog.close();
      if (typeof onUnlockCallback === "function") {
        onUnlockCallback();
      }
      return;
    }
    const success = await unlockWithPin(pin);
    if (!success) {
      authError.textContent = "PIN salah. Coba lagi.";
      authPinInput.value = "";
      authPinInput.focus();
      return;
    }
    unlocked = true;
    authDialog.close();
    if (typeof onUnlockCallback === "function") {
      onUnlockCallback();
    }
  } catch (error) {
    console.error(error);
    authError.textContent = "Terjadi kesalahan. Coba lagi.";
  }
}

function handleCancel(event) {
  event.preventDefault();
  authError.textContent = "Masukkan PIN untuk melanjutkan.";
  authPinInput.focus();
}

function handleCancelClick(event) {
  event.preventDefault();
  handleCancel(event);
}

function handleClose() {
  if (!unlocked) {
    authError.textContent = "Masukkan PIN untuk melanjutkan.";
    setTimeout(() => {
      openAuthDialog();
    }, 0);
  }
}

function openAuthDialog() {
  unlocked = false;
  const initialMode = hasPin() ? "login" : "setup";
  setMode(initialMode);
  if (typeof authDialog.showModal === "function") {
    authDialog.showModal();
  } else {
    authDialog.setAttribute("open", "true");
  }
  authPinInput.focus();
}

function initAuth({ onUnlock } = {}) {
  onUnlockCallback = onUnlock;
  authPinInput.addEventListener("input", restrictPinInput);
  authForm.addEventListener("submit", handleSubmit);
  authDialog.addEventListener("cancel", handleCancel);
  authDialog.addEventListener("close", handleClose);
  if (authCancelBtn) {
    authCancelBtn.addEventListener("click", handleCancelClick);
  }
  openAuthDialog();
}

export { initAuth, openAuthDialog };
