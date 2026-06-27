# VOX CLI

CLI interna da empresa para automação de tarefas operacionais de desenvolvimento.

---

## 🎯 Objetivo

Centralizar e padronizar scripts operacionais da empresa como:

- deploy de aplicações
- execução de docker
- setup de ambientes
- automação de banco de dados
- configuração de projetos (ex: WordPress, APIs, etc.)

O objetivo é reduzir scripts dispersos e padronizar execuções em um único ponto.

---

## ⚙️ Stack

- Node.js >= 20 (LTS)
- TypeScript
- ESM (NodeNext)
- Commander (CLI routing)
- Inquirer (menu interativo)
- Execa (execução de comandos)
- Tsup (build)

---

## 🧪 Status atual

MVP inicial em construção.

Estrutura base do projeto e configuração de ambiente definidas.

---

## 🚀 Próximos passos

- implementação do TaskRunner
- sistema de tasks automatizado
- menu interativo (`vox menu`)
- sistema de update (`vox update`)
- registry automático de tasks

---

## 📦 Ideia futura

- sistema de plugins internos
- versionamento de tasks
- permissões por usuário/equipe
- integração com CI/CD da empresa