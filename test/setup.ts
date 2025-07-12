import { execSync } from 'child_process';
// При желании — мигрируем и чистим БД перед тестами
execSync('npx knex migrate:latest --env development');
execSync('node clearDatabase.cjs', { stdio: 'inherit' });
