import fs from 'fs';
import path from 'path';

import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

export const setupSwagger = (app: Express) => {
  const filePath = path.resolve(__dirname, '../docs/openapi.json');
  if (!fs.existsSync(filePath)) {
    console.error('❌ Swagger spec not found:', filePath);
    return;
  }
  const spec = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec));
};
