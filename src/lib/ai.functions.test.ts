import { interpretarResposta, validarLimiteDePalavras } from "./ai.functions";

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

const mensagemDe35Palavras = textoComPalavras(35);
const primeiraAbordagem = interpretarResposta(
  `NOME DO NEGÓCIO: Clínica Exemplo
OPORTUNIDADE IDENTIFICADA: Avaliar uma apresentação digital mais completa.
EVIDÊNCIA: O registo inclui o nome e a atividade, sem captura do website.
OPORTUNIDADE COMERCIAL: Um site pode apresentar serviços e facilitar contactos.
ABORDAGEM PARA WHATSAPP: ${mensagemDe35Palavras}
PERGUNTA FINAL: Posso mostrar um exemplo de site?`,
  true,
  "whatsapp",
);
exigir(
  primeiraAbordagem.texto === mensagemDe35Palavras,
  "A análise não deve ser incluída no texto de abordagem que o utilizador copia.",
);
exigir(
  primeiraAbordagem.analise?.evidencia ===
    "O registo inclui o nome e a atividade, sem captura do website.",
  "A evidência da análise deve ser mantida separada da mensagem.",
);

console.info("Limite comercial de 35–60 palavras e separação da análise: casos aprovados.");
