import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Gera um link wa.me para abrir uma conversa no WhatsApp a partir de um número.
 * Normaliza o número (remove caracteres não numéricos) e adiciona o código de
 * país quando ele não está presente, com heurística por quantidade de dígitos:
 * 9 dígitos -> Portugal (351); 10 ou 11 dígitos -> Brasil (55).
 */
export function whatsappLink(telefone?: string | null): string | null {
  if (!telefone) return null;

  const temMais = telefone.trim().startsWith("+");
  let digitos = telefone.replace(/\D/g, "");
  if (!digitos) return null;

  // Remove prefixo internacional "00" ou zeros de numeração nacional (ex.: 09xx).
  if (digitos.startsWith("00")) {
    digitos = digitos.slice(2);
  } else {
    digitos = digitos.replace(/^0+/, "");
  }

  // Se já vier com indicativo internacional ou código de país, usa como está.
  const temCodigoPais =
    temMais || digitos.startsWith("351") || digitos.startsWith("55");

  if (!temCodigoPais) {
    if (digitos.length === 9) {
      // Números nacionais portugueses têm 9 dígitos.
      digitos = `351${digitos}`;
    } else if (digitos.length === 10 || digitos.length === 11) {
      // Números brasileiros (DDD + número) têm 10 ou 11 dígitos.
      digitos = `55${digitos}`;
    }
  }

  return `https://wa.me/${digitos}`;
}

