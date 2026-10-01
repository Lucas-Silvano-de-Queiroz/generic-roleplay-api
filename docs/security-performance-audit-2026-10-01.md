# Auditoria de segurança e performance

Data: 2026-10-01. Escopo: código em `src/`, schema Drizzle, configuração, containers, CI, dependências de produção e testes existentes. Referência: [OWASP Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction/).

A análise inicial abaixo registra o estado anterior às correções. Após autorização do usuário, foram implementadas as mudanças descritas na seção final "Correções e verificação final". Os achados distinguem defeitos demonstrados, riscos inferidos do código e requisitos que dependem do ambiente de produção. Não foram feitos ataques a serviços externos, teste de carga ou inspeção de segredos locais.

## Resultado e prioridades

A base possui controles úteis: autenticação global, exclusão vinculada ao usuário autenticado e à senha atual, queries parametrizadas, índices de ID/e-mail, Argon2id, distinção entre access e refresh tokens, tratamento centralizado de erros e execução do container de produção com usuário não root.

Antes de expor a API publicamente, priorizar proteção de recursos nas rotas públicas, gestão de refresh tokens, tratamento de falhas do pool e atualização das dependências afetadas. A complexidade quadrática da validação de e-mail merece correção, embora o payload reproduzido seja barrado pela validação HTTP atual.

| Prioridade | Achado | Categoria | Evidência |
| --- | --- | --- | --- |
| Alta | Cadastro e refresh sem limitação; login limitado apenas por IP e processo | A06, A07, A10 | Controllers e `LoginRateLimitGuard` |
| Alta | Refresh reutilizável por 15 dias, sem rotação/revogação de sessão | A06, A07 | `RefreshAccessTokenUseCase` e `JwtTokenService` |
| Alta | Evento `error` do pool pode encerrar o processo | A10 | `drizzle.ts`, implementação/documentação do pg-pool |
| Alta para manutenção; exposição varia | 16 advisories em dependências de produção | A03 | `pnpm audit --prod --json` |
| Média | DTO aceita nome maior que a coluna; limites de entrada incompletos | A06, A10 | `create-user.dto.ts` e `users.schema.ts` |
| Média | Enumeração de contas por tempo e resposta de cadastro | A07 | `LoginUseCase` e `CreateUserUseCase` |
| Média | Falhas esperadas de autenticação e rate limit não geram auditoria | A09 | `GlobalExceptionFilter` e fluxos de autenticação |
| Média | CI usa Node 22, exemplos de chaves inválidas e não cobre PRs | A02, A03, A08 | `.github/workflows/pipeline.yaml` |
| Baixa nas rotas atuais | Regex do domínio apresenta pior caso O(L²) | A06, A10 | Benchmark local da regex em `Email` |

As prioridades são de engenharia para este projeto; não são pontuações CVSS nem prova de exploração remota.

## 1. Controle de recursos e limitação de tentativas

Referências: [user.controller.ts:37](/home/lucas/Documents/generic-roleplay-api/src/modules/identity/presentation/http/controllers/user.controller.ts:37), [authentication.controller.ts:42](/home/lucas/Documents/generic-roleplay-api/src/modules/identity/presentation/http/controllers/authentication.controller.ts:42), [login-rate-limit.guard.ts:18](/home/lucas/Documents/generic-roleplay-api/src/modules/identity/infrastructure/auth/login-rate-limit.guard.ts:18).

`POST /users` executa Argon2 para cada cadastro novo, sem guard de limitação. `POST /auth/refresh` verifica RSA, consulta o banco e assina outro JWT, também sem limite. `DELETE /users/me` faz verificação Argon2 sem limitação adicional, embora exija token. Uma sequência de chamadas pode consumir CPU, memória ou conexões. A carga necessária para degradar o serviço não foi medida.

O login permite cinco chamadas por IP em quinze minutos. O `Map` é local: réplicas têm contadores separados e reiniciar o processo limpa a proteção. Vários IPs podem tentar a mesma conta. IPs compartilhados podem bloquear usuários legítimos. Sem configuração de `trust proxy`, atrás de proxy reverso o IP visto pode ser o do proxy; não há bypass demonstrado por `X-Forwarded-For` na configuração atual.

**Correção proposta:** combinar limite global, por origem e por conta normalizada, com armazenamento compartilhado e incremento/expiração atômicos; limitar cadastro, refresh e operações que verificam senha; limitar concorrência e tamanho da fila de hashing. Configurar proxies confiáveis explicitamente conforme a implantação. Evitar bloqueio permanente por conta, que permitiria negação de serviço dirigida ao usuário.

