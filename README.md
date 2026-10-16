# ProfRS

Aplicação estática de apoio à docência construída com HTML, CSS, JavaScript ES Modules, Firebase Authentication e Cloud Firestore. A configuração web usa o projeto `planilha-professores` enviado para este projeto. Não há backend próprio, upload de arquivos, Firebase Storage ou Cloud Functions.

## Funcionalidades nesta versão

- Login e logout com Google via Firebase Authentication.
- Perfil mínimo associado ao UID de autenticação.
- Calculadora da proporção legal da jornada, com cargas de 20h, 40h ou personalizada.
- Consulta salarial preparada para registros verificados e publicados pelo administrador; a coleção começa vazia.
- CRUD de planejamentos por usuário, com edição, duplicação, filtros, exclusão e impressão do navegador.
- Formulário de PEI em oito etapas, rascunho, revisão, exclusão e impressão. Use códigos internos e evite dados desnecessários.
- Portal público de notícias e links oficiais, com paginação e publicação controlada pelo painel master.
- Administração de notícias, links e referências salariais.
- Regras do Firestore que isolam registros pelo UID e reservam gravações públicas ao UID master.

O catálogo de habilidades está deliberadamente vazio em `js/data/skills-demo.json`. O formulário permite registrar referências próprias como não oficiais; não apresenta códigos inventados da BNCC ou do Referencial Curricular Gaúcho como oficiais.

## Configuração necessária no Firebase

O código do cliente já contém a configuração web enviada. Essa configuração identifica o app e inclui uma API key pública de navegador; ela não é uma chave privada nem substitui as regras do Firestore. Não coloque chaves de conta de serviço, tokens administrativos ou segredos no site. Restrinja a API key às APIs e aos domínios apropriados pelo Google Cloud Console quando isso for compatível com os serviços usados.

