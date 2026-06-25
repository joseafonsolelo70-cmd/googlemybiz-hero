import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Gera um link wa.me para abrir uma conversa no WhatsApp a partir de um número.
 * Normaliza o número (remove caracteres não numéricos) e assume Portugal (351)
 * como código de país quando nenhum prefixo internacional está presente.
 */
export function whatsappLink(telefone?: string | null): string | null {
  if (!telefone) return null;

  const temMais = telefone.trim().startsWith("+");
  let digitos = telefone.replace(/\D/g, "");
  if (!digitos) return null;

  // Remove zeros à esquerda de numeração nacional (ex.: 09xx).
  digitos = digitos.replace(/^0+/, "");

  // Se já vier com indicativo internacional (com +), usa tal como está.
  if (!temMais) {
    // Números nacionais portugueses têm 9 dígitos -> adiciona 351.
    if (digitos.length === 9) digitos = `351${digitos}`;
  }

  return `https://wa.me/${digitos}`;
}

