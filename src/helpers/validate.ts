import { Request, Response, NextFunction } from 'express';
import { ValidationChain, validationResult } from 'express-validator';

const validations =
  (rules: ValidationChain[]) => (req: Request, res: Response, next: NextFunction) => {
    Promise.all(rules.map((rule) => rule.run(req))).then(() => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      next();
    });
  };

export default validations;
