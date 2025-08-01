require('dotenv').config();

module.exports = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './src/migrations',
    },
  },

  test: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './src/migrations',
    },
  },
};
