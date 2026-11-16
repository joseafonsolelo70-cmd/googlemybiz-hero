import { validarLimiteDePalavras } from "./ai.functions";

const textoComPalavras = (quantidade: number) =>
  Array.from({ length: quantidade }, (_, indice) => `palavra${indice + 1}`).join(" ");

function exigir(condicao: boolean, mensagem: string): void {
  if (!condicao) throw new Error(mensagem);
}

function exigirErro(fn: () => unknown, mensagem: string): void {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(mensagem);
}

exigir(
  validarLimiteDePalavras(textoComPalavras(35)) === textoComPalavras(35),
  "Deve aceitar exatamente 35 palavras.",
);
exigir(
  validarLimiteDePalavras(textoComPalavras(60)) === textoComPalavras(60),
  "Deve aceitar exatamente 60 palavras.",
);
exigirErro(() => validarLimiteDePalavras(textoComPalavras(34)), "Deve rejeitar 34 palavras.");
exigirErro(() => validarLimiteDePalavras(textoComPalavras(61)), "Deve rejeitar 61 palavras.");

console.info("Limite comercial de 35–60 palavras: 4 casos aprovados.");
