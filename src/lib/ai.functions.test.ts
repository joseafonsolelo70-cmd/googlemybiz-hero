import { describe, expect, it } from "bun:test";
import { validarLimiteDePalavras } from "./ai.functions";

const textoComPalavras = (quantidade: number) =>
  Array.from({ length: quantidade }, (_, indice) => `palavra${indice + 1}`).join(" ");

describe("limite de palavras das abordagens comerciais", () => {
  it("aceita exatamente 35 palavras", () => {
    expect(validarLimiteDePalavras(textoComPalavras(35))).toBe(textoComPalavras(35));
  });

  it("aceita exatamente 60 palavras", () => {
    expect(validarLimiteDePalavras(textoComPalavras(60))).toBe(textoComPalavras(60));
  });

  it("rejeita 34 palavras", () => {
    expect(() => validarLimiteDePalavras(textoComPalavras(34))).toThrow(
      "A resposta gerada ficou fora do limite de 35 a 60 palavras. Gere novamente.",
    );
  });

  it("rejeita 61 palavras", () => {
    expect(() => validarLimiteDePalavras(textoComPalavras(61))).toThrow(
      "A resposta gerada ficou fora do limite de 35 a 60 palavras. Gere novamente.",
    );
  });
});
