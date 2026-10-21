// Exemplo mínimo. O pacote é ESM: use `import`, não `require`.
// Argumentos chegam em process.argv.slice(2); a saída vai em stdout, avisos em stderr.
// Com MYCLI_NO_INPUT=1 (agentes/CI) nunca peça nada: falhe com uma mensagem clara.
const [nome = 'mundo'] = process.argv.slice(2);
console.log(`Olá, ${nome}!`);
