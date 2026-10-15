# Implantação

## Estado atual (Fase 1)

O jogo é **100% cliente** nesta fase: não há servidor, banco de dados nem variáveis de ambiente obrigatórias.

```bash
npm install
npm run build          # gera apps/client/dist
npm run preview        # testa o build localmente
```

O conteúdo de `apps/client/dist` pode ser publicado em qualquer hospedagem de arquivos estáticos (Nginx, Caddy, GitHub Pages, Netlify, S3 + CDN). Não há rotas no servidor — tudo é servido a partir de `index.html`.

Exemplo mínimo com Nginx:

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  location / { try_files $uri /index.html; }
  location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
}
```

## Depuração em produção

Adicionar `?debug` à URL expõe `window.__EOC__` (sessão atual) para inspeção no console. Em desenvolvimento ele está sempre ativo.

## Planejado (Fases 7 e 8)

Ainda **não implementado** — documentado para orientar as próximas fases:

- `apps/server`: Node.js + Socket.IO executando `@eoc/simulation` de forma autoritativa.
- PostgreSQL + Prisma para contas, histórico de partidas e salvamentos por conta; Redis opcional.
- Dockerfiles para cliente (build estático + Nginx) e servidor, e `docker-compose.yml` com `client`, `server`, `postgres` e `redis`.
- Variáveis previstas: `DATABASE_URL`, `REDIS_URL`, `PORT`, `CORS_ORIGIN`, `SESSION_SECRET`.
- Segurança: validação de comandos no servidor (já implementada na simulação), limitação de taxa, filtro de informação por fog of war, sessões seguras.
