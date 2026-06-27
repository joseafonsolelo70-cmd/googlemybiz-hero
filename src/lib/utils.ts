import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Gera um link do WhatsApp a partir de um número.
 * Normaliza o telefone e assume Angola (244) para números locais de 9 dígitos.
 */
export function whatsappLink(telefone?: string | null): string | null {
  if (!telefone) return null;

  const primeiroNumero = telefone.trim().split(/(?:\/|\||,|;|\bou\b|\bor\b|\bext\b|\bramal\b)/i)[0] ?? "";
  const temMais = primeiroNumero.trim().startsWith("+");
  let digitos = primeiroNumero.replace(/\D/g, "");
  if (!digitos) return null;

  // Remove prefixo internacional "00" ou zeros de numeração nacional (ex.: 09xx).
  if (digitos.startsWith("00")) {
    digitos = digitos.slice(2);
  } else {
    digitos = digitos.replace(/^0+/, "");
  }

  // Se vier como número local angolano, adiciona o indicativo de Angola.
  if (!temMais && digitos.length === 9) {
    digitos = `244${digitos}`;
  }

  if (!digitos.startsWith("244") && digitos.length >= 9) {
    const numeroLocalAngolano = digitos.slice(-9);
    digitos = `244${numeroLocalAngolano}`;
  }

  if (digitos.startsWith("244") && digitos.length !== 12) {
    digitos = `244${digitos.slice(-9)}`;
  }

  return `whatsapp://send?phone=${digitos}`;
}