1. Abra o projeto `planilha-professores` no [Firebase Console](https://console.firebase.google.com/).
2. Em **Authentication → Sign-in method**, habilite o provedor **Google**. Informe o nome de suporte solicitado pelo console.
3. Em **Authentication → Settings → Authorized domains**, inclua `localhost` para desenvolvimento e o domínio real de publicação. Domínios padrão do Firebase Auth/Hosting devem continuar disponíveis conforme o fluxo OAuth configurado.
4. Em **Firestore Database**, crie ou confira a base Firestore em modo nativo. Se ainda não existir, escolha cuidadosamente a localização; a localização da base não pode ser trocada depois. Use uma única base para manter a base gratuita do Spark.
5. Faça o primeiro login com a conta Google que será proprietária do ProfRS. No Firebase Console, abra **Authentication → Users** e copie o **UID** dessa conta.
6. Em `js/core/utils.js`, troque `REPLACE_WITH_YOUR_FIREBASE_UID` pelo UID copiado. Em `firestore.rules`, troque `__ADMIN_UID__` pelo mesmo UID. Essas duas mudanças liberam o painel e, principalmente, as operações administrativas nas regras. Não use e-mail nem nome como substituto do UID.
7. Publique regras e índices com Firebase CLI (com Node.js instalado):

   ```powershell
   npm install -g firebase-tools
   firebase login
   firebase use planilha-professores
   firebase deploy --only firestore:rules,firestore:indexes
   ```

   O deploy das regras fecha o acesso aos caminhos não explicitamente liberados. Não habilite regras abertas temporárias para “fazer funcionar”.

## Executar localmente

Sirva a pasta por HTTP para que os módulos ES e o fluxo OAuth funcionem. No PowerShell, na pasta do projeto:

```powershell
python -m http.server 8000
```

Abra `http://localhost:8000`. Se o provedor de login recusar o domínio, adicione `localhost` aos domínios autorizados da Authentication e tente novamente. O login real e a persistência só funcionam depois que Google Auth e Firestore estiverem habilitados no projeto.

## Publicar no Firebase Hosting

`firebase.json` já configura o Hosting para servir os arquivos estáticos deste projeto. Depois de validar a configuração e publicar as regras:

```powershell
firebase deploy --only hosting
```

Adicione o domínio `web.app`/`firebaseapp.com` gerado pelo Hosting aos domínios autorizados no Firebase Authentication. Para um domínio próprio, configure DNS e certificado pelo Hosting e autorize esse domínio na Authentication. A publicação não exige funções de servidor.

## Segurança e privacidade

- Os caminhos `users/{uid}/plans` e `users/{uid}/peis` aceitam operações apenas quando o UID autenticado coincide com o UID do caminho.
- O conteúdo público usa os caminhos válidos `publicContent/news/items/{id}`, `publicContent/officialLinks/items/{id}` e `publicContent/salaryTables/items/{id}`.
- A conta master é identificada nas regras pelo UID literal que o proprietário configura em `firestore.rules`. Alterar o JavaScript sozinho não concede acesso ao banco.
- Leitores públicos só podem consultar notícias publicadas, links ativos e tabelas salariais publicadas. As consultas da interface incluem filtros que correspondem às regras.
- As regras validam conjuntos de campos, tipos, limites de texto, estados permitidos e URLs HTTPS para conteúdo público.
- PEIs podem conter dados pessoais. Use códigos internos, não inclua diagnósticos clínicos sem necessidade, e siga as políticas da instituição e os cuidados aplicáveis à LGPD. O ProfRS não declara que este formulário seja um modelo oficial da SEDUC-RS.
- Registros de estudantes não devem ser usados em notícias. Não armazene anexos neste sistema.

Confira as regras após qualquer mudança nos modelos de dados. As regras deste repositório negam caminhos não especificados, portanto um campo novo só poderá ser gravado depois de atualizar a validação correspondente.

## Cotas Spark

O projeto foi preparado para não exigir Blaze, Storage ou Cloud Functions. O [guia oficial de cotas do Firestore](https://firebase.google.com/docs/firestore/quotas) informa, na data desta versão, até 1 GiB de dados, 50 mil leituras por dia, 20 mil gravações por dia, 20 mil exclusões por dia e 10 GiB/mês de transferência de saída na cota gratuita do Firestore. Os limites e condições podem mudar; confira também o [plano Spark](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans) e as cotas de Hosting antes de publicar. Ao permanecer no Spark, o acesso ao produto pode ser suspenso ao atingir limites; não há migração automática planejada neste projeto.

O aplicativo limita consultas públicas a páginas de dez notícias, carrega até cem referências salariais e evita listeners em tempo real. A aba **Usage** do Firestore Console deve ser acompanhada regularmente.

## Exportação e impressão

Planejamentos podem ser exportados individualmente ou conforme a lista filtrada. PEIs são exportados um por vez; antes de gerar o CSV, o sistema pede confirmação e lembra que o arquivo baixado deve ser guardado e compartilhado com cuidado. Jornada e referências salariais oferecem CSV e impressão ou salvamento em PDF pelo navegador. A área administrativa master exporta notícias, links oficiais e tabelas cadastradas.

Os CSVs são montados no navegador, em UTF-8 com BOM para melhor abertura em planilhas, e escapam aspas, vírgulas e quebras de linha. Valores que poderiam ser interpretados como fórmulas recebem proteção. Os arquivos não passam pelo Firebase Storage, por APIs externas ou por um serviço de geração. A impressão usa a função local do navegador. Arquivos baixados ficam sob responsabilidade de quem os exporta; mantenha exportações de PEI em local protegido e não as compartilhe sem autorização.

Essas funções não usam Cloud Functions nem exigem migração do plano Firebase Spark para o Blaze.

## Verificações

Com Node.js instalado, rode os testes locais sem dependências adicionais:

```powershell
node tests/run-tests.mjs
```

Os testes cobrem as proporções para 20h, 40h, jornadas personalizadas, arredondamento, caminhos de importação, JSON e verificações estáticas do arquivo de regras. O Firebase CLI/Emulator Suite não estava instalado no ambiente de criação; portanto, esses testes não substituem uma execução real das regras no Emulator Suite nem uma revisão no Firebase Console.

## Referências oficiais

- [Configuração do Firebase para web e SDK modular](https://firebase.google.com/docs/web/setup)
- [Login Google para Firebase Authentication](https://firebase.google.com/docs/auth/web/google-signin)
- [Condições das regras de segurança do Firestore](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Lei Federal nº 11.738/2008, art. 2º, § 4º](https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2008/lei/l11738.htm)
