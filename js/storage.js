const STORAGE_PREFIX = "sft";
const STORAGE_KEYS = {
  transactions: `${STORAGE_PREFIX}-transactions`,
  categories: `${STORAGE_PREFIX}-categories`,
  settings: `${STORAGE_PREFIX}-settings`,
  theme: `${STORAGE_PREFIX}-theme`
};

const DEFAULT_CATEGORIES = [
  { id: "cat-gaji", name: "Gaji", type: "income" },
  { id: "cat-bonus", name: "Bonus", type: "income" },
  { id: "cat-usaha", name: "Usaha", type: "income" },
  { id: "cat-makan", name: "Makan", type: "expense" },
  { id: "cat-transport", name: "Transportasi", type: "expense" },
  { id: "cat-tagihan", name: "Tagihan", type: "expense" }
];

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let cryptoKey = null;
let currentSalt = null;

function getLocalStorage() {
  if (!window.localStorage) {
    throw new Error("localStorage tidak tersedia.");
  }
  return window.localStorage;
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return window.btoa(binary);
}

function fromBase64(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function ensureUnlocked() {
  if (!cryptoKey) {
    throw new Error("Aplikasi terkunci. Masukkan PIN terlebih dahulu.");
  }
}

async function importKeyMaterial(pin) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
}

async function deriveKey(pin, saltBytes) {
  const keyMaterial = await importKeyMaterial(pin);
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  return key;
}

async function hashPin(pin) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(pin));
  return toBase64(digest);
}

async function encryptPayload(data) {
  ensureUnlocked();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = encoder.encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    payload
  );
  return `${toBase64(iv)}.${toBase64(encrypted)}`;
}

async function decryptPayload(serialized) {
  ensureUnlocked();
  if (!serialized) {
    return null;
  }
  const [ivPart, dataPart] = serialized.split(".");
  if (!ivPart || !dataPart) {
    return null;
  }
  const iv = fromBase64(ivPart);
  const encrypted = fromBase64(dataPart);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encrypted
  );
  return JSON.parse(decoder.decode(decrypted));
}

function readSettings() {
  const raw = getLocalStorage().getItem(STORAGE_KEYS.settings);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Gagal membaca pengaturan, gunakan ulang.", error);
    return null;
  }
}

function writeSettings(settings) {
  getLocalStorage().setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}

async function unlockWithPin(pin) {
  const settings = readSettings();
  if (!settings || !settings.pinHash || !settings.salt) {
    return false;
  }
  const pinHash = await hashPin(pin);
  if (pinHash !== settings.pinHash) {
    return false;
  }
  const saltBytes = fromBase64(settings.salt);
  cryptoKey = await deriveKey(pin, saltBytes);
  currentSalt = saltBytes;
  return true;
}

async function registerPin(pin) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  cryptoKey = await deriveKey(pin, saltBytes);
  currentSalt = saltBytes;
  const pinHash = await hashPin(pin);
  writeSettings({
    pinHash,
    salt: toBase64(saltBytes)
  });
  if (!getLocalStorage().getItem(STORAGE_KEYS.categories)) {
    await saveCategories(DEFAULT_CATEGORIES);
  }
  if (!getLocalStorage().getItem(STORAGE_KEYS.transactions)) {
    await saveTransactions([]);
  }
}

function hasPin() {
  const settings = readSettings();
  return Boolean(settings && settings.pinHash);
}

function lock() {
  cryptoKey = null;
  currentSalt = null;
}

async function changePin(currentPin, newPin) {
  if (!hasPin()) {
    await registerPin(newPin);
    return true;
  }
  const valid = await unlockWithPin(currentPin);
  if (!valid) {
    return false;
  }
  const transactions = await getTransactions();
  const categories = await getCategories();
  lock();
  await registerPin(newPin);
  await saveCategories(categories);
  await saveTransactions(transactions);
  return true;
}

async function getTransactions() {
  const raw = getLocalStorage().getItem(STORAGE_KEYS.transactions);
  if (!raw) {
    return [];
  }
  const data = await decryptPayload(raw);
  if (!Array.isArray(data)) {
    return [];
  }
  return data;
}

async function saveTransactions(transactions) {
  const payload = await encryptPayload(transactions);
  getLocalStorage().setItem(STORAGE_KEYS.transactions, payload);
}

async function addTransaction(transaction) {
  const all = await getTransactions();
  const record = {
    ...transaction,
    id: transaction.id || crypto.randomUUID?.() || `tx-${Date.now()}`
  };
  all.push(record);
  await saveTransactions(all);
  return record;
}

async function updateTransaction(id, updates) {
  const all = await getTransactions();
  const index = all.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new Error("Transaksi tidak ditemukan.");
  }
  all[index] = { ...all[index], ...updates };
  await saveTransactions(all);
  return all[index];
}

async function deleteTransaction(id) {
  const all = await getTransactions();
  const filtered = all.filter((item) => item.id !== id);
  await saveTransactions(filtered);
}

async function getCategories() {
  const raw = getLocalStorage().getItem(STORAGE_KEYS.categories);
  if (!raw) {
    return [];
  }
  const data = await decryptPayload(raw);
  if (!Array.isArray(data) || !data.length) {
    return [];
  }
  return data;
}

async function saveCategories(categories) {
  const payload = await encryptPayload(categories);
  getLocalStorage().setItem(STORAGE_KEYS.categories, payload);
}

async function addCategory(category) {
  const all = await getCategories();
  const randomPart = crypto.randomUUID
    ? crypto.randomUUID().slice(-8)
    : Date.now().toString(36);
  const id = category.id || `cat-${randomPart}`;
  const record = { ...category, id };
  all.push(record);
  await saveCategories(all);
  return record;
}

async function removeCategory(id) {
  const all = await getCategories();
  const filtered = all.filter((item) => item.id !== id);
  await saveCategories(filtered);
  const transactions = await getTransactions();
  const sanitized = transactions.map((tx) =>
    tx.categoryId === id ? { ...tx, categoryId: null } : tx
  );
  await saveTransactions(sanitized);
}

function getTheme() {
  return getLocalStorage().getItem(STORAGE_KEYS.theme) || "light";
}

function setTheme(theme) {
  getLocalStorage().setItem(STORAGE_KEYS.theme, theme);
}

async function exportData() {
  const transactions = await getTransactions();
  const categories = await getCategories();
  return {
    exportedAt: new Date().toISOString(),
    transactions,
    categories
  };
}

async function importData(payload) {
  if (
    !payload ||
    !Array.isArray(payload.transactions) ||
    !Array.isArray(payload.categories)
  ) {
    throw new Error("Format data tidak valid.");
  }
  await saveCategories(payload.categories);
  await saveTransactions(payload.transactions);
}

export {
  hasPin,
  unlockWithPin,
  registerPin,
  changePin,
  lock,
  getTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  saveTransactions,
  getCategories,
  addCategory,
  removeCategory,
  saveCategories,
  getTheme,
  setTheme,
  exportData,
  importData
};
