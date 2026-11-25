export function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidPassword(value) {
  return typeof value === "string"
    && value.length >= 8
    && value.length <= 16
    && /[A-Z]/.test(value)
    && /[^A-Za-z0-9]/.test(value);
}

export function isValidName(value) {
  return typeof value === "string" && value.trim().length >= 20 && value.trim().length <= 60;
}

export function isValidAddress(value) {
  return typeof value === "string" && value.length <= 400;
}