**Validação necessária:** rajadas nas três rotas, limites compartilhados entre duas instâncias, janela/TTL, `Retry-After`, IPs atrás do proxy real e recuperação após saturação.

## 2. Refresh sem rotação e revogação

Referências: [refresh-access-token.use-case.ts:26](/home/lucas/Documents/generic-roleplay-api/src/modules/identity/application/usecases/refresh-access-token.use-case.ts:26), [jwt-token.service.ts:17](/home/lucas/Documents/generic-roleplay-api/src/modules/identity/infrastructure/auth/jwt-token.service.ts:17).

O mesmo refresh token continua aceito a cada renovação. Não existe registro de sessão, identificador `jti`, consumo único, detecção de replay ou logout com revogação. Se copiado, o token permite renovar acesso durante sua validade de quinze dias enquanto a conta existir. A exclusão da conta já impede novas renovações, pois o use case consulta o usuário; ela não deve ser descrita como ausência absoluta de invalidação.

**Correção proposta:** sessão persistida com token aleatório ou `jti`, armazenamento do digest do refresh e rotação atômica. Consumir o token anterior e emitir outro na mesma transação; rejeitar reutilização e revogar a família correspondente. Definir revogação no logout e recuperação de conta. A [orientação OWASP para refresh tokens](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html) recomenda rotação ou vinculação criptográfica ao cliente; a API atual não implementa OAuth, mas o princípio de proteção contra replay se aplica.

Endurecimento adicional: explicitar `algorithms: ["RS256"]` também na verificação do refresh e definir/validar `issuer`, `audience`, `exp` e formato do `sub`. Atualmente a biblioteca verifica assinatura e expiração quando presente e restringe os algoritmos compatíveis com a chave RSA por padrão; não foi identificado aceite de JWT sem assinatura ou confusão HS256/RS256. A estratégia de access já limita RS256 e verifica `tokenUse`.

**Validação necessária:** replay sequencial, duas renovações concorrentes, token expirado, token de access enviado como refresh, logout e revogação de família. Exige nova tabela e atualização do contrato HTTP/documentação.

## 3. Pool PostgreSQL: falhas e prazos

Referência: [drizzle.ts:5](/home/lucas/Documents/generic-roleplay-api/src/modules/shared/infrastructure/database/drizzle.ts:5).

