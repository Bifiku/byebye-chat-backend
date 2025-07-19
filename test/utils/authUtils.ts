export async function expectTokens(res: any, status: number = 200) {
  expect(res.status).toBe(status);
  expect(res.body).toHaveProperty('accessToken');
  expect(res.body).toHaveProperty('refreshToken');
  expect(typeof res.body.accessToken).toBe('string');
  expect(typeof res.body.refreshToken).toBe('string');
  expect(res.body.accessToken.split('.').length).toBe(3);
  expect(res.body.refreshToken.split('.').length).toBe(3);
}

export function expectValidationErrors(res: any, expectPaths: string[], status: number = 400) {
  expect(res.status).toBe(status);
  expect(Array.isArray(res.body.errors)).toBe(true);
  const paths = res.body.errors.map((e: any) => e.path).sort();
  expect(paths).toEqual(expectPaths.sort());
}