O pool não registra listener de `error`. Uma conexão ociosa pode emitir esse evento após indisponibilidade do PostgreSQL. Sem listener, o EventEmitter pode lançar erro não capturado e encerrar o processo. O filtro HTTP não trata esse evento fora do ciclo da requisição. Esse comportamento é documentado na [API do pool node-postgres](https://node-postgres.com/apis/pool).

Há limite de dez conexões, timeout de conexão de cinco segundos e descarte ocioso em trinta segundos. Esses controles são positivos, mas não estabelecem prazo máximo para execução de queries. `statement_timeout` e `query_timeout` não foram configurados no código; podem existir parâmetros no banco ou na URL, que não foram inspecionados. Locks prolongados podem ocupar o pool mesmo em queries indexadas.

**Correção proposta:** listener de erro com log estruturado e métrica, readiness que reflita indisponibilidade e prazo de query/statement adequado ao serviço. Evitar reconexões agressivas em loop. Considerar `lock_timeout` para operações bloqueadas. Dez conexões por réplica devem caber no orçamento total do PostgreSQL.

**Validação necessária:** reiniciar banco com conexões ociosas, simular lock e confirmar que o processo permanece vivo, responde com erro controlado e se recupera.

## 4. Dependências e integridade da cadeia de entrega

`pnpm audit --prod --json` retornou **16 advisories: 6 altos, 9 moderados, 1 baixo, 0 críticos**, em 167 dependências contabilizadas. O exit code 1 indica achados. É um resultado do registro consultado nesta revisão e deve ser atualizado em revisões futuras.

| Pacote resolvido | Quantidade | Altos / moderados / baixos | Versão que cobre todos os advisories retornados |
| --- | --- | --- | --- |
| `js-yaml@5.2.1` via Swagger | 2 | 1 / 1 / 0 | `>=5.4.1` |
| `qs@6.15.3` via Express/body-parser | 2 | 0 / 2 / 0 | `>=6.16.0` |
| `nodemailer@9.0.5` | 7 | 2 / 5 / 0 | `>=10.0.6` |
| `multer@2.2.0` via Nest/Express | 5 | 3 / 1 / 1 | `>=2.4.0` |

Entre os problemas de complexidade estão parsing exponencial no [js-yaml](https://github.com/advisories/GHSA-pm4m-ph32-ghv5) e backtracking quadrático no [Nodemailer](https://github.com/advisories/GHSA-v53p-9fqp-m79j). Não executar payloads exponenciais no processo da API.

**Alcançabilidade:** não encontrei uso de Nodemailer, upload Multer ou parsing de YAML não confiável em `src/`. Swagger só é habilitado em desenvolvimento. Os advisories de `qs` dependem do caminho e das opções de parsing; não foi demonstrado exploit HTTP neste projeto. Presença no lockfile confirma versão afetada, não exploração de todas as falhas pelas rotas atuais.

**Correção proposta:** remover Nodemailer se continuar sem uso, ou atualizar após avaliar migração de major; atualizar dependências superiores/transitivas com compatibilidade, regenerar lockfile e executar testes/audit. Não aplicar overrides indiscriminadamente.

O [Dockerfile.prod:26](/home/lucas/Documents/generic-roleplay-api/Dockerfile.prod:26) baixa `pnpm@latest` no runner, embora o projeto fixe 11.25.0 e o runner use somente `node`. Remover essa instalação desnecessária. Fixar imagens por digest com processo de atualização; fixar actions por SHA revisado e limitar permissões do workflow. `--frozen-lockfile`, integridades do lockfile e a lista `allowBuilds` já ajudam na reprodutibilidade; não substituem audit, revisão e atualização.

## 5. Validação incompatível com persistência

Referências: [create-user.dto.ts:4](/home/lucas/Documents/generic-roleplay-api/src/modules/identity/presentation/http/dto/create-user.dto.ts:4), [users.schema.ts:5](/home/lucas/Documents/generic-roleplay-api/src/modules/identity/infrastructure/database/schema/users.schema.ts:5).

`name` aceita qualquer comprimento acima de zero; a coluna suporta 255 caracteres. Um nome de 256 caracteres passa pelo DTO, aciona a busca e o hash e só falha ao persistir, produzindo erro interno genérico. Esse caminho foi identificado pelo código/schema; não foi incluído um novo teste HTTP para ele. Nome composto apenas por espaços também é aceito.

As strings de senha e refresh não têm limite máximo explícito. O parser HTTP padrão possui limite de corpo; portanto, não é correto dizer que uma requisição pode ter tamanho infinito. Ainda assim, os limites de campos e o orçamento de trabalho deveriam ser definidos no contrato.

**Correção proposta:** normalizar/validar nome com limite compatível com a coluna, limitar e-mail normalizado ao armazenamento, definir limite de senha que permita passphrases longas sem truncamento e limite razoável de JWT. Atualizar Swagger e invariantes do domínio. Cuidar da diferença entre caracteres Unicode e unidades UTF-16 ao escolher validação de comprimento.

**Validação necessária:** limites e Unicode, entrada de espaços, corpo acima do limite, token excessivo, HTTP 400 previsível antes do hash e banco.

## 6. Enumeração de contas

Referência: [login.use-case.ts:38](/home/lucas/Documents/generic-roleplay-api/src/modules/identity/application/usecases/login.use-case.ts:38).

E-mail inexistente retorna antes de verificar Argon2; e-mail existente com senha incorreta executa o hash. A mensagem é a mesma, mas o custo computacional difere, criando canal de tempo. A diferença de latência na rede não foi medida. O cadastro expõe existência explicitamente por HTTP 409; isso pode facilitar a enumeração mesmo sem medir o login.

**Correção proposta:** verificar contra um hash fictício pré-calculado quando o usuário não existir, preservando o mesmo algoritmo/custo, sem gerar hash novo por requisição. Combinar com limitação para controlar o custo adicional. Avaliar resposta genérica de cadastro e confirmação de e-mail conforme o produto. A [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) trata discrepâncias de mensagem, código HTTP e tempo.

## 7. Logging e alertas de segurança

Referência: [global-exception.filter.ts:43](/home/lucas/Documents/generic-roleplay-api/src/modules/shared/presentation/filters/global-exception.filter.ts:43).

O filtro devolve `HttpException` antes de chamar o logger. Assim, falhas esperadas de credenciais e respostas 429 não geram eventos de segurança no código revisado. O logger atual cobre erros inesperados, sem request ID ou contexto estruturado. Infraestrutura externa pode registrar requisições; sua configuração não foi fornecida.

**Correção proposta:** eventos estruturados para sucesso/falha de autenticação, limitação, refresh, replay e revogação, com identificador de requisição e contexto mínimo. Criar métricas/alertas agregados e controlar cardinalidade, volume e retenção. Nunca registrar senha, pepper, chave privada, Authorization ou refresh token; aplicar redação também a mensagens de erros de dependências. Sanitizar conteúdo externo em logs.

## 8. Configuração e cobertura do CI

Referência: [pipeline.yaml:20](/home/lucas/Documents/generic-roleplay-api/.github/workflows/pipeline.yaml:20).

O workflow usa Node 22, enquanto as instruções do projeto exigem Node 24+. Seleciona pnpm major 11 em vez de 11.25.0. Só dispara para push em `develop`, sem validação de PR. Copia `.env.example` com strings fictícias de chave JWT, e o setup de testes substitui apenas `DATABASE_URL`; a validação de chaves pode encerrar os testes e2e nessa configuração. Isso é inferência a partir dos arquivos, não execução do GitHub Actions.

**Correção proposta:** alinhar Node/pnpm, gerar par RSA e pepper temporários no CI sem imprimir material privado, rodar build/lint/testes/audit também em PR e definir permissões mínimas. Testes e2e atuais cobrem cadastro/exclusão e integração de repositório; não cobrem login, refresh, rate limit ou rotação.

Outros pontos a verificar antes de produção: `NODE_ENV` ausente assume desenvolvimento e habilita docs fora do Dockerfile de produção; Compose de desenvolvimento publica PostgreSQL com credenciais de exemplo; `docker-compose.ci.yml` coloca `postgres` dentro de `api` e referencia volume sem declaração superior. Esses arquivos não demonstram como produção está implantada.

## 9. Algoritmos e Big O

Notação: N = usuários no banco; L = comprimento da entrada; K = IPs retidos; E = entradas expiradas; I = issues de validação; M/T = memória/passagens do Argon2. Custos SQL abaixo assumem uso dos índices declarados, sem benchmark de plano de execução; o otimizador pode escolher scan para tabelas pequenas.

| Operação | Custo atual | Solução ou avaliação |
| --- | --- | --- |
| Busca por ID/e-mail | Busca indexada aproximadamente O(log N), retorno limitado a 1 | Manter PK/UNIQUE; validar com EXPLAIN em volume representativo |
| Criar/excluir usuário | Operações indexadas aproximadamente O(log N), além de hash e I/O | Índices existentes; reduzir consultas só quando medição justificar |
| Limitar uma tentativa | O(1) esperado com Map | Já eficiente por chamada; tornar compartilhado/atômico |
| Limpeza do limitador | O(K) síncrono a cada 15 min; espaço O(K) | Fila/buckets de expiração com versões, trabalho O(E) e processamento em lotes; ou armazenamento compartilhado com TTL |
| Normalizar e-mail | O(L) tempo/espaço | Adequado; evitar normalização duplicada apenas se medido |
| Regex do domínio | Pior caso O(L²) por backtracking | Varredura linear O(L), com limite anterior e sem quantificadores ambíguos |
| Formatar issues de validação | O(I), saída também O(I) | Sem ganho assintótico útil; limitar tamanho de entrada |
| Hash Argon2id | Trabalho proporcional a M × T, mais leitura da senha; espaço O(M) por execução | Custo intencional de segurança; limitar concorrência |
| RSA sign/verify síncrono | Depende do tamanho da chave e mensagem; não cresce com N | Medir bloqueio do event loop; considerar API assíncrona/execução apropriada sob carga |

### Regex quadrática: reprodução

Referência: [email.vo.ts:14](/home/lucas/Documents/generic-roleplay-api/src/modules/identity/domain/value-objects/email.vo.ts:14).

O domínio usa `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Os dois segmentos do domínio também aceitam ponto. Com muitas alternativas de ponto e falha ao final, o motor tenta repetidamente segmentos sobrepostos.

Reprodução isolada da mesma regex, Node 26.7.0, mediana de cinco execuções por tamanho, input `"a@" + ".".repeat(n) + "\nX"`:

| n | Mediana (ms) |
| --- | --- |
| 1.000 | 0,840 |
| 2.000 | 3,320 |
| 4.000 | 13,183 |
| 8.000 | 52,605 |

Dobrar n multiplicou o tempo aproximadamente por quatro, consistente com o backtracking O(L²). `trim()` não remove a quebra de linha interna desse payload. O benchmark mediu a regex, não a rota HTTP nem throughput em produção. O DTO Zod rejeita esse e-mail antes de chegar ao domínio nas rotas existentes, reduzindo a exposição atual.

**Solução O(L):** verificar espaços e unicidade do `@` em uma passagem, exigir parte local não vazia e buscar um ponto interior ao domínio. Para preservar exatamente a regra atual, esse ponto precisa ter pelo menos um caractere antes e depois. Validar equivalência para e-mails aceitos/rejeitados e decidir se a regra do domínio deve acompanhar a regra mais estrita do DTO. Não apenas trocar por outra regex sem analisar o pior caso.

### Tradeoffs importantes

Remover `findByEmail` antes do INSERT de cadastro reduz de duas para uma as operações de banco, mas mantém O(log N). O `onConflictDoNothing` já protege concorrência. Sem pré-checagem, cadastros duplicados também executariam Argon2; manter a pré-checagem pode ser melhor sob abuso. Escolher com métricas, sem anunciar redução de Big O inexistente.

No refresh, uma consulta `existsById` pode evitar carregar nome/e-mail/hash e reconstruir a entidade. É redução de transferência/alocação, sem alterar O(log N). Não é recomendável remover a consulta e permitir refresh de conta excluída.

Os defaults locais de Argon2 são memória de 65.536 KiB, três passagens e paralelismo quatro. A [OWASP recomenda Argon2id com configurações mínimas adequadas](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html); não reduzir o custo para obter senha em O(1) como objetivo de performance. Fixar parâmetros explicitamente e calibrar latência/concorrência no hardware alvo. A memória cresce com o número de hashes efetivamente simultâneos, não necessariamente com todo o tamanho da fila HTTP.

## Cobertura das dez categorias

| Categoria OWASP 2025 | Conclusão no escopo revisado |
| --- | --- |
| A01 Broken Access Control | Nenhum IDOR identificado: DELETE usa identidade do JWT e senha; access guard global. JWT da conta excluída ainda pode passar pela estratégia até expirar, mas o DELETE consulta a conta e falha; revisar revogação ao adicionar rotas. |
| A02 Security Misconfiguration | Default de desenvolvimento, CI divergente e arquivos Compose precisam revisão. Não foi inspecionada configuração de produção. |
| A03 Software Supply Chain Failures | 16 advisories confirmados; audit e atualização devem entrar no CI. |
| A04 Cryptographic Failures | Argon2id com pepper e RSA são controles positivos. Validação de env só checa correspondência das chaves, não tipo/tamanho RSA nem força real do pepper. TLS HTTP/DB e armazenamento de segredos dependem da implantação e não foram confirmados. |
| A05 Injection | Queries construídas com Drizzle/eq e valores parametrizados; sem eval, shell ou SQL bruto controlados pelo usuário encontrados em src. Não é certificação de ausência de injeção em todo o ambiente. |
| A06 Insecure Design | Limites operacionais, validação e ciclo de vida de sessão incompletos. |
| A07 Authentication Failures | Refresh reutilizável, enumeração e rate limit local apenas por IP. |
| A08 Software or Data Integrity Failures | Lockfile/integridades ajudam; pnpm@latest, imagens/actions mutáveis e validação insuficiente de PR exigem revisão. Sem ingestão de plugins/updates não verificados identificada no código. |
| A09 Security Logging and Alerting Failures | Eventos esperados de segurança não são registrados/alertados pela aplicação. |
| A10 Mishandling of Exceptional Conditions | Evento de erro do pool sem listener, prazos de query não explícitos, campo maior que coluna e backtracking quadrático no domínio. Filtro centralizado já impede exposição normal de stacks ao cliente. |

JWT é assinado, não criptografado. O payload atual contém identificador e metadados de token; evitar inserir segredos. Não há evidência de senha em texto puro no banco ou retornada pela API. README orienta RSA 2048; adicionar essa verificação no startup em vez de depender apenas da documentação.

## Verificação executada e limites

- `pnpm test`: 8 arquivos, **33 testes passaram**.
- `pnpm build`: **exit 0**.
- `pnpm test:e2e`: com acesso ao Docker, 2 arquivos, **12 testes passaram**, incluindo integração PostgreSQL. A tentativa inicial no sandbox falhou por acesso ao Docker, não por falha funcional.
- `pnpm audit --prod --json`: **16 advisories**, exit 1. A tentativa inicial sem acesso de rede falhou com `fetch failed`; consulta repetida com acesso autorizado.
- Benchmark isolado da regex: crescimento aproximadamente quadrático reproduzido.
- Runtime local: Node **26.7.0**, pnpm **11.25.0**. Node 24 e a execução real do workflow GitHub não foram validados.

Na análise inicial, não foram executados benchmarks de carga, EXPLAIN ANALYZE, exploração dos advisories, inspeção do TLS em produção ou auditoria completa das dependências de desenvolvimento. Os testes originais não validavam replay, limitação distribuída, enumeração ou falhas do pool. Naquele momento, o único arquivo acrescentado era este relatório.

## Correções e verificação final

Implementação autorizada e concluída em 2026-10-01. Os números e descrições anteriores representam a linha de base, não o estado atual.

- **Sessões:** refresh com rotação atômica em PostgreSQL, digest SHA-256 do token, detecção de replay com revogação persistida e validade absoluta de 15 dias. Access tokens dependem de sessão ativa; logout e exclusão invalidam acesso. Assinatura RS256, emissor/destinatário e formato dos claims são explícitos. Tokens forjados não revogam sessões legítimas.
- **Abuso e performance:** limites global, por origem e por conta no banco, compartilhados entre instâncias; falhas do armazenamento retornam 503. Fila de hashing FIFO com inserção/remoção O(1), concorrência e tamanho limitados. Argon2id conserva custo m=65536, t=3, p=4 dos hashes existentes; login de conta inexistente verifica um hash fictício criado no startup com o mesmo custo. A validação do e-mail passou de pior caso O(L²) para O(L); limites de campos alinham HTTP e persistência. Não se afirma melhoria de Big O para buscas de usuários ou assinatura JWT.
- **Falhas e configuração:** listener de erros ociosos do pool, prazos de conexão/query/statement/lock, readiness de banco/schema, limites Unicode e tratamento seguro de JSON malformado/corpo excessivo. Headers e request ID são aplicados antes do parser. Chaves RSA correspondentes de 2048–4096 bits, ambiente obrigatório e proxies por IP/CIDR explícito.
- **Auditoria e cadeia de entrega:** eventos estruturados sem tokens/senhas/SQL, dependências corrigidas e Nodemailer removido. Auditoria inclui ferramentas de desenvolvimento; CI Node 24/pnpm 11.25.0 cobre PRs, lint/build/testes/audit, com chaves efêmeras. Actions e imagens fixadas por SHA/digest. Compose corrigido e banco de desenvolvimento vinculado a localhost.
- **Produção:** o build emite `dist/main.js`, inclusive em builds consecutivos; o cache incremental fica dentro de `dist`. A imagem usa dependências de produção e usuário não root. O contexto Docker exclui segredos e caches.

Validação final:

- `pnpm test`: **56 testes unitários passaram**, em 13 arquivos.
- `pnpm test:e2e`: **27 testes HTTP/integração passaram**, em 5 arquivos, com PostgreSQL temporário. Incluem concorrência, replay, logout, expiração da sessão, tokens forjados, contadores compartilhados, falhas de parsing e aplicação do SQL aditivo com exclusão em cascata.
- `pnpm biome:lint`, dois `pnpm build` consecutivos e `git diff --check`: sem erros.
- `pnpm audit --json`: **zero advisories**, incluindo dependências de desenvolvimento, entre 825 dependências contabilizadas pelo registro nessa consulta. Isso não é garantia de ausência de vulnerabilidades desconhecidas.
- Build e bootstrap do entrypoint real na imagem de produção com **Node 24.21.0**: passaram. Sem banco disponível, readiness retornou 503 controlado; Swagger em produção retornou 404. Chaves e pepper foram gerados em memória para esse teste.
- SQL aditivo testado sobre tabela `users` existente; configuração dos dois Composefiles validada e geração Drizzle exercitada após os overrides.
- Revisão independente das mudanças não identificou problema material restante. Nenhum banco existente foi migrado automaticamente e não houve commit/push.

**Implantação e limites restantes:** seguir o rollout no README, aplicando `drizzle/20261001_security_state.sql` antes da nova versão. Clientes precisam salvar o novo refresh token, serializar renovações e autenticar novamente com tokens antigos. O cadastro mantém 409 para e-mail existente, portanto a divulgação explícita de existência de conta permanece documentada. HTTPS, TLS do banco, gestão/rotação de segredos, proxies reais e alertas externos precisam ser configurados na implantação. Não foram executados teste de carga, EXPLAIN ANALYZE, scan de vulnerabilidades da imagem ou workflow remoto do GitHub; os resultados não certificam cobertura integral do OWASP Top 10.
